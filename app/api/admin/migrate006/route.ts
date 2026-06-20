/**
 * GET /api/admin/migrate006?secret=schrodinger-debug
 * Adds password_hash to users and creates sessions table.
 */
import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

const DEBUG_SECRET = "schrodinger-debug";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results: { ddl: string; status: string }[] = [];

  async function run(ddl: string) {
    try {
      await withConnection(async (client) => {
        await client.query(ddl);
        await client.query("COMMIT");
      });
      results.push({ ddl: ddl.slice(0, 80), status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already exists" errors are fine — idempotent
      if (
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("duplicate column")
      ) {
        results.push({ ddl: ddl.slice(0, 80), status: "skipped (already exists)" });
      } else {
        results.push({ ddl: ddl.slice(0, 80), status: `error: ${msg.slice(0, 120)}` });
        throw err;
      }
    }
  }

  try {
    // Add password_hash to users (nullable so existing rows aren't affected)
    await run(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(64)`);

    // Create sessions table
    await run(`CREATE TABLE IF NOT EXISTS sessions (
      id           VARCHAR(64) PRIMARY KEY,
      user_id      UUID        NOT NULL,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await run(`CREATE INDEX ASYNC IF NOT EXISTS sessions_user_ix ON sessions (user_id)`);

    return NextResponse.json({ ok: true, steps: results });
  } catch {
    return NextResponse.json({ ok: false, steps: results }, { status: 500 });
  }
}
