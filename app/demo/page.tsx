/**
 * app/demo/page.tsx — Interactive demo script / judge walkthrough.
 */
import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const STEPS = [
  {
    no: 1,
    title: "The Lobby",
    url: "/",
    tagline: "Show the room before anything else.",
    script: [
      "Open the lobby. Six live auctions, prices falling in real time — every viewer on earth sees the same number.",
      "Point to the hot item at the top: highest spectator count, BURN multiplier active. The mechanic is legible without explanation.",
      "Filter by category. Notice the bar is sticky — the auctions update instantly, no page reload.",
      "Key message: this is a spectator sport before it is an auction.",
    ],
    demo: [
      { action: "Point at the featured item banner", what: "Hottest Right Now section — BURN ×1.35 badge, live armed count" },
      { action: "Click a category filter", what: "Grid updates to show only Gaming or Electronics" },
      { action: "Watch the price ticker", what: "Every card ticks down live — same number, globally consistent" },
    ],
  },
  {
    no: 2,
    title: "Create an Account",
    url: null,
    tagline: "30 seconds from zero to armed.",
    script: [
      "Click 'Sign in' top right. Switch to 'Create account'. Pick any name, email, password.",
      "On success: wallet shows 50,000 demo coins. No card, no friction.",
      "This is the trust moment: you see your coins, you feel the stakes.",
    ],
    demo: [
      { action: "Click Sign in → Create account", what: "AuthModal opens, two fields, one button" },
      { action: "Submit the form", what: "Navbar updates instantly: green coin balance appears" },
    ],
  },
  {
    no: 3,
    title: "Enter an Auction Room",
    url: "/auctions/11111111-0000-0000-0000-000000000002",
    tagline: "The Zelda Switch — biggest crowd, two burn levels active.",
    script: [
      "Click the Nintendo Switch OLED card. You land in the auction room.",
      "Left side: product image with emoji reaction layer. Right side: the engine.",
      "Price is falling live. The progress bar drains left to right. Floor is hidden — Schrodinger.",
      "Armed status panel shows three act slots: empty. You cannot claim yet.",
    ],
    demo: [
      { action: "Open the Nintendo Switch room", what: "Full-screen room: price, armed status, claim button disabled" },
      { action: "Tap a reaction emoji", what: "Emoji floats up over the image — crowd feel" },
      { action: "Show the armed panel", what: "Three act slots empty — must earn votes to claim" },
    ],
  },
  {
    no: 4,
    title: "Arm Yourself (Votes)",
    url: null,
    tagline: "Attention is the currency.",
    script: [
      "When the price hits an act boundary, a spotlight banner appears and the price freezes for 10 seconds.",
      "A 'Vote' button appears. One click = one vote for that act. Three acts = three possible votes.",
      "For the demo: use the 'Demo: simulate vote' button to earn votes out of turn.",
      "Watch the armed panel: slots fill green. Tier 3 = instant claim. Tier 2 = 2s delay. Tier 1 = 5s delay.",
      "The global armed counter in the header ticks up — every vote is public information.",
    ],
    demo: [
      { action: "Click 'Demo: simulate vote' three times", what: "All three act slots turn green. Tier 3 — instant claim." },
      { action: "Read the arm status text", what: "'3 votes — instant claim. You are fully armed.'" },
      { action: "Point to global armed counter", what: "Header shows armed count — real aggregate, not fake" },
    ],
  },
  {
    no: 5,
    title: "Claim",
    url: null,
    tagline: "One button. One winner, ever.",
    script: [
      "CLAIM NOW button is now amber and active. The price is live below it.",
      "Hit CLAIM NOW. If fully armed (tier 3): zero delay, instant server submission.",
      "The server evaluates: is this the first commit? Yes → won screen. No → loser receipt.",
      "Demo win screen: 'You claimed it.' Price, product name. Coins debited.",
      "Demo loss screen: '0.4 seconds.' You were beaten. The number makes the near-miss feel real.",
      "Key message: one database transaction, globally consistent, no tie possible.",
    ],
    demo: [
      { action: "Watch the price fall for 10 seconds", what: "Tension. Price is dropping. You are armed." },
      { action: "Hit CLAIM NOW", what: "Instant submission — no delay for tier 3" },
      { action: "Show win or loss screen", what: "Either outcome is dramatic and informative" },
    ],
  },
  {
    no: 6,
    title: "List an Item (Seller Flow)",
    url: "/sell",
    tagline: "Close the loop — show who creates these auctions.",
    script: [
      "Navigate to /sell or click 'List item' in the header.",
      "Walk through the form: title, description, category, start price, reserve (floor), duration slider.",
      "Point to the fee calculator: it updates live as you type prices. Transparent economics.",
      "Write three act highlights. Explain: these are your three moments of stage time during the live auction.",
      "Submit. Confirmation screen shows the listing summary and coins reserved.",
    ],
    demo: [
      { action: "Fill in a real item you own", what: "Title, category, start 500, reserve 80, 15 min" },
      { action: "Type prices and watch fee calc", what: "Live preview: 'You receive X coins'" },
      { action: "Write 3 highlights and submit", what: "Confirmation screen: listing accepted, 20 coins reserved" },
    ],
  },
  {
    no: 7,
    title: "Technical Architecture",
    url: null,
    tagline: "The 'why this works globally' moment.",
    script: [
      "The price is a deterministic pure function. Same auction parameters + server clock = identical price on every device, in every timezone, with no coordination.",
      "Claims are a single conditional UPDATE transaction in Amazon Aurora DSQL — a distributed SQL database with strong consistency across regions.",
      "This means two users in Sydney and Stockholm cannot both win. One transaction commits, one aborts. Not a queue, not a race — the database decides.",
      "Votes are individually stored and deduplicated. The armed counter you panic about is the truth.",
      "No penny-auction mechanics: votes are earned with attention (watching acts), not purchased. Three votes maximum per user per auction.",
    ],
    demo: [
      { action: "Open DevTools → Network", what: "Show /api/auth/me polling — session is real, server-authoritative" },
      { action: "Mention Aurora DSQL", what: "Multi-region strong consistency — the claim guarantee" },
      { action: "Point at price formula", what: "price(t) = start × (1 - elapsed/duration) × burnMultiplier, clamped at reserve" },
    ],
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-xs tracking-widest uppercase text-amber mb-2">Judge walkthrough</p>
          <h1 className="font-sans font-bold text-3xl md:text-4xl text-foreground text-balance">
            Schrodinger&apos;s Auction
            <br />
            <span className="text-muted-foreground font-light text-2xl">Demo script</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-xl text-pretty">
            Follow these seven steps in order. Each step links directly to the relevant screen.
            Estimated runtime: 8 minutes for a full walkthrough, 4 minutes for the core loop (steps 1–5).
          </p>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              Start: open lobby <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link href="/sell" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm">
              Seller flow
            </Link>
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-6">
          {STEPS.map((step) => (
            <div key={step.no} className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Step header */}
              <div className="flex items-start gap-4 p-5 border-b border-border">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center">
                  <span className="font-mono font-bold text-amber text-sm">{step.no}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-mono font-bold text-foreground">{step.title}</h2>
                    {step.url && (
                      <Link
                        href={step.url}
                        className="flex items-center gap-1 text-xs text-amber hover:underline font-mono"
                        target="_blank"
                      >
                        open screen <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">{step.tagline}</p>
                </div>
              </div>

              {/* Script */}
              <div className="p-5 flex flex-col gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">What to say</p>
                  <ul className="flex flex-col gap-2">
                    {step.script.map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
                        <span className="flex-shrink-0 mt-1 w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                          <span className="font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">What to click</p>
                  <ul className="flex flex-col gap-2">
                    {step.demo.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-xs">
                        <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-drop-green" />
                        <div>
                          <span className="font-semibold text-foreground">{item.action}</span>
                          <span className="text-muted-foreground"> — {item.what}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8 border-t border-border text-center">
          <p className="font-mono text-xs text-muted-foreground">
            Schrodinger&apos;s Auction — demo build &middot; Aurora DSQL &middot; Next.js 14
          </p>
        </div>
      </div>
    </div>
  );
}
