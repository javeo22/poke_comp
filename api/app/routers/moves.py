from typing import Any

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
    move_rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    # Compute learner counts via a single batch query over champions-eligible Pokemon
    learner_counts: dict[str, int] = {}
    if move_rows:
        move_name_set = {row["name"] for row in move_rows}
        poke_result = (
            supabase.table("pokemon").select("movepool").eq("champions_eligible", True).execute()
        )
        poke_rows: list[dict[str, Any]] = poke_result.data  # type: ignore[assignment]
        for poke in poke_rows:
            for mn in poke.get("movepool") or []:
                if mn in move_name_set:
                    learner_counts[mn] = learner_counts.get(mn, 0) + 1
        for row in move_rows:
            row["learner_count"] = learner_counts.get(row["name"])

    return MoveList(
        data=[MoveBase.model_validate(row) for row in move_rows],
        count=result.count or len(move_rows),
    )


@router.get("/{move_id}", response_model=MoveBase)
def get_move(move_id: int):
    result = supabase.table("moves").select("*").eq("id", move_id).single().execute()
    return MoveBase.model_validate(result.data)
