"""Per-user AI usage quota enforcement and logging."""

from datetime import datetime, timezone

from fastapi import HTTPException
from postgrest.types import CountMethod

from app.database import supabase

# ── Tier limits ──
FREE_DAILY_LIMIT = 3
SUPPORTER_DAILY_LIMIT = 10

# ── Model pricing (per token) ──
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-6": {
        "input": 3.0 / 1_000_000,
        "output": 15.0 / 1_000_000,
    },
    "claude-haiku-4-5-20251001": {
        "input": 0.80 / 1_000_000,
        "output": 4.0 / 1_000_000,
    },
}

DEFAULT_MODEL = "claude-sonnet-4-6"
HAIKU_MODEL = "claude-haiku-4-5-20251001"


def _today_start_utc() -> str:
    """Return midnight UTC today as ISO string."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _tomorrow_start_utc() -> str:
    """Return midnight UTC tomorrow as ISO string (quota reset time)."""
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = tomorrow.replace(day=tomorrow.day + 1)
    return tomorrow.isoformat()


def _get_user_limit(user_id: str) -> int:
    """Look up the daily limit based on supporter status."""
    try:
        result = (
            supabase.table("user_profiles")
            .select("supporter")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result and result.data and result.data.get("supporter"):
            return SUPPORTER_DAILY_LIMIT
    except Exception:
        pass
    return FREE_DAILY_LIMIT


def check_ai_quota(user_id: str) -> dict:
    """Check if user is within their daily AI quota.

    Returns usage info dict. Raises HTTPException 429 if quota exceeded.
    """
    today = _today_start_utc()
    limit = _get_user_limit(user_id)

    result = (
        supabase.table("ai_usage_log")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("cached", False)
        .gte("created_at", today)
        .execute()
    )

    used = result.count or 0
    remaining = max(0, limit - used)
    resets_at = _tomorrow_start_utc()

    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "message": (
                    f"Daily AI quota reached ({limit} analyses per day). "
                    f"Resets at midnight UTC."
                ),
                "used": used,
                "limit": limit,
                "remaining": 0,
                "resets_at": resets_at,
                "haiku_available": True,
            },
        )

    return {
        "used": used,
        "remaining": remaining,
        "limit": limit,
        "resets_at": resets_at,
    }


def get_available_models(user_id: str) -> list[str]:
    """Return which models the user can use based on remaining quota."""
    today = _today_start_utc()
    limit = _get_user_limit(user_id)

    result = (
        supabase.table("ai_usage_log")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("cached", False)
        .gte("created_at", today)
        .execute()
    )
    used = result.count or 0

    if used < limit:
        return [DEFAULT_MODEL, HAIKU_MODEL]
    return [HAIKU_MODEL]


def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    model: str = DEFAULT_MODEL,
) -> float:
    """Calculate estimated cost from token counts and model."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[DEFAULT_MODEL])
    return round(
        input_tokens * pricing["input"] + output_tokens * pricing["output"],
        5,
    )


def log_ai_usage(
    user_id: str,
    endpoint: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached: bool = False,
) -> None:
    """Record an AI API call in the usage log."""
    cost = estimate_cost(input_tokens, output_tokens) if not cached else 0.0

    supabase.table("ai_usage_log").insert(
        {
            "user_id": user_id,
            "endpoint": endpoint,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": cost,
            "cached": cached,
        }
    ).execute()


def get_usage_summary(user_id: str) -> dict:
    """Get today's usage summary and recent history for a user."""
    today = _today_start_utc()
    resets_at = _tomorrow_start_utc()
    limit = _get_user_limit(user_id)

    # Today's count (non-cached only)
    count_result = (
        supabase.table("ai_usage_log")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("cached", False)
        .gte("created_at", today)
        .execute()
    )
    used = count_result.count or 0

    # Recent 20 entries
    recent_result = (
        supabase.table("ai_usage_log")
        .select(
            "endpoint, model, input_tokens, output_tokens, estimated_cost_usd, cached, created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    models = get_available_models(user_id)

    return {
        "today": {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "resets_at": resets_at,
            "available_models": models,
        },
        "recent": recent_result.data or [],
    }
