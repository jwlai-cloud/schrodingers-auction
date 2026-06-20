"use client";

/**
 * app/demo/page.tsx — Interactive judge walkthrough / demo script.
 * Kept accurate against the actual live build (AuctionRoom, Navbar, sell form, auth).
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
      "Open the lobby at /. Six live auctions, prices falling in real time — every viewer on earth sees the same number.",
      "The hero strip reads: 'The price falls. One person claims it.' Three how-it-works chips explain the mechanic without a paragraph of copy.",
      "The 'Hottest right now' featured banner picks the auction with the most spectators — currently the Lego Bugatti Chiron at 6,750 watching with BURN ×1.6. Point to the BURN badge: demand from armed bidders has accelerated the decay.",
      "Click a category filter chip (e.g. 'Gaming'). The grid updates instantly — no page reload, no spinner. That is a client-side state change in LobbyClient.",
      "Key message: this is a spectator sport before it is an auction. The crowd numbers are not decorations — they are part of the information game.",
    ],
    demo: [
      {
        action: "Point to the featured banner",
        what: "Lego Bugatti — 6,750 watching, BURN ×1.6 badge, live falling price",
      },
      {
        action: "Click 'Gaming' filter chip",
        what: "Grid instantly narrows to Nintendo Switch OLED only — no reload",
      },
      {
        action: "Watch any price ticker",
        what: "Price ticks down every second — same number globally",
      },
      {
        action: "Point to the Navbar",
        what: "Global armed count (amber shield) + watching count — live aggregates",
      },
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
      "The default tab is 'Sign in'. Click 'No account? Sign up' to switch to registration.",
      "Fill in: display name, email, password. Hit 'Create account'.",
      "On success: the modal closes, the Navbar coin balance lights up green — 50,000 demo coins. No card, no friction.",
      "Auth state is polled every 3 seconds so any component already open (like an auction room) updates immediately without a page reload.",
    ],
    demo: [
      {
        action: "Click 'Sign in' in the Navbar",
        what: "AuthModal opens — two fields, 'Sign in' button",
      },
      {
        action: "Click 'No account? Sign up'",
        what: "Form adds a 'Display name' field; button becomes 'Create account'",
      },
      {
        action: "Submit the form",
        what: "Modal closes; Navbar shows green coin balance and 'Sign out'",
      },
    ],
  },

  // ── 3 ───────────────────────────────────────────────────
  {
    no: 3,
    title: "Enter an Auction Room",
    url: "/auctions/11111111-0000-0000-0000-000000000005",
    tagline: "Lego Bugatti Chiron — most watched, BURN ×1.6 active.",
    mins: 1.5,
    script: [
      "Click the Lego Bugatti Chiron card (or the featured banner). You land in the auction room.",
      "Left column: product image with LIVE + BURN ×1.6 badges overlaid. Four emoji reaction buttons below. Live stats: watching count, armed count, your tier.",
      "Right column: live price card with falling number, amber progress bar draining left-to-right, and 'floor hidden' label — Schrodinger's reserve.",
      "Below the price: the arm status panel. Three act boxes, all showing their act number in grey — empty. The claim button reads 'Sign in to claim' (if signed out) or 'Must arm first' (if signed in, 0 votes).",
      "Key message: the room communicates everything without a tutorial. The grey boxes say 'earn this'. The falling number says 'you have limited time'.",
    ],
    demo: [
      {
        action: "Open the Lego Bugatti room from the lobby",
        what: "LIVE badge, BURN ×1.6 badge on image; arm panel shows 3 empty grey boxes",
      },
      {
        action: "Tap a reaction emoji (e.g. 🔥)",
        what: "Emoji floats up over the product image — crowd atmosphere",
      },
      {
        action: "Point to the price progress bar",
        what: "'floor hidden' label — reserve is Schrodinger until claimed",
      },
      {
        action: "Show the claim button",
        what: "Grey 'Must arm first' if signed in with 0 votes; amber 'Sign in to claim' if signed out",
      },
    ],
  },

  // ── 4 ───────────────────────────────────────────────────
  {
    no: 4,
    title: "Arm Yourself",
    url: null,
    tagline: "Attention is the currency. Three votes, three act slots.",
    mins: 1.5,
    script: [
      "In a live auction, a vote button appears during each act spotlight (when the price pauses for 10 seconds). One click per act. Three acts = up to three votes.",
      "For this demo, use the 'Demo: simulate vote (0/3)' button at the bottom of the arm panel to earn votes on demand — without waiting for an act boundary.",
      "Click it once: Act 1 slot turns green. Tier 1 — 5s delay on claim.",
      "Click again: Act 2 turns green. Tier 2 — 2s delay.",
      "Click a third time: Act 3 turns green. 'CLAIM NOW' button turns amber. '3 votes — instant claim. You are fully armed.'",
      "Each vote also reveals the seller's act highlight below the product image. Point to the revealed 'Act 1', 'Act 2', 'Act 3' cards as they appear.",
      "Key message: the global armed counter in the Navbar ticks up — every vote is public information. That number is the pressure gauge.",
    ],
    demo: [
      {
        action: "Click 'Demo: simulate vote (0/3)' once",
        what: "Act 1 box goes green; tier label: '1 vote — 5s delay on claim'",
      },
      {
        action: "Click twice more in succession",
        what: "All three boxes green; 'CLAIM NOW' turns amber; '3 votes — instant claim'",
      },
      {
        action: "Scroll down on the left column",
        what: "'Revealed so far' section shows all three act highlight cards",
      },
      {
        action: "Point to armed count in stats row",
        what: "Live armed count — real aggregated vote data, not cosmetic",
      },
    ],
  },

  // ── 5 ───────────────────────────────────────────────────
  {
    no: 5,
    title: "Claim",
    url: null,
    tagline: "One button. One winner, ever.",
    mins: 1.5,
    script: [
      "'CLAIM NOW' is amber and full-width. The current price is displayed live below it.",
      "If tier 3 (fully armed): claim is instant. The moment you press, the request fires.",
      "If tier 2 (2 votes): a countdown appears — '2... 1...' — then the request fires. The price keeps falling for everyone else during your countdown.",
      "The server evaluates: status = live, winner_user_id IS NULL, price > reserve, balance >= price. The first transaction to commit wins.",
      "Win screen: 'You claimed it.' — item name, price in coins. Coins debited.",
      "Loss screen: '0.4 seconds.' — 'Someone on the other side of the planet was faster. You were one of N armed — they got it.'",
      "Key message: one guarded UPDATE transaction across a multi-region Aurora DSQL cluster. Two simultaneous claims, one commit, one abort — the database is the referee.",
    ],
    demo: [
      {
        action: "Watch the price fall for 10 seconds",
        what: "Tension — you are fully armed, price dropping, others watching",
      },
      {
        action: "Hit 'CLAIM NOW' (tier 3 — instant)",
        what: "No delay; 'Submitting...' flash, then win or loss screen",
      },
      {
        action: "Show the win screen",
        what: "'You claimed it.' — item name, price, 'Back to lobby' link",
      },
      {
        action: "Or show the loss screen",
        what: "'0.4 seconds.' — the precision makes the near-miss feel real",
      },
    ],
  },

  // ── 6 ───────────────────────────────────────────────────
  {
    no: 6,
    title: "List an Item — Seller Flow",
    url: "/sell",
    tagline: "Close the loop: show who creates these auctions.",
    mins: 1.5,
    script: [
      "Navigate to /sell or click 'List item' in the Navbar (top-right, visible on desktop).",
      "The form is auth-gated: if not signed in, a banner appears with a 'Sign in' button. Sign in required before submission.",
      "Fill in: item title, description, category (8 options), start price, reserve (floor) price, duration (slider: 5–60 min).",
      "The fee estimate updates live: formula is spread × 10% + start × 5%. Point to it: transparent economics, no surprises.",
      "Write three act highlights — one sentence each. These are your three moments of stage time. The escalation pattern works best: good → better → 'I need this.'",
      "Hit 'Submit listing'. The form POST goes to /api/auctions/create which writes to Aurora DSQL. Confirmation screen shows the listing accepted.",
      "Flat listing fee: 20 coins, charged on submission win or lose.",
    ],
    demo: [
      {
        action: "Navigate to /sell via 'List item' in Navbar",
        what: "Full listing form; auth banner visible if signed out",
      },
      {
        action: "Set start 500, reserve 80 — watch the fee estimate",
        what: "Live preview: spread = 420, fee = 420×0.1 + 500×0.05 = 67 coins",
      },
      {
        action: "Write 3 act highlights (escalating)",
        what: "Act 1: condition; Act 2: rarity; Act 3: 'never been opened'",
      },
      {
        action: "Submit the form",
        what: "'Listing submitted' confirmation screen — 20 coins reserved",
      },
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
      "The price is a deterministic pure function: price(t) = startPrice × (1 − elapsed/duration) × burnMultiplier, clamped at reserve. Same parameters + server clock = identical price on every device in every timezone with no coordination.",
      "Claims are a single conditional UPDATE in Amazon Aurora DSQL — a distributed SQL database with strongly consistent active-active replication across regions.",
      "'Two users in Sydney and Stockholm claim the same item in the same millisecond. DSQL commits exactly one. The other aborts with an OCC serialization conflict.' That abort is the loss receipt.",
      "Votes are individually stored and deduplicated by UNIQUE(auction_id, user_id, act_no). The armed counter you panic about is the truth.",
      "No websockets needed: clients poll /api/auctions/:id/state every second. The response is ~1 KB and served from the Vercel edge cache at s-maxage=1. A million viewers generate ~1 origin request per second per auction.",
    ],
    demo: [
      {
        action: "Open DevTools → Network tab",
        what: "/api/auth/me polling every 3s — session is server-authoritative, not localStorage",
      },
      {
        action: "Point to the BURN ×1.6 badge",
        what: "Burn level is a parameter in the price function, not a CSS effect — it changes the actual price",
      },
      {
        action: "Say the price formula aloud",
        what: "price(t) = start × (1 − elapsed/duration) × burnMultiplier, clamped at reserve",
      },
      {
        action: "Mention Aurora DSQL",
        what: "Multi-region strong consistency — the only way the one-winner guarantee is honest",
      },
    ],
  },

  // ── 8 ───────────────────────────────────────────────────
  {
    no: 8,
    title: "Verify: Real Data in Aurora DSQL",
    url: "/admin",
    tagline: "Prove it is not hardcoded. The data is live in the database.",
    mins: 0.5,
    script: [
      "Navigate to /admin — the DB browser. This runs SELECT queries directly against Aurora DSQL via the @aws-sdk/dsql-signer IAM-authenticated connection.",
      "Run: SELECT id, title, status, start_price FROM auctions ORDER BY created_at DESC LIMIT 6. You will see the six seeded demo auctions.",
      "Run: SELECT count(*) FROM users. Shows the accounts created during this demo session.",
      "Run: SELECT * FROM wallets LIMIT 5. Shows real coin balances — debited on claim, credited on listing.",
      "Key message: nothing is mocked at this layer. The lobby uses the same data in production.",
    ],
    demo: [
      {
        action: "Open /admin",
        what: "DB query browser — SELECT only, no destructive queries possible",
      },
      {
        action: "Run: SELECT id, title FROM auctions ORDER BY created_at DESC",
        what: "Six rows — the seed data is real Aurora DSQL rows, not hardcoded JSON",
      },
      {
        action: "Run: SELECT count(*) FROM users",
        what: "Count includes any accounts created during this demo — proves live writes",
      },
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

        {/* ── Quick-reference price formula ── */}
        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-3">
            Price formula — quick reference
          </p>
          <code className="text-xs font-mono text-foreground block bg-muted rounded-md p-3 leading-relaxed whitespace-pre-wrap">
{`price(t) =
  startPrice
  × (1 − elapsedActiveSeconds / durationSeconds)
  × burnMultiplier(burnLevel)
  clamped to [reservePrice, startPrice]

burnMultiplier: 0 → 1.0 | 1 → 1.15 | 2 → 1.35 | 3 → 1.6
pauseWindows:   price decay pauses at act 1/4, 1/2, 3/4 marks (10s each)`}
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
