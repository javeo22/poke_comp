import type { CheatsheetResponse } from "@/types/cheatsheet";
import type { DraftResponse } from "@/types/draft";
import type { TeamBenchmarkResponse } from "@/lib/api";
import type { Matchup, MatchupStats } from "@/types/matchup";
import type { Team } from "@/types/team";
import type { UserPokemon } from "@/types/user-pokemon";

export const DEMO_MODE_KEY = "pokecomp_demo_mode";

const now = "2026-05-07T00:00:00.000Z";

export function isDemoModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(DEMO_MODE_KEY) === "true" ||
    new URLSearchParams(window.location.search).get("demo") === "1"
  );
}

export function enableDemoMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_MODE_KEY, "true");
  window.location.reload();
}

export function disableDemoMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_MODE_KEY);
  window.location.reload();
}

export const DEMO_ROSTER: UserPokemon[] = [
  {
    id: "demo-incineroar",
    user_id: "demo",
    pokemon_id: 727,
    item_id: null,
    ability: "Intimidate",
    nature: "Careful",
    stat_points: { hp: 28, attack: 4, defense: 14, sp_attack: 0, sp_defense: 14, speed: 6 },
    moves: ["Fake Out", "Flare Blitz", "Parting Shot", "Knock Off"],
    notes: "Pivot lead into physical teams.",
    build_status: "built",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-kingambit",
    user_id: "demo",
    pokemon_id: 983,
    item_id: null,
    ability: "Defiant",
    nature: "Adamant",
    stat_points: { hp: 20, attack: 32, defense: 8, sp_attack: 0, sp_defense: 6, speed: 0 },
    moves: ["Kowtow Cleave", "Iron Head", "Sucker Punch", "Protect"],
    notes: "Endgame win condition.",
    build_status: "built",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-garchomp",
    user_id: "demo",
    pokemon_id: 445,
    item_id: null,
    ability: "Rough Skin",
    nature: "Jolly",
    stat_points: { hp: 0, attack: 32, defense: 2, sp_attack: 0, sp_defense: 0, speed: 32 },
    moves: ["Earthquake", "Dragon Claw", "Stomping Tantrum", "Protect"],
    notes: "Fast ground pressure.",
    build_status: "built",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-dragonite",
    user_id: "demo",
    pokemon_id: 149,
    item_id: null,
    ability: "Multiscale",
    nature: "Adamant",
    stat_points: { hp: 20, attack: 32, defense: 6, sp_attack: 0, sp_defense: 8, speed: 0 },
    moves: ["Extreme Speed", "Dragon Dance", "Stomping Tantrum", "Protect"],
    notes: "Priority cleanup.",
    build_status: "built",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-glimmora",
    user_id: "demo",
    pokemon_id: 970,
    item_id: null,
    ability: "Toxic Debris",
    nature: "Timid",
    stat_points: { hp: 0, attack: 0, defense: 2, sp_attack: 32, sp_defense: 0, speed: 32 },
    moves: ["Power Gem", "Sludge Bomb", "Earth Power", "Spiky Shield"],
    notes: "Special coverage.",
    build_status: "built",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-sinistcha",
    user_id: "demo",
    pokemon_id: 1013,
    item_id: null,
    ability: "Hospitality",
    nature: "Bold",
    stat_points: { hp: 32, attack: 0, defense: 24, sp_attack: 4, sp_defense: 6, speed: 0 },
    moves: ["Matcha Gotcha", "Rage Powder", "Life Dew", "Protect"],
    notes: "Redirection and sustain.",
    build_status: "training",
    vp_spent: 0,
    created_at: now,
    updated_at: now,
  },
];

export const DEMO_TEAMS: Team[] = [
  {
    id: "demo-balance",
    user_id: "demo",
    name: "Demo Balance",
    format: "doubles",
    pokemon_ids: DEMO_ROSTER.map((p) => p.id),
    mega_pokemon_id: null,
    mega_form_pokemon_id: null,
    notes: "Balanced demo squad for exploring draft, cheatsheet, and match-log flows.",
    archetype_tag: "balance",
    created_at: now,
    updated_at: now,
  },
];

