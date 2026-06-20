"use client";

import { useEffect, useRef, useState } from "react";
import { computePrice } from "@/lib/price";
import type { AuctionDecayParams } from "@/lib/price";
import { cn } from "@/lib/utils";

interface PriceTickerProps {
  decayParams: AuctionDecayParams;
  /** Server-to-client clock offset in ms (serverTimeMs - Date.now() at fetch). */
  clockOffsetMs: number;
  className?: string;
  compact?: boolean;
}

export function PriceTicker({
  decayParams,
  clockOffsetMs,
  className,
  compact = false,
}: PriceTickerProps) {
  // Initialize to null so SSR and the first client render agree (no Date.now() on server).
  const [price, setPrice] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [atFloor, setAtFloor] = useState(false);
  const [tick, setTick] = useState(0);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      const serverNow = Date.now() + clockOffsetMs;
      const result = computePrice(decayParams, serverNow);

      setPrice((prev) => {
        if (prev !== null && prev !== result.price) {
          prevPriceRef.current = prev;
          setTick((t) => t + 1);
        }
        return result.price;
      });
      setIsPaused(result.isPaused);
      setAtFloor(result.atFloor);
    }

    // Fire immediately on mount so the price shows without waiting 500 ms.
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [decayParams, clockOffsetMs]);

  // price is null until first useEffect fires on the client — render a stable placeholder.
  const formatted = price !== null ? price.toLocaleString("en-US") : "—";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-baseline gap-2">
        <span
          key={tick}
          className={cn(
            "font-mono font-bold tabular",
            "transition-all duration-150",
            compact ? "text-2xl" : "text-4xl md:text-5xl",
            price === null
              ? "text-muted-foreground"
              : isPaused
              ? "text-muted-foreground"
              : atFloor
              ? "text-drop-green"
              : "text-amber price-glow",
            price !== null && !isPaused && !atFloor && "animate-tick-down"
          )}
        >
          {formatted}
        </span>
        <span
          className={cn(
            "font-mono font-medium",
            compact ? "text-xs" : "text-sm",
            "text-muted-foreground"
          )}
        >
          coins
        </span>
      </div>
      {isPaused && (
        <span className="text-xs font-mono tracking-wide text-amber animate-pulse-slow">
          — spotlight pause —
        </span>
      )}
      {atFloor && !isPaused && (
        <span className="text-xs font-mono tracking-wide text-drop-green">
          at floor price
        </span>
      )}
      {!isPaused && !atFloor && (
        <span className="text-xs font-mono text-muted-foreground tracking-wide">
          falling now
        </span>
      )}
    </div>
  );
}
