"use client";

import { useState } from "react";
import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team, TeamCreate, TeamUpdate } from "@/types/team";
import { FORMATS } from "@/types/team";
import { TypeCoverage } from "./type-coverage";

interface TeamFormProps {
  editing: Team | null;
  roster: UserPokemon[];
  pokemonMap: Map<number, Pokemon>;
  rosterLookup: Map<string, UserPokemon>;
  onSubmit: (data: TeamCreate | (TeamUpdate & { id: string })) => void;
  onClose: () => void;
  onAddToRoster?: () => void;
}

export function TeamForm({
  editing,
  roster,
  pokemonMap,
  rosterLookup,
  onSubmit,
  onClose,
  onAddToRoster,
}: TeamFormProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [format, setFormat] = useState<string>(editing?.format ?? "doubles");
  const [selectedIds, setSelectedIds] = useState<string[]>(editing?.pokemon_ids ?? []);
  const [megaId, setMegaId] = useState<string | null>(editing?.mega_pokemon_id ?? null);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [archetypeTag, setArchetypeTag] = useState(editing?.archetype_tag ?? "");

  const toggleSlot = (rosterEntryId: string) => {
    if (selectedIds.includes(rosterEntryId)) {
      setSelectedIds(selectedIds.filter((id) => id !== rosterEntryId));
      if (megaId === rosterEntryId) setMegaId(null);
    } else if (selectedIds.length < 6) {
      setSelectedIds([...selectedIds, rosterEntryId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.length === 0) return;

    if (editing) {
      const update: TeamUpdate & { id: string } = {
        id: editing.id,
        name: name.trim(),
        format: format as TeamCreate["format"],
        pokemon_ids: selectedIds,
        mega_pokemon_id: megaId,
        notes: notes.trim() || undefined,
        archetype_tag: archetypeTag.trim() || undefined,
      };
      onSubmit(update);
    } else {
      const create: TeamCreate = {
        name: name.trim(),
        format: format as TeamCreate["format"],
        pokemon_ids: selectedIds,
        mega_pokemon_id: megaId,
        notes: notes.trim() || undefined,
        archetype_tag: archetypeTag.trim() || undefined,
      };
      onSubmit(create);
    }
  };

  // Build type arrays for coverage analysis
  const teamTypes: string[][] = selectedIds
    .map((id) => {
      const entry = rosterLookup.get(id);
      if (!entry) return null;
      const poke = pokemonMap.get(entry.pokemon_id);
      return poke?.types ?? null;
    })
    .filter((t): t is string[] => t !== null);

  // Check which roster entries have mega evolutions
  const getMegaInfo = (entry: UserPokemon) => {
    const poke = pokemonMap.get(entry.pokemon_id);
    return poke?.mega_evolution_id != null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 py-4 sm:py-8">
      <form
        onSubmit={handleSubmit}
        className="card mx-3 w-full max-w-2xl p-4 shadow-2xl sm:mx-4 sm:p-8"
      >
        <h2 className="mb-6 font-display text-2xl font-bold text-on-surface">
          {editing ? "Edit Team" : "Create Team"}
        </h2>

        {/* Name + Format row */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rain Offense"
              className="input-field h-10 w-full rounded-lg px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
              autoFocus
            />
          </div>
          <div className="sm:w-36">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface appearance-none"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Team slots */}
        <div className="mb-5">
          <label className="mb-2 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Team ({selectedIds.length}/6)
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => {
              const entryId = selectedIds[i];
              const entry = entryId ? rosterLookup.get(entryId) : undefined;
              const poke = entry ? pokemonMap.get(entry.pokemon_id) : undefined;

              if (!entryId || !poke) {
                return (
                  <div
                    key={i}
                    className="flex h-20 items-center justify-center rounded-lg bg-surface-lowest"
                  >
                    <span className="font-display text-[0.6rem] uppercase text-on-surface-muted/40">
                      Empty
                    </span>
                  </div>
                );
              }

              const isMega = megaId === entryId;
              return (
                <div
                  key={i}
                  className={`relative flex flex-col items-center justify-center rounded-lg p-1.5 transition-colors ${
                    isMega ? "bg-primary-container/40" : "bg-surface-low"
                  }`}
                >
                  {poke.sprite_url && (
                    <Image
                      src={poke.sprite_url}
                      alt={poke.name}
                      width={40}
                      height={40}
                      className="image-rendering-pixelated"
                      unoptimized
                    />
                  )}
                  <span className="truncate text-center font-display text-[0.55rem] text-on-surface">
                    {poke.name}
                  </span>
                  {isMega && (
                    <span className="font-display text-[0.5rem] uppercase text-primary">
                      Mega
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSlot(entryId)}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-tertiary-container text-[0.55rem] text-on-surface hover:bg-tertiary"
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pokemon picker from roster */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Add from Roster
            </label>
            {onAddToRoster && (
              <button
                type="button"
                onClick={onAddToRoster}
                className="font-display text-[0.65rem] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              >
                + Add New
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-surface-lowest p-2">
            {roster.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="font-body text-sm text-on-surface-muted">
                  No Pokemon in roster yet
                </p>
                {onAddToRoster && (
                  <button
                    type="button"
                    onClick={onAddToRoster}
                    className="btn-ghost h-8 px-4 font-display text-[0.65rem] uppercase tracking-wider"
                  >
                    Add Your First Pokemon
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {roster.map((entry) => {
                  const poke = pokemonMap.get(entry.pokemon_id);
                  if (!poke) return null;
                  const isSelected = selectedIds.includes(entry.id);
                  const hasMega = getMegaInfo(entry);

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => toggleSlot(entry.id)}
                      disabled={!isSelected && selectedIds.length >= 6}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-30 ${
                        isSelected
                          ? "bg-primary-container/30"
                          : "hover:bg-surface-mid"
                      }`}
                    >
                      {poke.sprite_url && (
                        <Image
                          src={poke.sprite_url}
                          alt={poke.name}
                          width={28}
                          height={28}
                          className="image-rendering-pixelated"
                          unoptimized
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-body text-xs text-on-surface">
                          {poke.name}
                        </span>
                        {hasMega && (
                          <span className="font-display text-[0.5rem] uppercase text-primary">
                            Mega available
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="font-display text-[0.6rem] text-secondary">
                          IN
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mega selector (only if format is megas or team has mega-capable Pokemon) */}
        {selectedIds.length > 0 && (
          <div className="mb-5">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Mega Evolution
            </label>
            <select
              value={megaId ?? ""}
              onChange={(e) => setMegaId(e.target.value || null)}
              className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface appearance-none"
            >
              <option value="">None</option>
              {selectedIds.map((id) => {
                const entry = rosterLookup.get(id);
                const poke = entry ? pokemonMap.get(entry.pokemon_id) : undefined;
                if (!poke || !poke.mega_evolution_id) return null;
                return (
                  <option key={id} value={id}>
                    {poke.name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Archetype tag + Notes */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-40">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Archetype Tag
            </label>
            <input
              type="text"
              value={archetypeTag}
              onChange={(e) => setArchetypeTag(e.target.value)}
              placeholder="e.g. rain, trick room"
              className="input-field h-10 w-full rounded-lg px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Team notes..."
              className="input-field h-10 w-full rounded-lg px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
            />
          </div>
        </div>

        {/* Type coverage analysis */}
        {teamTypes.length > 0 && (
          <div className="mb-6 rounded-lg bg-surface-lowest p-4">
            <TypeCoverage teamTypes={teamTypes} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name.trim() || selectedIds.length === 0}
            className="btn-primary h-10 flex-1 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {editing ? "Save Changes" : "Create Team"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-10 px-6 font-display text-xs uppercase tracking-wider"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
