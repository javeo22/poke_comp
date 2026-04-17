from datetime import date

from pydantic import BaseModel


class UsageEntry(BaseModel):
    name: str
    percent: float


class PokemonUsageResponse(BaseModel):
    id: int
    pokemon_name: str
    format: str
    usage_percent: float
    moves: list[UsageEntry] | None = None
    items: list[UsageEntry] | None = None
    abilities: list[UsageEntry] | None = None
    teammates: list[UsageEntry] | None = None
    snapshot_date: date
    source: str | None = None
    sprite_url: str | None = None


class PokemonUsageList(BaseModel):
    data: list[PokemonUsageResponse]
    count: int
