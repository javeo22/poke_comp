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
} from "@/lib/api";
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

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

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
        <button
          onClick={handleCreate}
          className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
        >
          New Team
        </button>
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
            />
          ))}
        </div>
      )}

      {/* Form modal */}
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
    </div>
  );
}
