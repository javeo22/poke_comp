from pydantic import BaseModel


class PokemonBase(BaseModel):
    id: int
    name: str
    types: list[str]
    base_stats: dict
    abilities: list[str]
    movepool: list[str]
    champions_eligible: bool
    generation: int | None = None
    mega_evolution_id: int | None = None
    sprite_url: str | None = None


class PokemonList(BaseModel):
    data: list[PokemonBase]
    count: int
