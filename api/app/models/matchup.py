from datetime import datetime

from pydantic import BaseModel, Field, model_validator

# Enum-like validators via regex (pydantic v2 style). Migration
# 20260419100000 enforces the same set via CHECK constraints in Postgres.
FORMAT_PATTERN = r"^(ladder|bo1|bo3|tournament|friendly)$"
CLOSE_TYPE_PATTERN = r"^(blowout|close|comeback|standard)$"


class OpponentPokemon(BaseModel):
    name: str
    """Title Case Pokemon name."""


class MatchupCreate(BaseModel):
    my_team_id: str | None = Field(None, description="UUID of saved team used")
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
    format: str | None = Field(
        None,
        pattern=FORMAT_PATTERN,
        description="Match context: ladder | bo1 | bo3 | tournament | friendly",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Archetype/strategy tags (e.g. 'rain', 'trick-room')",
    )
    close_type: str | None = Field(
        None,
        pattern=CLOSE_TYPE_PATTERN,
        description="Post-match reflection: blowout | close | comeback | standard",
    )
    mvp_pokemon: str | None = Field(
        None, description="The Pokemon that carried (or failed) the match"
    )
    my_team_actual: list[str] | None = Field(
        None,
        max_length=6,
        description=(
            "Optional override of the actual lineup run in this match. "
            "NULL = same as the saved team's roster."
        ),
    )
    replay_url: str | None = None
    opponent_name: str | None = None
    opponent_rating: int | None = None
    event_name: str | None = None
    round_label: str | None = None
    game_number: int | None = None
    set_id: str | None = None
    opponent_lead_pair: list[str] | None = Field(None, max_length=2)
    opponent_selected_four: list[str] | None = Field(None, max_length=4)
    my_selected_four: list[str] | None = Field(None, max_length=4)
    loss_reason: str | None = None
    win_condition: str | None = None
    key_turn: str | None = None
    adjustment_note: str | None = None

    @model_validator(mode="after")
    def validate_team_source(self) -> "MatchupCreate":
        if not self.my_team_id and not self.my_team_actual:
            raise ValueError("Provide either my_team_id or my_team_actual")
        return self


class MatchupUpdate(BaseModel):
    opponent_team_data: list[OpponentPokemon] | None = None
    lead_pair: list[str] | None = None
    outcome: str | None = Field(None, pattern=r"^(win|loss)$")
    notes: str | None = None
    format: str | None = Field(None, pattern=FORMAT_PATTERN)
    tags: list[str] | None = None
    close_type: str | None = Field(None, pattern=CLOSE_TYPE_PATTERN)
    mvp_pokemon: str | None = None
    my_team_actual: list[str] | None = Field(None, max_length=6)
    replay_url: str | None = None
    opponent_name: str | None = None
    opponent_rating: int | None = None
    event_name: str | None = None
    round_label: str | None = None
    game_number: int | None = None
    set_id: str | None = None
    opponent_lead_pair: list[str] | None = Field(None, max_length=2)
    opponent_selected_four: list[str] | None = Field(None, max_length=4)
    my_selected_four: list[str] | None = Field(None, max_length=4)
    loss_reason: str | None = None
    win_condition: str | None = None
    key_turn: str | None = None
    adjustment_note: str | None = None


class MatchupResponse(BaseModel):
    id: str
    user_id: str
    my_team_id: str | None
    opponent_team_data: list[OpponentPokemon] | None
    lead_pair: list[str] | None
    outcome: str
    notes: str | None
    played_at: datetime
    format: str | None = None
    tags: list[str] = Field(default_factory=list)
    close_type: str | None = None
    mvp_pokemon: str | None = None
    my_team_actual: list[str] | None = None
    replay_url: str | None = None
    opponent_name: str | None = None
    opponent_rating: int | None = None
    event_name: str | None = None
    round_label: str | None = None
    game_number: int | None = None
    set_id: str | None = None
    opponent_lead_pair: list[str] | None = None
    opponent_selected_four: list[str] | None = None
    my_selected_four: list[str] | None = None
    loss_reason: str | None = None
    win_condition: str | None = None
    key_turn: str | None = None
    adjustment_note: str | None = None


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
    by_format: list[WinRateStat] = Field(default_factory=list)
    by_tag: list[WinRateStat] = Field(default_factory=list)
