"""Vercel Cron entry points for data ingest + validation.

Every route is a GET (Vercel Cron sends GETs) and requires
``Authorization: Bearer $CRON_SECRET``, which Vercel Cron sends
automatically (https://vercel.com/docs/cron-jobs). Scripts are invoked
through the shared ``run()`` entrypoints defined on each ingest module,
so both the CLI and cron paths exercise identical logic.

Long-running ingests use ``asyncio.to_thread`` to avoid blocking the
event loop -- each ingest is synchronous (httpx + supabase-py) so the
function spins up a worker thread inside the Vercel Function invocation.

Every invocation persists a ``cron_runs`` row with status (pass/warn/fail),
duration, row counts, warnings, and (on failure) the exception text. The
HTTP response then mirrors the row: pass/warn -> 200, fail -> 500. Vercel's
invocation list shows red on 500s, so silent failures are no longer
possible -- the previous behavior of catching every exception inside the
ingest scripts and returning HTTP 200 with a warning is gone.
"""

import asyncio
import hmac
import logging
import time
import traceback
from collections.abc import Callable

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.database import supabase
from app.models.ingest import IngestResult
from app.services.alerting import send_alert
from scripts.ingest import limitless_teams, pikalytics_usage, smogon_meta
from scripts.validate_data import run_validation

router = APIRouter(prefix="/admin/cron", tags=["admin-cron"])
logger = logging.getLogger("cron")


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


