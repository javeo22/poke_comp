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
import type {
  PokemonBasicListResponse,
  PokemonDetail,
  PokemonListResponse,
} from "@/features/pokemon/types";
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
//
// During SSR, relative URLs like "/api" are invalid (no origin to resolve
// against).  Resolve them to an absolute URL using the Vercel deployment host
// or localhost so that server-side fetches work.
const API_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  if (base.startsWith("http")) return base;
  // Client-side: relative URLs resolve against window.location — fine as-is
  if (typeof window !== "undefined") return base;
  // Server-side: build an absolute URL
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  return `${origin}${base}`;
})();

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

// Tiny in-memory TTL cache for slow-changing GETs (Pokemon list, usage stats).
// Keyed on path + serialized params. Skipped on the server (per-process cache
// would leak across users in a serverless function).
const CACHE_TTL_MS = 5 * 60 * 1000;
const _memCache = new Map<string, { data: unknown; ts: number }>();

async function cachedFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const key = path + JSON.stringify(params);
  if (typeof window !== "undefined") {
    const hit = _memCache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return hit.data as T;
    }
  }
  const data = await apiFetch<T>(path, { params });
  if (typeof window !== "undefined") {
    _memCache.set(key, { data, ts: Date.now() });
  }
  return data;
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

export interface PokemonBasicFilters {
  type?: string;
  champions_only?: boolean;
  limit?: number;
  offset?: number;
}

// Slim Pokemon list for pickers + grid views. ~80% smaller payload than
// fetchPokemon -- omits movepool, abilities, base_stats, mega data. Cached
// in-memory for 5 minutes since static data changes rarely.
export async function fetchPokemonBasic(filters: PokemonBasicFilters = {}) {
  return cachedFetch<PokemonBasicListResponse>(
    "/pokemon/basic",
    filters as Record<string, string | number | boolean | undefined>
  );
}

export async function fetchPokemonDetail(pokemonId: number) {
  return apiFetch<PokemonDetail>(`/pokemon/${pokemonId}/detail`);
}

// ── Speed Tiers (Reference) ──

export interface SpeedTierEntry {
  id: number;
  name: string;
  types: string[];
  sprite_url: string | null;
  base_speed: number;
  neutral_max: number;
  positive_max: number;
  scarf_max: number;
  usage_percent: number | null;
}

export interface SpeedTierListResponse {
  data: SpeedTierEntry[];
  count: number;
}

export async function fetchSpeedTiers(
  format: string = "doubles",
  championsOnly: boolean = true
): Promise<SpeedTierListResponse> {
  return cachedFetch<SpeedTierListResponse>("/pokemon/speed-tiers", {
    format,
    champions_only: championsOnly,
  });
}

// ── Damage Calc ──

export interface CalcRequest {
  attacker_id: number;
  defender_id: number;
  move_id: number;
  attacker_evs?: Record<string, number>;
  defender_evs?: Record<string, number>;
  attacker_nature?: { plus?: string; minus?: string };
  defender_nature?: { plus?: string; minus?: string };
  weather?: "none" | "sun" | "rain" | "snow" | "sand";
  is_doubles?: boolean;
  extra_modifier?: number;
}

export interface CalcResponse {
  min: number;
  max: number;
  min_pct: number;
  max_pct: number;
  defender_hp: number;
  type_effectiveness: number;
  stab: boolean;
  is_ohko_chance: boolean;
  is_guaranteed_ohko: boolean;
  skipped_reason: string | null;
  formatted: string;
  attacker_name: string;
  defender_name: string;
  move_name: string;
  move_type: string;
  move_category: string;
  move_power: number;
}

