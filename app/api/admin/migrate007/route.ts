/**
 * GET /api/admin/migrate007  (admin only)
 * Adds auctions.floor_action — 'lottery' (default) or 'withdraw'.
 * DSQL: nullable add (no NOT NULL DEFAULT); the app treats null as 'lottery'.
 */
import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: { ddl: string; status: string }[] = [];
  async function run(ddl: string) {
    try {
      // Single DDL auto-commits on its own connection (DSQL: one DDL per txn).
      await withConnection(async (client) => {
        await client.query(ddl);
      });
      steps.push({ ddl: ddl.slice(0, 80), status: "ok" });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes("already exists") || msg.includes("duplicate column")) {
        steps.push({ ddl: ddl.slice(0, 80), status: "skipped (already exists)" });
      } else {
        steps.push({ ddl: ddl.slice(0, 80), status: `error: ${msg.slice(0, 120)}` });
        throw err;
      }
    }
  }

  try {
    await run(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS floor_action VARCHAR(12)`);
    return NextResponse.json({ ok: true, steps });
  } catch {
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }
}
