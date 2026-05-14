import { POKEMON_TYPES, type Pokemon, type PokemonType } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import {
  formatType,
  getDefensiveMultiplier,
  getPokemonWeaknesses,
  getSuperEffectiveAttackTypes,
  getTypeEffectiveness,
} from "@/lib/type-effectiveness";

export const ASSISTANT_ARCHETYPES = [
  { id: "trick-room", label: "Trick Room" },
  { id: "rain", label: "Rain" },
  { id: "sun", label: "Sun" },
  { id: "tailwind", label: "Tailwind" },
  { id: "balance", label: "Balance" },
  { id: "hyper-offense", label: "Hyper Offense" },
] as const;

export type AssistantArchetype = (typeof ASSISTANT_ARCHETYPES)[number]["id"];
export type AssistantMode = "archetype" | "gap";
export type RecommendationScoreLabel = "Excellent" | "Good" | "Niche";
export type RecommendationRosterStatus = "built" | "training" | "wishlist" | "unowned";

export interface SelectedTeamMember {
  entry: UserPokemon;
  pokemon: Pokemon;
}

export interface BuilderRecommendation {
  id: string;
  laneId: string;
  pokemon: Pokemon;
  rosterEntry: UserPokemon | null;
  rosterStatus: RecommendationRosterStatus;
  isOnTeam: boolean;
  score: number;
  scoreLabel: RecommendationScoreLabel;
  reasons: string[];
}

export interface BuilderRecommendationLane {
  id: string;
  label: string;
  recommendations: BuilderRecommendation[];
}

export interface BuildRecommendationInput {
  mode: AssistantMode;
  archetype: AssistantArchetype;
  targetType: PokemonType;
  pokemon: Pokemon[];
  roster: UserPokemon[];
  selectedMembers: SelectedTeamMember[];
}

interface CandidateContext {
  pokemon: Pokemon;
  rosterEntry: UserPokemon | null;
  rosterStatus: RecommendationRosterStatus;
  isOnTeam: boolean;
  moveNames: Map<string, string>;
  abilities: Map<string, string>;
}

interface LaneScore {
  score: number;
  reasons: string[];
}

interface LaneDefinition {
  id: string;
  label: string;
  score: (candidate: CandidateContext) => LaneScore;
  minScore: number;
  selectedFillScore?: number;
}

const MAX_RECOMMENDATIONS_PER_LANE = 4;

const STATUS_RANK: Record<RecommendationRosterStatus, number> = {
  built: 4,
  training: 3,
  wishlist: 2,
  unowned: 1,
};

const COVERAGE_MOVES_BY_TYPE: Record<PokemonType, string[]> = {
  normal: [
    "boomburst",
    "body slam",
    "double-edge",
    "extreme speed",
    "facade",
    "hyper voice",
    "return",
  ],
  fire: [
    "blast burn",
    "blaze kick",
    "eruption",
    "fire blast",
    "fire punch",
    "flamethrower",
    "flare blitz",
    "heat wave",
    "magma storm",
    "overheat",
    "sacred fire",
  ],
  water: [
    "aqua jet",
    "aqua tail",
    "hydro pump",
    "liquidation",
    "muddy water",
    "scald",
    "sparkling aria",
    "surf",
    "surging strikes",
    "waterfall",
    "wave crash",
  ],
  electric: [
    "discharge",
    "thunder",
    "thunder punch",
    "thunderbolt",
    "volt switch",
    "wild charge",
    "zap cannon",
    "zing zap",
  ],
  grass: [
    "energy ball",
    "flower trick",
    "giga drain",
    "grass knot",
    "grassy glide",
    "leaf blade",
    "leaf storm",
    "power whip",
    "seed bomb",
    "solar beam",
    "wood hammer",
  ],
  ice: [
    "blizzard",
    "freeze-dry",
    "ice beam",
    "ice fang",
    "ice punch",
    "ice shard",
    "icicle crash",
    "icicle spear",
    "icy wind",
    "triple axel",
  ],
  fighting: [
    "aura sphere",
    "body press",
    "brick break",
    "close combat",
    "drain punch",
    "focus blast",
    "high jump kick",
    "mach punch",
    "sacred sword",
    "superpower",
  ],
  poison: [
    "clear smog",
    "cross poison",
    "gunk shot",
    "poison jab",
    "sludge bomb",
    "sludge wave",
    "venoshock",
  ],
  ground: [
    "bonemerang",
    "bulldoze",
    "drill run",
    "earth power",
    "earthquake",
    "high horsepower",
    "stomping tantrum",
  ],
  flying: [
    "acrobatics",
    "air slash",
    "brave bird",
    "dual wingbeat",
    "hurricane",
    "oblivion wing",
    "peck",
  ],
  psychic: [
    "expanding force",
    "future sight",
    "psyblade",
    "psychic",
    "psyshock",
    "psystrike",
    "stored power",
    "zen headbutt",
  ],
  bug: [
    "bug buzz",
    "first impression",
    "leech life",
    "lunge",
    "megahorn",
    "pollen puff",
    "u-turn",
    "x-scissor",
  ],
  rock: [
    "accelerock",
    "diamond storm",
    "head smash",
    "meteor beam",
    "power gem",
    "rock blast",
    "rock slide",
    "stone edge",
  ],
  ghost: [
    "astral barrage",
    "hex",
    "last respects",
    "phantom force",
    "poltergeist",
    "shadow ball",
    "shadow claw",
    "shadow sneak",
  ],
  dragon: [
    "breaking swipe",
    "draco meteor",
    "dragon claw",
    "dragon darts",
    "dragon pulse",
    "dragon rush",
    "outrage",
    "scale shot",
  ],
  dark: [
    "crunch",
    "dark pulse",
    "foul play",
    "knock off",
    "lash out",
    "night slash",
    "sucker punch",
    "wicked blow",
  ],
  steel: [
    "bullet punch",
    "flash cannon",
    "gyro ball",
    "heavy slam",
    "iron head",
    "iron tail",
    "make it rain",
    "meteor mash",
    "smart strike",
    "steel beam",
  ],
  fairy: [
    "dazzling gleam",
    "disarming voice",
    "fleur cannon",
    "moonblast",
    "play rough",
    "spirit break",
    "strange steam",
  ],
};

