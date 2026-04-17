"""Shared types for ingest scripts invoked via CLI or Vercel Cron."""

from pydantic import BaseModel, Field


class IngestResult(BaseModel):
    """Uniform result shape returned by every ingest/validation job."""

    source: str
    rows_inserted: int = 0
    rows_updated: int = 0
    rows_skipped: int = 0
    warnings: list[str] = Field(default_factory=list)
    duration_ms: int = 0
    dry_run: bool = False
