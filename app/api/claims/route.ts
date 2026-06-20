/**
 * POST /api/claims
 *
 * The centerpiece transaction — atomically claims an auction for the caller.
 *
 * Flow:
 *   1. Validate request + auth.
 *   2. Idempotency: if claims row already exists for this idempotencyKey, return it.
 *   3. Read auction snapshot + caller wallet balance + vote count in one txn.
 *   4. Server-authoritative price via computePrice(decayParams, NOW()).
 *   5. Guard checks: status=live, winner=NULL, price>reserve, tier>0,
 *      tier-delay satisfied, balance >= price.
 *   6. Guarded UPDATE:
 *        UPDATE auctions SET winner_user_id=$u, winning_price=$p, ...
 *        WHERE id=$a AND winner_user_id IS NULL AND status='live'
 *   7. If 1 row affected → WON: write ledger double-entry, update wallet, insert claims audit.
 *      If 0 rows affected → LOST: insert claims audit (result='lost'), return loser receipt.
 *   8. DSQL OCC serialization conflict at commit → treated as a loss.
 *
 * Claims are NEVER retried — the OCC abort IS the loss signal.
 * Idempotency key makes double-clicks safe.
 */

import { NextResponse } from "next/server"; // NextRequest not needed — using getSession() for auth
import { randomUUID } from "crypto";
import { withConnection } from "@/lib/db";
import { computePrice, votesToTier, tierDelaySeconds } from "@/lib/price";
import { getSession } from "@/lib/auth";
import type { ClaimRequest, ClaimResponse, AuctionStateResponse } from "@/lib/types";
import type { AuctionDecayParams, PauseWindow } from "@/lib/price";

// Platform pseudo-user wallet that receives listing fees + commissions.
const PLATFORM_USER_ID = "00000000-0000-0000-0000-000000000000";

interface AuctionRow {
  id: string;
  status: string;
  seller_user_id: string;
  start_price: string;
  reserve_price: string;
  listing_fee: string;
  base_fee_bps: number;
  spread_fee_bps: number;
  starts_at: Date;
  duration_s: number;
  curve: string;
  pause_windows: string;
  burn_level: number;
  burn_effective: Date | null;
  winner_user_id: string | null;
}

interface ExistingClaimRow {
  id: string;
  result: string;
  server_price: string;
  beaten_by_ms: number | null;
  armed_at_loss: number | null;
  created_at: Date;
}

