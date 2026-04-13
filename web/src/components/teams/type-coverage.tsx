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

  return (
    <div className="flex flex-col gap-4">
      {/* Offensive */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Offensive Coverage
          </span>
          <span className="font-display text-xs text-secondary">
            {superEffectiveCount}/18 types hit SE
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {offensiveCoverage.map(({ type, multiplier }) => (
            <CoverageCell key={type} type={type} multiplier={multiplier} mode="offensive" />
          ))}
        </div>
      </div>

      {/* Defensive */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Defensive Coverage
          </span>
          <span className="font-display text-xs text-secondary">
            {resistedCount}/18 types resisted
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {defensiveCoverage.map(({ type, multiplier }) => (
            <CoverageCell key={type} type={type} multiplier={multiplier} mode="defensive" />
          ))}
        </div>
      </div>
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
  let bgClass: string;
  let label: string;

  if (mode === "offensive") {
    if (multiplier >= 2) {
      bgClass = "bg-secondary-container";
      label = "SE";
    } else if (multiplier === 0) {
      bgClass = "bg-tertiary-container";
      label = "0";
    } else if (multiplier < 1) {
      bgClass = "bg-surface-high";
      label = "NVE";
    } else {
      bgClass = "bg-surface-mid";
      label = "1x";
    }
  } else {
    if (multiplier === 0) {
      bgClass = "bg-secondary-container";
      label = "IMM";
    } else if (multiplier <= 0.5) {
      bgClass = "bg-secondary-container";
      label = multiplier === 0.25 ? "1/4" : "1/2";
    } else if (multiplier >= 2) {
      bgClass = "bg-tertiary-container";
      label = multiplier === 4 ? "4x" : "2x";
    } else {
      bgClass = "bg-surface-mid";
      label = "1x";
    }
  }

  return (
    <div
      className={`${bgClass} flex w-16 flex-col items-center rounded-chunky px-1.5 py-1.5`}
      title={`${type}: ${multiplier}x`}
    >
      <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {type.slice(0, 3)}
      </span>
      <span className="font-display text-[0.65rem] font-semibold text-on-surface">
        {label}
      </span>
    </div>
  );
}
