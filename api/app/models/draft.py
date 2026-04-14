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


class BringRecommendation(BaseModel):
    pokemon: str
    role: str
    reason: str


class DamageCalc(BaseModel):
    attacker: str
    move: str
    defender: str
    estimated_damage: str = Field(description="e.g. '65-78%' or 'OHKO'")
    note: str = ""


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


AI_DISCLAIMER = (
    "AI-generated analysis for guidance only. Accuracy is not guaranteed. "
    "Always verify suggestions against your own game knowledge and experience."
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
