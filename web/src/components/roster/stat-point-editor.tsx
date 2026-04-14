"use client";

const STAT_KEYS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"] as const;

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  sp_attack: "SPA",
  sp_defense: "SPD",
  speed: "SPE",
};

const MAX_TOTAL = 66;
const MAX_PER_STAT = 32;

// Common speed tiers in Champions doubles meta (base speed values)
const SPEED_TIERS = [
  { name: "Dragapult", base: 142 },
  { name: "Sneasler", base: 120 },
  { name: "Garchomp", base: 102 },
  { name: "Incineroar", base: 60 },
  { name: "Torkoal", base: 20 },
];

interface StatPointEditorProps {
  value: Record<string, number>;
  onChange: (stats: Record<string, number>) => void;
  baseStats?: Record<string, number> | null;
}

function calcFinalSpeed(base: number, investment: number, level: number = 50): number {
  // Simplified: at Lv50, stat = ((2*base + 31 + investment/4) * 50/100) + 5
  // Champions uses stat_points directly (not traditional EVs), so simplified:
  return Math.floor(((2 * base + 31) * level) / 100) + 5 + investment;
}

export function StatPointEditor({ value, onChange, baseStats }: StatPointEditorProps) {
  const total = Object.values(value).reduce((sum, v) => sum + v, 0);
  const remaining = MAX_TOTAL - total;

  const handleChange = (key: string, newVal: number) => {
    const clamped = Math.max(0, Math.min(MAX_PER_STAT, newVal));
    const otherTotal = total - (value[key] || 0);
    const maxAllowed = Math.min(clamped, MAX_TOTAL - otherTotal);
    onChange({ ...value, [key]: maxAllowed });
  };

  // Speed tier context
  const baseSpeed = baseStats?.speed ?? 0;
  const speedInvestment = value.speed || 0;
  const finalSpeed = baseSpeed > 0 ? calcFinalSpeed(baseSpeed, speedInvestment) : 0;

  // Find what you outspeed / underspeed
  const nearestAbove = SPEED_TIERS.find(
    (t) => calcFinalSpeed(t.base, 0) > finalSpeed
  );
  const nearestBelow = [...SPEED_TIERS].reverse().find(
    (t) => calcFinalSpeed(t.base, 0) <= finalSpeed
  );

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
          Stat Points
        </span>
        <span
          className={`font-display text-xs font-bold ${
            remaining === 0
              ? "text-secondary"
              : remaining < 0
                ? "text-tertiary"
                : "text-on-surface-muted"
          }`}
        >
          {total} / {MAX_TOTAL}
        </span>
      </div>

      <div className="rounded-xl bg-surface-low p-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 sm:gap-x-4">
          {STAT_KEYS.map((key) => {
            const invested = value[key] || 0;
            const base = baseStats?.[key] ?? 0;
            const fillPct = (invested / MAX_PER_STAT) * 100;

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                  {STAT_LABELS[key]}
                </span>

                {/* Mini bar */}
                <div className="relative h-2 flex-1 rounded-full bg-surface-mid">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleChange(key, invested - 2)}
                    disabled={invested === 0}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-mid text-[0.6rem] text-on-surface-muted hover:bg-surface-high disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-display text-xs font-bold text-on-surface">
                    {invested}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChange(key, invested + 2)}
                    disabled={invested >= MAX_PER_STAT || remaining <= 0}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-mid text-[0.6rem] text-on-surface-muted hover:bg-surface-high disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                {/* Base stat reference */}
                {base > 0 && (
                  <span className="w-6 text-right font-display text-[0.55rem] text-on-surface-muted">
                    {base}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Speed tier context */}
        {finalSpeed > 0 && (
          <div className="mt-3 rounded-full bg-surface-mid px-3 py-1.5 text-center">
            <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
              Speed: {finalSpeed}
            </span>
            {nearestBelow && (
              <span className="ml-2 font-display text-[0.6rem] text-secondary">
                outspeeds {nearestBelow.name}
              </span>
            )}
            {nearestAbove && (
              <span className="ml-2 font-display text-[0.6rem] text-tertiary">
                outsped by {nearestAbove.name}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
