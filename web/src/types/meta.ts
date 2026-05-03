export interface MetaSnapshot {
  id: number;
  snapshot_date: string;
  format: "singles" | "doubles";
  tier_data: Record<string, string[]>;
  source_url: string | null;
  source: string | null;
}

export interface MetaTrend {
  id: number;
  pokemon_name: string;
  usage_percent: number;
  previous_usage: number;
  swing: number;
  up: boolean;
  win_rate: number;
  role: string;
}

export interface MetaSnapshotListResponse {
  data: MetaSnapshot[];
  count: number;
}

export const TIERS = ["S", "A+", "A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

export const META_FORMATS = ["singles", "doubles"] as const;
export type MetaFormat = (typeof META_FORMATS)[number];
