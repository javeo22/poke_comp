export interface CheatsheetMove {
  name: string;
  category: "stab" | "utility" | "priority";
}

export interface RosterEntry {
  id?: number;
  name: string;
  types: string[];
  item: string | null;
  ability: string | null;
  nature: string | null;
  stat_points: string | null; // formatted: "32 SpA / 32 Spd / 2 HP"
  moves: CheatsheetMove[];
  is_mega: boolean;
}

export interface SpeedTier {
  pokemon: string;
  speed: number;
  note: string | null; // e.g. "x Unburden"
}

export interface GamePlanStep {
  step: number;
  title: string;
  description: string;
}

export interface KeyRule {
  title: string;
  description: string;
}

export interface LeadMatchup {
  archetype: string;
  example: string;
  threat_tier: string; // "S-TIER", "A-TIER", "MOST COMMON", "HIGHEST WR"
  lead: string[];
  back: string[];
  note: string;
}

export interface Weakness {
  title: string;
  description: string;
}

export interface CheatsheetResponse {
  team_id: string;
  team_name: string;
  team_title: string; // AI-generated punchy title
  archetype: string;
  format: string;
  roster: RosterEntry[];
  speed_tiers: SpeedTier[];
  game_plan: GamePlanStep[];
  key_rules: KeyRule[];
  lead_matchups: LeadMatchup[];
  weaknesses: Weakness[];
  cached: boolean;
  estimated_cost_usd: number;
  ai_disclaimer: string;
  is_stale?: boolean;
  generated_at?: string | null;
}
