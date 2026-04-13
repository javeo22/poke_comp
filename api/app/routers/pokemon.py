from fastapi import APIRouter, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.pokemon import PokemonBase, PokemonList

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