export const DEMO_MATCHUPS: Matchup[] = [
  {
    id: "demo-match-1",
    user_id: "demo",
    my_team_id: "demo-balance",
    opponent_team_data: [
      { name: "Rotom-Wash" },
      { name: "Kingambit" },
      { name: "Arcanine-Hisui" },
      { name: "Dragonite" },
      { name: "Tinkaton" },
      { name: "Garchomp" },
    ],
    lead_pair: ["Incineroar", "Garchomp"],
    outcome: "win",
    notes: "Protected Garchomp turn one, pivoted Incineroar into Kingambit pressure.",
    played_at: now,
    format: "bo3",
    tags: ["balance", "pivot"],
    close_type: "close",
    mvp_pokemon: "Kingambit",
    my_team_actual: null,
    replay_url: "https://example.com/replay/demo",
    opponent_name: "Demo Rival",
    opponent_rating: 1680,
    event_name: "Weekly Ladder Night",
    round_label: "Round 3",
    game_number: 2,
    set_id: null,
    opponent_lead_pair: ["Rotom-Wash", "Arcanine-Hisui"],
    opponent_selected_four: ["Rotom-Wash", "Arcanine-Hisui", "Kingambit", "Dragonite"],
    my_selected_four: ["Incineroar", "Garchomp", "Kingambit", "Sinistcha"],
    loss_reason: null,
    win_condition: "Preserve Kingambit for late Sucker Punch pressure.",
    key_turn: "Turn 4 Parting Shot created the free Kingambit switch.",
    adjustment_note: "Respect Will-O-Wisp from Rotom-Wash earlier.",
  },
];

export const DEMO_MATCHUP_STATS: MatchupStats = {
  overall: { label: "Overall", wins: 1, losses: 0, total: 1, win_rate: 100 },
  by_team: [{ label: "Demo Balance", wins: 1, losses: 0, total: 1, win_rate: 100 }],
  by_opponent_pokemon: [
    { label: "Rotom-Wash", wins: 1, losses: 0, total: 1, win_rate: 100 },
    { label: "Kingambit", wins: 1, losses: 0, total: 1, win_rate: 100 },
  ],
  by_format: [{ label: "bo3", wins: 1, losses: 0, total: 1, win_rate: 100 }],
  by_tag: [{ label: "balance", wins: 1, losses: 0, total: 1, win_rate: 100 }],
};

export const DEMO_CHEATSHEET: CheatsheetResponse = {
  team_id: "demo-balance",
  team_name: "Demo Balance",
  team_title: "Pivot Balance",
  archetype: "Balance",
  format: "doubles",
  roster: [
    {
      name: "Incineroar",
      types: ["fire", "dark"],
      item: null,
      ability: "Intimidate",
      nature: "Careful",
      stat_points: "28 HP / 14 Def / 14 SpD / 6 Spe / 4 Atk",
      moves: [
        { name: "Fake Out", category: "utility" },
        { name: "Flare Blitz", category: "stab" },
        { name: "Parting Shot", category: "utility" },
        { name: "Knock Off", category: "utility" },
      ],
      is_mega: false,
    },
    {
      name: "Kingambit",
      types: ["dark", "steel"],
      item: null,
      ability: "Defiant",
      nature: "Adamant",
      stat_points: "32 Atk / 20 HP / 8 Def / 6 SpD",
      moves: [
        { name: "Kowtow Cleave", category: "stab" },
        { name: "Iron Head", category: "stab" },
        { name: "Sucker Punch", category: "priority" },
        { name: "Protect", category: "utility" },
      ],
      is_mega: false,
    },
  ],
  speed_tiers: [
    { pokemon: "Garchomp", speed: 169, note: "Jolly max investment" },
    { pokemon: "Incineroar", speed: 86, note: "bulk pivot" },
  ],
  game_plan: [
    { step: 1, title: "Lead safely", description: "Use Fake Out plus Protect to scout speed control." },
    { step: 2, title: "Trade positioning", description: "Cycle Intimidate and Parting Shot into Kingambit." },
    { step: 3, title: "Close with priority", description: "Keep Kingambit healthy enough to force endgame KOs." },
  ],
  key_rules: [
    { title: "Preserve Kingambit", description: "It is the cleanest late-game answer into weakened teams." },
    { title: "Do not burn Garchomp tempo", description: "Protect if Rotom-Wash can threaten Will-O-Wisp." },
  ],
  lead_matchups: [
    {
      archetype: "Bulky pivot",
      example: "Rotom-Wash + Arcanine-Hisui",
      threat_tier: "COMMON",
      lead: ["Incineroar", "Garchomp"],
      back: ["Kingambit", "Sinistcha"],
      note: "Fake Out plus Protect covers most turn-one pivots.",
    },
  ],
  weaknesses: [
    { title: "Fast special pressure", description: "Avoid exposing Garchomp before speed order is clear." },
  ],
  cached: true,
  estimated_cost_usd: 0,
  ai_disclaimer: "Demo data only. Sign in to generate and save your own cheatsheets.",
  generated_at: now,
};

