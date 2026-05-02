from datetime import date

from pydantic import BaseModel, Field


class MetaSnapshotCreate(BaseModel):
    snapshot_date: date
    format: str = Field(pattern=r"^(singles|doubles|megas)$")
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


class MetaTrendResponse(BaseModel):
    pokemon_name: str
    usage_percent: float
    previous_usage: float
    swing: float
    up: bool