const MOVE_GROUPS = {
  trickRoom: ["trick room"],
  trickRoomCounter: ["taunt", "imprison", "encore", "haze", "roar", "whirlwind"],
  tailwind: ["tailwind"],
  speedControl: ["tailwind", "icy wind", "thunder wave", "trick room", "electroweb"],
  fakeOut: ["fake out"],
  redirection: ["follow me", "rage powder", "ally switch"],
  support: ["helping hand", "wide guard", "quick guard", "coaching", "snarl", "will-o-wisp"],
  priority: [
    "aqua jet",
    "bullet punch",
    "extreme speed",
    "first impression",
    "grassy glide",
    "ice shard",
    "mach punch",
    "shadow sneak",
    "sucker punch",
  ],
  setup: ["belly drum", "bulk up", "calm mind", "dragon dance", "nasty plot", "quiver dance", "swords dance"],
  pivot: ["baton pass", "flip turn", "parting shot", "u-turn", "volt switch"],
  spread: [
    "blizzard",
    "dazzling gleam",
    "discharge",
    "earthquake",
    "heat wave",
    "hyper voice",
    "make it rain",
    "muddy water",
    "rock slide",
    "surf",
  ],
  recovery: ["moonlight", "recover", "roost", "slack off", "soft-boiled", "strength sap", "synthesis"],
  screens: ["aurora veil", "light screen", "reflect"],
  rainSet: ["rain dance"],
  sunSet: ["sunny day"],
};

const ABILITY_GROUPS = {
  rainSetter: ["drizzle"],
  rainAbuser: ["dry skin", "hydration", "rain dish", "swift swim"],
  sunSetter: ["drought"],
  sunAbuser: ["chlorophyll", "flower gift", "harvest", "protosynthesis", "solar power"],
  speedSupport: ["prankster"],
  balance: ["friend guard", "intimidate", "magic guard", "regenerator", "thick fat"],
  offense: ["adaptability", "beast boost", "moxie", "protean", "sheer force", "tinted lens", "tough claws"],
};

const TYPE_IMMUNITY_ABILITIES: Partial<Record<PokemonType, string[]>> = {
  electric: ["lightning rod", "motor drive", "volt absorb"],
  fire: ["flash fire", "well-baked body"],
  grass: ["sap sipper"],
  ground: ["earth eater", "levitate"],
  water: ["dry skin", "storm drain", "water absorb"],
};

export function getBuilderRecommendations(
  input: BuildRecommendationInput
): BuilderRecommendationLane[] {
  const candidates = buildCandidates(input);
  const teamWeaknessCounts = getTeamWeaknessCounts(input.selectedMembers);

  if (input.mode === "gap") {
    return buildTypeGapLanes(input, candidates, teamWeaknessCounts);
  }

  return buildArchetypeLanes(input, candidates, teamWeaknessCounts);
}

