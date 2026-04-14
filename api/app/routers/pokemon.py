from typing import Any

from fastapi import APIRouter, HTTPException, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.pokemon import (
    AbilityDetail,
    MoveDetail,
    PokemonBase,
    PokemonDetail,
    PokemonList,
    PokemonUsageSummary,
)

router = APIRouter(prefix="/pokemon", tags=["pokemon"])


@router.get("", response_model=PokemonList)
def list_pokemon(
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
    return PokemonList(
        data=[PokemonBase.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{pokemon_id}", response_model=PokemonBase)
def get_pokemon(pokemon_id: int):
    result = supabase.table("pokemon").select("*").eq("id", pokemon_id).single().execute()
    return PokemonBase.model_validate(result.data)


@router.get("/{pokemon_id}/detail", response_model=PokemonDetail)
def get_pokemon_detail(pokemon_id: int):
    """Enriched Pokemon data: base info + move details + ability descriptions + usage."""
    # Fetch base Pokemon
    poke_result = supabase.table("pokemon").select("*").eq("id", pokemon_id).single().execute()
    poke_row: dict[str, Any] = poke_result.data  # type: ignore[assignment]
    if not poke_row:
        raise HTTPException(status_code=404, detail="Pokemon not found")

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
            moves_list: list[dict] = u.get("moves") or []
            items_list: list[dict] = u.get("items") or []
            ab_list: list[dict] = u.get("abilities") or []
            mates_list: list[dict] = u.get("teammates") or []
            usage.append(
                PokemonUsageSummary(
                    format=u.get("format", ""),
                    usage_percent=u.get("usage_percent", 0),
                    top_moves=[m["name"] for m in moves_list[:6]],
                    top_items=[i["name"] for i in items_list[:4]],
                    top_abilities=[a["name"] for a in ab_list[:3]],
                    top_teammates=[t["name"] for t in mates_list[:4]],
                )
            )

    # Resolve mega evolution name if linked
    mega_name: str | None = None
    mega_id = poke_row.get("mega_evolution_id")
    if mega_id:
        mega_result = supabase.table("pokemon").select("name").eq("id", mega_id).execute()
        mega_rows: list[dict[str, Any]] = mega_result.data  # type: ignore[assignment]
        if mega_rows:
            mega_name = mega_rows[0]["name"]

    return PokemonDetail(
        **base.model_dump(),
        move_details=move_details,
        ability_details=ability_details,
        usage=usage,
        mega_evolution_name=mega_name,
    )
