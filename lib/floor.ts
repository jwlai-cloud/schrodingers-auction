/**
 * lib/floor.ts — resolve an auction once its price reaches the floor (reserve).
 *
 * DSQL has no cron/triggers, so resolution is lazy: callers (the state poll)
 * invoke resolveFloorIfNeeded(), which is a no-op unless the auction is live,
 * unclaimed, and at the floor. Then it acts on the seller's choice:
 *   - 'withdraw' → status='unsold' (taken down; seller can relist)
 *   - 'lottery'  → award to a random fully-armed entrant at reserve, settle ledger
 *
 * All writes are guarded (winner IS NULL AND status='live'), so concurrent
 * callers resolve to exactly one outcome — the same OCC guarantee as a claim.
 */
import { randomUUID } from "crypto";
import { withConnection, query } from "@/lib/db";
import { computePrice, type AuctionDecayParams, type PauseWindow } from "@/lib/price";

const PLATFORM_USER_ID = "00000000-0000-0000-0000-000000000000";

interface FloorRow extends Record<string, unknown> {
  id: string;
  status: string;
  winner_user_id: string | null;
  seller_user_id: string;
  start_price: string;
  reserve_price: string;
  base_fee_bps: number;
  spread_fee_bps: number;
  starts_at: Date;
  duration_s: number;
  pause_windows: string | null;
  burn_level: number;
  burn_effective: Date | null;
  floor_action: string | null;
}

export type FloorOutcome = "unsold" | "lottery" | null;

function toDecay(a: FloorRow): AuctionDecayParams {
  let pauseWindows: PauseWindow[] = [];
  try { pauseWindows = JSON.parse(a.pause_windows ?? "[]"); } catch { /**/ }
  return {
    startsAtMs: new Date(a.starts_at).getTime(),
    durationS: a.duration_s,
    startPrice: Number(a.start_price),
    reservePrice: Number(a.reserve_price),
    curve: "linear",
    pauseWindows,
    burnLevel: (a.burn_level ?? 0) as 0 | 1 | 2 | 3,
    burnEffectiveAtMs: a.burn_effective ? new Date(a.burn_effective).getTime() : null,
  };
}

const FLOOR_COLS = `id, status, winner_user_id, seller_user_id, start_price, reserve_price,
        base_fee_bps, spread_fee_bps, starts_at, duration_s, pause_windows,
        burn_level, burn_effective, floor_action`;

