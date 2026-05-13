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
  my_team_actual?: string[] | null;
  replay_url?: string | null;
  opponent_name?: string | null;
  opponent_rating?: number | null;
  event_name?: string | null;
  round_label?: string | null;
  game_number?: number | null;
  set_id?: string | null;
  opponent_lead_pair?: string[] | null;
  opponent_selected_four?: string[] | null;
  my_selected_four?: string[] | null;
  loss_reason?: string | null;
  win_condition?: string | null;
  key_turn?: string | null;
  adjustment_note?: string | null;
}

export interface MatchupCreate {
  my_team_id?: string | null;
  opponent_team_data: OpponentPokemon[];
  lead_pair?: string[];
  outcome: "win" | "loss";
  notes?: string;
  format?: MatchFormat;
  tags?: string[];
  close_type?: CloseType;
  mvp_pokemon?: string;
  my_team_actual?: string[];
  replay_url?: string;
  opponent_name?: string;
  opponent_rating?: number;
  event_name?: string;
  round_label?: string;
  game_number?: number;
  set_id?: string;
  opponent_lead_pair?: string[];
  opponent_selected_four?: string[];
  my_selected_four?: string[];
  loss_reason?: string;
  win_condition?: string;
  key_turn?: string;
  adjustment_note?: string;
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
  my_team_actual?: string[];
  replay_url?: string;
  opponent_name?: string;
  opponent_rating?: number;
  event_name?: string;
  round_label?: string;
  game_number?: number;
  set_id?: string;
  opponent_lead_pair?: string[];
  opponent_selected_four?: string[];
  my_selected_four?: string[];
  loss_reason?: string;
  win_condition?: string;
  key_turn?: string;
  adjustment_note?: string;
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

export interface FrequencyStat {
  label: string;
  count: number;
}

export interface PrepAction {
  label: string;
  detail: string;
  action: "benchmark_team" | "review_team" | "review_losses" | "log_match" | string;
}

export interface MatchupInsights {
  total_matches: number;
  recent: WinRateStat;
  worst_opponents: WinRateStat[];
  underperforming_teams: WinRateStat[];
  common_loss_reasons: FrequencyStat[];
  common_loss_tags: FrequencyStat[];
  prep_actions: PrepAction[];
}
