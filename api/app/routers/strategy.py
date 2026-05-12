"""Strategy notes CRUD -- admin-curated competitive content."""

from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import supabase
from app.routers.admin import get_admin_user

router = APIRouter(prefix="/strategy", tags=["strategy"])


class StrategyNoteCreate(BaseModel):
    title: str
    category: str  # archetype, matchup, general, tip
    content: str
    tags: list[str] = []
    format: str = "vgc2026"


class StrategyNoteUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    content: str | None = None
    tags: list[str] | None = None
    format: str | None = None
    is_active: bool | None = None


class StrategyNoteResponse(BaseModel):
    id: str
    title: str
    category: str
    content: str
    tags: list[str]
    format: str
    is_active: bool
    created_at: str
    updated_at: str


class StrategySuggestion(BaseModel):
    id: str
    title: str
    category: str
    content: str
    tags: list[str]
    format: str
    source: str
    source_label: str
    snapshot_date: str | None = None


def _entry_names(entries: Any, limit: int = 3) -> list[str]:
    """Extract display names from pokemon_usage JSON arrays."""
    if not isinstance(entries, list):
        return []
    out: list[str] = []
    for entry in entries:
        if isinstance(entry, dict):
            name = (
                entry.get("name")
                or entry.get("pokemon")
                or entry.get("item")
                or entry.get("move")
            )
            if name:
                out.append(str(name))
        elif isinstance(entry, str):
            out.append(entry)
        if len(out) >= limit:
            break
    return out


def _sentence_list(values: list[str], fallback: str = "not enough detail") -> str:
    return ", ".join(values) if values else fallback


def _latest_usage_rows(format: str, limit: int = 80) -> list[dict[str, Any]]:
    rows: list[dict] = (
        supabase.table("pokemon_usage")
        .select(
            "pokemon_name, format, snapshot_date, usage_percent, "
            "moves, items, teammates, source"
        )
        .eq("format", format)
        .order("snapshot_date", desc=True)
        .limit(limit)
        .execute()
        .data  # type: ignore[assignment]
        or []
    )
    if not rows:
        return []
    latest = max((r.get("snapshot_date") or "") for r in rows)
    latest_rows = [r for r in rows if r.get("snapshot_date") == latest]
    return sorted(latest_rows, key=lambda r: float(r.get("usage_percent") or 0), reverse=True)


def _usage_suggestions(strategy_format: str, usage_format: str) -> list[StrategySuggestion]:
    suggestions: list[StrategySuggestion] = []
    for row in _latest_usage_rows(usage_format)[:4]:
        name = str(row.get("pokemon_name") or "Unknown")
        snapshot = str(row.get("snapshot_date") or "")
        source = str(row.get("source") or "online usage")
        usage = float(row.get("usage_percent") or 0)
        moves = _entry_names(row.get("moves"))
        items = _entry_names(row.get("items"))
        teammates = _entry_names(row.get("teammates"))

        suggestions.append(
            StrategySuggestion(
                id=f"usage:{strategy_format}:{snapshot}:{name}",
                title=f"Online read: {name} at {usage:.1f}% usage",
                category="matchup",
                content=(
                    f"Latest {source} snapshot ({snapshot}) has {name} at {usage:.1f}% usage. "
                    f"Common moves: {_sentence_list(moves)}. "
                    f"Common items: {_sentence_list(items)}. "
                    f"Frequent partners: {_sentence_list(teammates)}. "
                    "Use this as scouting context when building leads and damage assumptions."
                ),
                tags=[
                    "agent",
                    "online",
                    source.lower(),
                    name.lower().replace(" ", "-"),
                ],
                format=strategy_format,
                source="usage",
                source_label=source.title(),
                snapshot_date=snapshot or None,
            )
        )
    return suggestions


def _tournament_suggestions(strategy_format: str) -> list[StrategySuggestion]:
    rows: list[dict] = (
        supabase.table("tournament_teams")
        .select("tournament_name, placement, pokemon_ids, archetype, source, created_at")
        .order("created_at", desc=True)
        .limit(80)
        .execute()
        .data  # type: ignore[assignment]
        or []
    )
    archetypes = Counter(
        str(row.get("archetype"))
        for row in rows
        if row.get("archetype") and str(row.get("archetype")).lower() != "unknown"
    )
    if not archetypes:
        return []

    top = archetypes.most_common(4)
    latest_created = str(rows[0].get("created_at") or "") if rows else ""
    source = str(rows[0].get("source") or "Limitless") if rows else "Limitless"
    mix = ", ".join(f"{name} ({count})" for name, count in top)
    leader = top[0][0]

    return [
        StrategySuggestion(
            id=f"tournaments:{strategy_format}:{latest_created}:{leader}",
            title=f"Online tournament read: {leader} leads recent archetypes",
            category="archetype",
            content=(
                f"Recent {source} tournament teams show this archetype mix: {mix}. "
                "Use this as a scouting note for lead selection, matchup tags, and prep priorities."
            ),
            tags=["agent", "online", "limitless", "archetype", leader.lower().replace(" ", "-")],
            format=strategy_format,
            source="tournaments",
            source_label=source,
            snapshot_date=latest_created[:10] or None,
        )
    ]


@router.get("", response_model=list[StrategyNoteResponse])
def list_notes(
    category: str | None = Query(None),
    format: str | None = Query(None),
    include_inactive: bool = Query(False),
):
    """List strategy notes. Public endpoint (active notes only by default)."""
    query = supabase.table("strategy_notes").select("*")

    if not include_inactive:
        query = query.eq("is_active", True)
    if category:
        query = query.eq("category", category)
    if format:
        query = query.eq("format", format)

    result = query.order("updated_at", desc=True).execute()
    return [StrategyNoteResponse.model_validate(row) for row in result.data]


@router.get("/agent-suggestions", response_model=list[StrategySuggestion])
def agent_suggestions(
    format: str = Query("vgc2026"),
    _: str = Depends(get_admin_user),
):
    """Suggest strategy notes from online-ingested usage and tournament data."""
    usage_format = "doubles" if format.startswith("vgc") else format
    suggestions = [
        *_usage_suggestions(format, usage_format),
        *_tournament_suggestions(format),
    ]
    return suggestions[:8]


@router.post("", response_model=StrategyNoteResponse, status_code=201)
def create_note(
    body: StrategyNoteCreate,
    user_id: str = Depends(get_admin_user),
):
    """Create a strategy note (admin only)."""
    if body.category not in ("archetype", "matchup", "general", "tip"):
        raise HTTPException(
            status_code=400,
            detail="Category must be: archetype, matchup, general, tip",
        )

    data = body.model_dump()
    data["created_by"] = user_id

    result = supabase.table("strategy_notes").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create note")
    return StrategyNoteResponse.model_validate(result.data[0])


@router.put("/{note_id}", response_model=StrategyNoteResponse)
def update_note(
    note_id: str,
    body: StrategyNoteUpdate,
    _: str = Depends(get_admin_user),
):
    """Update a strategy note (admin only)."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "category" in update_data:
        if update_data["category"] not in ("archetype", "matchup", "general", "tip"):
            raise HTTPException(
                status_code=400,
                detail="Category must be: archetype, matchup, general, tip",
            )

    result = supabase.table("strategy_notes").update(update_data).eq("id", note_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    return StrategyNoteResponse.model_validate(result.data[0])


@router.delete("/{note_id}", status_code=204)
def deactivate_note(
    note_id: str,
    _: str = Depends(get_admin_user),
):
    """Soft-delete a strategy note (set is_active=false)."""
    result = (
        supabase.table("strategy_notes").update({"is_active": False}).eq("id", note_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