export const DEMO_DRAFT_RESULT: DraftResponse = {
  analysis: {
    summary:
      "The opponent pressures with Rotom-Wash pivots and Kingambit endgame. Your safest line is to bring Intimidate, redirection, Ground pressure, and your own Kingambit closer.",
    bring_four: [
      { pokemon: "Incineroar", role: "pivot", reason: "Fake Out and Intimidate buy the first turn." },
      { pokemon: "Garchomp", role: "damage", reason: "Ground pressure forces Arcanine-Hisui and Kingambit to respect Protect." },
      { pokemon: "Kingambit", role: "closer", reason: "Strong into late-game trades once Rotom-Wash is chipped." },
      { pokemon: "Sinistcha", role: "support", reason: "Redirection protects Garchomp or Kingambit from tempo swings." },
    ],
    lead_pair: ["Incineroar", "Garchomp"],
    opponent_likely_bring_four: ["Rotom-Wash", "Arcanine-Hisui", "Kingambit", "Dragonite"],
    opponent_likely_leads: [["Rotom-Wash", "Arcanine-Hisui"], ["Arcanine-Hisui", "Dragonite"]],
    lead_matchups: [
      {
        my_lead: ["Incineroar", "Garchomp"],
        opponent_lead: ["Rotom-Wash", "Arcanine-Hisui"],
        note: "Favored if Garchomp protects while Incineroar scouts Will-O-Wisp or Rock Slide.",
        favorability: "favored",
      },
    ],
    threats: [
      {
        pokemon: "Rotom-Wash",
        threat_level: "high",
        reason: "Will-O-Wisp can cut Garchomp and Kingambit damage.",
        likely_set: "Bulky pivot with Will-O-Wisp",
        key_moves: ["Hydro Pump", "Will-O-Wisp", "Volt Switch"],
      },
    ],
    damage_calcs: [
      {
        attacker: "Garchomp",
        move: "Earthquake",
        defender: "Kingambit",
        estimated_damage: "70.0-84.0%",
        note: "Spread damage in doubles; chip first for KO range.",
      },
    ],
    game_plan:
      "Turn one, Fake Out the biggest disruption slot and Protect Garchomp if Rotom-Wash is in. Midgame, pivot Incineroar into Sinistcha to preserve Kingambit for the endgame.",
    warnings: [],
  },
  cached: true,
  estimated_cost_usd: 0,
  ai_disclaimer: "Demo draft result. Sign in to run live AI analysis.",
};

export const DEMO_TEAM_BENCHMARK: TeamBenchmarkResponse = {
  team_id: "demo-balance",
  team_name: "Demo Balance",
  format: "doubles",
  generated_at: now,
  meta_snapshot_date: "2026-05-07",
  threat_count: 6,
  defensive_dangers: [
    {
      pokemon_name: "Garchomp",
      pokemon_id: 445,
      usage_percent: 31.5,
      move: "Earthquake",
      damage_text: "62.0-74.0%",
      damage_percent: 74,
      target_name: "Kingambit",
      severity: "danger",
    },
    {
      pokemon_name: "Rotom",
      pokemon_id: 479,
      usage_percent: 28.4,
      move: "Hydro Pump",
      damage_text: "54.0-66.0%",
      damage_percent: 66,
      target_name: "Incineroar",
      severity: "chip",
    },
  ],
  offensive_answers: [
    {
      pokemon_name: "Kingambit",
      pokemon_id: 983,
      usage_percent: 42.1,
      answer_pokemon: "Garchomp",
      move: "Earthquake",
      damage_text: "70.0-84.0%",
      damage_percent: 84,
      reliability: "strong",
    },
    {
      pokemon_name: "Dragonite",
      pokemon_id: 149,
      usage_percent: 28.2,
      answer_pokemon: "Kingambit",
      move: "Kowtow Cleave",
      damage_text: "42.0-50.0%",
      damage_percent: 50,
      reliability: "chip",
    },
  ],
  speed_issues: [
    {
      pokemon_name: "Dragapult",
      pokemon_id: 887,
      usage_percent: 18.6,
      threat_speed: 213,
      fastest_team_member: "Garchomp",
      fastest_team_speed: 169,
      note: "Threat outspeeds your fastest saved build before speed control.",
    },
  ],
  coverage_gaps: [
    {
      pokemon_name: "Rotom",
      pokemon_id: 479,
      usage_percent: 28.4,
      best_damage_percent: 38,
      best_answer: "Garchomp",
      note: "No saved move reaches 45% max damage in the deterministic calc.",
    },
  ],
};

export const TEAM_TEMPLATES = [
  { name: "Balanced", archetype: "balance", pokemon: ["Incineroar", "Garchomp", "Kingambit", "Sinistcha"] },
  { name: "Rain", archetype: "rain", pokemon: ["Pelipper", "Barraskewda", "Kingambit", "Amoonguss"] },
  { name: "Sun", archetype: "sun", pokemon: ["Torkoal", "Lilligant-Hisui", "Dragonite", "Incineroar"] },
  { name: "Trick Room", archetype: "trick-room", pokemon: ["Torkoal", "Sinistcha", "Kingambit", "Tinkaton"] },
  { name: "Hyper Offense", archetype: "hyper-offense", pokemon: ["Garchomp", "Dragonite", "Glimmora", "Kingambit"] },
];
