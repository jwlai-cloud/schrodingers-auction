# Architecture Decision Records

Lightweight log of the significant, hard-to-reverse decisions behind Schrödinger's
Auction. Each record is **Context → Decision → Consequences**. Newest decisions may
supersede older ones; superseding is noted inline.

| # | Decision | Status |
|---|---|---|
| 0001 | Price is a deterministic, stateless function of the clock | Accepted |
| 0002 | The claim is one guarded UPDATE; the OCC abort is the loss | Accepted |
| 0003 | Demand **brake** (demand slows decay), replacing demand burn | Accepted — supersedes the "burn accelerates decay" design |
| 0004 | Floor behavior is the lister's choice: lottery **or** withdraw | Accepted |
| 0005 | Floor resolution is lazy (on read), not a cron | Accepted |
| 0006 | Voting is act-gated + cooldown (deliberate arming) | Accepted |
| 0007 | Armed counts are computed from `votes` on read | Accepted — supersedes the rollup-cron plan |
| 0008 | Lobby + room read the DB directly and are `force-dynamic` | Accepted |
| 0009 | Admin routes: session-email allowlist + secret header, no default | Accepted |
| 0010 | Demo stays live via bot races + a GitHub Actions refresh cron | Accepted |
| 0011 | AI listing copy via fal `any-llm` (Gemini Flash); images from a pool | Accepted |

---

## ADR 0001 — Price is a deterministic, stateless function of the clock
**Context.** A globally synchronized falling price for a million viewers can't be a
hot DB row or a websocket fan-out.
**Decision.** `price(t) = f(start, floor, duration, pauses, brake, serverClock)`, a
pure function in `lib/price.ts` run identically on client and server. No "current
price" is stored. Clients poll a ~1 KB state endpoint and compute locally.
**Consequences.** Infinite read scale; price holds across refresh; the clock never
touches the DB. The cost is that any demand-driven change must be modeled as a
parameter with an effective-from timestamp (see 0003), not a stored value.

## ADR 0002 — The claim is one guarded UPDATE; the OCC abort is the loss
**Context.** Simultaneous claims from anywhere must resolve to exactly one owner.
**Decision.** `UPDATE auctions SET winner=… WHERE id=$ AND winner_user_id IS NULL AND
status='live'`. `rowCount===1` wins; an Aurora DSQL optimistic-concurrency
serialization conflict at commit is treated as a loss. Claims are never retried.
**Consequences.** The database is the referee — no lock service, no queue. Idempotency
keys make double-clicks safe. The fairness guarantee is the product.

## ADR 0003 — Demand brake (demand slows decay), replacing demand burn
**Context.** The original "burn" accelerated decay at demand milestones. The seller is
better served by *holding* a high price when demand is visibly hot.
**Decision.** Reuse `burn_level` as a **brake**: at 5/15/30 armed bidders the decay
multiplier drops to ×0.75 / ×0.55 / ×0.4 (slower), stamped with `burn_effective`. The
votes and bot routes ratchet the level **up only** (monotonic → price stays
deterministic). UI badges read `DEMAND HOLD ×0.x`.
**Consequences.** Demand becomes price support; sellers earn more on hot items.
Supersedes the README/HOW_TO_PLAY "burn accelerates" framing. Because computePrice
applies a single effective-from step, intermediate levels are approximated, not integrated.

## ADR 0004 — Floor behavior is the lister's choice: lottery or withdraw
**Context.** "Seller always sells" (floor lottery) and "never sell below my floor"
(withdraw) are both legitimate and mutually exclusive at the floor.
**Decision.** A per-auction `floor_action` ∈ {`lottery`, `withdraw`}, chosen on the
sell form. `lottery` draws a random fully-armed entrant at reserve and settles via the
claim path; `withdraw` sets `status='unsold'` (relistable via `/api/auctions/[id]/relist`).
**Consequences.** Sellers control downside. The README's unconditional "always sells"
is now one of two options.

