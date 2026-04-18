from fastapi import APIRouter, Query, Response
from postgrest.types import CountMethod

from app.database import supabase
from app.models.usage import PokemonUsageList, PokemonUsageResponse

router = APIRouter(prefix="/usage", tags=["usage"])

# Usage data refreshes weekly via cron (Mon 06:00 + 07:00 UTC). 1-hour cache
# with 24-hour stale-while-revalidate is plenty fresh.
_USAGE_CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400"


@router.get("", response_model=PokemonUsageList)
def list_usage(
    response: Response,
    format: str = Query("doubles", description="Filter by format (doubles, singles)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
        supabase.table("pokemon_usage").select("*", count=CountMethod.exact).eq("format", format)
    )

    result = query.order("usage_percent", desc=True).range(offset, offset + limit - 1).execute()
    usage_rows = result.data

    sprite_map: dict[str, str | None] = {}
    if usage_rows:
        names = [row["pokemon_name"] for row in usage_rows]
        sprite_result = (
            supabase.table("pokemon")
            .select("name, sprite_url")
            .in_("name", names)
            .execute()
        )
        sprite_map = {row["name"]: row.get("sprite_url") for row in sprite_result.data}

    for row in usage_rows:
        row["sprite_url"] = sprite_map.get(row["pokemon_name"])

    response.headers["Cache-Control"] = _USAGE_CACHE_HEADER
    return PokemonUsageList(
        data=[PokemonUsageResponse.model_validate(row) for row in usage_rows],
        count=result.count or len(usage_rows),
    )


@router.get("/pokemon/{pokemon_name}", response_model=list[PokemonUsageResponse])
def get_pokemon_usage(pokemon_name: str, response: Response):
    """Get usage data for a specific Pokemon across all formats."""
    result = (
        supabase.table("pokemon_usage")
        .select("*")
        .ilike("pokemon_name", pokemon_name)
        .order("snapshot_date", desc=True)
        .limit(5)
        .execute()
    )
    response.headers["Cache-Control"] = _USAGE_CACHE_HEADER
    return [PokemonUsageResponse.model_validate(row) for row in result.data]
