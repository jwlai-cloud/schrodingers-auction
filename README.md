# Schrödinger's Auction

**The falling-price drop platform where the whole world is in the room.**

A Dutch (falling-price) auction, reinvented: the price drops every second, globally synchronized.
Anyone on Earth can claim — but only one person ever does. Until that moment, every spectator,
every armed bidder, every emoji burst is visible to everyone, everywhere, in real time.

> 🏆 Built for **H0: Hack the Zero Stack** (Vercel v0 + AWS Databases) — Track 1: Monetizable B2C.
> Database: **Amazon Aurora DSQL** · Frontend: **Next.js via v0, deployed on Vercel**

---

## The one-line insight

Classic Dutch auctions are *informationally dead* — nothing happens until the single moment
something happens. The century-old Dutch flower clock auctions work because buyers sit in one
room and **see each other**. We rebuilt that room at planetary scale:

- **Visible armed demand** — a strongly consistent, global count of bidders who have earned
  the right to claim. Not eventually-consistent mush: one number, true everywhere.
- **Exactly one winner** — claims from Tokyo and Toronto in the same millisecond resolve to
  one owner, guaranteed by a single atomic transaction in Aurora DSQL.
- **Engagement priced in attention, not money** — bidders *earn* claim rights by watching
  the seller's highlight reveals (no pay-to-bid; this is not a penny auction).

**Why this is a business:** visible armed demand creates price pressure → buyers claim earlier
and higher → sellers earn more → the platform's spread fee grows. Engagement and revenue are
the same lever.

## How to play (30-second version)

1. **Watch** — an item's price falls every second, worldwide. Everyone sees the same price.
2. **Arm** — the seller reveals 3 highlights during the countdown ("acts"). Vote on each one
   you witness. 3 votes = fully armed = instant-claim rights. Fewer votes = claim with a delay.
3. **Claim** — hit the button before anyone else on the planet. One atomic transaction decides.
4. **Floor lottery** — if no one claims before the seller's reserve price, the item goes to a
   random fully-armed bidder who opted in at floor price. The seller always sells.

Full rules: [docs/HOW_TO_PLAY.md](docs/HOW_TO_PLAY.md)

## Revenue model

| Fee | Amount | Paid by | When |
|---|---|---|---|
| Listing fee | flat (e.g. 20 coins) | Seller | At listing, win or lose |
| Base commission | 5% of sale price | Seller | At settlement |
| Spread bonus | 10% of (sale price − reserve) | Seller | At settlement |

The spread bonus aligns the platform with the seller: our engagement mechanics exist to push
the claim *earlier on the price curve*, which is exactly what makes sellers richer.

Demo economy uses **coins** (every account is seeded at signup). Production path: wallet
top-ups via Stripe Connect; the double-entry ledger design is unchanged.

## Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js (scaffolded with v0), Tailwind, deployed on Vercel | The hackathon stack |
| Realtime feel | 1-second polling of edge-cached aggregates (`s-maxage=1`) | A million viewers hit Vercel's cache, not the database |
| Database | **Amazon Aurora DSQL** | Active-active multi-region, strongly consistent SQL, serverless — the claim's fairness guarantee *is* the product |
| Price ticker | Pure client-side function of auction params + server clock offset | The price never touches the database |

Deep dive: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Schema: [db/schema.sql](db/schema.sql)

## Repo layout

```
.
├── README.md                  ← you are here
├── docs/
│   ├── HOW_TO_PLAY.md         ← full game rules (buyers, sellers, spectators)
│   ├── ARCHITECTURE.md        ← system design, diagrams, DSQL patterns, claim txn
│   ├── FEE_MODEL.md           ← monetization math + incentive analysis
│   ├── BUILD_PLAN.md          ← two-week execution plan
│   └── SUBMISSION.md          ← hackathon checklist + 3-min video storyboard
├── db/
│   └── schema.sql             ← Aurora DSQL schema (UUID PKs, no sequences/triggers/FKs)
└── app/                       ← Next.js app (to be scaffolded with v0)
```

## Status

- [x] Concept, mechanics, economics designed
- [x] Architecture + data model designed for DSQL's optimistic concurrency
- [ ] v0 scaffold of core screens (lobby, auction room, seller console)
- [ ] DSQL provisioning + schema apply
- [ ] Claim transaction + vote/reaction ingestion
- [ ] Demo seed data + two-region demo script
- [ ] 3-minute video + 3 bonus blog posts (#H0Hackathon)

## License & disclaimers

Demo project for the H0 Hackathon. Uses demo coins only — no real payments, no real goods.
Production deployment would require marketplace-facilitator legal review (auction regulations
vary by jurisdiction), Stripe Connect for money movement, and KYC at payout. See
[docs/ARCHITECTURE.md → Production hardening](docs/ARCHITECTURE.md#production-hardening-roadmap).
