"use client";

import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team } from "@/types/team";
import { TypeCoverage } from "./type-coverage";

interface TeamCardProps {
  team: Team;
  rosterLookup: Map<string, UserPokemon>;
  pokemonMap: Map<number, Pokemon>;
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
  onClone: (team: Team) => void;
}

const FORMAT_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
  megas: "Megas",
};

export function TeamCard({
  team,
  rosterLookup,
  pokemonMap,
  onEdit,
  onDelete,
  onClone,
}: TeamCardProps) {
  // Resolve team members
  const members = team.pokemon_ids
    .map((id) => {
      const entry = rosterLookup.get(id);
      if (!entry) return null;
      const poke = pokemonMap.get(entry.pokemon_id);
      return poke ? { entry, poke } : null;
    })
    .filter((m): m is { entry: UserPokemon; poke: Pokemon } => m !== null);

  const teamTypes = members.map((m) => m.poke.types);

  return (
    <div className="group card-interactive p-5">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-on-surface">
            {team.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
              {FORMAT_LABEL[team.format] ?? team.format}
            </span>
            {team.archetype_tag && (
              <span className="rounded-full bg-primary-container/30 px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-primary">
                {team.archetype_tag}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onClone(team)}
            className="btn-ghost h-7 px-3 font-display text-[0.6rem] uppercase tracking-wider"
          >
            Clone
          </button>
          <button
            onClick={() => onEdit(team)}
            className="btn-ghost h-7 px-3 font-display text-[0.6rem] uppercase tracking-wider"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(team.id)}
            className="h-7 rounded-lg bg-tertiary-container px-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface transition-colors hover:bg-tertiary"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Team sprites */}
      <div className="mb-4 flex gap-1">
        {members.map(({ entry, poke }) => (
          <div
            key={entry.id}
            className={`flex flex-col items-center rounded-lg p-1.5 ${
              team.mega_pokemon_id === entry.id
                ? "bg-primary-container/30"
                : "bg-surface-lowest"
            }`}
          >
            {poke.sprite_url && (
              <Image
                src={poke.sprite_url}
                alt={poke.name}
                width={36}
                height={36}
                className="image-rendering-pixelated"
                unoptimized
              />
            )}
            <span className="max-w-14 truncate text-center font-display text-[0.5rem] text-on-surface-muted">
              {poke.name}
            </span>
            {team.mega_pokemon_id === entry.id && (
              <span className="font-display text-[0.45rem] uppercase text-primary">M</span>
            )}
          </div>
        ))}
        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 6 - members.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-lowest"
          >
            <span className="text-[0.5rem] text-on-surface-muted/30">--</span>
          </div>
        ))}
      </div>

      {/* Type coverage */}
      {teamTypes.length > 0 && <TypeCoverage teamTypes={teamTypes} />}

      {/* Notes */}
      {team.notes && (
        <p className="mt-3 font-body text-[0.7rem] text-on-surface-muted">
          {team.notes}
        </p>
      )}
    </div>
  );
}
