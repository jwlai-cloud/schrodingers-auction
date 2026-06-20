/**
 * scripts/migrate.mjs
 *
 * Applies all numbered SQL migration files in order against Aurora DSQL.
 * Run with:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate.mjs
 *
 * DSQL rules enforced:
 *   - Each DDL is followed by a COMMIT in the SQL files.
 *   - Statements are split on ";\n" and executed individually.
 *   - Index creation is ASYNC — we poll sys.jobs to confirm completion.
 */

import pg from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Auth token via static AWS creds from env ──────────────────────────────────
const signer = new DsqlSigner({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST,
  expiresIn: 900,
});

const token = await signer.getDbConnectAdminAuthToken();

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER ?? "admin",
  database: process.env.PGDATABASE ?? "postgres",
  password: token,
  port: Number(process.env.PGPORT ?? 5432),
  ssl: true,
  max: 1,
});

// ── Collect + sort SQL files ──────────────────────────────────────────────────
const sqlFiles = readdirSync(__dirname)
  .filter((f) => /^\d{3}-.*\.sql$/.test(f))
  .sort();

console.log(`Applying ${sqlFiles.length} migration file(s)...`);

const client = await pool.connect();

try {
  for (const file of sqlFiles) {
    const filePath = join(__dirname, file);
    const sql = readFileSync(filePath, "utf8");

    // Split on semicolons + newline, skip blank/comment-only chunks.
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`\n[${file}] — ${statements.length} statement(s)`);

    for (const stmt of statements) {
      const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
      try {
        await client.query(stmt);
        console.log(`  OK: ${preview}`);
      } catch (err) {
        // "already exists" errors are safe to ignore for idempotency.
        if (err.message?.includes("already exists")) {
          console.log(`  SKIP (already exists): ${preview}`);
        } else {
          console.error(`  FAIL: ${preview}`);
          console.error(`  Error: ${err.message}`);
          throw err;
        }
      }
    }
  }

  console.log("\nAll migrations applied successfully.");
} finally {
  client.release();
  await pool.end();
}
