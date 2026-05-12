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


class PokemonBasic(BaseModel):
    """Slim record for list views and pickers -- omits movepool, abilities,
    base_stats, mega data. Cuts payload by ~80% for the match-log opponent
    picker and roster grid."""

    id: int
    name: str
    types: list[str]
    champions_eligible: bool
    sprite_url: str | None = None


class PokemonBasicList(BaseModel):
    data: list[PokemonBasic]
    count: int


class PokemonNameResolveRequest(BaseModel):
    names: list[str]


class PokemonNameResolved(BaseModel):
    input: str
    name: str
    pokemon_id: int
    confidence: float


class PokemonNameResolveResponse(BaseModel):
    resolved: list[PokemonNameResolved]
    unresolved: list[str]


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
    champions_available: bool | None = None


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


class SpeedTierEntry(BaseModel):
    """One row in the global speed-tier reference table.

    All speed values are level-50 actual stats (post-stat formula).
    `neutral_max` assumes 252 EV / 31 IV / neutral nature.
    `positive_max` applies the +Speed nature multiplier (1.1).
    `scarf_max` applies Choice Scarf on top of positive nature (1.5)."""

    id: int
    name: str
    types: list[str]
    sprite_url: str | None = None
    base_speed: int
    neutral_max: int
    positive_max: int
    scarf_max: int
    usage_percent: float | None = None


class SpeedTierList(BaseModel):
    data: list[SpeedTierEntry]
    count: int
