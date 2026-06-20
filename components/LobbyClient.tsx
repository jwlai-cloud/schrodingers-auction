"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Shield, Trophy, Tag, Tv, Gamepad2, Home, Camera, Package } from "lucide-react";
import { AuctionCard } from "./AuctionCard";
import { FeaturedAuction } from "./FeaturedAuction";
import type { AuctionSummary } from "@/lib/types";

const CATEGORIES = [
  { label: "All",          icon: Tag,       filter: null },
  { label: "Electronics",  icon: Tv,        filter: "Electronics" },
  { label: "Gaming",       icon: Gamepad2,  filter: "Gaming" },
  { label: "Home",         icon: Home,      filter: "Home" },
  { label: "Photography",  icon: Camera,    filter: "Photography" },
  { label: "Collectibles", icon: Package,   filter: "Collectibles" },
];

interface LobbyClientProps {
  auctions: AuctionSummary[];
  serverTimeMs: number;
}

export function LobbyClient({ auctions, serverTimeMs }: LobbyClientProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const clockOffsetMs = serverTimeMs - Date.now();

  const filtered = activeCategory
    ? auctions.filter((a) => a.category === activeCategory)
    : auctions;

  const featured = [...auctions].sort((a, b) => b.spectatorsEst - a.spectatorsEst)[0];

  return (
    <>
      {/* ── Hero strip ──────────────────────────────────────── */}
      <section className="border-b border-border py-10 md:py-14">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-12">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs tracking-widest uppercase text-amber mb-3">
              Dutch auction — live globally
            </p>
            <h1 className="font-sans font-bold text-3xl md:text-5xl text-foreground leading-tight text-balance">
              The price falls.{" "}
              <span className="text-amber">One person claims it.</span>
            </h1>
            <p className="mt-4 text-muted-foreground text-sm md:text-base leading-relaxed max-w-md text-pretty">
              Watch the room. Arm yourself with votes. When the moment feels right —
              claim before anyone else on the planet.
            </p>
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-amber-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                List an item
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                How it works
              </Link>
            </div>
          </div>

          {/* How-it-works chips */}
          <div className="flex flex-col gap-3 text-sm w-full md:w-auto md:min-w-[220px]">
            {[
              { icon: Zap,    label: "Price falls every second",  color: "text-amber" },
              { icon: Shield, label: "Vote to arm yourself",      color: "text-drop-green" },
              { icon: Trophy, label: "First valid claim wins",    color: "text-foreground" },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-card"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} aria-hidden="true" />
                <span className="font-sans text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured hot auction ─────────────────────────────── */}
      <section className="border-b border-border py-8">
        <div className="container mx-auto px-4">
          <p className="font-mono text-xs tracking-widest uppercase text-amber mb-4">
            Hottest right now
          </p>
          <FeaturedAuction auction={featured} clockOffsetMs={clockOffsetMs} />
        </div>
      </section>

      {/* ── Category filter bar ──────────────────────────────── */}
      <div className="border-b border-border sticky top-14 z-30 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-none" role="tablist" aria-label="Filter by category">
            {CATEGORIES.map(({ label, icon: Icon, filter }) => {
              const isActive = filter === activeCategory;
              return (
                <button
                  key={label}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(filter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive
                      ? "bg-amber text-amber-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Live auction gallery ─────────────────────────────── */}
      <main className="container mx-auto px-4 py-8 md:py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-sans font-semibold text-foreground text-lg">
            Live now
            <span className="ml-2 font-mono text-sm text-muted-foreground font-normal">
              {filtered.length} {activeCategory ? `in ${activeCategory}` : "auctions"}
            </span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            prices updating live
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No live auctions in this category right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filtered.map((auction, i) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                clockOffsetMs={clockOffsetMs}
                priority={i < 3}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <span>Schrodinger&apos;s Auction — demo build</span>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="hover:text-amber transition-colors">DB browser</Link>
            <Link href="/demo" className="hover:text-amber transition-colors">Demo script</Link>
            <span>One price, everywhere. One winner, ever.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
