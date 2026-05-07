"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetaSnapshot } from "@/types/meta";
import type { PokemonUsage } from "@/types/usage";
import { META_FORMATS } from "@/types/meta";
import { fetchLatestMeta, fetchUsage } from "@/lib/api";
import { TierListCard } from "@/components/meta/tier-list-card";
import { UsageList } from "@/components/meta/usage-list";
import { PokemonDetailPanel } from "@/components/meta/pokemon-detail-panel";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { friendlyError } from "@/lib/errors";

type ViewMode = "usage" | "tiers";

interface SelectedPokemon {
  name: string;
  tier?: string;
  format: string;
}

export default function MetaPage() {
  const [snapshots, setSnapshots] = useState<MetaSnapshot[]>([]);
  const [usageData, setUsageData] = useState<PokemonUsage[]>([]);
  const [usageFallback, setUsageFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState("doubles");
  const [viewMode, setViewMode] = useState<ViewMode>("usage");
  const [selectedPokemon, setSelectedPokemon] = useState<SelectedPokemon | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setUsageFallback(false);
    try {
      const [metaData, usage] = await Promise.all([
        fetchLatestMeta(),
        fetchUsage(formatFilter, 50),
      ]);
      setSnapshots(metaData);

      if (usage.data.length === 0 && formatFilter !== "doubles") {
        const fallback = await fetchUsage("doubles", 50);
        setUsageData(fallback.data);
        setUsageFallback(true);
      } else {
        setUsageData(usage.data);
      }
    } catch (err) {
      setError(friendlyError(err).message);
      setSnapshots([]);
      setUsageData([]);
    } finally {
      setIsLoading(false);
    }
  }, [formatFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePokemonClick = (name: string, tier?: string) => {
    setSelectedPokemon({ name, tier, format: formatFilter });
  };

  const filteredSnapshots = formatFilter
    ? snapshots.filter((s) => s.format === formatFilter)
    : snapshots;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
            Meta Tracker
          </h1>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            Regulation M-A &middot; {usageData.length} Pokemon tracked
          </p>
        </div>
      </div>

      {/* View mode + format filters */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {META_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormatFilter(f)}
              className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-all ${
                formatFilter === f
                  ? "bg-primary text-surface"
                  : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-low p-1">
          <button
            onClick={() => setViewMode("usage")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "usage"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Usage
          </button>
          <button
            onClick={() => setViewMode("tiers")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "tiers"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Tiers
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton variant="list" count={8} />
      ) : error ? (
        <ErrorCard
          title="Couldn't load meta data"
          message={error}
          onRetry={loadData}
        />
      ) : viewMode === "usage" ? (
        usageData.length === 0 ? (
          <EmptyState
            title="No usage data yet"
            description="Usage data is refreshed automatically from Pikalytics."
          />
        ) : (
          <>
            {usageFallback && (
              <div className="mb-4 rounded-lg bg-surface-mid px-4 py-2.5">
                <p className="font-display text-xs text-on-surface-muted">
                  No {formatFilter} tournament data available yet — showing doubles usage.
                </p>
              </div>
            )}
            <UsageList data={usageData} onPokemonClick={handlePokemonClick} />
          </>
        )
      ) : (
        <div className="animate-stagger flex flex-col gap-6">
          {filteredSnapshots.length === 0 ? (
            usageData.length > 0 ? (
              <>
                <div className="rounded-lg bg-surface-mid px-4 py-2.5">
                  <p className="font-display text-xs text-on-surface-muted">
                    No curated tier snapshot is available for {formatFilter}; showing usage as the live meta fallback.
                  </p>
                </div>
                <UsageList data={usageData} onPokemonClick={handlePokemonClick} />
              </>
            ) : (
              <EmptyState
                title="No tier data yet"
                description="Tier data is sourced from Smogon, Pikalytics, and Limitless."
              />
            )
          ) : (
            filteredSnapshots.map((snapshot) => (
              <TierListCard
                key={snapshot.id}
                snapshot={snapshot}
                onPokemonClick={(name, tier) => handlePokemonClick(name, tier)}
              />
            ))
          )}
        </div>
      )}

      {/* Attribution */}
      <div className="mt-12 text-center">
        <p className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
          Usage data from Pikalytics. Tier data from Smogon and Limitless. Pokemon data from Serebii and PokeAPI.
        </p>
      </div>

      {/* Detail panel */}
      {selectedPokemon && (
        <PokemonDetailPanel
          pokemonName={selectedPokemon.name}
          tier={selectedPokemon.tier ?? ""}
          format={selectedPokemon.format}
          onClose={() => setSelectedPokemon(null)}
        />
      )}
    </div>
  );
}
