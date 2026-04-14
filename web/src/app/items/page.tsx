"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@/types/item";
import { fetchItems } from "@/lib/api";

const PAGE_SIZE = 30;

const ITEM_CATEGORIES = ["held", "mega_stone", "berry"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  held: "Held Item",
  mega_stone: "Mega Stone",
  berry: "Berry",
};

interface FilterState {
  name: string;
  category: string;
  championsOnly: boolean;
}

function ItemCardSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-[1rem] bg-surface-low" />
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    category: "",
    championsOnly: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadItems = useCallback(async (f: FilterState, newOffset: number) => {
    setIsLoading(true);
    try {
      const result = await fetchItems({
        name: f.name || undefined,
        category: f.category || undefined,
        champions_only: f.championsOnly || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setItems(result.data);
      setCount(result.count);
    } catch (err) {
      console.error("Failed to fetch items:", err);
      setItems([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      loadItems(filters, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, loadItems]);

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * PAGE_SIZE;
    setOffset(newOffset);
    loadItems(filters, newOffset);
  };

  const update = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
          Items
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-muted">
          Competitive Item Reference
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search items..."
          value={filters.name}
          onChange={(e) => update({ name: e.target.value })}
          className="input-field h-10 w-64 rounded-xl px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
        />

        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className="input-field h-10 rounded-xl px-3 pr-8 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
        >
          <option value="">All Categories</option>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <button
          onClick={() => update({ championsOnly: !filters.championsOnly })}
          className={`h-10 rounded-lg px-4 font-display text-xs font-medium uppercase tracking-wider transition-all ${
            filters.championsOnly
              ? "bg-primary text-surface"
              : "bg-surface-high text-on-surface-muted"
          }`}
        >
          Champions
        </button>
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="mb-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
          {count} item{count !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1rem] bg-surface-low px-6 py-12 text-center">
          <p className="font-display text-sm text-on-surface-muted">
            No items found matching your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="hover-lift rounded-[1rem] bg-surface-low p-5 transition-all"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-bold text-on-surface">
                  {item.name}
                </h3>
                {item.champions_shop_available && (
                  <span className="shrink-0 rounded-full bg-secondary/20 px-3 py-0.5 font-display text-xs font-medium uppercase tracking-widest text-secondary">
                    Shop
                  </span>
                )}
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {item.category && (
                  <span className="rounded-full bg-surface-mid px-3 py-0.5 font-display text-xs font-medium uppercase tracking-widest text-on-surface-muted">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                )}
                {item.vp_cost != null && (
                  <span className="rounded-full bg-primary/20 px-3 py-0.5 font-display text-xs font-medium uppercase tracking-widest text-primary">
                    {item.vp_cost} VP
                  </span>
                )}
              </div>

              {item.effect_text && (
                <p className="font-body text-sm leading-relaxed text-on-surface-muted">
                  {item.effect_text}
                </p>
              )}
              {item.top_holders && item.top_holders.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted/60">
                    Holders
                  </span>
                  {item.top_holders.map((holder) => (
                    <span
                      key={holder}
                      className="rounded-full bg-surface-mid px-2.5 py-0.5 font-display text-[0.6rem] text-on-surface-muted"
                    >
                      {holder}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-10 rounded-xl bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-4 font-display text-xs uppercase tracking-[0.05rem] text-on-surface-muted">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-10 rounded-xl bg-surface-high px-4 font-display text-xs uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
