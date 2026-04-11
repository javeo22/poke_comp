from fastapi import APIRouter, Query
from postgrest.types import CountMethod

from app.database import supabase
from app.models.items import ItemBase, ItemList

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=ItemList)
def list_items(
    name: str | None = Query(None, description="Filter by name (case-insensitive contains)"),
    category: str | None = Query(None, description="Filter by item category"),
    champions_only: bool = Query(False, description="Only Champions shop items"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("items").select("*", count=CountMethod.exact)

    if name:
        query = query.ilike("name", f"%{name}%")
    if category:
        query = query.eq("category", category)
    if champions_only:
        query = query.eq("champions_shop_available", True)

    result = query.order("id").range(offset, offset + limit - 1).execute()
    return ItemList(
        data=[ItemBase.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{item_id}", response_model=ItemBase)
def get_item(item_id: int):
    result = supabase.table("items").select("*").eq("id", item_id).single().execute()
    return ItemBase.model_validate(result.data)