export async function resolveFloorIfNeeded(auctionId: string): Promise<FloorOutcome> {
  try {
    // Cheap, txn-free pre-check — the common case (not at floor) returns after one
    // pooled read, so the state poll doesn't open a transaction every second.
    const pre = await query<FloorRow>(`SELECT ${FLOOR_COLS} FROM auctions WHERE id = $1`, [auctionId]);
    const p = pre.rows[0];
    if (!p || p.status !== "live" || p.winner_user_id !== null) return null;
    if (!computePrice(toDecay(p), Date.now()).atFloor) return null;

    // At floor — run the guarded resolution in a transaction.
    return await withConnection(async (client) => {
      await client.query("BEGIN");

      const { rows } = await client.query<FloorRow>(
        `SELECT id, status, winner_user_id, seller_user_id, start_price, reserve_price,
                base_fee_bps, spread_fee_bps, starts_at, duration_s, pause_windows,
                burn_level, burn_effective, floor_action
         FROM auctions WHERE id = $1`,
        [auctionId]
      );
      const a = rows[0];
      if (!a || a.status !== "live" || a.winner_user_id !== null) {
        await client.query("ROLLBACK");
        return null;
      }

      let pauseWindows: PauseWindow[] = [];
      try { pauseWindows = JSON.parse(a.pause_windows ?? "[]"); } catch { /**/ }
      const decay: AuctionDecayParams = {
        startsAtMs: new Date(a.starts_at).getTime(),
        durationS: a.duration_s,
        startPrice: Number(a.start_price),
        reservePrice: Number(a.reserve_price),
        curve: "linear",
        pauseWindows,
        burnLevel: (a.burn_level ?? 0) as 0 | 1 | 2 | 3,
        burnEffectiveAtMs: a.burn_effective ? new Date(a.burn_effective).getTime() : null,
      };

      const price = computePrice(decay, Date.now());
      if (!price.atFloor) {
        await client.query("ROLLBACK");
        return null;
      }

      const reserve = Number(a.reserve_price);
      const floorAction = a.floor_action === "withdraw" ? "withdraw" : "lottery";

      // ── Withdraw: take the item down, no sale ───────────────────────────────
      if (floorAction === "withdraw") {
        const upd = await client.query(
          `UPDATE auctions SET status = 'unsold'
           WHERE id = $1 AND winner_user_id IS NULL AND status = 'live'`,
          [auctionId]
        );
        await client.query("COMMIT");
        return upd.rowCount === 1 ? "unsold" : null;
      }

      // ── Lottery: award to a random entrant who can afford the reserve ────────
      const entries = await client.query<{ user_id: string; balance: string | null }>(
        `SELECT le.user_id, w.balance
         FROM lottery_entries le
         LEFT JOIN wallets w ON w.user_id = le.user_id
         WHERE le.auction_id = $1`,
        [auctionId]
      );
      const eligible = entries.rows.filter(
        (e) => e.balance != null && BigInt(e.balance) >= BigInt(reserve)
      );

      // Nobody armed can pay → can't force a sale; take it down unsold.
      if (eligible.length === 0) {
        const upd = await client.query(
          `UPDATE auctions SET status = 'unsold'
           WHERE id = $1 AND winner_user_id IS NULL AND status = 'live'`,
          [auctionId]
        );
        await client.query("COMMIT");
        return upd.rowCount === 1 ? "unsold" : null;
      }

      const winner = eligible[Math.floor(Math.random() * eligible.length)];
      const upd = await client.query(
        `UPDATE auctions
         SET winner_user_id = $1, winning_price = $2, claimed_at = NOW(),
             won_via = 'lottery', status = 'claimed'
         WHERE id = $3 AND winner_user_id IS NULL AND status = 'live'`,
        [winner.user_id, reserve, auctionId]
      );
      if (upd.rowCount !== 1) {
        await client.query("ROLLBACK");
        return null;
      }

      // Settle at reserve (spread is 0 at the floor, so only the base fee applies).
      const baseFee = Math.round((reserve * a.base_fee_bps) / 10000);
      const totalFee = baseFee;
      const sellerProceeds = reserve - totalFee;

      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
        [reserve, winner.user_id]
      );
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [sellerProceeds, a.seller_user_id]
      );
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [totalFee, PLATFORM_USER_ID]
      );

      const entryGroup = randomUUID();
      const ledger = [
        [randomUUID(), entryGroup, winner.user_id, auctionId, -reserve, "item_purchase"],
        [randomUUID(), entryGroup, a.seller_user_id, auctionId, sellerProceeds, "item_sale"],
        [randomUUID(), entryGroup, PLATFORM_USER_ID, auctionId, totalFee, "commission"],
      ];
      for (const row of ledger) {
        await client.query(
          `INSERT INTO ledger_entries (id, entry_group, wallet_user_id, auction_id, amount, kind)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          row
        );
      }
      await client.query(
        `INSERT INTO claims (id, auction_id, user_id, server_price, tier, result, beaten_by_ms, armed_at_loss)
         VALUES ($1, $2, $3, $4, 3, 'won', NULL, NULL)`,
        [randomUUID(), auctionId, winner.user_id, reserve]
      );

      await client.query("COMMIT");
      return "lottery";
    });
  } catch (err) {
    console.error("[lib/floor] resolveFloorIfNeeded failed:", err);
    return null;
  }
}
