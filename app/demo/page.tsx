"use client";

/**
 * app/demo/page.tsx — Interactive judge walkthrough / demo script.
 * Kept accurate against the actual live build (AuctionRoom, Navbar, sell form,
 * auth, demand brake, act-gated voting, bot races, AI listing copy).
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ChevronRight, Clock, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";

// ─────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────

const STEPS = [
  // ── 1 ───────────────────────────────────────────────────
  {
    no: 1,
    title: "The Lobby",
    url: "/",
    tagline: "Show the room before anything else.",
    mins: 1.5,
    script: [
      "Open the lobby at /. Six live auctions, prices falling in real time — every viewer on earth computes the same number from the same parameters.",
      "The hero reads: 'The price falls. One person claims it.' Three how-it-works chips explain the mechanic without a paragraph of copy.",
      "Some cards show a DEMAND HOLD badge. That is the demand brake: as more bidders arm, the price decay SLOWS, so a hot item holds a high price instead of fire-selling.",
      "Click a category chip (e.g. 'Gaming'). The grid filters instantly — no reload. That is client-side state in LobbyClient.",
      "Key message: this is a spectator sport before it is an auction. The crowd numbers are not decoration — they are the information game.",
    ],
    demo: [
      { action: "Point to a DEMAND HOLD badge", what: "Demand is slowing this item's drop — visible support, not a CSS effect" },
      { action: "Click 'Gaming' filter chip", what: "Grid narrows instantly — no reload" },
      { action: "Watch any price ticker", what: "Ticks down every second — same number globally, holds across refresh" },
      { action: "Point to the Navbar", what: "Global armed + watching counts — live aggregates" },
    ],
  },

  // ── 2 ───────────────────────────────────────────────────
  {
    no: 2,
    title: "Create an Account",
    url: null,
    tagline: "30 seconds from zero to 50,000 coins.",
    mins: 1,
    script: [
      "Click 'Sign in' in the top-right Navbar. The AuthModal slides in.",
      "Switch to 'Sign up'. Fill in display name, email, password. Hit 'Create account'.",
      "On success the modal closes and the Navbar coin balance lights up green — 50,000 demo coins. No card, no friction.",
      "Auth is polled every 3s, so an auction room already open updates immediately without a reload.",
    ],
    demo: [
      { action: "Click 'Sign in' in the Navbar", what: "AuthModal opens" },
      { action: "Switch to 'Sign up'", what: "Adds a 'Display name' field; button becomes 'Create account'" },
      { action: "Submit the form", what: "Modal closes; Navbar shows green coin balance + 'Sign out'" },
    ],
  },

  // ── 3 ───────────────────────────────────────────────────
  {
    no: 3,
    title: "Enter an Auction Room",
    url: "/auctions/11111111-0000-0000-0000-000000000005",
    tagline: "Everything the room tells you without a tutorial.",
    mins: 1.5,
    script: [
      "Open any auction. Left column: product image with a LIVE badge (and a DEMAND HOLD badge once demand is high). Reaction emojis below.",
      "Right column, top: the demand panel. An escalating urgency line ('👀 N armed — momentum is building') and a live breakdown — how many bidders are fully armed (3 votes), armed (2), and warming (1). These counts are REAL, aggregated from the votes table.",
      "Below: the live price card — falling number, amber progress bar, and a 'floor hidden' label. The reserve is Schrodinger until the auction resolves.",
      "Then the arm panel: three act boxes (grey = not yet earned) and the claim button — 'Sign in to claim', or 'Must arm first' at 0 votes.",
      "Key message: the grey boxes say 'earn this'; the falling number says 'limited time'; the armed breakdown says 'you are not alone'.",
    ],
    demo: [
      { action: "Open the Lego Bugatti room", what: "LIVE badge; demand panel with the live armed breakdown" },
      { action: "Tap a reaction emoji (🔥)", what: "Emoji floats up over the image — crowd atmosphere" },
      { action: "Point to the urgency line + tier counts", what: "Real armed numbers by tier, not cosmetic" },
      { action: "Show the claim button", what: "'Must arm first' at 0 votes; 'Sign in to claim' if signed out" },
    ],
  },

  // ── 4 ───────────────────────────────────────────────────
  {
    no: 4,
    title: "Arm Yourself",
    url: null,
    tagline: "Attention is the currency — and it's deliberate.",
    mins: 1.5,
    script: [
      "You earn claim rights by voting on the seller's act reveals. Voting is deliberate: you can only vote for an act once it has been revealed, and there's a short cooldown between votes — no mashing to instant-armed.",
      "Act 1 is revealed at the start, so you can cast your first vote right away; acts 2 and 3 unlock as the auction progresses (their spotlights pause the price for a moment).",
      "Each vote climbs a tier: 1 vote → 5s claim delay, 2 votes → 2s, 3 votes → instant claim, fully armed. Try to vote before an act is revealed and the room tells you to wait.",
      "Watch the demand panel: as the armed count rises across all bidders, the DEMAND HOLD badge appears and the price decay visibly slows. Demand props the price up.",
      "For a fast demo, arm a whole fleet at once with the admin bot race (next step) instead of waiting out the cooldown.",
    ],
    demo: [
      { action: "Vote for Act 1 (revealed immediately)", what: "Act 1 box turns green; tier 1 — 5s delay" },
      { action: "Try to vote again right away", what: "Cooldown message — voting is deliberate by design" },
      { action: "Run an arm-only bot fleet (admin)", what: "Armed count jumps; DEMAND HOLD badge appears; price slows" },
      { action: "Point to the armed breakdown", what: "Real per-tier counts climb live" },
    ],
  },

  // ── 5 ───────────────────────────────────────────────────
  {
    no: 5,
    title: "The One-Winner Race & Claim",
    url: "/admin",
    tagline: "One button. One winner, ever — proven with a real race.",
    mins: 1.5,
    script: [
      "From /admin, run a bot race: it provisions real DB users, arms them, and fires their claims at random millisecond offsets — a genuine concurrent race against Aurora DSQL, no real crowd needed.",
      "The server resolves it with one guarded UPDATE: status = live, winner_user_id IS NULL, price > reserve, balance >= price. Exactly one transaction commits; the rest abort on an OCC serialization conflict. That abort IS the loss.",
      "Now claim it yourself. Win screen: 'You claimed it.' — item name, price, coins debited. Lose to a bot and the loss screen shows the REAL winner's name and the REAL millisecond gap, read from the database — not a hardcoded number.",
      "Arm-only variant: run the fleet without claiming, watch the demand brake hold the price high, then claim at that held price yourself.",
      "Key message: a single conditional UPDATE across a multi-region cluster is the referee. Two simultaneous claims, one commit, one abort.",
    ],
    demo: [
      { action: "Admin → run bot race on an auction", what: "N bots arm + claim concurrently; response names the one winner" },
      { action: "Claim the same item yourself", what: "Win screen, or loss screen with the real winner + real ms gap" },
      { action: "Run an arm-only fleet, then claim", what: "Brake holds the price; you buy high — the seller's win" },
    ],
  },

  // ── 6 ───────────────────────────────────────────────────
  {
    no: 6,
    title: "List an Item — Seller Flow",
    url: "/sell",
    tagline: "Close the loop: who creates these, with AI help.",
    mins: 1.5,
    script: [
      "Go to /sell (auth-gated). Type an item name, then hit '✨ Draft title, blurb & acts with AI' — fal's any-llm (Gemini Flash) drafts the title, description, and three act highlights. Edit anything before listing.",
      "Pick a product image from the pool (no upload needed for the demo). Set start price, reserve (floor), and duration.",
      "Choose the floor behavior: a floor lottery (a random fully-armed bidder wins at reserve — the seller always sells) or withdraw (taken down unsold, relist later — never sell below your floor).",
      "The fee estimate updates live (spread × 10% + start × 5%). Hit 'Submit listing' — it writes to Aurora DSQL and goes live immediately.",
      "Key message: the engagement mechanics exist to keep claims high on the curve, which is exactly what makes sellers richer.",
    ],
    demo: [
      { action: "Type a name, click '✨ Draft with AI'", what: "Title + blurb + 3 acts fill in (fal / Gemini)" },
      { action: "Pick an image + set prices", what: "Live fee preview; reserve must be below start" },
      { action: "Choose floor: lottery or withdraw", what: "The seller decides what happens at the floor" },
      { action: "Submit the form", what: "Written to Aurora DSQL; appears live in the lobby" },
    ],
  },

  // ── 7 ───────────────────────────────────────────────────
  {
    no: 7,
    title: "Technical Architecture",
    url: null,
    tagline: "The 'why this works globally' moment.",
    mins: 1,
    script: [
      "The price is a deterministic pure function of (start, floor, duration, pauses, demand-brake, server clock) — same inputs, identical price on every device in every timezone, stored nowhere. The brake slows decay as armed demand rises.",
      "Claims are a single conditional UPDATE in Amazon Aurora DSQL — strongly consistent, active-active across regions. Two users claim the same item in the same millisecond; DSQL commits exactly one, the other aborts. The abort is the loss receipt.",
      "Votes are stored individually and deduped by UNIQUE(auction_id, user_id, act_no); armed counts are aggregated from them on read.",
      "Floor resolution is lazy (no cron): when the price reaches the reserve unclaimed, the next state read either runs the lottery or withdraws the item — guarded, so it resolves once.",
      "No websockets: clients poll a ~1 KB state endpoint and compute the price themselves, so a million viewers never touch the database for the falling clock.",
    ],
    demo: [
      { action: "Open DevTools → Network", what: "Light polling; session is server-authoritative, not localStorage" },
      { action: "Point to a DEMAND HOLD badge", what: "Brake is a parameter in the price function — it changes the real decay rate" },
      { action: "Say the price model aloud", what: "Deterministic f(params, clock); demand brake slows it; clamped at reserve" },
      { action: "Mention Aurora DSQL", what: "Multi-region strong consistency — the only honest way to guarantee one winner" },
    ],
  },

  // ── 8 ───────────────────────────────────────────────────
  {
    no: 8,
    title: "Verify: Real Data in Aurora DSQL",
    url: "/admin",
    tagline: "Prove it is not hardcoded.",
    mins: 0.5,
    script: [
      "Go to /admin — the DB browser runs read-only SELECTs directly against Aurora DSQL over an IAM-authenticated connection (admin-gated; no default secret).",
      "Run: SELECT id, title, status, start_price, burn_level FROM auctions ORDER BY created_at DESC. The six demo auctions; burn_level is the live demand-brake level.",
      "Run: SELECT count(*) FROM users — includes accounts created this session. Run: SELECT * FROM wallets LIMIT 5 — real balances, debited on claim.",
      "Key message: nothing is mocked at this layer. The lobby and rooms read the same rows.",
    ],
    demo: [
      { action: "Open /admin", what: "Query browser — SELECT only, semicolons blocked, password_hash stripped" },
      { action: "SELECT id, title, burn_level FROM auctions", what: "Six real rows; brake level visible" },
      { action: "SELECT count(*) FROM users", what: "Includes this session's signups — proves live writes" },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function DemoPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const totalMins = STEPS.reduce((s, step) => s + step.mins, 0);
  const coreMins  = STEPS.slice(0, 5).reduce((s, step) => s + step.mins, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">

        {/* ── Header ── */}
        <div className="mb-10">
          <p className="font-mono text-xs tracking-widest uppercase text-amber mb-2">
            Judge walkthrough
          </p>
          <h1 className="font-sans font-bold text-3xl md:text-4xl text-foreground text-balance">
            {"Schrodinger's Auction"}
            <br />
            <span className="text-muted-foreground font-light text-2xl">Demo script — 8 steps</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-xl text-pretty">
            Follow these steps in order. Each step links directly to the relevant screen.
            Accurate against the live build — all UI labels, button names, and API routes
            match the current implementation.
          </p>

          {/* Time estimates */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Full walkthrough: ~{totalMins} min
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-amber" aria-hidden="true" />
              Core loop (steps 1–5): ~{coreMins} min
            </div>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Start: open lobby
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              DB browser
            </Link>
          </div>
        </div>

        {/* ── Step cards ── */}
        <div className="flex flex-col gap-4">
          {STEPS.map((step) => {
            const isOpen = expanded === step.no;

            return (
              <div
                key={step.no}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Header row — always visible */}
                <button
                  className="w-full flex items-start gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : step.no)}
                  aria-expanded={isOpen}
                >
                  {/* Step number bubble */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center">
                    <span className="font-mono font-bold text-amber text-sm">{step.no}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-bold text-foreground">{step.title}</span>
                      {step.url && (
                        <Link
                          href={step.url}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-amber hover:underline font-mono"
                        >
                          open screen
                          <ChevronRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      )}
                      <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground ml-auto">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        ~{step.mins} min
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{step.tagline}</p>
                  </div>

                  {/* Expand chevron */}
                  <ChevronRight
                    className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform mt-1 ${isOpen ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-border p-5 flex flex-col gap-5">

                    {/* What to say */}
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                        What to say
                      </p>
                      <ul className="flex flex-col gap-2">
                        {step.script.map((line, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed"
                          >
                            <span className="flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                              <span className="font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* What to click */}
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                        What to click
                      </p>
                      <ul className="flex flex-col gap-2">
                        {step.demo.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-xs">
                            <Check
                              className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-drop-green"
                              aria-hidden="true"
                            />
                            <div>
                              <span className="font-semibold text-foreground">{item.action}</span>
                              <span className="text-muted-foreground"> — {item.what}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Quick-reference price model ── */}
        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-3">
            Price model — quick reference
          </p>
          <code className="text-xs font-mono text-foreground block bg-muted rounded-md p-3 leading-relaxed whitespace-pre-wrap">
{`price(t) =
  startPrice
  × (1 − effectiveActiveSeconds / durationSeconds)
  clamped to [reservePrice, startPrice]

effectiveActiveSeconds:
  • excludes pause windows (act spotlights)
  • DEMAND BRAKE slows decay as armed bidders rise:
      brake level 0 → ×1.0   (no demand)
                  1 → ×0.75  (5+ armed)
                  2 → ×0.55  (15+ armed)
                  3 → ×0.4   (30+ armed)
  • the brake is monotonic and stamped with an effective-from time`}
          </code>
        </div>

        {/* ── Footer ── */}
        <div className="mt-10 pt-8 border-t border-border text-center">
          <p className="font-mono text-xs text-muted-foreground">
            {"Schrodinger's Auction"} &mdash; demo build &middot; Amazon Aurora DSQL &middot; Next.js &middot; Vercel
          </p>
        </div>
      </div>
    </div>
  );
}
