"""Strategy notes CRUD -- admin-curated competitive content."""

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

    result = (
        supabase.table("strategy_notes")
        .update(update_data)
        .eq("id", note_id)
        .execute()
    )
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
        supabase.table("strategy_notes")
        .update({"is_active": False})
        .eq("id", note_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
