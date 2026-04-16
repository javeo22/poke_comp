"""Admin endpoints for data health monitoring.

Provides a read-only data health check endpoint that runs the same
validation checks as scripts/validate_data.py without modifying data.
Also provides a data freshness endpoint showing when each source was
last updated.
"""

from datetime import date

from fastapi import APIRouter

from app.database import supabase
from scripts.validate_data import run_validation

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/data-health")
def data_health():
    """Run data validation checks and return a health report.

    This is a read-only endpoint -- it never modifies data.
    """
    report = run_validation(supabase, fix=False)
    result = report.to_dict()
    result["overall"] = "healthy" if report.total_issues == 0 else "degraded"
    return result


@router.get("/data-freshness")
def data_freshness():
    """Return when each data source was last updated.

    Reports the latest snapshot_date for:
    - pokemon_usage table, grouped by source (smogon, pikalytics, manual)
    - meta_snapshots table, grouped by format (singles, doubles, megas)
    """
    # Latest usage snapshot by source
    usage_rows: list[dict] = (
        supabase.table("pokemon_usage").select("source, snapshot_date").execute().data  # type: ignore[assignment]
    )
    usage_by_source: dict[str, str] = {}
    for row in usage_rows:
        src = row["source"]
        snap = row["snapshot_date"]
        if src not in usage_by_source or snap > usage_by_source[src]:
            usage_by_source[src] = snap

    # Latest meta snapshot by format
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
