"use client";

import { useEffect, useRef, useState } from "react";
import type { Pokemon } from "@/types/pokemon";
import type { UserPokemon, UserPokemonCreate, UserPokemonUpdate } from "@/types/user-pokemon";
import { BUILD_STATUSES, NATURES } from "@/types/user-pokemon";
import { fetchPokemon } from "@/lib/api";

interface RosterFormProps {
  editing: UserPokemon | null;
  pokemonLookup: Map<number, Pokemon>;
  onSubmit: (data: UserPokemonCreate | (UserPokemonUpdate & { id: string })) => void;
  onClose: () => void;
}

export function RosterForm({ editing, pokemonLookup, onSubmit, onClose }: RosterFormProps) {
  // Pokemon search (only for new entries)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(
    editing ? pokemonLookup.get(editing.pokemon_id) ?? null : null
  );

  // Form fields
  const [ability, setAbility] = useState(editing?.ability ?? "");
  const [nature, setNature] = useState(editing?.nature ?? "");
  const [moves, setMoves] = useState<string[]>(editing?.moves ?? ["", "", "", ""]);
  const [buildStatus, setBuildStatus] = useState<string>(editing?.build_status ?? "wishlist");
  const [vpSpent, setVpSpent] = useState(String(editing?.vp_spent ?? 0));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    // Pre-fill first ability if available
    if (!ability && p.abilities.length > 0) {
      setAbility(p.abilities[0]);
    }
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

    if (editing) {
      const update: UserPokemonUpdate & { id: string } = {
        id: editing.id,
        ability: ability || undefined,
        nature: nature || undefined,
        moves: movesPayload,
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
        moves: movesPayload,
        build_status: (buildStatus as UserPokemonCreate["build_status"]) || undefined,
        vp_spent: Number(vpSpent) || 0,
        notes: notes || undefined,
      };
      onSubmit(create);
    }
  };

  // Available abilities for dropdown
  const availableAbilities = selectedPokemon?.abilities ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="glass glass-border mx-4 w-full max-w-lg rounded-shell p-8"
      >
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
              <div className="flex items-center gap-3 rounded-chunky bg-surface-low p-3">
                <span className="font-display font-semibold text-on-surface">
                  {selectedPokemon.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPokemon(null)}
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
                  className="input-recessed h-10 w-full rounded-chunky px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-10 max-h-48 overflow-y-auto rounded-chunky bg-surface-high">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPokemon(p)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-highest"
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
          <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Ability
          </label>
          {availableAbilities.length > 0 ? (
            <select
              value={ability}
              onChange={(e) => setAbility(e.target.value)}
              className="input-recessed h-10 w-full rounded-chunky px-3 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
            >
              <option value="">Select ability</option>
              {availableAbilities.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={ability}
              onChange={(e) => setAbility(e.target.value)}
              placeholder="Ability name"
              className="input-recessed h-10 w-full rounded-chunky px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
            />
          )}
        </div>

        {/* Nature */}
        <div className="mb-4">
          <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Nature
          </label>
          <select
            value={nature}
            onChange={(e) => setNature(e.target.value)}
            className="input-recessed h-10 w-full rounded-chunky px-3 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
          >
            <option value="">Select nature</option>
            {NATURES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Moves */}
        <div className="mb-4">
          <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
            Moves
          </label>
          <div className="grid grid-cols-2 gap-2">
            {moves.map((m, i) => (
              <input
                key={i}
                type="text"
                value={m}
                onChange={(e) => handleMoveChange(i, e.target.value)}
                placeholder={`Move ${i + 1}`}
                className="input-recessed h-9 rounded-chunky px-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
              />
            ))}
          </div>
        </div>

        {/* Status + VP row */}
        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              Status
            </label>
            <select
              value={buildStatus}
              onChange={(e) => setBuildStatus(e.target.value)}
              className="input-recessed h-10 w-full rounded-chunky px-3 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
            >
              {BUILD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
              VP Spent
            </label>
            <input
              type="number"
              value={vpSpent}
              onChange={(e) => setVpSpent(e.target.value)}
              min={0}
              className="input-recessed h-10 w-full rounded-chunky px-3 font-body text-sm text-on-surface outline-none transition-shadow"
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
            className="input-recessed w-full resize-none rounded-chunky px-4 py-2 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!editing && !selectedPokemon}
            className="h-10 flex-1 rounded-pill gradient-primary font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {editing ? "Save Changes" : "Add to Roster"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-pill bg-surface-high px-6 font-display text-xs uppercase tracking-wider text-on-surface-muted transition-colors hover:bg-surface-highest"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
