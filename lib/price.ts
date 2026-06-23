/**
 * lib/price.ts
 *
 * Deterministic price function for Schrödinger's Auction.
 *
 * The price is a pure function of published auction parameters and the
 * current server-clock time — it NEVER touches the database. Both the
 * client (for rendering) and the server (for claim validation) call the
 * same function against the same parameters, so every viewer on Earth
 * computes the identical price at any given moment.
 *
 * Spec from ARCHITECTURE.md:
 *   price(t) = f(start_price, decay_rate, burn_level, pause_windows, t)
 *
 * Key behaviours
 * ──────────────
 * 1. **Linear decay** (only curve supported in v1; extendable via `curve`)
 *    The price drops linearly from `startPrice` to 0 over `durationS`
 *    seconds of *active* (non-paused) time.
 *
 * 2. **Pause windows** (act spotlight moments)
 *    Each act boundary reveals a seller highlight for 10 s while decay
 *    is frozen. Pause windows are [{from, until}] intervals in *elapsed
 *    active seconds* (i.e. they consume no decay budget).
 *
 * 3. **Demand brake** (burnLevel reused as brake level)
 *    As more bidders arm (milestones 5/15/30), the decay rate is SLOWED by a
 *    multiplier < 1 from `burnEffectiveAt` onward, so hot items hold a high
 *    price instead of fire-selling.
 *    Level 0 → ×1.0, level 1 → ×0.75, level 2 → ×0.55, level 3 → ×0.4
 *
 * 4. **Reserve (floor) price**
 *    The price never drops below `reservePrice` (triggers lottery window).
 *
 * All inputs use coins (integer) and seconds (number).
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A window during which price decay is frozen (act spotlight). */
export interface PauseWindow {
  /** Elapsed active seconds at which the pause begins. */
  from: number;
  /** Elapsed active seconds at which the pause ends. */
  until: number;
}

/** All published parameters for a single auction's price curve. */
export interface AuctionDecayParams {
  /** Auction starts_at as a Unix timestamp in milliseconds. */
  startsAtMs: number;
  /** Total duration of *active* (non-paused) decay in seconds. */
  durationS: number;
  /** Starting price in coins. */
  startPrice: number;
  /** Reserve / floor price in coins — price never drops below this. */
  reservePrice: number;
  /** Curve shape: only 'linear' is implemented in v1. */
  curve: "linear";
  /** Pause windows in elapsed-active-seconds coordinates. */
  pauseWindows: PauseWindow[];
  /** Current demand-burn step (0–3). */
  burnLevel: 0 | 1 | 2 | 3;
  /** Wall-clock ms at which the current burnLevel took effect (null = since start). */
  burnEffectiveAtMs: number | null;
}

/** The full result of a price computation. */
export interface PriceResult {
  /** Current price in coins (floored to integer, clamped ≥ reservePrice). */
  price: number;
  /** Elapsed active seconds at the query time. */
  elapsedActiveS: number;
  /** Whether the auction is currently in a pause window. */
  isPaused: boolean;
  /** Seconds remaining in the current pause window (0 if not paused). */
  pauseSecondsRemaining: number;
  /** Whether the price has reached (or gone below) the reserve floor. */
  atFloor: boolean;
  /** Whether the auction's full duration has elapsed. */
  expired: boolean;
  /** Fractional progress through the active duration [0, 1]. */
  progress: number;
}

// ── Burn multipliers ─────────────────────────────────────────────────────────

// Demand brake: as more bidders arm, the price decays SLOWER (multiplier < 1),
// so hot items hold a high price instead of fire-selling. burnLevel is reused as
// the brake level (0 = no brake). Triggered by armed milestones — see
// armedToBrakeLevel. burnEffectiveAtMs marks when the current brake took effect.
const BURN_MULTIPLIER: Record<0 | 1 | 2 | 3, number> = {
  0: 1.0,  // no demand yet — normal decay
  1: 0.75, // warming — 25% slower
  2: 0.55, // hot — 45% slower
  3: 0.4,  // on fire — 60% slower, price barely moves
};

