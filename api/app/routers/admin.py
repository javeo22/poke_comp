"""Admin endpoints for data management, health monitoring, and AI cost tracking.

Protected by admin auth -- only user IDs listed in ADMIN_USER_IDS env var
can access these endpoints.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.auth import get_current_user
from app.config import settings
from app.database import supabase
from scripts.validate_data import run_validation

router = APIRouter(prefix="/admin", tags=["admin"])


# ═══════════════════════════════════════════════════════════════════
# Admin auth
# ═══════════════════════════════════════════════════════════════════


def _admin_user_ids() -> set[str]:
    raw = settings.admin_user_ids
    if not raw:
        return set()
    return {uid.strip() for uid in raw.split(",") if uid.strip()}


def get_admin_user(user_id: str = Depends(get_current_user)) -> str:
    """Require the current user to be an admin."""
    allowed = _admin_user_ids()
    if not allowed or user_id not in allowed:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


# ═══════════════════════════════════════════════════════════════════
# Dashboard / Health
# ═══════════════════════════════════════════════════════════════════


STALE_USAGE_THRESHOLD_DAYS = 14


def _days_old(snap: str | None) -> int | None:
    if not snap:
        return None
    try:
        return (date.today() - date.fromisoformat(snap[:10])).days
    except (ValueError, TypeError):
        return None


def _latest_pokemon_usage_by_format() -> dict[str, dict[str, Any]]:
    """`{format: {date, days_old}}` for the freshest snapshot per format."""
    rows: list[dict] = (
        supabase.table("pokemon_usage").select("format, snapshot_date").execute().data  # type: ignore[assignment]
    )
    latest: dict[str, str] = {}
    for r in rows:
        fmt = r.get("format") or "unknown"
        snap = r.get("snapshot_date")
        if not snap:
            continue
        if fmt not in latest or snap > latest[fmt]:
            latest[fmt] = snap
    return {fmt: {"date": snap, "days_old": _days_old(snap)} for fmt, snap in latest.items()}


def _latest_meta_snapshot_by_format() -> dict[str, dict[str, Any]]:
    rows: list[dict] = (
        supabase.table("meta_snapshots").select("format, snapshot_date").execute().data  # type: ignore[assignment]
    )
    latest: dict[str, str] = {}
    for r in rows:
        fmt = r.get("format") or "unknown"
        snap = r.get("snapshot_date")
        if not snap:
            continue
        if fmt not in latest or snap > latest[fmt]:
            latest[fmt] = snap
    return {fmt: {"date": snap, "days_old": _days_old(snap)} for fmt, snap in latest.items()}


def _last_cron_runs_per_source() -> list[dict[str, Any]]:
    """Most recent cron_runs row per source. Tolerates a missing table."""
    try:
        rows: list[dict] = (
            supabase.table("cron_runs")
            .select(
                "source, started_at, finished_at, duration_ms, status, "
                "rows_inserted, rows_updated, rows_skipped, warnings, error"
            )
            .order("started_at", desc=True)
            .limit(200)
            .execute()
            .data  # type: ignore[assignment]
        )
    except Exception:
        return []
    seen: set[str] = set()
    most_recent: list[dict[str, Any]] = []
    for r in rows:
        src = r.get("source")
        if not src or src in seen:
            continue
        seen.add(src)
        warnings = r.get("warnings") or []
        most_recent.append(
            {
                "source": src,
                "status": r.get("status"),
                "started_at": r.get("started_at"),
                "duration_ms": r.get("duration_ms"),
                "rows_inserted": r.get("rows_inserted", 0),
                "rows_updated": r.get("rows_updated", 0),
                "rows_skipped": r.get("rows_skipped", 0),
                "warnings_count": len(warnings) if isinstance(warnings, list) else 0,
                "error": r.get("error"),
            }
        )
    return most_recent


def _stale_warnings(
    usage_by_format: dict[str, dict[str, Any]],
    last_runs: list[dict[str, Any]],
) -> list[str]:
    out: list[str] = []
    threshold = STALE_USAGE_THRESHOLD_DAYS
    for fmt, info in usage_by_format.items():
        days = info.get("days_old")
        if days is None:
            out.append(f"pokemon_usage[{fmt}] has no snapshot date on record")
        elif days > threshold:
            out.append(f"pokemon_usage[{fmt}] is {days} days old (threshold {threshold})")
    for r in last_runs:
        if r.get("status") == "fail":
            err = r.get("error") or "unknown error"
            out.append(f"{r['source']} last run FAILED: {err}")
        elif r.get("status") == "warn":
            touched = r.get("rows_inserted", 0) + r.get("rows_updated", 0)
            if touched == 0:
                out.append(f"{r['source']} last run produced zero rows")
    return out


@router.get("/data-health")
def data_health(_: str = Depends(get_admin_user)):
    """Run data validation checks and return a health report."""
    report = run_validation(supabase, fix=False)
    result = report.to_dict()
    result["overall"] = "healthy" if report.total_issues == 0 else "degraded"

    usage_by_format = _latest_pokemon_usage_by_format()
    meta_by_format = _latest_meta_snapshot_by_format()
    last_runs = _last_cron_runs_per_source()
    warnings = _stale_warnings(usage_by_format, last_runs)

    result["latest_pokemon_usage_per_format"] = usage_by_format
    result["latest_meta_snapshot_per_format"] = meta_by_format
    result["last_cron_runs"] = last_runs
    result["stale_warnings"] = warnings
    if warnings and result["overall"] == "healthy":
        result["overall"] = "stale"
    return result


@router.get("/data-freshness")
def data_freshness(_: str = Depends(get_admin_user)):
    """Return when each data source was last updated."""
    usage_rows: list[dict] = (
        supabase.table("pokemon_usage").select("source, snapshot_date").execute().data  # type: ignore[assignment]
    )
    usage_by_source: dict[str, str] = {}
    for row in usage_rows:
        src = row["source"]
        snap = row["snapshot_date"]
        if src not in usage_by_source or snap > usage_by_source[src]:
            usage_by_source[src] = snap

    meta_rows: list[dict] = (
        supabase.table("meta_snapshots").select("format, snapshot_date").execute().data  # type: ignore[assignment]
    )
    meta_by_format: dict[str, str] = {}
    for row in meta_rows:
        fmt = row["format"]
        snap = row["snapshot_date"]
        if fmt not in meta_by_format or snap > meta_by_format[fmt]:
            meta_by_format[fmt] = snap

    return {
        "checked_at": date.today().isoformat(),
        "usage_data": usage_by_source,
        "meta_snapshots": meta_by_format,
    }


@router.get("/stats")
def admin_stats(_: str = Depends(get_admin_user)):
    """Quick counts for the admin dashboard."""
    pokemon_count = len(
        supabase.table("pokemon")
        .select("id", count="exact")  # type: ignore[arg-type]
        .eq("champions_eligible", True)
        .execute()
        .data
    )
    moves_count = len(
        supabase.table("moves")
        .select("id", count="exact")  # type: ignore[arg-type]
        .eq("champions_available", True)
        .execute()
        .data
    )
    items_count = len(
        supabase.table("items")
        .select("id", count="exact")  # type: ignore[arg-type]
        .eq("champions_shop_available", True)
        .execute()
        .data
    )
    abilities_count = len(
        supabase.table("abilities")
        .select("id", count="exact")  # type: ignore[arg-type]
        .execute()
        .data
    )

    return {
        "pokemon_champions": pokemon_count,
        "moves_champions": moves_count,
        "items_champions": items_count,
        "abilities_total": abilities_count,
    }


# ═══════════════════════════════════════════════════════════════════
# AI Cost Dashboard
# ═══════════════════════════════════════════════════════════════════


@router.get("/ai-costs")
def ai_costs(
    days: int = Query(default=30, ge=1, le=365),
    _: str = Depends(get_admin_user),
):
    """AI spend breakdown by day and endpoint."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        rows: list[dict] = (
            supabase.table("ai_usage_log")
            .select("endpoint, estimated_cost_usd, cached, created_at")
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
            .data  # type: ignore[assignment]
        )
    except Exception:
        return {"total_cost": 0, "by_endpoint": {}, "by_day": {}, "total_requests": 0}

    total_cost = 0.0
    total_requests = 0
    cached_requests = 0
    by_endpoint: dict[str, float] = {}
    by_day: dict[str, float] = {}

    for r in rows:
        cost = float(r.get("estimated_cost_usd") or 0)
        total_cost += cost
        total_requests += 1
        if r.get("cached"):
            cached_requests += 1
        ep = r.get("endpoint", "unknown")
        by_endpoint[ep] = by_endpoint.get(ep, 0) + cost
        day = r["created_at"][:10]
        by_day[day] = by_day.get(day, 0) + cost

    return {
        "days": days,
        "total_cost": round(total_cost, 4),
        "total_requests": total_requests,
        "cached_requests": cached_requests,
        "by_endpoint": {k: round(v, 4) for k, v in by_endpoint.items()},
        "by_day": dict(sorted(by_day.items())),
    }


