export interface MetaSnapshot {
  id: number;
  snapshot_date: string;
  format: "singles" | "doubles" | "megas";
  tier_data: Record<string, string[]>;
  source_url: string | null;
  source: string | null;
}

export interface MetaSnapshotListResponse {
  data: MetaSnapshot[];
  count: number;
}

export const TIERS = ["S", "A+", "A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

export const META_FORMATS = ["singles", "doubles", "megas"] as const;
export type MetaFormat = (typeof META_FORMATS)[number];
