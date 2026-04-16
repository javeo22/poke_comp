"""AI usage stats endpoint -- lets users see their daily quota and history."""

from fastapi import APIRouter, Depends

from app.ai_quota import get_usage_summary
from app.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/usage")
def get_ai_usage(user_id: str = Depends(get_current_user)):
    """Return the current user's AI usage summary for today."""
    return get_usage_summary(user_id)
