"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TypeBadge } from "@/features/pokemon/components/type-badge";
import { fetchSpeedTiers, type SpeedTierEntry } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { friendlyError } from "@/lib/errors";

type SortKey = "base_speed" | "neutral_max" | "positive_max" | "scarf_max" | "usage";

export default function SpeedTiersPage() {
  const [entries, setEntries] = useState<SpeedTierEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [championsOnly, setChampionsOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("base_speed");

  const load = useCallback(async (champsOnly: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchSpeedTiers("doubles", champsOnly);
      setEntries(res.data);
    } catch (err) {
      setError(friendlyError(err).message);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(championsOnly);
  }, [championsOnly, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
    const sorted = [...list].sort((a, b) => {
      if (sortKey === "usage") {
        return (b.usage_percent ?? -1) - (a.usage_percent ?? -1);
      }
      return b[sortKey] - a[sortKey];
    });
    return sorted;
  }, [entries, search, sortKey]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">
        ◆ SPEED TIER · L50 · {filtered.length} ENTRIES
      </div>
      <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-on-surface">
        Speed Tiers
      </h1>
      <p className="mt-1 font-body text-sm text-on-surface-muted">
        Level 50, 252 EV / 31 IV / neutral nature. +Nat applies a 1.10x boost; Scarf adds 1.50x on top.
      </p>

      {/* Filters */}
      <div className="mt-6 mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search Pokemon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field h-10 w-64 rounded-xl px-4 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none transition-shadow"
        />

        <button
          onClick={() => setChampionsOnly((v) => !v)}
          className={`h-10 rounded-lg px-4 font-display text-xs font-medium uppercase tracking-wider transition-all ${
            championsOnly
              ? "bg-primary text-surface"
              : "bg-surface-high text-on-surface-muted"
          }`}
        >
          Champions
        </button>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="input-field h-10 rounded-xl px-3 pr-8 font-body text-sm text-on-surface outline-none transition-shadow appearance-none"
          aria-label="Sort by"
        >
          <option value="base_speed">Sort: Base Speed</option>
          <option value="neutral_max">Sort: Neutral Max</option>
          <option value="positive_max">Sort: +Nat Max</option>
          <option value="scarf_max">Sort: Scarf Max</option>
          <option value="usage">Sort: Usage %</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" count={12} />
      ) : error ? (
        <ErrorCard
          title="Couldn't load speed tiers"
          message={error}
          onRetry={() => load(championsOnly)}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Pokemon match"
          description={search ? `No Pokemon match "${search}".` : "Try turning off the Champions toggle."}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]" role="table">
            <thead>
              <tr>
                {["", "Name", "Types", "Base", "Neutral", "+Nat", "Scarf", "Usage"].map(
                  (header, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-left font-mono text-[0.65rem] uppercase tracking-[0.18em] text-on-surface-muted"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-outline-variant/40 transition-colors hover:bg-surface-low"
                >
                  <td className="px-3 py-2">
                    {row.sprite_url ? (
                      <Image
                        src={row.sprite_url}
                        alt={row.name}
                        width={36}
                        height={36}
                        className="image-rendering-pixelated"
                        unoptimized
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-surface-low" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/pokemon/${row.id}`}
                      className="font-body text-sm font-medium text-on-surface hover:text-accent transition-colors"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {row.types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-sm font-bold text-accent tabular-nums">
                    {row.base_speed}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm text-on-surface tabular-nums">
                    {row.neutral_max}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm text-on-surface tabular-nums">
                    {row.positive_max}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm text-primary tabular-nums">
                    {row.scarf_max}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-on-surface-muted tabular-nums">
                    {row.usage_percent != null
                      ? `${row.usage_percent.toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
