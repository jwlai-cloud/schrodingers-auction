import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized — admin access only" }, { status: 401 });
  }

  const sql = req.nextUrl.searchParams.get("sql")
    ?? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";

  // Only SELECT statements — multi-statement bypass prevention
  const normalized = sql.trim().replace(/\s+/g, " ");
  if (!normalized.toUpperCase().startsWith("SELECT")) {
    return NextResponse.json({ error: "Only SELECT statements are allowed" }, { status: 400 });
  }
  // Reject semicolons to block stacked statements
  if (normalized.includes(";")) {
    return NextResponse.json({ error: "Semicolons are not allowed" }, { status: 400 });
  }

  try {
    const result = await query<Record<string, unknown>>(sql);
    // Strip any password_hash columns from results
    const rows = result.rows.map((row) => {
      const { password_hash: _ph, ...rest } = row as Record<string, unknown> & { password_hash?: unknown };
      return rest;
    });
    return NextResponse.json({ ok: true, rowCount: rows.length, rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
