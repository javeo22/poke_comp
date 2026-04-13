"use client";

const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

const TYPE_BG: Record<string, string> = {
  normal: "bg-type-normal",
  fire: "bg-type-fire",
  water: "bg-type-water",
  electric: "bg-type-electric",
  grass: "bg-type-grass",
  ice: "bg-type-ice",
  fighting: "bg-type-fighting",
  poison: "bg-type-poison",
  ground: "bg-type-ground",
  flying: "bg-type-flying",
  psychic: "bg-type-psychic",
  bug: "bg-type-bug",
  rock: "bg-type-rock",
  ghost: "bg-type-ghost",
  dragon: "bg-type-dragon",
  dark: "bg-type-dark",
  steel: "bg-type-steel",
  fairy: "bg-type-fairy",
};

const EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  fire: { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 0.5, dark: 1, steel: 2, fairy: 1 },
  water: { normal: 1, fire: 2, water: 0.5, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 2, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  electric: { normal: 1, fire: 1, water: 2, electric: 0.5, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 0, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  grass: { normal: 1, fire: 0.5, water: 2, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 0.5, ground: 2, flying: 0.5, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 0.5, fairy: 1 },
  ice: { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 0.5, fighting: 1, poison: 1, ground: 2, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 1 },
  fighting: { normal: 2, fire: 1, water: 1, electric: 1, grass: 1, ice: 2, fighting: 1, poison: 0.5, ground: 1, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dragon: 1, dark: 2, steel: 2, fairy: 0.5 },
  poison: { normal: 1, fire: 1, water: 1, electric: 1, grass: 2, ice: 1, fighting: 1, poison: 0.5, ground: 0.5, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0.5, dragon: 1, dark: 1, steel: 0, fairy: 2 },
  ground: { normal: 1, fire: 2, water: 1, electric: 2, grass: 0.5, ice: 1, fighting: 1, poison: 2, ground: 1, flying: 0, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 2, fairy: 1 },
  flying: { normal: 1, fire: 1, water: 1, electric: 0.5, grass: 2, ice: 1, fighting: 2, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  psychic: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 2, ground: 1, flying: 1, psychic: 0.5, bug: 1, rock: 1, ghost: 1, dragon: 1, dark: 0, steel: 0.5, fairy: 1 },
  bug: { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 2, ice: 1, fighting: 0.5, poison: 0.5, ground: 1, flying: 0.5, psychic: 2, bug: 1, rock: 1, ghost: 0.5, dragon: 1, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { normal: 1, fire: 2, water: 1, electric: 1, grass: 1, ice: 2, fighting: 0.5, poison: 1, ground: 0.5, flying: 2, psychic: 1, bug: 2, rock: 1, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  ghost: { normal: 0, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1, dark: 0.5, steel: 1, fairy: 1 },
  dragon: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 0 },
  dark: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 0.5, poison: 1, ground: 1, flying: 1, psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1, dark: 0.5, steel: 0.5, fairy: 0.5 },
  steel: { normal: 1, fire: 0.5, water: 0.5, electric: 0.5, grass: 1, ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 2 },
  fairy: { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 0.5, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 2, steel: 0.5, fairy: 1 },
};

function cellStyle(multiplier: number): string {
  if (multiplier === 2) return "bg-secondary/30 text-secondary font-bold";
  if (multiplier === 0.5) return "bg-tertiary/30 text-tertiary font-bold";
  if (multiplier === 0) return "bg-surface text-on-surface-muted font-bold";
  return "bg-surface-mid text-on-surface-muted";
}

function cellLabel(multiplier: number): string {
  if (multiplier === 2) return "2x";
  if (multiplier === 0.5) return "\u00BDx";
  if (multiplier === 0) return "0";
  return "";
}

export default function TypeChartPage() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
          Type Chart
        </h1>
        <p className="mt-1 font-display text-sm uppercase tracking-[0.05rem] text-on-surface-muted">
          Offensive Type Effectiveness
        </p>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-[0.375rem] bg-secondary/30" />
          <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
            Super Effective (2x)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-[0.375rem] bg-tertiary/30" />
          <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
            Not Very Effective (0.5x)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-[0.375rem] bg-surface" />
          <span className="font-display text-xs uppercase tracking-wider text-on-surface-muted">
            No Effect (0x)
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto rounded-[1rem] bg-surface-low p-4">
        <table className="w-max border-collapse" role="table" aria-label="Type effectiveness chart">
          <thead>
            <tr>
              {/* Corner cell: ATK / DEF label */}
              <th className="sticky left-0 z-20 bg-surface-low px-2 py-1">
                <span className="font-display text-[10px] uppercase tracking-wider text-on-surface-muted">
                  Atk / Def
                </span>
              </th>
              {TYPES.map((defType) => (
                <th
                  key={defType}
                  className="h-20 w-10 px-0.5 py-1 align-bottom"
                >
                  <div
                    className="-rotate-45 origin-bottom-left translate-x-4 whitespace-nowrap font-display text-[10px] font-medium uppercase tracking-wider text-on-surface"
                  >
                    {defType}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((atkType) => (
              <tr key={atkType}>
                <td className="sticky left-0 z-10 bg-surface-low pr-2 py-0.5">
                  <span
                    className={`${TYPE_BG[atkType]} inline-block w-full rounded-pill px-2 py-1 text-center font-display text-[10px] font-medium uppercase tracking-widest text-surface`}
                  >
                    {atkType}
                  </span>
                </td>
                {TYPES.map((defType) => {
                  const mult = EFFECTIVENESS[atkType][defType];
                  return (
                    <td
                      key={defType}
                      className={`h-8 w-10 text-center font-display text-xs ${cellStyle(mult)}`}
                      title={`${atkType} vs ${defType}: ${mult}x`}
                    >
                      {cellLabel(mult)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Help text */}
      <p className="mt-4 font-body text-xs text-on-surface-muted">
        Rows represent the attacking type. Columns represent the defending type.
        Only non-neutral matchups are labeled.
      </p>
    </div>
  );
}
