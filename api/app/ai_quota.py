"""Per-user AI usage quota enforcement and logging."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from postgrest.types import CountMethod

from app.config import settings
from app.database import supabase

# ── Tier limits ──
FREE_DAILY_LIMIT = 3
SUPPORTER_DAILY_LIMIT = 30
SUPPORTER_MONTHLY_SOFT_CAP = 600


def _admin_user_ids() -> set[str]:
    """Parse the ADMIN_USER_IDS comma-list from settings."""
    raw = settings.admin_user_ids
    if not raw:
        return set()
    return {uid.strip() for uid in raw.split(",") if uid.strip()}


def _is_admin(user_id: str) -> bool:
    """Admins bypass the daily + monthly quota and always use Sonnet."""
    return user_id in _admin_user_ids()


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
    """Return midnight UTC tomorrow as ISO string (daily quota reset)."""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return (today + timedelta(days=1)).isoformat()


def _monthly_start_utc() -> str:
    """Return first day of current month at 00:00 UTC as ISO string."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


def _next_month_start_utc() -> str:
    """Return first day of next month at 00:00 UTC as ISO string."""
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        nxt = start.replace(year=start.year + 1, month=1)
    else:
        nxt = start.replace(month=start.month + 1)
    return nxt.isoformat()


def _is_supporter(user_id: str) -> bool:
    """Return True if the user has supporter status set on user_profiles."""
    try:
        result = (
            supabase.table("user_profiles")
            .select("supporter")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result and result.data and result.data.get("supporter"):
            return True
    except Exception:
        pass
    return False


def _get_user_limit(user_id: str) -> int:
    """Look up the daily limit based on supporter status."""
    return SUPPORTER_DAILY_LIMIT if _is_supporter(user_id) else FREE_DAILY_LIMIT


def _get_monthly_usage(user_id: str) -> int:
    """Count non-cached AI requests for the user in the current UTC month."""
    month_start = _monthly_start_utc()
    result = (
        supabase.table("ai_usage_log")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("cached", False)
        .gte("created_at", month_start)
        .execute()
    )
    return result.count or 0


def check_ai_quota(user_id: str) -> dict:
    """Check if user is within their daily AI quota and (for supporters)
    under the monthly fair-use soft cap.

    Admins bypass all quotas. Returns usage info dict. Raises
    HTTPException 429 if a non-admin non-unlimited user exceeds their cap.
    """
    if _is_admin(user_id):
        return {
            "used": 0,
            "remaining": -1,
            "limit": -1,
            "resets_at": _tomorrow_start_utc(),
            "unlimited": True,
        }

    today = _today_start_utc()
    supporter = _is_supporter(user_id)
    limit = SUPPORTER_DAILY_LIMIT if supporter else FREE_DAILY_LIMIT

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
                    f"Daily AI quota reached ({limit} analyses per day). Resets at midnight UTC."
                ),
                "used": used,
                "limit": limit,
                "remaining": 0,
                "resets_at": resets_at,
                "haiku_available": True,
            },
        )

    if supporter:
        monthly_used = _get_monthly_usage(user_id)
        if monthly_used >= SUPPORTER_MONTHLY_SOFT_CAP:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": (
                        "Monthly fair-use soft cap reached "
                        f"({SUPPORTER_MONTHLY_SOFT_CAP} analyses per month). "
                        "Contact support for reset."
                    ),
                    "soft_cap_hit": True,
                    "monthly_used": monthly_used,
                    "monthly_soft_cap": SUPPORTER_MONTHLY_SOFT_CAP,
                    "resets_at": _next_month_start_utc(),
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
    if _is_admin(user_id):
        return [DEFAULT_MODEL, HAIKU_MODEL]

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
    """Get today's usage summary and recent history for a user.

    Supporter users also receive a `month` block reporting monthly usage
    against the fair-use soft cap. Non-supporters get `month: None`.
    Admins get `unlimited: true` and no cap rendering is implied.
    """
    today = _today_start_utc()
    resets_at = _tomorrow_start_utc()
    admin = _is_admin(user_id)
    supporter = _is_supporter(user_id)
    limit = SUPPORTER_DAILY_LIMIT if supporter else FREE_DAILY_LIMIT

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

    month_block: dict | None = None
    if supporter:
        monthly_used = _get_monthly_usage(user_id)
        month_block = {
            "used": monthly_used,
            "soft_cap": SUPPORTER_MONTHLY_SOFT_CAP,
            "remaining": max(0, SUPPORTER_MONTHLY_SOFT_CAP - monthly_used),
            "resets_at": _next_month_start_utc(),
        }

    return {
        "today": {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "resets_at": resets_at,
            "available_models": models,
        },
        "month": month_block,
        "supporter": supporter,
        "unlimited": admin,
        "recent": recent_result.data or [],
    }
