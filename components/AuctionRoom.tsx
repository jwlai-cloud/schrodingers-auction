"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  Eye, Shield, Flame, ArrowLeft, Zap, Check, X, Trophy, LogIn,
} from "lucide-react";
import { PriceTicker } from "./PriceTicker";
import { LiveBadge } from "./LiveBadge";
import { AuthModal } from "./AuthModal";
import { cn } from "@/lib/utils";
import { computePrice, votesToTier, tierDelaySeconds } from "@/lib/price";
import type { AuctionWithActs } from "@/app/auctions/[id]/page";

interface AuctionRoomProps {
  auction: AuctionWithActs;
  serverTimeMs: number;
  /** The signed-in user's existing vote count (so arming survives leaving + returning). */
  initialVotes?: number;
}

type ClaimState = "idle" | "submitting" | "won" | "lost";

const REACTIONS = ["🔥", "👀", "💀", "🤑"] as const;

// Demand-brake badge: higher demand slows the drop (multiplier < 1).
const BURN_LABEL: Record<number, string | null> = {
  0: null, 1: "DEMAND HOLD ×0.75", 2: "DEMAND HOLD ×0.55", 3: "DEMAND HOLD ×0.4",
};

/** Escalating urgency copy driven by how many bidders are armed. */
function armedHeat(total: number): { line: string; tone: "hot" | "warm" | "cool" } {
  if (total >= 50) return { line: `🔥 ${total} armed — this sells any second. Claim now or lose it.`, tone: "hot" };
  if (total >= 20) return { line: `⚡ ${total} armed and climbing — the room is heating up fast.`, tone: "hot" };
  if (total >= 8)  return { line: `👀 ${total} armed — momentum is building. Don't blink.`, tone: "warm" };
  if (total >= 3)  return { line: `${total} bidders armed — the race is forming.`, tone: "warm" };
  if (total >= 1)  return { line: `${total} armed so far — early-mover advantage is yours.`, tone: "cool" };
  return { line: `Be the first to arm — vote on the seller's reveals to earn claim rights.`, tone: "cool" };
}

