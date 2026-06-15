/**
 * GET /api/auctions
 *
 * Returns the list of live auctions for the lobby gallery.
 * Edge-cached with s-maxage=5 — the lobby doesn't need per-second freshness.
 *
 * TODO (Days 6–8): Replace mock data with a real DSQL query against
 * auction_rollups + auctions where status = 'live'.
 */

import { NextResponse } from "next/server";
import type { AuctionListResponse, AuctionSummary } from "@/lib/types";
import { actsToPauseWindows } from "@/lib/price";

function buildMockList(): AuctionListResponse {
  const now = Date.now();

  const base = (
    offsetMs: number,
    durationS: number,
    startPrice: number,
    reservePrice: number,
  ): AuctionSummary["decayParams"] => ({
    startsAtMs: now - offsetMs,
    durationS,
    startPrice,
    reservePrice,
    curve: "linear",
    pauseWindows: actsToPauseWindows([
      Math.floor(durationS * 0.25),
      Math.floor(durationS * 0.5),
      Math.floor(durationS * 0.75),
    ]),
    burnLevel: 0,
    burnEffectiveAtMs: null,
  });

  const auctions: AuctionSummary[] = [
    {
      id: "auc_001",
      title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones — Midnight Black",
      imageUrl: "/items/wh1000xm5.png",
      status: "live",
      startPrice: 1200,
      reservePrice: 200,
      decayParams: {
        ...base(4 * 60 * 1000, 15 * 60, 1200, 200),
        burnLevel: 1,
        burnEffectiveAtMs: now - 90_000,
      },
      armed: { tier3: 31, tier2: 14, tier1: 9 },
      spectatorsEst: 2341,
      serverTimeMs: now,
    },
    {
      id: "auc_002",
      title: "Nintendo Switch OLED — Zelda Limited Edition",
      imageUrl: "/items/switch-oled-zelda.png",
      status: "live",
      startPrice: 800,
      reservePrice: 150,
      decayParams: {
        ...base(2 * 60 * 1000, 12 * 60, 800, 150),
        burnLevel: 2,
        burnEffectiveAtMs: now - 45_000,
      },
      armed: { tier3: 58, tier2: 21, tier1: 13 },
      spectatorsEst: 4109,
      serverTimeMs: now,
    },
    {
      id: "auc_003",
      title: "Apple AirPods Pro (2nd gen) — USB-C with MagSafe Case",
      imageUrl: "/items/airpods-pro-2.png",
      status: "live",
      startPrice: 600,
      reservePrice: 100,
      decayParams: base(7 * 60 * 1000, 18 * 60, 600, 100),
      armed: { tier3: 12, tier2: 7, tier1: 5 },
      spectatorsEst: 873,
      serverTimeMs: now,
    },
    {
      id: "auc_004",
      title: "Dyson V15 Detect Absolute Cordless Vacuum",
      imageUrl: "/items/dyson-v15.png",
      status: "live",
      startPrice: 1500,
      reservePrice: 350,
      decayParams: base(1 * 60 * 1000, 20 * 60, 1500, 350),
      armed: { tier3: 4, tier2: 9, tier1: 18 },
      spectatorsEst: 1204,
      serverTimeMs: now,
    },
    {
      id: "auc_005",
      title: "Lego Technic Bugatti Chiron — Factory Sealed",
      imageUrl: "/items/lego-bugatti.png",
      status: "live",
      startPrice: 500,
      reservePrice: 80,
      decayParams: {
        ...base(9 * 60 * 1000, 14 * 60, 500, 80),
        burnLevel: 3,
        burnEffectiveAtMs: now - 120_000,
      },
      armed: { tier3: 77, tier2: 28, tier1: 11 },
      spectatorsEst: 6750,
      serverTimeMs: now,
    },
    {
      id: "auc_006",
      title: "Fujifilm X100VI — Silver, Brand New in Box",
      imageUrl: "/items/fujifilm-x100vi.png",
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

export async function GET(): Promise<NextResponse<AuctionListResponse>> {
  const body = buildMockList();

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=5",
    },
  });
}
