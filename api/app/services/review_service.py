from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database import supabase


class ReviewService:
    @staticmethod
    async def stage_item(
        source: str,
        payload: Dict[str, Any],
        external_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Inserts a new item into the scraper_review_queue for manual review.
        """
        data = {
            "source": source,
            "payload": payload,
            "external_id": external_id,
            "metadata": metadata,
            "status": "PENDING",
        }
        # supabase-py is synchronous, but we wrap it in async as per task requirements
        response = supabase.table("scraper_review_queue").insert(data).execute()
        return response.data[0]

    @staticmethod
    async def approve_item(review_id: str, admin_user_id: str) -> Dict[str, Any]:
        """
        Approves an item in the queue and moves it to the appropriate production table.
        """
        # 1. Fetch the record
        response = supabase.table("scraper_review_queue").select("*").eq("id", review_id).execute()
        if not response.data:
            raise ValueError(f"Review item {review_id} not found.")

        item = response.data[0]
        if item["status"] != "PENDING":
            raise ValueError(f"Review item {review_id} is already {item['status']}.")

        source = item["source"]
        payload = item["payload"]

        # 2. Move to production table
        if source == "limitless":
            # Map payload to tournament_teams
            # Expected payload: { "tournament_name": "...", "placement": 1,
            # "pokemon_ids": [...], "archetype": "..." }
            supabase.table("tournament_teams").insert(payload).execute()
        elif source == "pikalytics":
            # Map payload to pokemon_usage
            # Expected payload: { "pokemon_name": "...", "format": "...",
            # "usage_percent": ..., ... }
            supabase.table("pokemon_usage").upsert(payload).execute()

        else:
            raise ValueError(f"Unknown source for review approval: {source}")

        # 3. Mark as APPROVED
        update_data = {
            "status": "APPROVED",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin_user_id,
        }
        update_response = (
            supabase.table("scraper_review_queue").update(update_data).eq("id", review_id).execute()
        )
        return update_response.data[0]

    @staticmethod
    async def reject_item(review_id: str, admin_user_id: str) -> Dict[str, Any]:
        """
        Rejects an item in the queue.
        """
        update_data = {
            "status": "REJECTED",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin_user_id,
        }
        update_response = (
            supabase.table("scraper_review_queue").update(update_data).eq("id", review_id).execute()
        )
        if not update_response.data:
            raise ValueError(f"Review item {review_id} not found.")

        return update_response.data[0]
