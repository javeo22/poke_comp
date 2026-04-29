"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { QuickAddModal } from "@/components/roster/quick-add-modal";
import { RosterCard } from "@/components/roster/roster-card";
import { RosterForm } from "@/components/roster/roster-form";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { EmptyState } from "@/components/ui/empty-state";
import { friendlyError } from "@/lib/errors";

export default function RosterPage() {
  const searchParams = useSearchParams();
  const addPokemonId = searchParams.get("add");

  const [entries, setEntries] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [itemsMap, setItemsMap] = useState<Map<number, Item>>(new Map());
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editing, setEditing] = useState<UserPokemon | null>(null);
  const [preselectedPokemonId, setPreselectedPokemonId] = useState<number | undefined>(
    addPokemonId ? Number(addPokemonId) : undefined
  );

  const loadRoster = useCallback(async (status?: string) => {
    setIsLoading(true);
    setError(null);
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
      setError(friendlyError(err).message);
      setEntries([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster(statusFilter);
  }, [statusFilter, loadRoster]);

  // Auto-open quick-add when ?add=pokemonId is in URL
  useEffect(() => {
    if (preselectedPokemonId && !isLoading && pokemonMap.size > 0) {
      setEditing(null);
      setShowQuickAdd(true);
    }
  }, [preselectedPokemonId, isLoading, pokemonMap]);

  const handleCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleQuickAdd = () => {
    setPreselectedPokemonId(undefined);
    setShowQuickAdd(true);
  };

  const handleQuickAddSubmit = async (data: { pokemon_id: number; ability?: string; build_status: string }) => {
    try {
      await createUserPokemon(data as UserPokemonCreate);
      setShowQuickAdd(false);
      setPreselectedPokemonId(undefined);
      loadRoster(statusFilter);
    } catch (err) {
      console.error("Failed to quick-add:", err);
    }
  };

  const handleQuickAddToFullForm = (pokemonId: number) => {
    setShowQuickAdd(false);
    setPreselectedPokemonId(pokemonId);
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
    <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[0.7rem] tracking-[0.22em] text-primary mb-1.5">
            ◆ MY ROSTER · {count} {count === 1 ? "MON" : "MONS"}
          </div>
          <h1 className="m-0 font-display text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-on-surface">
            Track every build.
          </h1>
          <p className="mt-2 max-w-xl text-on-surface-muted text-base">
            Items, abilities, EV spreads, moves. Built, training, or wishlist — all in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleQuickAdd}
            className="btn-primary h-10 px-5 font-display text-sm"
          >
            Quick Add
          </button>
          <button
            onClick={handleCreate}
            className="btn-ghost h-10 px-5 font-mono text-[0.7rem] uppercase tracking-[0.18em]"
          >
            Full Form
          </button>
        </div>
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
        <LoadingSkeleton variant="card" count={8} />
      ) : error ? (
        <ErrorCard
          title="Couldn't load roster"
          message={error}
          onRetry={() => loadRoster(statusFilter)}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title={statusFilter ? "No Pokemon with this status" : "Your roster is empty"}
          description={
            statusFilter
              ? "Try a different filter, or add new Pokemon from the Pokedex or Meta page."
              : "Add your first Pokemon to start tracking builds, items, and EV spreads."
          }
          action={
            !statusFilter ? (
              <button
                onClick={handleQuickAdd}
                className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider"
              >
                Add Pokemon
              </button>
            ) : undefined
          }
        />
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

      {/* Quick-add modal */}
      {showQuickAdd && (
        <QuickAddModal
          pokemonLookup={pokemonMap}
          preselectedPokemonId={preselectedPokemonId}
          onAdd={handleQuickAddSubmit}
          onFullForm={handleQuickAddToFullForm}
          onClose={() => {
            setShowQuickAdd(false);
            setPreselectedPokemonId(undefined);
          }}
        />
      )}

      {/* Full form modal */}
      {showForm && (
        <RosterForm
          editing={editing}
          pokemonLookup={pokemonMap}
          preselectedPokemonId={!editing ? preselectedPokemonId : undefined}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setPreselectedPokemonId(undefined);
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
      className={`flex items-center gap-2 h-9 rounded-lg px-4 font-display text-xs uppercase tracking-wider transition-colors ${
        active
          ? "bg-primary text-surface"
          : "bg-surface-high text-on-surface-muted hover:bg-surface-highest"
      }`}
    >
      {ledClass && <div className={`status-dot ${ledClass === "led-active" ? "status-built" : ledClass === "led-training" ? "status-training" : "status-wishlist"}`} />}
      <span>{label}</span>
      <span className={active ? "text-surface/70" : "text-on-surface-muted/60"}>
        {count}
      </span>
    </button>
  );
}
