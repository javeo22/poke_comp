"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetaSnapshot } from "@/types/meta";
import type { PokemonUsage } from "@/types/usage";
import type { ScrapeResponse } from "@/lib/api";
import { META_FORMATS } from "@/types/meta";
import { fetchLatestMeta, fetchUsage, triggerMetaScrape } from "@/lib/api";
import { TierListCard } from "@/components/meta/tier-list-card";
import { UsageList } from "@/components/meta/usage-list";
import { PokemonDetailPanel } from "@/components/meta/pokemon-detail-panel";

type ViewMode = "usage" | "tiers";

interface SelectedPokemon {
  name: string;
  tier?: string;
  format: string;
}

export default function MetaPage() {
  const [snapshots, setSnapshots] = useState<MetaSnapshot[]>([]);
  const [usageData, setUsageData] = useState<PokemonUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState("doubles");
  const [viewMode, setViewMode] = useState<ViewMode>("usage");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);
  const [selectedPokemon, setSelectedPokemon] = useState<SelectedPokemon | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [metaData, usage] = await Promise.all([
        fetchLatestMeta(),
        fetchUsage(formatFilter, 50),
      ]);
      setSnapshots(metaData);
      setUsageData(usage.data);
    } catch (err) {
      console.error("Failed to load meta data:", err);
      setSnapshots([]);
      setUsageData([]);
    } finally {
      setIsLoading(false);
    }
  }, [formatFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeResult(null);
    try {
      const result = await triggerMetaScrape();
      setScrapeResult(result);
      loadData();
    } catch (err) {
      console.error("Scrape failed:", err);
    } finally {
      setIsScraping(false);
    }
  };

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
          <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
            Meta Tracker
          </h1>
          <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
            Regulation M-A &middot; {usageData.length} Pokemon tracked
          </p>
        </div>
        <button
          onClick={handleScrape}
          disabled={isScraping}
          className="h-10 rounded-pill gradient-primary px-6 font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top transition-all glow-teal disabled:opacity-50"
        >
          {isScraping ? "Updating..." : "Update Data"}
        </button>
      </div>

      {/* Scrape result banner */}
      {scrapeResult && (
        <div className="mb-6 rounded-chunky bg-surface-low p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              {scrapeResult.results.map((r) => (
                <span key={r.format} className="text-sm">
                  <span className="font-display uppercase text-on-surface-muted">
                    {r.format}:
                  </span>{" "}
                  <span className={r.status === "ok" ? "text-secondary" : "text-tertiary"}>
                    {r.status === "ok" ? `${r.pokemon_count} Pokemon` : r.status}
                  </span>
                </span>
              ))}
            </div>
            <span className="font-display text-xs text-on-surface-muted">
              ~${scrapeResult.estimated_cost_usd.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* View mode + format filters */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {META_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormatFilter(f)}
              className={`h-9 rounded-pill px-4 font-display text-xs uppercase tracking-wider transition-all ${
                formatFilter === f
                  ? "gradient-primary text-surface gloss-top"
                  : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-pill bg-surface-low p-1">
          <button
            onClick={() => setViewMode("usage")}
            className={`rounded-pill px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "usage"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Usage
          </button>
          <button
            onClick={() => setViewMode("tiers")}
            className={`rounded-pill px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
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
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-chunky bg-surface-low" />
          ))}
        </div>
      ) : viewMode === "usage" ? (
        usageData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="font-display text-lg text-on-surface-muted">No usage data yet</p>
            <code className="mt-4 rounded-chunky bg-surface-low px-4 py-2 font-mono text-sm text-primary">
              cd api && uv run python -m scripts.seed_usage
            </code>
          </div>
        ) : (
          <UsageList data={usageData} onPokemonClick={handlePokemonClick} />
        )
      ) : (
        <div className="animate-stagger flex flex-col gap-6">
          {filteredSnapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="font-display text-lg text-on-surface-muted">No tier data yet</p>
              <code className="mt-4 rounded-chunky bg-surface-low px-4 py-2 font-mono text-sm text-primary">
                cd api && uv run python -m scripts.seed_meta
              </code>
            </div>
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
          Usage data from Pikalytics. Tier data from Game8. Pokemon data from Serebii and PokeAPI.
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