export async function POST(
  req: Request
): Promise<NextResponse<ClaimResponse | { error: string }>> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const userId = session.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auctionId, idempotencyKey: rawKey } = body as ClaimRequest;

  if (!auctionId) {
    return NextResponse.json({ error: "auctionId is required" }, { status: 400 });
  }

  // claims.id is a UUID primary key — validate or generate a fresh one.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const idempotencyKey = rawKey && UUID_RE.test(rawKey) ? rawKey : randomUUID();

  const now = Date.now();

  try {
    const result = await withConnection(async (client) => {
      await client.query("BEGIN");

      // ── Idempotency check ───────────────────────────────────────────────
      const idempotencyCheck = await client.query<ExistingClaimRow>(
        `SELECT id, result, server_price, beaten_by_ms, armed_at_loss, created_at
         FROM claims WHERE id = $1`,
        [idempotencyKey]
      );
      if (idempotencyCheck.rows.length > 0) {
        await client.query("COMMIT");
        const prev = idempotencyCheck.rows[0];
        // Reconstruct a minimal response from the audit row.
        return {
          claimId: prev.id,
          result: prev.result as "won" | "lost",
          serverPrice: Number(prev.server_price),
          winner: { displayName: "—", regionCode: null, winningPrice: Number(prev.server_price), wonVia: "claim" as const, claimedAtMs: new Date(prev.created_at).getTime() },
          loserReceipt: prev.result === "lost" && prev.beaten_by_ms != null ? {
            beatenByMs: prev.beaten_by_ms,
            armedCountAtLoss: prev.armed_at_loss ?? 0,
          } : undefined,
          state: null as unknown as AuctionStateResponse,
        };
      }

      // ── Read auction + caller wallet + vote count ───────────────────────
      const auctionResult = await client.query<AuctionRow>(
        `SELECT id, status, seller_user_id,
                start_price, reserve_price, listing_fee,
                base_fee_bps, spread_fee_bps,
                starts_at, duration_s, curve, pause_windows,
                burn_level, burn_effective, winner_user_id
         FROM auctions WHERE id = $1`,
        [auctionId]
      );

      if (auctionResult.rows.length === 0) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Auction not found"), { code: 404 });
      }

      const a = auctionResult.rows[0];

      if (a.status !== "live" && a.winner_user_id === null) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Auction is not live"), { code: 409 });
      }

      // Already claimed — look up real winner and compute real beatenByMs
      if (a.winner_user_id !== null) {
        await client.query("COMMIT");
        const winnerRow = await client.query<{ display_name: string; region_code: string | null }>(
          `SELECT display_name, region_code FROM users WHERE id = $1`,
          [a.winner_user_id]
        );
        const wu = winnerRow.rows[0];
        // claimed_at is stored in the row; delta = now - claimed_at
        const claimedAtMs = a.starts_at
          ? now - new Date(a.starts_at).getTime() // fallback
          : now;
        // Fetch claimed_at from the auction
        const caRow = await client.query<{ claimed_at: Date; winning_price: string }>(
          `SELECT claimed_at, winning_price FROM auctions WHERE id = $1`, [auctionId]
        );
        const realClaimedAtMs = caRow.rows[0]?.claimed_at
          ? new Date(caRow.rows[0].claimed_at).getTime()
          : claimedAtMs;
        const realBeatenByMs = Math.max(1, now - realClaimedAtMs);
        const winningPrice = Number(caRow.rows[0]?.winning_price ?? a.start_price);

        // Write a loss audit row so the caller has a receipt
        const UUID_RE2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const lossKey = UUID_RE2.test(idempotencyKey) ? idempotencyKey : randomUUID();
        const existCheck = await client.query(
          `SELECT id FROM claims WHERE id = $1`, [lossKey]
        );
        if (existCheck.rows.length === 0) {
          const vr = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM votes WHERE auction_id = $1 AND user_id = $2`,
            [auctionId, userId]
          );
          const lossVotes = parseInt(vr.rows[0].count, 10);
          const lossTier = votesToTier(lossVotes);
          await client.query(
            `INSERT INTO claims (id, auction_id, user_id, server_price, tier, result, beaten_by_ms, armed_at_loss)
             VALUES ($1, $2, $3, $4, $5, 'lost', $6, 0)`,
            [lossKey, auctionId, userId, winningPrice, lossTier, realBeatenByMs]
          );
          await client.query("COMMIT");
        }

        return {
          _alreadyClaimed: true,
          winnerName: wu?.display_name ?? "another bidder",
          regionCode: wu?.region_code ?? null,
          winningPrice,
          beatenByMs: realBeatenByMs,
          auctionId,
          serverPrice: winningPrice,
        };
      }

      // ── Server-authoritative price ───────────────────────────────────────
      let pauseWindows: PauseWindow[] = [];
      try { pauseWindows = JSON.parse(a.pause_windows ?? "[]"); } catch { /**/ }

      const decayParams: AuctionDecayParams = {
        startsAtMs: new Date(a.starts_at).getTime(),
        durationS: a.duration_s,
        startPrice: Number(a.start_price),
        reservePrice: Number(a.reserve_price),
        curve: "linear",
        pauseWindows,
        burnLevel: (a.burn_level ?? 0) as 0 | 1 | 2 | 3,
        burnEffectiveAtMs: a.burn_effective ? new Date(a.burn_effective).getTime() : null,
      };

      const priceResult = computePrice(decayParams, now);
      const serverPrice = priceResult.price;

      if (priceResult.atFloor) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Price is at floor — lottery window only"), { code: 409 });
      }

      // ── Tier + delay check ────────────────────────────────────────────────
      const voteCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM votes WHERE auction_id = $1 AND user_id = $2`,
        [auctionId, userId]
      );
      const voteCount = parseInt(voteCountResult.rows[0].count, 10);
      const tier = votesToTier(voteCount);

      if (tier === 0) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("No votes — cannot claim"), { code: 403 });
      }

      const delayS = tierDelaySeconds(tier);
      const auctionElapsedS = (now - new Date(a.starts_at).getTime()) / 1000;
      if (auctionElapsedS < delayS) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error(`Tier delay: wait ${(delayS - auctionElapsedS).toFixed(1)}s`), { code: 425 });
      }

      // ── Wallet balance check ─���────────────────────────────────────────────
      const walletResult = await client.query<{ balance: string }>(
        `SELECT balance FROM wallets WHERE user_id = $1`,
        [userId]
      );
      if (walletResult.rows.length === 0 || BigInt(walletResult.rows[0].balance) < BigInt(serverPrice)) {
        await client.query("ROLLBACK");
        throw Object.assign(new Error("Insufficient balance"), { code: 402 });
      }

      // ── Rollup for armed count (best-effort, for loser receipt) ──────────
      const rollupResult = await client.query<{ armed_3: number; armed_2: number; armed_1: number }>(
        `SELECT armed_3, armed_2, armed_1 FROM auction_rollups WHERE auction_id = $1`,
        [auctionId]
      );
      const totalArmed = rollupResult.rows.length > 0
        ? (rollupResult.rows[0].armed_3 + rollupResult.rows[0].armed_2 + rollupResult.rows[0].armed_1)
        : 0;

      // ── Guarded UPDATE — the actual race ─────────────────────────────────
      const claimedAt = new Date(now).toISOString();
      const updateResult = await client.query(
        `UPDATE auctions
         SET winner_user_id = $1,
             winning_price  = $2,
             claimed_at     = $3,
             won_via        = 'claim',
             status         = 'claimed'
         WHERE id = $4
           AND winner_user_id IS NULL
           AND status = 'live'`,
        [userId, serverPrice, claimedAt, auctionId]
      );

      const won = updateResult.rowCount === 1;

      // ── Compute real beatenByMs on loss ──────────────────────────────────
      let beatenByMs: number | null = null;
      let realWinnerName = "another bidder";
      let realWinnerRegion: string | null = null;
      if (!won) {
        // Fetch the winner's claimed_at and display_name atomically
        const lossInfo = await client.query<{
          claimed_at: Date; winner_user_id: string; winning_price: string;
        }>(
          `SELECT claimed_at, winner_user_id, winning_price FROM auctions WHERE id = $1`,
          [auctionId]
        );
        if (lossInfo.rows[0]?.claimed_at) {
          beatenByMs = Math.max(1, now - new Date(lossInfo.rows[0].claimed_at).getTime());
          // Fetch winner display name
          const wNameRow = await client.query<{ display_name: string; region_code: string | null }>(
            `SELECT display_name, region_code FROM users WHERE id = $1`,
            [lossInfo.rows[0].winner_user_id]
          );
          realWinnerName = wNameRow.rows[0]?.display_name ?? "another bidder";
          realWinnerRegion = wNameRow.rows[0]?.region_code ?? null;
        }
      }

      // ── Write audit row ───────────────────────────────────────────────────
      await client.query(
        `INSERT INTO claims (id, auction_id, user_id, server_price, tier, result, beaten_by_ms, armed_at_loss)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          idempotencyKey,
          auctionId,
          userId,
          serverPrice,
          tier,
          won ? "won" : "lost",
          won ? null : beatenByMs,
          won ? null : totalArmed,
        ]
      );

      if (won) {
        // ── Double-entry ledger settlement ────────────────────────────────
        const entryGroup = randomUUID();
        const reservePrice = Number(a.reserve_price);
        const baseFee = Math.round((serverPrice * a.base_fee_bps) / 10000);
        const spread = Math.max(0, serverPrice - reservePrice);
        const spreadFee = Math.round((spread * a.spread_fee_bps) / 10000);
        const totalFee = baseFee + spreadFee;
        const sellerProceeds = serverPrice - totalFee;

        // Debit buyer
        await client.query(
          `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
          [serverPrice, userId]
        );

        // Credit seller
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
          [sellerProceeds, a.seller_user_id]
        );

        // Credit platform (fees) — UPDATE only; platform wallet is pre-created by seed
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
          [totalFee, PLATFORM_USER_ID]
        );

        // Ledger rows (buyer debit, seller credit, platform fee credit)
        const ledgerRows = [
          [randomUUID(), entryGroup, userId, auctionId, -serverPrice, "item_purchase"],
          [randomUUID(), entryGroup, a.seller_user_id, auctionId, sellerProceeds, "item_sale"],
          [randomUUID(), entryGroup, PLATFORM_USER_ID, auctionId, totalFee, "commission"],
        ];

        for (const row of ledgerRows) {
          await client.query(
            `INSERT INTO ledger_entries (id, entry_group, wallet_user_id, auction_id, amount, kind)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            row
          );
        }
      }

      await client.query("COMMIT");

      // ── Fetch the WINNER's display name (caller on win, real winner on loss) ──
      const winnerUserId = won ? userId : null; // on loss, name already in realWinnerName
      let callerDisplayName = "unknown";
      let callerRegion: string | null = null;
      if (won) {
        const wu = await client.query<{ display_name: string; region_code: string | null }>(
          `SELECT display_name, region_code FROM users WHERE id = $1`, [userId]
        );
        callerDisplayName = wu.rows[0]?.display_name ?? "unknown";
        callerRegion = wu.rows[0]?.region_code ?? null;
      }

      return {
        won,
        serverPrice,
        tier,
        totalArmed,
        beatenByMs,
        // On win: show the caller's name. On loss: show the real winner's name.
        displayName: won ? callerDisplayName : realWinnerName,
        regionCode: won ? callerRegion : realWinnerRegion,
        claimedAtMs: now,
        decayParams,
        auctionId,
        winnerUserId,
      };
    });

    // ── Build ClaimResponse ─────────────────────────────────────────────────
    type ResultShape = {
      won: boolean; serverPrice: number; tier: number; totalArmed: number;
      beatenByMs: number | null; displayName: string; regionCode: string | null;
      claimedAtMs: number; decayParams: AuctionDecayParams; auctionId: string;
      _alreadyClaimed?: boolean; winnerName?: string; winningPrice?: number;
      beatenByMs2?: number; state?: unknown;
    };

    const r = result as ResultShape;

    // Handle idempotency short-circuit (state is null sentinel)
    if ("state" in (r as object) && (r as unknown as { state: unknown }).state === null) {
      return NextResponse.json(result as unknown as ClaimResponse, { status: 200 });
    }

    // Handle already-claimed path (bot won before human arrived)
    if (r._alreadyClaimed) {
      const lossResponse: ClaimResponse = {
        claimId: idempotencyKey,
        result: "lost",
        serverPrice: r.serverPrice,
        winner: {
          displayName: (r as unknown as { winnerName: string }).winnerName ?? "another bidder",
          regionCode: r.regionCode,
          winningPrice: (r as unknown as { winningPrice: number }).winningPrice ?? r.serverPrice,
          wonVia: "claim",
          claimedAtMs: now,
        },
        loserReceipt: {
          beatenByMs: (r as unknown as { beatenByMs: number }).beatenByMs ?? 0,
          armedCountAtLoss: 0,
        },
        state: null as unknown as AuctionStateResponse,
      };
      return NextResponse.json(lossResponse, { status: 200 });
    }

    const { won, serverPrice, tier, totalArmed, beatenByMs, displayName, regionCode, claimedAtMs, decayParams, auctionId: aId } = r;

    const winner: ClaimResponse["winner"] = {
      displayName,
      regionCode,
      winningPrice: serverPrice,
      wonVia: "claim",
      claimedAtMs,
    };

    const state: AuctionStateResponse = {
      auctionId: aId,
      status: won ? "claimed" : "live",
      decayParams,
      armed: { tier3: 0, tier2: 0, tier1: 0 },
      spectatorsEst: 0,
      lotteryCount: 0,
      reactions5s: {},
      regions5s: {},
      serverTimeMs: now,
      winner: won ? winner : undefined,
      computedAt: new Date(now).toISOString(),
    };

    const response: ClaimResponse = {
      claimId: idempotencyKey,
      result: won ? "won" : "lost",
      serverPrice,
      winner,
      loserReceipt: !won ? { beatenByMs: beatenByMs ?? 0, armedCountAtLoss: totalArmed } : undefined,
      state,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (err: unknown) {
    const e = err as Error & { code?: number };

    // Known guard rejections
    if (e.code === 404) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e.code === 402) return NextResponse.json({ error: e.message }, { status: 402 });
    if (e.code === 403) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e.code === 409) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e.code === 425) return NextResponse.json({ error: e.message }, { status: 425 });

    // DSQL OCC serialization conflict → loss (never retry)
    const msg = e.message ?? "";
    if (msg.includes("OC") || msg.includes("conflict") || msg.includes("serializ")) {
      return NextResponse.json({ error: "Claim lost to concurrent transaction" }, { status: 409 });
    }

    console.error("[claims]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
