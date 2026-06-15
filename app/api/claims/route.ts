/**
 * POST /api/claims
 *
 * The centerpiece transaction: atomically claims an auction for the caller.
 *
 * Server-side flow (when real DB is wired):
 *   1. Read auction facts + caller's wallet in one snapshot.
 *   2. Compute authoritative price from decay params + NOW().
 *   3. Validate: status=live, winner=NULL, price>reserve, tier delay satisfied,
 *      balance >= price.
 *   4. Guarded UPDATE: SET winner_user_id=$u WHERE id=$a AND winner_user_id IS NULL
 *   5. If 1 row affected → settle (ledger double-entry); result='won'.
 *      If 0 rows affected → OCC abort or already claimed; result='lost'.
 *   6. Map DSQL OCC serialization conflict at commit → loser receipt.
 *
 * Claims are NEVER retried — an abort IS the loss signal.
 * Idempotency key makes double-clicks safe.
 *
 * TODO (Days 3–5): Replace stub with real DSQL guarded UPDATE + ledger settlement.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { ClaimRequest, ClaimResponse } from "@/lib/types";
import { actsToPauseWindows, computePrice } from "@/lib/price";

export async function POST(
  req: NextRequest
): Promise<NextResponse<ClaimResponse | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auctionId, idempotencyKey } = body as ClaimRequest;

  if (!auctionId || !idempotencyKey) {
    return NextResponse.json(
      { error: "auctionId and idempotencyKey are required" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const startsAtMs = now - 4 * 60 * 1000;
  const decayParams = {
    startsAtMs,
    durationS: 15 * 60,
    startPrice: 1200,
    reservePrice: 200,
    curve: "linear" as const,
    pauseWindows: actsToPauseWindows([3 * 60, 7 * 60, 11 * 60]),
    burnLevel: 1 as const,
    burnEffectiveAtMs: now - 60_000,
  };

  // Server-authoritative price computed in-transaction.
  const { price: serverPrice } = computePrice(decayParams, now);

  // Mock: always return a win for demo purposes.
  const mockResult = "won" as const;

  const mockWinner = {
    displayName: "demo_bidder",
    regionCode: "AU-W",
    winningPrice: serverPrice,
    wonVia: "claim" as const,
    claimedAtMs: now,
  };

  const mockState = {
    auctionId,
    status: "claimed" as const,
    decayParams,
    armed: { tier3: 31, tier2: 14, tier1: 9 },
    spectatorsEst: 2341,
    lotteryCount: 18,
    reactions5s: { "🔥": 42, "👀": 17, "💀": 5, "🤑": 11 },
    regions5s: { "AU-W": 12, "US-NY": 9 },
    serverTimeMs: now,
    winner: mockWinner,
    computedAt: new Date(now).toISOString(),
  };

  const response: ClaimResponse = {
    claimId: randomUUID(),
    result: mockResult,
    serverPrice,
    winner: mockWinner,
    state: mockState,
  };

  return NextResponse.json(response, { status: 200 });
}
