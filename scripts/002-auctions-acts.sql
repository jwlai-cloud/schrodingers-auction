-- 002: Auctions + acts tables
-- DSQL: one DDL per COMMIT, no FOREIGN KEY, no SERIAL, CREATE INDEX ASYNC only.
-- pause_windows stored as TEXT (JSON array), burn_level as INT.

CREATE TABLE IF NOT EXISTS auctions (
    id              UUID PRIMARY KEY,
    seller_user_id  UUID         NOT NULL,
    title           VARCHAR(120) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),

    start_price     BIGINT NOT NULL,
    reserve_price   BIGINT NOT NULL,
    listing_fee     BIGINT NOT NULL DEFAULT 20,
    base_fee_bps    INT    NOT NULL DEFAULT 500,
    spread_fee_bps  INT    NOT NULL DEFAULT 1000,

    starts_at       TIMESTAMPTZ NOT NULL,
    duration_s      INT         NOT NULL,
    curve           VARCHAR(12) NOT NULL DEFAULT 'linear',
    pause_windows   TEXT        NOT NULL DEFAULT '[]',
    burn_level      INT         NOT NULL DEFAULT 0,
    burn_effective  TIMESTAMPTZ,

    status          VARCHAR(12) NOT NULL DEFAULT 'listed',
    winner_user_id  UUID,
    winning_price   BIGINT,
    claimed_at      TIMESTAMPTZ,
    won_via         VARCHAR(8),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS auctions_status_ix ON auctions (status, starts_at);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS auctions_seller_ix ON auctions (seller_user_id, created_at);
COMMIT;

CREATE TABLE IF NOT EXISTS acts (
    id              UUID PRIMARY KEY,
    auction_id      UUID         NOT NULL,
    act_no          SMALLINT     NOT NULL,
    headline        VARCHAR(120) NOT NULL,
    detail          VARCHAR(400),
    media_url       VARCHAR(500),
    reveal_offset_s INT          NOT NULL
);
COMMIT;

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS acts_auction_act_ux ON acts (auction_id, act_no);
COMMIT;
