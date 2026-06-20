-- 004: Claims audit table + read-side rollup
-- DSQL: one DDL per COMMIT, CREATE INDEX ASYNC only.

CREATE TABLE IF NOT EXISTS claims (
    id            UUID      PRIMARY KEY,
    auction_id    UUID      NOT NULL,
    user_id       UUID      NOT NULL,
    server_price  BIGINT    NOT NULL,
    tier          SMALLINT  NOT NULL,
    result        VARCHAR(8) NOT NULL,
    beaten_by_ms  INT,
    armed_at_loss INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS claims_auction_ix ON claims (auction_id, created_at);
COMMIT;

CREATE TABLE IF NOT EXISTS auction_rollups (
    auction_id    UUID PRIMARY KEY,
    armed_3       INT NOT NULL DEFAULT 0,
    armed_2       INT NOT NULL DEFAULT 0,
    armed_1       INT NOT NULL DEFAULT 0,
    spectators_est INT NOT NULL DEFAULT 0,
    lottery_count INT NOT NULL DEFAULT 0,
    reactions_5s  TEXT NOT NULL DEFAULT '{}',
    regions_5s    TEXT NOT NULL DEFAULT '{}',
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
