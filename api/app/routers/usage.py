from fastapi import APIRouter, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.usage import PokemonUsageList, PokemonUsageResponse

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("", response_model=PokemonUsageList)
def list_usage(
    format: str = Query("doubles", description="Filter by format (doubles, singles)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
        supabase.table("pokemon_usage").select("*", count=CountMethod.exact).eq("format", format)
    )

    result = query.order("usage_percent", desc=True).range(offset, offset + limit - 1).execute()
    return PokemonUsageList(
        data=[PokemonUsageResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/pokemon/{pokemon_name}", response_model=list[PokemonUsageResponse])
def get_pokemon_usage(pokemon_name: str):
    """Get usage data for a specific Pokemon across all formats."""
    result = (
        supabase.table("pokemon_usage")
        .select("*")
        .ilike("pokemon_name", pokemon_name)
        .order("snapshot_date", desc=True)
        .limit(5)
        .execute()
    )
    return [PokemonUsageResponse.model_validate(row) for row in result.data]
