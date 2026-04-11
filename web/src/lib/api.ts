import type { PokemonListResponse } from "@/types/pokemon";
import type {
  Team,
  TeamCreate,
  TeamListResponse,
  TeamUpdate,
} from "@/types/team";
import type {
  UserPokemon,
  UserPokemonCreate,
  UserPokemonListResponse,
  UserPokemonUpdate,
} from "@/types/user-pokemon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(path, API_URL);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── Pokemon (Reference) ──

export interface PokemonFilters {
  name?: string;
  type?: string;
  champions_only?: boolean;
  generation?: number;
  limit?: number;
  offset?: number;
}

export async function fetchPokemon(filters: PokemonFilters = {}) {
  return apiFetch<PokemonListResponse>("/pokemon", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

// ── User Pokemon (Roster) ──

export interface UserPokemonFilters {
  build_status?: string;
  pokemon_id?: number;
  limit?: number;
  offset?: number;
}

export async function fetchUserPokemon(filters: UserPokemonFilters = {}) {
  return apiFetch<UserPokemonListResponse>("/user-pokemon", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

export async function createUserPokemon(body: UserPokemonCreate) {
  const res = await fetch(`${API_URL}/user-pokemon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<UserPokemon>;
}

export async function updateUserPokemon(id: string, body: UserPokemonUpdate) {
  const res = await fetch(`${API_URL}/user-pokemon/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<UserPokemon>;
}

export async function deleteUserPokemon(id: string) {
  const res = await fetch(`${API_URL}/user-pokemon/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
}

// ── Teams ──

export interface TeamFilters {
  format?: string;
  archetype_tag?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTeams(filters: TeamFilters = {}) {
  return apiFetch<TeamListResponse>("/teams", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchOneTeam(id: string) {
  return apiFetch<Team>(`/teams/${id}`);
}

export async function createTeam(body: TeamCreate) {
  const res = await fetch(`${API_URL}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<Team>;
}

export async function updateTeam(id: string, body: TeamUpdate) {
  const res = await fetch(`${API_URL}/teams/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<Team>;
}

export async function deleteTeam(id: string) {
  const res = await fetch(`${API_URL}/teams/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
}

export { apiFetch };
