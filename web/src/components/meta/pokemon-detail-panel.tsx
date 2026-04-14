"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { PokemonUsage, UsageEntry } from "@/types/usage";
import { fetchPokemon, fetchPokemonUsage } from "@/lib/api";
import { TypeBadge } from "@/features/pokemon/components/type-badge";
import { StatBar } from "@/features/pokemon/components/stat-bar";

interface PokemonDetailPanelProps {
  pokemonName: string;
  tier: string;
  format: string;
  onClose: () => void;
}

function UsageBar({ entries, label, max = 4 }: { entries: UsageEntry[]; label: string; max?: number }) {
  if (!entries || entries.length === 0) return null;
  const topEntries = entries.slice(0, max);
  const highest = topEntries[0]?.percent ?? 1;

  return (
    <div>
      <h3 className="mb-2 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </h3>
      <div className="flex flex-col gap-1.5">
        {topEntries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="w-28 truncate font-body text-xs text-on-surface">
              {entry.name}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-surface-mid">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(entry.percent / highest) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right font-display text-[0.6rem] text-on-surface-muted">
              {entry.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PokemonDetailPanel({
  pokemonName,
  tier,
  format,
  onClose,
}: PokemonDetailPanelProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [usage, setUsage] = useState<PokemonUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchPokemon({ name: pokemonName, champions_only: true, limit: 5 }),
      fetchPokemonUsage(pokemonName),
    ])
      .then(([pokemonRes, usageRes]) => {
        if (cancelled) return;
        const match =
          pokemonRes.data.find(
            (p) => p.name.toLowerCase() === pokemonName.toLowerCase()
          ) ?? pokemonRes.data[0] ?? null;
        setPokemon(match);
        setUsage(usageRes[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPokemon(null);
          setUsage(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [pokemonName]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
      />

      <div className="panel-enter fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface-low">
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-mid px-3 py-1 font-display text-xs uppercase tracking-wider text-on-surface-muted">
              {format}
            </span>
            {tier && (
              <span className="rounded-full bg-surface-mid px-3 py-1 font-display text-xs font-bold text-primary">
                {tier} Tier
              </span>
            )}
            {usage && (
              <span className="rounded-full bg-secondary/15 px-3 py-1 font-display text-xs font-bold text-secondary">
                {usage.usage_percent.toFixed(1)}% usage
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-mid text-on-surface-muted hover:bg-surface-high hover:text-on-surface"
          >
            x
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-surface-mid" />
          </div>
        ) : !pokemon ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-on-surface-muted">Pokemon not found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-6">
            {/* Identity */}
            <div className="flex items-start gap-4">
              {pokemon.sprite_url && (
                <Image
                  src={pokemon.sprite_url}
                  alt={pokemon.name}
                  width={80}
                  height={80}
                  className="image-rendering-pixelated"
                  unoptimized
                />
              )}
              <div>
                <p className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  #{String(pokemon.id).padStart(4, "0")}
                </p>
                <h2 className="font-display text-2xl font-bold text-on-surface">
                  {pokemon.name}
                </h2>
                <div className="mt-2 flex gap-2">
                  {pokemon.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              </div>
            </div>

            {/* Usage sections — the competitive intelligence */}
            {usage ? (
              <>
                {usage.moves && (
                  <UsageBar entries={usage.moves} label="Most Used Moves" max={6} />
                )}

                {usage.items && (
                  <UsageBar entries={usage.items} label="Most Used Items" max={5} />
                )}

                {usage.abilities && (
                  <UsageBar entries={usage.abilities} label="Abilities" />
                )}

                {usage.teammates && (
                  <UsageBar entries={usage.teammates} label="Common Teammates" max={6} />
                )}
              </>
            ) : (
              <div className="rounded-xl bg-surface-mid p-4 text-center">
                <p className="font-display text-xs text-on-surface-muted">
                  No competitive usage data available
                </p>
              </div>
            )}

            {/* Base Stats */}
            <div>
              <h3 className="mb-2 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                Base Stats
              </h3>
              <div className="flex flex-col gap-1.5 rounded-xl bg-surface-mid p-4">
                {Object.entries(pokemon.base_stats).map(([stat, value]) => (
                  <StatBar key={stat} stat={stat} value={value} />
                ))}
              </div>
            </div>

            {/* Abilities list */}
            <div>
              <h3 className="mb-2 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                Available Abilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {pokemon.abilities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-primary/15 px-3 py-1 font-body text-sm text-primary"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Mega info */}
            {pokemon.mega_evolution_id && (
              <div className="rounded-xl bg-primary/10 p-4">
                <p className="font-display text-xs uppercase tracking-wider text-primary">
                  Mega Evolution Available
                </p>
              </div>
            )}

            {/* Movepool (collapsed) */}
            <details className="group">
              <summary className="cursor-pointer font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted hover:text-on-surface">
                Full Movepool ({pokemon.movepool.length} moves)
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pokemon.movepool.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-surface-mid px-2.5 py-1 font-body text-[0.7rem] text-on-surface"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </>
  );
}
