import logging
from typing import Any

from app.database import supabase
from postgrest.exceptions import APIError

logger = logging.getLogger(__name__)


def fetch_tournament_context(pokemon_ids: list[int], limit: int = 5) -> list[dict[str, Any]]:
    """
    Fetch tournament context based on team overlap using get_similar_tournament_teams RPC.

    Args:
        pokemon_ids: List of Pokemon IDs to match against.
        limit: Maximum number of results to return.

    Returns:
        List of similar tournament teams. Returns empty list on failure.
    """
    if not pokemon_ids:
        return []

    try:
        # Note: supabase-py's rpc call is synchronous.
        result = supabase.rpc(
            "get_similar_tournament_teams", {"p_pokemon_ids": pokemon_ids}
        ).execute()

        if not result.data:
            return []

        return result.data[:limit]
    except APIError as e:
        logger.error(f"Supabase RPC error in fetch_tournament_context: {e}")
        return []
    except Exception as e:
        logger.exception(f"Unexpected error in fetch_tournament_context: {e}")
        return []


def fetch_personal_context(
    user_id: str, opponent_names: list[str], limit: int = 5
) -> list[dict[str, Any]]:
    """
    Fetch personal matchup context based on opponent team overlap using get_similar_matchups RPC.

    Args:
        user_id: The UUID of the user.
        opponent_names: List of opponent Pokemon names to match against.
        limit: Maximum number of results to return.

    Returns:
        List of similar personal matchups. Returns empty list on failure.
    """
    if not opponent_names:
        return []

    try:
        result = supabase.rpc(
            "get_similar_matchups",
            {"p_user_id": user_id, "p_opponent_names": opponent_names},
        ).execute()

        if not result.data:
            return []

        return result.data[:limit]
    except APIError as e:
        logger.error(f"Supabase RPC error in fetch_personal_context: {e}")
        return []
    except Exception as e:
        logger.exception(f"Unexpected error in fetch_personal_context: {e}")
        return []
