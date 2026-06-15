/**
 * app/page.tsx — Lobby / gallery of live auctions.
 *
 * Server component: fetches mock auction list, passes serverTimeMs down to
 * client components so they can derive the clock offset for local price rendering.
 *
 * TODO (Days 12–13): Replace MOCK_AUCTIONS with a real fetch to /api/auctions
 * (or direct DSQL query) and add the seed script for demo listings.
 */

import { Zap, Trophy, ShoppingBag } from "lucide-react";
import { AuctionCard } from "@/components/AuctionCard";
import type { AuctionSummary } from "@/lib/types";
import { actsToPauseWindows } from "@/lib/price";

// ── Mock data ────────────────────────────────────────────────────────────────

function buildMockAuctions(): { auctions: AuctionSummary[]; serverTimeMs: number } {
  const now = Date.now();

  const base = (offset: number, durationS: number): AuctionSummary["decayParams"] => ({
    startsAtMs: now - offset,
    durationS,
    startPrice: 0, // overridden per auction below
    reservePrice: 0,
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
        ...base(4 * 60 * 1000, 15 * 60),
        startPrice: 1200,
        reservePrice: 200,
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
        ...base(2 * 60 * 1000, 12 * 60),
        startPrice: 800,
        reservePrice: 150,
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
      decayParams: {
        ...base(7 * 60 * 1000, 18 * 60),
        startPrice: 600,
        reservePrice: 100,
        burnLevel: 0,
        burnEffectiveAtMs: null,
      },
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
      decayParams: {
        ...base(1 * 60 * 1000, 20 * 60),
        startPrice: 1500,
        reservePrice: 350,
        burnLevel: 0,
        burnEffectiveAtMs: null,
      },
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
        ...base(9 * 60 * 1000, 14 * 60),
        startPrice: 500,
        reservePrice: 80,
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
      decayParams: {
        ...base(30_000, 25 * 60),
        startPrice: 2000,
        reservePrice: 800,
        burnLevel: 0,
        burnEffectiveAtMs: null,
      },
      armed: { tier3: 2, tier2: 4, tier1: 11 },
      spectatorsEst: 542,
      serverTimeMs: now,
    },
  ];

  return { auctions, serverTimeMs: now };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LobbyPage() {
  const { auctions, serverTimeMs } = buildMockAuctions();

  // Client will compute clockOffsetMs = serverTimeMs - Date.now() on mount.
  // We pass serverTimeMs as a data attribute so the client has it.
  // For SSR rendering, offset is 0 (close enough for initial paint).
  const clockOffsetMs = 0;

  const totalArmed = auctions.reduce(
    (sum, a) => sum + a.armed.tier3 + a.armed.tier2 + a.armed.tier1,
    0
  );
  const totalWatching = auctions.reduce((sum, a) => sum + a.spectatorsEst, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          {/* Wordmark */}
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber text-lg tracking-tight">
              Schrödinger
            </span>
            <span className="font-sans font-light text-muted-foreground text-sm hidden sm:block">
              / auction
            </span>
          </div>

          {/* Global live stats */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span className="hidden sm:flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular">{totalWatching.toLocaleString()}</span>
              <span className="sr-only">watching globally</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular">{totalArmed.toLocaleString()}</span>
              <span className="hidden sm:inline">armed</span>
              <span className="sr-only">armed bidders globally</span>
            </span>
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors text-xs font-semibold">
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero strip ──────────────────────────────────────── */}
      <section className="border-b border-border py-10 md:py-16">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs tracking-widest uppercase text-amber mb-3">
              Dutch auction — live globally
            </p>
            <h1 className="font-sans font-bold text-3xl md:text-5xl text-foreground leading-tight text-balance">
              The price falls.
              <br />
              <span className="text-amber">One person claims it.</span>
            </h1>
            <p className="mt-4 text-muted-foreground text-sm md:text-base leading-relaxed max-w-md text-pretty">
              Watch the room. Arm yourself with votes. The moment feels right —
              claim before anyone else on the planet does.
            </p>
          </div>

          {/* How-it-works chips */}
          <div className="flex flex-col gap-3 text-sm w-full md:w-auto md:min-w-[220px]">
            {[
              { icon: Zap, label: "Price falls every second", color: "text-amber" },
              { icon: Shield, label: "Vote to arm yourself", color: "text-drop-green" },
              { icon: Trophy, label: "First valid claim wins", color: "text-foreground" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-card">
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} aria-hidden="true" />
                <span className="font-sans text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live auction gallery ─────────────────────────────── */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-sans font-semibold text-foreground text-lg">
            Live now
            <span className="ml-2 font-mono text-sm text-muted-foreground font-normal">
              {auctions.length} auctions
            </span>
          </h2>
          <p
            className="font-mono text-xs text-muted-foreground"
            data-server-time-ms={serverTimeMs}
            suppressHydrationWarning
          >
            prices updating live
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {auctions.map((auction, i) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              clockOffsetMs={clockOffsetMs}
              priority={i < 3}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <span>Schrödinger&apos;s Auction — demo build</span>
          <span>One price, everywhere. One winner, ever.</span>
        </div>
      </footer>
    </div>
  );
}

// Inline icon used in the header only — keeps dependency minimal
function Eye({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
