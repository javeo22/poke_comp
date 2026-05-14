"use client";

import Image from "next/image";
import { SpriteFallback } from "@/components/ui/sprite-fallback";
import Link from "next/link";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team } from "@/types/team";
import { TypeCoverage } from "./type-coverage";

interface TeamCardProps {
  team: Team;
  rosterLookup: Map<string, UserPokemon>;
  pokemonMap: Map<number, Pokemon>;
  hasCheatsheet?: boolean;
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
  onClone: (team: Team) => void;
  onExport: (team: Team) => void;
  onBenchmark?: (team: Team) => void;
}

const FORMAT_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

function getTeamMegaSelections(team: Team) {
  const rosterIds =
    team.mega_pokemon_ids && team.mega_pokemon_ids.length > 0
      ? team.mega_pokemon_ids
      : team.mega_pokemon_id
        ? [team.mega_pokemon_id]
        : [];
  const formIds =
    team.mega_form_pokemon_ids && team.mega_form_pokemon_ids.length > 0
      ? team.mega_form_pokemon_ids
      : team.mega_form_pokemon_id
        ? [team.mega_form_pokemon_id]
        : [];

  return rosterIds.map((rosterId, index) => ({
    rosterId,
    formId: formIds[index] ?? null,
  }));
}

export function TeamCard({
  team,
  rosterLookup,
  pokemonMap,
  hasCheatsheet,
  onEdit,
  onDelete,
  onClone,
  onExport,
  onBenchmark,
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
  const megaSelections = getTeamMegaSelections(team);
  const isMegaRosterEntry = (rosterId: string) =>
    megaSelections.some((selection) => selection.rosterId === rosterId);

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
            {hasCheatsheet && (
              <Link
                href={`/cheatsheet?team=${team.id}`}
                className="rounded-full bg-secondary-container/40 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-secondary transition-colors hover:bg-secondary-container/60"
                title="View saved cheatsheet"
              >
                Cheatsheet
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onExport(team)}
            className="btn-ghost h-7 px-3 font-display text-[0.6rem] uppercase tracking-wider"
          >
            Export
          </button>
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
            className={`flex flex-col items-center rounded-lg border p-1.5 ${
              isMegaRosterEntry(entry.id)
                ? "border-primary bg-primary/15"
                : "border-outline-variant bg-surface-lowest"
            }`}
          >
            {poke.sprite_url ? (
              <Image
                src={poke.sprite_url}
                alt={poke.name}
                width={36}
                height={36}
                className="image-rendering-pixelated"
                unoptimized
              />
            ) : (
              <SpriteFallback size={36} />
            )}
            <span className="max-w-14 truncate text-center font-display text-[0.5rem] text-on-surface-muted">
              {poke.name}
            </span>
            {isMegaRosterEntry(entry.id) && (() => {
              let label = "M";
              const formId = megaSelections.find(
                (selection) => selection.rosterId === entry.id
              )?.formId;
              if (poke.mega_evolution_ids.length > 1 && formId) {
                const idx = poke.mega_evolution_ids.indexOf(formId);
                const formName = poke.mega_evolution_names[idx];
                if (formName) {
                  const suffix = formName.split(" ").at(-1) ?? "";
                  label = suffix.length <= 2 ? `M-${suffix}` : "M";
                }
              }
              return (
                <span className="font-display text-[0.45rem] uppercase text-primary">
                  {label}
                </span>
              );
            })()}
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

      {megaSelections.length > 1 && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 font-display text-[0.6rem] uppercase tracking-wider text-primary">
          {megaSelections.length} Mega options saved
        </div>
      )}

      {/* Notes */}
      {team.notes && (
        <p className="mt-3 font-body text-[0.7rem] text-on-surface-muted">
          {team.notes}
        </p>
      )}

      {/* Quick actions */}
      <div className="mt-4 flex gap-2 border-t border-outline-variant pt-3">
        <Link
          href={`/draft?team=${team.id}`}
          className="h-8 rounded-lg bg-surface-high px-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted transition-colors hover:bg-primary/20 hover:text-primary flex items-center"
        >
          Draft
        </Link>
        <Link
          href={`/cheatsheet?team=${team.id}`}
          className="h-8 rounded-lg bg-surface-high px-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted transition-colors hover:bg-primary/20 hover:text-primary flex items-center"
        >
          Cheatsheet
        </Link>
        {onBenchmark && (
          <button
            type="button"
            onClick={() => onBenchmark(team)}
            className="h-8 rounded-lg bg-surface-high px-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted transition-colors hover:bg-primary/20 hover:text-primary"
          >
            Benchmark
          </button>
        )}
      </div>
    </div>
  );
}
