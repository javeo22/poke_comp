"use client";

import { useEffect, useRef, useState } from "react";
import type { Pokemon } from "@/features/pokemon/types";
import type { Item } from "@/types/item";
import type { UserPokemon, UserPokemonCreate, UserPokemonUpdate } from "@/types/user-pokemon";
import type { PokemonUsage } from "@/types/usage";
import { BUILD_STATUSES, NATURES } from "@/types/user-pokemon";
import { fetchPokemon, fetchItems, fetchPokemonUsage, fetchPokemonDetail } from "@/lib/api";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";
import { StatPointEditor } from "./stat-point-editor";

interface RosterFormProps {
  editing: UserPokemon | null;
  pokemonLookup: Map<number, Pokemon>;
  onSubmit: (data: UserPokemonCreate | (UserPokemonUpdate & { id: string })) => void;
  onClose: () => void;
}

const DEFAULT_STATS: Record<string, number> = {
  hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0,
};

export function RosterForm({ editing, pokemonLookup, onSubmit, onClose }: RosterFormProps) {
  // Pokemon search (only for new entries)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(
    editing ? pokemonLookup.get(editing.pokemon_id) ?? null : null
  );

  // Items (loaded once) + usage data
  const [items, setItems] = useState<Item[]>([]);
  const [usage, setUsage] = useState<PokemonUsage | null>(null);
  // Move stats map: name -> { type, power } fetched from detail endpoint on pokemon select
  const [moveStatsMap, setMoveStatsMap] = useState<Map<string, { type: string; power: number | null }>>(new Map());

  // Form fields
  const [ability, setAbility] = useState(editing?.ability ?? "");
  const [nature, setNature] = useState(editing?.nature ?? "");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(editing?.item_id ?? null);
  const [moves, setMoves] = useState<string[]>(editing?.moves ?? ["", "", "", ""]);
  const [statPoints, setStatPoints] = useState<Record<string, number>>(
    editing?.stat_points ?? { ...DEFAULT_STATS }
  );
  const [buildStatus, setBuildStatus] = useState<string>(editing?.build_status ?? "wishlist");
  const [vpSpent, setVpSpent] = useState(String(editing?.vp_spent ?? 0));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load Champions items on mount
  useEffect(() => {
    fetchItems({ champions_only: true, limit: 200 })
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, []);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await fetchPokemon({
          name: query,
          champions_only: true,
          limit: 8,
        });
        setSearchResults(result.data);
      } catch {
        setSearchResults([]);
      }
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectPokemon = (p: Pokemon) => {
    setSelectedPokemon(p);
    setSearchQuery("");
    setSearchResults([]);
    if (!ability && p.abilities.length > 0) {
      setAbility(p.abilities[0]);
    }
    // Fetch usage data and move stats in parallel
    fetchPokemonUsage(p.name)
      .then((res) => setUsage(res[0] ?? null))
      .catch(() => setUsage(null));
    fetchPokemonDetail(p.id)
      .then((detail) => {
        setMoveStatsMap(
          new Map(detail.move_details.map((m) => [m.name, { type: m.type, power: m.power ?? null }]))
        );
      })
      .catch(() => setMoveStatsMap(new Map()));
  };

  const handleMoveChange = (index: number, value: string) => {
    const updated = [...moves];
    updated[index] = value;
    setMoves(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const filledMoves = moves.filter((m) => m.trim());
    const movesPayload = filledMoves.length === 4 ? filledMoves : undefined;
    const hasStats = Object.values(statPoints).some((v) => v > 0);

    if (editing) {
      const update: UserPokemonUpdate & { id: string } = {
        id: editing.id,
        ability: ability || undefined,
        nature: nature || undefined,
        item_id: selectedItemId,
        moves: movesPayload,
        stat_points: hasStats ? statPoints : undefined,
        build_status: (buildStatus as UserPokemonCreate["build_status"]) || undefined,
        vp_spent: Number(vpSpent) || 0,
        notes: notes || undefined,
      };
      onSubmit(update);
    } else {
      if (!selectedPokemon) return;
      const create: UserPokemonCreate = {
        pokemon_id: selectedPokemon.id,
        ability: ability || undefined,
        nature: nature || undefined,
        item_id: selectedItemId,
        moves: movesPayload,
        stat_points: hasStats ? statPoints : undefined,
        build_status: (buildStatus as UserPokemonCreate["build_status"]) || undefined,
        vp_spent: Number(vpSpent) || 0,
        notes: notes || undefined,
      };
      onSubmit(create);
    }
  };

  // Derived option lists — sorted by competitive usage when available
  const usageMoveMap = new Map(
    (usage?.moves ?? []).map((m) => [m.name, m.percent])
  );
  const usageItemMap = new Map(
    (usage?.items ?? []).map((i) => [i.name, i.percent])
  );
  const usageAbilityMap = new Map(
    (usage?.abilities ?? []).map((a) => [a.name, a.percent])
  );

  const abilityOptions: DropdownOption[] = (selectedPokemon?.abilities ?? [])
    .map((a) => ({
      value: a,
      label: a,
      sublabel: usageAbilityMap.has(a)
        ? `${usageAbilityMap.get(a)!.toFixed(0)}% usage`
        : undefined,
    }))
    .sort((a, b) => (usageAbilityMap.get(b.value) ?? 0) - (usageAbilityMap.get(a.value) ?? 0));

  const moveOptions: DropdownOption[] = (selectedPokemon?.movepool ?? [])
    .map((m) => {
      const stats = moveStatsMap.get(m);
      const usagePart = usageMoveMap.has(m) ? `${usageMoveMap.get(m)!.toFixed(0)}%` : null;
      const statPart = stats
        ? `${stats.type}${stats.power != null ? ` · ${stats.power}` : ""}`
        : null;
      const sublabel = [usagePart, statPart].filter(Boolean).join("  ") || undefined;
      return { value: m, label: m, sublabel };
    })
    .sort((a, b) => (usageMoveMap.get(b.value) ?? 0) - (usageMoveMap.get(a.value) ?? 0));

  const itemOptions: DropdownOption[] = items
    .map((item) => ({
      value: String(item.id),
      label: item.name,
      sublabel: usageItemMap.has(item.name)
        ? `${usageItemMap.get(item.name)!.toFixed(0)}% usage`
        : item.vp_cost
          ? `${item.vp_cost} VP`
          : undefined,
    }))
    .sort((a, b) => {
      const aUsage = usageItemMap.get(a.label) ?? 0;
      const bUsage = usageItemMap.get(b.label) ?? 0;
      return bUsage - aUsage;
    });

  const noPokemonSelected = !selectedPokemon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form
        onSubmit={handleSubmit}
        className="card mx-3 flex max-h-[90vh] w-full max-w-lg flex-col shadow-2xl sm:mx-4"
      >
        <div className="overflow-y-auto p-4 sm:p-8">
          <h2 className="mb-6 font-display text-2xl font-bold text-on-surface">
            {editing ? "Edit Build" : "Add to Roster"}
          </h2>

          {/* Pokemon search (new only) */}
          {!editing && (
            <div className="mb-5">
              <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                Pokemon
              </label>
              {selectedPokemon ? (
                <div className="flex items-center gap-3 rounded-lg bg-surface-mid p-3">
                  <span className="font-display font-semibold text-on-surface">
                    {selectedPokemon.name}
                  </span>
                  <span className="font-display text-[0.6rem] uppercase text-on-surface-muted">
                    {selectedPokemon.types.join(" / ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedPokemon(null); setMoveStatsMap(new Map()); }}
                    className="ml-auto font-display text-xs text-on-surface-muted hover:text-on-surface"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search Champions Pokemon..."
                    className="input-field h-10 w-full rounded-lg px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-11 z-10 max-h-48 overflow-y-auto rounded-lg card shadow-lg">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPokemon(p)}
                          className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-mid"
                        >
                          <span className="font-display text-[0.65rem] text-on-surface-muted">
                            #{String(p.id).padStart(4, "0")}
                          </span>
                          <span className="font-body text-sm text-on-surface">{p.name}</span>
                          <span className="ml-auto font-display text-[0.6rem] uppercase text-on-surface-muted">
                            {p.types.join(" / ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ability */}
          <div className="mb-4">
            <SearchableDropdown
              label="Ability"
              placeholder="Select ability"
              value={ability}
              onChange={setAbility}
              options={abilityOptions}
              disabled={noPokemonSelected}
            />
          </div>

          {/* Nature */}
          <div className="mb-4">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Nature
            </label>
            <select
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface appearance-none"
            >
              <option value="">Select nature</option>
              {NATURES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Item */}
          <div className="mb-4">
            <SearchableDropdown
              label="Held Item"
              placeholder="Search items..."
              value={selectedItemId ? String(selectedItemId) : ""}
              onChange={(v) => setSelectedItemId(v ? Number(v) : null)}
              options={itemOptions}
            />
          </div>

          {/* Moves */}
          <div className="mb-4">
            <label className="mb-2 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Moves
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {moves.map((m, i) => (
                <SearchableDropdown
                  key={i}
                  placeholder={`Move ${i + 1}`}
                  value={m}
                  onChange={(v) => handleMoveChange(i, v)}
                  options={moveOptions}
                  disabled={noPokemonSelected}
                />
              ))}
            </div>
          </div>

          {/* Stat Points */}
          <div className="mb-4">
            <StatPointEditor
              value={statPoints}
              onChange={setStatPoints}
              baseStats={selectedPokemon?.base_stats}
            />
          </div>

          {/* Status + VP row */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                Status
              </label>
              <select
                value={buildStatus}
                onChange={(e) => setBuildStatus(e.target.value)}
                className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface appearance-none"
              >
                {BUILD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-28">
              <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                VP Spent
              </label>
              <input
                type="number"
                value={vpSpent}
                onChange={(e) => setVpSpent(e.target.value)}
                min={0}
                className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Build notes, matchup thoughts..."
              className="input-field w-full resize-none rounded-lg px-4 py-2 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
            />
          </div>
        </div>

        {/* Sticky actions */}
        <div className="flex gap-3 border-t border-outline-variant p-4 sm:p-6">
          <button
            type="submit"
            disabled={!editing && !selectedPokemon}
            className="btn-primary h-10 flex-1 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {editing ? "Save Changes" : "Add to Roster"}
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
