"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchPublicStats } from "@/lib/api";
import type { PublicStats } from "@/lib/api";
import { pokeArt, pokeSprite } from "@/lib/sprites";

const OPP_PREVIEW = [
  { id: 149, name: "Dragonite" },
  { id: 248, name: "Tyranitar" },
  { id: 376, name: "Metagross" },
  { id: 445, name: "Garchomp" },
  { id: 658, name: "Greninja" },
  { id: 887, name: "Dragapult" },
] as const;

const BRING_PREVIEW = [
  { id: 462, name: "Magnezone", types: ["electric", "steel"], item: "Air Balloon", ability: "Magnet Pull" },
  { id: 530, name: "Excadrill", types: ["ground", "steel"], item: "Focus Sash", ability: "Mold Breaker" },
  { id: 778, name: "Mimikyu", types: ["ghost", "fairy"], item: "Life Orb", ability: "Disguise" },
  { id: 681, name: "Aegislash", types: ["steel", "ghost"], item: "Weakness Policy", ability: "Stance Change" },
] as const;

const BENCH_PREVIEW = [
  { id: 392, name: "Infernape" },
  { id: 472, name: "Gliscor" },
] as const;

const META_PREVIEW = [
  { id: 445, name: "Garchomp", role: "Wallbreaker", usg: 38.4, win: 54.2, swing: "+2.1", up: true },
  { id: 248, name: "Tyranitar", role: "Trick Room", usg: 31.7, win: 56.9, swing: "+4.4", up: true },
  { id: 658, name: "Greninja", role: "Sweeper", usg: 27.1, win: 51.0, swing: "-1.2", up: false },
  { id: 376, name: "Metagross", role: "Lead", usg: 24.8, win: 49.7, swing: "+0.3", up: true },
  { id: 149, name: "Dragonite", role: "DD Pivot", usg: 22.0, win: 52.5, swing: "+1.6", up: true },
  { id: 887, name: "Dragapult", role: "Disrupt", usg: 19.3, win: 48.1, swing: "-0.8", up: false },
] as const;

const ROSTER_PREVIEW = [462, 530, 778, 681, 392, 472, 143, 212, 260, 376, 635, 706, 800, 477] as const;

const KEY_ROLLS = [
  { atk: "Magnezone", mv: "Body Press", def: "Tyranitar", pct: "92–108", k: "OHKO" as const },
  { atk: "Excadrill", mv: "Earthquake", def: "Metagross", pct: "78–92", k: "2HKO" as const },
  { atk: "Mimikyu", mv: "Play Rough", def: "Dragapult", pct: "88–104", k: "OHKO" as const },
];

const TYPE_HEX: Record<string, string> = {
  electric: "#F7D02C",
  steel: "#B7B7CE",
  ground: "#E2BF65",
  ghost: "#735797",
  fairy: "#D685AD",
};

