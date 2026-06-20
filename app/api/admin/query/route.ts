import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Admin DB browser — only accessible to emails listed in ADMIN_EMAILS env var.
 * Falls back to a secret query param for local dev when no session is present.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "junwei.lai@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export async function GET(req: NextRequest) {
  // Primary auth: session cookie with admin email
  const session = await getSession().catch(() => null);
  const isAdminSession = session && ADMIN_EMAILS.includes(session.email.toLowerCase());

  // Fallback: secret query param for local dev / CI without a session
  const secret = req.nextUrl.searchParams.get("secret");
  const isSecretValid = secret && secret === (process.env.ADMIN_SECRET ?? "schrodinger-debug");

  if (!isAdminSession && !isSecretValid) {
    return NextResponse.json({ error: "Unauthorized — admin access only" }, { status: 401 });
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
