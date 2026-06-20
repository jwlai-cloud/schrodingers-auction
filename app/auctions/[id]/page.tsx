/**
 * app/auctions/[id]/page.tsx — Auction room.
 * Server component that builds mock data from the same params as the lobby.
 * All live interaction (price ticker, vote, claim, reactions) is in AuctionRoom client component.
 */

import { notFound } from "next/navigation";
import { actsToPauseWindows } from "@/lib/price";
import type { AuctionSummary } from "@/lib/types";
import { AuctionRoom } from "@/components/AuctionRoom";
import { Navbar } from "@/components/Navbar";

// ── Shared mock data (mirrors lobby) ─────────────────────────────────────────

export function buildMockAuction(id: string): AuctionSummary | null {
  const now = Date.now();

  const base = (offset: number, durationS: number, startPrice: number, reservePrice: number) => ({
    startsAtMs: now - offset,
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
  });

  const map: Record<string, AuctionSummary> = {
    "11111111-0000-0000-0000-000000000001": {
      id: "11111111-0000-0000-0000-000000000001",
      title: "Sony WH-1000XM5 Wireless Headphones",
      imageUrl: "/items/wh1000xm5.png",
      category: "Electronics",
      status: "live",
      startPrice: 1200,
      reservePrice: 200,
      decayParams: { ...base(4 * 60_000, 15 * 60, 1200, 200), burnLevel: 1, burnEffectiveAtMs: now - 90_000 },
      armed: { tier3: 31, tier2: 14, tier1: 9 },
      spectatorsEst: 2341,
      serverTimeMs: now,
    },
    "11111111-0000-0000-0000-000000000002": {
      id: "11111111-0000-0000-0000-000000000002",
      title: "Nintendo Switch OLED — Zelda Limited Edition",
      imageUrl: "/items/switch-oled-zelda.png",
      category: "Gaming",
      status: "live",
      startPrice: 800,
      reservePrice: 150,
      decayParams: { ...base(2 * 60_000, 12 * 60, 800, 150), burnLevel: 2, burnEffectiveAtMs: now - 45_000 },
      armed: { tier3: 58, tier2: 21, tier1: 13 },
      spectatorsEst: 4109,
      serverTimeMs: now,
    },
    "11111111-0000-0000-0000-000000000003": {
      id: "11111111-0000-0000-0000-000000000003",
      title: "Apple AirPods Pro (2nd gen) — USB-C",
      imageUrl: "/items/airpods-pro-2.png",
      category: "Electronics",
      status: "live",
      startPrice: 600,
      reservePrice: 100,
      decayParams: { ...base(7 * 60_000, 18 * 60, 600, 100), burnLevel: 0, burnEffectiveAtMs: null },
      armed: { tier3: 12, tier2: 7, tier1: 5 },
      spectatorsEst: 873,
      serverTimeMs: now,
    },
    "11111111-0000-0000-0000-000000000004": {
      id: "11111111-0000-0000-0000-000000000004",
      title: "Dyson V15 Detect Absolute Cordless Vacuum",
      imageUrl: "/items/dyson-v15.png",
      category: "Home",
      status: "live",
      startPrice: 1500,
      reservePrice: 350,
      decayParams: { ...base(1 * 60_000, 20 * 60, 1500, 350), burnLevel: 0, burnEffectiveAtMs: null },
      armed: { tier3: 4, tier2: 9, tier1: 18 },
      spectatorsEst: 1204,
      serverTimeMs: now,
    },
    "11111111-0000-0000-0000-000000000005": {
      id: "11111111-0000-0000-0000-000000000005",
      title: "Lego Technic Bugatti Chiron — Factory Sealed",
      imageUrl: "/items/lego-bugatti.png",
      category: "Collectibles",
      status: "live",
      startPrice: 500,
      reservePrice: 80,
      decayParams: { ...base(9 * 60_000, 14 * 60, 500, 80), burnLevel: 3, burnEffectiveAtMs: now - 120_000 },
      armed: { tier3: 77, tier2: 28, tier1: 11 },
      spectatorsEst: 6750,
      serverTimeMs: now,
    },
    "11111111-0000-0000-0000-000000000006": {
      id: "11111111-0000-0000-0000-000000000006",
      title: "Fujifilm X100VI — Silver, Brand New in Box",
      imageUrl: "/items/fujifilm-x100vi.png",
      category: "Photography",
      status: "live",
      startPrice: 2000,
      reservePrice: 800,
      decayParams: { ...base(30_000, 25 * 60, 2000, 800), burnLevel: 0, burnEffectiveAtMs: null },
      armed: { tier3: 2, tier2: 4, tier1: 11 },
      spectatorsEst: 542,
      serverTimeMs: now,
    },
  };

  return map[id] ?? null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface AuctionPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: AuctionPageProps) {
  const auction = buildMockAuction(params.id);
  return {
    title: auction ? `${auction.title} — Schrodinger Auction` : "Auction not found",
  };
}

export default function AuctionPage({ params }: AuctionPageProps) {
  const auction = buildMockAuction(params.id);
  if (!auction) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <AuctionRoom auction={auction} serverTimeMs={auction.serverTimeMs} />
    </div>
  );
}
