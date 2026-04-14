"use client";

import { useCallback, useEffect, useState } from "react";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Team, TeamCreate, TeamUpdate } from "@/types/team";
import { FORMATS } from "@/types/team";
import {
  fetchTeams,
  fetchUserPokemon,
  fetchPokemon,
  createTeam,
  updateTeam,
  deleteTeam,
  importTeamFromShowdown,
  exportTeamToShowdown,
} from "@/lib/api";
import type { ShowdownImportRequest } from "@/lib/api";
import { TeamCard } from "@/components/teams/team-card";
import { TeamForm } from "@/components/teams/team-form";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [rosterLookup, setRosterLookup] = useState<Map<string, UserPokemon>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState("");

  // Team form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  // Showdown import modal
  const [showImport, setShowImport] = useState(false);
  const [importPaste, setImportPaste] = useState("");
  const [importTeamName, setImportTeamName] = useState("");
  const [importFormat, setImportFormat] = useState("doubles");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const loadData = useCallback(async (format?: string) => {
    setIsLoading(true);
    try {
      const [teamsResult, rosterResult, pokemonResult] = await Promise.all([
        fetchTeams({ format: format || undefined, limit: 200 }),
        fetchUserPokemon({ limit: 200 }),
        fetchPokemon({ limit: 200, champions_only: true }),
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
    } catch (err) {
      console.error("Failed to load teams data:", err);
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

  const handleImportOpen = () => {
    setImportPaste("");
    setImportTeamName("");
    setImportFormat("doubles");
    setImportError(null);
    setImportWarnings([]);
    setShowImport(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPaste.trim() || !importTeamName.trim()) return;
    setImportLoading(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      const body: ShowdownImportRequest = {
        paste: importPaste,
        team_name: importTeamName,
        format: importFormat,
      };
      const result = await importTeamFromShowdown(body);
      setImportWarnings(result.warnings);
      if (result.warnings.length === 0) {
        setShowImport(false);
      }
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-low" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-display text-lg text-on-surface-muted">
            {formatFilter ? "No teams in this format" : "No teams yet"}
          </p>
          <p className="mt-1 text-sm text-on-surface-muted">
            {formatFilter ? "Try a different format" : "Build your first team to get started"}
          </p>
          {!formatFilter && roster.length === 0 && (
            <p className="mt-2 text-xs text-on-surface-muted">
              Add Pokemon to your{" "}
              <a href="/roster" className="text-primary hover:underline">
                Roster
              </a>{" "}
              first, then build teams from them.
            </p>
          )}
          {!formatFilter && (
            <button
              onClick={handleCreate}
              className="mt-6 btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
            >
              New Team
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              rosterLookup={rosterLookup}
              pokemonMap={pokemonMap}
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
        />
      )}

      {/* Showdown import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-[1rem] bg-surface-low p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-on-surface">
                  Import from Showdown
                </h2>
                <p className="mt-1 font-body text-xs text-on-surface-muted">
                  Paste a Showdown team export to import it as a new team
                </p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="btn-ghost h-8 w-8 font-display text-sm text-on-surface-muted"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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

              {/* Error */}
              {importError && (
                <div className="rounded-[0.75rem] bg-tertiary/10 p-3">
                  <p className="font-body text-xs text-tertiary">{importError}</p>
                </div>
              )}

              {/* Warnings (after partial success) */}
              {importWarnings.length > 0 && (
                <div className="rounded-[0.75rem] bg-[#FBBF24]/10 p-3">
                  <p className="mb-2 font-display text-[0.6rem] uppercase tracking-wider text-[#FBBF24]">
                    Imported with warnings
                  </p>
                  <ul className="flex flex-col gap-1">
                    {importWarnings.map((w, i) => (
                      <li key={i} className="font-body text-xs text-on-surface-muted">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                  {importLoading ? "Importing..." : "Import Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