export default function HomePage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [trends, setTrends] = useState<MetaTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => {});
    fetchMetaTrends("doubles", 6)
      .then(setTrends)
      .catch((err) => console.error("Failed to fetch trends:", err))
      .finally(() => setLoadingTrends(false));
  }, []);

  const lobbiesAnalyzed = stats?.matches_count ?? 12481;

  return (
    <div className="relative z-10 w-full">
      {/* HERO */}
      <section className="mx-auto max-w-[82rem] px-6 pt-10 pb-2 sm:px-9">
        <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-3 py-1 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-on-surface-muted">
            New · Season 1 Engine · {lobbiesAnalyzed.toLocaleString()} Lobbies
          </span>
        </div>

        <h1 className="font-display font-bold tracking-[-0.045em] text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[5.25rem] lg:leading-[0.96] text-on-surface m-0">
          Win team-preview.{" "}
          <span className="text-gradient">Before turn one.</span>
        </h1>

        <p className="mt-5 max-w-[44rem] text-base sm:text-[1.05rem] leading-relaxed text-on-surface-muted">
          Drop in any opponent&apos;s six. PokeComp returns your bring-4, lead pair,
          damage rolls, and a plain-English plan — built on real ranked lobbies
          and refreshed every six hours.
        </p>
      </section>

      {/* LIVE DRAFT BOARD */}
      <section className="mx-auto max-w-[82rem] px-6 pt-7 pb-8 sm:px-9">
        <div
          className="overflow-hidden rounded-2xl border border-outline-variant"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,12,28,0.85), rgba(15,9,22,0.85))",
            boxShadow:
              "0 40px 80px -40px rgba(255,45,122,0.4), 0 0 0 1px rgba(255,210,63,0.04) inset",
          }}
        >
          {/* Board header */}
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="pulse-dot" />
              <span className="font-mono text-[0.7rem] tracking-[0.22em] text-primary">
                LIVE DRAFT BOARD
              </span>
              <span className="font-mono text-[0.7rem] tracking-[0.15em] text-on-surface-dim">
                · LOBBY #7842 · BO3 G1
              </span>
            </div>
            <div className="font-mono text-[0.65rem] tracking-[0.15em] text-on-surface-muted">
              ENGINE 4.8s · CONF 0.82
            </div>
          </div>

          {/* Body — 2-column grid: opponent + bring-4 // verdict */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
            {/* LEFT */}
            <div className="border-b border-outline-variant lg:border-b-0 lg:border-r p-5 sm:p-6">
              {/* Opponent */}
              <div className="mb-3 flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-mono text-[0.7rem] tracking-[0.22em] text-primary">
                  ◆ OPPONENT · 6
                </span>
                <span className="font-mono text-[0.65rem] tracking-[0.15em] text-on-surface-dim">
                  archetype: hyperoffense / weather
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2 mb-6">
                {OPP_PREVIEW.map((p) => (
                  <div
                    key={p.id}
                    className="relative aspect-square overflow-hidden rounded-lg border border-primary/25"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 70%, rgba(255,45,122,0.18), rgba(15,9,22,0.6))",
                    }}
                  >
                    <Image
                      src={pokeArt(p.id)}
                      alt={p.name}
                      width={120}
                      height={120}
                      unoptimized
                      className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
                    />
                    <div className="absolute inset-x-1 bottom-1 rounded-sm bg-surface/70 py-0.5 text-center font-mono text-[0.55rem] uppercase tracking-wide text-on-surface">
                      {p.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Your bring-4 */}
              <div className="mb-3 flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-mono text-[0.7rem] tracking-[0.22em] text-accent">
                  ◆ YOUR BRING-4 · AI PICKED
                </span>
                <span className="font-mono text-[0.65rem] tracking-[0.15em] text-on-surface-dim">
                  roster · 14 mons
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {BRING_PREVIEW.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-accent/35 p-2.5"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,210,63,0.07), rgba(15,9,22,0.6))",
                    }}
                  >
                    <div className="relative aspect-square mb-2">
                      <Image
                        src={pokeArt(p.id)}
                        alt={p.name}
                        fill
                        unoptimized
                        sizes="160px"
                        className="object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                      />
                    </div>
                    <div className="font-display text-[0.85rem] font-bold mb-1 text-on-surface">
                      {p.name}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.types.map((t) => (
                        <TypePill key={t} t={t} sm />
                      ))}
                    </div>
                    <div className="font-mono text-[0.6rem] leading-snug text-on-surface-muted">
                      <div>@ {p.item}</div>
                      <div className="text-on-surface-dim">{p.ability}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bench */}
              <div className="mt-4 flex items-center gap-3 font-mono text-[0.6rem] tracking-[0.15em] text-on-surface-dim flex-wrap">
                <span>BENCHED:</span>
                {BENCH_PREVIEW.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 opacity-70">
                    <Image
                      src={pokeSprite(p.id)}
                      alt=""
                      width={22}
                      height={22}
                      unoptimized
                      className="image-rendering-pixelated"
                    />
                    <span>{p.name.toUpperCase()}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT — Verdict */}
            <div className="p-5 sm:p-6 bg-[rgba(10,5,16,0.4)]">
              <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-3">
                ◆ AI VERDICT
              </div>

              {/* Lead pair */}
              <div
                className="rounded-xl p-4 mb-3.5 border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,45,122,0.12), rgba(255,210,63,0.06))",
                  borderColor: "rgba(255,45,122,0.35)",
                }}
              >
                <div className="font-mono text-[0.65rem] tracking-[0.22em] text-primary mb-2.5">
                  LEAD PAIR
                </div>
                <div className="flex items-center gap-2">
                  <LeadTile id={462} name="Magnezone" />
                  <span className="font-mono text-xl font-bold text-accent">+</span>
                  <LeadTile id={530} name="Excadrill" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[0.7rem] text-on-surface-muted flex-wrap">
                  <span>vs Tyranitar / Garchomp lead</span>
                  <span className="text-success font-bold">+9.4% WR</span>
                </div>
              </div>

              {/* Key rolls */}
              <div className="mb-3.5">
                <div className="font-mono text-[0.65rem] tracking-[0.22em] text-on-surface-muted mb-2">
                  KEY ROLLS
                </div>
                {KEY_ROLLS.map((r, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_auto_auto] gap-2 py-1.5 font-mono text-[0.7rem] ${
                      i === 0 ? "" : "border-t border-outline-variant"
                    }`}
                  >
                    <span className="text-on-surface">
                      {r.atk}{" "}
                      <span className="text-on-surface-dim">·</span>{" "}
                      <span className="text-on-surface-muted">{r.mv}</span>{" "}
                      <span className="text-on-surface-dim">vs</span> {r.def}
                    </span>
                    <span className="text-on-surface-muted">{r.pct}%</span>
                    <span
                      className={`font-bold ${
                        r.k === "OHKO" ? "text-primary" : "text-accent"
                      }`}
                    >
                      {r.k}
                    </span>
                  </div>
                ))}
              </div>

              {/* Game plan */}
              <div
                className="rounded-lg border p-3.5 font-display text-[0.85rem] leading-relaxed"
                style={{
                  background: "rgba(126,34,206,0.10)",
                  borderColor: "rgba(126,34,206,0.27)",
                  color: "#cfc4dd",
                }}
              >
                <div className="font-mono text-[0.65rem] tracking-[0.22em] text-[#c084fc] mb-2">
                  ◆ GAME PLAN
                </div>
                Trap <strong className="text-accent">Tyranitar</strong> with Magnezone turn 1 to
                remove the Steel-checker. Pivot to{" "}
                <strong className="text-accent">Excadrill</strong> in sand for the sweep. Save
                Aegislash for the Dragapult mirror — King&apos;s Shield baits Phantom Force.{" "}
                <span className="text-primary">
                  Watch for Choice Scarf on Greninja
                </span>{" "}
                (28% probable).
              </div>

              {/* CTA */}
              <div className="mt-4 flex gap-2.5">
                <Link
                  href="/draft"
                  className="btn-primary flex-1 px-4 py-3 text-center text-sm"
                >
                  Run on my lobby →
                </Link>
                <button className="btn-ghost px-4 py-3 text-sm">Save plan</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* META MOVERS */}
      <section className="mx-auto max-w-[82rem] px-6 pt-10 pb-3 sm:px-9">
        <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-1.5">
              ◆ META MOVERS · WK 17
            </div>
            <h2 className="m-0 font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-on-surface">
              What&apos;s climbing. What&apos;s collapsing.
            </h2>
          </div>
          <div className="font-mono text-[0.7rem] tracking-[0.18em] text-on-surface-dim text-right leading-relaxed">
            n=12,481 · refreshed 6h ago
            <br />
            pikalytics · smogon · limitless
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {META_PREVIEW.map((p) => (
            <Link
              key={p.id}
              href={`/pokemon/${p.id}`}
              className="card-interactive relative overflow-hidden p-3.5"
            >
              <Image
                src={pokeArt(p.id)}
                alt={p.name}
                width={110}
                height={110}
                unoptimized
                className="absolute -right-4 -top-2.5 h-[110px] w-[110px] opacity-25"
              />
              <div className="relative">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-on-surface">
                    {p.name}
                  </span>
                  <span
                    className={`font-mono text-[0.65rem] font-bold ${
                      p.up ? "text-success" : "text-primary"
                    }`}
                  >
                    {p.up ? "▲" : "▼"} {p.swing}
                  </span>
                </div>
                <div className="font-mono text-[0.55rem] tracking-[0.18em] text-on-surface-dim mb-3 uppercase">
                  {p.role}
                </div>
                <div className="h-1 rounded-full bg-outline-variant overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(p.usg * 2, 100)}%`,
                      background:
                        "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                    }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[0.65rem] text-on-surface-muted">
                  <span>USG {p.usg}%</span>
                  <span>WR {p.win}%</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ROSTER + CHEATSHEET split */}
      <section className="mx-auto max-w-[82rem] px-6 pt-9 pb-12 sm:px-9 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
        {/* ROSTER */}
        <div className="card p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[0.7rem] tracking-[0.22em] text-primary mb-1.5">
                ◆ YOUR ROSTER · 14 MONS
              </div>
              <h3 className="m-0 font-display text-2xl font-bold tracking-[-0.02em] text-on-surface">
                Track every build.
              </h3>
            </div>
            <Link
              href="/roster"
              className="btn-ghost px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em]"
            >
              Open Roster →
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {ROSTER_PREVIEW.map((id) => (
              <div
                key={id}
                className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant bg-[rgba(10,5,16,0.5)]"
              >
                <Image
                  src={pokeSprite(id)}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-contain image-rendering-pixelated"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { k: "BUILT", n: 8, c: "var(--color-success)" },
              { k: "TRAINING", n: 4, c: "var(--color-accent)" },
              { k: "WISHLIST", n: 2, c: "var(--color-primary)" },
            ].map((s) => (
              <div
                key={s.k}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-[rgba(10,5,16,0.5)] px-3 py-1.5"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.c }}
                />
                <span className="font-mono text-[0.6rem] tracking-[0.18em] text-on-surface-muted">
                  {s.k}
                </span>
                <span className="font-mono text-[0.7rem] font-bold text-on-surface">
                  {s.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CHEATSHEET preview */}
        <div
          className="rounded-2xl p-6 border border-accent/25 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,210,63,0.10), rgba(126,34,206,0.08))",
          }}
        >
          <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-1.5">
                ◆ PRE-MATCH CHEATSHEET
              </div>
              <h3 className="m-0 font-display text-2xl font-bold tracking-[-0.02em] text-on-surface">
                Print it. Or read it.
              </h3>
            </div>
            <span className="font-mono text-[0.65rem] tracking-[0.18em] text-on-surface-muted">
              A4 · PDF
            </span>
          </div>

          <div
            className="rounded-md p-4 font-display"
            style={{
              background: "#FAF7F0",
              color: "#0a0510",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between border-b-2 border-[#0a0510] pb-2 mb-2.5">
              <span className="font-extrabold text-base tracking-[-0.01em]">
                TEAM SHEET — Sand Offense
              </span>
              <span className="font-mono text-[0.55rem] tracking-[0.15em] text-[#7a6f60]">
                v3 · APR 27
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1 mb-2.5">
              {[248, 530, 462, 887, 778, 681].map((id) => (
                <div
                  key={id}
                  className="relative aspect-square border border-[#0a0510] bg-white"
                >
                  <Image
                    src={pokeSprite(id)}
                    alt=""
                    fill
                    unoptimized
                    sizes="60px"
                    className="object-contain image-rendering-pixelated"
                  />
                </div>
              ))}
            </div>

            <div className="font-mono text-[0.6rem] tracking-[0.15em] text-[#7a6f60] mb-1">
              SPEED TIERS
            </div>
            <div className="font-mono text-[0.7rem] text-[#0a0510] leading-relaxed">
              <div>
                Greninja 122{" "}
                <span className="text-[#7a6f60]">· outspeeds Garchomp</span>
              </div>
              <div>
                Excadrill 135 (sand){" "}
                <span className="text-[#7a6f60]">· beats Dragapult</span>
              </div>
              <div>Magnezone 60 + Trick Room → 240</div>
            </div>

            <div className="font-mono text-[0.6rem] tracking-[0.15em] text-[#7a6f60] mt-2.5 mb-1">
              WATCH OUT
            </div>
            <div className="text-[0.72rem] leading-snug text-[#0a0510]">
              Choice Scarf Greninja • Booster Energy Iron Hands • Specs Dragapult Draco
            </div>
          </div>

          <Link
            href="/cheatsheet"
            className="btn-primary mt-4 block w-full px-4 py-3 text-center text-sm"
          >
            Build a Cheatsheet →
          </Link>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="mx-auto max-w-[82rem] px-6 pt-3 pb-20 sm:px-9 text-center">
        <div className="h-px mb-12 bg-gradient-to-r from-transparent via-outline-variant to-transparent" />
        <h2 className="m-0 font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-bold leading-tight tracking-[-0.035em] text-on-surface">
          Free to use.{" "}
          <span className="text-gradient">Built for grinders.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-on-surface-muted text-base">
          A solo fan project. Not affiliated with The Pokemon Company. Sprites via
          PokeAPI · usage from Pikalytics, Smogon, Limitless.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/draft" className="btn-primary px-7 py-3 text-sm">
            Run a Draft →
          </Link>
          <Link href="/pokemon" className="btn-ghost px-7 py-3 text-sm">
            Browse Pokedex
          </Link>
        </div>
      </section>

      {/* Stats strip — only when real data is present */}
      {stats && (stats.pokemon_count > 0 || stats.teams_count > 0) && (
        <section className="border-t border-outline-variant py-10">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-12 px-6 flex-wrap">
            <StatItem value={stats.pokemon_count} label="Champions Pokemon" />
            <StatItem value={stats.teams_count} label="Teams Built" />
            <StatItem value={stats.matches_count} label="Matches Tracked" />
          </div>
        </section>
      )}
    </div>
  );
}

function LeadTile({ id, name }: { id: number; name: string }) {
  return (
    <div className="relative flex-1 aspect-[1.1] overflow-hidden rounded-lg border border-primary/40 bg-[rgba(15,9,22,0.6)]">
      <Image
        src={pokeArt(id)}
        alt={name}
        fill
        unoptimized
        sizes="160px"
        className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain"
      />
      <div className="absolute inset-x-0 bottom-1.5 text-center font-display text-[0.8rem] font-bold text-on-surface">
        {name}
      </div>
    </div>
  );
}

function TypePill({ t, sm = false }: { t: string; sm?: boolean }) {
  const c = TYPE_HEX[t.toLowerCase()] ?? "var(--color-on-surface-muted)";
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-bold uppercase ${
        sm ? "px-1.5 py-px text-[0.5rem] tracking-[0.1em]" : "px-2 py-px text-[0.55rem] tracking-[0.1em]"
      }`}
      style={{ background: c, color: "var(--color-surface)" }}
    >
      {t}
    </span>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-accent">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-on-surface-muted">
        {label}
      </div>
    </div>
  );
}
function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-accent">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-on-surface-muted">
        {label}
      </div>
    </div>
  );
}
