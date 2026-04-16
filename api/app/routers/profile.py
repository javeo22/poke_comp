from collections import defaultdict
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from postgrest.types import CountMethod

from app.auth import get_current_user
from app.database import supabase
from app.models.profile import (
    ExpandedStats,
    FullProfileResponse,
    ProfileResponse,
    ProfileUpdate,
    RecentFormEntry,
)

router = APIRouter(prefix="/profile", tags=["profile"])


def _get_sprite_url(pokemon_id: int | None) -> str | None:
    """Fetch sprite_url from pokemon table for the given ID."""
    if not pokemon_id:
        return None
    result = supabase.table("pokemon").select("sprite_url").eq("id", pokemon_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    return rows[0]["sprite_url"] if rows else None


def _compute_expanded_stats(user_id: str) -> ExpandedStats:
    """Compute expanded battle stats from matchup_log, teams, and user_pokemon."""
    # Counts
    teams_result = (
        supabase.table("teams")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .execute()
    )
    roster_result = (
        supabase.table("user_pokemon")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .execute()
    )
    team_count = teams_result.count or 0
    roster_count = roster_result.count or 0

    # All matchups ordered by date (newest first)
    matchup_result = (
        supabase.table("matchup_log")
        .select("outcome, my_team_id, opponent_team_data, played_at")
        .eq("user_id", user_id)
        .order("played_at", desc=True)
        .execute()
    )
    all_matchups: list[dict] = matchup_result.data  # type: ignore[assignment]

    if not all_matchups:
        return ExpandedStats(team_count=team_count, roster_count=roster_count)

    # Overall win/loss
    wins = sum(1 for m in all_matchups if m["outcome"] == "win")
    total = len(all_matchups)
    win_rate = round(wins / total * 100, 1) if total else 0.0

    # Streaks (walk from newest to oldest)
    current_streak = 0
    current_streak_type = all_matchups[0]["outcome"] if all_matchups else "none"
    for m in all_matchups:
        if m["outcome"] == current_streak_type:
            current_streak += 1
        else:
            break

    # Best streak (check both win and loss streaks, report the best win streak)
    best_win_streak = 0
    run = 0
    for m in all_matchups:
        if m["outcome"] == "win":
            run += 1
            best_win_streak = max(best_win_streak, run)
        else:
            run = 0

    # Matches this week
    week_ago = datetime.now(UTC) - timedelta(days=7)
    matches_this_week = sum(
        1
        for m in all_matchups
        if datetime.fromisoformat(m["played_at"].replace("Z", "+00:00")) >= week_ago
    )

    # Most used team
    team_usage: dict[str, int] = defaultdict(int)
    for m in all_matchups:
        tid = m.get("my_team_id")
        if tid:
            team_usage[tid] += 1

    most_used_team = None
    most_used_team_id = None
    if team_usage:
        top_team_id = max(team_usage, key=lambda k: team_usage[k])
        most_used_team_id = top_team_id
        team_name_result = (
            supabase.table("teams").select("name").eq("id", top_team_id).execute()
        )
        team_rows: list[dict] = team_name_result.data  # type: ignore[assignment]
        most_used_team = team_rows[0]["name"] if team_rows else top_team_id

    # Most faced opponent
    opp_counts: dict[str, int] = defaultdict(int)
    for m in all_matchups:
        for p in m.get("opponent_team_data") or []:
            opp_counts[p.get("name", "Unknown")] += 1
    most_faced_opponent = max(opp_counts, key=lambda k: opp_counts[k]) if opp_counts else None

    # Recent form (last 10)
    recent_form = [
        RecentFormEntry(outcome=m["outcome"], played_at=m["played_at"])
        for m in all_matchups[:10]
    ]

    return ExpandedStats(
        team_count=team_count,
        roster_count=roster_count,
        matches_played=total,
        win_rate=win_rate,
        current_streak=current_streak,
        best_streak=best_win_streak,
        streak_type=current_streak_type,
        matches_this_week=matches_this_week,
        most_used_team=most_used_team,
        most_used_team_id=most_used_team_id,
        most_faced_opponent=most_faced_opponent,
        recent_form=recent_form,
    )


@router.get("", response_model=FullProfileResponse)
def get_profile(user_id: str = Depends(get_current_user)):
    """Get current user's profile with expanded stats. Auto-creates profile on first access."""
    # Upsert profile (auto-create if missing)
    supabase.table("user_profiles").upsert(
        {"user_id": user_id}, on_conflict="user_id"
    ).execute()

    # Fetch profile row
    profile_result = (
        supabase.table("user_profiles")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    profile_data: dict = profile_result.data  # type: ignore[assignment]

    # Resolve avatar sprite
    avatar_sprite_url = _get_sprite_url(profile_data.get("avatar_pokemon_id"))

    profile = ProfileResponse(
        user_id=profile_data["user_id"],
        display_name=profile_data.get("display_name"),
        avatar_pokemon_id=profile_data.get("avatar_pokemon_id"),
        avatar_sprite_url=avatar_sprite_url,
        created_at=profile_data["created_at"],
        updated_at=profile_data["updated_at"],
    )

    # Fetch auth user metadata (email, created_at)
    email = None
    member_since = profile_data["created_at"]
    try:
        auth_user = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user and auth_user.user:
            email = auth_user.user.email
            member_since = (
                auth_user.user.created_at
                if auth_user.user.created_at
                else profile_data["created_at"]
            )
    except Exception:
        pass  # Auth metadata is non-critical; fall back to profile created_at

    stats = _compute_expanded_stats(user_id)

    return FullProfileResponse(
        profile=profile,
        stats=stats,
        member_since=member_since,
        email=email,
    )


@router.put("", response_model=ProfileResponse)
def update_profile(body: ProfileUpdate, user_id: str = Depends(get_current_user)):
    """Update display name and/or avatar Pokemon."""
    update_data: dict = {}

    if body.display_name is not None:
        update_data["display_name"] = body.display_name.strip() if body.display_name else None

    if body.avatar_pokemon_id is not None:
        # Validate Pokemon exists and is Champions-eligible
        poke_result = (
            supabase.table("pokemon")
            .select("id, champions_eligible")
            .eq("id", body.avatar_pokemon_id)
            .execute()
        )
        poke_rows: list[dict] = poke_result.data  # type: ignore[assignment]
        if not poke_rows:
            raise HTTPException(status_code=400, detail="Pokemon not found")
        if not poke_rows[0].get("champions_eligible"):
            raise HTTPException(
                status_code=400, detail="Avatar must be a Champions-eligible Pokemon"
            )
        update_data["avatar_pokemon_id"] = body.avatar_pokemon_id
    elif "avatar_pokemon_id" in (body.model_fields_set or set()):
        # Explicitly set to None -> clear avatar
        update_data["avatar_pokemon_id"] = None

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["user_id"] = user_id
    result = (
        supabase.table("user_profiles")
        .upsert(update_data, on_conflict="user_id")
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=400, detail="Failed to update profile")

    row = rows[0]
    avatar_sprite_url = _get_sprite_url(row.get("avatar_pokemon_id"))

    return ProfileResponse(
        user_id=row["user_id"],
        display_name=row.get("display_name"),
        avatar_pokemon_id=row.get("avatar_pokemon_id"),
        avatar_sprite_url=avatar_sprite_url,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
