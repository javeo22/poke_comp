"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item } from "@/types/item";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon, UserPokemonCreate, UserPokemonUpdate } from "@/types/user-pokemon";
import {
  fetchUserPokemon,
  fetchPokemon,
  fetchItems,
  createUserPokemon,
  updateUserPokemon,
  deleteUserPokemon,
} from "@/lib/api";
import { CoverageSummary } from "@/components/roster/coverage-summary";
import { RosterCard } from "@/components/roster/roster-card";
import { RosterForm } from "@/components/roster/roster-form";

export default function RosterPage() {
  const [entries, setEntries] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [itemsMap, setItemsMap] = useState<Map<number, Item>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserPokemon | null>(null);

  const loadRoster = useCallback(async (status?: string) => {
    setIsLoading(true);
    try {
      const result = await fetchUserPokemon({
        build_status: status || undefined,
        limit: 200,
      });
      setEntries(result.data);
      setCount(result.count);

      // Fetch pokemon + items for all roster entries
      const [pokemonResult, itemsResult] = await Promise.all([
        fetchPokemon({ limit: 200, champions_only: true }),
        fetchItems({ champions_only: true, limit: 200 }),
      ]);

      const pMap = new Map<number, Pokemon>();
      for (const p of pokemonResult.data) pMap.set(p.id, p);
      setPokemonMap(pMap);

      const iMap = new Map<number, Item>();
      for (const item of itemsResult.data) iMap.set(item.id, item);
      setItemsMap(iMap);
    } catch (err) {
      console.error("Failed to fetch roster:", err);
      setEntries([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster(statusFilter);
  }, [statusFilter, loadRoster]);

  const handleCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (entry: UserPokemon) => {
    setEditing(entry);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserPokemon(id);
      loadRoster(statusFilter);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleFormSubmit = async (
    data: UserPokemonCreate | (UserPokemonUpdate & { id: string })
  ) => {
    try {
      if ("id" in data) {
        const { id, ...body } = data;
        await updateUserPokemon(id, body);
      } else {
        await createUserPokemon(data);
      }
      setShowForm(false);
      setEditing(null);
      loadRoster(statusFilter);
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  // Count by status
  const builtCount = entries.filter((e) => e.build_status === "built").length;
  const trainingCount = entries.filter((e) => e.build_status === "training").length;
  const wishlistCount = entries.filter((e) => e.build_status === "wishlist").length;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
            My Roster
          </h1>
          <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
            {count} Pokemon in collection
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="h-10 rounded-pill gradient-primary px-6 font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top transition-all glow-teal"
        >
          Add Pokemon
        </button>
      </div>

      {/* Status summary */}
      <div className="mb-6 flex gap-4">
        <StatusPill
          label="All"
          count={count}
          active={statusFilter === ""}
          onClick={() => setStatusFilter("")}
        />
        <StatusPill
          label="Built"
          count={builtCount}
          ledClass="led-active"
          active={statusFilter === "built"}
          onClick={() => setStatusFilter(statusFilter === "built" ? "" : "built")}
        />
        <StatusPill
          label="Training"
          count={trainingCount}
          ledClass="led-training"
          active={statusFilter === "training"}
          onClick={() => setStatusFilter(statusFilter === "training" ? "" : "training")}
        />
        <StatusPill
          label="Wishlist"
          count={wishlistCount}
          ledClass="led-wishlist"
          active={statusFilter === "wishlist"}
          onClick={() => setStatusFilter(statusFilter === "wishlist" ? "" : "wishlist")}
        />
      </div>

      {/* Coverage analysis */}
      {!isLoading && entries.length > 0 && (
        <div className="mb-6">
          <CoverageSummary entries={entries} pokemonMap={pokemonMap} />
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-chunky bg-surface-low" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-display text-lg text-on-surface-muted">
            {statusFilter ? "No Pokemon with this status" : "Your roster is empty"}
          </p>
          <p className="mt-1 text-sm text-on-surface-muted">
            {statusFilter ? "Try a different filter" : "Add your first Pokemon to get started"}
          </p>
          {!statusFilter && (
            <button
              onClick={handleCreate}
              className="mt-6 h-10 rounded-pill gradient-primary px-6 font-display text-xs font-medium uppercase tracking-wider text-surface gloss-top"
            >
              Add Pokemon
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <RosterCard
              key={entry.id}
              entry={entry}
              pokemon={pokemonMap.get(entry.pokemon_id)}
              itemsMap={itemsMap}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <RosterForm
          editing={editing}
          pokemonLookup={pokemonMap}
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

function StatusPill({
  label,
  count,
  ledClass,
  active,
  onClick,
}: {
  label: string;
  count: number;
  ledClass?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 h-9 rounded-pill px-4 font-display text-xs uppercase tracking-wider transition-all ${
        active
          ? "gradient-primary text-surface gloss-top"
          : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
      }`}
    >
      {ledClass && <div className={`led ${ledClass}`} />}
      <span>{label}</span>
      <span className={active ? "text-surface/70" : "text-on-surface-muted/60"}>
        {count}
      </span>
    </button>
  );
}
