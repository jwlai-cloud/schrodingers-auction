"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, Check, Info, Loader2, LogIn } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AuthModal } from "@/components/AuthModal";

const CATEGORIES = ["Electronics", "Gaming", "Home", "Photography", "Collectibles", "Fashion", "Sports", "Other"];

interface FormState {
  title: string;
  description: string;
  category: string;
  startPrice: string;
  reservePrice: string;
  durationMinutes: string;
  floorAction: string; // "lottery" | "withdraw"
  act1Highlight: string;
  act2Highlight: string;
  act3Highlight: string;
}

const INITIAL: FormState = {
  title: "",
  description: "",
  category: "Electronics",
  startPrice: "",
  reservePrice: "",
  durationMinutes: "15",
  floorAction: "lottery",
  act1Highlight: "",
  act2Highlight: "",
  act3Highlight: "",
};

const LISTING_FEE = 20; // coins

export default function SellPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ displayName: string } | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const startPriceNum = Number(form.startPrice) || 0;
  const reservePriceNum = Number(form.reservePrice) || 0;
  const spread = Math.max(0, startPriceNum - reservePriceNum);
  const estimatedFee = Math.round(spread * 0.1 + startPriceNum * 0.05);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) { setShowAuth(true); return; }
    if (!form.title.trim()) return setError("Item title is required.");
    if (!form.startPrice || startPriceNum <= 0) return setError("Start price must be greater than 0.");
    if (!form.reservePrice || reservePriceNum < 0) return setError("Reserve price cannot be negative.");
    if (reservePriceNum >= startPriceNum) return setError("Reserve price must be lower than start price.");
    if (!form.act1Highlight.trim() || !form.act2Highlight.trim() || !form.act3Highlight.trim()) {
      return setError("All three act highlights are required.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auctions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          startPrice: startPriceNum,
          reservePrice: reservePriceNum,
          durationMinutes: Number(form.durationMinutes),
          floorAction: form.floorAction === "withdraw" ? "withdraw" : "lottery",
          acts: [
            { actNo: 1, headline: form.act1Highlight.trim() },
            { actNo: 2, headline: form.act2Highlight.trim() },
            { actNo: 3, headline: form.act3Highlight.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-lg text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-drop-green/10 border border-drop-green/30 flex items-center justify-center">
            <Check className="w-8 h-8 text-drop-green" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-2xl text-foreground">Listing submitted.</h1>
            <p className="text-muted-foreground text-sm mt-2 text-balance">
              Your item will be reviewed and scheduled for a live auction slot.
              {LISTING_FEE} coins have been reserved from your wallet.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4 w-full text-left bg-card">
            <p className="font-mono text-xs text-muted-foreground mb-1">Item</p>
            <p className="font-semibold text-foreground">{form.title}</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
              <div>
                <p className="text-muted-foreground">Start price</p>
                <p className="text-foreground">{startPriceNum.toLocaleString()} coins</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reserve price</p>
                <p className="text-foreground">{reservePriceNum.toLocaleString()} coins</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="text-foreground">{form.durationMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="text-foreground">{form.category}</p>
              </div>
            </div>
          </div>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors text-sm font-semibold"
          >
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user ?? null));
          }}
        />
      )}
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to lobby
        </Link>

        <div className="mb-8">
          <h1 className="font-mono font-bold text-2xl text-foreground">List an item for auction</h1>
          <p className="text-muted-foreground text-sm mt-2 text-pretty">
            Set your prices, write three act highlights that reveal during the auction, and pay the flat listing fee.
            You keep the sale price minus 5% base commission and 10% of the spread above reserve.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* ── Item details ───────────────────────────────── */}
          <section className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-amber">Item details</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                maxLength={120}
                placeholder="e.g. Sony WH-1000XM5 — Brand New Sealed"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="description">Description</label>
              <textarea
                id="description"
                rows={3}
                placeholder="Condition, what's included, any caveats..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="category">Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </section>

          {/* ── Pricing ────────────────────────────────────── */}
          <section className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-amber">Pricing</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="startPrice">
                  Start price (coins)
                </label>
                <input
                  id="startPrice"
                  type="number"
                  min={1}
                  placeholder="1200"
                  value={form.startPrice}
                  onChange={(e) => set("startPrice", e.target.value)}
                  className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="reservePrice">
                  Reserve / floor (coins)
                </label>
                <input
                  id="reservePrice"
                  type="number"
                  min={0}
                  placeholder="200"
                  value={form.reservePrice}
                  onChange={(e) => set("reservePrice", e.target.value)}
                  className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="duration">
                Duration: {form.durationMinutes} minutes
              </label>
              <input
                id="duration"
                type="range"
                min={5}
                max={60}
                step={5}
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value)}
                className="accent-amber"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>5 min</span>
                <span>60 min</span>
              </div>
            </div>

            {/* Floor behaviour */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                If the price reaches your floor with no claim
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "lottery", title: "Floor lottery", sub: "A random fully-armed bidder wins at your floor price. Always sells." },
                  { value: "withdraw", title: "Withdraw unsold", sub: "Item is taken down — not sold. You can relist it later." },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("floorAction", opt.value)}
                    className={
                      "text-left rounded-md border p-3 transition-all " +
                      (form.floorAction === opt.value
                        ? "border-amber/50 bg-amber/5"
                        : "border-border hover:border-amber/30")
                    }
                  >
                    <p className={"text-sm font-semibold " + (form.floorAction === opt.value ? "text-amber" : "text-foreground")}>
                      {opt.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee preview */}
            {startPriceNum > 0 && reservePriceNum >= 0 && reservePriceNum < startPriceNum && (
              <div className="rounded-md bg-muted p-3 flex flex-col gap-1 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Info className="w-3.5 h-3.5" />
                  Fee estimate (if claimed at start price)
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Listing fee (flat)</span>
                  <span className="text-foreground">{LISTING_FEE} coins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base commission (5%)</span>
                  <span className="text-foreground">{Math.round(startPriceNum * 0.05).toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spread bonus fee (10%)</span>
                  <span className="text-foreground">{Math.round(spread * 0.1).toLocaleString()} coins</span>
                </div>
                <div className="border-t border-border mt-1 pt-1 flex justify-between">
                  <span className="text-foreground font-semibold">You receive</span>
                  <span className="text-drop-green font-semibold">
                    {Math.max(0, startPriceNum - estimatedFee).toLocaleString()} coins
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ── Act highlights ─────────────────────────────── */}
          <section className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-widest text-amber">Act highlights</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Three selling points revealed during price pauses. Make them escalate: good → better → must-have.
              </p>
            </div>

            {([1, 2, 3] as const).map((n) => {
              const key = `act${n}Highlight` as keyof FormState;
              const pct = n === 1 ? "25%" : n === 2 ? "50%" : "75%";
              return (
                <div key={n} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`act${n}`}>
                    Act {n} — revealed at {pct} of duration
                  </label>
                  <input
                    id={`act${n}`}
                    type="text"
                    maxLength={120}
                    placeholder={
                      n === 1 ? "e.g. Original packaging, never opened" :
                      n === 2 ? "e.g. 2-year warranty card included" :
                      "e.g. Exclusive colour — sold out worldwide"
                    }
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber"
                  />
                </div>
              );
            })}
          </section>

          {/* ── Submit ─────────────────────────────────────── */}
          {error && (
            <p className="text-drop-red text-xs border border-drop-red/20 bg-drop-red/5 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Auth banner — shown when user is not signed in */}
          {user === null && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber/30 bg-amber/5 px-4 py-3">
              <p className="text-xs text-muted-foreground font-mono">
                Sign in to submit your listing.
              </p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber text-amber-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                Sign in
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground font-mono">
              {user
                ? <>Listing fee: <span className="text-foreground">{LISTING_FEE} coins</span> (charged on submit)</>
                : <>Sign in required to list items</>}
            </p>
            <button
              type="submit"
              disabled={loading || user === undefined}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-amber text-amber-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {user === null ? "Sign in to list" : "Submit listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
