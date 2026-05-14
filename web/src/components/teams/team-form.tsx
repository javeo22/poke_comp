"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team, TeamCreate, TeamUpdate } from "@/types/team";
import { FORMATS } from "@/types/team";
import { TypeCoverage } from "./type-coverage";
import { TeamBuilderAssistant } from "./team-builder-assistant";
import { ArrowDown, ArrowUp } from "lucide-react";

interface TeamFormProps {
  editing: Team | null;
  roster: UserPokemon[];
  pokemonMap: Map<number, Pokemon>;
  rosterLookup: Map<string, UserPokemon>;
  onSubmit: (data: TeamCreate | (TeamUpdate & { id: string })) => void;
  onClose: () => void;
  onAddToRoster?: () => void;
  onEditRosterEntry?: (entry: UserPokemon) => void;
  onCreateWishlist?: (pokemon: Pokemon) => Promise<void>;
}

interface MegaSelection {
  rosterId: string;
  formId: number;
}

interface RoleCheck {
  label: string;
  active: boolean;
}

const ARCHETYPE_SUGGESTIONS = [
  "balance",
  "rain",
  "sun",
  "trick-room",
  "tailwind",
  "hyper-offense",
  "bulky-offense",
  "stall",
];

function getInitialMegaSelections(team: Team | null): MegaSelection[] {
  if (!team) return [];
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

  return rosterIds
    .map((rosterId, index) => {
      const formId = formIds[index];
      return formId ? { rosterId, formId } : null;
    })
    .filter((selection): selection is MegaSelection => selection !== null)
    .slice(0, 2);
}

