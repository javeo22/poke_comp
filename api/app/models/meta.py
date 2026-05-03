from datetime import date

from pydantic import BaseModel, Field


class MetaSnapshotCreate(BaseModel):
    snapshot_date: date
    format: str = Field(pattern=r"^(singles|doubles)$")
    tier_data: dict[str, list[str]]
    source_url: str | None = None
    source: str | None = None


class MetaSnapshotResponse(BaseModel):
    id: int
    snapshot_date: date
    format: str
    tier_data: dict[str, list[str]]
    source_url: str | None = None
    source: str | None = None


class MetaSnapshotList(BaseModel):
    data: list[MetaSnapshotResponse]
    count: int


class TierEntry(BaseModel):
    """Convenience model for a single Pokemon's tier placement."""

    pokemon_name: str
    tier: str
    format: str
    snapshot_date: date


class UsageItem(BaseModel):
    name: str
    percent: float


class MetaTrendResponse(BaseModel):
    id: int
    pokemon_name: str
    usage_percent: float | None = None
    previous_usage: float | None = None
    swing: float | None = None
    up: bool = True
    win_rate: float | None = None
    role: str | None = None
    top_moves: list[UsageItem] = []
    top_items: list[UsageItem] = []
    top_abilities: list[UsageItem] = []
