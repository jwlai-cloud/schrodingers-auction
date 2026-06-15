# Submission Pack — H0 Hackathon

Track: **1 — Monetizable B2C app** (ecommerce/retail). Database: **Amazon Aurora DSQL**.
Deadline: June 29, 2026, 5:00 pm PDT.

## Required checklist (from official rules)

- [ ] Text description — features + functionality; **state the database in the first
      paragraph** (Stage One screening may be automated/AI-assisted)
- [ ] Demo video **< 3 minutes**, public on YouTube; explains the problem, who it's
      for, the database used; shows the working app; **no third-party trademarks or
      copyrighted music** (fictional demo products; royalty-free or no music)
- [ ] Which database(s) used — Aurora DSQL, stated explicitly
- [ ] Architecture diagram (export from docs/ARCHITECTURE.md)
- [ ] Published Vercel project link (public, free, no restrictions — judges must be
      able to test through the entire Judging Period, ends July 24)
- [ ] Vercel **Team ID**
- [ ] Screenshot: **storage configuration proving AWS database usage**
- [ ] Built/substantially updated during the Submission Period (keep commit history —
      organizers may request evidence of work done in-period)
- [ ] Bonus content ×3 published publicly, each stating it was created for this
      hackathon, tagged **#H0Hackathon** (0.2 pts each, max 0.6 — on a 1–5.6 scale)

## Submission text — opening paragraph (draft)

> Schrödinger's Auction is a falling-price (Dutch) auction marketplace built on
> **Amazon Aurora DSQL** with a **Next.js frontend generated in v0 and deployed on
> Vercel**. The price of an item drops every second, globally synchronized; bidders
> earn claim rights by watching the seller's highlight reveals, the worldwide count
> of "armed" bidders is displayed with strong consistency, and exactly one claim ever
> succeeds — enforced by a single guarded transaction in Aurora DSQL's active-active
> multi-region engine. Sellers list without streaming; the mechanism sells for them.

## 3-minute video storyboard

| Time | Scene | On screen | Voiceover beat |
|---|---|---|---|
| 0:00–0:20 | Hook | Price ticking down over an item; armed counter at 47 | "Dutch auctions are a century old — and informationally dead. Nothing happens until the one moment something happens. We put the room back in." |
| 0:20–0:50 | Problem & customer | Whatnot-style streaming vs. our listing flow | "Live shopping proved drops sell — if you'll perform on camera for hours. Schrödinger's Auction is the drop platform for sellers with no audience and no camera." |
| 0:50–1:30 | Gameplay | Act reveal → spotlight pause → vote → tier badge → emoji bursts on world heatmap → demand burn accelerates the curve | "Bidders earn claim rights with attention, not money. Everyone sees the same price and the same armed count — everywhere on Earth." |
| 1:30–2:10 | **The money shot** | Split screen: two browsers, two AWS regions, simultaneous CLAIM. One wins; the other gets the loser receipt "0.4s away" | "Two continents, one millisecond apart. Aurora DSQL's multi-region strong consistency commits exactly one claim — the serialization conflict *is* the game's referee." |
| 2:10–2:35 | Business + settlement | Settlement receipt: sale price, 5% base, 10% spread bonus, seller net — real ledger rows | "Visible demand makes buyers claim earlier and higher. Sellers earn more; our spread fee grows with theirs. Engagement is the revenue model." |
| 2:35–3:00 | Architecture + close | Architecture diagram; storage config screenshot; floor lottery flash | "Price never touches the database. Reads hit Vercel's edge; only intent writes. One guarded UPDATE decides everything. Schrödinger's Auction — until it's claimed, it's every price at once." |

## Bonus content plan (3 × 0.2 pts)

1. **"A game whose referee is a serialization conflict"** — the claim transaction,
   OCC aborts as gameplay, two-region demo. (builder.aws.com)
2. **"Insert-only crowds: surviving optimistic concurrency on Aurora DSQL"** — the
   hot-row trap, votes as inserts, single-writer rollups. (dev.to)
3. **"Realtime for a million viewers with zero websockets"** — deterministic price
   functions + 1-second edge caching on Vercel. (Medium or LinkedIn)

## Judge experience checklist

- [ ] Landing page → live auction in ≤2 clicks; an auction is *always* live
      (auto-relist cron through July 24)
- [ ] Fresh account: signup → coins granted → vote → claim possible in <60 seconds
- [ ] Loser receipt reachable (seed a bot claimer at low prices so judges can
      experience losing a race too)
- [ ] Testing instructions in submission: demo accounts, what to try, expected results
