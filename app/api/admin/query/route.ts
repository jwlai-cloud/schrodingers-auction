import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// One-shot debug endpoint — returns query results as JSON.
// Protected by a shared secret so it is not wide-open.
// Remove before going to production.

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== (process.env.ADMIN_SECRET ?? "schrodinger-debug")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = req.nextUrl.searchParams.get("sql") ?? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";

  if (!sql.trim().toUpperCase().startsWith("SELECT")) {
    return NextResponse.json({ error: "Only SELECT statements are allowed" }, { status: 400 });
  }

  try {
    const result = await query<Record<string, unknown>>(sql);
    return NextResponse.json({
      ok: true,
      rowCount: result.rows.length,
      rows: result.rows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
