/**
 * POST /api/votes
 *
 * Records a vote for an act, granting the caller claim-tier rights.
 * Insert-only — no hot rows under DSQL OCC.
 * Deduplicated by pre-check (DSQL does not support ON CONFLICT on non-PK unique indexes).
 *
 * Auth: session cookie via getSession().
 *
 * Flow:
 *   1. Validate request + auth.
 *   2. Check whether vote already exists — skip insert if so (idempotent).
 *   3. INSERT vote.
 *   4. COUNT total votes for this user+auction → derive tier.
 *   5. Upsert lottery_entries if tier=3 (fully armed).
 *   6. Return tier + totalVotes.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { votesToTier } from "@/lib/price";
import type { VoteRequest } from "@/lib/types";

const ALLOWED_ACT_NOS = [1, 2, 3] as const;

export async function POST(req: Request): Promise<NextResponse> {
  // ── Auth via session cookie ──────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const userId = session.id;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { auctionId, actNo } = body as VoteRequest;

  if (!auctionId || !actNo || !ALLOWED_ACT_NOS.includes(actNo as 1 | 2 | 3)) {
    return NextResponse.json(
      { error: "auctionId and actNo (1|2|3) are required" },
      { status: 400 }
    );
  }

  // ── Validate auction exists and is live ──────────────────────────────────
  const auctionCheck = await query<{ status: string }>(
    `SELECT status FROM auctions WHERE id = $1`,
    [auctionId]
  );

  if (auctionCheck.rows.length === 0) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }
  if (auctionCheck.rows[0].status !== "live") {
    // Non-live auctions silently accept votes (demo mode / post-auction catch-up)
    // Still count toward tier but don't block.
  }

  // ── Idempotency pre-check (DSQL-safe: no ON CONFLICT on non-PK unique) ──
  const existing = await query<{ id: string }>(
    `SELECT id FROM votes WHERE auction_id = $1 AND user_id = $2 AND act_no = $3`,
    [auctionId, userId, actNo]
  );

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO votes (id, auction_id, user_id, act_no, via_catchup, region_code)
       VALUES ($1, $2, $3, $4, false, null)`,
      [randomUUID(), auctionId, userId, actNo]
    );
  }

  // ── Count total votes for tier computation ───────────────────────────────
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM votes WHERE auction_id = $1 AND user_id = $2`,
    [auctionId, userId]
  );
  const totalVotes = parseInt(countResult.rows[0].count, 10);
  const tier = votesToTier(totalVotes);

  // ── Auto-enter lottery when fully armed ─────────────────────────────────
  if (tier === 3) {
    const lotteryExisting = await query<{ id: string }>(
      `SELECT id FROM lottery_entries WHERE auction_id = $1 AND user_id = $2`,
      [auctionId, userId]
    );
    if (lotteryExisting.rows.length === 0) {
      await query(
        `INSERT INTO lottery_entries (id, auction_id, user_id) VALUES ($1, $2, $3)`,
        [randomUUID(), auctionId, userId]
      );
    }
  }

  return NextResponse.json({ totalVotes, tier, lotteryEligible: tier === 3 }, { status: 201 });
}
