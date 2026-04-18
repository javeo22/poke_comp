from datetime import datetime

from pydantic import BaseModel, Field


class DraftRequest(BaseModel):
    opponent_team: list[str] = Field(
        min_length=1,
        max_length=6,
        description="Opponent's 6 Pokemon names (Title Case)",
    )
    my_team_id: str = Field(description="UUID of user's saved team")


class ThreatInfo(BaseModel):
    pokemon: str
    threat_level: str = Field(description="high / medium / low")
    reason: str
    likely_set: str
    key_moves: list[str]
    # Set False by the verifier if pokemon/moves fail DB cross-check.
    # Frontend renders a warning icon when false.
    verified: bool = True
    verification_note: str | None = None


class BringRecommendation(BaseModel):
    pokemon: str
    role: str
    reason: str
    verified: bool = True
    verification_note: str | None = None


class DamageCalc(BaseModel):
    attacker: str
    move: str
    defender: str
    # Computed by the deterministic damage engine (services/damage_calc.py)
    # after the AI response is parsed. Empty when the calc was skipped (move
    # not found, immune, status move). Never AI-generated -- the AI proposes
    # the scenario, the engine computes the number.
    estimated_damage: str = Field(default="", description="e.g. '65-78%' or 'OHKO' (engine-computed)")
    # Free-form scenario context from the AI (e.g. "assumes Choice Specs,
    # 0 SpD investment"). Engine appends "[2x SE, STAB]" annotations.
    note: str = ""
    verified: bool = True
    verification_note: str | None = None


class DraftAnalysis(BaseModel):
    summary: str = Field(description="1-2 sentence overview of the matchup")
    bring_four: list[BringRecommendation] = Field(
        min_length=4,
        max_length=4,
        description="Recommended 4 Pokemon to bring",
    )
    lead_pair: list[str] = Field(
        min_length=2,
        max_length=2,
        description="Recommended lead pair",
    )
    threats: list[ThreatInfo] = Field(description="Key threats to watch for")
    damage_calcs: list[DamageCalc] = Field(
        description="Important damage calculations for the matchup",
    )
    game_plan: str = Field(
        description="Turn 1 plan and general strategy overview",
    )
    # Populated by `verify_draft_analysis` with human-readable issues the
    # AI's output could not fully substantiate against the DB. Empty list
    # means the analysis passed all cross-checks.
    warnings: list[str] = Field(default_factory=list)


AI_DISCLAIMER = (
    "AI-generated analysis powered by Claude (Anthropic). For guidance only -- "
    "accuracy is not guaranteed. Usage data sourced from Pikalytics and Smogon; "
    "meta may not reflect the latest game patch. Always verify suggestions "
    "against your own game knowledge."
)


class DraftResponse(BaseModel):
    analysis: DraftAnalysis
    cached: bool = False
    estimated_cost_usd: float = 0.0
    ai_disclaimer: str = AI_DISCLAIMER


class CachedAnalysis(BaseModel):
    id: str
    request_hash: str
    opponent_team: list[str]
    my_team: dict
    response_json: DraftAnalysis
    created_at: datetime
    expires_at: datetime | None = None
