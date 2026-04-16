"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPublicStats } from "@/lib/api";
import type { PublicStats } from "@/lib/api";

const FEATURES = [
  {
    title: "Champions Pokedex",
    description: "Browse every Pokemon eligible for Champions with stats, movepools, and abilities.",
    href: "/pokemon",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    title: "Team Builder",
    description: "Build teams with type coverage analysis, mega selection, and Showdown import/export.",
    href: "/teams",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    title: "AI Draft Analysis",
    description: "Get AI-powered bring-4 recommendations, lead suggestions, and damage calcs in seconds.",
    href: "/draft",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    title: "Match Tracking",
    description: "Log matches, track win rates by team and opponent, and see your performance trends.",
    href: "/matches",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
          Your Competitive Edge in
          <br />
          <span className="text-primary">Pokemon Champions</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-on-surface-muted">
          AI-powered draft analysis, team cheatsheets, and meta tracking.
          Everything you need to compete at your best.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/pokemon"
            className="btn-primary px-8 py-3 font-display text-sm uppercase tracking-wider"
          >
            Browse Pokedex
          </Link>
          <Link
            href="/login"
            className="btn-ghost px-8 py-3 font-display text-sm uppercase tracking-wider"
          >
            Sign Up
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="card-interactive flex items-start gap-4 p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-tight text-on-surface">
                  {feature.title}
                </h3>
                <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                  {feature.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      {stats && (stats.pokemon_count > 0 || stats.teams_count > 0) && (
        <section className="border-t border-outline-variant py-12">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-12 px-6">
            <StatItem value={stats.pokemon_count} label="Champions Pokemon" />
            <StatItem value={stats.teams_count} label="Teams Built" />
            <StatItem value={stats.matches_count} label="Matches Tracked" />
          </div>
        </section>
      )}
    </div>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-primary">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
        {label}
      </div>
    </div>
  );
}