function buildCandidates(input: BuildRecommendationInput): CandidateContext[] {
  const selectedEntryIds = new Set(input.selectedMembers.map(({ entry }) => entry.id));
  const selectedPokemonIds = new Set(input.selectedMembers.map(({ pokemon }) => pokemon.id));
  const rosterByPokemon = new Map<number, UserPokemon[]>();

  for (const entry of input.roster) {
    const current = rosterByPokemon.get(entry.pokemon_id) ?? [];
    current.push(entry);
    rosterByPokemon.set(entry.pokemon_id, current);
  }

  const championPokemon = input.pokemon
    .filter((pokemon) => pokemon.champions_eligible)
    .sort((a, b) => a.name.localeCompare(b.name));

  return championPokemon.map((pokemon) => {
    const rosterEntry = pickRosterEntry(rosterByPokemon.get(pokemon.id) ?? [], selectedEntryIds);
    const moveNames = new Map<string, string>();
    for (const move of [...pokemon.movepool, ...(rosterEntry?.moves ?? [])]) {
      moveNames.set(normalizeName(move), move);
    }

    const abilities = new Map<string, string>();
    for (const ability of [...pokemon.abilities, rosterEntry?.ability].filter(Boolean)) {
      abilities.set(normalizeName(ability as string), ability as string);
    }

    return {
      pokemon,
      rosterEntry,
      rosterStatus: getRosterStatus(rosterEntry),
      isOnTeam: selectedPokemonIds.has(pokemon.id),
      moveNames,
      abilities,
    };
  });
}

function pickRosterEntry(entries: UserPokemon[], selectedEntryIds: Set<string>): UserPokemon | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => {
    const selectedDiff = Number(selectedEntryIds.has(b.id)) - Number(selectedEntryIds.has(a.id));
    if (selectedDiff !== 0) return selectedDiff;
    const statusDiff = STATUS_RANK[getRosterStatus(b)] - STATUS_RANK[getRosterStatus(a)];
    if (statusDiff !== 0) return statusDiff;
    return (b.moves?.length ?? 0) - (a.moves?.length ?? 0);
  })[0];
}

function getRosterStatus(entry: UserPokemon | null): RecommendationRosterStatus {
  if (!entry) return "unowned";
  return entry.build_status ?? "training";
}

function buildArchetypeLanes(
  input: BuildRecommendationInput,
  candidates: CandidateContext[],
  teamWeaknessCounts: Partial<Record<PokemonType, number>>
): BuilderRecommendationLane[] {
  const definitions = getArchetypeLaneDefinitions(input.archetype);
  return definitions.map((definition) =>
    buildLane(definition, candidates, input.selectedMembers, teamWeaknessCounts)
  );
}

function buildTypeGapLanes(
  input: BuildRecommendationInput,
  candidates: CandidateContext[],
  teamWeaknessCounts: Partial<Record<PokemonType, number>>
): BuilderRecommendationLane[] {
  const targetType = input.targetType;
  const superEffectiveTypes = getSuperEffectiveAttackTypes(targetType);
  const selectedPokemonIds = new Set(input.selectedMembers.map(({ pokemon }) => pokemon.id));

  const definitions: LaneDefinition[] = [
    {
      id: "switch-ins",
      label: "Switch-ins",
      minScore: 42,
      selectedFillScore: 44,
      score: (candidate) => scoreSwitchIn(candidate, targetType),
    },
    {
      id: "super-effective-pressure",
      label: "Super-effective pressure",
      minScore: 42,
      selectedFillScore: 44,
      score: (candidate) => scoreStabPressure(candidate, targetType),
    },
    {
      id: "coverage-moves",
      label: "Coverage moves",
      minScore: 38,
      selectedFillScore: 38,
      score: (candidate) => scoreCoverageMoves(candidate, targetType, superEffectiveTypes),
    },
    {
      id: "existing-team-options",
      label: "Existing team options",
      minScore: 26,
      score: (candidate) =>
        selectedPokemonIds.has(candidate.pokemon.id)
          ? scoreExistingTeamOption(candidate, targetType, superEffectiveTypes)
          : { score: 0, reasons: [] },
    },
  ];

  return definitions.map((definition) =>
    buildLane(definition, candidates, input.selectedMembers, teamWeaknessCounts)
  );
}

function buildLane(
  definition: LaneDefinition,
  candidates: CandidateContext[],
  selectedMembers: SelectedTeamMember[],
  teamWeaknessCounts: Partial<Record<PokemonType, number>>
): BuilderRecommendationLane {
  const selectedPokemonIds = new Set(selectedMembers.map(({ pokemon }) => pokemon.id));
  const roleAlreadyFilled =
    definition.selectedFillScore !== undefined &&
    candidates.some(
      (candidate) =>
        selectedPokemonIds.has(candidate.pokemon.id) &&
        definition.score(candidate).score >= definition.selectedFillScore!
    );

  const recommendations = candidates
    .map((candidate) => {
      const laneScore = definition.score(candidate);
      return finalizeRecommendation(candidate, definition, laneScore, teamWeaknessCounts, roleAlreadyFilled);
    })
    .filter((recommendation): recommendation is BuilderRecommendation => recommendation !== null)
    .sort(sortRecommendations)
    .slice(0, MAX_RECOMMENDATIONS_PER_LANE);

  return {
    id: definition.id,
    label: definition.label,
    recommendations,
  };
}

