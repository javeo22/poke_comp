from fastapi import APIRouter, HTTPException, Query, Request
from postgrest.types import CountMethod

from app.database import supabase
from app.limiter import limiter
from app.models.meta import (
    MetaSnapshotCreate,
    MetaSnapshotList,
    MetaSnapshotResponse,
    MetaTrendResponse,
)

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("", response_model=MetaSnapshotList)
def list_snapshots(
    format: str | None = Query(None, description="Filter by format (singles, doubles, megas)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("meta_snapshots").select("*", count=CountMethod.exact)

    if format:
        query = query.eq("format", format)

    result = query.order("snapshot_date", desc=True).range(offset, offset + limit - 1).execute()
    return MetaSnapshotList(
        data=[MetaSnapshotResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/latest", response_model=list[MetaSnapshotResponse])
def get_latest_snapshots():
    """Return the most recent snapshot for each format."""
    formats = ["singles", "doubles", "megas"]
    results: list[MetaSnapshotResponse] = []

    for fmt in formats:
        result = (
            supabase.table("meta_snapshots")
            .select("*")
            .eq("format", fmt)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            results.append(MetaSnapshotResponse.model_validate(result.data[0]))

    return results


@router.get("/{snapshot_id}", response_model=MetaSnapshotResponse)
def get_snapshot(snapshot_id: int):
    result = supabase.table("meta_snapshots").select("*").eq("id", snapshot_id).single().execute()
    return MetaSnapshotResponse.model_validate(result.data)


@router.post("", response_model=MetaSnapshotResponse, status_code=201)
def create_snapshot(body: MetaSnapshotCreate):
    data = body.model_dump(exclude_none=True, mode="json")

    result = supabase.table("meta_snapshots").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create meta snapshot")
    return MetaSnapshotResponse.model_validate(result.data[0])


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: int):
    result = supabase.table("meta_snapshots").delete().eq("id", snapshot_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Meta snapshot not found")


@router.get("/trends", response_model=list[MetaTrendResponse])
@limiter.limit("30/minute")
def get_trends(
    request: Request,
    format: str = Query("doubles", pattern=r"^(singles|doubles)$"),
    limit: int = Query(6, ge=1, le=20),
):
    """Fetch top Pokemon trends with usage swings."""
    result = supabase.rpc("get_meta_trends", {"p_format": format, "p_limit": limit}).execute()

    return [MetaTrendResponse.model_validate(row) for row in result.data or []]
