from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.database import supabase
from app.routers.admin import get_admin_user
from app.services.review_service import ReviewService

router = APIRouter(prefix="/admin/review", tags=["admin-review"])


@router.get("/pending", response_model=List[Dict[str, Any]])
async def get_pending_reviews(_: str = Depends(get_admin_user)):
    """List all pending items in the review queue."""
    try:
        response = (
            supabase.table("scraper_review_queue")
            .select("*")
            .eq("status", "PENDING")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pending reviews: {str(e)}")


@router.post("/{review_id}/approve")
async def approve_review(review_id: str, admin_user_id: str = Depends(get_admin_user)):
    """Approve a pending review item."""
    try:
        return await ReviewService.approve_item(review_id, admin_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve item: {str(e)}")


@router.post("/{review_id}/reject")
async def reject_review(review_id: str, admin_user_id: str = Depends(get_admin_user)):
    """Reject a pending review item."""
    try:
        return await ReviewService.reject_item(review_id, admin_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject item: {str(e)}")
