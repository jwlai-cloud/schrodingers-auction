/**
 * POST /api/auctions/[id]/relist
 *
 * Seller-only. Resets a finished (unsold/claimed) auction to live with a fresh
 * start time so it falls again from the top. Used after a withdraw-unsold.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rows } = await query<{ seller_user_id: string }>(
    `SELECT seller_user_id FROM auctions WHERE id = $1`,
    [id]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }
  if (rows[0].seller_user_id !== session.id) {
    return NextResponse.json({ error: "Not your listing" }, { status: 403 });
  }

  await query(
    `UPDATE auctions
       SET status = 'live', winner_user_id = NULL, winning_price = NULL,
           claimed_at = NULL, won_via = NULL, starts_at = NOW(),
           burn_level = 0, burn_effective = NULL
     WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ ok: true });
}
