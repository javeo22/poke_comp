"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchPokemonDetail } from "@/lib/api";
import { TypeBadge } from "@/features/pokemon/components/type-badge";
import { StatBar } from "@/features/pokemon/components/stat-bar";
import type { PokemonDetail, MoveDetail } from "@/features/pokemon/types";

const CATEGORY_STYLES: Record<string, string> = {
  physical: "bg-type-fire/20 text-type-fire",
  special: "bg-type-water/20 text-type-water",
  status: "bg-on-surface-muted/20 text-on-surface-muted",
};

export default function PokemonDetailPage() {
  const params = useParams();
  const pokemonId = Number(params.id);

  const isValidId = !isNaN(pokemonId) && pokemonId > 0;
  const [pokemon, setPokemon] = useState<PokemonDetail | null>(null);
  const [loading, setLoading] = useState(isValidId);
  const [error, setError] = useState<string | null>(isValidId ? null : "Invalid Pokemon ID");
  const [moveFilter, setMoveFilter] = useState("");
  const [moveCategoryFilter, setMoveCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (!isValidId) return;

    fetchPokemonDetail(pokemonId)
      .then(setPokemon)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || /not found/i.test(msg)) {
          setError("Pokemon not found.");
        } else if (/5\d\d/.test(msg)) {
          setError("Server error — please try again.");
        } else {
          setError(`Could not load Pokemon data. Check your connection.`);
        }
      })
      .finally(() => setLoading(false));
  }, [pokemonId, isValidId]);

  if (loading) return <DetailSkeleton />;
  if (error || !pokemon) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <p className="text-on-surface-muted">{error || "Pokemon not found"}</p>
        <Link href="/pokemon" className="mt-4 inline-block text-primary hover:underline">
          Back to Pokedex
        </Link>
      </div>
    );
  }

  const totalStats = Object.values(pokemon.base_stats).reduce((s, v) => s + v, 0);
  const primaryColor = `var(--color-type-${pokemon.types[0]})`;

  // Filter moves
  const filteredMoves = pokemon.move_details.filter((m) => {
    const nameMatch = m.name.toLowerCase().includes(moveFilter.toLowerCase());
    const catMatch = moveCategoryFilter === "all" || m.category === moveCategoryFilter;
    return nameMatch && catMatch;
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-on-surface-muted">
        <Link href="/pokemon" className="hover:text-primary transition-colors">
          Pokedex
        </Link>
        <span>/</span>
        <span className="text-on-surface">{pokemon.name}</span>
      </nav>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Sprite + basic info */}
          <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:min-w-[140px]">
            {pokemon.sprite_url && (
              <Image
                src={pokemon.sprite_url}
                alt={pokemon.name}
                width={96}
                height={96}
                className="image-rendering-pixelated drop-shadow-lg"
                unoptimized
              />
            )}
            <div className="sm:text-center">
              <p className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
                #{String(pokemon.id).padStart(4, "0")}
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface">
                {pokemon.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-center">
                {pokemon.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              {pokemon.champions_eligible && (
                <span className="mt-2 inline-block rounded-full px-3 py-0.5 font-display text-[0.6rem] uppercase tracking-widest border border-secondary/30 text-secondary">
                  Champions
                </span>
              )}
              {pokemon.champions_eligible && (
                <Link
                  href={`/roster?add=${pokemon.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-4 py-1.5 font-display text-xs uppercase tracking-wider text-primary transition-colors hover:bg-primary/25"
                >
                  Add to Roster
                </Link>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1">
            <h2 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Base Stats
            </h2>
            <div className="flex flex-col gap-2">
              {Object.entries(pokemon.base_stats).map(([stat, value]) => (
                <StatBar key={stat} stat={stat} value={value} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
              <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
                BST
              </span>
              <span className="font-display text-lg font-bold" style={{ color: primaryColor }}>
                {totalStats}
              </span>
            </div>
          </div>
        </div>

        {/* Mega evolution link */}
        {pokemon.mega_evolution_name && pokemon.mega_evolution_id && (
          <div className="mt-4 border-t border-outline-variant pt-4">
            <Link
              href={`/pokemon/${pokemon.mega_evolution_id}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
                Mega Evolution:
              </span>
              {pokemon.mega_evolution_name}
            </Link>
          </div>
        )}
      </div>

      {/* Two-column layout: Abilities + Usage */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Abilities */}
        <div className="card p-6">
          <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Abilities ({pokemon.ability_details.length})
          </h2>
          {pokemon.ability_details.length > 0 ? (
            <div className="space-y-3">
              {pokemon.ability_details.map((a) => (
                <div key={a.name} className="rounded-lg bg-surface-lowest p-3 border border-outline-variant">
                  <p className="font-display text-sm font-semibold text-on-surface">{a.name}</p>
                  {a.effect_text && (
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
                      {a.effect_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-muted">
              Ability data from: {pokemon.abilities.join(", ")}
            </p>
          )}
        </div>

        {/* Usage data */}
        <div className="card p-6">
          <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Competitive Usage
          </h2>
          {pokemon.usage.length > 0 ? (
            <div className="space-y-4">
              {pokemon.usage.map((u) => {
                const hasAnyDetail =
                  u.top_moves.length > 0 ||
                  u.top_items.length > 0 ||
                  u.top_abilities.length > 0 ||
                  u.top_teammates.length > 0;

                return (
                  <div key={u.format} className="rounded-lg bg-surface-lowest p-3 border border-outline-variant">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface">
                        {u.format}
                      </span>
                      <span className="font-display text-sm font-bold text-primary">
                        {u.usage_percent.toFixed(1)}%
                      </span>
                    </div>
                    {u.top_moves.length > 0 && (
                      <UsageRow label="Moves" items={u.top_moves} />
                    )}
                    {u.top_items.length > 0 && (
                      <UsageRow label="Items" items={u.top_items} />
                    )}
                    {u.top_abilities.length > 0 && (
                      <UsageRow label="Abilities" items={u.top_abilities} />
                    )}
                    {u.top_teammates.length > 0 && (
                      <UsageRow label="Teammates" items={u.top_teammates} />
                    )}
                    {!hasAnyDetail && (
                      <p className="mt-1 text-xs italic text-on-surface-muted">
                        Usage % only -- detailed breakdowns pending data refresh
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-surface-lowest p-4 border border-outline-variant text-center">
              <p className="text-sm text-on-surface-muted">No usage data available yet.</p>
              <p className="mt-1 text-xs text-on-surface-muted">
                Data refreshes automatically from Pikalytics and Smogon.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Movepool */}
      <div className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Movepool ({pokemon.move_details.length} moves)
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={moveFilter}
              onChange={(e) => setMoveFilter(e.target.value)}
              placeholder="Filter moves..."
              className="input-field h-8 w-40 px-3 text-xs"
            />
            <select
              value={moveCategoryFilter}
              onChange={(e) => setMoveCategoryFilter(e.target.value)}
              className="input-field h-8 px-2 text-xs"
            >
              <option value="all">All</option>
              <option value="physical">Physical</option>
              <option value="special">Special</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {filteredMoves.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left">
                  <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
                    Move
                  </th>
                  <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
                    Type
                  </th>
                  <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
                    Cat
                  </th>
                  <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted text-right">
                    Pwr
                  </th>
                  <th className="pb-2 font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted text-right">
                    Acc
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMoves.map((m) => (
                  <MoveRow key={m.name} move={m} pokemonTypes={pokemon.types} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-on-surface-muted">
            {moveFilter || moveCategoryFilter !== "all"
              ? "No moves match your filter."
              : "No move data available."}
          </p>
        )}
      </div>
    </div>
  );
}

function MoveRow({ move, pokemonTypes }: { move: MoveDetail; pokemonTypes: string[] }) {
  const isSTAB = pokemonTypes.includes(move.type);
  const catStyle = CATEGORY_STYLES[move.category] || "";

  return (
    <tr className="border-b border-outline-variant/50 hover:bg-surface-mid/30 transition-colors">
      <td className="py-2 pr-4">
        <span className={`text-on-surface ${isSTAB ? "font-semibold" : ""}`}>
          {move.name}
        </span>
        {isSTAB && (
          <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.55rem] font-display uppercase tracking-wider text-accent">
            STAB
          </span>
        )}
      </td>
      <td className="py-2 pr-4">
        <TypeBadge type={move.type} />
      </td>
      <td className="py-2 pr-4">
        <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-display uppercase tracking-wider ${catStyle}`}>
          {move.category}
        </span>
      </td>
      <td className="py-2 pr-4 text-right font-display text-xs text-on-surface">
        {move.power ?? "--"}
      </td>
      <td className="py-2 text-right font-display text-xs text-on-surface">
        {move.accuracy ? `${move.accuracy}%` : "--"}
      </td>
    </tr>
  );
}

function UsageRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-1.5">
      <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {label}:
      </span>
      <span className="ml-1 text-xs text-on-surface">{items.join(", ")}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 animate-pulse">
      <div className="h-4 w-32 rounded bg-surface-high mb-6" />
      <div className="card p-6 mb-6">
        <div className="flex gap-6">
          <div className="h-24 w-24 rounded bg-surface-high" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 rounded bg-surface-high" />
            <div className="h-4 w-32 rounded bg-surface-high" />
            <div className="space-y-2 mt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-3 rounded bg-surface-high" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="card p-6 h-48" />
        <div className="card p-6 h-48" />
      </div>
      <div className="card p-6 h-96" />
    </div>
  );
}
