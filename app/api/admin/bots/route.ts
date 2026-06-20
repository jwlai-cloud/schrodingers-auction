/**
 * POST /api/admin/bots
 *
 * Admin-gated endpoint that spawns N fake bot users against a target auction.
 * Each bot:
 *   1. Is upserted into users + wallets (50,000 coins each)
 *   2. Casts all 3 votes (tier 3 = instant claim right)
 *   3. Fires a claim at a random offset between 0–maxDelayMs
 *
 * Because the claims hit the real DB the guarded UPDATE enforces exactly one
 * winner atomically — the result tells you who won and how many lost.
 * This gives a real demo of the DSQL OCC race without needing real users.
 *
 * Body: { auctionId: string, count?: number (1–10), maxDelayMs?: number (0–3000) }
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withConnection } from "@/lib/db";
import { computePrice, votesToTier, tierDelaySeconds } from "@/lib/price";
import { isAdmin } from "@/lib/adminAuth";
import type { AuctionDecayParams, PauseWindow } from "@/lib/price";

const BOT_NAMES = [
  "alex_k", "mei_ling", "rodrigo_br", "anon_sg", "ghost_42",
  "fast_fingers", "tokio_drift", "sunita_r", "lukas_eu", "neon_ny",
];

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { auctionId?: string; count?: number; maxDelayMs?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { auctionId, count = 3, maxDelayMs = 1500 } = body;
  if (!auctionId) return NextResponse.json({ error: "auctionId required" }, { status: 400 });
  const botCount = Math.min(10, Math.max(1, count));

  // ── Fetch auction params ──────────────────────────────────────────────────
  type ARow = {
    id: string; status: string; start_price: string; reserve_price: string;
    starts_at: string; duration_s: number; curve: string; pause_windows: string;
    burn_level: number; burn_effective: string | null; seller_user_id: string;
    winner_user_id: string | null;
  };

  let auctionRow: ARow;
  try {
    const res = await withConnection(async (client) => {
      const r = await client.query<ARow>(
        `SELECT id, status, start_price, reserve_price, starts_at, duration_s,
                curve, pause_windows, burn_level, burn_effective, seller_user_id, winner_user_id
         FROM auctions WHERE id = $1`, [auctionId]
      );
      await client.query("COMMIT");
      return r;
    });
    if (res.rows.length === 0) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    auctionRow = res.rows[0];
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (auctionRow.status !== "live") {
    return NextResponse.json({ error: "Auction is not live — run seed first" }, { status: 409 });
  }
  if (auctionRow.winner_user_id !== null) {
    return NextResponse.json({ error: "Auction already claimed — run seed to reset" }, { status: 409 });
  }

  // ── Provision bots ────────────────────────────────────────────────────────
  const bots: { id: string; name: string; delayMs: number }[] = [];
  for (let i = 0; i < botCount; i++) {
    const name = BOT_NAMES[i % BOT_NAMES.length];
    bots.push({
      id: `b0t00000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      name,
      delayMs: Math.floor(Math.random() * maxDelayMs),
    });
  }

  await withConnection(async (client) => {
    for (const bot of bots) {
      // Upsert user — DSQL: ON CONFLICT on PK is supported
      await client.query(
        `INSERT INTO users (id, email, display_name, region_code)
         VALUES ($1, $2, $3, 'BOT')
         ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [bot.id, `${bot.name}@bots.schrodinger.auction`, bot.name]
      );
      // Upsert wallet
      const { rows: wRows } = await client.query(
        `SELECT user_id FROM wallets WHERE user_id = $1`, [bot.id]
      );
      if (wRows.length === 0) {
        await client.query(
          `INSERT INTO wallets (user_id, balance) VALUES ($1, 50000)`, [bot.id]
        );
      } else {
        await client.query(
          `UPDATE wallets SET balance = 50000 WHERE user_id = $1`, [bot.id]
        );
      }
      await client.query("COMMIT");

      // Cast 3 votes (pre-check dedup)
      for (const actNo of [1, 2, 3] as const) {
        const { rows: vRows } = await client.query(
          `SELECT id FROM votes WHERE auction_id = $1 AND user_id = $2 AND act_no = $3`,
          [auctionId, bot.id, actNo]
        );
        if (vRows.length === 0) {
          await client.query(
            `INSERT INTO votes (id, auction_id, user_id, act_no, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
            [auctionId, bot.id, actNo]
          );
        }
      }
      await client.query("COMMIT");
    }
  });

  // ── Fire claims with random delays (real concurrent race) ─────────────────
  let pauseWindows: PauseWindow[] = [];
  try { pauseWindows = JSON.parse(auctionRow.pause_windows ?? "[]"); } catch { /**/ }

  const decayParams: AuctionDecayParams = {
    startsAtMs: new Date(auctionRow.starts_at).getTime(),
    durationS: auctionRow.duration_s,
    startPrice: Number(auctionRow.start_price),
    reservePrice: Number(auctionRow.reserve_price),
    curve: "linear",
    pauseWindows,
    burnLevel: (auctionRow.burn_level ?? 0) as 0 | 1 | 2 | 3,
    burnEffectiveAtMs: auctionRow.burn_effective ? new Date(auctionRow.burn_effective).getTime() : null,
  };

  const results = await Promise.allSettled(
    bots.map(async (bot) => {
      await new Promise((r) => setTimeout(r, bot.delayMs));
      const now = Date.now();
      const priceResult = computePrice(decayParams, now);
      if (priceResult.atFloor) return { bot: bot.name, result: "skipped_at_floor" };

      const voteCount = 3;
      const tier = votesToTier(voteCount);
      const delayS = tierDelaySeconds(tier);
      const elapsedS = (now - decayParams.startsAtMs) / 1000;
      if (elapsedS < delayS) return { bot: bot.name, result: "skipped_tier_delay" };

      const serverPrice = priceResult.price;
      const idempotencyKey = randomUUID();

      return await withConnection(async (client) => {
        await client.query("BEGIN");

        const updateResult = await client.query(
          `UPDATE auctions
           SET winner_user_id = $1, winning_price = $2, claimed_at = $3,
               won_via = 'claim', status = 'claimed'
           WHERE id = $4 AND winner_user_id IS NULL AND status = 'live'`,
          [bot.id, serverPrice, new Date(now).toISOString(), auctionId]
        );
        const won = updateResult.rowCount === 1;

        await client.query(
          `INSERT INTO claims (id, auction_id, user_id, server_price, tier, result, beaten_by_ms, armed_at_loss)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [idempotencyKey, auctionId, bot.id, serverPrice, tier, won ? "won" : "lost", won ? null : bot.delayMs, 0]
        );

        if (won) {
          await client.query(
            `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
            [serverPrice, bot.id]
          );
        }

        await client.query("COMMIT");
        return { bot: bot.name, result: won ? "won" : "lost", price: serverPrice, delayMs: bot.delayMs };
      });
    })
  );

  const summary = results.map((r) =>
    r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) }
  );
  const winner = summary.find((s) => s && "result" in s && s.result === "won");

  return NextResponse.json({ ok: true, winner: winner ?? null, results: summary });
}
