from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database import supabase


class ReviewService:
    @staticmethod
    def _first_row(data: object, not_found_message: str) -> Dict[str, Any]:
        if not isinstance(data, list) or not data or not isinstance(data[0], dict):
            raise ValueError(not_found_message)
        return data[0]

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
        return ReviewService._first_row(response.data, "Failed to stage review item.")

    @staticmethod
    async def approve_item(review_id: str, admin_user_id: str) -> Dict[str, Any]:
        """
        Approves an item in the queue and moves it to the appropriate production table.
        """
        # 1. Fetch the record
        response = supabase.table("scraper_review_queue").select("*").eq("id", review_id).execute()
        if not response.data:
            raise ValueError(f"Review item {review_id} not found.")

        item = ReviewService._first_row(response.data, f"Review item {review_id} not found.")
        if item["status"] != "PENDING":
            raise ValueError(f"Review item {review_id} is already {item['status']}.")

        source = item["source"]
        payload = item["payload"]

        # 2. Move to production table. Use explicit conflict targets so approving
        # a duplicate staged row refreshes the existing production record instead
        # of surfacing a generic database conflict to the admin UI.
        target_table = ""
        try:
            if source == "limitless":
                target_table = "tournament_teams"
                # Expected payload: { "tournament_name": "...", "placement": 1,
                # "pokemon_ids": [...], "archetype": "..." }
                supabase.table(target_table).upsert(
                    payload,
                    on_conflict="tournament_name,placement",
                ).execute()
            elif source == "pikalytics":
                target_table = "pokemon_usage"
                # Expected payload: { "pokemon_name": "...", "format": "...",
                # "usage_percent": ..., "snapshot_date": ... }
                supabase.table(target_table).upsert(
                    payload,
                    on_conflict="pokemon_name,format,snapshot_date",
                ).execute()
            else:
                raise ValueError(f"Unknown source for review approval: {source}")
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(
                f"Could not apply {source} review item to "
                f"{target_table or 'production table'}: {exc}"
            ) from exc

        # 3. Mark as APPROVED
        update_data = {
            "status": "APPROVED",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin_user_id,
        }
        update_response = (
            supabase.table("scraper_review_queue").update(update_data).eq("id", review_id).execute()
        )
        return ReviewService._first_row(
            update_response.data,
            f"Review item {review_id} not found after approval.",
        )

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
        return ReviewService._first_row(update_response.data, f"Review item {review_id} not found.")
