"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { POKEMON_TYPES, type Pokemon, type PokemonType } from "@/features/pokemon/types";
import { SpriteFallback } from "@/components/ui/sprite-fallback";
import type { UserPokemon } from "@/types/user-pokemon";
import {
  ASSISTANT_ARCHETYPES,
  getBuilderRecommendations,
  type AssistantArchetype,
  type AssistantMode,
  type BuilderRecommendation,
  type SelectedTeamMember,
} from "@/lib/team-builder-recommendations";
import { formatType, isPokemonType } from "@/lib/type-effectiveness";

interface TeamBuilderAssistantProps {
  pokemon: Pokemon[];
  roster: UserPokemon[];
  selectedMembers: SelectedTeamMember[];
  selectedCount: number;
  archetypeTag: string;
  onArchetypeTagChange: (tag: string) => void;
  onAddRosterEntry: (rosterEntryId: string) => void;
  onCreateWishlist?: (pokemon: Pokemon) => Promise<void>;
}

export function TeamBuilderAssistant({
  pokemon,
  roster,
  selectedMembers,
  selectedCount,
  archetypeTag,
  onArchetypeTagChange,
  onAddRosterEntry,
  onCreateWishlist,
}: TeamBuilderAssistantProps) {
  const [mode, setMode] = useState<AssistantMode>("archetype");
  const [archetype, setArchetype] = useState<AssistantArchetype>(() =>
    parseArchetypeTag(archetypeTag) ?? "trick-room"
  );
  const [targetType, setTargetType] = useState<PokemonType>("fairy");
  const [pendingWishlistId, setPendingWishlistId] = useState<number | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  const lanes = useMemo(
    () =>
      getBuilderRecommendations({
        mode,
        archetype,
        targetType,
        pokemon,
        roster,
        selectedMembers,
      }),
    [archetype, mode, pokemon, roster, selectedMembers, targetType]
  );

  const handleArchetypeChange = (nextArchetype: AssistantArchetype) => {
    setArchetype(nextArchetype);
    onArchetypeTagChange(nextArchetype);
  };

  const handleWishlist = async (recommendation: BuilderRecommendation) => {
    if (!onCreateWishlist || pendingWishlistId !== null) return;
    setWishlistError(null);
    setPendingWishlistId(recommendation.pokemon.id);
    try {
      await onCreateWishlist(recommendation.pokemon);
    } catch (err) {
      setWishlistError(err instanceof Error ? err.message : "Could not add wishlist entry.");
    } finally {
      setPendingWishlistId(null);
    }
  };

  return (
    <section className="mb-5 rounded-lg border-2 border-outline-variant bg-surface-lowest p-3 shadow-[3px_3px_0_var(--color-outline-variant)] sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md border-2 border-outline-variant bg-primary text-surface">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-on-surface">
              Builder Assistant
            </h3>
            <span className="font-mono text-[0.58rem] uppercase tracking-wider text-on-surface-muted">
              Deterministic recommendations
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-md border-2 border-outline-variant bg-surface p-1">
          <button
            type="button"
            aria-pressed={mode === "archetype"}
            onClick={() => setMode("archetype")}
            className={`h-8 rounded px-2.5 font-display text-[0.58rem] uppercase tracking-wider transition-colors ${
              mode === "archetype"
                ? "bg-secondary text-surface"
                : "text-on-surface-muted hover:bg-surface-lowest"
            }`}
          >
            Build Archetype
          </button>
          <button
            type="button"
            aria-pressed={mode === "gap"}
            onClick={() => setMode("gap")}
            className={`h-8 rounded px-2.5 font-display text-[0.58rem] uppercase tracking-wider transition-colors ${
              mode === "gap"
                ? "bg-secondary text-surface"
                : "text-on-surface-muted hover:bg-surface-lowest"
            }`}
          >
            Solve Gap
          </button>
        </div>
      </div>

      {mode === "archetype" ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ASSISTANT_ARCHETYPES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleArchetypeChange(option.id)}
              className={`rounded-md border px-2.5 py-1.5 font-display text-[0.58rem] uppercase tracking-wider transition-colors ${
                archetype === option.id
                  ? "border-secondary bg-secondary text-surface"
                  : "border-outline-variant bg-surface-low text-on-surface-muted hover:bg-surface-mid"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4 grid gap-2 sm:max-w-xs">
          <label className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
            Target Type
          </label>
          <select
            value={targetType}
            onChange={(event) => {
              if (isPokemonType(event.target.value)) {
                setTargetType(event.target.value);
              }
            }}
            className="input-field h-10 rounded-lg px-3 font-body text-sm text-on-surface"
          >
            {POKEMON_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatType(type)}
              </option>
            ))}
          </select>
        </div>
      )}

      {wishlistError && (
        <div className="mb-3 rounded-lg border border-tertiary bg-tertiary-container/45 px-3 py-2 font-body text-xs text-on-surface">
          {wishlistError}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {lanes.map((lane) => (
          <section
            key={lane.id}
            className="rounded-lg border border-outline-variant bg-surface-low p-2.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[0.62rem] uppercase tracking-wider text-on-surface-muted">
                {lane.label}
              </span>
              <span className="rounded-md bg-surface-lowest px-2 py-1 font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
                {lane.recommendations.length}
              </span>
            </div>

            <div className="grid gap-2">
              {lane.recommendations.length === 0 ? (
                <div className="rounded-md border border-dashed border-outline-variant bg-surface-lowest px-3 py-4 text-center font-body text-xs text-on-surface-muted">
                  No matches yet.
                </div>
              ) : (
                lane.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    isWishlistPending={pendingWishlistId === recommendation.pokemon.id}
                    isTeamFull={selectedCount >= 6}
                    canCreateWishlist={!!onCreateWishlist}
                    onAddRosterEntry={onAddRosterEntry}
                    onCreateWishlist={handleWishlist}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
  isWishlistPending,
  isTeamFull,
  canCreateWishlist,
  onAddRosterEntry,
  onCreateWishlist,
}: {
  recommendation: BuilderRecommendation;
  isWishlistPending: boolean;
  isTeamFull: boolean;
  canCreateWishlist: boolean;
  onAddRosterEntry: (rosterEntryId: string) => void;
  onCreateWishlist: (recommendation: BuilderRecommendation) => Promise<void>;
}) {
  const actionDisabled =
    recommendation.isOnTeam ||
    isWishlistPending ||
    (!!recommendation.rosterEntry && isTeamFull) ||
    (!recommendation.rosterEntry && !canCreateWishlist);

  return (
    <article className="rounded-lg border border-outline-variant bg-surface-lowest p-2.5">
      <div className="flex gap-2.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-surface-low">
          {recommendation.pokemon.sprite_url ? (
            <Image
              src={recommendation.pokemon.sprite_url}
              alt={recommendation.pokemon.name}
              width={44}
              height={44}
              className="image-rendering-pixelated"
              unoptimized
            />
          ) : (
            <SpriteFallback size={38} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-display text-sm font-semibold text-on-surface">
                {recommendation.pokemon.name}
              </h4>
              <div className="mt-1 flex flex-wrap gap-1">
                {recommendation.pokemon.types.map((type) => (
                  <TypePill key={type} type={type} />
                ))}
                <StatusPill status={recommendation.rosterStatus} />
              </div>
            </div>
            <ScorePill label={recommendation.scoreLabel} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {recommendation.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-md border border-outline-variant bg-surface px-2 py-1 font-body text-[0.65rem] leading-none text-on-surface-muted"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={actionDisabled}
          onClick={() => {
            if (recommendation.rosterEntry) {
              onAddRosterEntry(recommendation.rosterEntry.id);
            } else {
              void onCreateWishlist(recommendation);
            }
          }}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 font-display text-[0.6rem] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            recommendation.isOnTeam
              ? "border-secondary bg-secondary text-surface"
              : recommendation.rosterEntry
                ? "border-outline-variant bg-primary text-surface hover:bg-primary/90"
                : "border-primary bg-surface text-primary hover:bg-primary/10"
          }`}
          title={
            isTeamFull && recommendation.rosterEntry && !recommendation.isOnTeam
              ? "Team is full"
              : undefined
          }
        >
          {recommendation.isOnTeam ? (
            <>
              <Check size={13} aria-hidden="true" />
              On team
            </>
          ) : isWishlistPending ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Adding
            </>
          ) : recommendation.rosterEntry ? (
            <>
              <Plus size={13} aria-hidden="true" />
              Add to team
            </>
          ) : (
            <>
              <Plus size={13} aria-hidden="true" />
              Add wishlist
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function ScorePill({ label }: { label: BuilderRecommendation["scoreLabel"] }) {
  const className =
    label === "Excellent"
      ? "bg-secondary text-surface"
      : label === "Good"
        ? "bg-primary text-surface"
        : "bg-tertiary-container text-on-surface";

  return (
    <span
      className={`${className} shrink-0 rounded-md px-2 py-1 font-display text-[0.55rem] uppercase tracking-wider`}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: BuilderRecommendation["rosterStatus"] }) {
  const labels: Record<BuilderRecommendation["rosterStatus"], string> = {
    built: "Built",
    training: "Training",
    wishlist: "Wishlist",
    unowned: "Dex",
  };
  const className =
    status === "built"
      ? "bg-success text-surface"
      : status === "training"
        ? "bg-accent-container text-on-surface"
        : status === "wishlist"
          ? "bg-primary-container text-on-surface"
          : "bg-surface-high text-on-surface-muted";

  return (
    <span
      className={`${className} rounded-md px-2 py-0.5 font-display text-[0.5rem] uppercase tracking-wider`}
    >
      {labels[status]}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span
      className="rounded-md border px-2 py-0.5 font-display text-[0.5rem] uppercase tracking-wider text-on-surface"
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-type-${type}) 34%, white)`,
        borderColor: `color-mix(in srgb, var(--color-type-${type}) 70%, black)`,
      }}
    >
      {type}
    </span>
  );
}

function parseArchetypeTag(tag: string): AssistantArchetype | null {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, "-");
  const match = ASSISTANT_ARCHETYPES.find((option) => option.id === normalized);
  return match?.id ?? null;
}
