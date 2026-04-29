"use client";

import { useCallback, useEffect, useState } from "react";
import type { Team } from "@/types/team";
import type { PokemonBasic } from "@/features/pokemon/types";
import type { Matchup, MatchupStats, MatchFormat, CloseType } from "@/types/matchup";

const FORMAT_OPTIONS: { value: MatchFormat | ""; label: string }[] = [
  { value: "", label: "Unspecified" },
  { value: "ladder", label: "Ladder" },
  { value: "bo1", label: "Best-of-1" },
  { value: "bo3", label: "Best-of-3" },
  { value: "tournament", label: "Tournament" },
  { value: "friendly", label: "Friendly" },
];

const CLOSE_TYPE_OPTIONS: { value: CloseType | ""; label: string }[] = [
  { value: "", label: "Not tagged" },
  { value: "blowout", label: "Blowout" },
  { value: "close", label: "Close" },
  { value: "comeback", label: "Comeback" },
  { value: "standard", label: "Standard" },
];

const FORMAT_BADGE_STYLES: Record<string, string> = {
  ladder: "bg-primary/20 text-primary",
  bo1: "bg-secondary/20 text-secondary",
  bo3: "bg-tertiary/20 text-tertiary",
  tournament: "bg-amber-500/20 text-amber-400",
  friendly: "bg-surface-high text-on-surface-muted",
};

const CLOSE_TYPE_STYLES: Record<string, string> = {
  blowout: "bg-tertiary/15 text-tertiary",
  close: "bg-amber-500/15 text-amber-400",
  comeback: "bg-secondary/15 text-secondary",
  standard: "bg-surface-high text-on-surface-muted",
};
import {
  fetchTeams,
  fetchPokemonBasic,
  fetchUsage,
  fetchUserPokemon,
  fetchMatchups,
  fetchMatchupStats,
  createMatchup,
  deleteMatchup,
} from "@/lib/api";
import type { UserPokemon } from "@/types/user-pokemon";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { friendlyError } from "@/lib/errors";

type ViewMode = "log" | "stats";

