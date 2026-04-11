from fastapi import APIRouter, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.moves import MoveBase, MoveList

router = APIRouter(prefix="/moves", tags=["moves"])


@router.get("", response_model=MoveList)
def list_moves(
    name: str | None = Query(None, description="Filter by name (case-insensitive contains)"),
    type: str | None = Query(None, description="Filter by move type"),
    category: str | None = Query(None, description="Filter by category: physical, special, status"),
    champions_only: bool = Query(False, description="Only Champions-available moves"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("moves").select("*", count=CountMethod.exact)

    if name:
        query = query.ilike("name", f"%{name}%")
    if type:
        query = query.eq("type", type)
    if category:
        query = query.eq("category", category)
    if champions_only:
        query = query.eq("champions_available", True)

    result = query.order("id").range(offset, offset + limit - 1).execute()
    return MoveList(
        data=[MoveBase.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{move_id}", response_model=MoveBase)
def get_move(move_id: int):
    result = supabase.table("moves").select("*").eq("id", move_id).single().execute()
    return MoveBase.model_validate(result.data)
