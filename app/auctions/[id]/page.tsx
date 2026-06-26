/**
 * app/auctions/[id]/page.tsx — Auction room server page.
 *
 * Must be dynamic so Date.now() inside buildMockAuction is evaluated
 * fresh on every request rather than at build/cache time — otherwise
 * startsAtMs is stale and the price appears frozen.
 */
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { actsToPauseWindows } from "@/lib/price";
import type { AuctionSummary } from "@/lib/types";
import { AuctionRoom } from "@/components/AuctionRoom";
import { Navbar } from "@/components/Navbar";
import { fetchAuctionWithActs } from "@/lib/auctions";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export interface AuctionWithActs extends AuctionSummary {
  acts: { actNo: 1 | 2 | 3; headline: string; detail: string }[];
}

function buildMockAuction(id: string): AuctionWithActs | null {
  const now = Date.now();

  function base(offsetMs: number, durationS: number, startPrice: number, reservePrice: number) {
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

  const map: Record<string, AuctionWithActs> = {
    "11111111-0000-0000-0000-000000000001": {
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
      acts: [
        { actNo: 1, headline: "Sealed in original manufacturer packaging", detail: "Never opened — full retail box with all accessories." },
        { actNo: 2, headline: "Still under Sony 12-month warranty", detail: "Purchase receipt included. Claimable worldwide." },
        { actNo: 3, headline: "Exclusive Midnight Black — discontinued colour", detail: "Sony stopped producing this variant in Q2. Last stock." },
      ],
    },
    "11111111-0000-0000-0000-000000000002": {
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
      acts: [
        { actNo: 1, headline: "Factory sealed — Nintendo holographic sticker intact", detail: "Untouched since the factory. Console has never been powered on." },
        { actNo: 2, headline: "Game card included: Tears of the Kingdom", detail: "Full cartridge included. £69 RRP standalone." },
        { actNo: 3, headline: "Discontinued edition — sold out at all major retailers", detail: "Nintendo confirmed no second production run. Collector value rising." },
      ],
    },
    "11111111-0000-0000-0000-000000000003": {
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
      acts: [
        { actNo: 1, headline: "USB-C model — newest revision", detail: "Charges with any modern cable. Lightning is dead." },
        { actNo: 2, headline: "AppleCare+ eligible for 60 more days", detail: "Activation window is open — add 2 years of coverage." },
        { actNo: 3, headline: "Personalised engraving slot available at checkout", detail: "Seller will arrange Apple engraving for the winner before dispatch." },
      ],
    },
    "11111111-0000-0000-0000-000000000004": {
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
      acts: [
        { actNo: 1, headline: "Zero usage — bought as gift, never opened", detail: "Recipient already owns a V15. Box still shrink-wrapped." },
        { actNo: 2, headline: "Full 2-year Dyson warranty transfers to winner", detail: "Dyson confirmed warranty is tied to the device, not the purchaser." },
        { actNo: 3, headline: "Absolute kit: every attachment included", detail: "Hair screw, laser slim fluffy, crevice, anti-tangle — all in box." },
      ],
    },
    "11111111-0000-0000-0000-000000000005": {
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
      acts: [
        { actNo: 1, headline: "Set 42083 — Lego's most complex Technic ever made", detail: "3,599 pieces. Took Lego 3 years to engineer. Discontinued." },
        { actNo: 2, headline: "Working 8-speed gearbox and moveable spoiler", detail: "Fully functional Technic mechanisms — not a display model." },
        { actNo: 3, headline: "Secondary market value: £450+ sealed", detail: "BrickLink average for sealed: £460. Floor here is 80." },
      ],
    },
    "11111111-0000-0000-0000-000000000006": {
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
      acts: [
        { actNo: 1, headline: "Global waitlist: 9–12 months at RRP", detail: "Fujifilm X100VI has been on allocation since launch. You won't find one at retail." },
        { actNo: 2, headline: "In-body image stabilisation — first in the X100 series", detail: "7-stop IBIS. Shoot in sub-optimal light without a tripod." },
        { actNo: 3, headline: "Silver colourway with matching thumbrest included", detail: "Rare silver variant. Thumbrest (£60 RRP) already fitted." },
      ],
    },
  };

  return map[id] ?? null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const auction = buildMockAuction(id);
  return {
    title: auction ? `${auction.title} — Schrodinger Auction` : "Auction not found",
    description: auction?.description,
  };
}

export default async function AuctionPage({ params }: PageProps) {
  const { id } = await params;
  // Real DB auction (fixed starts_at → consistent price); mock fallback for demo.
  const now = Date.now();
  const auction = (await fetchAuctionWithActs(id, now)) ?? buildMockAuction(id);
  if (!auction) notFound();

  // Restore the signed-in user's vote count so arming persists across re-entry.
  let initialVotes = 0;
  const session = await getSession().catch(() => null);
  if (session) {
    try {
      const { rows } = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM votes WHERE auction_id = $1 AND user_id = $2`,
        [id, session.id]
      );
      initialVotes = Math.min(3, parseInt(rows[0]?.count ?? "0", 10));
    } catch {
      /* ignore — default to 0 */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <AuctionRoom auction={auction} serverTimeMs={auction.serverTimeMs} initialVotes={initialVotes} />
    </div>
  );
}