export function TeamForm({
  editing,
  roster,
  pokemonMap,
  rosterLookup,
  onSubmit,
  onClose,
  onAddToRoster,
  onEditRosterEntry,
  onCreateWishlist,
}: TeamFormProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [format, setFormat] = useState<string>(editing?.format ?? "doubles");
  const [selectedIds, setSelectedIds] = useState<string[]>(editing?.pokemon_ids ?? []);
  const [megaSelections, setMegaSelections] = useState<MegaSelection[]>(
    getInitialMegaSelections(editing)
  );
  const [rosterSearch, setRosterSearch] = useState("");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [archetypeTag, setArchetypeTag] = useState(editing?.archetype_tag ?? "");

  const toggleSlot = (rosterEntryId: string) => {
    if (selectedIds.includes(rosterEntryId)) {
      setSelectedIds(selectedIds.filter((id) => id !== rosterEntryId));
      setMegaSelections((prev) => prev.filter((selection) => selection.rosterId !== rosterEntryId));
    } else if (selectedIds.length < 6) {
      setSelectedIds([...selectedIds, rosterEntryId]);
    }
  };

  const moveSlot = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.length === 0) return;
    const firstMega = megaSelections[0];

    if (editing) {
      const update: TeamUpdate & { id: string } = {
        id: editing.id,
        name: name.trim(),
        format: format as TeamCreate["format"],
        pokemon_ids: selectedIds,
        mega_pokemon_id: firstMega?.rosterId ?? null,
        mega_form_pokemon_id: firstMega?.formId ?? null,
        mega_pokemon_ids: megaSelections.map((selection) => selection.rosterId),
        mega_form_pokemon_ids: megaSelections.map((selection) => selection.formId),
        notes: notes.trim() || undefined,
        archetype_tag: archetypeTag.trim() || undefined,
      };
      onSubmit(update);
    } else {
      const create: TeamCreate = {
        name: name.trim(),
        format: format as TeamCreate["format"],
        pokemon_ids: selectedIds,
        mega_pokemon_id: firstMega?.rosterId ?? null,
        mega_form_pokemon_id: firstMega?.formId ?? null,
        mega_pokemon_ids: megaSelections.map((selection) => selection.rosterId),
        mega_form_pokemon_ids: megaSelections.map((selection) => selection.formId),
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

  const selectedEntries = selectedIds
    .map((id) => rosterLookup.get(id))
    .filter((entry): entry is UserPokemon => !!entry);
  const selectedMembers = selectedEntries
    .map((entry) => {
      const pokemon = pokemonMap.get(entry.pokemon_id);
      return pokemon ? { entry, pokemon } : null;
    })
    .filter((member): member is { entry: UserPokemon; pokemon: Pokemon } => member !== null);
  const assistantPokemon = useMemo(() => Array.from(pokemonMap.values()), [pokemonMap]);
  const roleChecks = getRoleChecks(selectedEntries);
  const coveredRoles = roleChecks.filter((check) => check.active).length;
  const filteredRoster = roster.filter((entry) => {
    const poke = pokemonMap.get(entry.pokemon_id);
    const haystack = [
      poke?.name,
      entry.ability,
      entry.build_status,
      ...(entry.moves ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(rosterSearch.trim().toLowerCase());
  });

  const getMegaForms = (entry: UserPokemon): { formId: number; formName: string }[] => {
    const poke = pokemonMap.get(entry.pokemon_id);
    if (!poke || poke.mega_evolution_ids.length === 0) return [];
    return poke.mega_evolution_ids.map((id, i) => ({
      formId: id,
      formName: poke.mega_evolution_names[i] ?? `Mega Form ${i + 1}`,
    }));
  };

  const toggleMegaSelection = (rosterId: string, formId: number) => {
    setMegaSelections((prev) => {
      const existing = prev.find(
        (selection) => selection.rosterId === rosterId && selection.formId === formId
      );
      if (existing) {
        return prev.filter(
          (selection) => !(selection.rosterId === rosterId && selection.formId === formId)
        );
      }

      const withoutSamePokemon = prev.filter((selection) => selection.rosterId !== rosterId);
      if (withoutSamePokemon.length >= 2) return prev;
      return [...withoutSamePokemon, { rosterId, formId }];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 py-4 sm:py-8">
      <form
        onSubmit={handleSubmit}
        className="card mx-3 w-full max-w-4xl p-4 shadow-2xl sm:mx-4 sm:p-8"
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

              if (!entryId || !poke || !entry) {
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

              const megaSelection = megaSelections.find(
                (selection) => selection.rosterId === entryId
              );
              return (
                <div
                  key={i}
                  className={`group relative flex flex-col items-center justify-center rounded-lg p-1.5 transition-colors cursor-pointer ${
                    megaSelection
                      ? "border border-primary bg-primary/15"
                      : "bg-surface-low hover:bg-surface-mid"
                  }`}
                  onClick={() => onEditRosterEntry?.(entry)}
                  title="Click to edit set"
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
                  {megaSelection && (
                    <span className="font-display text-[0.5rem] uppercase text-primary">
                      Mega
                    </span>
                  )}
                  <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <svg className="w-2.5 h-2.5 text-on-surface-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                     </svg>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlot(i, -1);
                      }}
                      disabled={i === 0}
                      className="grid h-5 w-5 place-items-center rounded bg-surface-high text-on-surface-muted disabled:opacity-30"
                      title="Move left"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlot(i, 1);
                      }}
                      disabled={i === selectedIds.length - 1}
                      className="grid h-5 w-5 place-items-center rounded bg-surface-high text-on-surface-muted disabled:opacity-30"
                      title="Move right"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSlot(entryId); }}
                    className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-tertiary-container text-[0.55rem] text-on-surface hover:bg-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <TeamBuilderAssistant
          pokemon={assistantPokemon}
          roster={roster}
          selectedMembers={selectedMembers}
          selectedCount={selectedIds.length}
          archetypeTag={archetypeTag}
          onArchetypeTagChange={setArchetypeTag}
          onAddRosterEntry={toggleSlot}
          onCreateWishlist={onCreateWishlist}
        />

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
          <input
            type="search"
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            placeholder="Search roster by Pokemon, ability, move, or status"
            className="input-field mb-2 h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
          />
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
                {filteredRoster.map((entry) => {
                  const poke = pokemonMap.get(entry.pokemon_id);
                  if (!poke) return null;
                  const isSelected = selectedIds.includes(entry.id);
                  const megaForms = getMegaForms(entry);

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
                        {megaForms.length > 0 && (
                          <span className="font-display text-[0.5rem] uppercase text-primary">
                            {megaForms.length > 1 ? `${megaForms.length} megas` : "Mega available"}
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
                {filteredRoster.length === 0 && (
                  <div className="col-span-full py-4 text-center font-body text-sm text-on-surface-muted">
                    No roster entries match that search.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mega selector - one option per mega form; supports two designated Mega choices. */}
        {selectedIds.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                Mega Evolutions
              </label>
              <span className="font-display text-xs text-primary">
                {megaSelections.length}/2 selected
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedIds.flatMap((id) => {
                const entry = rosterLookup.get(id);
                const poke = entry ? pokemonMap.get(entry.pokemon_id) : undefined;
                if (!poke || poke.mega_evolution_ids.length === 0) return [];
                return poke.mega_evolution_ids.map((formId, i) => {
                  const formName = poke.mega_evolution_names[i] ?? `${poke.name} Mega`;
                  const isSelected = megaSelections.some(
                    (selection) => selection.rosterId === id && selection.formId === formId
                  );
                  const isDisabled =
                    !isSelected &&
                    megaSelections.length >= 2 &&
                    !megaSelections.some((selection) => selection.rosterId === id);
                  return (
                    <button
                      key={`${id}:${formId}`}
                      type="button"
                      onClick={() => toggleMegaSelection(id, formId)}
                      disabled={isDisabled}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-low"
                      }`}
                    >
                      <span className="font-display text-xs font-semibold uppercase tracking-wider">
                        {formName}
                      </span>
                      <span className="font-display text-[0.58rem] uppercase tracking-wider text-on-surface-muted">
                        {isSelected ? "Selected" : poke.name}
                      </span>
                    </button>
                  );
                });
              })}
              {selectedIds.every((id) => {
                const entry = rosterLookup.get(id);
                const poke = entry ? pokemonMap.get(entry.pokemon_id) : undefined;
                return !poke || poke.mega_evolution_ids.length === 0;
              }) && (
                <div className="rounded-lg border border-dashed border-outline-variant bg-surface-lowest p-3 font-body text-sm text-on-surface-muted sm:col-span-2">
                  None of the selected roster entries have Mega forms.
                </div>
              )}
            </div>
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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ARCHETYPE_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setArchetypeTag(tag)}
                  className={`rounded-lg border px-2 py-1 font-display text-[0.55rem] uppercase tracking-wider transition-colors ${
                    archetypeTag.trim().toLowerCase() === tag
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-outline-variant bg-surface-lowest text-on-surface-muted hover:bg-surface-low"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
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
          <div className="mb-6 space-y-4 rounded-lg bg-surface-lowest p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <TeamBuildMetric label="Pokemon" value={`${selectedIds.length}/6`} />
              <TeamBuildMetric label="Mega options" value={`${megaSelections.length}/2`} />
              <TeamBuildMetric label="Role coverage" value={`${coveredRoles}/${roleChecks.length}`} />
            </div>
            <TypeCoverage teamTypes={teamTypes} />
            <RoleCoverageAudit entries={selectedEntries} />
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

function RoleCoverageAudit({ entries }: { entries: UserPokemon[] }) {
  const roleChecks = getRoleChecks(entries);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
          Role Coverage
        </span>
        <span className="font-display text-xs text-secondary">
          {roleChecks.filter((check) => check.active).length}/{roleChecks.length} covered
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {roleChecks.map((check) => (
          <div
            key={check.label}
            className={`rounded-lg border px-2 py-1.5 font-display text-[0.58rem] uppercase tracking-wider ${
              check.active
                ? "border-secondary/40 bg-secondary/15 text-secondary"
                : "border-outline-variant bg-surface text-on-surface-muted"
            }`}
          >
            {check.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamBuildMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2">
      <span className="block font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </span>
      <span className="mt-1 block font-display text-sm font-semibold text-on-surface">
        {value}
      </span>
    </div>
  );
}

function getRoleChecks(entries: UserPokemon[]): RoleCheck[] {
  return [
    {
      label: "Speed control",
      active: hasMove(entries, ["tailwind", "icy wind", "thunder wave", "trick room"]),
    },
    { label: "Fake Out", active: hasMove(entries, ["fake out"]) },
    {
      label: "Protect count",
      active: entries.filter((entry) => hasMove([entry], ["protect", "detect", "spiky shield"])).length >= 4,
    },
    {
      label: "Intimidate",
      active: entries.some((entry) => entry.ability?.toLowerCase() === "intimidate"),
    },
    { label: "Redirection", active: hasMove(entries, ["follow me", "rage powder"]) },
    {
      label: "Priority",
      active: hasMove(entries, [
        "sucker punch",
        "extreme speed",
        "aqua jet",
        "bullet punch",
        "grassy glide",
        "mach punch",
        "ice shard",
        "shadow sneak",
        "first impression",
      ]),
    },
    {
      label: "Trick Room mode/check",
      active: hasMove(entries, ["trick room", "taunt", "imprison"]),
    },
    {
      label: "Spread damage",
      active: hasMove(entries, [
        "earthquake",
        "rock slide",
        "heat wave",
        "dazzling gleam",
        "surf",
        "muddy water",
        "hyper voice",
        "blizzard",
        "discharge",
        "make it rain",
        "matcha gotcha",
      ]),
    },
    { label: "Pivoting", active: hasMove(entries, ["parting shot", "u-turn", "volt switch", "flip turn", "baton pass"]) },
    { label: "Setup", active: hasMove(entries, ["swords dance", "nasty plot", "dragon dance", "calm mind"]) },
    {
      label: "Weather / terrain",
      active: hasMove(entries, [
        "rain dance",
        "sunny day",
        "sandstorm",
        "snowscape",
        "electric terrain",
        "grassy terrain",
        "psychic terrain",
        "misty terrain",
      ]),
    },
  ];
}

function hasMove(entries: UserPokemon[], moves: string[]): boolean {
  const wanted = new Set(moves.map((move) => move.toLowerCase()));
  return entries.some((entry) =>
    (entry.moves ?? []).some((move) => wanted.has(move.toLowerCase()))
  );
}
