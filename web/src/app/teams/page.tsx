"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team, TeamCreate, TeamUpdate } from "@/types/team";
import { FORMATS } from "@/types/team";
import type { UserPokemonCreate, UserPokemonUpdate } from "@/types/user-pokemon";
import {
  fetchTeams,
  fetchUserPokemon,
  fetchPokemon,
  createTeam,
  updateTeam,
  deleteTeam,
  createUserPokemon,
  updateUserPokemon,
  previewShowdownImport,
  importTeamFromShowdown,
  exportTeamToShowdown,
  fetchCheatsheetStatus,
  fetchTeamBenchmark,
} from "@/lib/api";
import type { ShowdownImportRequest, ShowdownPreviewPokemon, TeamBenchmarkResponse } from "@/lib/api";
import { TeamCard } from "@/components/teams/team-card";
import { TeamForm } from "@/components/teams/team-form";
import { ImportReview } from "@/components/teams/import-review";
import { RosterForm } from "@/components/roster/roster-form";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthEmptyState } from "@/components/ui/auth-empty-state";
import { friendlyError } from "@/lib/errors";
import { DEMO_ROSTER, DEMO_TEAM_BENCHMARK, DEMO_TEAMS, isDemoModeEnabled } from "@/lib/demo-data";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [rosterLookup, setRosterLookup] = useState<Map<string, UserPokemon>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [demoMode] = useState(isDemoModeEnabled);
  const [cheatsheetStatus, setCheatsheetStatus] = useState<Record<string, string>>({});
  const [formatFilter, setFormatFilter] = useState("");

  // Team form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  // Inline roster form (from team builder)
  const [showRosterForm, setShowRosterForm] = useState(false);
  const [editingRosterEntry, setEditingRosterEntry] = useState<UserPokemon | null>(null);

  // Showdown import modal
  const [showImport, setShowImport] = useState(false);
  const [importPaste, setImportPaste] = useState("");
  const [importTeamName, setImportTeamName] = useState("");
  const [importFormat, setImportFormat] = useState("doubles");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Review step state
  const [importStep, setImportStep] = useState<"paste" | "review">("paste");
  const [previewPokemon, setPreviewPokemon] = useState<ShowdownPreviewPokemon[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  // Team benchmark modal
  const [benchmarkTeam, setBenchmarkTeam] = useState<Team | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<TeamBenchmarkResponse | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const loadData = useCallback(async (format?: string, isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const [teamsResult, rosterResult, pokemonResult] = demoMode
        ? [
            { data: DEMO_TEAMS.filter((team) => !format || team.format === format), count: DEMO_TEAMS.length },
            { data: DEMO_ROSTER, count: DEMO_ROSTER.length },
            await fetchPokemon({ limit: 1000, champions_only: true }),
          ]
        : await Promise.all([
            fetchTeams({ format: format || undefined, limit: 500 }),
            fetchUserPokemon({ limit: 500 }),
            fetchPokemon({ limit: 1000, champions_only: true }),
          ]);

      setTeams(teamsResult.data);
      setCount(teamsResult.count);
      setRoster(rosterResult.data);

      const rMap = new Map<string, UserPokemon>();
      for (const entry of rosterResult.data) {
        rMap.set(entry.id, entry);
      }
      setRosterLookup(rMap);

      const pMap = new Map<number, Pokemon>();
      for (const p of pokemonResult.data) {
        pMap.set(p.id, p);
      }
      setPokemonMap(pMap);

      // Load cheatsheet status (non-blocking)
      const teamIds = teamsResult.data.map((t: Team) => t.id);
      if (teamIds.length > 0) {
        if (demoMode) {
          setCheatsheetStatus({ "demo-balance": "ready" });
        } else {
          fetchCheatsheetStatus(teamIds)
            .then(setCheatsheetStatus)
            .catch(() => {});
        }
      }
    } catch (err) {
      const friendly = friendlyError(err);
      setAuthRequired(!!friendly.isAuthRequired);
      setError(friendly.message);
      setTeams([]);
      setCount(0);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    loadData(formatFilter, true);
  }, [formatFilter, loadData]);

  const handleCreate = () => {
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to create and save teams.");
      return;
    }
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (team: Team) => {
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to edit teams.");
      return;
    }
    setEditing(team);
    setShowForm(true);
  };

  const handleClone = async (team: Team) => {
    if (demoMode) return;
    try {
      await createTeam({
        name: `${team.name} (copy)`,
        format: team.format,
        pokemon_ids: team.pokemon_ids,
        mega_pokemon_id: team.mega_pokemon_id,
        mega_form_pokemon_id: team.mega_form_pokemon_id,
        mega_pokemon_ids: team.mega_pokemon_ids ?? [],
        mega_form_pokemon_ids: team.mega_form_pokemon_ids ?? [],
        notes: team.notes,
        archetype_tag: team.archetype_tag,
      });
      loadData(formatFilter);
    } catch (err) {
      console.error("Failed to clone team:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (demoMode) return;
    try {
      await deleteTeam(id);
      loadData(formatFilter);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleFormSubmit = async (
    data: TeamCreate | (TeamUpdate & { id: string })
  ) => {
    if (demoMode) return;
    try {
      if ("id" in data) {
        const { id, ...body } = data;
        await updateTeam(id, body);
      } else {
        await createTeam(data);
      }
      setShowForm(false);
      setEditing(null);
      loadData(formatFilter);
    } catch (err) {
      console.error("Failed to save team:", err);
    }
  };

  const handleExport = async (team: Team) => {
    try {
      const text = await exportTeamToShowdown(team.id);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${team.name.replace(/\s+/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export team:", err);
    }
  };

  const handleBenchmark = async (team: Team) => {
    setBenchmarkTeam(team);
    setBenchmarkData(null);
    setBenchmarkError(null);
    setBenchmarkLoading(true);
    try {
      if (demoMode) {
        setBenchmarkData({
          ...DEMO_TEAM_BENCHMARK,
          team_id: team.id,
          team_name: team.name,
          format: team.format,
        });
        return;
      }
      const data = await fetchTeamBenchmark(team.id, { format: team.format, limit: 12 });
      setBenchmarkData(data);
    } catch (err) {
      setBenchmarkError(friendlyError(err).message);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const handleRosterSubmit = async (data: UserPokemonCreate | (UserPokemonUpdate & { id: string })) => {
    if (demoMode) return;
    try {
      if ("id" in data) {
        const { id, ...body } = data;
        await updateUserPokemon(id, body);
      } else {
        await createUserPokemon(data);
      }
      setShowRosterForm(false);
      setEditingRosterEntry(null);
      // Refresh data so the changes appear in the teambuilder
      await loadData(formatFilter);
    } catch (err) {
      console.error("Failed to save to roster:", err);
    }
  };

  const handleCreateWishlist = async (pokemon: Pokemon) => {
    if (demoMode) {
      throw new Error("Demo mode is read-only. Sign in to add wishlist Pokemon.");
    }

    const existingEntry = roster.find((entry) => entry.pokemon_id === pokemon.id);
    if (!existingEntry) {
      await createUserPokemon({
        pokemon_id: pokemon.id,
        build_status: "wishlist",
      });
    }

    await loadData(formatFilter);
  };

  const handleImportOpen = () => {
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to import a Showdown paste.");
      return;
    }
    setImportPaste("");
    setImportTeamName("");
    setImportFormat("doubles");
    setImportError(null);
    setImportStep("paste");
    setPreviewPokemon([]);
    setPreviewWarnings([]);
    setShowImport(true);
  };

  const handleImportPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPaste.trim()) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const result = await previewShowdownImport(importPaste);
      setPreviewPokemon(result.pokemon);
      setPreviewWarnings(result.warnings);
      if (!importTeamName.trim()) {
        const names = result.pokemon.filter((p) => p.resolved).map((p) => p.name);
        setImportTeamName(
          names.length >= 2 ? `${names[0]} ${names[1]} Core` : names[0] ? `${names[0]} Team` : "Imported Team"
        );
      }
      setImportStep("review");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    if (demoMode) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const body: ShowdownImportRequest = {
        paste: importPaste,
        team_name: importTeamName,
        format: importFormat,
      };
      await importTeamFromShowdown(body);
      setShowImport(false);
      loadData(formatFilter);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
            Teams
          </h1>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            {count} team{count !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportOpen}
            className="btn-ghost h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
          >
            Import
          </button>
          <button
            onClick={handleCreate}
            className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
          >
            New Team
          </button>
        </div>
      </div>

      {/* Format filters */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFormatFilter("")}
          className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-colors ${
            formatFilter === ""
              ? "bg-primary text-surface"
              : "bg-surface-high text-on-surface-muted hover:bg-surface-highest transition-colors"
          }`}
        >
          All
        </button>
        {FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => setFormatFilter(formatFilter === f ? "" : f)}
            className={`h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-colors ${
              formatFilter === f
                ? "bg-primary text-surface"
                : "bg-surface-high text-on-surface-muted hover:bg-surface-highest transition-colors"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Teams grid */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={4} className="lg:grid-cols-2" />
      ) : authRequired ? (
        <AuthEmptyState
          title="Sign in to build teams"
          description="Teams connect your roster to draft help, matchup notes, and printable prep."
        />
      ) : error ? (
        <ErrorCard
          title="Couldn't load teams"
          message={error}
          onRetry={() => loadData(formatFilter)}
        />
      ) : teams.length === 0 ? (
        <EmptyState
          title={formatFilter ? "No teams in this format" : "No teams yet"}
          description={
            formatFilter
              ? "Try switching to a different format."
              : roster.length === 0
                ? "Add Pokemon to your Roster first, then build teams from them."
                : "Build your first team from your roster."
          }
          action={
            !formatFilter ? (
              roster.length === 0 ? (
                <a
                  href="/roster"
                  className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
                >
                  Go to Roster
                </a>
              ) : (
                <button
                  onClick={handleCreate}
                  className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
                >
                  New Team
                </button>
              )
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              rosterLookup={rosterLookup}
              pokemonMap={pokemonMap}
              hasCheatsheet={!!cheatsheetStatus[team.id]}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClone={handleClone}
              onExport={handleExport}
              onBenchmark={handleBenchmark}
            />
          ))}
        </div>
      )}

      {/* Team form modal */}
      {showForm && (
        <TeamForm
          editing={editing}
          roster={roster}
          pokemonMap={pokemonMap}
          rosterLookup={rosterLookup}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onAddToRoster={() => {
             setEditingRosterEntry(null);
             setShowRosterForm(true);
          }}
          onEditRosterEntry={(entry) => {
             setEditingRosterEntry(entry);
             setShowRosterForm(true);
          }}
          onCreateWishlist={handleCreateWishlist}
        />
      )}

      {/* Inline roster form (opened from team builder) */}
      {showRosterForm && (
        <div className="fixed inset-0 z-[60]">
          <RosterForm
            editing={editingRosterEntry}
            pokemonLookup={pokemonMap}
            onSubmit={(data) => {
              handleRosterSubmit(data);
            }}
            onClose={() => {
               setShowRosterForm(false);
               setEditingRosterEntry(null);
            }}
          />
        </div>
      )}

      {/* Showdown import modal ... */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-[1rem] bg-surface-low p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-on-surface">
                  Import from Showdown
                </h2>
                <p className="mt-1 font-body text-xs text-on-surface-muted">
                  {importStep === "paste"
                    ? "Paste a Showdown team export to preview before importing"
                    : "Review the parsed team before confirming"}
                </p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="btn-ghost h-8 w-8 font-display text-sm text-on-surface-muted"
              >
                ×
              </button>
            </div>

            {/* Error */}
            {importError && (
              <div className="mb-4 rounded-[0.75rem] bg-tertiary/10 p-3">
                <p className="font-body text-xs text-tertiary">{importError}</p>
              </div>
            )}

            {importStep === "paste" ? (
              <form onSubmit={handleImportPreview} className="flex flex-col gap-4">
                {/* Paste area */}
                <div>
                  <label className="mb-2 block font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                    Showdown Paste
                  </label>
                  <textarea
                    value={importPaste}
                    onChange={(e) => setImportPaste(e.target.value)}
                    placeholder={"Gengar @ Gengarite\nAbility: Shadow Tag\n..."}
                    rows={10}
                    className="input-field w-full resize-none font-mono text-xs"
                    required
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImport(false)}
                    className="btn-ghost h-10 px-6 font-display text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importLoading || !importPaste.trim()}
                    className="btn-primary h-10 px-6 font-display text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {importLoading ? "Parsing..." : "Preview Import"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Team Name
                    </label>
                    <input
                      type="text"
                      value={importTeamName}
                      onChange={(e) => setImportTeamName(e.target.value)}
                      placeholder="My Imported Team"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Format
                    </label>
                    <select
                      value={importFormat}
                      onChange={(e) => setImportFormat(e.target.value)}
                      className="input-field w-full"
                    >
                      {FORMATS.map((f) => (
                        <option key={f} value={f}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <ImportReview
                  pokemon={previewPokemon}
                  warnings={previewWarnings}
                  teamName={importTeamName || "Imported Team"}
                  format={importFormat}
                  onConfirm={handleImportConfirm}
                  onBack={() => {
                    setImportStep("paste");
                    setImportError(null);
                  }}
                  importing={importLoading}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {benchmarkTeam && (
        <BenchmarkModal
          team={benchmarkTeam}
          data={benchmarkData}
          loading={benchmarkLoading}
          error={benchmarkError}
          onClose={() => {
            setBenchmarkTeam(null);
            setBenchmarkData(null);
            setBenchmarkError(null);
          }}
          onRetry={() => handleBenchmark(benchmarkTeam)}
        />
      )}
    </div>
  );
}

function BenchmarkModal({
  team,
  data,
  loading,
  error,
  onClose,
  onRetry,
}: {
  team: Team;
  data: TeamBenchmarkResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[1rem] border border-outline-variant bg-surface-low p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[0.6rem] uppercase tracking-wider text-primary">
              Team benchmark
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-on-surface">
              {team.name}
            </h2>
            <p className="mt-1 font-body text-sm text-on-surface-muted">
              Deterministic damage and speed checks against current top usage threats.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-8 w-8 font-display text-sm text-on-surface-muted"
            aria-label="Close benchmark"
          >
            x
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 font-body text-sm text-on-surface-muted">
            Running benchmark...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-tertiary/30 bg-tertiary/10 p-5">
            <p className="font-display text-sm font-semibold text-tertiary">
              Could not benchmark this team
            </p>
            <p className="mt-1 font-body text-sm text-on-surface-muted">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="btn-primary mt-4 h-9 px-5 font-display text-xs uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <BenchmarkMeta label="Threats" value={String(data.threat_count)} />
              <BenchmarkMeta label="Format" value={data.format} />
              <BenchmarkMeta label="Snapshot" value={data.meta_snapshot_date ?? "latest"} />
              <BenchmarkMeta label="Coverage gaps" value={String(data.coverage_gaps.length)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BenchmarkSection title="Defensive danger">
                {data.defensive_dangers.length > 0 ? (
                  data.defensive_dangers.slice(0, 6).map((row) => (
                    <BenchmarkRow
                      key={`${row.pokemon_id}-${row.move}-${row.target_name}`}
                      title={`${row.pokemon_name} -> ${row.target_name}`}
                      detail={`${row.move ?? "Best move"}: ${row.damage_text}`}
                      badge={row.severity}
                      tone={row.severity === "ohko" || row.severity === "danger" ? "bad" : "neutral"}
                    />
                  ))
                ) : (
                  <EmptyLine text="No damaging usage moves could be benchmarked." />
                )}
              </BenchmarkSection>

              <BenchmarkSection title="Offensive answers">
                {data.offensive_answers.length > 0 ? (
                  data.offensive_answers.slice(0, 6).map((row) => (
                    <BenchmarkRow
                      key={`${row.pokemon_id}-${row.answer_pokemon}-${row.move}`}
                      title={`${row.answer_pokemon} -> ${row.pokemon_name}`}
                      detail={`${row.move ?? "Best saved move"}: ${row.damage_text}`}
                      badge={row.reliability}
                      tone={row.reliability === "ko" || row.reliability === "strong" ? "good" : "neutral"}
                    />
                  ))
                ) : (
                  <EmptyLine text="No saved attacking moves could be benchmarked." />
                )}
              </BenchmarkSection>

              <BenchmarkSection title="Speed issues">
                {data.speed_issues.length > 0 ? (
                  data.speed_issues.slice(0, 6).map((row) => (
                    <BenchmarkRow
                      key={`${row.pokemon_id}-speed`}
                      title={row.pokemon_name}
                      detail={`${row.threat_speed} Spe vs ${row.fastest_team_member ?? "team"} at ${row.fastest_team_speed}. ${row.note}`}
                      badge="outspeeds"
                      tone="bad"
                    />
                  ))
                ) : (
                  <EmptyLine text="No top threat outspeeds your fastest saved build before modifiers." />
                )}
              </BenchmarkSection>

              <BenchmarkSection title="Coverage gaps">
                {data.coverage_gaps.length > 0 ? (
                  data.coverage_gaps.slice(0, 6).map((row) => (
                    <BenchmarkRow
                      key={`${row.pokemon_id}-coverage`}
                      title={row.pokemon_name}
                      detail={`${row.best_answer ?? "No answer"} tops out at ${row.best_damage_percent.toFixed(1)}%. ${row.note}`}
                      badge="gap"
                      tone="bad"
                    />
                  ))
                ) : (
                  <EmptyLine text="Every benchmarked threat has at least one saved move above the chip threshold." />
                )}
              </BenchmarkSection>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function BenchmarkMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
      <p className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-semibold text-on-surface">
        {value}
      </p>
    </div>
  );
}

function BenchmarkSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-on-surface">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function BenchmarkRow({
  title,
  detail,
  badge,
  tone,
}: {
  title: string;
  detail: string;
  badge: string;
  tone: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-secondary/30 bg-secondary/10 text-secondary"
      : tone === "bad"
        ? "border-tertiary/30 bg-tertiary/10 text-tertiary"
        : "border-outline-variant bg-surface-high text-on-surface-muted";

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-low p-3">
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">{detail}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${toneClass}`}>
        {badge}
      </span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="font-body text-sm text-on-surface-muted">{text}</p>;
}
