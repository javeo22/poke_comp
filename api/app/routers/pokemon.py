from typing import Any, TypeAlias


# Type alias for Supabase response rows to avoid pyright JSON narrowing noise
SupabaseRow: TypeAlias = dict[str, Any]

from fastapi import APIRouter, HTTPException, Query, Response
from postgrest.types import CountMethod

from app.database import supabase
from app.models.pokemon import (
    AbilityDetail,
    MoveDetail,
    PokemonBase,
    PokemonBasic,
    PokemonBasicList,
    PokemonDetail,
    PokemonList,
    PokemonUsageSummary,
    SpeedTierEntry,
    SpeedTierList,
)

router = APIRouter(prefix="/pokemon", tags=["pokemon"])

# Pokemon static data changes rarely (game balance patches). Cache aggressively
# at the edge with a long stale-while-revalidate window so a slow refresh never
# blocks the user.
_STATIC_CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400"


def _extract_usage_names(data: list | dict | None, limit: int) -> list[str]:
    """Extract Pokemon/move/item names from usage data.

    Handles both legacy dict format ({"Name": count, ...}) and current
    list format ([{"name": "Name", "percent": 50.0}, ...]) stored by the
    Smogon ingest pipeline.
    """
    if not data:
        return []
    if isinstance(data, list):
        return [
            entry["name"] for entry in data[:limit] if isinstance(entry, dict) and "name" in entry
        ]
    return list(data.keys())[:limit]


