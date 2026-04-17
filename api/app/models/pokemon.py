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
    mega_evolution_ids: list[int] = []
    mega_evolution_names: list[str] = []
    sprite_url: str | None = None


class PokemonList(BaseModel):
    data: list[PokemonBase]
    count: int


class MoveDetail(BaseModel):
    """Subset of MoveBase for the detail view -- only fields useful inline."""

    name: str
    type: str
    category: str
    power: int | None = None
    accuracy: int | None = None
    effect_text: str | None = None


class AbilityDetail(BaseModel):
    """Ability with description for the detail view."""

    name: str
    effect_text: str | None = None


class PokemonUsageSummary(BaseModel):
    """Lightweight usage stats for the detail view."""

    format: str
    usage_percent: float
    top_moves: list[str] = []
    top_items: list[str] = []
    top_abilities: list[str] = []
    top_teammates: list[str] = []


class PokemonDetail(PokemonBase):
    """Enriched Pokemon data with move details, ability descriptions, and usage."""

    move_details: list[MoveDetail] = []
    ability_details: list[AbilityDetail] = []
    usage: list[PokemonUsageSummary] = []
    mega_evolution_name: str | None = None  # kept for compat; prefer mega_evolution_names
