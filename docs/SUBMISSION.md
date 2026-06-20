# Submission Pack — H0 Hackathon

Track: **1 — Monetizable B2C app** (ecommerce/retail). Database: **Amazon Aurora DSQL**.
Deadline: June 29, 2026, 5:00 pm PDT.

## Required checklist

- [x] Text description — features + functionality; database stated in first paragraph
- [x] Demo video < 3 minutes, public on YouTube (see storyboard below)
- [x] Which database(s) used — **Amazon Aurora DSQL**, stated explicitly
- [x] Architecture diagram — `docs/ARCHITECTURE.md` + `docs/architecture.mermaid`
- [x] Published Vercel project link — live and accessible through the judging period
- [x] Vercel Team ID — in project settings
- [x] Screenshot: storage configuration proving AWS database usage
- [x] Built/substantially updated during the Submission Period (full commit history on `v0/jwlai-cloud-53e1559c`)
- [ ] Bonus content ×3 published publicly, tagged **#H0Hackathon**

## Submission text — opening paragraph

> Schrödinger's Auction is a falling-price (Dutch) auction marketplace built on
> **Amazon Aurora DSQL** with a **Next.js frontend generated in v0 and deployed on
> Vercel**. The price of an item drops every second, globally synchronized; bidders
> earn claim rights by watching the seller's highlight reveals, the worldwide count
> of "armed" bidders is displayed with strong consistency, and exactly one claim ever
> succeeds — enforced by a single guarded `UPDATE ... WHERE winner_user_id IS NULL`
> transaction in Aurora DSQL's active-active multi-region engine. Sellers list without
> streaming; the mechanism sells for them.

## 3-minute video storyboard

| Time | Scene | On screen | Voiceover |
|---|---|---|---|
| 0:00–0:20 | Hook | Price ticking down over an item; armed counter at 47 | "Dutch auctions are a century old — and informationally dead. Nothing happens until the one moment something happens. We put the room back in." |
| 0:20–0:50 | Problem | Listing form, no camera required | "Live shopping proved drops sell — if you'll perform on camera for hours. Schrödinger's Auction is the drop platform for sellers with no audience and no camera." |
| 0:50–1:30 | Gameplay | Act reveal → spotlight pause → vote → tier badge → emoji bursts → demand burn badge | "Bidders earn claim rights with attention, not money. Everyone sees the same price and the same armed count — everywhere on Earth." |
| 1:30–2:10 | The money shot | Split screen: two browsers, simultaneous CLAIM. One wins; the other gets '0.4 seconds.' | "Two continents, one millisecond apart. Aurora DSQL's multi-region strong consistency commits exactly one claim — the serialization conflict is the game's referee." |
| 2:10–2:35 | Business | Settlement receipt: sale price, 5% base, 10% spread bonus, seller net | "Visible demand makes buyers claim earlier and higher. Sellers earn more; our spread fee grows with theirs. Engagement is the revenue model." |
| 2:35–3:00 | Architecture | Architecture diagram; /admin DB browser; price formula | "Price never touches the database. One guarded UPDATE decides everything. Schrödinger's Auction — until it's claimed, it's every price at once." |

## Bonus content plan (3 × 0.2 pts)

1. **"A game whose referee is a serialization conflict"** — the claim transaction, OCC aborts as gameplay, two-region demo. (builder.aws.com)
2. **"Insert-only crowds: surviving optimistic concurrency on Aurora DSQL"** — the hot-row trap, votes as inserts, single-writer rollups. (dev.to)
3. **"Realtime for a million viewers with zero websockets"** — deterministic price functions + 1-second edge caching on Vercel. (Medium or LinkedIn)

## Judge experience checklist

- [x] Landing page → live auction in ≤2 clicks
- [x] Fresh account: signup → 50,000 coins in < 30 seconds
- [x] Vote 3 times → fully armed → CLAIM NOW button turns amber
- [x] Claim flow: win screen ("You claimed it.") or loss screen ("0.4 seconds.")
- [x] Sell flow: fill form → submit → listing written to Aurora DSQL
- [x] DB browser at /admin proves data is real Aurora DSQL rows
- [x] Demo script at /demo — 8-step walkthrough matches live UI exactly

## Testing instructions for judges

1. Open the live URL.
2. Click any auction card to enter a room.
3. Click "Sign in" in the Navbar → "No account? Sign up". Enter any email + password.
4. The Navbar shows 50,000 coins. You are ready to vote and claim.
5. In the auction room, click "Vote for Act 1 (0/3)" three times to arm yourself.
6. Once fully armed (3 green act boxes), click "CLAIM NOW".
7. To see the loss screen: open two browser windows, arm both, and race yourself.
8. To verify real DB data: navigate to /admin and run `SELECT id, title FROM auctions`.
9. To list an item: navigate to /sell, fill the form, and submit.
10. Full walkthrough: navigate to /demo — the 8-step accordion covers every screen.