@router.get("/basic", response_model=PokemonBasicList)
def list_pokemon_basic(
    response: Response,
    type: str | None = Query(None, description="Filter by type"),
    champions_only: bool = Query(False, description="Only Champions-eligible Pokemon"),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Slim Pokemon list for pickers and grid views. Drops movepool, abilities,
    base_stats, mega data -- ~80% smaller payload than `/pokemon`. Use this
    everywhere you only need name + types + sprite for display."""
    query = supabase.table("pokemon").select(
        "id, name, types, champions_eligible, sprite_url",
        count=CountMethod.exact,
    )
    if type:
        query = query.contains("types", [type])
    if champions_only:
        query = query.eq("champions_eligible", True)

    result = query.order("id").range(offset, offset + limit - 1).execute()
    rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    response.headers["Cache-Control"] = _STATIC_CACHE_HEADER
    return PokemonBasicList(
        data=[PokemonBasic.model_validate(r) for r in rows],
        count=result.count or len(rows),
    )


@router.get("", response_model=PokemonList)
def list_pokemon(
    response: Response,
    name: str | None = Query(None, description="Filter by name (case-insensitive contains)"),
    type: str | None = Query(None, description="Filter by type"),
    champions_only: bool = Query(False, description="Only Champions-eligible Pokemon"),
    generation: int | None = Query(None, description="Filter by generation"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("pokemon").select("*", count=CountMethod.exact)

    if name:
        query = query.ilike("name", f"%{name}%")
    if type:
        query = query.contains("types", [type])
    if champions_only:
        query = query.eq("champions_eligible", True)
    if generation is not None:
        query = query.eq("generation", generation)

    result = query.order("id").range(offset, offset + limit - 1).execute()
    response.headers["Cache-Control"] = _STATIC_CACHE_HEADER
    rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    # Batch-resolve mega form names for all rows in one query
    all_mega_ids: set[int] = set()
    for row in rows:
        for mid in row.get("mega_evolution_ids") or []:
            all_mega_ids.add(mid)
    mega_name_map: dict[int, str] = {}
    if all_mega_ids:
        mega_rows = (
            supabase.table("pokemon").select("id, name").in_("id", list(all_mega_ids)).execute()
        )
        mega_data: list[SupabaseRow] = mega_rows.data  # type: ignore[assignment]
        for m in mega_data:
            mega_name_map[int(m["id"])] = str(m["name"])

    pokemon_list = []
    for row in rows:
        mega_ids: list[int] = row.get("mega_evolution_ids") or []
        row["mega_evolution_names"] = [
            mega_name_map[mid] for mid in mega_ids if mid in mega_name_map
        ]
        pokemon_list.append(PokemonBase.model_validate(row))

    return PokemonList(
        data=pokemon_list,
        count=result.count or len(rows),
    )


@router.get("/speed-tiers", response_model=SpeedTierList)
def list_speed_tiers(
    response: Response,
    format: str = Query("doubles", description="Format key for usage % overlay"),
    champions_only: bool = Query(True, description="Only Champions-eligible Pokemon"),
):
    """Global speed-tier reference table. Returns every Pokemon ordered by
    base speed descending, with derived neutral / +nature / scarf max stats
    (level 50, 252 EV, 31 IV). Optionally augmented with the latest usage
    percentage for the requested format.

    Stat formula matches `damage_calc.from_base_stats()` -- level-50, 252 EV,
    31 IV, neutral nature: floor((2*base + 31 + 63) * 50/100) + 5.
    """
    query = supabase.table("pokemon").select("id, name, types, sprite_url, base_stats")
    if champions_only:
        query = query.eq("champions_eligible", True)
    result = query.execute()
    rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    # Resolve latest usage % per Pokemon name for the requested format.
    usage_map: dict[str, float] = {}
    usage_result = (
        supabase.table("pokemon_usage")
        .select("pokemon_name, usage_percent, snapshot_date")
        .eq("format", format)
        .order("snapshot_date", desc=True)
        .execute()
    )
    usage_rows: list[dict[str, Any]] = usage_result.data or []  # type: ignore[assignment]
    for u in usage_rows:
        # Keep the latest only (rows are ordered desc by date).
        name = u.get("pokemon_name")
        if name and name not in usage_map:
            usage_map[name] = float(u.get("usage_percent") or 0)

    entries: list[SpeedTierEntry] = []
    for row in rows:
        base_stats = row.get("base_stats") or {}
        base_speed = int(base_stats.get("speed", 0) or 0)
        # Level-50, 252 EV, 31 IV, neutral nature.
        neutral_max = ((2 * base_speed + 31 + 63) * 50 // 100) + 5
        positive_max = int(neutral_max * 1.1)
        scarf_max = int(positive_max * 1.5)
        entries.append(
            SpeedTierEntry(
                id=row["id"],
                name=row["name"],
                types=row.get("types") or [],
                sprite_url=row.get("sprite_url"),
                base_speed=base_speed,
                neutral_max=neutral_max,
                positive_max=positive_max,
                scarf_max=scarf_max,
                usage_percent=usage_map.get(row["name"]),
            )
        )

    entries.sort(key=lambda e: (-e.base_speed, e.name))
    response.headers["Cache-Control"] = _STATIC_CACHE_HEADER
    return SpeedTierList(data=entries, count=len(entries))


@router.get("/{pokemon_id}", response_model=PokemonBase)
def get_pokemon(pokemon_id: int):
    try:
        result = supabase.table("pokemon").select("*").eq("id", pokemon_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Pokemon not found") from exc
    return PokemonBase.model_validate(result.data)


@router.get("/{pokemon_id}/detail", response_model=PokemonDetail)
def get_pokemon_detail(pokemon_id: int):
    """Enriched Pokemon data: base info + move details + ability descriptions + usage."""
    # Fetch base Pokemon — .single() raises on zero rows; treat as 404
    try:
        poke_result = supabase.table("pokemon").select("*").eq("id", pokemon_id).single().execute()
        poke_row: dict[str, Any] = poke_result.data  # type: ignore[assignment]
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Pokemon not found") from exc

    base = PokemonBase.model_validate(poke_row)

    # Fetch move details for the movepool (batch by name)
    move_details: list[MoveDetail] = []
    movepool = poke_row.get("movepool") or []
    if movepool:
        moves_result = (
            supabase.table("moves")
            .select("name, type, category, power, accuracy, effect_text")
            .in_("name", movepool)
            .order("name")
            .execute()
        )
        move_rows: list[dict[str, Any]] = moves_result.data  # type: ignore[assignment]
        move_details = [MoveDetail.model_validate(m) for m in move_rows]

    # Fetch ability details (batch by name)
    ability_details: list[AbilityDetail] = []
    abilities = poke_row.get("abilities") or []
    if abilities:
        ab_result = (
            supabase.table("abilities").select("name, effect_text").in_("name", abilities).execute()
        )
        ab_rows: list[dict[str, Any]] = ab_result.data  # type: ignore[assignment]
        ability_details = [AbilityDetail.model_validate(a) for a in ab_rows]

    # Fetch usage data -- latest snapshot per Champions format
    usage: list[PokemonUsageSummary] = []
    for fmt in ("doubles", "singles"):
        usage_result = (
            supabase.table("pokemon_usage")
            .select("format, usage_percent, moves, items, abilities, teammates")
            .eq("pokemon_name", base.name)
            .eq("format", fmt)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        usage_rows: list[dict[str, Any]] = usage_result.data  # type: ignore[assignment]
        for u in usage_rows:
            usage.append(
                PokemonUsageSummary(
                    format=u.get("format", ""),
                    usage_percent=u.get("usage_percent", 0),
                    top_moves=_extract_usage_names(u.get("moves"), 6),
                    top_items=_extract_usage_names(u.get("items"), 4),
                    top_abilities=_extract_usage_names(u.get("abilities"), 3),
                    top_teammates=_extract_usage_names(u.get("teammates"), 4),
                )
            )

    # Resolve mega form names (supports multiple megas e.g. Charizard X + Y)
    detail_mega_ids: list[int] = poke_row.get("mega_evolution_ids") or []
    if not detail_mega_ids and poke_row.get("mega_evolution_id"):
        detail_mega_ids = [poke_row["mega_evolution_id"]]

    mega_names: list[str] = []
    if detail_mega_ids:
        mega_res = supabase.table("pokemon").select("id, name").in_("id", detail_mega_ids).execute()
        mega_rows: list[SupabaseRow] = mega_res.data  # type: ignore[assignment]
        id_to_name = {int(r["id"]): str(r["name"]) for r in mega_rows}
        mega_names = [id_to_name[mid] for mid in detail_mega_ids if mid in id_to_name]

    base_dict = base.model_dump()
    base_dict.pop("mega_evolution_names", None)
    return PokemonDetail(
        **base_dict,
        move_details=move_details,
        ability_details=ability_details,
        usage=usage,
        mega_evolution_name=mega_names[0] if mega_names else None,
        mega_evolution_names=mega_names,
    )
