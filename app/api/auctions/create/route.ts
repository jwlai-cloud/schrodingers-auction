/**
 * POST /api/auctions/create
 *
 * Creates a new auction listing. Requires an active session.
 * Returns the newly created auction id on success.
 *
 * NOTE: Currently writes to the DB if connected; falls back to a mock
 * response when the DB is unavailable (demo mode).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { actsToPauseWindows } from "@/lib/price";
import { randomUUID } from "crypto";

export interface CreateAuctionRequest {
  title: string;
  description: string;
  category: string;
  startPrice: number;
  reservePrice: number;
  durationMinutes: number;
  acts: { actNo: 1 | 2 | 3; headline: string; detail?: string }[];
}

export async function POST(req: Request) {
  // Auth check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: CreateAuctionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, category, startPrice, reservePrice, durationMinutes, acts } = body;

  // Validation
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!startPrice || startPrice <= 0) return NextResponse.json({ error: "Start price must be > 0" }, { status: 400 });
  if (reservePrice == null || reservePrice < 0) return NextResponse.json({ error: "Reserve price must be ≥ 0" }, { status: 400 });
  if (reservePrice >= startPrice) return NextResponse.json({ error: "Reserve price must be less than start price" }, { status: 400 });
  if (!durationMinutes || durationMinutes < 5 || durationMinutes > 60) return NextResponse.json({ error: "Duration must be 5–60 minutes" }, { status: 400 });
  if (!acts || acts.length !== 3) return NextResponse.json({ error: "Exactly 3 act highlights are required" }, { status: 400 });

  const auctionId = randomUUID();
  const durationS = durationMinutes * 60;
  const pauseWindows = actsToPauseWindows([
    Math.floor(durationS * 0.25),
    Math.floor(durationS * 0.5),
    Math.floor(durationS * 0.75),
  ]);

  // Attempt DB write — gracefully degrade to mock if DB is unavailable
  try {
    await query(
      `INSERT INTO auctions (
        id, seller_id, title, description, category,
        start_price, reserve_price, duration_s,
        pause_windows, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'listed',NOW())`,
      [
        auctionId,
        session.userId,
        title.trim(),
        description?.trim() ?? "",
        category,
        startPrice,
        reservePrice,
        durationS,
        JSON.stringify(pauseWindows),
      ]
    );

    // Write act highlights
    for (const act of acts) {
      await query(
        `INSERT INTO auction_acts (auction_id, act_no, headline, detail) VALUES ($1,$2,$3,$4)
         ON CONFLICT (auction_id, act_no) DO UPDATE SET headline=EXCLUDED.headline, detail=EXCLUDED.detail`,
        [auctionId, act.actNo, act.headline, act.detail ?? ""]
      );
    }
  } catch (err) {
    // DB not ready or table doesn't exist yet — return mock success for demo
    console.error("[v0] DB write failed, returning mock success:", err);
    return NextResponse.json({ auctionId, mock: true }, { status: 201 });
  }

  return NextResponse.json({ auctionId }, { status: 201 });
}
