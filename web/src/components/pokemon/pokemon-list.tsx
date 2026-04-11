"use client";

import type { Pokemon } from "@/types/pokemon";
import { PokemonCard } from "./pokemon-card";

interface PokemonListProps {
  pokemon: Pokemon[];
  count: number;
  isLoading: boolean;
}

export function PokemonList({ pokemon, count, isLoading }: PokemonListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-chunky bg-surface-low"
          />
        ))}
      </div>
    );
  }

  if (pokemon.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-display text-lg text-on-surface-muted">
          No Pokemon found
        </p>
        <p className="mt-1 text-sm text-on-surface-muted">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
        {count} result{count !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pokemon.map((p) => (
          <PokemonCard key={p.id} pokemon={p} />
        ))}
      </div>
    </>
  );
}
