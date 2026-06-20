/**
 * lib/db.ts
 *
 * Aurora DSQL connection pool using IAM authentication via awsCredentialsProvider.
 * The DsqlSigner generates a short-lived token (<15 min) per connection.
 *
 * DSQL constraints observed throughout the codebase:
 *   - No SERIAL — use gen_random_uuid() or IDENTITY
 *   - No FOREIGN KEY — referential integrity enforced in app layer
 *   - No triggers — logic lives in route handlers
 *   - CREATE INDEX ASYNC only
 *   - One DDL per transaction
 */

import { Pool, type ClientBase } from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";

const signer = new DsqlSigner({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION! },
  }),
  region: process.env.AWS_REGION!,
  hostname: process.env.PGHOST!,
  expiresIn: 900,
});

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER ?? "admin",
  database: process.env.PGDATABASE ?? "postgres",
  // Token is regenerated per-connection — safe to cache up to 15 min.
  password: () => signer.getDbConnectAdminAuthToken(),
  port: Number(process.env.PGPORT ?? 5432),
  ssl: true,
  max: 20,
});

attachDatabasePool(pool);

/** Execute a single parameterized query (auto-committed). */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[]
) {
  // Cast through `any` so pg's QueryResultRow constraint is satisfied while
  // still giving callers a typed result. Row shapes in route handlers must
  // extend Record<string, unknown>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pool.query<T & Record<string, any>>(text, params);
}

/**
 * Acquire a connection from the pool for multi-statement transactions.
 * The caller is responsible for BEGIN / COMMIT / ROLLBACK.
 */
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
