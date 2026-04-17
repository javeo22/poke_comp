"""Vercel Cron entry points for data ingest + validation.

Every route is a GET (Vercel Cron sends GETs) and requires
``Authorization: Bearer $CRON_SECRET``, which Vercel Cron sends
automatically (https://vercel.com/docs/cron-jobs). Scripts are invoked
through the shared ``run()`` entrypoints defined on each ingest module,
so both the CLI and cron paths exercise identical logic.

Long-running ingests use ``asyncio.to_thread`` to avoid blocking the
event loop -- each ingest is synchronous (httpx + supabase-py) so the
function spins up a worker thread inside the Vercel Function invocation.
"""

import asyncio
import hmac

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.database import supabase
from app.models.ingest import IngestResult
from scripts.ingest import limitless_teams, pikalytics_usage, smogon_meta
from scripts.validate_data import run_validation

router = APIRouter(prefix="/admin/cron", tags=["admin-cron"])


def require_cron_secret(authorization: str | None = Header(default=None)) -> None:
    """Constant-time check of the Vercel Cron bearer token."""
    expected = settings.cron_secret
    if not expected:
        raise HTTPException(status_code=503, detail="CRON_SECRET not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    provided = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.get("/ingest-smogon", response_model=IngestResult)
async def cron_ingest_smogon(authorization: str | None = Header(default=None)) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(smogon_meta.run, False)


@router.get("/ingest-pikalytics", response_model=IngestResult)
async def cron_ingest_pikalytics(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(pikalytics_usage.run, False)


@router.get("/ingest-limitless", response_model=IngestResult)
async def cron_ingest_limitless(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(limitless_teams.run, False, None)


@router.get("/validate-data", response_model=IngestResult)
async def cron_validate_data(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)
    report = await asyncio.to_thread(run_validation, supabase, True)
    return IngestResult(
        source="validate_data",
        rows_updated=report.total_fixed,
        warnings=[
            f"{c.name}: {c.message}" for c in report.checks if c.status != "pass"
        ],
        dry_run=False,
    )


@router.get("/cache-warmup", response_model=IngestResult)
async def cron_cache_warmup(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    """Stub endpoint -- real implementation lands in Phase 5.2 (cache warmup).

    Returns a well-formed IngestResult so the cron schedule can be wired
    ahead of implementation without cron invocations erroring out.
    """
    require_cron_secret(authorization)
    return IngestResult(
        source="cache_warmup",
        warnings=["cache_warmup not yet implemented (Phase 5.2)"],
    )