# ═══════════════════════════════════════════════════════════════════
# Pokemon CRUD
# ═══════════════════════════════════════════════════════════════════


@router.get("/pokemon")
def list_pokemon(
    champions_only: bool = False,
    search: str = "",
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    _: str = Depends(get_admin_user),
):
    """List Pokemon with admin-level detail."""
    q = supabase.table("pokemon").select("*")
    if champions_only:
        q = q.eq("champions_eligible", True)
    if search:
        q = q.ilike("name", f"%{search}%")
    q = q.order("id").range(offset, offset + limit - 1)
    rows: list[dict] = q.execute().data  # type: ignore[assignment]
    return rows


@router.patch("/pokemon/{pokemon_id}")
def update_pokemon(
    pokemon_id: int,
    updates: dict[str, Any] = Body(...),
    admin_id: str = Depends(get_admin_user),
):
    """Update Pokemon fields (champions_eligible, movepool, etc.)."""
    allowed = {
        "champions_eligible",
        "movepool",
        "abilities",
        "types",
        "base_stats",
        "mega_evolution_id",
    }
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail=f"No valid fields. Allowed: {allowed}")

    result = supabase.table("pokemon").update(filtered).eq("id", pokemon_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Pokemon not found")
    return rows[0]


# ═══════════════════════════════════════════════════════════════════
# Moves CRUD
# ═══════════════════════════════════════════════════════════════════


@router.get("/moves")
def list_moves(
    champions_only: bool = False,
    search: str = "",
    type_filter: str = "",
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    _: str = Depends(get_admin_user),
):
    """List moves with admin-level detail."""
    q = supabase.table("moves").select("*")
    if champions_only:
        q = q.eq("champions_available", True)
    if search:
        q = q.ilike("name", f"%{search}%")
    if type_filter:
        q = q.eq("type", type_filter)
    q = q.order("name").range(offset, offset + limit - 1)
    rows: list[dict] = q.execute().data  # type: ignore[assignment]
    return rows


@router.patch("/moves/{move_id}")
def update_move(
    move_id: int,
    updates: dict[str, Any] = Body(...),
    _: str = Depends(get_admin_user),
):
    """Update move fields (champions_available, power, etc.)."""
    allowed = {
        "champions_available",
        "power",
        "accuracy",
        "effect_text",
        "type",
        "category",
        "target",
    }
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail=f"No valid fields. Allowed: {allowed}")

    result = supabase.table("moves").update(filtered).eq("id", move_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Move not found")
    return rows[0]


# ═══════════════════════════════════════════════════════════════════
# Items CRUD
# ═══════════════════════════════════════════════════════════════════


@router.get("/items")
def list_items(
    champions_only: bool = False,
    search: str = "",
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    _: str = Depends(get_admin_user),
):
    """List items with admin-level detail."""
    q = supabase.table("items").select("*")
    if champions_only:
        q = q.eq("champions_shop_available", True)
    if search:
        q = q.ilike("name", f"%{search}%")
    q = q.order("name").range(offset, offset + limit - 1)
    rows: list[dict] = q.execute().data  # type: ignore[assignment]
    return rows


@router.patch("/items/{item_id}")
def update_item(
    item_id: int,
    updates: dict[str, Any] = Body(...),
    _: str = Depends(get_admin_user),
):
    """Update item fields. Supports: champions_shop_available, effect_text, vp_cost, category."""
    allowed = {"champions_shop_available", "effect_text", "vp_cost", "category"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail=f"No valid fields. Allowed: {allowed}")

    result = supabase.table("items").update(filtered).eq("id", item_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Item not found")
    return rows[0]


# ═══════════════════════════════════════════════════════════════════
# Abilities CRUD
# ═══════════════════════════════════════════════════════════════════


@router.get("/abilities")
def list_abilities(
    search: str = "",
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    _: str = Depends(get_admin_user),
):
    """List abilities with admin-level detail."""
    q = supabase.table("abilities").select("*")
    if search:
        q = q.ilike("name", f"%{search}%")
    q = q.order("name").range(offset, offset + limit - 1)
    rows: list[dict] = q.execute().data  # type: ignore[assignment]
    return rows


@router.patch("/abilities/{ability_id}")
def update_ability(
    ability_id: int,
    updates: dict[str, Any] = Body(...),
    _: str = Depends(get_admin_user),
):
    """Update ability fields. Supports: effect_text."""
    allowed = {"effect_text"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail=f"No valid fields. Allowed: {allowed}")

    result = supabase.table("abilities").update(filtered).eq("id", ability_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Ability not found")
    return rows[0]


# ═══════════════════════════════════════════════════════════════════
# Meta Snapshots
# ═══════════════════════════════════════════════════════════════════


@router.get("/meta-snapshots")
def list_meta_snapshots(
    format_filter: str = "",
    limit: int = Query(default=20, le=100),
    _: str = Depends(get_admin_user),
):
    """List meta snapshots ordered by date."""
    q = supabase.table("meta_snapshots").select("*")
    if format_filter:
        q = q.eq("format", format_filter)
    q = q.order("snapshot_date", desc=True).limit(limit)
    rows: list[dict] = q.execute().data  # type: ignore[assignment]
    return rows


@router.patch("/meta-snapshots/{snapshot_id}")
def update_meta_snapshot(
    snapshot_id: str,
    updates: dict[str, Any] = Body(...),
    _: str = Depends(get_admin_user),
):
    """Update meta snapshot tier_data."""
    allowed = {"tier_data", "source"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail=f"No valid fields. Allowed: {allowed}")

    result = supabase.table("meta_snapshots").update(filtered).eq("id", snapshot_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return rows[0]
