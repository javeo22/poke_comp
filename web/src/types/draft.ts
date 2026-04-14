export interface ThreatInfo {
  pokemon: string;
  threat_level: "high" | "medium" | "low";
  reason: string;
  likely_set: string;
  key_moves: string[];
}

export interface BringRecommendation {
  pokemon: string;
  role: string;
  reason: string;
}

export interface DamageCalc {
  attacker: string;
  move: string;
  defender: string;
  estimated_damage: string;
  note: string;
}

export interface DraftAnalysis {
  summary: string;
  bring_four: BringRecommendation[];
  lead_pair: [string, string];
  threats: ThreatInfo[];
  damage_calcs: DamageCalc[];
  game_plan: string;
}

export interface DraftResponse {
  analysis: DraftAnalysis;
  cached: boolean;
  estimated_cost_usd: number;
  ai_disclaimer: string;
}

export interface DraftRequest {
  opponent_team: string[];
  my_team_id: string;
}
