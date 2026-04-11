"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pokemon } from "@/types/pokemon";
import { fetchPokemon } from "@/lib/api";
import { PokemonFilters, type FilterState } from "@/components/pokemon/pokemon-filters";
import { PokemonList } from "@/components/pokemon/pokemon-list";

const PAGE_SIZE = 50;

export default function PokemonPage() {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    type: "",
    generation: "",
    championsOnly: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadPokemon = useCallback(async (f: FilterState, newOffset: number) => {
    setIsLoading(true);
    try {
      const result = await fetchPokemon({
        name: f.name || undefined,
        type: f.type || undefined,
        generation: f.generation ? Number(f.generation) : undefined,
        champions_only: f.championsOnly || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setPokemon(result.data);
      setCount(result.count);
    } catch (err) {
      console.error("Failed to fetch Pokemon:", err);
      setPokemon([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      loadPokemon(filters, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, loadPokemon]);

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * PAGE_SIZE;
    setOffset(newOffset);
    loadPokemon(filters, newOffset);
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
          Pokedex
        </h1>
        <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
          Pokemon Champions Database
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <PokemonFilters filters={filters} onFilterChange={setFilters} />
      </div>

      {/* List */}
      <PokemonList pokemon={pokemon} count={count} isLoading={isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-10 rounded-chunky bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-10 rounded-chunky bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
