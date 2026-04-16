"""Public endpoints (no auth required): user profiles and shared cheatsheets."""

from fastapi import APIRouter, HTTPException
from postgrest.types import CountMethod
from pydantic import BaseModel

from app.database import supabase

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats")
def get_public_stats():
    """Public stats for the landing page. No auth required."""
    try:
        pokemon = supabase.table("pokemon").select(
            "id", count=CountMethod.exact
        ).eq("champions_eligible", True).execute()
        teams = supabase.table("teams").select(
            "id", count=CountMethod.exact
        ).execute()
        matches = supabase.table("matchup_log").select(
            "id", count=CountMethod.exact
        ).execute()
        return {
            "pokemon_count": pokemon.count or 0,
            "teams_count": teams.count or 0,
            "matches_count": matches.count or 0,
        }
    except Exception:
        return {"pokemon_count": 0, "teams_count": 0, "matches_count": 0}


def _get_sprite_url(pokemon_id: int | None) -> str | None:
    if not pokemon_id:
        return None
    result = supabase.table("pokemon").select("sprite_url").eq("id", pokemon_id).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    return rows[0]["sprite_url"] if rows else None


class PublicProfile(BaseModel):
    username: str
    display_name: str | None = None
    avatar_pokemon_id: int | None = None
    avatar_sprite_url: str | None = None
    supporter: bool = False
    team_count: int = 0
    cheatsheet_count: int = 0


class PublicCheatsheetSummary(BaseModel):
    id: str
    team_name: str | None = None
    team_format: str | None = None
    updated_at: str


class PublicCheatsheetDetail(BaseModel):
    id: str
    team_name: str | None = None
    team_format: str | None = None
    cheatsheet_json: dict
    owner_username: str | None = None
    owner_display_name: str | None = None
    owner_avatar_sprite_url: str | None = None
    updated_at: str


@router.get("/u/{username}", response_model=PublicProfile)
def get_public_profile(username: str):
    """Get a user's public profile by username."""
    result = (
        supabase.table("user_profiles")
        .select("user_id, username, display_name, avatar_pokemon_id, supporter")
        .eq("username", username)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")

    profile = rows[0]
    user_id = profile["user_id"]

    avatar_sprite_url = _get_sprite_url(profile.get("avatar_pokemon_id"))

    # Count teams
    teams = (
        supabase.table("teams")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .execute()
    )
    # Count public cheatsheets
    cheatsheets = (
        supabase.table("team_cheatsheets")
        .select("id", count=CountMethod.exact)
        .eq("user_id", user_id)
        .eq("is_public", True)
        .execute()
    )

    return PublicProfile(
        username=profile["username"],
        display_name=profile.get("display_name"),
        avatar_pokemon_id=profile.get("avatar_pokemon_id"),
        avatar_sprite_url=avatar_sprite_url,
        supporter=bool(profile.get("supporter")),
        team_count=teams.count or 0,
        cheatsheet_count=cheatsheets.count or 0,
    )


@router.get("/u/{username}/cheatsheets", response_model=list[PublicCheatsheetSummary])
def list_public_cheatsheets(username: str):
    """List a user's public cheatsheets."""
    # Look up user_id from username
    user_result = (
        supabase.table("user_profiles")
        .select("user_id")
        .eq("username", username)
        .execute()
    )
    user_rows: list[dict] = user_result.data  # type: ignore[assignment]
    if not user_rows:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = user_rows[0]["user_id"]

    # Fetch public cheatsheets
    cs_result = (
        supabase.table("team_cheatsheets")
        .select("id, team_id, updated_at")
        .eq("user_id", user_id)
        .eq("is_public", True)
        .order("updated_at", desc=True)
        .execute()
    )
    cheatsheets: list[dict] = cs_result.data  # type: ignore[assignment]

    if not cheatsheets:
        return []

    # Resolve team names
    team_ids = [c["team_id"] for c in cheatsheets]
    teams_result = (
        supabase.table("teams")
        .select("id, name, format")
        .in_("id", team_ids)
        .execute()
    )
    team_map = {t["id"]: t for t in (teams_result.data or [])}

    return [
        PublicCheatsheetSummary(
            id=c["id"],
            team_name=team_map.get(c["team_id"], {}).get("name"),
            team_format=team_map.get(c["team_id"], {}).get("format"),
            updated_at=c["updated_at"],
        )
        for c in cheatsheets
    ]


@router.get("/cheatsheet/{cheatsheet_id}", response_model=PublicCheatsheetDetail)
def get_public_cheatsheet(cheatsheet_id: str):
    """Get a single public cheatsheet by ID."""
    result = (
        supabase.table("team_cheatsheets")
        .select("id, team_id, user_id, cheatsheet_json, updated_at")
        .eq("id", cheatsheet_id)
        .eq("is_public", True)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Cheatsheet not found or not public")

    cs = rows[0]

    # Resolve team info
    team_name = None
    team_format = None
    team_result = (
        supabase.table("teams")
        .select("name, format")
        .eq("id", cs["team_id"])
        .execute()
    )
    if team_result.data:
        team_name = team_result.data[0].get("name")
        team_format = team_result.data[0].get("format")

    # Resolve owner info
    owner_username = None
    owner_display_name = None
    owner_avatar_sprite_url = None
    profile_result = (
        supabase.table("user_profiles")
        .select("username, display_name, avatar_pokemon_id")
        .eq("user_id", cs["user_id"])
        .execute()
    )
    if profile_result.data:
        p = profile_result.data[0]
        owner_username = p.get("username")
        owner_display_name = p.get("display_name")
        owner_avatar_sprite_url = _get_sprite_url(p.get("avatar_pokemon_id"))

    return PublicCheatsheetDetail(
        id=cs["id"],
        team_name=team_name,
        team_format=team_format,
        cheatsheet_json=cs["cheatsheet_json"],
        owner_username=owner_username,
        owner_display_name=owner_display_name,
        owner_avatar_sprite_url=owner_avatar_sprite_url,
        updated_at=cs["updated_at"],
    )
