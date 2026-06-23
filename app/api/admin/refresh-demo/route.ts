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
import { actsToPauseWindows } from "@/lib/price";
import { isAdmin } from "@/lib/adminAuth";
import { DEMO_ITEMS, DEMO_SELLER_ID } from "@/lib/demoData";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  await withConnection(async (client) => {
    // Ensure the demo seller + wallet exist.
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

    for (const item of DEMO_ITEMS) {
      // Stagger near the top of the curve (0–40% down) with gentle burn, so items
      // stay live and visibly falling rather than nuking to the floor in minutes.
      // The 20-min cron + decay still carries some to the floor to show lottery/withdraw.
      const frac = Math.random() * 0.4;
      const startsAt = new Date(Date.now() - Math.floor(frac * item.durationS * 1000));
      // Brake starts at 0 — real armed demand drives it up (votes route ratchets it).
      const burnLevel = 0;
      const burnEffective = null;
      // Reveal acts early (8/20/35% of duration) so bidders can arm soon after entering.
      const revealOffsets = [0.08, 0.2, 0.35].map((f) => Math.floor(item.durationS * f));
      const pauseWindows = actsToPauseWindows(revealOffsets);

      // Clean prior-cycle intent + acts so the new race starts fresh with current offsets.
      await client.query(`DELETE FROM votes WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM lottery_entries WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM claims WHERE auction_id = $1`, [item.id]);
      await client.query(`DELETE FROM acts WHERE auction_id = $1`, [item.id]);
      await client.query("COMMIT");

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
      for (let i = 1; i <= 3; i++) {
        await client.query(
          `INSERT INTO acts (id, auction_id, act_no, headline, detail, reveal_offset_s)
           VALUES (gen_random_uuid(), $1, $2, $3, '', $4)`,
          [item.id, i, item.highlights[i - 1], revealOffsets[i - 1]]
        );
      }
      await client.query("COMMIT");
      results.push(`relisted ${item.id} (burn ${burnLevel}, ${item.floorAction})`);
    }
  });

  return NextResponse.json({ ok: true, refreshed: results.length, results });
}
