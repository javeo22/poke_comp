from fastapi import APIRouter, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.abilities import AbilityBase, AbilityList

router = APIRouter(prefix="/abilities", tags=["abilities"])


@router.get("", response_model=AbilityList)
def list_abilities(
    name: str | None = Query(None, description="Filter by name (case-insensitive contains)"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("abilities").select("*", count=CountMethod.exact)

    if name:
        query = query.ilike("name", f"%{name}%")

    result = query.order("id").range(offset, offset + limit - 1).execute()
    return AbilityList(
        data=[AbilityBase.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{ability_id}", response_model=AbilityBase)
def get_ability(ability_id: int):
    result = supabase.table("abilities").select("*").eq("id", ability_id).single().execute()
    return AbilityBase.model_validate(result.data)
