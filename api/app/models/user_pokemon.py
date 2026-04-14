from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.validators import MAX_PER_STAT, MAX_TOTAL, STAT_KEYS, VALID_NATURES


class _NatureStatsMixin:
    """Shared field validators for nature and stat_points."""

    @field_validator("nature")
    @classmethod
    def check_nature(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_NATURES:
            raise ValueError(
                f"Invalid nature '{v}'. Must be one of: {', '.join(sorted(VALID_NATURES))}"
            )
        return v

    @field_validator("stat_points")
    @classmethod
    def check_stat_points(cls, v: dict | None) -> dict | None:
        if v is None:
            return v
        invalid_keys = set(v.keys()) - STAT_KEYS
        if invalid_keys:
            raise ValueError(f"Invalid stat keys: {invalid_keys}. Valid: {sorted(STAT_KEYS)}")
        total = 0
        for key, value in v.items():
            if not isinstance(value, int) or value < 0 or value > MAX_PER_STAT:
                raise ValueError(
                    f"Stat '{key}' must be 0-{MAX_PER_STAT}, got {value}"
                )
            total += value
        if total > MAX_TOTAL:
            raise ValueError(f"Total stat points ({total}) exceed max of {MAX_TOTAL}")
        return v


class UserPokemonCreate(_NatureStatsMixin, BaseModel):
    pokemon_id: int
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict | None = None
    moves: list[str] | None = Field(None, min_length=4, max_length=4)
    notes: str | None = None
    build_status: str | None = Field(None, pattern=r"^(built|training|wishlist)$")
    vp_spent: int = 0


class UserPokemonUpdate(_NatureStatsMixin, BaseModel):
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
