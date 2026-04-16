from datetime import datetime

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=30)
    avatar_pokemon_id: int | None = None


class ProfileResponse(BaseModel):
    user_id: str
    display_name: str | None = None
    avatar_pokemon_id: int | None = None
    avatar_sprite_url: str | None = None
    created_at: datetime
    updated_at: datetime


class RecentFormEntry(BaseModel):
    outcome: str
    played_at: datetime


class ExpandedStats(BaseModel):
    team_count: int = 0
    roster_count: int = 0
    matches_played: int = 0
    win_rate: float = 0.0
    current_streak: int = 0
    best_streak: int = 0
    streak_type: str = "none"
    matches_this_week: int = 0
    most_used_team: str | None = None
    most_used_team_id: str | None = None
    most_faced_opponent: str | None = None
    recent_form: list[RecentFormEntry] = []


class FullProfileResponse(BaseModel):
    profile: ProfileResponse
    stats: ExpandedStats
    member_since: datetime
    email: str | None = None
