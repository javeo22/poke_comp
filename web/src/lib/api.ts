import type { PokemonListResponse } from "@/types/pokemon";

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

export { apiFetch };
