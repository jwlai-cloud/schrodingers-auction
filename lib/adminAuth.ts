/**
 * lib/adminAuth.ts
 *
 * Shared guard for all /api/admin/* routes.
 * Returns true when the caller is allowed.
 *
 * Allowed if:
 *   - The session email is in the ADMIN_EMAILS env var (comma-separated), OR
 *   - A valid ADMIN_SECRET is set in the env AND the x-admin-secret header
 *     matches it. The fallback is intentionally absent — if ADMIN_SECRET is
 *     not set, the secret path is disabled entirely. The secret is accepted
 *     only via the header (never a query param, which leaks into access logs,
 *     browser history, and referers).
 */

import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

const ADMIN_EMAILS: Set<string> = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export async function isAdmin(req?: NextRequest): Promise<boolean> {
  // Session-based check (primary — works in production)
  const session = await getSession().catch(() => null);
  if (session && ADMIN_EMAILS.has(session.email.toLowerCase())) return true;

  // Secret-based check (machine callers / local dev — disabled if ADMIN_SECRET
  // is not set in the env). Accepted ONLY via the x-admin-secret header — never
  // a query param, which would leak into access logs, browser history, referers.
  if (req && process.env.ADMIN_SECRET) {
    const secret = req.headers.get("x-admin-secret");
    if (secret && secret === process.env.ADMIN_SECRET) return true;
  }

  return false;
}
