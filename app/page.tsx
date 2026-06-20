/**
 * app/page.tsx — Lobby (server component).
 * Builds the auction list and passes it to the LobbyClient for client-side filtering.
 */

import { actsToPauseWindows } from "@/lib/price";
import type { AuctionSummary } from "@/lib/types";
import { Navbar } from "@/components/Navbar";
import { LobbyClient } from "@/components/LobbyClient";
import { fetchLiveAuctions } from "@/lib/auctions";

// Dynamic so serverTimeMs (and the DB read) are fresh per request — a cached
// lobby would hand the client a stale clock and mis-compute the falling price.
export const dynamic = "force-dynamic";

function buildMockAuctions(): { auctions: AuctionSummary[]; serverTimeMs: number } {
  const now = Date.now();

  function base(
    offsetMs: number,
    durationS: number,
    startPrice: number,
    reservePrice: number
  ) {
    return {
      startsAtMs: now - offsetMs,
      durationS,
      startPrice,
      reservePrice,
      curve: "linear" as const,
      pauseWindows: actsToPauseWindows([
        Math.floor(durationS * 0.25),
        Math.floor(durationS * 0.5),
        Math.floor(durationS * 0.75),
      ]),
      burnLevel: 0 as const,
      burnEffectiveAtMs: null,
    };
  }

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
      decayParams: { ...base(4 * 60_000, 15 * 60, 1200, 200), burnLevel: 1 as const, burnEffectiveAtMs: now - 90_000 },
      armed: { tier3: 31, tier2: 14, tier1: 9 },
      spectatorsEst: 2341,
      serverTimeMs: now,
    },
    {
      id: "11111111-0000-0000-0000-000000000002",
      title: "Nintendo Switch OLED — Zelda Limited Edition",
      description: "Limited edition OLED console. Zelda: Tears of the Kingdom bundle. Factory sealed.",
      imageUrl: "/items/switch-oled-zelda.png",
      category: "Gaming",
      status: "live",
      startPrice: 800,
      reservePrice: 150,
      decayParams: { ...base(2 * 60_000, 12 * 60, 800, 150), burnLevel: 2 as const, burnEffectiveAtMs: now - 45_000 },
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
      decayParams: { ...base(9 * 60_000, 14 * 60, 500, 80), burnLevel: 3 as const, burnEffectiveAtMs: now - 120_000 },
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

export default async function LobbyPage() {
  // Real DB auctions (fixed starts_at → price holds across refresh); mock fallback.
  const now = Date.now();
  const { auctions, serverTimeMs } = (await fetchLiveAuctions(now)) ?? buildMockAuctions();

  const totalArmed  = auctions.reduce((s, a) => s + a.armed.tier3 + a.armed.tier2 + a.armed.tier1, 0);
  const totalWatching = auctions.reduce((s, a) => s + a.spectatorsEst, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar totalWatching={totalWatching} totalArmed={totalArmed} />
      <LobbyClient auctions={auctions} serverTimeMs={serverTimeMs} />
    </div>
  );
}
