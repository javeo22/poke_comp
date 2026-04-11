"use client";

import type { PokemonType } from "@/types/pokemon";

const TYPE_COLORS: Record<PokemonType, string> = {
  normal: "bg-type-normal",
  fire: "bg-type-fire",
  water: "bg-type-water",
  electric: "bg-type-electric",
  grass: "bg-type-grass",
  ice: "bg-type-ice",
  fighting: "bg-type-fighting",
  poison: "bg-type-poison",
  ground: "bg-type-ground",
  flying: "bg-type-flying",
  psychic: "bg-type-psychic",
  bug: "bg-type-bug",
  rock: "bg-type-rock",
  ghost: "bg-type-ghost",
  dragon: "bg-type-dragon",
  dark: "bg-type-dark",
  steel: "bg-type-steel",
  fairy: "bg-type-fairy",
};

export function TypeBadge({ type }: { type: string }) {
  const colorClass = TYPE_COLORS[type as PokemonType] || "bg-outline-variant";

  return (
    <span
      className={`${colorClass} inline-block rounded-pill px-3 py-0.5 font-display text-xs font-medium uppercase tracking-widest text-surface`}
    >
      {type}
    </span>
  );
}
