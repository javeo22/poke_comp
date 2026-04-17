export interface OpponentPokemon {
  name: string;
}

export type MatchFormat = "ladder" | "bo1" | "bo3" | "tournament" | "friendly";
export type CloseType = "blowout" | "close" | "comeback" | "standard";

export interface Matchup {
  id: string;
  user_id: string;
  my_team_id: string | null;
  opponent_team_data: OpponentPokemon[] | null;
  lead_pair: string[] | null;
  outcome: "win" | "loss";
  notes: string | null;
  played_at: string;
  format?: MatchFormat | null;
  tags?: string[];
  close_type?: CloseType | null;
  mvp_pokemon?: string | null;
}

export interface MatchupCreate {
  my_team_id: string;
  opponent_team_data: OpponentPokemon[];
  lead_pair?: string[];
  outcome: "win" | "loss";
  notes?: string;
  format?: MatchFormat;
  tags?: string[];
  close_type?: CloseType;
  mvp_pokemon?: string;
}

export interface MatchupUpdate {
  opponent_team_data?: OpponentPokemon[];
  lead_pair?: string[];
  outcome?: "win" | "loss";
  notes?: string;
  format?: MatchFormat;
  tags?: string[];
  close_type?: CloseType;
  mvp_pokemon?: string;
}

export interface MatchupListResponse {
  data: Matchup[];
  count: number;
}

export interface WinRateStat {
  label: string;
  wins: number;
  losses: number;
  total: number;
  win_rate: number;
}

export interface MatchupStats {
  overall: WinRateStat;
  by_team: WinRateStat[];
  by_opponent_pokemon: WinRateStat[];
  by_format?: WinRateStat[];
  by_tag?: WinRateStat[];
}
