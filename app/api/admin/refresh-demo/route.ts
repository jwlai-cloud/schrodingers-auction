/**
 * POST /api/admin/refresh-demo  (admin only)
 *
 * Keeps the demo lobby alive. Re-lists every catalogue item with a fresh,
 * randomised start time so prices always sit at varied points on the curve,
 * and clears prior votes/lottery/claims so each cycle is a clean race.
 *
 * Designed to be called on a schedule (GitHub Actions cron) with the
 * x-admin-secret header. Idempotent: safe to call as often as you like.
 */
import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { actsToPauseWindows, armedToBrakeLevel } from "@/lib/price";
import { isAdmin } from "@/lib/adminAuth";
import { DEMO_ITEMS, DEMO_SELLER_ID } from "@/lib/demoData";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  await withConnection(async (client) => {
    // Ensure the demo seller + wallet exist.
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO users (id, email, display_name, region_code)
       VALUES ($1, 'demo@schrodinger.auction', 'Demo Seller', 'AU-NSW')
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_SELLER_ID]
    );
    await client.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, 50000)
       ON CONFLICT (user_id) DO NOTHING`,
      [DEMO_SELLER_ID]
    );
    await client.query("COMMIT");

    for (const [itemIdx, item] of DEMO_ITEMS.entries()) {
      // Stagger near the top of the curve (0–40% down) so items stay live and
      // visibly falling. The 20-min cron + decay carries some to the floor.
      const frac = Math.random() * 0.4;
      const startsAt = new Date(Date.now() - Math.floor(frac * item.durationS * 1000));
      // Ambient armed demand (real bot voters) so the room looks alive from the
      // start. The brake is baked in from launch (burn_effective = starts_at) to
      // match that demand — no mid-auction discontinuity.
      const armedN = 10 + Math.floor(Math.random() * 26); // 10–35 bidders
      const burnLevel = armedToBrakeLevel(armedN);
      const burnEffective = burnLevel > 0 ? startsAt.toISOString() : null;
      // Act 1 reveals immediately (votable on entry); acts 2/3 unlock at 15%/30%.
      const revealOffsets = [0, 0.15, 0.3].map((f) => Math.floor(item.durationS * f));
      const pauseWindows = actsToPauseWindows(revealOffsets);

      // One transaction per item: clear prior-cycle data, relist, acts, bot demand.
      await client.query("BEGIN");
      await client.query(`DELETE FROM votes WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM lottery_entries WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM claims WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM acts WHERE auction_id = $1`, [item.id]);

      await client.query(
        `INSERT INTO auctions (
           id, seller_user_id, title, description, image_url, category,
           status, start_price, reserve_price, duration_s, starts_at,
           curve, pause_windows, burn_level, burn_effective, floor_action, is_demo
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           'live', $7, $8, $9, $10,
           'linear', $11, $12, $13, $14, TRUE
         )
         ON CONFLICT (id) DO UPDATE SET
           status = 'live',
           starts_at = EXCLUDED.starts_at,
           burn_level = EXCLUDED.burn_level,
           burn_effective = EXCLUDED.burn_effective,
           image_url = EXCLUDED.image_url,
           floor_action = EXCLUDED.floor_action,
           is_demo = TRUE,
           winner_user_id = NULL,
           winning_price = NULL,
           claimed_at = NULL,
           won_via = NULL`,
        [
          item.id, DEMO_SELLER_ID, item.title, item.description, item.imageUrl, item.category,
          item.startPrice, item.reservePrice, item.durationS, startsAt.toISOString(),
          JSON.stringify(pauseWindows), burnLevel, burnEffective,
          item.floorAction,
        ]
      );

      // Acts — fresh insert each cycle (cleared above) with the early reveal offsets.
      for (let act = 1; act <= 3; act++) {
        await client.query(
          `INSERT INTO acts (id, auction_id, act_no, headline, detail, reveal_offset_s)
           VALUES (gen_random_uuid(), $1, $2, $3, '', $4)`,
          [item.id, act, item.highlights[act - 1], revealOffsets[act - 1]]
        );
      }

      // ── Ambient armed demand: armedN real bot voters, batched (3–4 statements). ──
      // Distribution: ~55% fully armed (3 votes), ~30% (2), ~15% (1). Deterministic
      // bot ids are reused across cycles (ON CONFLICT DO NOTHING) — no row growth.
      const userRows: string[] = [], userParams: unknown[] = [];
      const walletRows: string[] = [], walletParams: unknown[] = [];
      const voteRows: string[] = [], voteParams: unknown[] = [item.id]; // $1 = auction_id
      const lotteryRows: string[] = [], lotteryParams: unknown[] = [item.id]; // $1 = auction_id
      let up = 0, wp = 0, vp = 1, lp = 1;
      for (let k = 0; k < armedN; k++) {
        const bid = `b07b00${itemIdx}0-0000-4000-8000-${String(k).padStart(12, "0")}`;
        userRows.push(`($${++up},$${++up},$${++up},'BOT')`);
        userParams.push(bid, `bot${itemIdx}_${k}@bots.sca`, `bidder_${k}`);
        walletRows.push(`($${++wp},50000)`);
        walletParams.push(bid);
        const r = Math.random();
        const v = r < 0.55 ? 3 : r < 0.85 ? 2 : 1;
        for (let act = 1; act <= v; act++) {
          voteRows.push(`(gen_random_uuid(),$1,$${++vp},$${++vp})`);
          voteParams.push(bid, act);
        }
        if (v === 3) {
          lotteryRows.push(`(gen_random_uuid(),$1,$${++lp})`);
          lotteryParams.push(bid);
        }
      }
      await client.query(
        `INSERT INTO users (id, email, display_name, region_code) VALUES ${userRows.join(",")} ON CONFLICT (id) DO NOTHING`,
        userParams
      );
      await client.query(
        `INSERT INTO wallets (user_id, balance) VALUES ${walletRows.join(",")} ON CONFLICT (user_id) DO NOTHING`,
        walletParams
      );
      await client.query(
        `INSERT INTO votes (id, auction_id, user_id, act_no) VALUES ${voteRows.join(",")}`,
        voteParams
      );
      if (lotteryRows.length > 0) {
        await client.query(
          `INSERT INTO lottery_entries (id, auction_id, user_id) VALUES ${lotteryRows.join(",")}`,
          lotteryParams
        );
      }

      await client.query("COMMIT");
      results.push(`relisted ${item.id} (armed ${armedN}, brake ${burnLevel}, ${item.floorAction})`);
    }
  });

  return NextResponse.json({ ok: true, refreshed: results.length, results });
}
