/**
 * POST /api/reactions
 *
 * Records an emoji reaction from any viewer — insert-only, no deduplication.
 * Emoji allow-list enforced server-side.
 * Returns the fresh 5-second reaction window (read from auction_rollups).
 *
 * Auth: X-User-Id header (replaced by real session in auth sprint).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import type { ReactionEmoji, ReactionRequest, ReactionResponse } from "@/lib/types";

const ALLOWED_EMOJI = new Set<ReactionEmoji>(["🔥", "👀", "💀", "🤑"]);

export async function POST(
  req: NextRequest
): Promise<NextResponse<ReactionResponse | { error: string }>> {
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

  const { auctionId, emoji, phraseKey } = body as ReactionRequest;

  if (!auctionId) {
    return NextResponse.json({ error: "auctionId is required" }, { status: 400 });
  }
  if (!ALLOWED_EMOJI.has(emoji)) {
    return NextResponse.json(
      { error: `emoji must be one of ${[...ALLOWED_EMOJI].join(" ")}` },
      { status: 422 }
    );
  }

  const regionCode = req.headers.get("x-region-code") ?? null;

  // Insert reaction (fire-and-forget; no unique constraint — bursty by design).
  await query(
    `INSERT INTO reactions (id, auction_id, user_id, emoji, phrase_key, region_code)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), auctionId, userId, emoji, phraseKey ?? null, regionCode]
  );

  // Return current 5-second aggregate from the rollup (best-effort freshness).
  const rollupResult = await query<{ reactions_5s: string }>(
    `SELECT reactions_5s FROM auction_rollups WHERE auction_id = $1`,
    [auctionId]
  );

  let reactions5s: ReactionResponse["reactions5s"] = {};
  try {
    reactions5s = JSON.parse(rollupResult.rows[0]?.reactions_5s ?? "{}");
  } catch {
    // leave as empty
  }

  return NextResponse.json(
    { reactionId: randomUUID(), reactions5s },
    { status: 201 }
  );
}
