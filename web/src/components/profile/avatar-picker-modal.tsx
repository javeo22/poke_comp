"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fetchPokemon } from "@/lib/api";
import type { Pokemon } from "@/features/pokemon/types";

interface AvatarPickerModalProps {
  onClose: () => void;
  onSelect: (pokemonId: number, spriteUrl: string) => void;
  currentAvatarId: number | null;
}

/**
 * Conditionally mount this component (not render with isOpen prop).
 * It remounts fresh each time, so state resets automatically.
 */
export function AvatarPickerModal({
  onClose,
  onSelect,
  currentAvatarId,
}: AvatarPickerModalProps) {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(currentAvatarId);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch champions-eligible Pokemon on mount
  useEffect(() => {
    fetchPokemon({ champions_only: true, limit: 500 })
      .then((res) => setPokemon(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && searchRef.current) {
      searchRef.current.focus();
    }
  }, [loading]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filtered = searchQuery
    ? pokemon.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pokemon;

  const handleConfirm = () => {
    if (selectedId === null) return;
    const selected = pokemon.find((p) => p.id === selectedId);
    if (selected?.sprite_url) {
      onSelect(selectedId, selected.sprite_url);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="card mx-4 flex max-h-[80vh] w-full max-w-lg flex-col p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-outline-variant px-5 py-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-on-surface">
            Choose Your Avatar
          </h2>
          <p className="mt-1 font-body text-xs text-on-surface-muted">
            Pick a Champions-eligible Pokemon
          </p>
        </div>

        {/* Search */}
        <div className="border-b border-outline-variant px-5 py-3">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Pokemon..."
            className="input-field w-full"
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-lg bg-surface-high"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-muted">
              No Pokemon found
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  title={p.name}
                  className={`group relative flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                    selectedId === p.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-outline-variant hover:border-on-surface-muted hover:bg-surface-high"
                  }`}
                >
                  {p.sprite_url ? (
                    <Image
                      src={p.sprite_url}
                      alt={p.name}
                      width={48}
                      height={48}
                      className="image-rendering-pixelated"
                      unoptimized
                    />
                  ) : (
                    <span className="text-xs text-on-surface-muted">?</span>
                  )}
                  {/* Name tooltip on hover */}
                  <span className="pointer-events-none absolute -bottom-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-highest px-2 py-0.5 font-body text-[0.6rem] text-on-surface group-hover:block">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-outline-variant px-5 py-3">
          <button onClick={onClose} className="btn-ghost px-4 py-1.5 font-display text-xs uppercase tracking-wider">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedId === null}
            className="btn-primary px-4 py-1.5 font-display text-xs uppercase tracking-wider disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
