# Schrödinger's Auction

**The falling-price drop platform where the whole world is in the room.**

A Dutch (falling-price) auction, reinvented. The price of a listed item drops every second, globally synchronized — every viewer on Earth sees the same number. Anyone can claim the item, but only one person ever does. Until that moment, every spectator, every armed bidder, every emoji burst is visible to everyone, everywhere.

> Built for **H0: Hack the Zero Stack** (Vercel v0 + AWS Databases) — Track 1: Monetizable B2C.
> Database: **Amazon Aurora DSQL** — Next.js via v0, deployed on Vercel.

---

## Quick links

| | |
|---|---|
| Live demo | [schrodingers-auction.vercel.app](https://schrodingers-auction.vercel.app) |
| Judge walkthrough | `/demo` — 8-step accordion script, ~10 min full / ~7 min core loop |
| DB browser | `/admin` — live SELECT queries against Aurora DSQL |
| Lobby | `/` |
| Sell | `/sell` |

---

## The one-line insight

Classic Dutch auctions are *informationally dead* — nothing happens until the single moment something happens. The century-old Dutch flower clock auctions work because buyers sit in one room and **see each other**. We rebuilt that room at planetary scale:

- **Visible armed demand** — a strongly consistent, global count of bidders who have earned the right to claim. Not eventually-consistent mush: one number, true everywhere.
- **Exactly one winner** — claims from Tokyo and Toronto in the same millisecond resolve to one owner, guaranteed by a single atomic `UPDATE ... WHERE winner_user_id IS NULL` in Aurora DSQL.
- **Engagement priced in attention, not money** — bidders *earn* claim rights by watching the seller's highlight reveals. This is not a penny auction.

**Why this is a business:** visible armed demand creates price pressure → buyers claim earlier and higher → sellers earn more → the platform's spread fee grows. Engagement and revenue are the same lever.

---

## How to play

1. **Watch** — an item's price falls every second, worldwide. Everyone sees the same price at all times.
2. **Arm** — the seller reveals 3 highlights during the countdown ("acts"). Vote on each one once it's revealed (one vote at a time — a short cooldown keeps it deliberate). 3 votes = fully armed = instant-claim rights. Fewer votes = delayed claim. As more bidders arm, a **demand brake** slows the price drop, so hot items hold a high price.
3. **Claim** — press the button before anyone else on the planet. One atomic transaction decides the winner.
4. **At the floor** — the lister chooses what happens if no one claims before the reserve price: a **floor lottery** (a random fully-armed bidder wins at reserve — the seller always sells) or **withdraw** (the item is taken down unsold and can be relisted).

Full rules: [docs/HOW_TO_PLAY.md](docs/HOW_TO_PLAY.md)

---

## Running locally

```bash
git clone https://github.com/jwlai-cloud/schrodingers-auction
cd schrodingers-auction
pnpm install
```

Create `.env.development.local` with your Aurora DSQL credentials (see [Vercel → Settings → Vars]):

```
AURORA_DSQL_ENDPOINT=<your-cluster-endpoint>
AURORA_DSQL_REGION=<region>
AUTH_SECRET=<random-32-char-string>
```

```bash
pnpm dev            # starts on http://localhost:3000
```

Seed the database (first run only) — admin-gated. Authenticate as an `ADMIN_EMAILS`
user, or pass the `ADMIN_SECRET` you set in the environment via the `x-admin-secret`
header (there is no default secret):

```
curl -X POST https://<your-app>/api/admin/seed -H "x-admin-secret: $ADMIN_SECRET"
```

---

## Repo layout

```
.
├── README.md
├── docs/
│   ├── HOW_TO_PLAY.md          full game rules
│   ├── ARCHITECTURE.md         system design, DSQL patterns, claim transaction
│   ├── FEE_MODEL.md            monetization math + incentive analysis
│   ├── BUILD_PLAN.md           execution plan
│   └── SUBMISSION.md           hackathon checklist + video storyboard
├── app/
│   ├── page.tsx                Lobby (server component + LobbyClient filter)
│   ├── auctions/[id]/page.tsx  Auction room (server component)
│   ├── sell/page.tsx           Listing form
│   ├── demo/page.tsx           Judge walkthrough — 8-step accordion
│   ├── admin/page.tsx          DB browser (SELECT-only)
│   └── api/
│       ├── auctions/           GET list, POST create, GET [id]/state
│       ├── auth/               signup, signin, signout, me
│       ├── votes/              POST — records a vote, derives tier
│       ├── claims/             POST — guarded DSQL claim transaction
│       ├── reactions/          POST — emoji burst logging
│       └── admin/              seed, migrate, query (dev only)
├── components/
│   ├── AuctionRoom.tsx         Full auction room UI (votes, claim, reactions)
│   ├── AuctionCard.tsx         Lobby grid card with live price ticker
│   ├── FeaturedAuction.tsx     Hottest-right-now hero banner
│   ├── LobbyClient.tsx         Client-side category filter + sort
│   ├── Navbar.tsx              Auth state, wallet balance, global armed count
│   ├── AuthModal.tsx           Sign in / Create account overlay
│   ├── PriceTicker.tsx         Live falling price display
│   └── LiveBadge.tsx           Animated LIVE indicator
└── lib/
    ├── price.ts                Deterministic price function (no DB reads)
    ├── auth.ts                 Session cookie helpers (bcrypt + pg)
    ├── db.ts                   Aurora DSQL connection via @aws-sdk/dsql-signer
    ├── types.ts                Shared TypeScript types
    └── utils.ts                cn() and small utilities
```

---

## Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, scaffolded with v0 | Hackathon stack |
| Deployment | Vercel | Edge network + seamless Next.js integration |
| Database | **Amazon Aurora DSQL** | Active-active multi-region, strongly consistent SQL, serverless — the one-winner guarantee *is* the product |
| Auth | Custom session cookies + bcrypt | No third-party dependency; session stored in Aurora DSQL |
| Price ticker | Pure client-side function (`lib/price.ts`) | Same params + server clock → identical price on every device, no DB reads |
| Realtime feel | 500ms client polling + server clock offset | A million viewers never touch the database for price reads |

---

## Key technical decisions

### Why Aurora DSQL

The claim transaction requires **strong consistency across regions** — two simultaneous claims must not both succeed. Aurora DSQL's active-active replication with OCC (optimistic concurrency control) gives us:

1. A single `UPDATE ... WHERE winner_user_id IS NULL` that commits in exactly one region, aborting the other with a serialization conflict.
2. The abort *is* the loser receipt — no polling, no separate lock table.
3. Votes are insert-only rows (no hot row updates), avoiding OCC conflicts on the ledger.

### Deterministic price function

```
price(t) = startPrice × (1 − effectiveActiveS / durationS)
           clamped at reservePrice
```

`effectiveActiveS` excludes pause windows (act spotlight moments) and applies the **demand brake**: as armed bidders cross milestones (5 / 15 / 30), the decay rate is *slowed* by ×0.75 / ×0.55 / ×0.4 from the moment the brake takes effect — so demand props the price up instead of fire-selling. The function is pure — same parameters on client and server produce the same price with no coordination.

### No websockets

Clients poll `/api/auctions/:id/state` every 500ms. The response is ~1 KB and served from Vercel's edge cache at `s-maxage=1`. A million viewers generate approximately one origin request per second per auction.

---

## Revenue model

| Fee | Amount | Paid by | When |
|---|---|---|---|
| Listing fee | 20 coins flat | Seller | At listing |
| Base commission | 5% of sale price | Seller | At settlement |
| Spread bonus | 10% of (sale − reserve) | Seller | At settlement |

The spread bonus aligns the platform with the seller: our engagement mechanics exist to push claims earlier on the price curve, which makes sellers richer and grows our fee.

Full model: [docs/FEE_MODEL.md](docs/FEE_MODEL.md)

---

## Demo accounts

| Email | Password | Notes |
|---|---|---|
| `demo@schrodinger.test` | `Demo1234!` | Pre-seeded, 50,000 coins |

Or create a fresh account at `/` — every new account receives 50,000 demo coins.

---

## Build status

- [x] Concept, mechanics, economics designed
- [x] Architecture + data model designed for DSQL's optimistic concurrency
- [x] Aurora DSQL provisioned + schema applied
- [x] Seed data: 6 demo auctions with stable UUIDs
- [x] Lobby with live price tickers, category filter, featured banner
- [x] Auction room: live price, demand-HOLD badge, act spotlight, vote, claim
- [x] Auth: signup / signin / signout / session polling
- [x] Sell page: full listing form → POST to Aurora DSQL
- [x] Claims transaction: guarded UPDATE, double-entry ledger, win/loss screens
- [x] Votes: insert-only, DSQL-safe pre-check deduplication, tier derivation
- [x] Admin DB browser: live SELECT queries at `/admin` (gated; no default secret)
- [x] Demo script: 8-step judge walkthrough at `/demo`
- [x] Deployed to Vercel
- [x] Real armed-tier counts (1/2/3 votes) computed from the votes table
- [x] Demand brake: more armed → slower decay; urgency copy escalates with demand
- [x] Deliberate voting: votes gated to revealed acts + short cooldown
- [x] Floor behavior per listing: floor lottery **or** withdraw-unsold + relist
- [x] Live-demo tooling: bot races (claim or arm-only) + 20-min refresh cron

---

## License & disclaimers

Demo project for the H0 Hackathon. Uses demo coins only — no real payments, no real goods. Production deployment would require marketplace-facilitator legal review (auction regulations vary by jurisdiction), Stripe Connect for money movement, and KYC at payout.
