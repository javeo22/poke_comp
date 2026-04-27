"use client";

import { Suspense, useState, startTransition, useRef } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
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
    championsOnly: true,
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
    <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-10">
      {/* Header */}
      <div className="mb-7">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-2">
          ◆ POKEDEX · CHAMPIONS-ELIGIBLE
        </div>
        <h1 className="m-0 font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] text-on-surface leading-[1]">
          Every pick. <span className="text-gradient">Live data.</span>
        </h1>
        <p className="mt-3 max-w-xl text-on-surface-muted text-base">
          Stats, movepools, abilities, usage. Everything that matters for team-prep.
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
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.03,
          ease: "power2.out",
          duration: 0.35,
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
          <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className="btn-ghost h-10 px-4 font-display text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 font-display text-xs uppercase tracking-wider text-on-surface-muted">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(offset + PAGE_SIZE)}
                disabled={currentPage >= totalPages}
                className="btn-ghost h-10 px-4 font-display text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
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
          className="h-64 animate-pulse rounded-xl bg-surface-low/50"
        />
      ))}
    </div>
  );
}
