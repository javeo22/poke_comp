from typing import Any

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
    item_rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    # Compute top holders from usage data in one batch query
    top_holders_map: dict[str, list[str]] = {}
    if item_rows:
        item_name_set = {row["name"] for row in item_rows}
        usage_result = supabase.table("pokemon_usage").select("pokemon_name, items").execute()
        usage_rows: list[dict[str, Any]] = usage_result.data  # type: ignore[assignment]
        # item_name -> [(pokemon_name, usage_pct)]
        item_usage: dict[str, list[tuple[str, float]]] = {}
        for row in usage_rows:
            items_data: dict[str, float] = row.get("items") or {}
            pokemon_name_val: str = row.get("pokemon_name") or ""
            for item_name, pct in items_data.items():
                if item_name in item_name_set:
                    item_usage.setdefault(item_name, []).append((pokemon_name_val, float(pct)))
        for item_name, holders in item_usage.items():
            holders.sort(key=lambda x: -x[1])
            top_holders_map[item_name] = [h for h, _ in holders[:3]]
        for row in item_rows:
            holders_list = top_holders_map.get(row["name"])
            row["top_holders"] = holders_list if holders_list else None

    return ItemList(
        data=[ItemBase.model_validate(row) for row in item_rows],
        count=result.count or len(item_rows),
    )


@router.get("/{item_id}", response_model=ItemBase)
def get_item(item_id: int):
    result = supabase.table("items").select("*").eq("id", item_id).single().execute()
    return ItemBase.model_validate(result.data)
