from datetime import datetime

from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    name: str
    format: str = Field(pattern=r"^(singles|doubles|megas)$")
    pokemon_ids: list[int] = Field(min_length=1, max_length=6)
    mega_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    format: str | None = Field(None, pattern=r"^(singles|doubles|megas)$")
    pokemon_ids: list[int] | None = Field(None, min_length=1, max_length=6)
    mega_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None


class TeamResponse(BaseModel):
    id: str
    user_id: str
    name: str
    format: str
    pokemon_ids: list[int]
    mega_pokemon_id: int | None = None
    notes: str | None = None
    archetype_tag: str | None = None
    created_at: datetime
    updated_at: datetime


class TeamList(BaseModel):
    data: list[TeamResponse]
    count: int