function finalizeRecommendation(
  candidate: CandidateContext,
  definition: LaneDefinition,
  laneScore: LaneScore,
  teamWeaknessCounts: Partial<Record<PokemonType, number>>,
  roleAlreadyFilled: boolean
): BuilderRecommendation | null {
  const reasons = dedupeReasons(laneScore.reasons);
  if (reasons.length === 0) return null;

  let score = laneScore.score + getOwnershipBonus(candidate.rosterStatus);
  score -= getTeamFitPenalty(candidate, teamWeaknessCounts);

  if (roleAlreadyFilled && !candidate.isOnTeam && definition.id !== "existing-team-options") {
    score -= 8;
  }

  if (candidate.isOnTeam && definition.id !== "existing-team-options") {
    score -= 6;
  }

  if (score < definition.minScore) return null;

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    id: `${definition.id}:${candidate.pokemon.id}:${candidate.rosterEntry?.id ?? "dex"}`,
    laneId: definition.id,
    pokemon: candidate.pokemon,
    rosterEntry: candidate.rosterEntry,
    rosterStatus: candidate.rosterStatus,
    isOnTeam: candidate.isOnTeam,
    score: boundedScore,
    scoreLabel: getScoreLabel(boundedScore),
    reasons: reasons.slice(0, 3),
  };
}

function getArchetypeLaneDefinitions(archetype: AssistantArchetype): LaneDefinition[] {
  switch (archetype) {
    case "trick-room":
      return [
        {
          id: "setters",
          label: "Setters",
          minScore: 42,
          selectedFillScore: 48,
          score: scoreTrickRoomSetter,
        },
        {
          id: "abusers",
          label: "Abusers",
          minScore: 42,
          selectedFillScore: 46,
          score: scoreTrickRoomAbuser,
        },
        {
          id: "enablers",
          label: "Enablers",
          minScore: 36,
          selectedFillScore: 40,
          score: scoreDisruptionSupport,
        },
        {
          id: "counterplay",
          label: "Counterplay",
          minScore: 34,
          selectedFillScore: 36,
          score: scoreTrickRoomCounterplay,
        },
      ];
    case "rain":
      return [
        { id: "setters", label: "Setters", minScore: 38, selectedFillScore: 45, score: scoreRainSetter },
        { id: "abusers", label: "Abusers", minScore: 40, selectedFillScore: 45, score: scoreRainAbuser },
        { id: "enablers", label: "Enablers", minScore: 34, selectedFillScore: 38, score: scoreDisruptionSupport },
        { id: "counterplay", label: "Counterplay", minScore: 34, selectedFillScore: 36, score: scoreRainCounterplay },
      ];
    case "sun":
      return [
        { id: "setters", label: "Setters", minScore: 38, selectedFillScore: 45, score: scoreSunSetter },
        { id: "abusers", label: "Abusers", minScore: 40, selectedFillScore: 45, score: scoreSunAbuser },
        { id: "enablers", label: "Enablers", minScore: 34, selectedFillScore: 38, score: scoreDisruptionSupport },
        { id: "counterplay", label: "Counterplay", minScore: 34, selectedFillScore: 36, score: scoreSunCounterplay },
      ];
    case "tailwind":
      return [
        { id: "setters", label: "Setters", minScore: 40, selectedFillScore: 45, score: scoreTailwindSetter },
        { id: "abusers", label: "Abusers", minScore: 40, selectedFillScore: 44, score: scoreTailwindAbuser },
        { id: "enablers", label: "Enablers", minScore: 34, selectedFillScore: 38, score: scoreDisruptionSupport },
        { id: "counterplay", label: "Counterplay", minScore: 34, selectedFillScore: 36, score: scoreSpeedCounterplay },
      ];
    case "balance":
      return [
        { id: "anchors", label: "Anchors", minScore: 38, selectedFillScore: 42, score: scoreBalanceAnchor },
        { id: "breakers", label: "Breakers", minScore: 38, selectedFillScore: 42, score: scoreBalancedBreaker },
        { id: "glue", label: "Glue", minScore: 34, selectedFillScore: 38, score: scoreDisruptionSupport },
        { id: "counterplay", label: "Counterplay", minScore: 34, selectedFillScore: 36, score: scoreGenericCounterplay },
      ];
    case "hyper-offense":
      return [
        { id: "sweepers", label: "Sweepers", minScore: 42, selectedFillScore: 46, score: scoreHyperOffenseSweeper },
        { id: "pressure", label: "Pressure", minScore: 38, selectedFillScore: 42, score: scoreImmediatePressure },
        { id: "enablers", label: "Enablers", minScore: 34, selectedFillScore: 38, score: scoreOffenseEnabler },
        { id: "counterplay", label: "Counterplay", minScore: 34, selectedFillScore: 36, score: scoreGenericCounterplay },
      ];
  }
}

