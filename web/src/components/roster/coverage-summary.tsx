"use client";

import type { Pokemon } from "@/types/pokemon";
import type { UserPokemon } from "@/types/user-pokemon";

const ALL_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

// Simplified type effectiveness for offensive coverage
// Maps attacking type -> list of types it's super effective against
const SUPER_EFFECTIVE: Record<string, string[]> = {
  normal: [],
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  electric: ["water", "flying"],
  grass: ["water", "ground", "rock"],
  ice: ["grass", "ground", "flying", "dragon"],
  fighting: ["normal", "ice", "rock", "dark", "steel"],
  poison: ["grass", "fairy"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  flying: ["grass", "fighting", "bug"],
  psychic: ["fighting", "poison"],
  bug: ["grass", "psychic", "dark"],
  rock: ["fire", "ice", "flying", "bug"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  dark: ["psychic", "ghost"],
  steel: ["ice", "rock", "fairy"],
  fairy: ["fighting", "dragon", "dark"],
};

interface CoverageSummaryProps {
  entries: UserPokemon[];
  pokemonMap: Map<number, Pokemon>;
}

export function CoverageSummary({ entries, pokemonMap }: CoverageSummaryProps) {
  // Only analyze built + training Pokemon with moves
  const builtEntries = entries.filter(
    (e) => (e.build_status === "built" || e.build_status === "training") && e.moves && e.moves.length > 0
  );

  if (builtEntries.length === 0) return null;

  // Collect all move types from the team
  // We need to look up move types — but we only have move names on user_pokemon
  // Use the Pokemon's type as a proxy for STAB coverage
  const coveredTypes = new Set<string>();
  const teamTypes = new Set<string>();

  for (const entry of builtEntries) {
    const pokemon = pokemonMap.get(entry.pokemon_id);
    if (!pokemon) continue;

    // Add Pokemon's own types for STAB coverage estimate
    for (const type of pokemon.types) {
      teamTypes.add(type);
      const effective = SUPER_EFFECTIVE[type];
      if (effective) {
        for (const t of effective) coveredTypes.add(t);
      }
    }
  }

  const uncovered = ALL_TYPES.filter((t) => !coveredTypes.has(t));

  return (
    <div className="rounded-chunky bg-surface-low p-5">
      <h3 className="mb-3 font-display text-sm font-bold text-on-surface">
        Team Coverage
      </h3>
      <p className="mb-3 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
        {builtEntries.length} Pokemon analyzed (built + training with moves)
      </p>

      {/* Type grid */}
      <div className="mb-3 grid grid-cols-9 gap-1.5">
        {ALL_TYPES.map((type) => {
          const isCovered = coveredTypes.has(type);
          const isTeamType = teamTypes.has(type);
          return (
            <div
              key={type}
              className={`flex flex-col items-center gap-0.5 rounded-chunky p-1.5 ${
                isCovered
                  ? "bg-secondary/15"
                  : "bg-tertiary/15"
              }`}
            >
              <span
                className={`font-display text-[0.5rem] uppercase tracking-wider ${
                  isCovered ? "text-secondary" : "text-tertiary"
                }`}
              >
                {type.slice(0, 3)}
              </span>
              {isTeamType && (
                <div className="h-1 w-1 rounded-pill bg-primary" />
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-secondary">
          {coveredTypes.size}/{ALL_TYPES.length} types covered
        </span>
        {uncovered.length > 0 && (
          <span className="font-display text-[0.6rem] text-tertiary">
            Gaps: {uncovered.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
