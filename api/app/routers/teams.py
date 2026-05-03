from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from postgrest.types import CountMethod
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.database import supabase
from app.models.team import TeamCreate, TeamList, TeamResponse, TeamUpdate
from app.services.showdown_parser import (
    export_showdown_paste,
    parse_showdown_paste,
    resolve_pokemon_ids,
)
from app.validators import validate_champions_pokemon_batch

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=TeamList)
def list_teams(
    format: str | None = Query(None, description="Filter by format (singles, doubles)"),
    archetype_tag: str | None = Query(None, description="Filter by archetype tag"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
):
    query = supabase.table("teams").select("*", count=CountMethod.exact).eq("user_id", user_id)

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
def get_team(team_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return TeamResponse.model_validate(result.data)


def _resolve_roster_pokemon_ids(user_id: str, roster_ids: list[str]) -> list[int]:
    """Resolve user_pokemon UUIDs to pokemon species IDs for validation.

    Verifies that all roster entries exist and belong to the user.
    """
    result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    found = {row["id"]: row["pokemon_id"] for row in rows}

    missing = set(roster_ids) - set(found.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Roster entries not found: {sorted(missing)}",
        )

    return [found[rid] for rid in roster_ids]


def _validate_mega(pokemon_ids: list[str], mega_pokemon_id: str | None) -> None:
    """Validate that at most one mega is designated and it's in the team."""
    if mega_pokemon_id and mega_pokemon_id not in pokemon_ids:
        raise HTTPException(
            status_code=400,
            detail="Mega Pokemon must be a member of the team",
        )


@router.post("", response_model=TeamResponse, status_code=201)
def create_team(body: TeamCreate, user_id: str = Depends(get_current_user)):
    species_ids = _resolve_roster_pokemon_ids(user_id, body.pokemon_ids)
    validate_champions_pokemon_batch(species_ids)
    _validate_mega(body.pokemon_ids, body.mega_pokemon_id)

    data = body.model_dump(exclude_none=True)
    data["user_id"] = user_id

    result = supabase.table("teams").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create team")
    return TeamResponse.model_validate(result.data[0])


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(team_id: str, body: TeamUpdate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate Champions eligibility when pokemon_ids change
    if body.pokemon_ids is not None:
        species_ids = _resolve_roster_pokemon_ids(user_id, body.pokemon_ids)
        validate_champions_pokemon_batch(species_ids)

    # If updating pokemon_ids or mega, validate mega membership
    if body.pokemon_ids is not None or body.mega_pokemon_id is not None:
        # Need current team state if partial update
        if body.pokemon_ids is None or body.mega_pokemon_id is None:
            current = (
                supabase.table("teams")
                .select("pokemon_ids, mega_pokemon_id")
                .eq("id", team_id)
                .eq("user_id", user_id)
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

    result = supabase.table("teams").update(data).eq("id", team_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    return TeamResponse.model_validate(result.data[0])


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: str, user_id: str = Depends(get_current_user)):
    result = supabase.table("teams").delete().eq("id", team_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")


# ── Showdown Import / Export ─────────────────────────────────────────────


class ImportRequest(BaseModel):
    paste: str = Field(description="Showdown paste text")
    team_name: str = Field(description="Name for the imported team")
    format: str = Field(pattern=r"^(singles|doubles)$")


class PreviewRequest(BaseModel):
    paste: str = Field(description="Showdown paste text")


class PreviewPokemon(BaseModel):
    name: str
    pokemon_id: int | None = None
    item: str | None = None
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict[str, int] | None = None
    moves: list[str] = []
    resolved: bool = False


class PreviewResponse(BaseModel):
    pokemon: list[PreviewPokemon]
    warnings: list[str]


class ImportResponse(BaseModel):
    team: TeamResponse
    pokemon_created: int
    warnings: list[str]


@router.post("/import/preview", response_model=PreviewResponse)
def preview_import(body: PreviewRequest, _user_id: str = Depends(get_current_user)):
    """Preview a Showdown paste without creating any data.

    Parses and resolves names to IDs so the user can review before confirming.
    """
    parsed = parse_showdown_paste(body.paste)
    if not parsed.pokemon:
        raise HTTPException(
            status_code=400,
            detail="No Pokemon found in paste. Check the format.",
        )

    parsed = resolve_pokemon_ids(parsed)

    preview_pokemon = [
        PreviewPokemon(
            name=p.name,
            pokemon_id=p.pokemon_id,
            item=p.item,
            item_id=p.item_id,
            ability=p.ability,
            nature=p.nature,
            stat_points=p.stat_points,
            moves=p.moves,
            resolved=p.pokemon_id is not None,
        )
        for p in parsed.pokemon
    ]

    return PreviewResponse(pokemon=preview_pokemon, warnings=parsed.warnings)


@router.post("/import", response_model=ImportResponse, status_code=201)
def import_team(body: ImportRequest, user_id: str = Depends(get_current_user)):
    """Import a team from Showdown paste format.

    Parses the paste, resolves Pokemon/item names to DB IDs,
    creates user_pokemon entries, and assembles a team.
    """
    parsed = parse_showdown_paste(body.paste)
    if not parsed.pokemon:
        raise HTTPException(
            status_code=400,
            detail="No Pokemon found in paste. Check the format.",
        )

    # Resolve names to IDs
    parsed = resolve_pokemon_ids(parsed)

    # Filter to Pokemon that resolved successfully
    resolved = [p for p in parsed.pokemon if p.pokemon_id is not None]
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail=f"No Pokemon could be resolved. Warnings: {parsed.warnings}",
        )

    # Validate Champions eligibility (batch)
    pokemon_ids = [p.pokemon_id for p in resolved if p.pokemon_id]
    validate_champions_pokemon_batch(pokemon_ids)

    # Create user_pokemon entries — store their UUIDs for the team
    created_roster_ids: list[str] = []
    for p in resolved:
        row: dict[str, Any] = {
            "user_id": user_id,
            "pokemon_id": p.pokemon_id,
            "ability": p.ability,
            "nature": p.nature,
            "stat_points": p.stat_points,
            "moves": p.moves if len(p.moves) == 4 else None,
            "item_id": p.item_id,
            "build_status": "built",
            "vp_spent": 0,
        }
        result = supabase.table("user_pokemon").insert(row).execute()
        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        if rows:
            created_roster_ids.append(rows[0]["id"])

    # Create the team
    team_data: dict[str, Any] = {
        "user_id": user_id,
        "name": body.team_name,
        "format": body.format,
        "pokemon_ids": created_roster_ids[:6],
    }
    team_result = supabase.table("teams").insert(team_data).execute()
    team_rows: list[dict[str, Any]] = team_result.data  # type: ignore[assignment]
    if not team_rows:
        raise HTTPException(status_code=500, detail="Failed to create team")

    return ImportResponse(
        team=TeamResponse.model_validate(team_rows[0]),
        pokemon_created=len(created_roster_ids),
        warnings=parsed.warnings,
    )


@router.get("/{team_id}/export", response_class=PlainTextResponse)
def export_team(team_id: str, user_id: str = Depends(get_current_user)):
    """Export a team in Showdown paste format."""
    # Fetch team
    team = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    team_row: dict[str, Any] = team.data  # type: ignore[assignment]
    roster_ids: list[str] = team_row["pokemon_ids"]

    # Fetch user_pokemon entries (roster builds) by their UUIDs
    builds_result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id, ability, nature, stat_points, moves, item_id")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    builds: list[dict[str, Any]] = builds_result.data  # type: ignore[assignment]
    build_map = {b["id"]: b for b in builds}

    # Fetch Pokemon base data for names
    species_ids = list({b["pokemon_id"] for b in builds})
    poke_result = supabase.table("pokemon").select("id, name").in_("id", species_ids).execute()
    poke_rows: list[dict[str, Any]] = poke_result.data  # type: ignore[assignment]
    poke_map = {r["id"]: r["name"] for r in poke_rows}

    # Fetch item names
    item_ids = [b["item_id"] for b in builds if b.get("item_id")]
    item_map: dict[int, str] = {}
    if item_ids:
        items_result = supabase.table("items").select("id, name").in_("id", item_ids).execute()
        item_rows: list[dict[str, Any]] = items_result.data  # type: ignore[assignment]
        item_map = {r["id"]: r["name"] for r in item_rows}

    # Assemble export data in team order
    export_data: list[dict[str, Any]] = []
    for rid in roster_ids:
        build = build_map.get(rid, {})
        pokemon_id = build.get("pokemon_id")
        name = poke_map.get(pokemon_id, f"Pokemon #{pokemon_id}") if pokemon_id else "Unknown"
        item_name = item_map.get(build.get("item_id", 0))
        export_data.append(
            {
                "name": name,
                "item_name": item_name,
                "ability": build.get("ability"),
                "nature": build.get("nature"),
                "stat_points": build.get("stat_points"),
                "moves": build.get("moves") or [],
            }
        )

    return export_showdown_paste(export_data)