function scoreTrickRoomSetter(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasMove(candidate, MOVE_GROUPS.trickRoom)) {
    score += 52;
    reasons.push("Learns Trick Room");
  }
  score += addBulkScore(candidate, reasons);
  if (candidate.pokemon.base_stats.speed <= 80) {
    score += 8;
    reasons.push(`Base ${candidate.pokemon.base_stats.speed} Speed`);
  }
  score += addSupportMoveScore(candidate, reasons, 8);

  return { score, reasons };
}

function scoreTrickRoomAbuser(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const speed = candidate.pokemon.base_stats.speed;
  const bestAttack = getBestAttackStat(candidate.pokemon);

  if (speed <= 50) {
    score += 34;
    reasons.push(`Base ${speed} Speed`);
  } else if (speed <= 70) {
    score += 22;
    reasons.push(`Base ${speed} Speed`);
  }

  if (bestAttack >= 125) {
    score += 24;
    reasons.push(getPowerReason(candidate.pokemon));
  } else if (bestAttack >= 105) {
    score += 16;
    reasons.push(getPowerReason(candidate.pokemon));
  }

  if (hasMove(candidate, MOVE_GROUPS.spread)) {
    score += 10;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.spread)}`);
  }
  if (hasAbility(candidate, ABILITY_GROUPS.offense)) {
    score += 8;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.offense));
  }

  return { score, reasons };
}

function scoreTrickRoomCounterplay(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  const counterMove = findMove(candidate, MOVE_GROUPS.trickRoomCounter);
  if (counterMove) {
    score += counterMove.toLowerCase() === "imprison" ? 42 : 34;
    reasons.push(`Learns ${counterMove}`);
  }
  if (hasMove(candidate, MOVE_GROUPS.fakeOut)) {
    score += 12;
    reasons.push("Learns Fake Out");
  }
  if (candidate.pokemon.base_stats.speed >= 100) {
    score += 8;
    reasons.push(`Base ${candidate.pokemon.base_stats.speed} Speed`);
  }

  return { score, reasons };
}

function scoreRainSetter(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasAbility(candidate, ABILITY_GROUPS.rainSetter)) {
    score += 56;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.rainSetter));
  }
  if (hasMove(candidate, MOVE_GROUPS.rainSet)) {
    score += 38;
    reasons.push("Learns Rain Dance");
  }
  score += addSupportMoveScore(candidate, reasons, 6);
  score += addBulkScore(candidate, reasons, 0.5);

  return { score, reasons };
}

function scoreRainAbuser(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasAbility(candidate, ABILITY_GROUPS.rainAbuser)) {
    score += 34;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.rainAbuser));
  }
  if (candidate.pokemon.types.includes("water")) {
    score += 20;
    reasons.push("Water STAB");
  }
  const rainMoves = findMove(candidate, ["thunder", "hurricane", "weather ball"]);
  if (rainMoves) {
    score += 12;
    reasons.push(`Learns ${rainMoves}`);
  }
  score += addPowerScore(candidate, reasons, 12);

  return { score, reasons };
}

function scoreRainCounterplay(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const ability = findAbility(candidate, ["cloud nine", "storm drain", "water absorb", "dry skin"]);
  if (ability) {
    score += 34;
    reasons.push(ability);
  }
  if (hasMove(candidate, MOVE_GROUPS.sunSet)) {
    score += 28;
    reasons.push("Learns Sunny Day");
  }
  if (getDefensiveMultiplier("water", candidate.pokemon.types) <= 0.5) {
    score += 16;
    reasons.push("Resists Water");
  }
  return { score, reasons };
}

function scoreSunSetter(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasAbility(candidate, ABILITY_GROUPS.sunSetter)) {
    score += 56;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.sunSetter));
  }
  if (hasMove(candidate, MOVE_GROUPS.sunSet)) {
    score += 38;
    reasons.push("Learns Sunny Day");
  }
  score += addSupportMoveScore(candidate, reasons, 6);
  score += addBulkScore(candidate, reasons, 0.5);

  return { score, reasons };
}

function scoreSunAbuser(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasAbility(candidate, ABILITY_GROUPS.sunAbuser)) {
    score += 34;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.sunAbuser));
  }
  if (candidate.pokemon.types.includes("fire") || candidate.pokemon.types.includes("grass")) {
    score += 18;
    reasons.push(candidate.pokemon.types.includes("fire") ? "Fire STAB" : "Grass STAB");
  }
  const sunMove = findMove(candidate, ["solar beam", "growth", "weather ball"]);
  if (sunMove) {
    score += 12;
    reasons.push(`Learns ${sunMove}`);
  }
  score += addPowerScore(candidate, reasons, 12);

  return { score, reasons };
}

function scoreSunCounterplay(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const ability = findAbility(candidate, ["cloud nine", "flash fire", "thick fat"]);
  if (ability) {
    score += 32;
    reasons.push(ability);
  }
  if (hasMove(candidate, MOVE_GROUPS.rainSet)) {
    score += 28;
    reasons.push("Learns Rain Dance");
  }
  if (getDefensiveMultiplier("fire", candidate.pokemon.types) <= 0.5) {
    score += 16;
    reasons.push("Resists Fire");
  }
  return { score, reasons };
}

function scoreTailwindSetter(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasMove(candidate, MOVE_GROUPS.tailwind)) {
    score += 48;
    reasons.push("Learns Tailwind");
  }
  if (hasAbility(candidate, ABILITY_GROUPS.speedSupport)) {
    score += 12;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.speedSupport));
  }
  if (candidate.pokemon.base_stats.speed >= 100) {
    score += 10;
    reasons.push(`Base ${candidate.pokemon.base_stats.speed} Speed`);
  }
  score += addSupportMoveScore(candidate, reasons, 6);

  return { score, reasons };
}

function scoreTailwindAbuser(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const speed = candidate.pokemon.base_stats.speed;

  if (speed >= 80 && speed <= 115) {
    score += 20;
    reasons.push(`Base ${speed} Speed`);
  } else if (speed > 115) {
    score += 14;
    reasons.push(`Base ${speed} Speed`);
  }

  score += addPowerScore(candidate, reasons, 24);
  if (hasMove(candidate, MOVE_GROUPS.spread)) {
    score += 10;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.spread)}`);
  }

  return { score, reasons };
}

