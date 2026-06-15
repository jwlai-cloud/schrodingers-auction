-- Schrödinger's Auction — Aurora DSQL schema
-- ─────────────────────────────────────────────────────────────────────────────
-- DSQL constraints honoured throughout:
--   • No SERIAL/sequences  → UUID PKs generated app-side
--   • No FOREIGN KEY constraints → referential integrity enforced in app layer
--     (intended references documented as "REF:" comments)
--   • No triggers / no extensions → derived state maintained by app code + cron
--   • Optimistic concurrency → hot paths are insert-only; aggregates have a
--     single writer (the rollup cron); the ONLY intentionally contended write
--     is the auction claim (guarded UPDATE).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Identity ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(320) NOT NULL,
    display_name    VARCHAR(60)  NOT NULL,
    region_code     VARCHAR(8),                  -- coarse region for heatmap (e.g. 'AU-W')
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ASYNC users_email_ux ON users (email);

-- ── Money (demo coins, double-entry) ────────────────────────────────────────
CREATE TABLE wallets (
    user_id         UUID PRIMARY KEY,            -- REF: users.id (also platform pseudo-user)
    balance         BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only journal. Every settlement writes a balanced set of rows
-- (sum of amount over an entry_group = 0). Balances above are a cached view,
-- recomputable from this table at any time.
CREATE TABLE ledger_entries (
    id              UUID PRIMARY KEY,
    entry_group     UUID        NOT NULL,        -- groups the balanced legs of one settlement
    wallet_user_id  UUID        NOT NULL,        -- REF: wallets.user_id
    auction_id      UUID,                        -- REF: auctions.id (nullable: signup grant)
    amount          BIGINT      NOT NULL,        -- +credit / −debit, in coins
    kind            VARCHAR(24) NOT NULL,        -- signup_grant | listing_fee | item_purchase
                                                 -- | item_sale | commission | spread_bonus
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC ledger_wallet_ix  ON ledger_entries (wallet_user_id, created_at);
CREATE INDEX ASYNC ledger_group_ix   ON ledger_entries (entry_group);

-- ── Auctions ────────────────────────────────────────────────────────────────
CREATE TABLE auctions (
    id              UUID PRIMARY KEY,
    seller_user_id  UUID         NOT NULL,       -- REF: users.id
    title           VARCHAR(120) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),

    -- Economics (coins)
    start_price     BIGINT NOT NULL CHECK (start_price > 0),
    reserve_price   BIGINT NOT NULL CHECK (reserve_price >= 0),  -- value hidden from buyers
    listing_fee     BIGINT NOT NULL DEFAULT 20,
    base_fee_bps    INT    NOT NULL DEFAULT 500,   -- 5.00% of sale price
    spread_fee_bps  INT    NOT NULL DEFAULT 1000,  -- 10.00% of (sale − reserve)

    -- Price curve: clients + server compute price(t) from these published params.
    starts_at       TIMESTAMPTZ NOT NULL,
    duration_s      INT         NOT NULL,        -- nominal duration excl. pauses
    curve           VARCHAR(12) NOT NULL DEFAULT 'linear',
    pause_windows   TEXT        NOT NULL DEFAULT '[]',  -- JSON [{from,until}] act spotlights
    burn_level      INT         NOT NULL DEFAULT 0,     -- demand-burn step (rollup cron writes)
    burn_effective  TIMESTAMPTZ,                        -- when current burn_level took effect

    -- Outcome — the guarded-claim target. The whole game is:
    --   UPDATE auctions SET winner_user_id=$u, ...
    --   WHERE id=$a AND winner_user_id IS NULL;
    status          VARCHAR(12) NOT NULL DEFAULT 'listed'
                    CHECK (status IN ('listed','live','claimed','lottery','settled','expired')),
    winner_user_id  UUID,                        -- REF: users.id
    winning_price   BIGINT,
    claimed_at      TIMESTAMPTZ,
    won_via         VARCHAR(8),                  -- 'claim' | 'lottery'

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC auctions_status_ix ON auctions (status, starts_at);
CREATE INDEX ASYNC auctions_seller_ix ON auctions (seller_user_id, created_at);

-- Three highlight "acts" per auction.
CREATE TABLE acts (
    id              UUID PRIMARY KEY,
    auction_id      UUID         NOT NULL,       -- REF: auctions.id
    act_no          SMALLINT     NOT NULL CHECK (act_no IN (1,2,3)),
    headline        VARCHAR(120) NOT NULL,       -- the selling point
    detail          VARCHAR(400),
    media_url       VARCHAR(500),
    reveal_offset_s INT          NOT NULL        -- seconds into the auction at reveal
);
CREATE UNIQUE INDEX ASYNC acts_auction_act_ux ON acts (auction_id, act_no);

-- ── High-volume intent (insert-only ⇒ no hot rows under OCC) ────────────────
CREATE TABLE votes (
    id              UUID        PRIMARY KEY,
    auction_id      UUID        NOT NULL,        -- REF: auctions.id
    user_id         UUID        NOT NULL,        -- REF: users.id
    act_no          SMALLINT    NOT NULL CHECK (act_no IN (1,2,3)),
    via_catchup     BOOLEAN     NOT NULL DEFAULT FALSE,
    region_code     VARCHAR(8),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Idempotency + one-vote-per-act, enforced by the database not the client:
CREATE UNIQUE INDEX ASYNC votes_dedupe_ux ON votes (auction_id, user_id, act_no);
CREATE INDEX ASYNC votes_auction_ix ON votes (auction_id, created_at);

CREATE TABLE reactions (
    id              UUID        PRIMARY KEY,
    auction_id      UUID        NOT NULL,        -- REF: auctions.id
    user_id         UUID        NOT NULL,        -- REF: users.id
    emoji           VARCHAR(8)  NOT NULL,        -- 🔥 👀 💀 🤑 (allow-listed app-side)
    phrase_key      VARCHAR(24),                 -- canned chip id, localized client-side
    region_code     VARCHAR(8),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC reactions_auction_ix ON reactions (auction_id, created_at);

-- Floor-lottery opt-ins (fully-armed bidders only; tier checked at insert AND at draw).
CREATE TABLE lottery_entries (
    id              UUID        PRIMARY KEY,
    auction_id      UUID        NOT NULL,        -- REF: auctions.id
    user_id         UUID        NOT NULL,        -- REF: users.id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ASYNC lottery_dedupe_ux ON lottery_entries (auction_id, user_id);

-- ── Claim audit (every attempt, win or lose) ────────────────────────────────
CREATE TABLE claims (
    id              UUID        PRIMARY KEY,     -- doubles as idempotency key
    auction_id      UUID        NOT NULL,        -- REF: auctions.id
    user_id         UUID        NOT NULL,        -- REF: users.id
    server_price    BIGINT      NOT NULL,        -- price computed in-transaction
    tier            SMALLINT    NOT NULL,        -- votes held at claim time (0–3)
    result          VARCHAR(8)  NOT NULL CHECK (result IN ('won','lost')),
    beaten_by_ms    INT,                         -- loser receipt data
    armed_at_loss   INT,                         -- armed count shown on the receipt
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ASYNC claims_auction_ix ON claims (auction_id, created_at);

-- ── Read-side rollup: ONE row per auction, ONE writer (cron) ────────────────
-- The public state endpoint reads only this row + auctions params.
CREATE TABLE auction_rollups (
    auction_id      UUID PRIMARY KEY,            -- REF: auctions.id
    armed_3         INT NOT NULL DEFAULT 0,      -- fully armed
    armed_2         INT NOT NULL DEFAULT 0,
    armed_1         INT NOT NULL DEFAULT 0,
    spectators_est  INT NOT NULL DEFAULT 0,      -- decayed unique-pollers estimate
    lottery_count   INT NOT NULL DEFAULT 0,
    reactions_5s    TEXT NOT NULL DEFAULT '{}',  -- JSON {emoji: n} last 5 seconds
    regions_5s      TEXT NOT NULL DEFAULT '{}',  -- JSON {region: n} for heatmap pulses
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Operational notes
--   • Rollup cron (1–5s): aggregate votes/reactions/lottery_entries per live
--     auction → upsert auction_rollups; recompute burn_level thresholds and,
--     if crossed, update auctions.burn_level + burn_effective (same single writer).
--   • Lottery cron: for live auctions where price(t) ≤ reserve and no winner,
--     draw uniformly from lottery_entries and execute the standard claim
--     transaction with won_via='lottery' at reserve_price.
--   • Claims are NEVER retried on OCC abort — the abort IS the loss signal.
--     Votes/reactions retry ≤3× with jitter on transient conflicts.
-- ─────────────────────────────────────────────────────────────────────────────
