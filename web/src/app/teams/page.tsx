"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@/lib/api";
import type { ShowdownImportRequest, ShowdownPreviewPokemon } from "@/lib/api";
import { TeamCard } from "@/components/teams/team-card";
import { TeamForm } from "@/components/teams/team-form";
import { ImportReview } from "@/components/teams/import-review";
import { RosterForm } from "@/components/roster/roster-form";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { friendlyError } from "@/lib/errors";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [rosterLookup, setRosterLookup] = useState<Map<string, UserPokemon>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  // Review step state
  const [importStep, setImportStep] = useState<"paste" | "review">("paste");
  const [previewPokemon, setPreviewPokemon] = useState<ShowdownPreviewPokemon[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  const loadData = useCallback(async (format?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [teamsResult, rosterResult, pokemonResult] = await Promise.all([
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
        fetchCheatsheetStatus(teamIds)
          .then(setCheatsheetStatus)
          .catch(() => {});
      }
    } catch (err) {
      setError(friendlyError(err).message);
      setTeams([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(formatFilter);
  }, [formatFilter, loadData]);

  const handleCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (team: Team) => {
    setEditing(team);
    setShowForm(true);
  };

  const handleClone = async (team: Team) => {
    try {
      await createTeam({
        name: `${team.name} (copy)`,
        format: team.format,
        pokemon_ids: team.pokemon_ids,
        mega_pokemon_id: team.mega_pokemon_id,
        mega_form_pokemon_id: team.mega_form_pokemon_id,
        notes: team.notes,
        archetype_tag: team.archetype_tag,
      });
      loadData(formatFilter);
    } catch (err) {
      console.error("Failed to clone team:", err);
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleRosterSubmit = async (data: UserPokemonCreate | (UserPokemonUpdate & { id: string })) => {
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

  const handleImportOpen = () => {
    setImportPaste("");
    setImportTeamName("");
    setImportFormat("doubles");
    setImportError(null);
    setImportWarnings([]);
    setImportStep("paste");
    setPreviewPokemon([]);
    setPreviewWarnings([]);
    setShowImport(true);
  };

  const handleImportPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPaste.trim() || !importTeamName.trim()) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const result = await previewShowdownImport(importPaste);
      setPreviewPokemon(result.pokemon);
      setPreviewWarnings(result.warnings);
      setImportStep("review");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    setImportLoading(true);
    setImportError(null);
    try {
      const body: ShowdownImportRequest = {
        paste: importPaste,
        team_name: importTeamName,
        format: importFormat,
      };
      const result = await importTeamFromShowdown(body);
      setImportWarnings(result.warnings);
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

                {/* Team name + format row */}
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
                      required
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
                    disabled={importLoading || !importPaste.trim() || !importTeamName.trim()}
                    className="btn-primary h-10 px-6 font-display text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {importLoading ? "Parsing..." : "Preview Import"}
                  </button>
                </div>
              </form>
            ) : (
              <ImportReview
                pokemon={previewPokemon}
                warnings={previewWarnings}
                teamName={importTeamName}
                format={importFormat}
                onConfirm={handleImportConfirm}
                onBack={() => {
                  setImportStep("paste");
                  setImportError(null);
                }}
                importing={importLoading}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
