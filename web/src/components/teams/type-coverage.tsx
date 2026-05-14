"use client";

import {
  formatType,
  getDefensiveCoverage,
  getOffensiveCoverage,
} from "@/lib/type-effectiveness";

interface TypeCoverageProps {
  teamTypes: string[][]; // array of type arrays, one per team member
}

export function TypeCoverage({ teamTypes }: TypeCoverageProps) {
  if (teamTypes.length === 0) return null;

  // Offensive: for each attacking type, how many of the 18 types can the team hit super-effectively?
  const teamAttackTypes = [...new Set(teamTypes.flat())];

  const offensiveCoverage = getOffensiveCoverage(teamAttackTypes);

  // Defensive: for each attacking type, what's the team's best resistance?
  const defensiveCoverage = getDefensiveCoverage(teamTypes);

  const superEffectiveCount = offensiveCoverage.filter((c) => c.multiplier >= 2).length;
  const resistedCount = defensiveCoverage.filter((c) => c.multiplier <= 0.5).length;
  const offensiveGaps = offensiveCoverage
    .filter((c) => c.multiplier < 2)
    .map((c) => c.type);
  const noSwitchIns = defensiveCoverage
    .filter((c) => c.multiplier > 0.5)
    .map((c) => c.type);

  return (
    <div className="flex flex-col gap-5">
      {/* Offensive */}
      <section className="rounded-xl border border-outline-variant/70 bg-surface-lowest p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Offensive Coverage
          </span>
          <span className="rounded-md bg-secondary/15 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-secondary">
            {superEffectiveCount}/18 types hit SE
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-9">
          {offensiveCoverage.map(({ type, multiplier }) => (
            <CoverageCell key={type} type={type} multiplier={multiplier} mode="offensive" />
          ))}
        </div>
        <CoverageNotes
          label="SE gaps"
          types={offensiveGaps}
          emptyLabel="All types covered"
          tone={offensiveGaps.length === 0 ? "positive" : "warning"}
        />
      </section>

      {/* Defensive */}
      <section className="rounded-xl border border-outline-variant/70 bg-surface-lowest p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Defensive Coverage
          </span>
          <span className="rounded-md bg-secondary/15 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-secondary">
            {resistedCount}/18 types resisted
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-9">
          {defensiveCoverage.map(({ type, multiplier }) => (
            <CoverageCell key={type} type={type} multiplier={multiplier} mode="defensive" />
          ))}
        </div>
        <CoverageNotes
          label="No resist"
          types={noSwitchIns}
          emptyLabel="All attack types resisted"
          tone={noSwitchIns.length === 0 ? "positive" : "warning"}
        />
      </section>
    </div>
  );
}

function CoverageNotes({
  label,
  types,
  emptyLabel,
  tone,
}: {
  label: string;
  types: string[];
  emptyLabel: string;
  tone: "positive" | "warning";
}) {
  const textClass = tone === "positive" ? "text-secondary" : "text-tertiary";

  return (
    <div className="mt-2 flex items-start gap-2">
      <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </span>
      <span className={`font-body text-[0.68rem] leading-snug ${textClass}`}>
        {types.length === 0 ? emptyLabel : types.map(formatType).join(", ")}
      </span>
    </div>
  );
}

function CoverageCell({
  type,
  multiplier,
  mode,
}: {
  type: string;
  multiplier: number;
  mode: "offensive" | "defensive";
}) {
  let cellClass: string;
  let valueClass: string;
  let label: string;
  let description: string;

  if (mode === "offensive") {
    if (multiplier >= 2) {
      cellClass = "border-secondary/40 bg-secondary/15";
      valueClass = "bg-secondary text-surface";
      label = "SE";
      description = "super effective";
    } else if (multiplier === 0) {
      cellClass = "border-tertiary/40 bg-tertiary/15";
      valueClass = "bg-tertiary text-surface";
      label = "0";
      description = "no effect";
    } else if (multiplier < 1) {
      cellClass = "border-outline-variant bg-surface-low";
      valueClass = "bg-surface-high text-on-surface-muted";
      label = "NVE";
      description = "not very effective";
    } else {
      cellClass = "border-outline-variant bg-surface-lowest";
      valueClass = "bg-surface-high text-on-surface";
      label = "1x";
      description = "neutral";
    }
  } else {
    if (multiplier === 0) {
      cellClass = "border-secondary/40 bg-secondary/15";
      valueClass = "bg-secondary text-surface";
      label = "IMM";
      description = "immune";
    } else if (multiplier <= 0.5) {
      cellClass = "border-secondary/40 bg-secondary/15";
      valueClass = "bg-secondary text-surface";
      label = multiplier === 0.25 ? "1/4" : "1/2";
      description = "resisted";
    } else if (multiplier >= 2) {
      cellClass = "border-tertiary/40 bg-tertiary/15";
      valueClass = "bg-tertiary text-surface";
      label = multiplier === 4 ? "4x" : "2x";
      description = "weak";
    } else {
      cellClass = "border-outline-variant bg-surface-lowest";
      valueClass = "bg-surface-high text-on-surface";
      label = "1x";
      description = "neutral";
    }
  }

  return (
    <div
      className={`${cellClass} flex min-h-[46px] flex-col justify-between rounded-lg border px-2 py-1.5`}
      title={`${formatType(type)}: ${multiplier}x (${description})`}
    >
      <span className="truncate font-display text-[0.62rem] uppercase tracking-wider text-on-surface">
        {type.slice(0, 3)}
      </span>
      <span
        className={`${valueClass} mt-1 inline-flex h-5 items-center justify-center rounded px-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider`}
      >
        {label}
      </span>
    </div>
  );
}
