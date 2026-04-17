"use client";

import Image from "next/image";
import type { PokemonUsage } from "@/types/usage";

interface UsageListProps {
  data: PokemonUsage[];
  onPokemonClick: (name: string) => void;
}

export function UsageList({ data, onPokemonClick }: UsageListProps) {
  const maxUsage = data[0]?.usage_percent ?? 100;

  return (
    <div className="animate-stagger flex flex-col gap-2">
      {data.map((entry, i) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onPokemonClick(entry.pokemon_name)}
          className="group flex items-center gap-4 rounded-xl card p-4 text-left transition-all hover:bg-surface-mid hover:-translate-y-0.5"
        >
          {/* Rank */}
          <span className="w-8 shrink-0 text-right font-display text-sm font-bold text-on-surface-muted">
            {i + 1}
          </span>

          {/* Sprite */}
          <div className="h-10 w-10 shrink-0">
            {entry.sprite_url ? (
              <Image
                src={entry.sprite_url}
                alt={entry.pokemon_name}
                width={40}
                height={40}
                className="image-rendering-pixelated"
                unoptimized
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-surface-mid" />
            )}
          </div>

          {/* Name + usage bar */}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-display text-sm font-semibold text-on-surface">
                {entry.pokemon_name}
              </span>
              <span className="font-display text-xs font-bold text-primary">
                {entry.usage_percent.toFixed(1)}%
              </span>
            </div>
            {/* Usage bar */}
            <div className="h-1.5 w-full rounded-full bg-surface-mid">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(entry.usage_percent / maxUsage) * 100}%` }}
              />
            </div>
          </div>

          {/* Top moves (first 4) */}
          <div className="hidden w-44 shrink-0 md:block">
            <span className="mb-1 block font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Top Moves
            </span>
            {(entry.moves ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {entry.moves!.slice(0, 4).map((m) => (
                  <span
                    key={m.name}
                    className="rounded-full bg-surface-mid px-2 py-0.5 font-body text-[0.6rem] text-on-surface"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="font-body text-[0.6rem] italic text-on-surface-muted">
                No move data
              </span>
            )}
          </div>

          {/* Top item */}
          <div className="hidden w-28 shrink-0 lg:block">
            <span className="mb-1 block font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Item
            </span>
            {entry.items && entry.items[0] ? (
              <span className="font-body text-xs text-on-surface">
                {entry.items[0].name}
                <span className="ml-1 text-on-surface-muted">
                  {entry.items[0].percent.toFixed(0)}%
                </span>
              </span>
            ) : (
              <span className="font-body text-xs text-on-surface-muted">--</span>
            )}
          </div>

          {/* Top ability */}
          <div className="hidden w-28 shrink-0 xl:block">
            <span className="mb-1 block font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Ability
            </span>
            {entry.abilities && entry.abilities[0] ? (
              <span className="font-body text-xs text-on-surface">
                {entry.abilities[0].name}
              </span>
            ) : (
              <span className="font-body text-xs text-on-surface-muted">--</span>
            )}
          </div>

          {/* Arrow */}
          <span className="text-on-surface-muted opacity-0 transition-opacity group-hover:opacity-100">
            &rsaquo;
          </span>
        </button>
      ))}
    </div>
  );
}
