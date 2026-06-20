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
}

type ClaimState = "idle" | "countdown" | "submitting" | "won" | "lost";

const REACTIONS = ["🔥", "👀", "💀", "🤑"] as const;

const BURN_LABEL: Record<number, string | null> = {
  0: null, 1: "BURN ×1.15", 2: "BURN ×1.35", 3: "BURN ×1.6",
};

export function AuctionRoom({ auction, serverTimeMs }: AuctionRoomProps) {
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

  // ── Votes — real API with local-state optimistic increment ───────────────
  const [votes, setVotes] = useState(0);
  const tier = votesToTier(votes);

  async function castVote(actNo: 1 | 2 | 3) {
    if (!user) { setShowAuth(true); return; }
    // Optimistic update
    setVotes((v) => Math.min(3, v + 1));
    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, actNo }),
      });
    } catch {
      // Roll back on network error
      setVotes((v) => Math.max(0, v - 1));
    }
  }
  const claimDelay = tierDelaySeconds(tier);

  // ── Claim ─────────────────────────────────────────────────────────────────
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimCountdown, setClaimCountdown] = useState(0);
  const [finalPrice, setFinalPrice] = useState(0);
  const [lossInfo, setLossInfo] = useState<{ winnerName: string; beatenByMs: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleClaim() {
    if (!user) { setShowAuth(true); return; }
    if (tier === 0 || claimState !== "idle") return;

    const price = priceResult.price;
    setFinalPrice(price);

    if (claimDelay === 0) {
      // Instant — fire immediately
      setClaimState("submitting");
      submitClaim();
      return;
    }

    // Countdown, then fire
    setClaimCountdown(claimDelay);
    setClaimState("countdown");
    let remaining = claimDelay;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setClaimCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setClaimState("submitting");
        submitClaim();
      }
    }, 1000);
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    setClaimState("idle");
    setClaimCountdown(0);
    setLossInfo(null);
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const burstId = useRef(0);

  function sendReaction(emoji: string) {
    const id = burstId.current++;
    setBursts((prev) => [...prev.slice(-8), { id, emoji, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1800);
  }

  // ── Live counters (simulated drift) ──────────────────────────────────────
  const [liveArmed, setLiveArmed] = useState(totalArmed);
  const [liveWatching, setLiveWatching] = useState(auction.spectatorsEst);
  useEffect(() => {
    const id = setInterval(() => {
      setLiveArmed((n) => Math.max(0, n + (Math.random() < 0.4 ? 1 : 0) - (Math.random() < 0.1 ? 1 : 0)));
      setLiveWatching((n) => Math.max(100, n + Math.floor((Math.random() - 0.48) * 20)));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Live status poll — detect when someone else claims the item ──────────
  const [remoteWinner, setRemoteWinner] = useState<string | null>(null);
  useEffect(() => {
    // Only poll mock auctions (DB auctions would use the state API).
    // Poll every 4s; if status flips to "claimed", show the overlay.
    const pollId = setInterval(async () => {
      try {
        const r = await fetch(`/api/auctions/${auction.id}/state`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.status === "claimed" && data.winner && claimState === "idle") {
          setRemoteWinner(data.winner.displayName ?? "someone");
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

      {/* Remote winner overlay — shown when someone else claims while you're watching */}
      {remoteWinner && claimState === "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-xl border border-border bg-card max-w-sm text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-drop-red/10 border border-drop-red/30 flex items-center justify-center">
              <X className="w-8 h-8 text-drop-red" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Item claimed</p>
              <h2 className="font-mono font-bold text-xl text-foreground">
                <span className="text-amber">{remoteWinner}</span> got it.
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                This auction has ended. The item was claimed while you were watching.
              </p>
            </div>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-md bg-amber text-amber-foreground font-mono font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Back to lobby
            </Link>
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

              {claimState === "countdown" && (
                <div className="text-center py-2">
                  <p className="font-mono text-5xl font-bold text-amber animate-pulse-slow">
                    {claimCountdown}
                  </p>
                  <p className="text-muted-foreground text-xs mt-2 font-mono">
                    enforcing {claimDelay}s tier delay&hellip;
                  </p>
                </div>
              )}

              {claimState === "submitting" && (
                <div className="text-center py-3">
                  <p className="font-mono text-muted-foreground text-sm animate-pulse-slow">
                    Submitting claim&hellip;
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
