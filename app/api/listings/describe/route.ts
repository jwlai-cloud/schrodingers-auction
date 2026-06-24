/**
 * POST /api/listings/describe
 *
 * Seller-only. Drafts listing copy with fal's any-llm (Gemini Flash under the
 * hood — cheap + fast). Given an item name + category, returns a title, a short
 * blurb, and 3 act highlights. The seller can edit anything before listing.
 *
 * Requires FAL_KEY in the environment (Vercel fal integration sets it).
 */
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

interface DraftCopy {
  title: string;
  description: string;
  acts: [string, string, string];
}

const SYSTEM_PROMPT =
  "You write punchy marketplace copy for a live falling-price auction. " +
  "Given an item name and category, respond with STRICT JSON only — no markdown, no prose, no code fences. " +
  'Shape: {"title": string, "description": string, "acts": [string, string, string]}. ' +
  "Rules: title <= 80 chars and concrete; description 1-2 sentences, <= 180 chars, enticing but honest; " +
  "acts = exactly 3 short seller highlights (<= 70 chars each, no numbering, no leading dash). " +
  "Never invent prices, guarantees, or facts you cannot infer from the name.";

/** Pull the first balanced JSON object out of an LLM response (handles stray fences/text). */
function extractJson(text: string): DraftCopy | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const acts = Array.isArray(obj.acts) ? obj.acts.map((a: unknown) => String(a)).slice(0, 3) : [];
    while (acts.length < 3) acts.push("");
    if (typeof obj.title !== "string" || typeof obj.description !== "string") return null;
    return { title: obj.title.trim(), description: obj.description.trim(), acts: acts as [string, string, string] };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "AI is not configured (missing FAL_KEY)." }, { status: 503 });
  }

  let body: { name?: string; category?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Tell me the item name first." }, { status: 400 });
  }
  const category = (body.category ?? "general").trim();

  try {
    const result = await fal.subscribe("fal-ai/any-llm", {
      input: {
        model: "google/gemini-flash-1.5",
        system_prompt: SYSTEM_PROMPT,
        prompt: `Item: ${name}\nCategory: ${category}`,
      },
    });
    const output = String((result as { data?: { output?: unknown } })?.data?.output ?? "").trim();
    const draft = extractJson(output);
    if (!draft) {
      return NextResponse.json({ error: "AI returned an unexpected format — try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[listings/describe] fal error:", err);
    return NextResponse.json({ error: "AI generation failed — try again." }, { status: 502 });
  }
}
