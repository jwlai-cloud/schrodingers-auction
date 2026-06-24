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
import { votesToTier, armedToBrakeLevel } from "@/lib/price";
import { fetchArmedCounts } from "@/lib/auctions";
import type { VoteRequest } from "@/lib/types";

const ALLOWED_ACT_NOS = [1, 2, 3] as const;
const VOTE_COOLDOWN_MS = 10_000; // anti-spam; act-reveal gating provides the real pacing

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

  // ── Validate auction + fetch start time ───────────────────────────────────
  const auctionCheck = await query<{ status: string; starts_at: Date }>(
    `SELECT status, starts_at FROM auctions WHERE id = $1`,
    [auctionId]
  );
  if (auctionCheck.rows.length === 0) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }
  const startsAtMs = new Date(auctionCheck.rows[0].starts_at).getTime();
  const now = Date.now();

  // ── Gate 1: the act must already be REVEALED (vote during/after its spotlight) ──
  const actRow = await query<{ reveal_offset_s: number }>(
    `SELECT reveal_offset_s FROM acts WHERE auction_id = $1 AND act_no = $2`,
    [auctionId, actNo]
  );
  if (actRow.rows.length > 0) {
    const revealAtMs = startsAtMs + actRow.rows[0].reveal_offset_s * 1000;
    if (now < revealAtMs) {
      const waitS = Math.ceil((revealAtMs - now) / 1000);
      return NextResponse.json(
        { error: `Act ${actNo} hasn't been revealed yet. Watch for the spotlight in ${waitS}s.`, revealInS: waitS },
        { status: 425 }
      );
    }
  }

  // ── Idempotency pre-check (DSQL-safe: no ON CONFLICT on non-PK unique) ──
  const existing = await query<{ id: string }>(
    `SELECT id FROM votes WHERE auction_id = $1 AND user_id = $2 AND act_no = $3`,
    [auctionId, userId, actNo]
  );

  if (existing.rows.length === 0) {
    // ── Gate 2: short cooldown between distinct votes (deliberate, not spam) ──
    const lastVote = await query<{ created_at: Date }>(
      `SELECT created_at FROM votes WHERE auction_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [auctionId, userId]
    );
    if (lastVote.rows.length > 0) {
      const sinceMs = now - new Date(lastVote.rows[0].created_at).getTime();
      if (sinceMs < VOTE_COOLDOWN_MS) {
        const waitS = Math.ceil((VOTE_COOLDOWN_MS - sinceMs) / 1000);
        return NextResponse.json(
          { error: `One vote at a time — decide carefully. Try again in ${waitS}s.`, cooldownS: waitS },
          { status: 429 }
        );
      }
    }
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

  // ── Demand brake: as armed bidders cross milestones, slow the price decay ──
  // Ratchet the brake level UP only (keeps the price curve deterministic).
  try {
    const armedMap = await fetchArmedCounts([auctionId]);
    const a = armedMap.get(auctionId);
    const totalArmed = a ? a.tier3 + a.tier2 + a.tier1 : 0;
    const brake = armedToBrakeLevel(totalArmed);
    if (brake > 0) {
      // Atomic ratchet: bump only when the new level is higher. One statement,
      // no read-then-write race between concurrent voters.
      await query(
        `UPDATE auctions
           SET burn_level = $1, burn_effective = NOW()
         WHERE id = $2 AND COALESCE(burn_level, 0) < $1`,
        [brake, auctionId]
      );
    }
  } catch (err) {
    console.error("[votes] brake ratchet failed:", err);
  }

  return NextResponse.json({ totalVotes, tier, lotteryEligible: tier === 3 }, { status: 201 });
}
