-- 005: Add category to auctions, sessions table for auth, password_hash to users
-- DSQL: one DDL per COMMIT, CREATE INDEX ASYNC only.

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'Other';
COMMIT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);
COMMIT;

CREATE TABLE IF NOT EXISTS sessions (
    id              VARCHAR(64) PRIMARY KEY,
    user_id         UUID        NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;

CREATE INDEX ASYNC IF NOT EXISTS sessions_user_ix ON sessions (user_id, expires_at);
COMMIT;
