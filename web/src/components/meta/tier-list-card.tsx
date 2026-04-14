"use client";

import type { MetaSnapshot } from "@/types/meta";
import { TIERS } from "@/types/meta";
import { TierRow } from "./tier-row";

interface TierListCardProps {
  snapshot: MetaSnapshot;
  onPokemonClick?: (name: string, tier: string, format: string) => void;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return dateStr;
}

export function TierListCard({ snapshot, onPokemonClick }: TierListCardProps) {
  const total = Object.values(snapshot.tier_data).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className="rounded-xl card p-6 hover-lift">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold capitalize text-on-surface">
          {snapshot.format}
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
            {total} ranked
          </span>
          <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
            {relativeDate(snapshot.snapshot_date)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            pokemon={snapshot.tier_data[tier] || []}
            onPokemonClick={
              onPokemonClick
                ? (name) => onPokemonClick(name, tier, snapshot.format)
                : undefined
            }
          />
        ))}
      </div>

      {snapshot.source && (
        <p className="mt-4 font-display text-xs uppercase tracking-wider text-on-surface-muted">
          Source: {snapshot.source}
          {snapshot.source_url && (
            <>
              {" "}&middot;{" "}
              <a
                href={snapshot.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View original
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
