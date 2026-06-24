"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Shield, Plus } from "lucide-react";
import { AuthModal } from "./AuthModal";

interface NavbarProps {
  totalWatching?: number;
  totalArmed?: number;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  balance: number;
}

export function Navbar({ totalWatching = 0, totalArmed = 0 }: NavbarProps) {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    fetchUser();
    // Re-check auth state every 3s to pick up sign-in from other components
    const id = setInterval(fetchUser, 3000);
    return () => clearInterval(id);
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-mono font-bold text-amber text-lg tracking-tight">
              Schrodinger
            </span>
            <span className="font-sans font-light text-muted-foreground text-sm hidden sm:block">
              / auction
            </span>
          </Link>

          {/* Global live stats */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {totalWatching > 0 && (
              <span className="hidden sm:flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular">{totalWatching.toLocaleString()}</span>
              </span>
            )}
            {totalArmed > 0 && (
              <span className="flex items-center gap-1.5 text-amber">
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular">{totalArmed.toLocaleString()}</span>
                <span className="hidden sm:inline">armed</span>
              </span>
            )}

            {/* Sell button */}
            <Link
              href="/sell"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-amber/40 transition-colors text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              List item
            </Link>

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-drop-green">
                  {Number(user.balance).toLocaleString()} coins
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors text-xs"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors text-xs font-semibold"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => { setShowAuth(false); fetchUser(); }}
        />
      )}
    </>
  );
}
