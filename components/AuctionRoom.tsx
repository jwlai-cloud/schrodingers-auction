"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Eye, Shield, Flame, ArrowLeft, Zap, Check, X, Trophy } from "lucide-react";
import { PriceTicker } from "./PriceTicker";
import { LiveBadge } from "./LiveBadge";
import { cn } from "@/lib/utils";
import { computePrice, votesToTier, tierDelaySeconds } from "@/lib/price";
import type { AuctionSummary } from "@/lib/types";

interface AuctionRoomProps {
  auction: AuctionSummary;
  serverTimeMs: number;
}

type ClaimState = "idle" | "pending" | "won" | "lost";

const REACTIONS = ["🔥", "👀", "💀", "🤑"] as const;

const BURN_LABEL: Record<number, string | null> = {
  0: null, 1: "BURN ×1.15", 2: "BURN ×1.35", 3: "BURN ×1.6",
};

const ACT_DESCRIPTIONS = [
  "Act I reveal — vote to arm yourself",
  "Act II reveal — vote for more power",
  "Act III reveal — final vote. Fully armed.",
];

export function AuctionRoom({ auction, serverTimeMs }: AuctionRoomProps) {
  const clockOffsetMs = serverTimeMs - Date.now();
  const { decayParams, armed } = auction;
  const burnLabel = BURN_LABEL[decayParams.burnLevel];
  const totalArmed = armed.tier3 + armed.tier2 + armed.tier1;

  // ── Votes (simulated locally for demo) ────────────────────────────────────
  const [votes, setVotes] = useState(0); // 0, 1, 2, 3
  const tier = votesToTier(votes);
  const claimDelay = tierDelaySeconds(tier);

  // ── Act window detection ───────────────────────────────────────────────────
  const [activeActNo, setActiveActNo] = useState<1 | 2 | 3 | null>(null);
  const [priceResult, setPriceResult] = useState(() => computePrice(decayParams, Date.now() + clockOffsetMs));

  useEffect(() => {
    function tick() {
      const result = computePrice(decayParams, Date.now() + clockOffsetMs);
      setPriceResult(result);

      // Detect which act pause we are in based on the pause windows
      const { pauseWindows } = decayParams;
      if (result.isPaused) {
        const active = pauseWindows.findIndex(
          (pw) => result.elapsedActiveS >= pw.from && result.elapsedActiveS <= pw.until
        );
        setActiveActNo(active >= 0 ? ((active + 1) as 1 | 2 | 3) : null);
      } else {
        setActiveActNo(null);
      }
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [decayParams, clockOffsetMs]);

  // ── Claim state ────────────────────────────────────────────────────────────
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimCountdown, setClaimCountdown] = useState(0);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClaim() {
    if (tier === 0) return; // must have votes
    if (claimState !== "idle") return;

    if (claimDelay === 0) {
      setClaimState("pending");
      // Simulate server round-trip
      setTimeout(() => {
        // For demo: randomly win or lose with 70% win rate
        setClaimState(Math.random() < 0.7 ? "won" : "lost");
      }, 600);
      return;
    }

    // Count down the tier delay
    setClaimCountdown(claimDelay);
    setClaimState("pending");

    let remaining = claimDelay;
    const interval = setInterval(() => {
      remaining -= 1;
      setClaimCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          setClaimState(Math.random() < 0.7 ? "won" : "lost");
        }, 600);
      }
    }, 1000);
    claimTimerRef.current = interval as unknown as ReturnType<typeof setTimeout>;
  }

  function resetClaim() {
    setClaimState("idle");
    setClaimCountdown(0);
    if (claimTimerRef.current) clearInterval(claimTimerRef.current);
  }

  // ── Reaction bursts ────────────────────────────────────────────────────────
  const [reactionBursts, setReactionBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const burstId = useRef(0);

  function sendReaction(emoji: string) {
    const id = burstId.current++;
    const x = 20 + Math.random() * 60; // percent from left
    setReactionBursts((prev) => [...prev.slice(-8), { id, emoji, x }]);
    setTimeout(() => setReactionBursts((prev) => prev.filter((b) => b.id !== id)), 1800);
  }

  // ── Spectator / armed counters (simulated drift for demo) ─────────────────
  const [liveArmed, setLiveArmed] = useState(totalArmed);
  const [liveWatching, setLiveWatching] = useState(auction.spectatorsEst);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveArmed((n) => Math.max(0, n + (Math.random() < 0.4 ? 1 : 0) - (Math.random() < 0.1 ? 1 : 0)));
      setLiveWatching((n) => Math.max(100, n + Math.floor((Math.random() - 0.48) * 20)));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (claimState === "won") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-drop-green/10 border border-drop-green/30 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-drop-green" />
        </div>
        <div>
          <h1 className="font-mono font-bold text-3xl text-drop-green">You claimed it.</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {auction.title} is yours. Coins debited from your wallet.
          </p>
          <p className="font-mono text-amber text-lg mt-4">
            {priceResult.price.toLocaleString()} coins
          </p>
        </div>
        <Link href="/" className="px-6 py-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm">
          Back to lobby
        </Link>
      </div>
    );
  }

  if (claimState === "lost") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-drop-red/10 border border-drop-red/30 flex items-center justify-center">
          <X className="w-10 h-10 text-drop-red" />
        </div>
        <div>
          <h1 className="font-mono font-bold text-3xl text-drop-red">0.4 seconds.</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs">
            Someone on the other side of the planet was faster. You were {liveArmed} armed — one of them got it.
          </p>
        </div>
        <button onClick={resetClaim} className="px-6 py-2.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors text-sm font-semibold">
          Stay in room
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-5xl">
      {/* Back nav */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />
        All auctions
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* ── Left: Image + meta ──────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Image */}
          <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-muted">
            {auction.imageUrl && (
              <Image src={auction.imageUrl} alt={auction.title} fill className="object-cover" priority />
            )}
            {/* Reaction burst layer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {reactionBursts.map((b) => (
                <span
                  key={b.id}
                  className="absolute text-2xl animate-fade-in"
                  style={{
                    left: `${b.x}%`,
                    bottom: "10%",
                    animation: "floatUp 1.8s ease-out forwards",
                  }}
                >
                  {b.emoji}
                </span>
              ))}
            </div>

            <div className="absolute top-3 left-3 flex items-center gap-2">
              <LiveBadge />
              {burnLabel && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-background/80 backdrop-blur-sm border border-amber/30 font-mono text-[10px] font-bold text-amber">
                  <Flame className="w-3 h-3" />
                  {burnLabel}
                </span>
              )}
            </div>
          </div>

          {/* Title + category */}
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{auction.category}</p>
            <h1 className="font-sans font-bold text-xl md:text-2xl text-foreground text-balance leading-snug mt-1">
              {auction.title}
            </h1>
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              {liveWatching.toLocaleString()} watching
            </span>
            <span className={cn("flex items-center gap-1.5", liveArmed > 40 ? "text-amber" : "text-muted-foreground")}>
              <Shield className="w-3.5 h-3.5" />
              {liveArmed} armed
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              {tier === 0 ? "No claim right" : tier === 3 ? "Instant claim" : `${claimDelay}s delay`}
            </span>
          </div>

          {/* Reactions */}
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
            <span className="ml-2 text-xs text-muted-foreground font-mono">react</span>
          </div>
        </div>

        {/* ── Right: Price + votes + claim ──────────────── */}
        <div className="flex flex-col gap-6">
          {/* Act spotlight */}
          {activeActNo && (
            <div className="rounded-lg border border-amber/30 bg-amber/5 p-4 animate-fade-in">
              <p className="font-mono text-xs tracking-widest uppercase text-amber mb-1">
                Act {activeActNo} spotlight — price paused
              </p>
              <p className="text-sm text-foreground">{ACT_DESCRIPTIONS[activeActNo - 1]}</p>
              {votes < activeActNo && (
                <button
                  onClick={() => setVotes((v) => Math.min(3, v + 1))}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Shield className="w-4 h-4" />
                  Vote (Act {activeActNo}) — arm yourself
                </button>
              )}
              {votes >= activeActNo && (
                <p className="mt-3 flex items-center gap-1.5 text-drop-green text-xs font-mono">
                  <Check className="w-3.5 h-3.5" />
                  Voted for Act {activeActNo}
                </p>
              )}
            </div>
          )}

          {/* Price */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Current price {priceResult.isPaused ? "— paused" : "— falling"}
            </p>
            <PriceTicker decayParams={decayParams} clockOffsetMs={clockOffsetMs} />

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-amber transition-all duration-1000"
                style={{ width: `${Math.max(0, (1 - priceResult.progress) * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>{auction.startPrice.toLocaleString()} start</span>
              <span>floor hidden</span>
            </div>
          </div>

          {/* Tier / arm status */}
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
              {tier === 0 && "Vote in act spotlights to earn claim rights."}
              {tier === 1 && "1 vote — 5s delay on claim. Keep voting."}
              {tier === 2 && "2 votes — 2s delay on claim. One more."}
              {tier === 3 && "3 votes — instant claim. You are fully armed."}
            </p>
            {/* Demo: allow voting any time for testing */}
            {!activeActNo && votes < 3 && (
              <button
                onClick={() => setVotes((v) => Math.min(3, v + 1))}
                className="mt-3 w-full text-xs text-muted-foreground border border-border rounded-md py-2 hover:text-foreground hover:border-amber/30 transition-colors font-mono"
              >
                Demo: simulate vote ({votes}/3)
              </button>
            )}
          </div>

          {/* Claim button */}
          <div className="rounded-lg border border-border bg-card p-5">
            {claimState === "idle" && (
              <>
                <button
                  onClick={handleClaim}
                  disabled={tier === 0}
                  className={cn(
                    "w-full py-4 rounded-md font-mono font-bold text-lg transition-all",
                    tier === 3
                      ? "bg-amber text-amber-foreground hover:opacity-90 active:scale-95"
                      : tier > 0
                      ? "bg-secondary text-foreground hover:bg-amber/10 hover:border-amber/30 border border-border"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {tier === 0 ? "Must arm first" : "CLAIM NOW"}
                </button>
                {tier > 0 && tier < 3 && (
                  <p className="text-xs text-muted-foreground font-mono mt-2 text-center">
                    {claimDelay}s delay — earn {3 - votes} more vote{3 - votes !== 1 ? "s" : ""} for instant
                  </p>
                )}
              </>
            )}

            {claimState === "pending" && claimCountdown > 0 && (
              <div className="text-center">
                <p className="font-mono text-4xl font-bold text-amber animate-pulse-slow">{claimCountdown}</p>
                <p className="text-muted-foreground text-xs mt-1 font-mono">enforcing {claimDelay}s tier delay...</p>
              </div>
            )}

            {claimState === "pending" && claimCountdown === 0 && (
              <div className="text-center py-2">
                <p className="font-mono text-muted-foreground text-sm animate-pulse-slow">Submitting claim...</p>
              </div>
            )}
          </div>

          {/* Floor lottery hint */}
          {tier === 3 && (
            <div className="rounded-lg border border-border bg-card px-5 py-4">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Floor lottery
              </p>
              <p className="text-xs text-muted-foreground">
                If nobody claims and price hits floor, you can opt in for a random draw at reserve price.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
