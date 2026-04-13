from datetime import datetime

from pydantic import BaseModel, Field


class OpponentPokemon(BaseModel):
    name: str
    """Title Case Pokemon name."""


class MatchupCreate(BaseModel):
    my_team_id: str = Field(description="UUID of saved team used")
    opponent_team_data: list[OpponentPokemon] = Field(
        min_length=1,
        max_length=6,
        description="Opponent's team (1-6 Pokemon)",
    )
    lead_pair: list[str] | None = Field(
        None,
        min_length=2,
        max_length=2,
        description="My lead pair Pokemon names",
    )
    outcome: str = Field(pattern=r"^(win|loss)$")
    notes: str | None = None


class MatchupUpdate(BaseModel):
    opponent_team_data: list[OpponentPokemon] | None = None
    lead_pair: list[str] | None = None
    outcome: str | None = Field(None, pattern=r"^(win|loss)$")
    notes: str | None = None


class MatchupResponse(BaseModel):
    id: str
    user_id: str
    my_team_id: str | None
    opponent_team_data: list[OpponentPokemon] | None
    lead_pair: list[str] | None
    outcome: str
    notes: str | None
    played_at: datetime


class MatchupList(BaseModel):
    data: list[MatchupResponse]
    count: int


class WinRateStat(BaseModel):
    label: str
    wins: int
    losses: int
    total: int
    win_rate: float = Field(description="Win rate as percentage 0-100")


class MatchupStats(BaseModel):
    overall: WinRateStat
    by_team: list[WinRateStat]
    by_opponent_pokemon: list[WinRateStat]
