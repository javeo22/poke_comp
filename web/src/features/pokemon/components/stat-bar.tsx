"use client";

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  sp_attack: "SPA",
  sp_defense: "SPD",
  speed: "SPE",
};

export function StatBar({ stat, value }: { stat: string; value: number }) {
  const pct = Math.min((value / 255) * 100, 100);
  const label = STAT_LABELS[stat] || stat.toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </span>
      <span className="w-7 text-right font-display text-xs text-on-surface">
        {value}
      </span>
      <div className="h-1.5 flex-1 rounded-pill bg-surface-lowest">
        <div
          className="h-full rounded-pill gradient-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
