import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: { ddl: string; status: string; msg?: string }[] = [];

  async function run(ddl: string) {
    try {
      await query(ddl);
      steps.push({ ddl: ddl.slice(0, 80), status: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        steps.push({ ddl: ddl.slice(0, 80), status: "skip", msg });
      } else {
        steps.push({ ddl: ddl.slice(0, 80), status: "error", msg });
        throw e;
      }
    }
  }

  try {
    await run(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS category VARCHAR(40)`);
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200)`);
    await run(`CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await run(`COMMIT`);
    await run(`CREATE INDEX ASYNC IF NOT EXISTS sessions_user_ix ON sessions (user_id, expires_at)`);
    await run(`COMMIT`);

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, steps, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
