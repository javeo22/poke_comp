import { POKEMON_TYPES, type PokemonType } from "@/features/pokemon/types";

// Type effectiveness chart: attacker -> defender -> multiplier.
// 0 = immune, 0.5 = resisted, 1 = neutral, 2 = super effective
export const TYPE_CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export interface TypeCoverageEntry {
  type: PokemonType;
  multiplier: number;
}

export function isPokemonType(type: string): type is PokemonType {
  return (POKEMON_TYPES as readonly string[]).includes(type);
}

export function normalizePokemonType(type: string): PokemonType | null {
  const normalized = type.trim().toLowerCase();
  return isPokemonType(normalized) ? normalized : null;
}

export function getTypeEffectiveness(attackType: string, defenseType: string): number {
  const attack = normalizePokemonType(attackType);
  const defense = normalizePokemonType(defenseType);
  if (!attack || !defense) return 1;
  return TYPE_CHART[attack]?.[defense] ?? 1;
}

export function getDefensiveMultiplier(
  attackType: string,
  defenderTypes: readonly string[]
): number {
  return defenderTypes.reduce(
    (multiplier, defenseType) => multiplier * getTypeEffectiveness(attackType, defenseType),
    1
  );
}

export function getBestOffensiveMultiplier(
  attackTypes: readonly string[],
  defenseType: string
): number {
  if (attackTypes.length === 0) return 1;
  return Math.max(...attackTypes.map((attackType) => getTypeEffectiveness(attackType, defenseType)));
}

export function getOffensiveCoverage(attackTypes: readonly string[]): TypeCoverageEntry[] {
  return POKEMON_TYPES.map((defenseType) => ({
    type: defenseType,
    multiplier: getBestOffensiveMultiplier(attackTypes, defenseType),
  }));
}

export function getDefensiveCoverage(teamTypes: readonly (readonly string[])[]): TypeCoverageEntry[] {
  return POKEMON_TYPES.map((attackType) => ({
    type: attackType,
    multiplier:
      teamTypes.length === 0
        ? 1
        : Math.min(...teamTypes.map((types) => getDefensiveMultiplier(attackType, types))),
  }));
}

export function getPokemonWeaknesses(defenderTypes: readonly string[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getDefensiveMultiplier(attackType, defenderTypes) >= 2);
}

export function getPokemonResistances(defenderTypes: readonly string[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getDefensiveMultiplier(attackType, defenderTypes) <= 0.5);
}

export function getSuperEffectiveAttackTypes(defenseType: string): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getTypeEffectiveness(attackType, defenseType) >= 2);
}

export function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
