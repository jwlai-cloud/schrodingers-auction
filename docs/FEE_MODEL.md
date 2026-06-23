# Fee Model & Incentive Analysis

All amounts in **coins** (demo currency; production = real currency via Stripe Connect,
identical ledger design).

## The three fees

| Fee | Formula | Charged | Purpose |
|---|---|---|---|
| **Listing fee** | flat `20` | At listing, non-refundable | Funds the settlement guarantee (floor lottery infra); deters spam listings |
| **Base commission** | `5% × sale_price` | At settlement | Baseline marketplace take |
| **Spread bonus** | `10% × (sale_price − reserve_price)` | At settlement | The alignment fee — see below |

Seller net proceeds:

```
net = sale_price − 0.05·sale_price − 0.10·(sale_price − reserve)
    = 0.85·sale_price + 0.10·reserve
```

## Worked example

Item listed: start `1,000`, reserve `400`.

| Outcome | Sale price | Base 5% | Spread 10% | Platform take | Seller net |
|---|---|---|---|---|---|
| Early claim (demand pressure worked) | 800 | 40 | 40 | **80** (+20 listing) | 720 |
| Late claim | 500 | 25 | 10 | **35** (+20) | 465 |
| Floor lottery | 400 | 20 | 0 | **20** (+20) | 380 |
| Expired (no lottery entrants) | — | — | — | **20** listing only | −20 |

Note the gradient: the platform earns **4×** more on an early claim than at the floor.
Every engagement mechanic (visible armed demand, spotlight acts, the demand brake) exists to
keep claims high on the price curve — which simultaneously maximizes seller revenue.
**Engagement, seller income, and platform income are the same lever.** That is the
monetization pitch in one sentence.

## Incentive edge cases (considered, with counterweights)

| Gaming vector | Counterweight |
|---|---|
| Seller sets reserve ≈ start price to shrink the spread fee | A compressed curve kills the drama → fewer armed bidders → higher expiry risk, and the listing fee is sunk on expiry. The market punishes it before we have to. |
| Seller shill-arms alt accounts to inflate demand | Demo: email verification + per-account vote cap. Production: payment-verified arming, vote-velocity anomaly detection. (Documented in ARCHITECTURE → hardening.) |
| Bidder camps at the floor instead of claiming | The floor lottery converts campers into guaranteed-sale liquidity — randomization means camping isn't a strategy, it's a raffle ticket. |
| Buyer claims then refuses payment | Impossible by construction: the wallet debit is *inside* the claim transaction. Insufficient balance ⇒ the claim itself fails. |

## Why no pay-to-bid (deliberate legal positioning)

Penny-auction platforms monetize by selling bids; several jurisdictions treat that as
gambling. Here, claim rights are earned with **attention** (watching highlight acts),
are free, and are capped at three. The platform's revenue comes solely from seller-side
fees on completed sales — a conventional marketplace model (eBay/Whatnot category),
not a wagering one.
