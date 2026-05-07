"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { disableDemoMode, isDemoModeEnabled } from "@/lib/demo-data";

function subscribeToDemoStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("pokecomp-storage", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("pokecomp-storage", callback);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function DemoBanner() {
  const enabled = useSyncExternalStore(
    subscribeToDemoStorage,
    isDemoModeEnabled,
    getServerSnapshot
  );

  if (!enabled) return null;

  return (
    <div className="relative z-20 border-b border-outline-variant bg-primary/12 px-6 py-2 text-center">
      <div className="mx-auto flex max-w-[82rem] flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-on-surface">
        <span className="font-display font-semibold uppercase tracking-wider text-primary">
          Demo mode
        </span>
        <span className="font-body text-on-surface-muted">
          You are viewing read-only sample roster, team, cheatsheet, draft, and match data.
        </span>
        <Link href="/login" className="font-display text-primary hover:text-accent">
          Sign in to save your own data
        </Link>
        <button
          type="button"
          onClick={disableDemoMode}
          className="font-display text-on-surface-muted hover:text-on-surface"
        >
          Exit demo
        </button>
      </div>
    </div>
  );
}
