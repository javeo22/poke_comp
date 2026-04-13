"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Move } from "@/types/move";
import { fetchMoves } from "@/lib/api";
import { TypeBadge } from "@/features/pokemon/components/type-badge";
import { POKEMON_TYPES } from "@/features/pokemon/types";

const PAGE_SIZE = 50;

const CATEGORIES = ["physical", "special", "status"] as const;

interface FilterState {
  name: string;
  type: string;
  category: string;
  championsOnly: boolean;
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    physical: "bg-tertiary/20 text-tertiary",
    special: "bg-primary/20 text-primary",
    status: "bg-surface-high text-on-surface-muted",
  };

  const labels: Record<string, string> = {
    physical: "Physical",
    special: "Special",
    status: "Status",
  };

  return (
    <span
      className={`inline-block rounded-pill px-3 py-0.5 font-display text-xs font-medium uppercase tracking-widest ${
        styles[category] || styles.status
      }`}
    >
      {labels[category] || category}
    </span>
  );
}

function MoveTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-[1rem] bg-surface-low"
        />
      ))}
    </div>
  );
}

export default function MovesPage() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    type: "",
    category: "",
    championsOnly: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadMoves = useCallback(async (f: FilterState, newOffset: number) => {
    setIsLoading(true);
    try {
      const result = await fetchMoves({
        name: f.name || undefined,
        type: f.type || undefined,
        category: f.category || undefined,
        champions_only: f.championsOnly || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setMoves(result.data);
      setCount(result.count);
    } catch (err) {
      console.error("Failed to fetch moves:", err);
      setMoves([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      loadMoves(filters, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, loadMoves]);

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * PAGE_SIZE;
    setOffset(newOffset);
    loadMoves(filters, newOffset);
  };

  const update = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
          Moves
        </h1>
        <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
          Complete Move Reference
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search moves..."
          value={filters.name}
          onChange={(e) => update({ name: e.target.value })}
          className="input-recessed h-10 w-64 rounded-chunky px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
        />

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

        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className="input-recessed h-10 rounded-chunky px-3 pr-8 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

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

      {/* Results count */}
      {!isLoading && (
        <p className="mb-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
          {count} move{count !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <MoveTableSkeleton />
      ) : moves.length === 0 ? (
        <div className="rounded-[1rem] bg-surface-low px-6 py-12 text-center">
          <p className="font-display text-sm text-on-surface-muted">
            No moves found matching your filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr>
                {["Name", "Type", "Category", "Power", "Accuracy", "Effect"].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left font-display text-xs uppercase tracking-wider text-on-surface-muted"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {moves.map((move) => (
                <tr
                  key={move.id}
                  className="transition-colors hover:bg-surface-low"
                >
                  <td className="px-4 py-3 font-body text-sm font-medium text-on-surface">
                    {move.name}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={move.type} />
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={move.category} />
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-on-surface tabular-nums">
                    {move.power ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-on-surface tabular-nums">
                    {move.accuracy != null ? `${move.accuracy}%` : "\u2014"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-body text-sm text-on-surface-muted">
                    {move.effect_text ?? "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
