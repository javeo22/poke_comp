"use client";

import Image from "next/image";
import Link from "next/link";
import type { Pokemon } from "@/features/pokemon/types";
import { TypeBadge } from "./type-badge";
import { StatBar } from "./stat-bar";

export function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const totalStats = Object.values(pokemon.base_stats).reduce(
    (sum, v) => sum + v,
    0
  );

  const primaryTypeColor = `var(--color-type-${pokemon.types[0]})`;

  return (
    <Link href={`/pokemon/${pokemon.id}`} className="block">
    <div className="card-interactive p-5">
      {/* Champions indicator */}
      {pokemon.champions_eligible && (
        <div
          className="absolute top-4 right-4 status-dot"
          style={{ backgroundColor: primaryTypeColor }}
          title="Champions eligible"
        />
      )}

      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        {pokemon.sprite_url && (
          <Image
            src={pokemon.sprite_url}
            alt={pokemon.name}
            width={56}
            height={56}
            className="image-rendering-pixelated drop-shadow-md"
            unoptimized
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
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
      <div className="mt-4 flex items-center justify-between">
        <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
          BST
        </span>
        <span className="font-display text-sm font-semibold" style={{ color: primaryTypeColor }}>
          {totalStats}
        </span>
      </div>
    </div>
    </Link>
  );
}
