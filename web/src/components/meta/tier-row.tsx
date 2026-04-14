"use client";

import type { Tier } from "@/types/meta";

const TIER_COLORS: Record<Tier, { bg: string; text: string }> = {
  S: { bg: "bg-[#E8567A]/20", text: "text-[#E8567A]" },
  "A+": { bg: "bg-[#C1C1FF]/20", text: "text-[#C1C1FF]" },
  A: { bg: "bg-[#56E8C5]/20", text: "text-[#56E8C5]" },
  B: { bg: "bg-[#E2E1F1]/10", text: "text-on-surface" },
  C: { bg: "bg-[#464650]/20", text: "text-on-surface-muted" },
};

interface TierRowProps {
  tier: Tier;
  pokemon: string[];
  onPokemonClick?: (name: string) => void;
}

export function TierRow({ tier, pokemon, onPokemonClick }: TierRowProps) {
  const colors = TIER_COLORS[tier];

  if (pokemon.length === 0) return null;

  return (
    <div className="flex gap-4 items-start">
      <div
        className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}
      >
        <span className={`font-display text-lg font-bold ${colors.text}`}>
          {tier}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 py-1.5">
        {pokemon.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onPokemonClick?.(name)}
            className="rounded-lg bg-surface-mid px-3 py-1.5 font-body text-sm text-on-surface transition-all hover:bg-surface-high hover:-translate-y-0.5"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
