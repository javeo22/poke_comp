"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSpeedTiers, type SpeedTierEntry } from "@/lib/api";
import { calcFinalSpeed } from "@/utils/stats";

const STAT_KEYS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"] as const;

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  sp_attack: "SPA",
  sp_defense: "SPD",
  speed: "SPE",
};

const MAX_TOTAL = 66;
const MAX_PER_STAT = 32;

interface StatPointEditorProps {
  value: Record<string, number>;
  onChange: (stats: Record<string, number>) => void;
  baseStats?: Record<string, number> | null;
  nature?: string | null;
}

export function StatPointEditor({ value, onChange, baseStats, nature }: StatPointEditorProps) {
  const [speedTiers, setSpeedTiers] = useState<SpeedTierEntry[]>([]);

  useEffect(() => {
    fetchSpeedTiers("doubles", true)
      .then((res) => setSpeedTiers(res.data))
      .catch((err) => {
        console.error("Failed to fetch speed tiers:", err);
        setSpeedTiers([]);
      });
  }, []);

  const total = Object.values(value).reduce((sum, v) => sum + v, 0);
  const remaining = MAX_TOTAL - total;

  const handleChange = (key: string, newVal: number) => {
    const clamped = Math.max(0, Math.min(MAX_PER_STAT, newVal));
    const otherTotal = total - (value[key] || 0);
    const maxAllowed = Math.min(clamped, MAX_TOTAL - otherTotal);
    onChange({ ...value, [key]: maxAllowed });
  };

  // Speed tier context
  const baseSpeed = baseStats?.speed ?? 0;
  const speedInvestment = value.speed || 0;
  const finalSpeed = baseSpeed > 0 ? calcFinalSpeed(baseSpeed, speedInvestment, nature) : 0;

  // Benchmarking logic: find closest 5 meta benchmarks relative to finalSpeed
  const benchmarks = useMemo(() => {
    if (finalSpeed === 0 || speedTiers.length === 0) return [];

    const allBenchmarks: { name: string; speed: number; type: string }[] = [];
    speedTiers.forEach((tier) => {
      allBenchmarks.push({ name: tier.name, speed: tier.neutral_max, type: "neutral" });
      if (tier.positive_max !== tier.neutral_max) {
        allBenchmarks.push({ name: tier.name, speed: tier.positive_max, type: "positive" });
      }
      allBenchmarks.push({ name: tier.name, speed: tier.scarf_max, type: "scarf" });
    });

    return allBenchmarks
      .map((b) => ({ ...b, diff: b.speed - finalSpeed }))
      .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
      .slice(0, 5)
      .sort((a, b) => b.speed - a.speed);
  }, [finalSpeed, speedTiers]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
          Stat Points
        </span>
        <span
          className={`font-display text-xs font-bold ${
            remaining === 0
              ? "text-secondary"
              : remaining < 0
                ? "text-tertiary"
                : "text-on-surface-muted"
          }`}
        >
          {total} / {MAX_TOTAL}
        </span>
      </div>

      <div className="rounded-xl bg-surface-low p-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 sm:gap-x-4">
          {STAT_KEYS.map((key) => {
            const invested = value[key] || 0;
            const base = baseStats?.[key] ?? 0;
            const fillPct = (invested / MAX_PER_STAT) * 100;

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                  {STAT_LABELS[key]}
                </span>

                {/* Mini bar */}
                <div className="relative h-2 flex-1 rounded-full bg-surface-mid">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleChange(key, invested - 2)}
                    disabled={invested === 0}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-mid text-[0.6rem] text-on-surface-muted hover:bg-surface-high disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-display text-xs font-bold text-on-surface">
                    {invested}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChange(key, invested + 2)}
                    disabled={invested >= MAX_PER_STAT || remaining <= 0}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-mid text-[0.6rem] text-on-surface-muted hover:bg-surface-high disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                {/* Base stat reference */}
                {base > 0 && (
                  <span className="w-6 text-right font-display text-[0.55rem] text-on-surface-muted">
                    {base}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Speed Benchmarks */}
        {finalSpeed > 0 && benchmarks.length > 0 && (
          <div className="mt-4 border-t border-outline-variant/30 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Speed Benchmarks
              </span>
              <span className="font-mono text-[0.6rem] text-on-surface-muted">
                Current: <span className="text-on-surface font-bold">{finalSpeed}</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {benchmarks.map((b, i) => {
                const isOutspeeding = finalSpeed > b.speed;
                const isSpeedTie = finalSpeed === b.speed;

                return (
                  <div key={i} className="flex items-center justify-between rounded bg-surface-mid/40 px-2 py-1 text-[0.65rem]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={`rounded px-1 font-display text-[0.55rem] font-bold ${
                          isOutspeeding
                            ? "bg-secondary/20 text-secondary"
                            : isSpeedTie
                              ? "bg-primary/20 text-primary"
                              : "bg-tertiary/20 text-tertiary"
                        }`}
                      >
                        {isOutspeeding ? "FAST" : isSpeedTie ? "TIE" : "SLOW"}
                      </span>
                      <span className="truncate text-on-surface">
                        {b.name}{" "}
                        <span className="text-[0.55rem] uppercase opacity-60">
                          {b.type === "neutral" ? "" : b.type === "positive" ? "+Nat" : "Scarf"}
                        </span>
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 font-mono text-on-surface-muted">
                      {b.speed}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 text-center">
          <Link
            href="/speed-tiers"
            className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-on-surface-muted transition-colors hover:text-accent"
          >
            See full speed tiers →
          </Link>
        </div>
      </div>
    </div>
  );
}