export async function runCalc(body: CalcRequest): Promise<CalcResponse> {
  return apiFetch<CalcResponse>("/calc", {
    method: "POST",
    body: JSON.stringify(body),
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
  return cachedFetch<PokemonUsageList>("/usage", { format, limit });
}

export async function fetchPokemonUsage(pokemonName: string) {
  return apiFetch<PokemonUsage[]>(`/usage/pokemon/${encodeURIComponent(pokemonName)}`);
}

// ── Matchups ──

export interface MatchupFilters {
  outcome?: string;
  my_team_id?: string;
  opponent_pokemon?: string;
  format?: string;
  tag?: string;
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

export async function analyzeDraft(
  body: DraftRequest,
  model?: string
): Promise<DraftResponse> {
  const params = model ? `?model=${encodeURIComponent(model)}` : "";
  return apiFetch<DraftResponse>(`/draft/analyze${params}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Cheatsheet ──

export async function generateCheatsheet(
  teamId: string,
  opts: { model?: string; force?: boolean } = {}
): Promise<CheatsheetResponse> {
  const params = new URLSearchParams();
  if (opts.model) params.set("model", opts.model);
  if (opts.force) params.set("force", "true");
  const qs = params.toString();
  return apiFetch<CheatsheetResponse>(`/cheatsheet/${teamId}${qs ? `?${qs}` : ""}`, {
    method: "POST",
  });
}

export async function fetchSavedCheatsheet(teamId: string): Promise<CheatsheetResponse> {
  return apiFetch<CheatsheetResponse>(`/cheatsheet/${teamId}`);
}

export async function deleteCheatsheet(teamId: string): Promise<void> {
  const url = `${API_URL}/cheatsheet/${teamId}`;
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const supabase = createClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok && res.status !== 204) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
}

export interface SavedCheatsheet {
  id: string;
  team_id: string;
  cheatsheet_json: CheatsheetResponse;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchAllCheatsheets(): Promise<SavedCheatsheet[]> {
  return apiFetch<SavedCheatsheet[]>(`/cheatsheet/all`);
}

export async function fetchCheatsheetStatus(teamIds: string[]): Promise<Record<string, string>> {
  if (teamIds.length === 0) return {};
  return apiFetch<Record<string, string>>(`/cheatsheet/status`, {
    params: { team_ids: teamIds.join(",") },
  });
}

export async function toggleCheatsheetVisibility(
  teamId: string
): Promise<{ team_id: string; is_public: boolean }> {
  return apiFetch(`/cheatsheet/${teamId}/visibility`, { method: "PATCH" });
}

// ── Public Endpoints (no auth) ──

export interface PublicProfile {
  username: string;
  display_name: string | null;
  avatar_pokemon_id: number | null;
  avatar_sprite_url: string | null;
  supporter: boolean;
  team_count: number;
  cheatsheet_count: number;
}

export interface PublicCheatsheetSummary {
  id: string;
  team_name: string | null;
  team_format: string | null;
  updated_at: string;
}

export interface PublicCheatsheetDetail {
  id: string;
  team_name: string | null;
  team_format: string | null;
  cheatsheet_json: CheatsheetResponse;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_sprite_url: string | null;
  updated_at: string;
}

export async function fetchPublicProfile(
  username: string
): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(`/public/u/${username}`);
}

export async function fetchPublicCheatsheets(
  username: string
): Promise<PublicCheatsheetSummary[]> {
  return apiFetch<PublicCheatsheetSummary[]>(
    `/public/u/${username}/cheatsheets`
  );
}

export async function fetchPublicCheatsheet(
  id: string
): Promise<PublicCheatsheetDetail> {
  return apiFetch<PublicCheatsheetDetail>(`/public/cheatsheet/${id}`);
}

export interface PublicStats {
  pokemon_count: number;
  teams_count: number;
  matches_count: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return apiFetch<PublicStats>("/public/stats");
}

export interface DataFreshnessFormat {
  snapshot_date: string;
  days_old: number | null;
  stale: boolean;
}

export interface DataFreshnessResponse {
  checked_at: string;
  stale_threshold_days: number;
  formats: Record<string, DataFreshnessFormat>;
}

export async function fetchDataFreshness(): Promise<DataFreshnessResponse> {
  return apiFetch<DataFreshnessResponse>("/public/data-freshness");
}

export async function checkUsername(
  username: string
): Promise<{ available: boolean; username: string; reason?: string }> {
  return apiFetch(`/profile/check-username/${username}`);
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
  available_models?: string[];
}

export interface AiUsageMonth {
  used: number;
  soft_cap: number;
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
  month: AiUsageMonth | null;
  supporter: boolean;
  unlimited: boolean;
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

// ── Strategy Notes ──

export interface StrategyNote {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  format: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchStrategyNotes(
  includeInactive = false
): Promise<StrategyNote[]> {
  const params = includeInactive ? "?include_inactive=true" : "";
  return apiFetch<StrategyNote[]>(`/strategy${params}`);
}

export async function createStrategyNote(
  body: Omit<StrategyNote, "id" | "is_active" | "created_at" | "updated_at">
): Promise<StrategyNote> {
  return apiFetch<StrategyNote>("/strategy", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateStrategyNote(
  id: string,
  body: Partial<StrategyNote>
): Promise<StrategyNote> {
  return apiFetch<StrategyNote>(`/strategy/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteStrategyNote(id: string): Promise<void> {
  await apiFetch(`/strategy/${id}`, { method: "DELETE" });
}

// ── Admin ──

export interface AdminStats {
  pokemon_champions: number;
  moves_champions: number;
  items_champions: number;
  abilities_total: number;
}

export interface AdminAiCosts {
  days: number;
  total_cost: number;
  total_requests: number;
  cached_requests: number;
  by_endpoint: Record<string, number>;
  by_day: Record<string, number>;
}

export interface DataHealthReport {
  overall: string;
  total_issues: number;
  checks: { name: string; status: string; issues: string[] }[];
}

export interface DataFreshness {
  checked_at: string;
  usage_data: Record<string, string>;
  meta_snapshots: Record<string, string>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats");
}

export async function fetchAdminAiCosts(
  days: number = 30
): Promise<AdminAiCosts> {
  return apiFetch<AdminAiCosts>("/admin/ai-costs", {
    params: { days },
  });
}

export async function fetchAdminDataHealth(): Promise<DataHealthReport> {
  return apiFetch<DataHealthReport>("/admin/data-health");
}

export async function fetchAdminDataFreshness(): Promise<DataFreshness> {
  return apiFetch<DataFreshness>("/admin/data-freshness");
}

export async function fetchAdminPokemon(params: {
  champions_only?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  return apiFetch("/admin/pokemon", { params });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAdminPokemon(id: number, updates: any) {
  return apiFetch(`/admin/pokemon/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function fetchAdminMoves(params: {
  champions_only?: boolean;
  search?: string;
  type_filter?: string;
  limit?: number;
  offset?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  return apiFetch("/admin/moves", { params });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAdminMove(id: number, updates: any) {
  return apiFetch(`/admin/moves/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function fetchAdminItems(params: {
  champions_only?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  return apiFetch("/admin/items", { params });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAdminItem(id: number, updates: any) {
  return apiFetch(`/admin/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function fetchAdminMetaSnapshots(params: {
  format_filter?: string;
  limit?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  return apiFetch("/admin/meta-snapshots", { params });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAdminMetaSnapshot(id: string, updates: any) {
  return apiFetch(`/admin/meta-snapshots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export { apiFetch };

