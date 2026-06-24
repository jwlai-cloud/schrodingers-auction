/**
 * GET /api/auctions
 *
 * Returns the list of live auctions for the lobby gallery.
 * Queries the DB; falls back to mock data when DB is unavailable.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { AuctionListResponse, AuctionSummary } from "@/lib/types";
import type { AuctionDecayParams } from "@/lib/price";

function makeMockList(): AuctionListResponse {
  const now = Date.now();

  const base = (
    offsetMs: number,
    durationS: number,
    startPrice: number,
    reservePrice: number,
    burnLevel: 0 | 1 | 2 | 3 = 0,
  ): AuctionDecayParams => ({
    startsAtMs: now - offsetMs,
    durationS,
    startPrice,
    reservePrice,
    curve: "linear",
    pauseWindows: [
      { from: Math.floor(durationS * 0.25) - 15, until: Math.floor(durationS * 0.25) + 15 },
      { from: Math.floor(durationS * 0.5)  - 15, until: Math.floor(durationS * 0.5)  + 15 },
      { from: Math.floor(durationS * 0.75) - 15, until: Math.floor(durationS * 0.75) + 15 },
    ],
    burnLevel,
    burnEffectiveAtMs: burnLevel > 0 ? now - 90_000 : null,
  });

  const auctions: AuctionSummary[] = [
    {
      id: "11111111-0000-0000-0000-000000000001",
      title: "Sony WH-1000XM5 Wireless Headphones",
      description: "Industry-leading noise cancellation. 30-hr battery. Brand new sealed.",
      imageUrl: "/items/wh1000xm5.png",
      category: "Electronics",
      status: "live",
      startPrice: 1200,
      reservePrice: 200,
      decayParams: base(4 * 60_000, 15 * 60, 1200, 200, 1),
      armed: { tier3: 31, tier2: 14, tier1: 9 },
      spectatorsEst: 2341,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000002",
      title: "Nintendo Switch OLED — Zelda Limited Edition",
      description: "Limited edition OLED console. Zelda: Tears of the Kingdom bundle.",
      imageUrl: "/items/switch-oled-zelda.png",
      category: "Gaming",
      status: "live",
      startPrice: 800,
      reservePrice: 150,
      decayParams: base(2 * 60_000, 12 * 60, 800, 150, 2),
      armed: { tier3: 58, tier2: 21, tier1: 13 },
      spectatorsEst: 4109,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000003",
      title: "Apple AirPods Pro (2nd gen) — USB-C",
      description: "H2 chip. Adaptive Transparency. USB-C MagSafe case. Sealed box.",
      imageUrl: "/items/airpods-pro-2.png",
      category: "Electronics",
      status: "live",
      startPrice: 600,
      reservePrice: 100,
      decayParams: base(7 * 60_000, 18 * 60, 600, 100),
      armed: { tier3: 12, tier2: 7, tier1: 5 },
      spectatorsEst: 873,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000004",
      title: "Dyson V15 Detect Absolute Cordless Vacuum",
      description: "Laser dust detection. 60-min battery. Full attachment kit included.",
      imageUrl: "/items/dyson-v15.png",
      category: "Home",
      status: "live",
      startPrice: 1500,
      reservePrice: 350,
      decayParams: base(1 * 60_000, 20 * 60, 1500, 350),
      armed: { tier3: 4, tier2: 9, tier1: 18 },
      spectatorsEst: 1204,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000005",
      title: "Lego Technic Bugatti Chiron — Factory Sealed",
      description: "3,599 pieces. 1:8 scale. Working gearbox. BNIB collector piece.",
      imageUrl: "/items/lego-bugatti.png",
      category: "Collectibles",
      status: "live",
      startPrice: 500,
      reservePrice: 80,
      decayParams: base(9 * 60_000, 14 * 60, 500, 80, 3),
      armed: { tier3: 77, tier2: 28, tier1: 11 },
      spectatorsEst: 6750,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000006",
      title: "Fujifilm X100VI — Silver, Brand New in Box",
      description: "40MP X-Trans sensor. In-body stabilisation. Retro rangefinder design.",
      imageUrl: "/items/fujifilm-x100vi.png",
      category: "Photography",
      status: "live",
      startPrice: 2000,
      reservePrice: 800,
      decayParams: base(30_000, 25 * 60, 2000, 800),
      armed: { tier3: 2, tier2: 4, tier1: 11 },
      spectatorsEst: 542,
      serverTimeMs: now,
    },
  ];

  return { auctions, serverTimeMs: now };
}

// Never CDN-cache the live list — stale prices look like the auction "jumping".
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<AuctionListResponse>> {
  const now = Date.now();

  try {
    const result = await query<{
      id: string;
      title: string;
      description: string | null;
      image_url: string | null;
      category: string | null;
      status: string;
      start_price: number;
      reserve_price: number;
      duration_s: number;
      starts_at: string;
      curve: string;
      pause_windows: unknown;
      burn_level: number;
    }>(
      `SELECT id, title, description, image_url, category, status,
              start_price, reserve_price, duration_s, starts_at,
              curve, pause_windows, burn_level
       FROM auctions
       WHERE status = 'live'
       ORDER BY starts_at DESC
       LIMIT 20`
    );

    if (result.rows.length === 0) {
      // No live rows yet — return mock so the lobby always has content
      return NextResponse.json(makeMockList(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const auctions: AuctionSummary[] = result.rows.map((row) => {
      const startsAtMs = new Date(row.starts_at).getTime();
      const rawWindows = (typeof row.pause_windows === "string"
        ? JSON.parse(row.pause_windows)
        : (row.pause_windows as { startS?: number; durationS?: number; from?: number; until?: number }[])
      ) ?? [];

      // Normalise pause windows — seed uses {startS, durationS}, price uses {from, until}
      const pauseWindows = rawWindows.map((pw: { startS?: number; durationS?: number; from?: number; until?: number }) =>
        pw.from !== undefined
          ? pw as { from: number; until: number }
          : { from: (pw.startS ?? 0), until: (pw.startS ?? 0) + (pw.durationS ?? 30) }
      );

      const decayParams: AuctionDecayParams = {
        startsAtMs,
        durationS: row.duration_s,
        startPrice: Number(row.start_price),
        reservePrice: Number(row.reserve_price),
        curve: "linear",
        pauseWindows,
        burnLevel: (Math.min(3, Math.max(0, row.burn_level ?? 0)) as 0 | 1 | 2 | 3),
        burnEffectiveAtMs: row.burn_level > 0 ? startsAtMs : null,
      };

      return {
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        imageUrl: row.image_url,
        category: row.category ?? "Other",
        status: row.status as AuctionSummary["status"],
        startPrice: Number(row.start_price),
        reservePrice: Number(row.reserve_price),
        decayParams,
        armed: { tier3: 0, tier2: 0, tier1: 0 },
        spectatorsEst: Math.floor(500 + Math.random() * 3000),
        serverTimeMs: now,
      };
    });

    return NextResponse.json(
      { auctions, serverTimeMs: now },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // DB unavailable — graceful fallback to mock data
    return NextResponse.json(makeMockList(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
