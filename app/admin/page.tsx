"use client";

/**
 * /admin — lightweight database browser for demo/debug.
 * Calls /api/admin/query to run read-only SQL against Aurora DSQL.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Database, Loader2 } from "lucide-react";

const QUICK_QUERIES = [
  { label: "All auctions", sql: "SELECT id, title, category, status, start_price, reserve_price FROM auctions ORDER BY created_at DESC LIMIT 20" },
  { label: "All users", sql: "SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 20" },
  { label: "Wallets", sql: "SELECT user_id, balance FROM wallets ORDER BY balance DESC LIMIT 20" },
  { label: "Sessions", sql: "SELECT id, user_id, expires_at FROM sessions ORDER BY created_at DESC LIMIT 20" },
  { label: "Acts", sql: "SELECT auction_id, act_no, headline FROM acts ORDER BY auction_id, act_no LIMIT 30" },
  { label: "Claims", sql: "SELECT * FROM claims ORDER BY claimed_at DESC LIMIT 20" },
];

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export default function AdminPage() {
  const [sql, setSql] = useState(QUICK_QUERIES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runQuery() {
    setError(null);
    setResult(null);
    setLoading(true);
    const start = Date.now();
    try {
      const res = await fetch(
        `/api/admin/query?secret=schrodinger-debug&sql=${encodeURIComponent(sql)}`
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Query failed");
      } else {
        setResult({ ...data, durationMs: Date.now() - start });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const columns = result?.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Database className="w-4 h-4 text-amber" />
        <h1 className="font-mono font-bold text-foreground text-sm">Aurora DSQL — debug browser</h1>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
          read-only &middot; secret-gated
        </span>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar — quick queries */}
        <aside className="w-52 flex-shrink-0 border-r border-border p-3 flex flex-col gap-1 overflow-y-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1">Quick queries</p>
          {QUICK_QUERIES.map((q) => (
            <button
              key={q.label}
              onClick={() => setSql(q.sql)}
              className={`text-left px-3 py-2 rounded-md text-xs transition-colors font-mono ${
                sql === q.sql
                  ? "bg-amber/10 text-amber border border-amber/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {q.label}
            </button>
          ))}

          <div className="mt-4 border-t border-border pt-3 flex flex-col gap-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1">Admin actions</p>
            <a
              href="/api/admin/migrate006?secret=schrodinger-debug"
              target="_blank"
              className="text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-mono"
            >
              Run migration 006
            </a>
            <button
              onClick={async () => {
                setLoading(true);
                const r = await fetch("/api/admin/seed?secret=schrodinger-debug", { method: "POST" });
                const d = await r.json();
                setError(null);
                setResult({ rows: d.results?.map((s: string) => ({ result: s })) ?? [], rowCount: d.results?.length ?? 0, durationMs: 0 });
                setLoading(false);
              }}
              className="text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-mono"
            >
              Re-seed demo data
            </button>
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Query editor */}
          <div className="border-b border-border p-4 flex flex-col gap-3">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={4}
              spellCheck={false}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber resize-none"
              placeholder="SELECT * FROM auctions LIMIT 5"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={runQuery}
                disabled={loading || !sql.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground font-mono font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run query
              </button>
              {result && (
                <span className="font-mono text-xs text-muted-foreground">
                  {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} &middot; {result.durationMs}ms
                </span>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto p-4">
            {error && (
              <div className="rounded-md border border-drop-red/20 bg-drop-red/5 px-4 py-3 font-mono text-xs text-drop-red">
                {error}
              </div>
            )}

            {result && result.rows.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">No rows returned.</p>
            )}

            {result && result.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="text-left px-3 py-2 text-muted-foreground font-semibold whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        {columns.map((col) => {
                          const val = row[col];
                          const display =
                            val === null || val === undefined
                              ? <span className="text-muted-foreground/40">NULL</span>
                              : typeof val === "object"
                              ? <span className="text-amber/80">{JSON.stringify(val)}</span>
                              : String(val);
                          return (
                            <td key={col} className="px-3 py-2 text-foreground max-w-[300px] truncate">
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!result && !error && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Database className="w-10 h-10 opacity-20" />
                <p className="font-mono text-xs">Pick a query and hit Run</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
