export interface UsageEntry {
  name: string;
  percent: number;
}

export interface PokemonUsage {
  id: number;
  pokemon_name: string;
  format: string;
  usage_percent: number;
  moves: UsageEntry[] | null;
  items: UsageEntry[] | null;
  abilities: UsageEntry[] | null;
  teammates: UsageEntry[] | null;
  snapshot_date: string;
  source: string | null;
  sprite_url: string | null;
}

export interface PokemonUsageList {
  data: PokemonUsage[];
  count: number;
}
