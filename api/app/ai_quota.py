"""Per-user AI usage quota enforcement and logging."""

from datetime import datetime, timezone

from fastapi import HTTPException
from postgrest.types import CountMethod

from app.database import supabase

# Daily limit per user (non-cached AI requests)
DAILY_LIMIT = 10

# Sonnet 4.6 pricing (per token)
INPUT_PRICE = 3.0 / 1_000_000  # $3 per 1M input tokens
OUTPUT_PRICE = 15.0 / 1_000_000  # $15 per 1M output tokens


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


def check_ai_quota(user_id: str) -> dict:
    """Check if user is within their daily AI quota.

    Returns usage info dict. Raises HTTPException 429 if quota exceeded.
    """
    today = _today_start_utc()

    result = (
        supabase.table("ai_usage_log")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("cached", False)
        .gte("created_at", today)
        .execute()
    )

    used = result.count or 0
    remaining = max(0, DAILY_LIMIT - used)
    resets_at = _tomorrow_start_utc()

    if used >= DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "message": (
                    f"Daily AI quota reached ({DAILY_LIMIT} analyses per day). "
                    f"Resets at midnight UTC."
                ),
                "used": used,
                "limit": DAILY_LIMIT,
                "resets_at": resets_at,
            },
        )

    return {"used": used, "remaining": remaining, "limit": DAILY_LIMIT, "resets_at": resets_at}


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated cost from token counts."""
    return round(input_tokens * INPUT_PRICE + output_tokens * OUTPUT_PRICE, 5)


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

    return {
        "today": {
            "used": used,
            "limit": DAILY_LIMIT,
            "remaining": max(0, DAILY_LIMIT - used),
            "resets_at": resets_at,
        },
        "recent": recent_result.data or [],
    }