## ADR 0005 — Floor resolution is lazy (on read), not a cron
**Context.** Aurora DSQL has no triggers/cron; the floor must resolve without a scheduler.
**Decision.** `resolveFloorIfNeeded()` runs inside the `state` read: if price ≤ reserve,
unclaimed, and live, it resolves per `floor_action` with a guarded UPDATE. The room
polls state, so it resolves within ~4s of hitting the floor.
**Consequences.** No infra. A GET has a (guarded, idempotent) side effect — acceptable
for this scale; revisit if read volume makes it wasteful.

## ADR 0006 — Voting is act-gated + cooldown (deliberate arming)
**Context.** Mashing a button to instant-armed cheapens "earn the right to claim."
**Decision.** A vote for act N is rejected (425) until act N is revealed
(`starts_at + reveal_offset_s`); a 10s cooldown (429) sits between votes. Act 1 reveals
immediately; acts 2/3 unlock later. Bots bypass the API (they insert directly).
**Consequences.** Arming is paced by the auction timeline. Live demos arm a fleet via
the bot race rather than waiting out cooldowns.

## ADR 0007 — Armed counts are computed from `votes` on read
**Context.** `auction_rollups` was never written, so armed counts read as 0.
**Decision.** Compute tier counts from `votes` (votes-per-user → tier) in
`fetchArmedCounts`, used by the lobby, room, and state endpoint.
**Consequences.** Counts are always truthful with no writer/cron. Supersedes the
rollup-cron plan. Cost is a small aggregate query per read (fine at demo scale).

## ADR 0008 — Lobby + room read the DB directly and are `force-dynamic`
**Context.** Pages first rendered hardcoded mock auctions with request-relative start
times, so the price reset on every refresh and the lobby never matched the room.
**Decision.** `lib/auctions` reads seeded DB rows (fixed `starts_at`); pages are
`force-dynamic` so `serverTimeMs` is fresh; mock is fallback only. `/api/auctions` is
`no-store` (stale cache read as "price jumping").
**Consequences.** Price holds across refresh; lobby == room. Pages aren't edge-cached
(acceptable — the heavy read path is the client-computed price, not the page).

## ADR 0009 — Admin routes: session-email allowlist + secret header, no default
**Context.** A debug SQL/seed surface on a public URL is a takeover risk.
**Decision.** `isAdmin()` allows a session whose email is in `ADMIN_EMAILS`, or a
matching `x-admin-secret`/`?secret` **only if `ADMIN_SECRET` is set** (no hardcoded
default). The query endpoint is SELECT-only, rejects `;`, and strips `password_hash`.
**Consequences.** Fails closed if env is unset. The machine cron uses the secret header
(kept out of URLs/logs).

## ADR 0010 — Demo stays live via bot races + a GitHub Actions refresh cron
**Context.** Seeded items decay to the floor; a solo tester can't create a real race.
**Decision.** `POST /api/admin/bots` provisions real users that arm (and optionally
claim) at random ms offsets — a genuine DSQL race. `POST /api/admin/refresh-demo`
re-lists `is_demo` items with staggered fresh starts; a GitHub Actions cron (on the
default branch) calls it every 20 min over HTTPS — Vercel holds the AWS creds.
**Consequences.** The lobby self-heals; the brake + claim race are demoable solo.
GitHub schedules only run from the default branch, so the default branch is the v0 branch.

## ADR 0011 — AI listing copy via fal `any-llm` (Gemini Flash); images from a pool
**Context.** Sellers want help writing copy; AI image generation costs money per call.
**Decision.** `POST /api/listings/describe` calls fal `any-llm` with
`google/gemini-flash-1.5` to draft title + blurb + 3 acts (seller edits before listing).
Images are **picked from a fixed pool** (server allow-listed) — no generation cost.
Requires `FAL_KEY`; degrades to a clear "AI not configured" message if absent.
**Consequences.** One provider/key (fal), cheap text, zero image-gen spend. Swapping the
model is a one-line change in the describe route.
