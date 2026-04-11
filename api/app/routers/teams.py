from fastapi import APIRouter, HTTPException, Query
from postgrest.types import CountMethod

from app.config import settings
from app.database import supabase
from app.models.team import TeamCreate, TeamList, TeamResponse, TeamUpdate

router = APIRouter(prefix="/teams", tags=["teams"])

# TODO: Replace with real auth user extraction
USER_ID = settings.dev_user_id


@router.get("", response_model=TeamList)
def list_teams(
    format: str | None = Query(None, description="Filter by format (singles, doubles, megas)"),
    archetype_tag: str | None = Query(None, description="Filter by archetype tag"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
        supabase.table("teams")
        .select("*", count=CountMethod.exact)
        .eq("user_id", USER_ID)
    )

    if format:
        query = query.eq("format", format)
    if archetype_tag:
        query = query.ilike("archetype_tag", f"%{archetype_tag}%")

    result = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return TeamList(
        data=[TeamResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(team_id: str):
    result = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", USER_ID)
        .single()
        .execute()
    )
    return TeamResponse.model_validate(result.data)


def _validate_mega(pokemon_ids: list[str], mega_pokemon_id: str | None) -> None:
    """Validate that at most one mega is designated and it's in the team."""
    if mega_pokemon_id and mega_pokemon_id not in pokemon_ids:
        raise HTTPException(
            status_code=400,
            detail="Mega Pokemon must be a member of the team",
        )


@router.post("", response_model=TeamResponse, status_code=201)
def create_team(body: TeamCreate):
    _validate_mega(body.pokemon_ids, body.mega_pokemon_id)

    data = body.model_dump(exclude_none=True)
    data["user_id"] = USER_ID

    result = supabase.table("teams").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create team")
    return TeamResponse.model_validate(result.data[0])


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(team_id: str, body: TeamUpdate):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If updating pokemon_ids or mega, validate
    if body.pokemon_ids is not None or body.mega_pokemon_id is not None:
        # Need current team state if partial update
        if body.pokemon_ids is None or body.mega_pokemon_id is None:
            current = (
                supabase.table("teams")
                .select("pokemon_ids, mega_pokemon_id")
                .eq("id", team_id)
                .eq("user_id", USER_ID)
                .single()
                .execute()
            )
            current_row: dict = current.data  # type: ignore[assignment]
            ids = body.pokemon_ids or current_row["pokemon_ids"]
            mega = (
                body.mega_pokemon_id
                if body.mega_pokemon_id is not None
                else current_row.get("mega_pokemon_id")
            )
        else:
            ids = body.pokemon_ids
            mega = body.mega_pokemon_id
        _validate_mega(list(ids), mega)

    result = (
        supabase.table("teams")
        .update(data)
        .eq("id", team_id)
        .eq("user_id", USER_ID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    return TeamResponse.model_validate(result.data[0])


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: str):
    result = (
        supabase.table("teams")
        .delete()
        .eq("id", team_id)
        .eq("user_id", USER_ID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")
