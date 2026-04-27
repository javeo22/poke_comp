"""Pokemon-usage snapshot freshness helpers shared by the AI endpoints.

The cheatsheet and draft Claude prompts include `pokemon_usage` rows
(usage_percent, top moves/items/teammates) as primary meta context.  If
those rows are stale, the AI silently recommends an old metagame.

This module exposes a single function -- ``snapshot_age_days(format)`` --
that returns ``(latest_snapshot_date, age_in_days)`` for the requested
format, plus the threshold at which the AI endpoints hard-block.
"""

from __future__ import annotations

from datetime import date

from app.database import supabase

STALE_USAGE_THRESHOLD_DAYS = 14


def snapshot_age_days(team_format: str) -> tuple[str | None, int | None]:
    """Return (snapshot_date, days_old) for the freshest usage row in `format`.

    Returns ``(None, None)`` if there are no rows for the format -- callers
    treat that the same as "stale" (the AI shouldn't run on no-data either).
    """
    try:
        rows: list[dict] = (
            supabase.table("pokemon_usage")
            .select("snapshot_date")
            .eq("format", team_format)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
            .data  # type: ignore[assignment]
        )
    except Exception:
        return None, None
    if not rows:
        return None, None
    snap = rows[0].get("snapshot_date")
    if not snap:
        return None, None
    try:
        age = (date.today() - date.fromisoformat(snap[:10])).days
    except (ValueError, TypeError):
        return snap, None
    return snap, age


def is_stale(age_days: int | None) -> bool:
    """True when usage data is missing or older than the threshold."""
    return age_days is None or age_days > STALE_USAGE_THRESHOLD_DAYS
