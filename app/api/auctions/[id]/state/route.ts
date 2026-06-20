/**
 * GET /api/auctions/[id]/state
 *
 * Returns the current room state for a live auction.
 * Reads from the `auctions` table (decay params + status) and the
 * `auction_rollups` row (armed counts, spectators, reactions) in a
 * single connection round-trip.
 *
 * Edge-cached: s-maxage=1, stale-while-revalidate=1 so the polling
 * fleet generates ~1 origin request/second/auction regardless of viewer count.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { AuctionStateResponse, AuctionStatus, WonVia } from "@/lib/types";
import type { AuctionDecayParams, PauseWindow } from "@/lib/price";

interface AuctionStateRow extends Record<string, unknown> {
  id: string;
  status: AuctionStatus;
  starts_at: Date;
  duration_s: number;
  start_price: string;
  reserve_price: string;
  curve: string;
  pause_windows: string;
  burn_level: number;
  burn_effective: Date | null;
  winner_user_id: string | null;
  winning_price: string | null;
  claimed_at: Date | null;
  won_via: string | null;
  // rollup columns (nullable when no rollup row exists yet)
  armed_3: number | null;
  armed_2: number | null;
  armed_1: number | null;
  spectators_est: number | null;
  lottery_count: number | null;
  reactions_5s: string | null;
  regions_5s: string | null;
  computed_at: Date | null;
}

interface WinnerRow extends Record<string, unknown> {
  display_name: string;
  region_code: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AuctionStateResponse | { error: string }>> {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing auction id" }, { status: 400 });
  }

  const now = Date.now();

  // Single query: join auctions + rollup in one round-trip.
  const { rows } = await query<AuctionStateRow>(
    `SELECT
       a.id, a.status, a.starts_at, a.duration_s,
       a.start_price, a.reserve_price, a.curve,
       a.pause_windows, a.burn_level, a.burn_effective,
       a.winner_user_id, a.winning_price, a.claimed_at, a.won_via,
       r.armed_3, r.armed_2, r.armed_1,
       r.spectators_est, r.lottery_count,
       r.reactions_5s, r.regions_5s, r.computed_at
     FROM auctions a
     LEFT JOIN auction_rollups r ON r.auction_id = a.id
     WHERE a.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  const row = rows[0];

  // Parse stored JSON text columns (DSQL has no JSON/JSONB).
  let pauseWindows: PauseWindow[] = [];
  try {
    pauseWindows = JSON.parse(row.pause_windows ?? "[]") as PauseWindow[];
  } catch {
    pauseWindows = [];
  }

  const decayParams: AuctionDecayParams = {
    startsAtMs: new Date(row.starts_at).getTime(),
    durationS: row.duration_s,
    startPrice: Number(row.start_price),
    reservePrice: Number(row.reserve_price),
    curve: "linear",
    pauseWindows,
    burnLevel: (row.burn_level ?? 0) as 0 | 1 | 2 | 3,
    burnEffectiveAtMs: row.burn_effective ? new Date(row.burn_effective).getTime() : null,
  };

  // Fetch winner display name if claimed.
  let winner: AuctionStateResponse["winner"];
  if (row.winner_user_id && row.winning_price) {
    const winnerResult = await query<WinnerRow>(
      `SELECT display_name, region_code FROM users WHERE id = $1`,
      [row.winner_user_id]
    );
    const wu = winnerResult.rows[0];
    winner = {
      displayName: wu?.display_name ?? "unknown",
      regionCode: wu?.region_code ?? null,
      winningPrice: Number(row.winning_price),
      wonVia: (row.won_via ?? "claim") as WonVia,
      claimedAtMs: row.claimed_at ? new Date(row.claimed_at).getTime() : now,
    };
  }

  // Parse rollup JSON text fields.
  let reactions5s: AuctionStateResponse["reactions5s"] = {};
  let regions5s: AuctionStateResponse["regions5s"] = {};
  try {
    reactions5s = JSON.parse(row.reactions_5s ?? "{}");
    regions5s = JSON.parse(row.regions_5s ?? "{}");
  } catch {
    // leave as empty objects
  }

  const body: AuctionStateResponse = {
    auctionId: row.id,
    status: row.status,
    decayParams,
    armed: {
      tier3: row.armed_3 ?? 0,
      tier2: row.armed_2 ?? 0,
      tier1: row.armed_1 ?? 0,
    },
    spectatorsEst: row.spectators_est ?? 0,
    lotteryCount: row.lottery_count ?? 0,
    reactions5s,
    regions5s,
    serverTimeMs: now,
    winner,
    computedAt: row.computed_at
      ? new Date(row.computed_at).toISOString()
      : new Date(now).toISOString(),
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=1, stale-while-revalidate=1",
    },
  });
}
