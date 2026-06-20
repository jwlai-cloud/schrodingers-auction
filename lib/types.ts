/**
 * lib/types.ts
 *
 * Canonical TypeScript types for all API request/response shapes.
 * Used by both route handlers (server) and client fetch wrappers.
 */

import type { AuctionDecayParams } from "./price";

// ── Shared primitives ─────────────────────────────────────────────────────────

export type AuctionStatus =
  | "listed"
  | "live"
  | "claimed"
  | "lottery"
  | "settled"
  | "expired";

export type WonVia = "claim" | "lottery";

export type ClaimResult = "won" | "lost";

export type ReactionEmoji = "🔥" | "👀" | "💀" | "🤑";

/** Demand-burn step 0–3. */
export type BurnLevel = 0 | 1 | 2 | 3;

/** Bidder tier 0–3, determined by vote count. */
export type BidderTier = 0 | 1 | 2 | 3;

// ── GET /api/auctions/[id]/state ─────────────────────────────────────────────

/**
 * Armed-bidder counts broken out by tier (from auction_rollups).
 */
export interface ArmedCounts {
  tier3: number; // fully armed — instant claim
  tier2: number; // 2-vote tier — 2 s delay
  tier1: number; // 1-vote tier — 5 s delay
}

/**
 * Emoji reaction counts aggregated over the last 5 seconds.
 * Keys are the four allowed emoji characters.
 */
export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

/**
 * Region heatmap pulse data from the last 5 seconds.
 * Keys are ISO-3166 region codes (e.g. "AU-W", "US-NY").
 */
export type RegionPulses = Record<string, number>;

/**
 * Winner snapshot — present only when status is 'claimed' | 'settled'.
 */
export interface WinnerSnapshot {
  displayName: string;
  regionCode: string | null;
  winningPrice: number;
  wonVia: WonVia;
  claimedAtMs: number;
}

/**
 * Response body for GET /api/auctions/[id]/state
 *
 * The canonical "room state" document returned by the edge-cached state
 * endpoint. Clients poll this every second and compute price locally using
 * the embedded decayParams.
 */
export interface AuctionStateResponse {
  /** Auction UUID. */
  auctionId: string;
  status: AuctionStatus;

  /** Full published decay params — clients run computePrice() against these. */
  decayParams: AuctionDecayParams;

  /** Rollup counts (from auction_rollups, refreshed every 1–5 s by cron). */
  armed: ArmedCounts;
  spectatorsEst: number;
  lotteryCount: number;

  /** Reaction and region pulse aggregates (last 5 seconds). */
  reactions5s: ReactionCounts;
  regions5s: RegionPulses;

  /** Server wall-clock ms — clients derive their clock offset from this. */
  serverTimeMs: number;

  /** Present only when auction is claimed/settled. */
  winner?: WinnerSnapshot;

  /** ISO timestamp when this rollup snapshot was computed. */
  computedAt: string;
}

// ── POST /api/votes ───────────────────────────────────────────────────────────

export interface VoteRequest {
  /** Auction UUID. */
  auctionId: string;
  /** Act number being voted on (1, 2, or 3). */
  actNo: 1 | 2 | 3;
  /** Whether this vote was granted via the catch-up replay. */
  viaCatchup?: boolean;
}

export interface VoteResponse {
  /** The newly created vote's UUID. */
  voteId: string;
  /** Total votes this user now holds for this auction. */
  totalVotes: number;
  /** Resulting tier after this vote. */
  tier: BidderTier;
  /** Whether the auction is now eligible for lottery opt-in (tier 3). */
  lotteryEligible: boolean;
  /** Fresh auction state snapshot (read-your-writes). */
  state: AuctionStateResponse;
}

// ── POST /api/reactions ───────────────────────────────────────────────────────

export interface ReactionRequest {
  auctionId: string;
  emoji: ReactionEmoji;
  /** Optional canned phrase chip identifier (localized client-side). */
  phraseKey?: string;
}

export interface ReactionResponse {
  reactionId: string;
  /** Updated 5-second reaction aggregates (read-your-writes). */
  reactions5s: ReactionCounts;
}

// ── POST /api/claims ──────────────────────────────────────────────────────────

export interface ClaimRequest {
  auctionId: string;
  /**
   * Client-supplied idempotency key (UUID). The server uses this to make
   * double-clicks safe — a second request with the same key returns the
   * original result without re-running the transaction.
   */
  idempotencyKey: string;
}

/** Loser receipt — present only when result === 'lost'. */
export interface LoserReceipt {
  /** Milliseconds by which the winner beat this bidder at commit time. */
  beatenByMs: number;
  /** Armed-bidder count at the moment of loss (for the drama copy). */
  armedCountAtLoss: number;
}

export interface ClaimResponse {
  claimId: string;
  result: ClaimResult;

  /** Price at which the claim was evaluated (server-authoritative). */
  serverPrice: number;

  /** Winner snapshot — always present (either this user or the winner). */
  winner: WinnerSnapshot;

  /** Loser receipt — present only when result === 'lost'. */
  loserReceipt?: LoserReceipt;

  /** Fresh auction state (read-your-writes — immediately reflects won status). */
  state: AuctionStateResponse;
}

// ── GET /api/auctions (lobby list) ───────────────────────────────────────────

export interface AuctionSummary {
  id: string;
  title: string;
  imageUrl: string | null;
  status: AuctionStatus;
  startPrice: number;
  reservePrice: number;
  /** Simplified decay params sufficient for the lobby price ticker. */
  decayParams: AuctionDecayParams;
  armed: ArmedCounts;
  spectatorsEst: number;
  serverTimeMs: number;
}

export interface AuctionListResponse {
  auctions: AuctionSummary[];
  serverTimeMs: number;
}
