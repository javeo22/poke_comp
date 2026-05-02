import type { MetaTrend } from "@/types/meta";

/**
 * Baseline Meta Trends derived from Season M-1 Champions data.
 * Used as fallback for homepage when API data is unavailable.
 */
export const BASELINE_TRENDS: MetaTrend[] = [
  {
    id: 727,
    pokemon_name: "Incineroar",
    usage_percent: 78.4,
    previous_usage: 78.4,
    swing: 0,
    up: true,
    win_rate: 54.2,
    role: "Intimidate Pivot",
  },
  {
    id: 983,
    pokemon_name: "Kingambit",
    usage_percent: 42.1,
    previous_usage: 42.1,
    swing: 0,
    up: true,
    win_rate: 51.8,
    role: "Late-game Sweeper",
  },
  {
    id: 445,
    pokemon_name: "Garchomp",
    usage_percent: 31.5,
    previous_usage: 31.5,
    swing: 0,
    up: true,
    win_rate: 49.2,
    role: "Physical Pressure",
  },
  {
    id: 149,
    pokemon_name: "Dragonite",
    usage_percent: 28.2,
    previous_usage: 28.2,
    swing: 0,
    up: true,
    win_rate: 52.1,
    role: "Multiscale Sweeper",
  },
  {
    id: 970,
    pokemon_name: "Glimmora",
    usage_percent: 24.5,
    previous_usage: 24.5,
    swing: 0,
    up: true,
    win_rate: 48.7,
    role: "Hazard Setter",
  },
  {
    id: 1013,
    pokemon_name: "Sinistcha",
    usage_percent: 22.8,
    previous_usage: 22.8,
    swing: 0,
    up: true,
    win_rate: 53.5,
    role: "Support / Redirect",
  },
];