export function AuctionRoom({ auction, serverTimeMs, initialVotes = 0 }: AuctionRoomProps) {
  // Capture the server-clock offset ONCE at mount. Computing it inline on every
  // render would re-pin the effective clock to serverTimeMs each 500ms re-render,
  // freezing the price (Date.now() + offset collapses back to serverTimeMs).
  const [clockOffsetMs] = useState(() => serverTimeMs - Date.now());
  const { decayParams, armed, acts } = auction;
  const burnLabel = BURN_LABEL[decayParams.burnLevel];
  const totalArmed = armed.tier3 + armed.tier2 + armed.tier1;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<{ id: string; displayName: string; balance: number } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    function fetchUser() {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => setUser(d.user ?? null))
        .catch(() => setUser(null));
    }
    fetchUser();
    // Poll every 3s so the claim button updates immediately after sign-in
    // from the Navbar or any other entry point without needing a full reload.
    const id = setInterval(fetchUser, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Price / pause state ───────────────────────────────────────────────────
  const [priceResult, setPriceResult] = useState(() =>
    computePrice(decayParams, Date.now() + clockOffsetMs)
  );

  useEffect(() => {
    function tick() {
      setPriceResult(computePrice(decayParams, Date.now() + clockOffsetMs));
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [decayParams, clockOffsetMs]);

  // ── Active act spotlight ──────────────────────────────────────────────────
  const activeActNo: 1 | 2 | 3 | null = (() => {
    if (!priceResult.isPaused) return null;
    const idx = decayParams.pauseWindows.findIndex(
      (pw) =>
        priceResult.elapsedActiveS >= pw.from &&
        priceResult.elapsedActiveS <= pw.until
    );
    return idx >= 0 ? ((idx + 1) as 1 | 2 | 3) : null;
  })();

  // ── Votes — real API; reconcile with the server's true count ──────────────
  const [votes, setVotes] = useState(initialVotes);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const tier = votesToTier(votes);

  async function castVote(actNo: 1 | 2 | 3) {
    if (!user) { setShowAuth(true); return; }
    setVoteMsg(null);
    const prev = votes;
    setVotes((v) => Math.min(3, v + 1)); // optimistic
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, actNo }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (typeof data.totalVotes === "number") setVotes(Math.min(3, data.totalVotes));
      } else {
        // Rejected (act not revealed yet, cooldown, etc.) — roll back + explain.
        setVotes(prev);
        setVoteMsg(data.error ?? "Vote not accepted.");
        setTimeout(() => setVoteMsg(null), 4000);
      }
    } catch {
      setVotes(prev);
      setVoteMsg("Network error — try again.");
      setTimeout(() => setVoteMsg(null), 4000);
    }
  }
  const claimDelay = tierDelaySeconds(tier);

  // ── Claim ─────────────────────────────────────────────────────────────────
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [finalPrice, setFinalPrice] = useState(0);
  const [lossInfo, setLossInfo] = useState<{ winnerName: string; beatenByMs: number } | null>(null);

  function handleClaim() {
    if (!user) { setShowAuth(true); return; }
    if (tier === 0 || claimState !== "idle") return;
    setFinalPrice(priceResult.price);
    // Submit immediately. The SERVER enforces the tier delay (5s/2s) before
    // accepting a tier 1/2 claim — no bypassable client-side countdown.
    setClaimState("submitting");
    submitClaim();
  }

  async function submitClaim() {
    if (!user) return;
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, idempotencyKey }),
      });
      const data = await res.json();
      if (res.ok && data.result === "won") {
        setFinalPrice(data.serverPrice ?? finalPrice);
        setClaimState("won");
      } else {
        // Store real winner + timing from the API so the loss screen is honest
        setLossInfo({
          winnerName: data.winner?.displayName ?? "another bidder",
          beatenByMs: data.loserReceipt?.beatenByMs ?? 0,
        });
        setClaimState("lost");
      }
    } catch {
      setLossInfo(null);
      setClaimState("lost");
    }
  }

  function resetClaim() {
    setClaimState("idle");
    setLossInfo(null);
  }

  // ── Relist (seller only) ──────────────────────────────────────────────────
  const isSeller = !!(user && auction.sellerUserId && user.id === auction.sellerUserId);
  async function relist() {
    try {
      const res = await fetch(`/api/auctions/${auction.id}/relist`, { method: "POST" });
      if (res.ok) window.location.reload();
    } catch {
      // ignore — button stays, user can retry
    }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const burstId = useRef(0);

  function sendReaction(emoji: string) {
    const id = burstId.current++;
    setBursts((prev) => [...prev.slice(-8), { id, emoji, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1800);
  }

  // ── Live armed counts (REAL, from votes via /state) + cosmetic watcher drift ──
  const [armedCounts, setArmedCounts] = useState(armed);
  const liveArmed = armedCounts.tier3 + armedCounts.tier2 + armedCounts.tier1;
  const heat = armedHeat(liveArmed);
  const [liveWatching, setLiveWatching] = useState(auction.spectatorsEst || 0);
  useEffect(() => {
    const id = setInterval(() => {
      setLiveWatching((n) => Math.max(50, n + Math.floor((Math.random() - 0.45) * 12)));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Live status poll — detect when the auction ends (claim / lottery / unsold) ──
  const [remoteWinner, setRemoteWinner] = useState<{ name: string; via: string } | null>(null);
  const [endedUnsold, setEndedUnsold] = useState(false);
  useEffect(() => {
    // Poll every 4s; reflect a terminal status set by another claimer, the floor
    // lottery, or a withdraw-unsold resolution.
    const pollId = setInterval(async () => {
      try {
        const r = await fetch(`/api/auctions/${auction.id}/state`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.armed) setArmedCounts(data.armed); // live armed counts, always update
        if (claimState !== "idle") return;
        if (data.status === "unsold" || data.status === "expired") {
          setEndedUnsold(true);
        } else if (data.status === "claimed" && data.winner) {
          setRemoteWinner({ name: data.winner.displayName ?? "someone", via: data.winner.wonVia ?? "claim" });
        }
      } catch {
        // network error — ignore
      }
    }, 4000);
    return () => clearInterval(pollId);
  }, [auction.id, claimState]);

  // ── Win / loss screens ────────────────────────────────────────────────────
  if (claimState === "won") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-drop-green/10 border border-drop-green/30 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-drop-green" />
        </div>
        <div>
          <h1 className="font-mono font-bold text-3xl text-drop-green">You claimed it.</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs mx-auto">
            {auction.title} is yours at{" "}
            <span className="font-mono text-amber">{finalPrice.toLocaleString()} coins</span>.
          </p>
        </div>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          Back to lobby
        </Link>
      </div>
    );
  }

  if (claimState === "lost") {
    const winnerName = lossInfo?.winnerName ?? "another bidder";
    const beatenByMs = lossInfo?.beatenByMs ?? null;
    const deltaStr = beatenByMs !== null
      ? beatenByMs < 1000
        ? `${beatenByMs}ms`
        : `${(beatenByMs / 1000).toFixed(2)}s`
      : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-drop-red/10 border border-drop-red/30 flex items-center justify-center">
          <X className="w-10 h-10 text-drop-red" />
        </div>
        <div>
          {deltaStr && (
            <h1 className="font-mono font-bold text-3xl text-drop-red">{deltaStr}.</h1>
          )}
          <p className="text-muted-foreground mt-2 text-sm max-w-xs mx-auto">
            <span className="font-mono text-foreground">{winnerName}</span> was faster. You were one of{" "}
            <span className="font-mono text-foreground">{liveArmed}</span> armed — they got it first.
          </p>
          {deltaStr && (
            <p className="text-muted-foreground mt-3 text-xs max-w-xs mx-auto">
              Their claim hit the database {deltaStr} before yours.
              One atomic write. One winner.
            </p>
          )}
        </div>
        <button
          onClick={resetClaim}
          className="px-6 py-2.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors text-sm font-semibold"
        >
          Stay in room
        </button>
      </div>
    );
  }

  return (
    <>
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user ?? null));
          }}
        />
      )}

      {/* Remote winner overlay — someone claimed, or the floor lottery awarded it */}
      {remoteWinner && !endedUnsold && claimState === "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-xl border border-border bg-card max-w-sm text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-drop-red/10 border border-drop-red/30 flex items-center justify-center">
              <X className="w-8 h-8 text-drop-red" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">
                {remoteWinner.via === "lottery" ? "Floor lottery" : "Item claimed"}
              </p>
              <h2 className="font-mono font-bold text-xl text-foreground">
                <span className="text-amber">{remoteWinner.name}</span> got it.
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {remoteWinner.via === "lottery"
                  ? "Nobody claimed before the floor — a fully-armed bidder won the draw at reserve price."
                  : "This auction has ended. The item was claimed while you were watching."}
              </p>
            </div>
            <Link href="/" className="px-6 py-2.5 rounded-md bg-amber text-amber-foreground font-mono font-semibold text-sm hover:opacity-90 transition-opacity">
              Back to lobby
            </Link>
          </div>
        </div>
      )}

      {/* Unsold overlay — price hit floor, seller chose withdraw */}
      {endedUnsold && claimState === "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-xl border border-border bg-card max-w-sm text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
              <X className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Ended — not sold</p>
              <h2 className="font-mono font-bold text-xl text-foreground">Reserve not met.</h2>
              <p className="text-sm text-muted-foreground mt-2">
                The price reached the floor with no claim, so the seller kept the item. It may be relisted later.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="px-5 py-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm">
                Back to lobby
              </Link>
              {isSeller && (
                <button
                  onClick={relist}
                  className="px-5 py-2.5 rounded-md bg-amber text-amber-foreground font-mono font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Relist now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-5xl">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All auctions
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ── Left column ─────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Image */}
            <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-muted">
              {auction.imageUrl && (
                <Image src={auction.imageUrl} alt={auction.title} fill className="object-cover" priority />
              )}
              {/* Floating reactions */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                {bursts.map((b) => (
                  <span
                    key={b.id}
                    className="absolute text-2xl select-none"
                    style={{ left: `${b.x}%`, bottom: "10%", animation: "floatUp 1.8s ease-out forwards" }}
                  >
                    {b.emoji}
                  </span>
                ))}
              </div>
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <LiveBadge />
                {burnLabel && (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-background/80 backdrop-blur-sm border border-amber/30 font-mono text-[10px] font-bold text-amber">
                    <Flame className="w-3 h-3" aria-hidden="true" />
                    {burnLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Title + description */}
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                {auction.category}
              </p>
              <h1 className="font-sans font-bold text-xl md:text-2xl text-foreground text-balance leading-snug mt-1">
                {auction.title}
              </h1>
              {auction.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {auction.description}
                </p>
              )}
            </div>

            {/* Live stats */}
            <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                {liveWatching.toLocaleString()} watching
              </span>
              <span className={cn(
                "flex items-center gap-1.5",
                liveArmed > 40 ? "text-amber" : "text-muted-foreground"
              )}>
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                {liveArmed} armed
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                {tier === 0
                  ? "No claim right"
                  : tier === 3
                  ? "Instant claim"
                  : `${claimDelay}s delay`}
              </span>
            </div>

            {/* Act highlights revealed so far */}
            {acts.filter((a) => votes >= a.actNo).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Revealed so far
                </p>
                {acts
                  .filter((a) => votes >= a.actNo)
                  .map((act) => (
                    <div
                      key={act.actNo}
                      className="rounded-md border border-drop-green/20 bg-drop-green/5 px-4 py-3"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-widest text-drop-green mb-1">
                        Act {act.actNo}
                      </p>
                      <p className="text-sm font-semibold text-foreground">{act.headline}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.detail}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Reaction buttons */}
            <div className="flex items-center gap-2">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-xl p-2 rounded-lg border border-border hover:border-amber/40 hover:bg-card transition-all active:scale-90"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <span className="ml-1 text-xs text-muted-foreground font-mono">react</span>
            </div>
          </div>

          {/* ── Right column ────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Demand / armed urgency + tier breakdown */}
            <div
              className={cn(
                "rounded-lg border p-4",
                heat.tone === "hot"
                  ? "border-amber/50 bg-amber/10"
                  : heat.tone === "warm"
                  ? "border-amber/30 bg-amber/5"
                  : "border-border bg-card"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold",
                  heat.tone === "hot" ? "text-amber animate-pulse-slow" : heat.tone === "warm" ? "text-amber" : "text-foreground"
                )}
              >
                {heat.line}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {([
                  { n: armedCounts.tier3, label: "fully armed", sub: "3 votes" },
                  { n: armedCounts.tier2, label: "armed", sub: "2 votes" },
                  { n: armedCounts.tier1, label: "warming", sub: "1 vote" },
                ] as const).map((t) => (
                  <div key={t.sub} className="rounded-md border border-border bg-background/40 py-2">
                    <p className="font-mono text-xl font-bold text-foreground">{t.n}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{t.label}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/70">{t.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Act spotlight banner */}
            {activeActNo && (
              <div className="rounded-lg border border-amber/30 bg-amber/5 p-4">
                <p className="font-mono text-xs tracking-widest uppercase text-amber mb-2">
                  Act {activeActNo} spotlight — price paused
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {acts.find((a) => a.actNo === activeActNo)?.headline ??
                    "A seller highlight is being revealed"}
                </p>
                {acts.find((a) => a.actNo === activeActNo)?.detail && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {acts.find((a) => a.actNo === activeActNo)?.detail}
                  </p>
                )}
                {votes < activeActNo ? (
                  <button
                    onClick={() => castVote(activeActNo)}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    Vote — arm yourself for Act {activeActNo}
                  </button>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-drop-green text-xs font-mono">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Voted for Act {activeActNo}
                  </p>
                )}
              </div>
            )}

            {/* Live price */}
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Current price{priceResult.isPaused ? " — paused" : " — falling"}
              </p>
              <PriceTicker decayParams={decayParams} clockOffsetMs={clockOffsetMs} />
              <div className="mt-4 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber transition-all duration-1000"
                  style={{
                    width: `${Math.max(0, (1 - priceResult.progress) * 100).toFixed(1)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                <span>{auction.startPrice.toLocaleString()} start</span>
                <span>floor hidden</span>
              </div>
            </div>

            {/* Arm status */}
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Your arm status
              </p>
              <div className="flex gap-3">
                {([1, 2, 3] as const).map((n) => (
                  <div
                    key={n}
                    className={cn(
                      "flex-1 rounded-md border p-3 text-center transition-all",
                      votes >= n
                        ? "border-drop-green/40 bg-drop-green/10 text-drop-green"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    <p className="font-mono text-lg font-bold">{votes >= n ? "✓" : n}</p>
                    <p className="text-[10px] font-mono mt-0.5">Act {n}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground font-mono">
                {tier === 0 && "Vote during act spotlights to earn claim rights."}
                {tier === 1 && "1 vote — 5s delay on claim. Keep voting."}
                {tier === 2 && "2 votes — 2s delay on claim. One more."}
                {tier === 3 && "3 votes — instant claim. You are fully armed."}
              </p>
              {/* Demo vote button (usable any time — calls real API) */}
              {votes < 3 && (
                <button
                  onClick={() => castVote(([1, 2, 3] as const)[votes])}
                  className="mt-3 w-full text-xs text-muted-foreground border border-border rounded-md py-2 hover:text-foreground hover:border-amber/30 transition-colors font-mono"
                >
                  Vote for Act {votes + 1} ({votes}/3)
                </button>
              )}
              {voteMsg && (
                <p className="mt-2 text-xs font-mono text-amber text-center animate-pulse-slow">
                  {voteMsg}
                </p>
              )}
            </div>

            {/* Claim */}
            <div className="rounded-lg border border-border bg-card p-5">
              {claimState === "idle" && (
                <>
                  {!user ? (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="w-full py-4 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors font-mono font-bold text-base flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-5 h-5" aria-hidden="true" />
                      Sign in to claim
                    </button>
                  ) : (
                    <button
                      onClick={handleClaim}
                      disabled={tier === 0}
                      className={cn(
                        "w-full py-4 rounded-md font-mono font-bold text-lg transition-all",
                        tier === 3
                          ? "bg-amber text-amber-foreground hover:opacity-90 active:scale-95"
                          : tier > 0
                          ? "bg-card text-foreground border border-border hover:border-amber/30"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {tier === 0 ? "Must arm first" : "CLAIM NOW"}
                    </button>
                  )}
                  {user && tier > 0 && tier < 3 && (
                    <p className="text-xs text-muted-foreground font-mono mt-2 text-center">
                      {claimDelay}s delay — earn {3 - votes} more vote
                      {3 - votes !== 1 ? "s" : ""} for instant
                    </p>
                  )}
                  {user && (
                    <p className="text-xs text-muted-foreground font-mono mt-2 text-center">
                      Signed in as{" "}
                      <span className="text-foreground">{user.displayName}</span>
                      {" "}&middot;{" "}
                      <span className="text-drop-green">{Number(user.balance).toLocaleString()} coins</span>
                    </p>
                  )}
                </>
              )}

              {claimState === "submitting" && (
                <div className="text-center py-3">
                  <p className="font-mono text-muted-foreground text-sm animate-pulse-slow">
                    {claimDelay > 0
                      ? `Claiming — enforcing your ${claimDelay}s tier delay…`
                      : "Submitting claim…"}
                  </p>
                </div>
              )}
            </div>

            {/* Floor lottery hint */}
            {tier === 3 && (
              <div className="rounded-lg border border-border bg-card px-5 py-4">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Floor lottery
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If nobody claims before the price hits the hidden floor, fully armed
                  bidders are entered into a random draw at reserve price.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
