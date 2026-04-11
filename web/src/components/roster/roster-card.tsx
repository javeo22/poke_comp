"use client";

import Image from "next/image";
import type { Pokemon } from "@/types/pokemon";
import type { UserPokemon } from "@/types/user-pokemon";
import { TypeBadge } from "@/components/pokemon/type-badge";

const STATUS_LED: Record<string, string> = {
  built: "led-active",
  training: "led-training",
  wishlist: "led-wishlist",
};

const STATUS_LABEL: Record<string, string> = {
  built: "Built",
  training: "Training",
  wishlist: "Wishlist",
};

interface RosterCardProps {
  entry: UserPokemon;
  pokemon: Pokemon | undefined;
  onEdit: (entry: UserPokemon) => void;
  onDelete: (id: string) => void;
}

export function RosterCard({ entry, pokemon, onEdit, onDelete }: RosterCardProps) {
  if (!pokemon) return null;

  const statusKey = entry.build_status || "wishlist";

  return (
    <div className="group relative rounded-chunky bg-surface-low p-5 transition-all duration-200 hover:bg-surface-mid gloss-top">
      {/* Status LED */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
          {STATUS_LABEL[statusKey]}
        </span>
        <div className={`led ${STATUS_LED[statusKey]}`} />
      </div>

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
      <div className="mb-3 flex gap-2">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>

      {/* Build details */}
      <div className="mb-3 flex flex-col gap-1.5 text-sm">
        {entry.ability && (
          <div className="flex justify-between">
            <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">Ability</span>
            <span className="font-body text-xs text-on-surface">{entry.ability}</span>
          </div>
        )}
        {entry.nature && (
          <div className="flex justify-between">
            <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">Nature</span>
            <span className="font-body text-xs text-on-surface">{entry.nature}</span>
          </div>
        )}
        {entry.moves && entry.moves.length > 0 && (
          <div>
            <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">Moves</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.moves.map((m) => (
                <span
                  key={m}
                  className="rounded-pill bg-surface-mid px-2 py-0.5 font-body text-[0.65rem] text-on-surface"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VP + Notes footer */}
      <div className="flex items-center justify-between">
        {entry.vp_spent > 0 && (
          <span className="font-display text-xs text-primary">
            {entry.vp_spent.toLocaleString()} VP
          </span>
        )}
        {entry.notes && (
          <span className="max-w-[60%] truncate font-body text-[0.65rem] text-on-surface-muted" title={entry.notes}>
            {entry.notes}
          </span>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(entry)}
          className="h-7 rounded-pill bg-surface-high px-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="h-7 rounded-pill bg-tertiary-container px-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface transition-colors hover:bg-tertiary"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
