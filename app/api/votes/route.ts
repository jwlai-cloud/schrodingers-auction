/**
 * POST /api/votes
 *
 * Records a vote for an act, granting the caller claim-tier rights.
 * Insert-only — no hot rows under DSQL OCC.
 * Deduplicated at the DB layer by UNIQUE (auction_id, user_id, act_no).
 *
 * Auth: expects X-User-Id header (real JWT validation added in auth sprint).
 *
 * Flow:
 *   1. Validate request.
 *   2. INSERT vote (on conflict do nothing — idempotent).
 *   3. COUNT total votes for this user+auction → derive tier.
 *   4. Upsert lottery_entries if tier=3 (fully armed).
 *   5. Return fresh state snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { votesToTier } from "@/lib/price";
import type { VoteRequest, VoteResponse, AuctionStateResponse } from "@/lib/types";
import type { PauseWindow } from "@/lib/price";

const ALLOWED_ACT_NOS = [1, 2, 3] as const;

interface AuctionStateRow extends Record<string, unknown> {
  id: string;
  status: string;
  starts_at: Date;
  duration_s: number;
  start_price: string;
  reserve_price: string;
  curve: string;
  pause_windows: string;
  burn_level: number;
  burn_effective: Date | null;
  armed_3: number;
  armed_2: number;
  armed_1: number;
  spectators_est: number;
  lottery_count: number;
  reactions_5s: string;
  regions_5s: string;
  computed_at: Date;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<VoteResponse | { error: string }>> {
  // ── Auth (stub: X-User-Id header; replace with real session in auth sprint) ─
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auctionId, actNo, viaCatchup = false } = body as VoteRequest;

  if (!auctionId || !actNo || !ALLOWED_ACT_NOS.includes(actNo)) {
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
    return NextResponse.json(
      { error: "Auction is not live" },
      { status: 409 }
    );
  }

  // ── Insert vote (idempotent via ON CONFLICT DO NOTHING) ──────────────────
  const voteId = randomUUID();
  const regionCode = req.headers.get("x-region-code") ?? null;

  await query(
    `INSERT INTO votes (id, auction_id, user_id, act_no, via_catchup, region_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (auction_id, user_id, act_no) DO NOTHING`,
    [voteId, auctionId, userId, actNo, viaCatchup, regionCode]
  );

  // ── Count total votes for tier computation ───────────────────────────────
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM votes WHERE auction_id = $1 AND user_id = $2`,
    [auctionId, userId]
  );
  const totalVotes = parseInt(countResult.rows[0].count, 10);
  const tier = votesToTier(totalVotes);
  const lotteryEligible = tier === 3;

  // ── Auto-enter lottery when fully armed ─────────────────────────────────
  if (lotteryEligible) {
    await query(
      `INSERT INTO lottery_entries (id, auction_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (auction_id, user_id) DO NOTHING`,
      [randomUUID(), auctionId, userId]
    );
  }

  // ── Fetch fresh state snapshot (read-your-writes) ────────────────────────
  const stateResult = await query<AuctionStateRow>(
    `SELECT
       a.id, a.status, a.starts_at, a.duration_s,
       a.start_price, a.reserve_price, a.curve,
       a.pause_windows, a.burn_level, a.burn_effective,
       r.armed_3, r.armed_2, r.armed_1,
       r.spectators_est, r.lottery_count,
       r.reactions_5s, r.regions_5s, r.computed_at
     FROM auctions a
     LEFT JOIN auction_rollups r ON r.auction_id = a.id
     WHERE a.id = $1`,
    [auctionId]
  );

  const sr = stateResult.rows[0];
  let pauseWindows: PauseWindow[] = [];
  try { pauseWindows = JSON.parse(sr?.pause_windows ?? "[]"); } catch { /**/ }

  const now = Date.now();
  const state: AuctionStateResponse = {
    auctionId,
    status: (sr?.status ?? "live") as AuctionStateResponse["status"],
    decayParams: {
      startsAtMs: sr ? new Date(sr.starts_at).getTime() : now,
      durationS: sr?.duration_s ?? 900,
      startPrice: sr ? Number(sr.start_price) : 0,
      reservePrice: sr ? Number(sr.reserve_price) : 0,
      curve: "linear",
      pauseWindows,
      burnLevel: ((sr?.burn_level ?? 0) as 0 | 1 | 2 | 3),
      burnEffectiveAtMs: sr?.burn_effective ? new Date(sr.burn_effective).getTime() : null,
    },
    armed: { tier3: sr?.armed_3 ?? 0, tier2: sr?.armed_2 ?? 0, tier1: sr?.armed_1 ?? 0 },
    spectatorsEst: sr?.spectators_est ?? 0,
    lotteryCount: sr?.lottery_count ?? 0,
    reactions5s: (() => { try { return JSON.parse(sr?.reactions_5s ?? "{}"); } catch { return {}; } })(),
    regions5s: (() => { try { return JSON.parse(sr?.regions_5s ?? "{}"); } catch { return {}; } })(),
    serverTimeMs: now,
    computedAt: sr?.computed_at ? new Date(sr.computed_at).toISOString() : new Date(now).toISOString(),
  };

  return NextResponse.json(
    { voteId, totalVotes, tier, lotteryEligible, state },
    { status: 201 }
  );
}
