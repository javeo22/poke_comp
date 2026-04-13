export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  base_stats: {
    hp: number;
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
    speed: number;
  };
  abilities: string[];
  movepool: string[];
  champions_eligible: boolean;
  generation: number | null;
  mega_evolution_id: number | null;
  sprite_url: string | null;
}

export interface PokemonListResponse {
  data: Pokemon[];
  count: number;
}

export const POKEMON_TYPES = [
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

export type PokemonType = (typeof POKEMON_TYPES)[number];
