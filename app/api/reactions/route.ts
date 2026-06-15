/**
 * POST /api/reactions
 *
 * Records an emoji reaction (or canned phrase chip) from any viewer.
 * Insert-only, no deduplication — bursty by design.
 * Emoji allow-list is enforced server-side.
 *
 * TODO (Days 6–8): Replace stub with real DSQL insert + rollup piggyback.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { ReactionEmoji, ReactionRequest, ReactionResponse } from "@/lib/types";

const ALLOWED_EMOJI: ReactionEmoji[] = ["🔥", "👀", "💀", "🤑"];

export async function POST(
  req: NextRequest
): Promise<NextResponse<ReactionResponse | { error: string }>> {
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

  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json(
      { error: `emoji must be one of ${ALLOWED_EMOJI.join(" ")}` },
      { status: 422 }
    );
  }

  // Suppress unused variable warning in stub
  void phraseKey;

  // Mock: return updated 5-second reaction aggregates with this emoji bumped
  const mockReactions5s: Partial<Record<ReactionEmoji, number>> = {
    "🔥": emoji === "🔥" ? 43 : 42,
    "👀": emoji === "👀" ? 18 : 17,
    "💀": emoji === "💀" ? 6 : 5,
    "🤑": emoji === "🤑" ? 12 : 11,
  };

  const response: ReactionResponse = {
    reactionId: randomUUID(),
    reactions5s: mockReactions5s,
  };

  return NextResponse.json(response, { status: 201 });
}
