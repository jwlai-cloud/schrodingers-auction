/**
 * POST /api/votes
 *
 * Records a vote for an act, granting the caller claim-tier rights.
 * Insert-only (no hot rows under DSQL OCC). Deduplicated by
 * UNIQUE (auction_id, user_id, act_no) at the database layer.
 *
 * TODO (Days 3–5): Replace stub with real DSQL insert + tier computation.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { VoteRequest, VoteResponse } from "@/lib/types";
import { actsToPauseWindows } from "@/lib/price";

export async function POST(
  req: NextRequest
): Promise<NextResponse<VoteResponse | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auctionId, actNo, viaCatchup = false } = body as VoteRequest;

  if (!auctionId || !actNo || ![1, 2, 3].includes(actNo)) {
    return NextResponse.json(
      { error: "auctionId and actNo (1|2|3) are required" },
      { status: 400 }
    );
  }

  // Mock: pretend caller had 1 vote before and now has 2
  const totalVotes = 2;
  const tier = totalVotes >= 3 ? 3 : totalVotes === 2 ? 2 : totalVotes === 1 ? 1 : 0;
  const now = Date.now();
  const startsAtMs = now - 4 * 60 * 1000;

  const mockState = {
    auctionId,
    status: "live" as const,
    decayParams: {
      startsAtMs,
      durationS: 15 * 60,
      startPrice: 1200,
      reservePrice: 200,
      curve: "linear" as const,
      pauseWindows: actsToPauseWindows([3 * 60, 7 * 60, 11 * 60]),
      burnLevel: 1 as const,
      burnEffectiveAtMs: now - 60_000,
    },
    armed: { tier3: 32, tier2: 14, tier1: 9 },
    spectatorsEst: 2342,
    lotteryCount: 18,
    reactions5s: { "🔥": 42, "👀": 17, "💀": 5, "🤑": 11 },
    regions5s: { "AU-W": 12, "US-NY": 9, "JP-13": 7 },
    serverTimeMs: now,
    computedAt: new Date(now).toISOString(),
  };

  const response: VoteResponse = {
    voteId: randomUUID(),
    totalVotes,
    tier: tier as 0 | 1 | 2 | 3,
    lotteryEligible: tier === 3,
    state: mockState,
  };

  // Suppress unused variable warning in stub
  void viaCatchup;

  return NextResponse.json(response, { status: 201 });
}
