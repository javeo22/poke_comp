"use client";

import { POKEMON_TYPES } from "@/features/pokemon/types";

// Type effectiveness chart: attacker -> defender -> multiplier
// 0 = immune, 0.5 = resisted, 1 = neutral, 2 = super effective
const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

function getEffectiveness(attackType: string, defenseType: string): number {
  return TYPE_CHART[attackType]?.[defenseType] ?? 1;
}

function getDefensiveMultiplier(attackType: string, defenderTypes: string[]): number {
  return defenderTypes.reduce((mult, dt) => mult * getEffectiveness(attackType, dt), 1);
}

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface TypeCoverageProps {
  teamTypes: string[][]; // array of type arrays, one per team member
}

export function TypeCoverage({ teamTypes }: TypeCoverageProps) {
  if (teamTypes.length === 0) return null;

  // Offensive: for each attacking type, how many of the 18 types can the team hit super-effectively?
  const teamAttackTypes = [...new Set(teamTypes.flat())];

  const offensiveCoverage = POKEMON_TYPES.map((defType) => {
    const bestMultiplier = Math.max(
      ...teamAttackTypes.map((atkType) => getEffectiveness(atkType, defType))
    );
    return { type: defType, multiplier: bestMultiplier };
  });

  // Defensive: for each attacking type, what's the team's best resistance?
  const defensiveCoverage = POKEMON_TYPES.map((atkType) => {
    const bestResistance = Math.min(
      ...teamTypes.map((types) => getDefensiveMultiplier(atkType, types))
    );
    return { type: atkType, multiplier: bestResistance };
  });

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
