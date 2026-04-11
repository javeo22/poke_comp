export interface Team {
  id: string;
  user_id: string;
  name: string;
  format: "singles" | "doubles" | "megas";
  pokemon_ids: string[];
  mega_pokemon_id: string | null;
  notes: string | null;
  archetype_tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamListResponse {
  data: Team[];
  count: number;
}

export interface TeamCreate {
  name: string;
  format: "singles" | "doubles" | "megas";
  pokemon_ids: string[];
  mega_pokemon_id?: string | null;
  notes?: string | null;
  archetype_tag?: string | null;
}

export interface TeamUpdate {
  name?: string;
  format?: "singles" | "doubles" | "megas";
  pokemon_ids?: string[];
  mega_pokemon_id?: string | null;
  notes?: string | null;
  archetype_tag?: string | null;
}

export const FORMATS = ["singles", "doubles", "megas"] as const;
export type Format = (typeof FORMATS)[number];