def _persist_run(
    source: str,
    started_at_ms: int,
    finished_at_ms: int,
    status: str,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    rows_staged: int = 0,
    rows_skipped: int = 0,
    warnings: list[str] | None = None,
    error: str | None = None,
) -> None:
    """Insert one row in cron_runs. Best-effort -- never raises."""
    try:
        supabase.table("cron_runs").insert(
            {
                "source": source,
                "started_at": _ms_to_iso(started_at_ms),
                "finished_at": _ms_to_iso(finished_at_ms),
                "duration_ms": finished_at_ms - started_at_ms,
                "status": status,
                "rows_inserted": rows_inserted,
                "rows_updated": rows_updated,
                "rows_staged": rows_staged,
                "rows_skipped": rows_skipped,
                "warnings": warnings or [],
                "error": error,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 -- audit log must not mask the real error
        logger.error("cron.persist_failed source=%s exc=%s", source, exc)


def _ms_to_iso(ms: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


def _record_cron_run(source: str, runner: Callable[[], IngestResult]) -> IngestResult:
    """Wrap an ingest callable. Records to cron_runs, raises on exception.

    Decision tree for the persisted ``status`` column:
      - script raised             -> ``fail``, then HTTPException(500) bubbles up
      - rows touched and no warns -> ``pass``
      - any warning OR zero rows  -> ``warn``
    """
    started_at = int(time.time() * 1000)
    try:
        result = runner()
    except Exception as exc:  # noqa: BLE001 -- broad on purpose; we re-raise
        finished_at = int(time.time() * 1000)
        tb = traceback.format_exc()
        logger.error(
            "cron.%s result=fail duration_ms=%d error=%s",
            source,
            finished_at - started_at,
            exc,
        )
        _persist_run(
            source,
            started_at,
            finished_at,
            status="fail",
            error=f"{type(exc).__name__}: {exc}\n{tb}",
        )
        send_alert(f"🚨 Cron Failure: {source}\nError: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=500,
            detail={"source": source, "error": f"{type(exc).__name__}: {exc}"},
        ) from exc

    finished_at = int(time.time() * 1000)
    rows_touched = result.rows_inserted + result.rows_updated + result.rows_staged
    if result.warnings or rows_touched == 0:
        status = "warn"
    else:
        status = "pass"
    logger.info(
        "cron.%s result=%s duration_ms=%d rows_inserted=%d rows_updated=%d "
        "rows_staged=%d rows_skipped=%d warnings=%d",
        source,
        status,
        finished_at - started_at,
        result.rows_inserted,
        result.rows_updated,
        result.rows_staged,
        result.rows_skipped,
        len(result.warnings),
    )
    _persist_run(
        source,
        started_at,
        finished_at,
        status=status,
        rows_inserted=result.rows_inserted,
        rows_updated=result.rows_updated,
        rows_staged=result.rows_staged,
        rows_skipped=result.rows_skipped,
        warnings=result.warnings,
    )
    return result


@router.get("/ingest-smogon", response_model=IngestResult)
async def cron_ingest_smogon(authorization: str | None = Header(default=None)) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(
        _record_cron_run, "ingest_smogon", lambda: smogon_meta.run(False)
    )


@router.get("/ingest-pikalytics", response_model=IngestResult)
async def cron_ingest_pikalytics(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(
        _record_cron_run, "ingest_pikalytics", lambda: pikalytics_usage.run(False)
    )


@router.get("/ingest-limitless", response_model=IngestResult)
async def cron_ingest_limitless(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)
    return await asyncio.to_thread(
        _record_cron_run, "ingest_limitless", lambda: limitless_teams.run(False, None)
    )


@router.get("/validate-data", response_model=IngestResult)
async def cron_validate_data(
    authorization: str | None = Header(default=None),
) -> IngestResult:
    require_cron_secret(authorization)

    def _run() -> IngestResult:
        report = run_validation(supabase, fix=True)
        return IngestResult(
            source="validate_data",
            rows_updated=report.total_fixed,
            warnings=[f"{c.name}: {c.message}" for c in report.checks if c.status != "pass"],
            dry_run=False,
        )

    return await asyncio.to_thread(_record_cron_run, "validate_data", _run)


# ═══════════════════════════════════════════════════════════════════
# Aggregators -- the only two endpoints actually scheduled in Vercel
# Cron under the Hobby plan's 2-cron cap.
#
# The per-source endpoints above are kept callable for manual triggers
# (curl, /admin/data-health repair flows) and for the aggregators to
# re-use without duplicating wiring -- but Vercel Cron only invokes
# `cron-daily` and `cron-weekly`. See vercel.json.
# ═══════════════════════════════════════════════════════════════════


def _aggregate(source: str, steps: list[tuple[str, Callable[[], IngestResult]]]) -> IngestResult:
    """Run multiple ingest callables sequentially and merge their results.

    Each step is wrapped by ``_record_cron_run`` so the per-source row
    still lands in ``cron_runs`` -- the aggregator gets its own row too.
    Step exceptions are caught (the wrapper re-raises HTTPException, which
    we convert back into a warning on the aggregator) so one broken
    source doesn't kill the rest of the run. Aggregator status is
    derived from step statuses: any fail -> aggregator status='warn'.
    """
    started_at = int(time.time() * 1000)
    merged = IngestResult(source=source)
    failed_steps: list[str] = []
    for step_name, runner in steps:
        try:
            result = _record_cron_run(step_name, runner)
        except HTTPException as exc:
            failed_steps.append(f"{step_name}: HTTP {exc.status_code} {exc.detail}")
            merged.warnings.append(f"{step_name}: failed ({exc.detail})")
            continue
        merged.rows_inserted += result.rows_inserted
        merged.rows_updated += result.rows_updated
        merged.rows_staged += result.rows_staged
        merged.rows_skipped += result.rows_skipped
        for w in result.warnings:
            merged.warnings.append(f"{step_name}: {w}")

    finished_at = int(time.time() * 1000)
    if failed_steps:
        agg_status = "fail"
        agg_error = "; ".join(failed_steps)
    elif merged.warnings or (merged.rows_inserted + merged.rows_updated + merged.rows_staged == 0):
        agg_status = "warn"
        agg_error = None
    else:
        agg_status = "pass"
        agg_error = None
    logger.info(
        "cron.%s result=%s duration_ms=%d steps=%d failed_steps=%d",
        source,
        agg_status,
        finished_at - started_at,
        len(steps),
        len(failed_steps),
    )
    _persist_run(
        source,
        started_at,
        finished_at,
        status=agg_status,
        rows_inserted=merged.rows_inserted,
        rows_updated=merged.rows_updated,
        rows_staged=merged.rows_staged,
        rows_skipped=merged.rows_skipped,
        warnings=merged.warnings,
        error=agg_error,
    )
    return merged


@router.get("/daily", response_model=IngestResult)
async def cron_daily(authorization: str | None = Header(default=None)) -> IngestResult:
    """Daily aggregator: Limitless tournament teams.

    Fires every day at 08:00 UTC. Limitless tournament data is
    time-series, so daily refresh is what gives the draft helper
    fresh tournament context.
    """
    require_cron_secret(authorization)
    return await asyncio.to_thread(
        _aggregate,
        "cron_daily",
        [("ingest_limitless", lambda: limitless_teams.run(False, None))],
    )


@router.get("/weekly", response_model=IngestResult)
async def cron_weekly(authorization: str | None = Header(default=None)) -> IngestResult:
    """Weekly aggregator: Smogon -> Pikalytics -> validate-data.

    Fires Monday morning. The order matters: Pikalytics is the primary
    usage source so it runs second (its data overwrites Smogon's where
    they overlap). validate-data --fix runs last to clean any orphans
    introduced by the two upstream ingests.
    """
    require_cron_secret(authorization)

    def _validate() -> IngestResult:
        report = run_validation(supabase, fix=True)
        return IngestResult(
            source="validate_data",
            rows_updated=report.total_fixed,
            warnings=[f"{c.name}: {c.message}" for c in report.checks if c.status != "pass"],
            dry_run=False,
        )

    return await asyncio.to_thread(
        _aggregate,
        "cron_weekly",
        [
            ("ingest_smogon", lambda: smogon_meta.run(False)),
            ("ingest_pikalytics", lambda: pikalytics_usage.run(False)),
            ("validate_data", _validate),
        ],
    )


@router.get("/test-alert", response_model=IngestResult)
async def cron_test_alert(authorization: str | None = Header(default=None)) -> IngestResult:
    """Deliberate failure endpoint to verify alerting integration."""
    require_cron_secret(authorization)

    def _fail() -> IngestResult:
        raise Exception("Deliberate failure for alerting test")

    return await asyncio.to_thread(_record_cron_run, "test_alert", _fail)
