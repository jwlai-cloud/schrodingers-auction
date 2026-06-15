"use client";

import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  className?: string;
}

export function LiveBadge({ className }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-xs font-semibold tracking-widest uppercase",
        "bg-amber/10 text-amber border border-amber/30",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber live-ring" />
      </span>
      Live
    </span>
  );
}
