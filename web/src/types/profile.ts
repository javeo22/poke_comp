export interface ProfileData {
  user_id: string;
  display_name: string | null;
  avatar_pokemon_id: number | null;
  avatar_sprite_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecentFormEntry {
  outcome: "win" | "loss";
  played_at: string;
}

export interface ExpandedStats {
  team_count: number;
  roster_count: number;
  matches_played: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
  streak_type: "win" | "loss" | "none";
  matches_this_week: number;
  most_used_team: string | null;
  most_used_team_id: string | null;
  most_faced_opponent: string | null;
  recent_form: RecentFormEntry[];
}

export interface FullProfile {
  profile: ProfileData;
  stats: ExpandedStats;
  member_since: string;
  email: string | null;
}

export interface ProfileUpdate {
  display_name?: string | null;
  avatar_pokemon_id?: number | null;
}
