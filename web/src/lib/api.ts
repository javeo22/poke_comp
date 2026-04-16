import type { CheatsheetResponse } from "@/types/cheatsheet";
import type { FullProfile, ProfileData, ProfileUpdate } from "@/types/profile";
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
import type { PokemonDetail, PokemonListResponse } from "@/features/pokemon/types";
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
import { createClient } from "@/utils/supabase/client";

// Production (Vercel): "/api" — same-origin Python function at /api/*
// Development: "http://localhost:8000" — local FastAPI server
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const params = new URLSearchParams();
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }
  const qs = params.toString();
  const url = `${API_URL}${path}${qs ? `?${qs}` : ""}`;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  // Attempt to attach JWT for all requests (auth deferred — skips when Supabase not configured)
  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`);
      }
    }
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    // Try to extract a user-friendly detail message from the response
    let detail = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // Response wasn't JSON -- use the default message
    }
    throw new Error(detail);
  }

  return res.json();
}

async function apiFetchText(path: string): Promise<string> {
  const url = `${API_URL}${path}`;
  const headers = new Headers();

  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`);
      }
    }
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    let detail = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // not JSON
    }
    throw new Error(detail);
  }

  return res.text();
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

export async function fetchPokemonDetail(pokemonId: number) {
  return apiFetch<PokemonDetail>(`/pokemon/${pokemonId}/detail`);
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
  return apiFetch<UserPokemon>("/user-pokemon", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateUserPokemon(id: string, body: UserPokemonUpdate) {
  return apiFetch<UserPokemon>(`/user-pokemon/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteUserPokemon(id: string) {
  const url = `${API_URL}/user-pokemon/${id}`;
  const headers = new Headers();
  
  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }

  const res = await fetch(url, { method: "DELETE", headers });
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
  return apiFetch<Team>("/teams", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTeam(id: string, body: TeamUpdate) {
  return apiFetch<Team>(`/teams/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTeam(id: string) {
  const url = `${API_URL}/teams/${id}`;
  const headers = new Headers();
  
  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }

  const res = await fetch(url, { method: "DELETE", headers });
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
  return apiFetch<ScrapeResponse>("/meta/scrape", { method: "POST" });
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
  return apiFetch<Matchup>("/matchups", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateMatchup(id: string, body: MatchupUpdate) {
  return apiFetch<Matchup>(`/matchups/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteMatchup(id: string) {
  const url = `${API_URL}/matchups/${id}`;
  const headers = new Headers();
  
  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }

  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
}

// ── Draft Analysis ──

export async function analyzeDraft(body: DraftRequest): Promise<DraftResponse> {
  return apiFetch<DraftResponse>("/draft/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Cheatsheet ──

export async function generateCheatsheet(teamId: string): Promise<CheatsheetResponse> {
  return apiFetch<CheatsheetResponse>(`/cheatsheet/${teamId}`, {
    method: "POST",
  });
}

// ── Showdown Import / Export ──

export interface ShowdownImportRequest {
  paste: string;
  team_name: string;
  format: string;
}

export interface ShowdownImportResponse {
  team: Team;
  pokemon_created: number;
  warnings: string[];
}

export interface ShowdownPreviewPokemon {
  name: string;
  pokemon_id: number | null;
  item: string | null;
  item_id: number | null;
  ability: string | null;
  nature: string | null;
  stat_points: Record<string, number> | null;
  moves: string[];
  resolved: boolean;
}

export interface ShowdownPreviewResponse {
  pokemon: ShowdownPreviewPokemon[];
  warnings: string[];
}

export async function previewShowdownImport(
  paste: string
): Promise<ShowdownPreviewResponse> {
  return apiFetch<ShowdownPreviewResponse>("/teams/import/preview", {
    method: "POST",
    body: JSON.stringify({ paste }),
  });
}

export async function importTeamFromShowdown(
  body: ShowdownImportRequest
): Promise<ShowdownImportResponse> {
  return apiFetch<ShowdownImportResponse>("/teams/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function exportTeamToShowdown(teamId: string): Promise<string> {
  return apiFetchText(`/teams/${teamId}/export`);
}

// ── AI Usage ──

export interface AiUsageToday {
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
}

export interface AiUsageEntry {
  endpoint: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  cached: boolean;
  created_at: string;
}

export interface AiUsageResponse {
  today: AiUsageToday;
  recent: AiUsageEntry[];
}

export async function fetchAiUsage(): Promise<AiUsageResponse> {
  return apiFetch<AiUsageResponse>("/ai/usage");
}

// ── Profile ──

export async function fetchProfile(): Promise<FullProfile> {
  return apiFetch<FullProfile>("/profile");
}

export async function updateProfile(body: ProfileUpdate): Promise<ProfileData> {
  return apiFetch<ProfileData>("/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export { apiFetch };

