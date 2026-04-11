from datetime import datetime

from pydantic import BaseModel, Field


class UserPokemonCreate(BaseModel):
    pokemon_id: int
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict | None = None
    moves: list[str] | None = Field(None, min_length=4, max_length=4)
    notes: str | None = None
    build_status: str | None = Field(None, pattern=r"^(built|training|wishlist)$")
    vp_spent: int = 0


class UserPokemonUpdate(BaseModel):
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict | None = None
    moves: list[str] | None = Field(None, min_length=4, max_length=4)
    notes: str | None = None
    build_status: str | None = Field(None, pattern=r"^(built|training|wishlist)$")
    vp_spent: int | None = None


class UserPokemonResponse(BaseModel):
    id: str
    user_id: str
    pokemon_id: int
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict | None = None
    moves: list[str] | None = None
    notes: str | None = None
    build_status: str | None = None
    vp_spent: int = 0
    created_at: datetime
    updated_at: datetime


class UserPokemonList(BaseModel):
    data: list[UserPokemonResponse]
    count: int
