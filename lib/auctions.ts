/**
 * lib/auctions.ts — server-side DB readers for the lobby + auction room.
 *
 * The lobby and room render REAL auctions from the DB so the price is anchored
 * to a fixed `starts_at` (deterministic + consistent across refreshes) instead
 * of mock data whose start time is relative to the request. Both readers return
 * null on empty/error so the pages can fall back to mock data for the demo.
 */
import { query } from "@/lib/db";
import type { AuctionSummary, AuctionStatus, FloorAction, ArmedCounts } from "@/lib/types";
import type { AuctionDecayParams, PauseWindow } from "@/lib/price";

/**
 * Real armed-tier counts derived from the votes table (auction_rollups is never
 * written). A bidder's tier = their vote count: 1 vote → tier1, 2 → tier2,
 * 3+ → tier3 (fully armed). Returns a Map keyed by auction id; missing ids = 0s.
 */
export async function fetchArmedCounts(ids: string[]): Promise<Map<string, ArmedCounts>> {
  const map = new Map<string, ArmedCounts>();
  if (ids.length === 0) return map;
  try {
    const { rows } = await query<{ auction_id: string; tier3: string; tier2: string; tier1: string }>(
      `SELECT auction_id,
              SUM(CASE WHEN vc >= 3 THEN 1 ELSE 0 END) AS tier3,
              SUM(CASE WHEN vc  = 2 THEN 1 ELSE 0 END) AS tier2,
              SUM(CASE WHEN vc  = 1 THEN 1 ELSE 0 END) AS tier1
       FROM (
         SELECT auction_id, user_id, COUNT(*) AS vc
         FROM votes
         WHERE auction_id = ANY($1)
         GROUP BY auction_id, user_id
       ) t
       GROUP BY auction_id`,
      [ids]
    );
    for (const r of rows) {
      map.set(r.auction_id, {
        tier3: Number(r.tier3) || 0,
        tier2: Number(r.tier2) || 0,
        tier1: Number(r.tier1) || 0,
      });
    }
  } catch (err) {
    console.error("[lib/auctions] fetchArmedCounts failed:", err);
  }
  return map;
}

export interface AuctionWithActsData extends AuctionSummary {
  acts: { actNo: 1 | 2 | 3; headline: string; detail: string }[];
}

interface AuctionDBRow extends Record<string, unknown> {
  id: string;
  seller_user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  status: string;
  start_price: string;
  reserve_price: string;
  duration_s: number;
  starts_at: string | Date;
  curve: string;
  pause_windows: string | null;
  burn_level: number;
  burn_effective: string | Date | null;
  floor_action: string | null;
  armed_3: number | null;
  armed_2: number | null;
  armed_1: number | null;
  spectators_est: number | null;
}

/** Normalise stored pause windows to the {from, until} shape computePrice needs. */
function normalizePauseWindows(raw: string | null): PauseWindow[] {
  let arr: unknown;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((w): PauseWindow | null => {
      const o = w as { from?: number; until?: number; startS?: number; durationS?: number };
      if (typeof o.from === "number" && typeof o.until === "number") {
        return { from: o.from, until: o.until };
      }
      if (typeof o.startS === "number" && typeof o.durationS === "number") {
        return { from: o.startS, until: o.startS + o.durationS };
      }
      return null;
    })
    .filter((w): w is PauseWindow => w !== null);
}

function rowToSummary(row: AuctionDBRow, nowMs: number): AuctionSummary {
  const decayParams: AuctionDecayParams = {
    startsAtMs: new Date(row.starts_at).getTime(),
    durationS: row.duration_s,
    startPrice: Number(row.start_price),
    reservePrice: Number(row.reserve_price),
    curve: "linear",
    pauseWindows: normalizePauseWindows(row.pause_windows),
    burnLevel: (row.burn_level ?? 0) as 0 | 1 | 2 | 3,
    burnEffectiveAtMs: row.burn_effective ? new Date(row.burn_effective).getTime() : null,
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.image_url,
    category: row.category ?? "Other",
    status: row.status as AuctionStatus,
    startPrice: Number(row.start_price),
    reservePrice: Number(row.reserve_price),
    sellerUserId: row.seller_user_id,
    floorAction: (row.floor_action === "withdraw" ? "withdraw" : "lottery") as FloorAction,
    decayParams,
    armed: { tier3: row.armed_3 ?? 0, tier2: row.armed_2 ?? 0, tier1: row.armed_1 ?? 0 },
    spectatorsEst: row.spectators_est ?? 0,
    serverTimeMs: nowMs,
  };
}

const SELECT_COLS = `
  a.id, a.seller_user_id, a.title, a.description, a.image_url, a.category, a.status,
  a.start_price, a.reserve_price, a.duration_s, a.starts_at,
  a.curve, a.pause_windows, a.burn_level, a.burn_effective, a.floor_action,
  r.armed_3, r.armed_2, r.armed_1, r.spectators_est`;

/** Live auctions for the lobby. Returns null on empty/error → caller falls back to mock. */
export async function fetchLiveAuctions(
  nowMs: number
): Promise<{ auctions: AuctionSummary[]; serverTimeMs: number } | null> {
  try {
    const { rows } = await query<AuctionDBRow>(
      `SELECT ${SELECT_COLS}
       FROM auctions a
       LEFT JOIN auction_rollups r ON r.auction_id = a.id
       WHERE a.status = 'live'
       ORDER BY a.starts_at DESC
       LIMIT 20`
    );
    if (rows.length === 0) return null;
    const armed = await fetchArmedCounts(rows.map((r) => r.id));
    const auctions = rows.map((row) => {
      const s = rowToSummary(row, nowMs);
      const a = armed.get(row.id);
      if (a) s.armed = a;
      return s;
    });
    return { auctions, serverTimeMs: nowMs };
  } catch (err) {
    console.error("[lib/auctions] fetchLiveAuctions failed:", err);
    return null;
  }
}

/** A single auction + its acts for the room. Returns null if missing/error. */
export async function fetchAuctionWithActs(
  id: string,
  nowMs: number
): Promise<AuctionWithActsData | null> {
  try {
    const { rows } = await query<AuctionDBRow>(
      `SELECT ${SELECT_COLS}
       FROM auctions a
       LEFT JOIN auction_rollups r ON r.auction_id = a.id
       WHERE a.id = $1`,
      [id]
    );
    if (rows.length === 0) return null;

    const actsRes = await query<{ act_no: number; headline: string; detail: string | null }>(
      `SELECT act_no, headline, detail FROM acts WHERE auction_id = $1 ORDER BY act_no`,
      [id]
    );
    const acts = actsRes.rows.map((a) => ({
      actNo: a.act_no as 1 | 2 | 3,
      headline: a.headline,
      detail: a.detail ?? "",
    }));

    const summary = rowToSummary(rows[0], nowMs);
    const armed = await fetchArmedCounts([id]);
    const a = armed.get(id);
    if (a) summary.armed = a;
    return { ...summary, acts };
  } catch (err) {
    console.error("[lib/auctions] fetchAuctionWithActs failed:", err);
    return null;
  }
}
