"use client";

import { useEffect, useRef, useState } from "react";
import type { Pokemon } from "@/features/pokemon/types";
import type { PokemonUsage } from "@/types/usage";
import { fetchPokemon, fetchPokemonUsage } from "@/lib/api";

interface QuickAddModalProps {
  pokemonLookup: Map<number, Pokemon>;
  preselectedPokemonId?: number;
  onAdd: (data: { pokemon_id: number; ability?: string; build_status: string }) => void;
  onFullForm: (pokemonId: number) => void;
  onClose: () => void;
}

export function QuickAddModal({
  pokemonLookup,
  preselectedPokemonId,
  onAdd,
  onFullForm,
  onClose,
}: QuickAddModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [usage, setUsage] = useState<PokemonUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select preselected Pokemon
  useEffect(() => {
    if (preselectedPokemonId) {
      const p = pokemonLookup.get(preselectedPokemonId);
      if (p) handleSelectPokemon(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPokemonId]);

  // Focus search input on mount
  useEffect(() => {
    if (!preselectedPokemonId) {
      inputRef.current?.focus();
    }
  }, [preselectedPokemonId]);

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

  const handleSelectPokemon = async (pokemon: Pokemon) => {
    setSelectedPokemon(pokemon);
    setSearchQuery("");
    setSearchResults([]);
    setLoadingUsage(true);

    try {
      const usageData = await fetchPokemonUsage(pokemon.name);
      // Prefer pikalytics source, fall back to first available
      const pikalytics = usageData.find((u) => u.source === "pikalytics");
      setUsage(pikalytics || usageData[0] || null);
    } catch {
      setUsage(null);
    } finally {
      setLoadingUsage(false);
    }
  };

  const topAbility = usage?.abilities?.[0]?.name || selectedPokemon?.abilities?.[0] || undefined;

  const handleQuickAdd = async () => {
    if (!selectedPokemon) return;
    setSaving(true);
    try {
      onAdd({
        pokemon_id: selectedPokemon.id,
        ability: topAbility,
        build_status: "wishlist",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-on-surface">Quick Add</h2>
          <button
            onClick={onClose}
            className="text-on-surface-muted hover:text-on-surface transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Pokemon search */}
        {!selectedPokemon && (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search Pokemon..."
              className="input-field h-10 w-full rounded-lg px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
            />
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg card shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPokemon(p)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-mid transition-colors"
                  >
                    {p.sprite_url && (
                      <img src={p.sprite_url} alt="" className="h-8 w-8 pixelated" />
                    )}
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

        {/* Selected Pokemon preview */}
        {selectedPokemon && (
          <div className="space-y-4">
            {/* Pokemon header */}
            <div className="flex items-center gap-4 rounded-lg bg-surface-lowest p-4 border border-outline-variant">
              {selectedPokemon.sprite_url && (
                <img
                  src={selectedPokemon.sprite_url}
                  alt={selectedPokemon.name}
                  className="h-16 w-16 pixelated"
                />
              )}
              <div>
                <h3 className="font-display text-base font-bold text-on-surface">
                  {selectedPokemon.name}
                </h3>
                <div className="mt-1 flex gap-1.5">
                  {selectedPokemon.types.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-surface-high px-2.5 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPokemon(null);
                  setUsage(null);
                }}
                className="ml-auto text-on-surface-muted hover:text-on-surface text-xs"
                title="Change Pokemon"
              >
                Change
              </button>
            </div>

            {/* Auto-filled defaults */}
            {loadingUsage ? (
              <div className="flex items-center gap-2 text-sm text-on-surface-muted">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading usage data...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  Defaults (from {usage?.source || "roster"})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-surface-lowest px-3 py-2 border border-outline-variant">
                    <div className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Ability
                    </div>
                    <div className="text-on-surface">
                      {topAbility || "None"}
                      {usage?.abilities?.[0]?.percent != null && (
                        <span className="ml-1 text-xs text-on-surface-muted">
                          ({usage.abilities[0].percent}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-lowest px-3 py-2 border border-outline-variant">
                    <div className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Status
                    </div>
                    <div className="text-on-surface">Wishlist</div>
                  </div>
                </div>
                {usage && usage.items && usage.items.length > 0 && (
                  <div className="text-xs text-on-surface-muted">
                    Popular items: {usage.items.slice(0, 3).map((i) => i.name).join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleQuickAdd}
                disabled={saving}
                className="btn-primary flex-1 h-10 px-4 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add to Roster"}
              </button>
              <button
                onClick={() => onFullForm(selectedPokemon.id)}
                className="btn-ghost h-10 px-4 font-display text-xs font-medium uppercase tracking-wider"
              >
                Full Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
