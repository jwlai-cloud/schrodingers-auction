-- 003: High-volume intent tables — votes, reactions, lottery_entries
-- DSQL: one DDL per COMMIT, CREATE INDEX ASYNC only.

CREATE TABLE IF NOT EXISTS votes (
    id          UUID      PRIMARY KEY,
    auction_id  UUID      NOT NULL,
    user_id     UUID      NOT NULL,
    act_no      SMALLINT  NOT NULL,
    via_catchup BOOLEAN   NOT NULL DEFAULT FALSE,
    region_code VARCHAR(8),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS votes_dedupe_ux ON votes (auction_id, user_id, act_no);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS votes_auction_ix ON votes (auction_id, created_at);
COMMIT;

CREATE TABLE IF NOT EXISTS reactions (
    id          UUID      PRIMARY KEY,
    auction_id  UUID      NOT NULL,
    user_id     UUID      NOT NULL,
    emoji       VARCHAR(8) NOT NULL,
    phrase_key  VARCHAR(24),
    region_code VARCHAR(8),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS reactions_auction_ix ON reactions (auction_id, created_at);
COMMIT;

CREATE TABLE IF NOT EXISTS lottery_entries (
    id          UUID      PRIMARY KEY,
    auction_id  UUID      NOT NULL,
    user_id     UUID      NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS lottery_dedupe_ux ON lottery_entries (auction_id, user_id);
COMMIT;