export default function MatchesPage() {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [stats, setStats] = useState<MatchupStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  // UUID (user_pokemon.id) -> { pokemon_id, ... } for resolving team rosters.
  const [userPokemonByUuid, setUserPokemonByUuid] = useState<Map<string, UserPokemon>>(new Map());
  // pokemon_id -> name for resolving user_pokemon.pokemon_id to display name.
  const [pokemonNameById, setPokemonNameById] = useState<Map<number, string>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("log");

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState<MatchFormat | "">("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTeamId, setFormTeamId] = useState("");
  // The actual lineup run this match. Defaults to the saved team's roster
  // (resolved via userPokemonByUuid + pokemonNameById) when the team is
  // selected; user can override any slot. Empty strings represent unfilled
  // slots (only relevant for partial teams).
  const [formMyTeamActual, setFormMyTeamActual] = useState<string[]>([]);
  const [formOpponents, setFormOpponents] = useState<string[]>(["", "", "", "", "", ""]);
  const [formLeads, setFormLeads] = useState<[string, string]>(["", ""]);
  const [formOutcome, setFormOutcome] = useState<"win" | "loss">("win");
  const [formNotes, setFormNotes] = useState("");
  const [formFormat, setFormFormat] = useState<MatchFormat | "">("");
  const [formTags, setFormTags] = useState("");
  const [formCloseType, setFormCloseType] = useState<CloseType | "">("");
  const [formMvp, setFormMvp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [matchResult, statsResult, teamsResult, pokemonResult, usageResult, userPokeResult] =
        await Promise.all([
          fetchMatchups({
            outcome: outcomeFilter || undefined,
            my_team_id: teamFilter || undefined,
            format: formatFilter || undefined,
            limit: 100,
          }),
          fetchMatchupStats(),
          fetchTeams({ limit: 200 }),
          fetchPokemonBasic({ limit: 500, champions_only: true }),
          fetchUsage("doubles", 50).catch(() => null),
          fetchUserPokemon({ limit: 500 }).catch(() => null),
        ]);
      setMatchups(matchResult.data);
      setCount(matchResult.count);
      setStats(statsResult);
      setTeams(teamsResult.data);

      const allPokemon = pokemonResult.data;
      setPokemonNameById(new Map(allPokemon.map((p: PokemonBasic) => [p.id, p.name])));
      setUserPokemonByUuid(
        new Map((userPokeResult?.data ?? []).map((up: UserPokemon) => [up.id, up]))
      );
      const byName = new Map(
        allPokemon.map((p: PokemonBasic) => [p.name.toLowerCase(), p])
      );
      const topUsageNames = (usageResult?.data ?? [])
        .map((u) => u.pokemon_name)
        .filter((n) => byName.has(n.toLowerCase()));
      const topSet = new Set(topUsageNames.map((n) => n.toLowerCase()));

      const topOptions: DropdownOption[] = topUsageNames
        .map((n) => byName.get(n.toLowerCase())!)
        .map((p) => ({
          value: p.name,
          label: p.name,
          sublabel: p.types.join("/"),
          section: "Most Used",
        }));

      const restOptions: DropdownOption[] = allPokemon
        .filter((p: PokemonBasic) => !topSet.has(p.name.toLowerCase()))
        .sort((a: PokemonBasic, b: PokemonBasic) => a.name.localeCompare(b.name))
        .map((p: PokemonBasic) => ({
          value: p.name,
          label: p.name,
          sublabel: p.types.join("/"),
          section: "All Pokemon",
        }));

      setPokemonOptions([...topOptions, ...restOptions]);
    } catch (err) {
      setError(friendlyError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [outcomeFilter, teamFilter, formatFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: t.name,
    sublabel: t.format,
  }));

  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  // Resolve a team's pokemon_ids (user_pokemon UUIDs) to display names via
  // the two lookup maps. Unresolvable entries become "" (empty slot).
  const resolveTeamLineup = useCallback(
    (teamId: string): string[] => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return [];
      return team.pokemon_ids.map((uuid) => {
        const up = userPokemonByUuid.get(uuid);
        if (!up) return "";
        return pokemonNameById.get(up.pokemon_id) ?? "";
      });
    },
    [teams, userPokemonByUuid, pokemonNameById]
  );

  // When the selected team changes, reset the "actual lineup" to the
  // resolved team roster. User can then override individual slots.
  useEffect(() => {
    if (!formTeamId) {
      setFormMyTeamActual([]);
      return;
    }
    setFormMyTeamActual(resolveTeamLineup(formTeamId));
  }, [formTeamId, resolveTeamLineup]);

  const resetForm = () => {
    setFormTeamId("");
    setFormMyTeamActual([]);
    setFormOpponents(["", "", "", "", "", ""]);
    setFormLeads(["", ""]);
    setFormOutcome("win");
    setFormNotes("");
    setFormFormat("");
    setFormTags("");
    setFormCloseType("");
    setFormMvp("");
  };

  const handleSubmit = async () => {
    const filledOpponents = formOpponents.filter((s) => s.trim() !== "");
    if (!formTeamId || filledOpponents.length === 0) return;

    setIsSubmitting(true);
    try {
      const leads =
        formLeads[0] && formLeads[1] ? formLeads : undefined;
      const parsedTags = formTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      // Only send my_team_actual when it differs from the saved team's
      // resolved roster -- otherwise NULL preserves the "matches saved
      // team" semantic and old rows behave identically.
      const teamDefault = resolveTeamLineup(formTeamId);
      const actualFilled = formMyTeamActual.filter((s) => s.trim() !== "");
      const differs =
        actualFilled.length !== teamDefault.filter((s) => s).length ||
        formMyTeamActual.some((name, i) => (name || "") !== (teamDefault[i] || ""));
      const myTeamActual =
        differs && actualFilled.length > 0 ? actualFilled : undefined;
      await createMatchup({
        my_team_id: formTeamId,
        opponent_team_data: filledOpponents.map((name) => ({ name })),
        lead_pair: leads,
        outcome: formOutcome,
        notes: formNotes || undefined,
        format: formFormat || undefined,
        tags: parsedTags.length ? parsedTags : undefined,
        close_type: formCloseType || undefined,
        mvp_pokemon: formMvp || undefined,
        my_team_actual: myTeamActual,
      });
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to log match:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMatchup(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete match:", err);
    }
  };

  const updateOpponent = (index: number, value: string) => {
    setFormOpponents((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
            Matches
          </h1>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            {count} match{count !== 1 ? "es" : ""} logged
            {stats && stats.overall.total > 0 && (
              <span>
                {" "}&middot; {stats.overall.win_rate}% win rate
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
        >
          Log Match
        </button>
      </div>

      {/* View toggle + filters */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setOutcomeFilter("")}
            className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-all ${
              outcomeFilter === ""
                ? "bg-primary text-surface"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setOutcomeFilter(outcomeFilter === "win" ? "" : "win")}
            className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-all ${
              outcomeFilter === "win"
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setOutcomeFilter(outcomeFilter === "loss" ? "" : "loss")}
            className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-all ${
              outcomeFilter === "loss"
                ? "bg-tertiary/20 text-tertiary"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
            }`}
          >
            Losses
          </button>
          {teams.length > 0 && (
            <div className="ml-2 w-48">
              <SearchableDropdown
                placeholder="Filter by team..."
                value={teamFilter}
                onChange={setTeamFilter}
                options={[{ value: "", label: "All Teams" }, ...teamOptions]}
              />
            </div>
          )}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as MatchFormat | "")}
            className="h-9 rounded-lg border border-outline-variant bg-surface-high px-3 font-display text-xs uppercase tracking-wider text-on-surface-muted hover:text-on-surface focus:outline-none"
            aria-label="Filter by format"
          >
            <option value="">All Formats</option>
            {FORMAT_OPTIONS.filter((o) => o.value !== "").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-low p-1">
          <button
            onClick={() => setViewMode("log")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "log"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setViewMode("stats")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "stats"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Stats
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton variant="list" count={6} />
      ) : error ? (
        <ErrorCard
          title="Couldn't load matches"
          message={error}
          onRetry={loadData}
        />
      ) : viewMode === "log" ? (
        /* Match log */
        matchups.length === 0 ? (
          <EmptyState
            title="No matches logged yet"
            description="Log your first match to start tracking win rates by team, format, and matchup."
            action={
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
              >
                Log Your First Match
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {matchups.map((m) => (
              <div
                key={m.id}
                className="group flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-low p-4 transition-all hover:bg-surface-mid sm:flex-row sm:items-start"
              >
                {/* Outcome badge */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold uppercase ${
                    m.outcome === "win"
                      ? "bg-secondary/20 text-secondary"
                      : "bg-tertiary/20 text-tertiary"
                  }`}
                >
                  {m.outcome === "win" ? "W" : "L"}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {/* Top row: team, vs, opponent */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-on-surface">
                      {m.my_team_id
                        ? teamNameMap.get(m.my_team_id) ?? "Unknown Team"
                        : "Unknown Team"}
                    </span>
                    <span className="font-display text-xs text-on-surface-muted">
                      vs
                    </span>
                    <span className="truncate font-body text-sm text-on-surface">
                      {m.opponent_team_data
                        ?.map((p) => p.name)
                        .join(", ") ?? "Unknown"}
                    </span>
                    {m.format && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${
                          FORMAT_BADGE_STYLES[m.format] ?? "bg-surface-high text-on-surface-muted"
                        }`}
                      >
                        {m.format}
                      </span>
                    )}
                    {m.close_type && m.close_type !== "standard" && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${
                          CLOSE_TYPE_STYLES[m.close_type] ?? "bg-surface-high text-on-surface-muted"
                        }`}
                      >
                        {m.close_type}
                      </span>
                    )}
                  </div>

                  {/* Meta row: leads + MVP */}
                  {(m.lead_pair || m.mvp_pokemon) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {m.lead_pair && (
                        <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                          Leads: <span className="text-on-surface">{m.lead_pair.join(" + ")}</span>
                        </span>
                      )}
                      {m.mvp_pokemon && (
                        <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                          MVP: <span className="text-secondary">{m.mvp_pokemon}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tag chips */}
                  {m.tags && m.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {m.notes && (
                    <p className="mt-2 font-body text-xs leading-relaxed text-on-surface-muted">
                      {m.notes}
                    </p>
                  )}
                </div>

                {/* Date + delete */}
                <div className="flex items-center gap-3 shrink-0 sm:flex-col sm:items-end sm:gap-2">
                  <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                    {new Date(m.played_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg px-2 py-1 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted opacity-0 transition-all hover:bg-tertiary/10 hover:text-tertiary group-hover:opacity-100 sm:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Stats view */
        <StatsView stats={stats} />
      )}

      {/* Log Match Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-on-surface">
                Log Match
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg px-3 py-1 font-display text-xs uppercase text-on-surface-muted hover:bg-surface-high"
              >
                Cancel
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {/* My team */}
              <div>
                <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  My Team
                </label>
                <SearchableDropdown
                  placeholder="Select team..."
                  value={formTeamId}
                  onChange={setFormTeamId}
                  options={teamOptions}
                />
                {formTeamId && formMyTeamActual.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
                      Actual lineup (override any slot if you swapped a Pokemon)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {formMyTeamActual.map((name, i) => (
                        <SearchableDropdown
                          key={i}
                          placeholder={`Slot ${i + 1}`}
                          value={name}
                          onChange={(v) =>
                            setFormMyTeamActual((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            })
                          }
                          options={pokemonOptions}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Outcome */}
              <div>
                <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  Outcome
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOutcome("win")}
                    className={`h-10 flex-1 rounded-lg font-display text-xs font-bold uppercase tracking-wider transition-all ${
                      formOutcome === "win"
                        ? "bg-secondary/20 text-secondary"
                        : "bg-surface-high text-on-surface-muted"
                    }`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormOutcome("loss")}
                    className={`h-10 flex-1 rounded-lg font-display text-xs font-bold uppercase tracking-wider transition-all ${
                      formOutcome === "loss"
                        ? "bg-tertiary/20 text-tertiary"
                        : "bg-surface-high text-on-surface-muted"
                    }`}
                  >
                    Loss
                  </button>
                </div>
              </div>

              {/* Opponent team */}
              <div>
                <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  Opponent Team
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {formOpponents.map((slot, i) => (
                    <SearchableDropdown
                      key={i}
                      placeholder={`Slot ${i + 1}`}
                      value={slot}
                      onChange={(v) => updateOpponent(i, v)}
                      options={pokemonOptions}
                    />
                  ))}
                </div>
              </div>

              {/* My leads */}
              <div>
                <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  My Leads (optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <SearchableDropdown
                    placeholder="Lead 1"
                    value={formLeads[0]}
                    onChange={(v) => setFormLeads([v, formLeads[1]])}
                    options={pokemonOptions}
                  />
                  <SearchableDropdown
                    placeholder="Lead 2"
                    value={formLeads[1]}
                    onChange={(v) => setFormLeads([formLeads[0], v])}
                    options={pokemonOptions}
                  />
                </div>
              </div>

              {/* Format + Close-type */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    Format (optional)
                  </label>
                  <select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value as MatchFormat | "")}
                    className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface outline-none"
                  >
                    {FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    Match feel (optional)
                  </label>
                  <select
                    value={formCloseType}
                    onChange={(e) => setFormCloseType(e.target.value as CloseType | "")}
                    className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface outline-none"
                  >
                    {CLOSE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags + MVP */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="rain, trick-room, hyper-offense"
                    className="input-field h-10 w-full rounded-lg px-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    MVP Pokemon (optional)
                  </label>
                  <SearchableDropdown
                    placeholder="Who carried?"
                    value={formMvp}
                    onChange={setFormMvp}
                    options={pokemonOptions}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                  Notes (optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="What happened? Key turns, misplays..."
                  rows={2}
                  className="input-field w-full rounded-xl px-4 py-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={
                  !formTeamId ||
                  formOpponents.filter((s) => s.trim()).length === 0 ||
                  isSubmitting
                }
                className="btn-primary h-12 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Log Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsView({ stats }: { stats: MatchupStats | null }) {
  if (!stats || stats.overall.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="font-display text-lg text-on-surface-muted">
          No stats yet -- log some matches first
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Overall */}
      <div className="rounded-xl bg-surface-low p-6">
        <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Overall Record
        </h3>
        <div className="flex items-end gap-8">
          <div>
            <span className="font-display text-5xl font-bold text-on-surface">
              {stats.overall.win_rate}%
            </span>
            <p className="mt-1 font-display text-xs uppercase tracking-wider text-on-surface-muted">
              Win Rate
            </p>
          </div>
          <div className="flex gap-6 pb-2">
            <div>
              <span className="font-display text-2xl font-bold text-secondary">
                {stats.overall.wins}
              </span>
              <span className="ml-1 font-display text-xs text-on-surface-muted">
                W
              </span>
            </div>
            <div>
              <span className="font-display text-2xl font-bold text-tertiary">
                {stats.overall.losses}
              </span>
              <span className="ml-1 font-display text-xs text-on-surface-muted">
                L
              </span>
            </div>
            <div>
              <span className="font-display text-2xl font-bold text-on-surface-muted">
                {stats.overall.total}
              </span>
              <span className="ml-1 font-display text-xs text-on-surface-muted">
                Total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* By team + By opponent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By team */}
        <div className="rounded-xl bg-surface-low p-6">
          <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            By Team
          </h3>
          {stats.by_team.length === 0 ? (
            <p className="text-sm text-on-surface-muted">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.by_team.map((s) => (
                <WinRateRow key={s.label} stat={s} />
              ))}
            </div>
          )}
        </div>

        {/* By opponent Pokemon */}
        <div className="rounded-xl bg-surface-low p-6">
          <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            vs Opponent Pokemon
          </h3>
          {stats.by_opponent_pokemon.length === 0 ? (
            <p className="text-sm text-on-surface-muted">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.by_opponent_pokemon.map((s) => (
                <WinRateRow key={s.label} stat={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By format + By tag */}
      {(stats.by_format?.length || stats.by_tag?.length) ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              By Format
            </h3>
            {!stats.by_format?.length ? (
              <p className="text-sm text-on-surface-muted">
                Tag some matches with a format to see this breakdown.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.by_format.map((s) => (
                  <WinRateRow key={s.label} stat={s} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              By Archetype Tag
            </h3>
            {!stats.by_tag?.length ? (
              <p className="text-sm text-on-surface-muted">
                Add tags like &quot;rain&quot; or &quot;trick-room&quot; on matches
                to segment by strategy.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.by_tag.map((s) => (
                  <WinRateRow key={s.label} stat={s} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WinRateRow({ stat }: { stat: { label: string; wins: number; losses: number; total: number; win_rate: number } }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 truncate font-display text-sm text-on-surface">
        {stat.label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-high">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-secondary transition-all"
          style={{ width: `${stat.win_rate}%` }}
        />
      </div>
      <span className="w-12 text-right font-display text-xs font-bold text-on-surface">
        {stat.win_rate}%
      </span>
      <span className="w-16 text-right font-display text-[0.6rem] text-on-surface-muted">
        {stat.wins}W {stat.losses}L
      </span>
    </div>
  );
}
