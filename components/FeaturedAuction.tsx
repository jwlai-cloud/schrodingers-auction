"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, Shield, Flame, ArrowRight } from "lucide-react";
import { PriceTicker } from "./PriceTicker";
import { LiveBadge } from "./LiveBadge";
import type { AuctionSummary } from "@/lib/types";

interface FeaturedAuctionProps {
  auction: AuctionSummary;
  clockOffsetMs: number;
}

const BURN_LABEL: Record<number, string | null> = {
  0: null, 1: "BURN ×1.15", 2: "BURN ×1.35", 3: "BURN ×1.6",
};

export function FeaturedAuction({ auction, clockOffsetMs }: FeaturedAuctionProps) {
  const { armed, spectatorsEst, decayParams } = auction;
  const totalArmed = armed.tier3 + armed.tier2 + armed.tier1;
  const burnLabel = BURN_LABEL[decayParams.burnLevel];

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group flex flex-col md:flex-row gap-0 overflow-hidden rounded-lg border border-amber/20 bg-card hover:border-amber/50 transition-all duration-300 hover:card-glow"
      aria-label={`Featured: ${auction.title}`}
    >
      {/* Image */}
      <div className="relative md:w-80 lg:w-96 aspect-[4/3] md:aspect-auto flex-shrink-0 overflow-hidden">
        {auction.imageUrl && (
          <Image
            src={auction.imageUrl}
            alt={auction.title}
            fill
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority
          />
        )}
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

      {/* Body */}
      <div className="flex flex-col justify-between p-5 md:p-7 flex-1 gap-4">
        <div>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {auction.category}
          </span>
          <h3 className="font-sans font-bold text-xl md:text-2xl text-foreground text-balance mt-1 leading-snug">
            {auction.title}
          </h3>
        </div>

        <div className="flex flex-col gap-4">
          <PriceTicker decayParams={decayParams} clockOffsetMs={clockOffsetMs} />

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {spectatorsEst.toLocaleString()} watching
              </span>
              <span className={`flex items-center gap-1.5 ${totalArmed > 40 ? "text-amber" : ""}`}>
                <Shield className="w-3.5 h-3.5" />
                {totalArmed} armed
              </span>
            </div>

            <span className="flex items-center gap-1.5 text-amber text-xs font-semibold group-hover:gap-2 transition-all">
              Enter auction <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
