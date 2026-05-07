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
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    latest_result = (
        supabase.table("pokemon_usage")
        .select("snapshot_date")
        .eq("format", format)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
    )
    latest_rows: list[dict] = latest_result.data or []  # type: ignore[assignment]
    if not latest_rows:
        response.headers["Cache-Control"] = _USAGE_CACHE_HEADER
        return PokemonUsageList(data=[], count=0)

    latest_snapshot = latest_rows[0]["snapshot_date"]
    result = (
        supabase.table("pokemon_usage")
        .select("*", count=CountMethod.exact)
        .eq("format", format)
        .eq("snapshot_date", latest_snapshot)
        .order("usage_percent", desc=True)
        .execute()
    )
    all_rows: list[dict] = result.data or []  # type: ignore[assignment]
    deduped_by_name: dict[str, dict] = {}
    for row in all_rows:
        name = str(row.get("pokemon_name") or "")
        if not name:
            continue
        current = deduped_by_name.get(name)
        if current is None or float(row.get("usage_percent") or 0) > float(
            current.get("usage_percent") or 0
        ):
            deduped_by_name[name] = row

    deduped_rows = sorted(
        deduped_by_name.values(),
        key=lambda r: float(r.get("usage_percent") or 0),
        reverse=True,
    )
    usage_rows = deduped_rows[offset : offset + limit]

    sprite_map: dict[str, str | None] = {}
    if usage_rows:
        names = [
            str(row["pokemon_name"])
            for row in usage_rows
            if isinstance(row, dict) and row.get("pokemon_name")
        ]
        sprite_result = (
            supabase.table("pokemon").select("name, sprite_url").in_("name", names).execute()
        )
        sprite_map = {
            str(row["name"]): str(row.get("sprite_url")) if row.get("sprite_url") else None
            for row in (sprite_result.data or [])
            if isinstance(row, dict) and row.get("name")
        }

    for row in usage_rows:
        if isinstance(row, dict) and row.get("pokemon_name"):
            row["sprite_url"] = sprite_map.get(str(row["pokemon_name"]))

    response.headers["Cache-Control"] = _USAGE_CACHE_HEADER
    return PokemonUsageList(
        data=[PokemonUsageResponse.model_validate(row) for row in usage_rows],
        count=len(deduped_rows),
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
