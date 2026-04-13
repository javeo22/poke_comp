import { useSuspenseQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PokemonListResponse } from "../types";

export interface PokemonFilters {
  name?: string;
  type?: string;
  champions_only?: boolean;
  generation?: number;
  limit?: number;
  offset?: number;
}

export const pokemonApi = {
  getPokemon: async (filters: PokemonFilters) => {
    return apiFetch<PokemonListResponse>("/pokemon", {
      params: filters as Record<string, string | number | boolean | undefined>,
    });
  },
};

export function usePokemonSuspense(filters: PokemonFilters) {
  return useSuspenseQuery({
    queryKey: ["pokemon", filters],
    queryFn: () => pokemonApi.getPokemon(filters),
  });
}
