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
  mega_evolution_ids: number[];
  mega_evolution_names: string[];
  sprite_url: string | null;
}

export interface PokemonListResponse {
  data: Pokemon[];
  count: number;
}

export interface MoveDetail {
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  effect_text: string | null;
}

export interface AbilityDetail {
  name: string;
  effect_text: string | null;
}

export interface PokemonUsageSummary {
  format: string;
  usage_percent: number;
  top_moves: string[];
  top_items: string[];
  top_abilities: string[];
  top_teammates: string[];
}

export interface PokemonDetail extends Pokemon {
  move_details: MoveDetail[];
  ability_details: AbilityDetail[];
  usage: PokemonUsageSummary[];
  mega_evolution_name: string | null;
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