function scoreSpeedCounterplay(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const speedMove = findMove(candidate, ["trick room", "icy wind", "thunder wave", "electroweb", "taunt"]);
  if (speedMove) {
    score += 34;
    reasons.push(`Learns ${speedMove}`);
  }
  if (hasMove(candidate, MOVE_GROUPS.priority)) {
    score += 14;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.priority)}`);
  }
  return { score, reasons };
}

function scoreBalanceAnchor(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = addBulkScore(candidate, reasons, 1.5);

  if (hasAbility(candidate, ABILITY_GROUPS.balance)) {
    score += 18;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.balance));
  }
  if (hasMove(candidate, MOVE_GROUPS.recovery)) {
    score += 12;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.recovery)}`);
  }
  const resistanceCount = POKEMON_TYPES.filter(
    (type) => getDefensiveMultiplier(type, candidate.pokemon.types) <= 0.5
  ).length;
  if (resistanceCount >= 6) {
    score += 12;
    reasons.push(`${resistanceCount} resistances`);
  }
  return { score, reasons };
}

function scoreBalancedBreaker(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = addPowerScore(candidate, reasons, 24);
  if (hasAbility(candidate, ABILITY_GROUPS.offense)) {
    score += 12;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.offense));
  }
  if (hasMove(candidate, MOVE_GROUPS.spread)) {
    score += 10;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.spread)}`);
  }
  if (hasMove(candidate, MOVE_GROUPS.setup)) {
    score += 8;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.setup)}`);
  }
  return { score, reasons };
}

