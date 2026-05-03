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
    top_moves: [{ name: "Fake Out", percent: 99 }, { name: "Flare Blitz", percent: 90 }, { name: "Parting Shot", percent: 85 }]
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
    top_moves: [{ name: "Kowtow Cleave", percent: 99 }, { name: "Sucker Punch", percent: 95 }, { name: "Iron Head", percent: 80 }]
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
    top_moves: [{ name: "Earthquake", percent: 90 }, { name: "Dragon Claw", percent: 70 }]
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
    top_moves: [{ name: "Extreme Speed", percent: 95 }, { name: "Stomping Tantrum", percent: 60 }]
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
    top_moves: [{ name: "Mortal Spin", percent: 90 }, { name: "Sludge Bomb", percent: 80 }]
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
    top_moves: [{ name: "Matcha Gotcha", percent: 95 }, { name: "Rage Powder", percent: 90 }]
  },
];
