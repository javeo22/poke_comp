import type { CheatsheetResponse } from "@/types/cheatsheet";
import type { DraftRequest, DraftResponse } from "@/types/draft";
import type { ItemListResponse } from "@/types/item";
import type {
  Matchup,
  MatchupCreate,
  MatchupListResponse,
  MatchupStats,
  MatchupUpdate,
} from "@/types/matchup";
import type { MetaSnapshot } from "@/types/meta";
import type { MoveListResponse } from "@/types/move";
import type { PokemonListResponse } from "@/types/pokemon";
import type { PokemonUsage, PokemonUsageList } from "@/types/usage";
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

// ── Items ──

export interface ItemFilters {
  name?: string;
  category?: string;
  champions_only?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchItems(filters: ItemFilters = {}) {
  return apiFetch<ItemListResponse>("/items", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

// ── Moves ──

export interface MoveFilters {
  name?: string;
  type?: string;
  category?: string;
  champions_only?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchMoves(filters: MoveFilters = {}) {
  return apiFetch<MoveListResponse>("/moves", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
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

// ── Meta Snapshots ──

export async function fetchLatestMeta() {
  return apiFetch<MetaSnapshot[]>("/meta/latest");
}

export interface ScrapeResult {
  format: string;
  pokemon_count: number;
  status: string;
}

export interface ScrapeResponse {
  results: ScrapeResult[];
  estimated_cost_usd: number;
}

export async function triggerMetaScrape(): Promise<ScrapeResponse> {
  const res = await fetch(`${API_URL}/meta/scrape`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<ScrapeResponse>;
}

export interface MetaFilters {
  format?: string;
  limit?: number;
  offset?: number;
}

export async function fetchMetaSnapshots(filters: MetaFilters = {}) {
  return apiFetch<{ data: MetaSnapshot[]; count: number }>("/meta", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

// ── Usage Stats ──

export async function fetchUsage(format: string = "doubles", limit: number = 50) {
  return apiFetch<PokemonUsageList>("/usage", {
    params: { format, limit },
  });
}

export async function fetchPokemonUsage(pokemonName: string) {
  return apiFetch<PokemonUsage[]>(`/usage/pokemon/${encodeURIComponent(pokemonName)}`);
}

// ── Matchups ──

export interface MatchupFilters {
  outcome?: string;
  my_team_id?: string;
  opponent_pokemon?: string;
  limit?: number;
  offset?: number;
}

export async function fetchMatchups(filters: MatchupFilters = {}) {
  return apiFetch<MatchupListResponse>("/matchups", {
    params: filters as Record<string, string | number | boolean | undefined>,
  });
}

export async function fetchMatchupStats() {
  return apiFetch<MatchupStats>("/matchups/stats");
}

export async function createMatchup(body: MatchupCreate) {
  const res = await fetch(`${API_URL}/matchups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<Matchup>;
}

export async function updateMatchup(id: string, body: MatchupUpdate) {
  const res = await fetch(`${API_URL}/matchups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<Matchup>;
}

export async function deleteMatchup(id: string) {
  const res = await fetch(`${API_URL}/matchups/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
}

// ── Draft Analysis ──

export async function analyzeDraft(body: DraftRequest): Promise<DraftResponse> {
  const res = await fetch(`${API_URL}/draft/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<DraftResponse>;
}

// ── Cheatsheet ──

export async function generateCheatsheet(teamId: string): Promise<CheatsheetResponse> {
  const res = await fetch(`${API_URL}/cheatsheet/${teamId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<CheatsheetResponse>;
}

export { apiFetch };
