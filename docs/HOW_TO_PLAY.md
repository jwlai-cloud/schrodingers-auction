# How to Play

Schrödinger's Auction is a **falling-price (Dutch) auction** with one twist that changes
everything: the room is visible. You can see, in real time, how many people worldwide are
watching, how many have *armed* themselves with claim rights, and how the crowd feels.

There are three roles: **Spectator**, **Bidder**, and **Seller**.

---

## 1. The auction lifecycle

Every auction follows the same arc:

```
LISTED → LIVE (3 acts) → CLAIMED  → SETTLED
                       ↘ FLOOR LOTTERY → SETTLED
                       ↘ EXPIRED (no claim, no lottery entrants)
```

- **Start price** — set high by the seller (the "are you serious?" price).
- **Reserve (floor) price** — the seller's minimum. Hidden from buyers by default;
  only the *existence* of a floor is shown, never its value.
- **Price curve** — the price falls every second along a published curve
  (linear by default). Everyone on Earth computes the identical price from the same
  auction parameters and a server clock offset — what you see in Perth is what they
  see in Paris, to the second.

### The three acts

The countdown is divided into **three acts**. At each act boundary, the seller's
pre-recorded **highlight** is revealed (a selling point: photo + caption, e.g.
*"Original packaging, never opened"*). During the reveal, the price decay **pauses
for 10 seconds** — a spotlight moment. Drop, reveal, drop, reveal, drop.

---

## 2. Playing as a Bidder

### Step 1 — Arm yourself with votes

You earn claim rights by *witnessing* the auction:

- When a highlight is revealed, a **vote button** appears for the duration of that act.
- Vote once per act. Three acts → up to **three votes**.
- Your vote is public in aggregate: the global **armed counter** ticks up for everyone.

Your votes determine your **claim tier**:

| Votes | Tier | Claim ability |
|---|---|---|
| 3 | 🟢 Fully armed | Instant claim |
| 2 | 🟡 Half-armed | Claim with a 2-second delay |
| 1 | 🟠 Interested | Claim with a 5-second delay |
| 0 | ⚪ Spectator | Cannot claim |

**Late to the party?** If you join after act 1, hit **Catch Up**: a 10-second recap
of the highlights you missed plays, granting you the missed votes. You can always
reach fully-armed status — but the recap costs you 10 seconds while the price keeps
falling for everyone else. Time is the currency.

### Step 2 — Read the room

The auction screen shows you, live and globally consistent:

- **Armed counter** — how many bidders hold claim rights right now, by tier.
- **Spectator count** — `2,341 watching · 47 armed`. A big gap says *wait*;
  a closing gap says *move*.
- **World heatmap** — where votes and reactions are coming from, pulsing live.
- **Demand brake** — as armed bidders cross milestones (5 / 15 / 30), the price
  decay **slows down** (×0.75 → ×0.55 → ×0.4). Visible demand props the price up,
  so a hot item holds high instead of fire-selling. The HOLD level is shown next
  to the price. (Voting is deliberate: you can only vote for an act once it's been
  revealed, and there's a short cooldown between votes.)

### Step 3 — Claim (or gamble on the floor)

- **Claim** — one button. The first valid claim transaction to commit, anywhere on
  the planet, wins. Your tier delay (if any) is enforced server-side. If someone
  beats you by a millisecond, you get the **loser receipt**:
  *"Claimed from under 47 armed bidders — you were 0.4s away."*
- **At the floor — the lister's choice.** When listing, the seller picks what happens
  if the price reaches the reserve unclaimed:
  - **Floor lottery** — one fully-armed bidder is drawn at random and buys at the
    floor. The seller always sells; patient armed bidders get a second game.
  - **Withdraw** — the item is taken down unsold (reserve not met) and can be
    relisted later. The seller is never forced to sell below their floor.

### Wallet

Every account is seeded with demo **coins** at signup. A claim atomically debits
your wallet and credits the seller (minus platform fees) in a single ledger
transaction — no claim ever succeeds with insufficient balance.

---

## 3. Playing as a Spectator

No votes? Still part of the show:

- Tap **reaction emoji** (🔥 👀 💀 🤑) — they burst over the price curve and pulse
  the world heatmap, aggregated by region.
- Drop **phrase chips** — pre-written, localized one-liners
  (*"holding 💎"*, *"too rich for me"*, *"claim it already!"*).
- Your presence counts: the spectator number is part of the information game
  bidders are reading.

---

## 4. Playing as a Seller

1. **List an item** — title, photos, description, and **three highlights**
   (one per act). Pay the flat **listing fee** (charged win or lose — it funds the
   floor-lottery settlement guarantee).
2. **Set your prices** — start price, reserve (floor) price, and total duration.
   The act boundaries and price curve are generated for you.
3. **Go live** — share the link. You don't perform, you don't stream; the mechanism
   sells for you.
4. **Get paid** — on claim or floor-lottery settlement, your wallet is credited:
   `sale price − 5% base commission − 10% × (sale price − reserve)`.

**Pricing strategy tips**

- A *low* reserve widens the spread — you pay more spread bonus on a high claim,
  but a wide curve gives the demand-pressure mechanics room to work, which is what
  drives early, high claims.
- A *high* reserve protects your downside but compresses the drama; if nobody claims
  and nobody enters the lottery, the listing expires and the listing fee is sunk.
- Your highlights are your three moments of stage time. Make them escalate:
  good → better → "I need this."

---

## 5. Fairness guarantees (why you can trust the numbers)

- **One price, everywhere.** The price is a deterministic function of published
  auction parameters and server time — not a per-region feed that can drift.
- **One winner, ever.** The claim is a single conditional transaction in a strongly
  consistent, multi-region database (Amazon Aurora DSQL). Simultaneous claims from
  different continents cannot both succeed — the database, not a race, decides.
- **The armed counter is real.** Votes are individually recorded, deduplicated per
  account per act, and aggregated with strong consistency. The number you panic
  about is the truth.
- **Server-authoritative time.** Claim ordering uses the transaction's commit, never
  your device clock. A slow phone doesn't disqualify you; a hacked clock doesn't help you.

---

## 6. Quick FAQ

**Is this a penny auction?** No. Penny auctions sell bids for money (and have been
treated as gambling in several jurisdictions). Here, claim rights are earned with
*attention* — votes are free and capped at three.

**Can I see the reserve price?** No — only that one exists. The mystery is the game.
(*Schrödinger's*: until claimed, the final price is every price on the curve at once.)

**What if I claim at the same instant as someone else?** One of the two transactions
commits; the other aborts and receives the loser receipt. There is no tie.

**What happens to my coins if my claim loses?** Nothing — the debit only occurs
inside a *winning* claim transaction. Losing costs you nothing but pride.
