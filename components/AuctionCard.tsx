"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Eye, Shield, Flame } from "lucide-react";
import { PriceTicker } from "./PriceTicker";
import { LiveBadge } from "./LiveBadge";
import { cn } from "@/lib/utils";
import { computePrice } from "@/lib/price";
import type { AuctionSummary } from "@/lib/types";

interface AuctionCardProps {
  auction: AuctionSummary;
  /** Server-to-client clock offset in ms */
  clockOffsetMs: number;
  priority?: boolean;
}

const BURN_LABEL: Record<number, string | null> = {
  0: null,
  1: "BURN ×1.15",
  2: "BURN ×1.35",
  3: "BURN ×1.6",
};

export function AuctionCard({ auction, clockOffsetMs, priority = false }: AuctionCardProps) {
  const { armed, spectatorsEst, decayParams } = auction;
  const totalArmed = armed.tier3 + armed.tier2 + armed.tier1;
  const burnLabel = BURN_LABEL[decayParams.burnLevel];

  // Initialize to null so SSR and client first render agree — no Date.now() on server.
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      const r = computePrice(decayParams, Date.now() + clockOffsetMs);
      setProgress(1 - r.progress);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [decayParams, clockOffsetMs]);

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border",
        "bg-card hover:border-amber/40 transition-all duration-300",
        "hover:card-glow cursor-pointer",
        "animate-fade-in"
      )}
      aria-label={`${auction.title} — current price ${auction.startPrice.toLocaleString()} coins, live auction`}
    >
      {/* ── Image area ────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {auction.imageUrl ? (
          <Image
            src={auction.imageUrl}
            alt={auction.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground">IMG</span>
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <LiveBadge />
        </div>

        {/* Burn level badge */}
        {burnLabel && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 bg-background/80 backdrop-blur-sm border border-amber/30">
            <Flame className="w-3 h-3 text-amber" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-amber">
              {burnLabel}
            </span>
          </div>
        )}

        {/* Price curve visual hint — a subtle gradient bar at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
          <div
            className="h-full bg-amber transition-all duration-1000"
            style={{ width: progress !== null ? `${Math.max(0, Math.min(100, progress * 100)).toFixed(1)}%` : "100%" }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-4">
        {/* Title + description */}
        <div>
          <h2 className="font-sans font-semibold text-foreground text-balance leading-snug line-clamp-2 text-sm md:text-base">
            {auction.title}
          </h2>
          {auction.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {auction.description}
            </p>
          )}
        </div>

        {/* Live price ticker */}
        <PriceTicker
          decayParams={decayParams}
          clockOffsetMs={clockOffsetMs}
          compact
        />

        {/* ── Stats row ─────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
          {/* Spectators */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-mono text-xs tabular">
              {spectatorsEst.toLocaleString()}
            </span>
            <span className="text-xs sr-only">watching</span>
          </div>

          {/* Armed counter */}
          <div
            className={cn(
              "flex items-center gap-1.5",
              totalArmed > 40 ? "text-amber" : "text-muted-foreground"
            )}
            title={`${armed.tier3} fully armed, ${armed.tier2} half-armed, ${armed.tier1} interested`}
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold tabular">
              {totalArmed}
            </span>
            <span className="text-xs text-muted-foreground">armed</span>
          </div>

          {/* Tier mini-bars */}
          <div className="flex items-end gap-0.5 h-4" aria-hidden="true" title="Armed tiers: green=3-vote, yellow=2-vote, orange=1-vote">
            <div
              className="w-1.5 bg-drop-green rounded-sm"
              style={{ height: `${Math.min(100, (armed.tier3 / Math.max(1, totalArmed)) * 100)}%` }}
            />
            <div
              className="w-1.5 bg-amber rounded-sm"
              style={{ height: `${Math.min(100, (armed.tier2 / Math.max(1, totalArmed)) * 100)}%` }}
            />
            <div
              className="w-1.5 bg-amber-dim rounded-sm"
              style={{ height: `${Math.min(100, (armed.tier1 / Math.max(1, totalArmed)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
