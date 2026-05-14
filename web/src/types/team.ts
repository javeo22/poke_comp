export interface Team {
  id: string;
  user_id: string;
  name: string;
  format: "singles" | "doubles";
  pokemon_ids: string[];
  mega_pokemon_id: string | null;
  mega_form_pokemon_id: number | null;
  mega_pokemon_ids?: string[];
  mega_form_pokemon_ids?: number[];
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
  format: "singles" | "doubles";
  pokemon_ids: string[];
  mega_pokemon_id?: string | null;
  mega_form_pokemon_id?: number | null;
  mega_pokemon_ids?: string[];
  mega_form_pokemon_ids?: number[];
  notes?: string | null;
  archetype_tag?: string | null;
}

export interface TeamUpdate {
  name?: string;
  format?: "singles" | "doubles";
  pokemon_ids?: string[];
  mega_pokemon_id?: string | null;
  mega_form_pokemon_id?: number | null;
  mega_pokemon_ids?: string[];
  mega_form_pokemon_ids?: number[];
  notes?: string | null;
  archetype_tag?: string | null;
}

export const FORMATS = ["singles", "doubles"] as const;
export type Format = (typeof FORMATS)[number];
