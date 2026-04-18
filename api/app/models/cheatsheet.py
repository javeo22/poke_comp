from pydantic import BaseModel

# ── Pre-calculated (deterministic) ──────────────────────────────


class CheatsheetMove(BaseModel):
    name: str
    category: str  # "stab" | "utility" | "priority"


class RosterEntry(BaseModel):
    name: str
    types: list[str]
    item: str | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: str | None = None  # formatted: "32 SpA / 32 Spd / 2 HP"
    moves: list[CheatsheetMove]
    is_mega: bool = False


class SpeedTier(BaseModel):
    pokemon: str
    speed: int
    note: str | None = None  # e.g. "x Unburden"


# ── AI-generated ────────────────────────────────────────────────


class GamePlanStep(BaseModel):
    step: int
    title: str
    description: str


class KeyRule(BaseModel):
    title: str
    description: str


class LeadMatchup(BaseModel):
    archetype: str
    example: str
    threat_tier: str  # "S-TIER", "A-TIER", "MOST COMMON", "HIGHEST WR"
    lead: list[str]
    back: list[str]
    note: str


class Weakness(BaseModel):
    title: str
    description: str


# ── Combined response ───────────────────────────────────────────


AI_DISCLAIMER = (
    "AI-generated analysis powered by Claude (Anthropic). For guidance only -- "
    "accuracy is not guaranteed. Usage data sourced from Pikalytics and Smogon; "
    "meta may not reflect the latest game patch. Always verify suggestions "
    "against your own game knowledge."
)


class CheatsheetResponse(BaseModel):
    team_id: str
    team_name: str
    team_title: str  # AI-generated punchy title, e.g. "GENGAR OFFENSE"
    archetype: str  # AI-determined, e.g. "Trap / Offense"
    format: str
    roster: list[RosterEntry]
    speed_tiers: list[SpeedTier]
    game_plan: list[GamePlanStep]
    key_rules: list[KeyRule]
    lead_matchups: list[LeadMatchup]
    weaknesses: list[Weakness]
    cached: bool = False
    estimated_cost_usd: float = 0.0
    ai_disclaimer: str = AI_DISCLAIMER
    # True when team.updated_at > team_cheatsheets.updated_at -- the saved
    # AI analysis may reference moves/items that no longer match the team.
    # Only set on GET (saved fetch); fresh POST responses leave it False.
    is_stale: bool = False
    generated_at: str | None = None
