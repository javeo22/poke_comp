export interface ThreatInfo {
  pokemon: string;
  threat_level: "high" | "medium" | "low";
  reason: string;
  likely_set: string;
  key_moves: string[];
  verified?: boolean;
  verification_note?: string | null;
}

export interface BringRecommendation {
  pokemon: string;
  role: string;
  reason: string;
  verified?: boolean;
  verification_note?: string | null;
}

export interface DamageCalc {
  attacker: string;
  move: string;
  defender: string;
  estimated_damage: string;
  note: string;
  verified?: boolean;
  verification_note?: string | null;
}

export interface DraftAnalysis {
  summary: string;
  bring_four: BringRecommendation[];
  lead_pair: [string, string];
  threats: ThreatInfo[];
  damage_calcs: DamageCalc[];
  game_plan: string;
  warnings?: string[];
}

export interface DraftResponse {
  analysis: DraftAnalysis;
  cached: boolean;
  estimated_cost_usd: number;
  ai_disclaimer: string;
}

export interface DraftRequest {
  opponent_team: string[];
  my_team_id?: string;
  my_selection?: string[];
}
