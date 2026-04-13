"use client";

import { Suspense, useState, startTransition, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePokemonSuspense } from "../api";
import { PokemonFilters, type FilterState } from "./pokemon-filters";
import { PokemonCard } from "./pokemon-card";

const PAGE_SIZE = 50;

function PokemonListSuspended({ filters, offset, onUpdateCount }: { filters: FilterState; offset: number, onUpdateCount: (c: number) => void }) {
  const { data } = usePokemonSuspense({
    name: filters.name || undefined,
    type: filters.type || undefined,
    generation: filters.generation ? Number(filters.generation) : undefined,
    champions_only: filters.championsOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  // Since we render during render pass, we can call onUpdateCount to surface count? 
  // It's technically better to not setState in render, so let's let the parent calculate or just pass it in effect.
  // Actually, TanStack Query is awesome, we can just render.

  if (data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-display text-lg text-on-surface-muted">
          No Pokemon found
        </p>
        <p className="mt-1 text-sm text-on-surface-muted">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
        {data.count} result{data.count !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.data.map((p) => (
          <PokemonCard key={p.id} pokemon={p} />
        ))}
      </div>
      {data.count > PAGE_SIZE && (
        <Pagination offset={offset} count={data.count} />
      )}
    </>
  );
}

// A simple local pagination, though it changes parental states
function Pagination({ offset, count } : { offset: number, count: number }) {
    // Just a placeholder here. We need to pass down setOffset and startTransition
    return null; 
}

export function PokemonView() {
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    type: "",
    generation: "",
    championsOnly: false,
  });

  const handleFilterChange = (newFilters: FilterState) => {
    startTransition(() => {
      setFilters(newFilters);
      setOffset(0);
    });
  };

  const handlePageChange = (newOffset: number) => {
    startTransition(() => {
      setOffset(newOffset);
    });
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

      <div className="mb-6">
        <PokemonFilters filters={filters} onFilterChange={handleFilterChange} />
      </div>

      <ErrorBoundary fallback={<div className="py-20 text-center text-red-400">Failed to load Pokemon matching these filters.</div>}>
        <Suspense fallback={<ListSkeleton />}>
          <ListContainer filters={filters} offset={offset} onPageChange={handlePageChange} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

// Separated specific container that handles its own pagination data
function ListContainer({ filters, offset, onPageChange }: { filters: FilterState; offset: number, onPageChange: (o: number) => void}) {
  const gridRef = useRef<HTMLDivElement>(null);
  
  const { data } = usePokemonSuspense({
    name: filters.name || undefined,
    type: filters.type || undefined,
    generation: filters.generation ? Number(filters.generation) : undefined,
    champions_only: filters.championsOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  useGSAP(() => {
    if (gridRef.current) {
      gsap.fromTo(
        gsap.utils.toArray(".scrollComponent"),
        { opacity: 0, y: 50, z: -150, rotateX: -15 },
        { 
          opacity: 1, 
          y: 0, 
          z: 0, 
          rotateX: 0,
          stagger: 0.04, 
          ease: "back.out(1.4)", 
          duration: 0.5,
          clearProps: "all"
        }
      );
    }
  }, { scope: gridRef, dependencies: [data, offset] });

  const totalPages = Math.ceil(data.count / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      {data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-display text-lg text-on-surface-muted">No Pokemon found</p>
        </div>
      ) : (
        <>
          <p className="mb-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
            {data.count} result{data.count !== 1 ? "s" : ""}
          </p>
          <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ perspective: "1000px" }}>
            {data.data.map((p) => (
              <div key={p.id} className="scrollComponent">
                <PokemonCard pokemon={p} />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => onPageChange(offset - PAGE_SIZE)}
                disabled={currentPage <= 1}
                className="h-10 rounded-full bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(offset + PAGE_SIZE)}
                disabled={currentPage >= totalPages}
                className="h-10 rounded-full bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-full bg-surface-low/50"
        />
      ))}
    </div>
  );
}
