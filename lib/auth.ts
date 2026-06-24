/**
 * lib/auth.ts — minimal session-cookie auth helpers.
 * No external library — just crypto + DSQL sessions table.
 */
import { cookies } from "next/headers";
import { query, withConnection } from "./db";
import { createHash, randomBytes } from "crypto";

export const SESSION_COOKIE = "sca_session";
export const DEMO_COINS = 50_000;

export function hashPassword(password: string): string {
  // Simple SHA-256 with a fixed salt prefix — good enough for demo.
  // Production: use bcrypt or argon2.
  return createHash("sha256")
    .update("sca:" + password)
    .digest("hex");
}

export function makeSessionId(): string {
  return randomBytes(32).toString("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  balance: number;
}

/** Read the session cookie and return the user, or null. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { rows } = await query<Record<string, unknown>>(
    `SELECT u.id, u.email, u.display_name, w.balance
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN wallets w ON w.user_id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionId]
  );

  if (!rows[0]) return null;
  return {
    id: rows[0].id as string,
    email: rows[0].email as string,
    displayName: rows[0].display_name as string,
    balance: Number(rows[0].balance ?? 0),
  };
}

/** Create a new session row and return the session ID. */
export async function createSession(userId: string): Promise<string> {
  const sessionId = makeSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt.toISOString()]
  );
  return sessionId;
}

/** Sign up a new user. Returns sessionId on success, throws on conflict. */
export async function signUp(
  email: string,
  displayName: string,
  password: string
): Promise<string> {
  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  await withConnection(async (client) => {
    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [userId, email.toLowerCase().trim(), displayName.trim(), passwordHash]
    );
    await client.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, $2)`,
      [userId, DEMO_COINS]
    );
  });

  return createSession(userId);
}

/** Sign in. Returns sessionId on success, null on bad credentials. */
export async function signIn(
  email: string,
  password: string
): Promise<string | null> {
  const passwordHash = hashPassword(password);
  const { rows } = await query<Record<string, unknown>>(
    `SELECT id FROM users WHERE email = $1 AND password_hash = $2 LIMIT 1`,
    [email.toLowerCase().trim(), passwordHash]
  );
  if (!rows[0]) return null;
  return createSession(rows[0].id as string);
}

/** Delete the session row (sign out). */
export async function deleteSession(sessionId: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}
