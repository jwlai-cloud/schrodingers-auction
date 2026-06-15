/**
 * GET /api/auctions/[id]/state
 *
 * Returns the current room state for a live auction.
 * Edge-cached with s-maxage=1, stale-while-revalidate=1 so the polling
 * fleet of any size generates ~1 origin request/second/auction.
 *
 * TODO (Days 6–8): Replace mock JSON with real DSQL + rollup reads.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuctionStateResponse } from "@/lib/types";
import { actsToPauseWindows } from "@/lib/price";

// Stub auction fixture — deterministic params for demo rendering
function buildMockState(id: string): AuctionStateResponse {
  const now = Date.now();

  // Auction started 4 minutes ago, 15-minute duration
  const startsAtMs = now - 4 * 60 * 1000;
  const durationS = 15 * 60;

  // Act spotlights at 3 min, 7 min, 11 min of active time
  const pauseWindows = actsToPauseWindows([3 * 60, 7 * 60, 11 * 60]);

  return {
    auctionId: id,
    status: "live",
    decayParams: {
      startsAtMs,
      durationS,
      startPrice: 1200,
      reservePrice: 200,
      curve: "linear",
      pauseWindows,
      burnLevel: 1,
      burnEffectiveAtMs: now - 60_000,
    },
    armed: {
      tier3: 31,
      tier2: 14,
      tier1: 9,
    },
    spectatorsEst: 2341,
    lotteryCount: 18,
    reactions5s: {
      "🔥": 42,
      "👀": 17,
      "💀": 5,
      "🤑": 11,
    },
    regions5s: {
      "AU-W": 12,
      "US-NY": 9,
      "JP-13": 7,
      "GB-ENG": 5,
      "DE-BE": 4,
    },
    serverTimeMs: now,
    computedAt: new Date(now).toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AuctionStateResponse | { error: string }>> {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing auction id" }, { status: 400 });
  }

  const body = buildMockState(id);

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=1, stale-while-revalidate=1",
    },
  });
}
