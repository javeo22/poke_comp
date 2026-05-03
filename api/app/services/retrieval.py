import logging
from typing import Any

from postgrest.exceptions import APIError

from app.database import supabase

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


def fetch_personal_win_rates(user_id: str, pokemon_names: list[str]) -> dict[str, dict[str, Any]]:
    """
    Fetch user's win/loss counts for specific opponent species.

    Args:
        user_id: The UUID of the user.
        pokemon_names: List of opponent Pokemon names to check.

    Returns:
        Dict mapping Pokemon name to {wins, losses, total, win_rate}.
    """
    if not pokemon_names:
        return {}

    try:
        # Fetch matchups and aggregate. For large histories, this would move to an RPC.
        result = (
            supabase.table("matchup_log")
            .select("outcome, opponent_team_data")
            .eq("user_id", user_id)
            .execute()
        )
        all_rows: list[dict] = result.data or []

        stats = {name: {"wins": 0, "losses": 0} for name in pokemon_names}
        search_names = {name.lower() for name in pokemon_names}

        for r in all_rows:
            opp_team = r.get("opponent_team_data") or []
            outcome = r.get("outcome")
            for p in opp_team:
                p_name = p.get("name", "")
                if p_name.lower() in search_names:
                    # Find the matching name from our input list
                    match = next((n for n in pokemon_names if n.lower() == p_name.lower()), None)
                    if match:
                        if outcome == "win":
                            stats[match]["wins"] += 1
                        else:
                            stats[match]["losses"] += 1

        final_stats = {}
        for name, counts in stats.items():
            wins = counts["wins"]
            losses = counts["losses"]
            total = wins + losses
            if total > 0:
                final_stats[name] = {
                    "wins": wins,
                    "losses": losses,
                    "total": total,
                    "win_rate": round(wins / total, 3),
                }
        return final_stats
    except Exception as e:
        logger.error(f"Error in fetch_personal_win_rates: {e}")
        return {}
