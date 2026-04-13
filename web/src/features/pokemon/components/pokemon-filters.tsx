"use client";

import { POKEMON_TYPES } from "@/features/pokemon/types";

interface FilterState {
  name: string;
  type: string;
  generation: string;
  championsOnly: boolean;
}

interface PokemonFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PokemonFilters({ filters, onFilterChange }: PokemonFiltersProps) {
  const update = (patch: Partial<FilterState>) => {
    onFilterChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search Pokemon..."
        value={filters.name}
        onChange={(e) => update({ name: e.target.value })}
        className="input-recessed h-10 w-64 rounded-chunky px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
      />

      {/* Type select */}
      <select
        value={filters.type}
        onChange={(e) => update({ type: e.target.value })}
        className="input-recessed h-10 rounded-chunky px-3 pr-8 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
      >
        <option value="">All Types</option>
        {POKEMON_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      {/* Generation select */}
      <select
        value={filters.generation}
        onChange={(e) => update({ generation: e.target.value })}
        className="input-recessed h-10 rounded-chunky px-3 pr-8 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
      >
        <option value="">All Gens</option>
        {GENERATIONS.map((g) => (
          <option key={g} value={String(g)}>
            Gen {g}
          </option>
        ))}
      </select>

      {/* Champions toggle */}
      <button
        onClick={() => update({ championsOnly: !filters.championsOnly })}
        className={`h-10 rounded-pill px-4 font-display text-xs font-medium uppercase tracking-wider transition-all glow-teal ${
          filters.championsOnly
            ? "gradient-primary text-surface gloss-top"
            : "bg-surface-high text-on-surface-muted"
        }`}
      >
        Champions
      </button>
    </div>
  );
}

export type { FilterState };