function scoreHyperOffenseSweeper(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = addPowerScore(candidate, reasons, 30);
  const speed = candidate.pokemon.base_stats.speed;

  if (speed >= 100) {
    score += 22;
    reasons.push(`Base ${speed} Speed`);
  } else if (speed >= 80) {
    score += 12;
    reasons.push(`Base ${speed} Speed`);
  }
  if (hasMove(candidate, MOVE_GROUPS.setup)) {
    score += 14;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.setup)}`);
  }
  if (hasAbility(candidate, ABILITY_GROUPS.offense)) {
    score += 10;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.offense));
  }
  return { score, reasons };
}

function scoreImmediatePressure(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = addPowerScore(candidate, reasons, 26);
  if (hasMove(candidate, MOVE_GROUPS.priority)) {
    score += 14;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.priority)}`);
  }
  if (hasMove(candidate, MOVE_GROUPS.spread)) {
    score += 12;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.spread)}`);
  }
  if (candidate.pokemon.types.length >= 2) {
    score += 6;
    reasons.push("Dual STAB");
  }
  return { score, reasons };
}

function scoreOffenseEnabler(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const move = findMove(candidate, [...MOVE_GROUPS.screens, ...MOVE_GROUPS.speedControl, ...MOVE_GROUPS.fakeOut]);
  if (move) {
    score += 36;
    reasons.push(`Learns ${move}`);
  }
  if (hasAbility(candidate, ABILITY_GROUPS.speedSupport)) {
    score += 10;
    reasons.push(findAbility(candidate, ABILITY_GROUPS.speedSupport));
  }
  return { score, reasons };
}

function scoreDisruptionSupport(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  if (hasMove(candidate, MOVE_GROUPS.fakeOut)) {
    score += 24;
    reasons.push("Learns Fake Out");
  }
  const redirection = findMove(candidate, MOVE_GROUPS.redirection);
  if (redirection) {
    score += 20;
    reasons.push(`Learns ${redirection}`);
  }
  const support = findMove(candidate, MOVE_GROUPS.support);
  if (support) {
    score += 14;
    reasons.push(`Learns ${support}`);
  }
  if (hasAbility(candidate, ["intimidate", "friend guard", "prankster"])) {
    score += 12;
    reasons.push(findAbility(candidate, ["intimidate", "friend guard", "prankster"]));
  }

  return { score, reasons };
}

function scoreGenericCounterplay(candidate: CandidateContext): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const move = findMove(candidate, ["taunt", "encore", "haze", "will-o-wisp", "snarl", "fake out"]);
  if (move) {
    score += 32;
    reasons.push(`Learns ${move}`);
  }
  if (hasMove(candidate, MOVE_GROUPS.priority)) {
    score += 12;
    reasons.push(`Learns ${findMove(candidate, MOVE_GROUPS.priority)}`);
  }
  if (hasAbility(candidate, ["intimidate", "unaware", "prankster"])) {
    score += 12;
    reasons.push(findAbility(candidate, ["intimidate", "unaware", "prankster"]));
  }
  return { score, reasons };
}

function scoreSwitchIn(candidate: CandidateContext, targetType: PokemonType): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const immunityAbility = findAbility(candidate, TYPE_IMMUNITY_ABILITIES[targetType] ?? []);
  const defensiveMultiplier = getDefensiveMultiplier(targetType, candidate.pokemon.types);

  if (immunityAbility) {
    score += 54;
    reasons.push(`${immunityAbility} blocks ${formatType(targetType)}`);
  } else if (defensiveMultiplier === 0) {
    score += 56;
    reasons.push(`Immune to ${formatType(targetType)}`);
  } else if (defensiveMultiplier <= 0.25) {
    score += 50;
    reasons.push(`4x resists ${formatType(targetType)}`);
  } else if (defensiveMultiplier <= 0.5) {
    score += 42;
    reasons.push(`Resists ${formatType(targetType)}`);
  }

  score += addBulkScore(candidate, reasons, 0.8);
  return { score, reasons };
}

function scoreStabPressure(candidate: CandidateContext, targetType: PokemonType): LaneScore {
  const reasons: string[] = [];
  let score = 0;
  const superEffectiveStab = candidate.pokemon.types.filter(
    (type) => getTypeEffectiveness(type, targetType) >= 2
  );

  for (const attackType of superEffectiveStab) {
    score += 38;
    reasons.push(`${formatType(attackType)} STAB`);
  }
  if (superEffectiveStab.length > 0) {
    score += addPowerScore(candidate, reasons, 18);
  }
  return { score, reasons };
}

function scoreCoverageMoves(
  candidate: CandidateContext,
  targetType: PokemonType,
  superEffectiveTypes: PokemonType[]
): LaneScore {
  const reasons: string[] = [];
  let score = 0;

  for (const attackType of superEffectiveTypes) {
    const move = findMove(candidate, COVERAGE_MOVES_BY_TYPE[attackType]);
    if (move) {
      score += candidate.pokemon.types.includes(attackType) ? 20 : 30;
      reasons.push(`Learns ${move}`);
    }
  }
  if (score > 0 && targetType === "fairy") {
    score += 4;
  }
  return { score, reasons };
}

function scoreExistingTeamOption(
  candidate: CandidateContext,
  targetType: PokemonType,
  superEffectiveTypes: PokemonType[]
): LaneScore {
  const reasons = ["Already on team"];
  let score = 0;
  const defensiveMultiplier = getDefensiveMultiplier(targetType, candidate.pokemon.types);

  if (defensiveMultiplier === 0) {
    score += 34;
    reasons.push(`Immune to ${formatType(targetType)}`);
  } else if (defensiveMultiplier <= 0.5) {
    score += 28;
    reasons.push(`Resists ${formatType(targetType)}`);
  }

  const pressure = scoreStabPressure(candidate, targetType);
  if (pressure.score > 0) {
    score += 24;
    reasons.push(pressure.reasons[0]);
  }

  const coverage = scoreCoverageMoves(candidate, targetType, superEffectiveTypes);
  if (coverage.score > 0) {
    score += 18;
    reasons.push(coverage.reasons[0]);
  }

  return { score, reasons };
}

function addBulkScore(candidate: CandidateContext, reasons: string[], multiplier = 1): number {
  const { hp, defense, sp_defense: spDefense } = candidate.pokemon.base_stats;
  const averageBulk = Math.round((hp + defense + spDefense) / 3);

  if (averageBulk >= 110) {
    reasons.push("Excellent bulk");
    return Math.round(18 * multiplier);
  }
  if (averageBulk >= 90) {
    reasons.push("Solid bulk");
    return Math.round(10 * multiplier);
  }
  return 0;
}

function addPowerScore(candidate: CandidateContext, reasons: string[], maxScore: number): number {
  const bestAttack = getBestAttackStat(candidate.pokemon);
  if (bestAttack >= 130) {
    reasons.push(getPowerReason(candidate.pokemon));
    return maxScore;
  }
  if (bestAttack >= 110) {
    reasons.push(getPowerReason(candidate.pokemon));
    return Math.round(maxScore * 0.7);
  }
  if (bestAttack >= 95) {
    reasons.push(getPowerReason(candidate.pokemon));
    return Math.round(maxScore * 0.45);
  }
  return 0;
}

function addSupportMoveScore(candidate: CandidateContext, reasons: string[], maxScore: number): number {
  const supportMove = findMove(candidate, [
    ...MOVE_GROUPS.fakeOut,
    ...MOVE_GROUPS.redirection,
    ...MOVE_GROUPS.support,
  ]);
  if (!supportMove) return 0;
  reasons.push(`Learns ${supportMove}`);
  return maxScore;
}

function getBestAttackStat(pokemon: Pokemon): number {
  return Math.max(pokemon.base_stats.attack, pokemon.base_stats.sp_attack);
}

function getPowerReason(pokemon: Pokemon): string {
  return pokemon.base_stats.attack >= pokemon.base_stats.sp_attack ? "High Attack" : "High Sp. Atk";
}

function getOwnershipBonus(status: RecommendationRosterStatus): number {
  switch (status) {
    case "built":
      return 22;
    case "training":
      return 18;
    case "wishlist":
      return 12;
    case "unowned":
      return 0;
  }
}

function getTeamFitPenalty(
  candidate: CandidateContext,
  teamWeaknessCounts: Partial<Record<PokemonType, number>>
): number {
  return getPokemonWeaknesses(candidate.pokemon.types).reduce((penalty, weakness) => {
    const count = teamWeaknessCounts[weakness] ?? 0;
    return count >= 2 ? penalty + 6 : penalty;
  }, 0);
}

function getTeamWeaknessCounts(
  selectedMembers: SelectedTeamMember[]
): Partial<Record<PokemonType, number>> {
  const counts: Partial<Record<PokemonType, number>> = {};

  for (const { pokemon } of selectedMembers) {
    for (const attackType of POKEMON_TYPES) {
      if (getDefensiveMultiplier(attackType, pokemon.types) >= 2) {
        counts[attackType] = (counts[attackType] ?? 0) + 1;
      }
    }
  }

  return counts;
}

function sortRecommendations(a: BuilderRecommendation, b: BuilderRecommendation): number {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  const statusDiff = STATUS_RANK[b.rosterStatus] - STATUS_RANK[a.rosterStatus];
  if (statusDiff !== 0) return statusDiff;
  return a.pokemon.name.localeCompare(b.pokemon.name);
}

function getScoreLabel(score: number): RecommendationScoreLabel {
  if (score >= 78) return "Excellent";
  if (score >= 54) return "Good";
  return "Niche";
}

function hasMove(candidate: CandidateContext, moves: string[]): boolean {
  return moves.some((move) => candidate.moveNames.has(normalizeName(move)));
}

function findMove(candidate: CandidateContext, moves: string[]): string | null {
  const move = moves.find((name) => candidate.moveNames.has(normalizeName(name)));
  return move ? candidate.moveNames.get(normalizeName(move)) ?? formatMoveName(move) : null;
}

function hasAbility(candidate: CandidateContext, abilities: string[]): boolean {
  return abilities.some((ability) => candidate.abilities.has(normalizeName(ability)));
}

function findAbility(candidate: CandidateContext, abilities: string[]): string {
  const ability = abilities.find((name) => candidate.abilities.has(normalizeName(name)));
  return ability ? candidate.abilities.get(normalizeName(ability)) ?? formatMoveName(ability) : "";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function formatMoveName(move: string): string {
  return move
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dedupeReasons(reasons: string[]): string[] {
  return [...new Set(reasons.filter((reason) => reason.trim().length > 0))];
}
