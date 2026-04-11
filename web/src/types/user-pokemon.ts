export interface UserPokemon {
  id: string;
  user_id: string;
  pokemon_id: number;
  item_id: number | null;
  ability: string | null;
  nature: string | null;
  stat_points: Record<string, number> | null;
  moves: string[] | null;
  notes: string | null;
  build_status: "built" | "training" | "wishlist" | null;
  vp_spent: number;
  created_at: string;
  updated_at: string;
}

export interface UserPokemonListResponse {
  data: UserPokemon[];
  count: number;
}

export interface UserPokemonCreate {
  pokemon_id: number;
  item_id?: number | null;
  ability?: string | null;
  nature?: string | null;
  stat_points?: Record<string, number> | null;
  moves?: string[] | null;
  notes?: string | null;
  build_status?: "built" | "training" | "wishlist" | null;
  vp_spent?: number;
}

export interface UserPokemonUpdate {
  item_id?: number | null;
  ability?: string | null;
  nature?: string | null;
  stat_points?: Record<string, number> | null;
  moves?: string[] | null;
  notes?: string | null;
  build_status?: "built" | "training" | "wishlist" | null;
  vp_spent?: number;
}

export const BUILD_STATUSES = ["built", "training", "wishlist"] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const NATURES = [
  "Adamant", "Bashful", "Bold", "Brave", "Calm",
  "Careful", "Docile", "Gentle", "Hardy", "Hasty",
  "Impish", "Jolly", "Lax", "Lonely", "Mild",
  "Modest", "Naive", "Naughty", "Quiet", "Quirky",
  "Rash", "Relaxed", "Sassy", "Serious", "Timid",
] as const;