/** Map a total armed-bidder count to a demand-brake level (0–3). Ratchets up only. */
export function armedToBrakeLevel(totalArmed: number): 0 | 1 | 2 | 3 {
  if (totalArmed >= 30) return 3;
  if (totalArmed >= 15) return 2;
  if (totalArmed >= 5) return 1;
  return 0;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Compute the current price for an auction.
 *
 * @param params  Published auction decay parameters.
 * @param nowMs   Current wall-clock time in milliseconds (use Date.now() on
 *                the client after applying the server-clock offset).
 * @returns       A fully-typed PriceResult.
 */
export function computePrice(
  params: AuctionDecayParams,
  nowMs: number
): PriceResult {
  const {
    startsAtMs,
    durationS,
    startPrice,
    reservePrice,
    pauseWindows,
    burnLevel,
    burnEffectiveAtMs,
  } = params;

  // ── 1. Total wall-clock seconds since auction started ─────────────────────
  const wallElapsedS = Math.max(0, (nowMs - startsAtMs) / 1000);

  // ── 2. Walk the timeline to compute *active* elapsed seconds ──────────────
  //    Active time excludes pause windows. We iterate through pauses in order
  //    and subtract any overlap with the wall-elapsed span.
  let activeElapsedS = wallElapsedS;
  let isPaused = false;
  let pauseSecondsRemaining = 0;

  // Sort windows defensively (they should already be ordered).
  const sortedPauses = [...pauseWindows].sort((a, b) => a.from - b.from);

  // We need to track a "shifted" cursor: pause windows are defined in
  // active-second coordinates, but as we subtract past pauses, the wall
  // time shifts forward relative to the active cursor.
  //
  // Algorithm: iterate pauses in order; for each pause that starts before
  // our current active cursor, subtract the pause duration from wallElapsedS.
  let wallCursor = wallElapsedS;
  let activeCursor = 0;
  let pauseDebt = 0; // total pause seconds consumed so far

  for (const pw of sortedPauses) {
    const pauseLen = pw.until - pw.from;
    if (pauseLen <= 0) continue;

    // Wall-clock start of this pause (relative to auction start):
    //   wall_pause_start = pw.from + pauseDebt (prior pauses shift everything right)
    const wallPauseStart = pw.from + pauseDebt;
    const wallPauseEnd = wallPauseStart + pauseLen;

    if (wallCursor <= wallPauseStart) {
      // We haven't reached this pause window yet — done.
      break;
    }

    if (wallCursor < wallPauseEnd) {
      // We are currently inside this pause window.
      isPaused = true;
      pauseSecondsRemaining = wallPauseEnd - wallCursor;
      // Active elapsed = pw.from (we're frozen at the pause start).
      activeCursor = pw.from;
      activeElapsedS = pw.from;
      break;
    }

    // We're past this pause — subtract its length from our active budget.
    pauseDebt += pauseLen;
    activeCursor = pw.until;
  }

  if (!isPaused) {
    // Active elapsed = wall elapsed minus all past pause seconds.
    activeElapsedS = Math.max(0, wallElapsedS - pauseDebt);
  }

  const expired = activeElapsedS >= durationS;
  const clampedActive = Math.min(activeElapsedS, durationS);
  const progress = clampedActive / durationS;

  // ── 3. Apply burn-level acceleration ─────────────────────────────────────
  //    Burn changes the *effective* decay rate from burnEffectiveAtMs onward.
  //    We recompute active time split into pre-burn and post-burn segments and
  //    weight the post-burn segment by the multiplier.
  let effectiveActive = clampedActive;

  if (burnLevel > 0 && burnEffectiveAtMs !== null) {
    const burnWallOffsetS = Math.max(0, (burnEffectiveAtMs - startsAtMs) / 1000);

    // Compute active elapsed at the moment burn kicked in (ignoring pauses
    // that are entirely in the future of burnWallOffsetS).
    let preBurnPauseDebt = 0;
    for (const pw of sortedPauses) {
      const pauseLen = pw.until - pw.from;
      if (pauseLen <= 0) continue;
      const wallPauseStart = pw.from + preBurnPauseDebt;
      const wallPauseEnd = wallPauseStart + pauseLen;
      if (burnWallOffsetS <= wallPauseStart) break;
      const overlap = Math.min(burnWallOffsetS, wallPauseEnd) - wallPauseStart;
      preBurnPauseDebt += Math.max(0, overlap);
    }
    const preBurnActiveS = Math.min(
      clampedActive,
      Math.max(0, burnWallOffsetS - preBurnPauseDebt)
    );
    const postBurnActiveS = Math.max(0, clampedActive - preBurnActiveS);

    // Effective active = pre-burn unchanged + post-burn accelerated
    effectiveActive = preBurnActiveS + postBurnActiveS * BURN_MULTIPLIER[burnLevel];
  }

  // ── 4. Compute price ──────────────────────────────────────────────────────
  // Linear: price drops from startPrice to 0 over durationS active seconds.
  // We use effectiveActive (burn-adjusted) for the decay, then clamp at floor.
  const decayFraction = Math.min(1, effectiveActive / durationS);
  const rawPrice = startPrice * (1 - decayFraction);
  const price = Math.max(reservePrice, Math.floor(rawPrice));

  return {
    price,
    elapsedActiveS: activeElapsedS,
    isPaused,
    pauseSecondsRemaining,
    atFloor: price <= reservePrice,
    expired,
    progress,
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Format a coin amount as a display string.
 * Coins are integer units; no decimal places needed.
 */
export function formatCoins(coins: number): string {
  return coins.toLocaleString("en-US");
}

/**
 * Return the tier (0–3) a bidder holds given their vote count.
 */
export function votesToTier(voteCount: number): 0 | 1 | 2 | 3 {
  if (voteCount >= 3) return 3;
  if (voteCount === 2) return 2;
  if (voteCount === 1) return 1;
  return 0;
}

/**
 * Return the server-side claim delay in seconds for a given tier.
 */
export function tierDelaySeconds(tier: 0 | 1 | 2 | 3): number {
  switch (tier) {
    case 3: return 0;
    case 2: return 2;
    case 1: return 5;
    case 0: return Infinity; // cannot claim
  }
}

/**
 * Derive the three default pause windows from act reveal offsets (in seconds).
 * Each act spotlight freezes the price for 10 seconds.
 */
export function actsToPauseWindows(revealOffsets: number[]): PauseWindow[] {
  const SPOTLIGHT_DURATION_S = 10;
  return revealOffsets.map((offset) => ({
    from: offset,
    until: offset + SPOTLIGHT_DURATION_S,
  }));
}
