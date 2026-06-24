import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";
import { actsToPauseWindows } from "@/lib/price";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  await withConnection(async (client) => {
    // ── Demo user ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO users (id, email, display_name, region_code)
      VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'demo@schrodinger.auction', 'Demo Bidder', 'AU-NSW')
      ON CONFLICT (id) DO NOTHING
    `);
    results.push("upserted demo user");

    await client.query(`
      INSERT INTO wallets (user_id, balance)
      VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 50000)
      ON CONFLICT (user_id) DO UPDATE SET balance = 50000
    `);
    results.push("seeded wallet 50,000 coins");

    // ── Demo auctions ──────────────────────────────────────────────────────
    const now = Date.now();
    // UUIDs are stable so re-running seed is idempotent (ON CONFLICT DO UPDATE)
    const AUCTIONS = [
      {
        id: "11111111-0000-0000-0000-000000000001",
        title: "Sony WH-1000XM5 Wireless Headphones — Midnight Black",
        description: "Industry-leading noise cancellation. 30-hr battery. Brand new sealed.",
        image_url: "/items/wh1000xm5.png",
        category: "Electronics",
        start_price: 1200,
        reserve_price: 200,
        duration_s: 15 * 60,
        starts_at_offset_ms: -4 * 60 * 1000,
        burn_level: 1,
      },
      {
        id: "11111111-0000-0000-0000-000000000002",
        title: "Nintendo Switch OLED — Zelda Limited Edition",
        description: "Limited edition. OLED screen. Zelda: Tears of the Kingdom bundle.",
        image_url: "/items/switch-oled-zelda.png",
        category: "Gaming",
        start_price: 800,
        reserve_price: 150,
        duration_s: 12 * 60,
        starts_at_offset_ms: -2 * 60 * 1000,
        burn_level: 2,
      },
      {
        id: "11111111-0000-0000-0000-000000000003",
        title: "Apple AirPods Pro (2nd gen) — USB-C",
        description: "H2 chip. Adaptive Transparency. USB-C MagSafe case. Sealed.",
        image_url: "/items/airpods-pro-2.png",
        category: "Electronics",
        start_price: 600,
        reserve_price: 100,
        duration_s: 18 * 60,
        starts_at_offset_ms: -7 * 60 * 1000,
        burn_level: 0,
      },
      {
        id: "11111111-0000-0000-0000-000000000004",
        title: "Dyson V15 Detect Absolute Cordless Vacuum",
        description: "Laser dust detection. 60-min battery. Full attachment kit.",
        image_url: "/items/dyson-v15.png",
        category: "Home",
        start_price: 1500,
        reserve_price: 350,
        duration_s: 20 * 60,
        starts_at_offset_ms: -1 * 60 * 1000,
        burn_level: 0,
      },
      {
        id: "11111111-0000-0000-0000-000000000005",
        title: "Lego Technic Bugatti Chiron — Factory Sealed",
        description: "3,599 pieces. 1:8 scale. Working gearbox. BNIB collector piece.",
        image_url: "/items/lego-bugatti.png",
        category: "Collectibles",
        start_price: 500,
        reserve_price: 80,
        duration_s: 14 * 60,
        starts_at_offset_ms: -9 * 60 * 1000,
        burn_level: 3,
      },
      {
        id: "11111111-0000-0000-0000-000000000006",
        title: "Fujifilm X100VI — Silver, Brand New in Box",
        description: "40MP X-Trans sensor. In-body stabilisation. Retro rangefinder design.",
        image_url: "/items/fujifilm-x100vi.png",
        category: "Photography",
        start_price: 2000,
        reserve_price: 800,
        duration_s: 25 * 60,
        starts_at_offset_ms: -30 * 1000,
        burn_level: 0,
      },
    ];

    for (const a of AUCTIONS) {
      const startsAt = new Date(now + a.starts_at_offset_ms);
      const pauseWindows = actsToPauseWindows([
        Math.floor(a.duration_s * 0.25),
        Math.floor(a.duration_s * 0.5),
        Math.floor(a.duration_s * 0.75),
      ]);

      await client.query(
        `INSERT INTO auctions (
          id, seller_user_id, title, description, image_url, category,
          status, start_price, reserve_price, duration_s, starts_at,
          curve, pause_windows, burn_level
        ) VALUES (
          $1, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', $2, $3, $4, $5,
          'live', $6, $7, $8, $9,
          'linear', $10, $11
        ) ON CONFLICT (id) DO UPDATE SET
          status = 'live',
          starts_at = EXCLUDED.starts_at,
          burn_level = EXCLUDED.burn_level,
          image_url = EXCLUDED.image_url,
          winner_user_id = NULL,
          winning_price = NULL,
          claimed_at = NULL`,
        [
          a.id,
          a.title,
          a.description,
          a.image_url,
          a.category,
          a.start_price,
          a.reserve_price,
          a.duration_s,
          startsAt.toISOString(),
          JSON.stringify(pauseWindows),
          a.burn_level,
        ]
      );

      // Insert the 3 acts (schema uses: headline, detail, reveal_offset_s)
      const highlights = [
        "Sealed in original manufacturer packaging.",
        "Tested and verified by our team.",
        "Same-day dispatch available.",
      ];
      for (let i = 1; i <= 3; i++) {
        const revealAt = Math.floor(a.duration_s * (i / 4));
        // DSQL does not support ON CONFLICT on non-PK unique indexes — pre-check
        const { rows: existing } = await client.query(
          `SELECT id FROM acts WHERE auction_id = $1 AND act_no = $2 LIMIT 1`,
          [a.id, i]
        );
        if (existing.length === 0) {
          await client.query(
            `INSERT INTO acts (id, auction_id, act_no, headline, detail, reveal_offset_s)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
            [a.id, i, highlights[i - 1], "", revealAt]
          );
        }
      }

      results.push(`seeded auction ${a.id}`);
    }
  });

  return NextResponse.json({ ok: true, results });
}
