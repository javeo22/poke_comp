"use client";

import { useState } from "react";
import type { ShowdownPreviewPokemon } from "@/lib/api";

interface ImportReviewProps {
  pokemon: ShowdownPreviewPokemon[];
  warnings: string[];
  teamName: string;
  format: string;
  onConfirm: () => void;
  onBack: () => void;
  importing: boolean;
}

export function ImportReview({
  pokemon,
  warnings,
  teamName,
  format,
  onConfirm,
  onBack,
  importing,
}: ImportReviewProps) {
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const toggleExclude = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const resolvedCount = pokemon.filter((p, i) => p.resolved && !excluded.has(i)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-display text-sm font-bold text-on-surface">
          Review Import
        </h3>
        <p className="mt-1 text-xs text-on-surface-muted">
          {resolvedCount} Pokemon will be added to your roster and team &ldquo;{teamName}&rdquo; ({format})
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-tertiary/10 border border-tertiary/30 p-3">
          <p className="font-display text-[0.65rem] uppercase tracking-wider text-tertiary mb-1">
            Warnings
          </p>
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-tertiary/80">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pokemon list */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {pokemon.map((p, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 transition-colors ${
              !p.resolved
                ? "border-tertiary/30 bg-tertiary/5 opacity-60"
                : excluded.has(i)
                  ? "border-outline-variant bg-surface-lowest opacity-50"
                  : "border-outline-variant bg-surface-lowest"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Toggle */}
              {p.resolved && (
                <button
                  type="button"
                  onClick={() => toggleExclude(i)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    excluded.has(i)
                      ? "border-outline-variant bg-surface-mid"
                      : "border-primary bg-primary text-surface"
                  }`}
                >
                  {!excluded.has(i) && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}

              {/* Pokemon info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-display text-sm font-semibold ${p.resolved ? "text-on-surface" : "text-on-surface-muted line-through"}`}>
                    {p.name}
                  </span>
                  {!p.resolved && (
                    <span className="rounded-full bg-tertiary/20 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-tertiary">
                      Not found
                    </span>
                  )}
                </div>
                {p.resolved && (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-on-surface-muted">
                    {p.item && <span>Item: {p.item}{!p.item_id && " (not in shop)"}</span>}
                    {p.ability && <span>Ability: {p.ability}</span>}
                    {p.nature && <span>Nature: {p.nature}</span>}
                  </div>
                )}
                {p.resolved && p.moves.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.moves.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-surface-mid px-2 py-0.5 font-body text-[0.6rem] text-on-surface"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {p.resolved && p.stat_points && Object.keys(p.stat_points).length > 0 && (
                  <div className="mt-1 text-[0.6rem] text-on-surface-muted">
                    EVs: {Object.entries(p.stat_points)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(" / ")}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={importing}
          className="btn-ghost h-10 px-4 font-display text-xs font-medium uppercase tracking-wider"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={importing || resolvedCount === 0}
          className="btn-primary flex-1 h-10 px-4 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-50"
        >
          {importing ? "Importing..." : `Import ${resolvedCount} Pokemon`}
        </button>
      </div>
    </div>
  );
}
