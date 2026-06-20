-- 001: Identity + money tables
-- DSQL: one DDL per COMMIT, no FOREIGN KEY, no SERIAL, CREATE INDEX ASYNC only.

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(320) NOT NULL,
    display_name    VARCHAR(60)  NOT NULL,
    region_code     VARCHAR(8),
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS users_email_ux ON users (email);
COMMIT;

CREATE TABLE IF NOT EXISTS wallets (
    user_id         UUID PRIMARY KEY,
    balance         BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE TABLE IF NOT EXISTS ledger_entries (
    id              UUID PRIMARY KEY,
    entry_group     UUID        NOT NULL,
    wallet_user_id  UUID        NOT NULL,
    auction_id      UUID,
    amount          BIGINT      NOT NULL,
    kind            VARCHAR(24) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS ledger_wallet_ix ON ledger_entries (wallet_user_id, created_at);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS ledger_group_ix ON ledger_entries (entry_group);
COMMIT;
