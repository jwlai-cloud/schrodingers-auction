# Build Plan — 18 days to submission

Deadline: **June 29, 2026 @ 5:00 pm PDT** (≈ June 30, 8:00 am AWST).
Credits request form due **June 26, 12 pm PT** — do this on Day 1, supplies limited.

## Principles

- Claim transaction first; pixels second. The fairness demo is the submission.
- Every feature must appear in the 3-minute video or be cut.
- Blog posts are written *as the work happens* (0.2 bonus points each, max 0.6).

## Schedule

### Days 1–2 — Foundations
- [ ] Register on Devpost; submit AWS + v0 credits form (deadline risk!)
- [ ] Provision Aurora DSQL cluster (two regions); apply `db/schema.sql`
- [ ] Next.js skeleton via v0; repo, envs, Vercel project (capture **Team ID** now)
- [ ] Auth (email magic link) + signup coin grant via ledger

### Days 3–5 — The core transaction
- [ ] Server price function (curve + pause windows + burn level) shared server/client
- [ ] **Claim endpoint**: guarded UPDATE + ledger settlement, idempotency key,
      OCC-abort → loser receipt mapping
- [ ] Two-terminal concurrency test: scripted simultaneous claims from two regions —
      exactly one winner, every run (this becomes video footage + blog post #1)
- [ ] Vote endpoint (insert-only, unique dedupe) + tier computation

### Days 6–8 — The room
- [ ] State endpoint + edge caching (`s-maxage=1`); client polling loop + clock offset
- [ ] Rollup cron (armed counts by tier, spectators estimate, reactions/regions 5s)
- [ ] Reactions endpoint + emoji bursts; canned phrase chips
- [ ] Demand burn thresholds wired into price function

### Days 9–11 — Seller & lifecycle
- [ ] Seller console: list item, 3 highlight acts, prices; listing fee charge
- [ ] Act spotlight pauses + reveal UX; late-joiner catch-up flow
- [ ] Floor lottery: opt-in toggle + draw cron settling via claim transaction
- [ ] Settlement receipt screen (fee breakdown from real ledger rows)

### Days 12–13 — Polish (Design criterion)
- [ ] v0 pass on the auction room: price curve animation, world heatmap, armed
      counter drama, loser receipt moment
- [ ] Lobby/gallery of live auctions; mobile layout check
- [ ] Seed script: ~12 demo listings with staggered start times so judges always
      land on a live auction (auto-relist cron for the judging window)

### Days 14–15 — Submission assets
- [ ] Record 3-min video per storyboard (SUBMISSION.md)
- [ ] Architecture diagram export (from ARCHITECTURE.md mermaid → PNG)
- [ ] Screenshots: Vercel storage configuration (DSQL proof) — **required**
- [ ] Submission text: tracks, database statement up front (Stage One is
      automated/AI-assisted — keywords must be explicit)

### Days 16–17 — Bonus points + buffer
- [ ] Blog #1: "A game whose referee is a serialization conflict" (claim txn deep dive)
- [ ] Blog #2: "Surviving optimistic concurrency: insert-only crowds on Aurora DSQL"
- [ ] Blog #3: "Realtime for a million viewers with zero websockets on Vercel"
- [ ] Each must state it was created for the hackathon + #H0Hackathon
- [ ] Judge dry-run: incognito browser, fresh account, claim an item in <60s

### Day 18 — Submit
- [ ] Final deploy freeze; submit with margin (timezone: AWST is 15h ahead of PDT)

## Cut line (if behind, drop in this order)
1. Free-text anything (already out of scope)
2. Reputation badges
3. Catch-up recap (fall back: tier delays only)
4. Demand burn (fall back: static curve)
— Never cut: claim transaction, votes/tiers, rollup counters, seller listing, video.
