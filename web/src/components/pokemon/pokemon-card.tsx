"use client";

import Image from "next/image";
import type { Pokemon } from "@/types/pokemon";
import { TypeBadge } from "./type-badge";
import { StatBar } from "./stat-bar";

export function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const totalStats = Object.values(pokemon.base_stats).reduce(
    (sum, v) => sum + v,
    0
  );

  return (
    <div className="group relative rounded-chunky bg-surface-low p-5 transition-all duration-200 hover:bg-surface-mid gloss-top">
      {/* Champions LED */}
      {pokemon.champions_eligible && (
        <div className="absolute top-4 right-4 led led-active" title="Champions eligible" />
      )}

      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        {pokemon.sprite_url && (
          <Image
            src={pokemon.sprite_url}
            alt={pokemon.name}
            width={56}
            height={56}
            className="image-rendering-pixelated"
            unoptimized
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.65rem] uppercase tracking-[0.05rem] text-on-surface-muted">
            #{String(pokemon.id).padStart(4, "0")}
          </p>
          <h3 className="truncate font-display text-lg font-semibold text-on-surface">
            {pokemon.name}
          </h3>
        </div>
      </div>

      {/* Types */}
      <div className="mb-4 flex gap-2">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        {Object.entries(pokemon.base_stats).map(([stat, value]) => (
          <StatBar key={stat} stat={stat} value={value} />
        ))}
      </div>

      {/* BST footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-[0.65rem] uppercase tracking-[0.05rem] text-on-surface-muted">
          BST
        </span>
        <span className="font-display text-sm font-semibold text-primary">
          {totalStats}
        </span>
      </div>
    </div>
  );
}
