"use client";

import { useCallback, useEffect, useState } from "react";
import type { Team } from "@/types/team";
import type { Pokemon } from "@/features/pokemon/types";
import type { Matchup, MatchupStats } from "@/types/matchup";
import {
  fetchTeams,
  fetchPokemon,
  fetchMatchups,
  fetchMatchupStats,
  createMatchup,
  deleteMatchup,
} from "@/lib/api";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";

type ViewMode = "log" | "stats";

export default function MatchesPage() {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [stats, setStats] = useState<MatchupStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("log");

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTeamId, setFormTeamId] = useState("");
  const [formOpponents, setFormOpponents] = useState<string[]>(["", "", "", "", "", ""]);
  const [formLeads, setFormLeads] = useState<[string, string]>(["", ""]);
  const [formOutcome, setFormOutcome] = useState<"win" | "loss">("win");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [matchResult, statsResult, teamsResult, pokemonResult] =
        await Promise.all([
          fetchMatchups({
            outcome: outcomeFilter || undefined,
            my_team_id: teamFilter || undefined,
            limit: 100,
          }),
          fetchMatchupStats(),
          fetchTeams({ limit: 200 }),
          fetchPokemon({ limit: 500, champions_only: true }),
        ]);
      setMatchups(matchResult.data);
      setCount(matchResult.count);
      setStats(statsResult);
      setTeams(teamsResult.data);
      setPokemonOptions(
        pokemonResult.data.map((p: Pokemon) => ({
          value: p.name,
          label: p.name,
          sublabel: p.types.join("/"),
        }))
      );
    } catch (err) {
      console.error("Failed to load matches:", err);
    } finally {
      setIsLoading(false);
    }
  }, [outcomeFilter, teamFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: t.name,
    sublabel: t.format,
  }));

  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  const resetForm = () => {
    setFormTeamId("");
    setFormOpponents(["", "", "", "", "", ""]);
    setFormLeads(["", ""]);
    setFormOutcome("win");
    setFormNotes("");
  };

  const handleSubmit = async () => {
    const filledOpponents = formOpponents.filter((s) => s.trim() !== "");
    if (!formTeamId || filledOpponents.length === 0) return;

    setIsSubmitting(true);
    try {
      const leads =
        formLeads[0] && formLeads[1] ? formLeads : undefined;
      await createMatchup({
        my_team_id: formTeamId,
        opponent_team_data: filledOpponents.map((name) => ({ name })),
        lead_pair: leads,
        outcome: formOutcome,
        notes: formNotes || undefined,
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
          <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
            Matches
          </h1>
          <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
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
          className="h-10 rounded-pill gradient-primary px-6 font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top transition-all glow-teal"
        >
          Log Match
        </button>
      </div>

      {/* View toggle + filters */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setOutcomeFilter("")}
            className={`h-9 rounded-pill px-4 font-display text-xs uppercase tracking-wider transition-all ${
              outcomeFilter === ""
                ? "gradient-primary text-surface gloss-top"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setOutcomeFilter(outcomeFilter === "win" ? "" : "win")}
            className={`h-9 rounded-pill px-4 font-display text-xs uppercase tracking-wider transition-all ${
              outcomeFilter === "win"
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setOutcomeFilter(outcomeFilter === "loss" ? "" : "loss")}
            className={`h-9 rounded-pill px-4 font-display text-xs uppercase tracking-wider transition-all ${
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
        </div>
        <div className="flex gap-1 rounded-pill bg-surface-low p-1">
          <button
            onClick={() => setViewMode("log")}
            className={`rounded-pill px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
              viewMode === "log"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setViewMode("stats")}
            className={`rounded-pill px-4 py-1.5 font-display text-[0.65rem] uppercase tracking-wider transition-all ${
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
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-chunky bg-surface-low" />
          ))}
        </div>
      ) : viewMode === "log" ? (
        /* Match log */
        matchups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="font-display text-lg text-on-surface-muted">
              No matches logged yet
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 h-10 rounded-pill gradient-primary px-6 font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top"
            >
              Log Your First Match
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matchups.map((m) => (
              <div
                key={m.id}
                className="group flex items-center gap-4 rounded-chunky bg-surface-low p-4 transition-all hover:bg-surface-mid"
              >
                {/* Outcome badge */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill font-display text-xs font-bold uppercase ${
                    m.outcome === "win"
                      ? "bg-secondary/20 text-secondary"
                      : "bg-tertiary/20 text-tertiary"
                  }`}
                >
                  {m.outcome === "win" ? "W" : "L"}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    {m.lead_pair && (
                      <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                        Leads: {m.lead_pair.join(" + ")}
                      </span>
                    )}
                    {m.notes && (
                      <span className="truncate font-body text-xs text-on-surface-muted">
                        {m.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date + delete */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                    {new Date(m.played_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded-pill px-2 py-1 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted opacity-0 transition-all hover:bg-tertiary/10 hover:text-tertiary group-hover:opacity-100"
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
          <div className="w-full max-w-2xl rounded-chunky bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-on-surface">
                Log Match
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-pill px-3 py-1 font-display text-xs uppercase text-on-surface-muted hover:bg-surface-high"
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
                    className={`h-10 flex-1 rounded-pill font-display text-xs font-bold uppercase tracking-wider transition-all ${
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
                    className={`h-10 flex-1 rounded-pill font-display text-xs font-bold uppercase tracking-wider transition-all ${
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
                  className="input-recessed w-full rounded-chunky px-4 py-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
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
                className="h-12 rounded-pill gradient-primary font-display text-sm font-medium uppercase tracking-wider text-surface gloss-top transition-all glow-teal disabled:opacity-40 disabled:cursor-not-allowed"
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
      <div className="rounded-chunky bg-surface-low p-6">
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
        <div className="rounded-chunky bg-surface-low p-6">
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
        <div className="rounded-chunky bg-surface-low p-6">
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
    </div>
  );
}

function WinRateRow({ stat }: { stat: { label: string; wins: number; losses: number; total: number; win_rate: number } }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 truncate font-display text-sm text-on-surface">
        {stat.label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-pill bg-surface-high">
        <div
          className="absolute inset-y-0 left-0 rounded-pill bg-secondary transition-all"
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
