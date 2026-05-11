from unittest.mock import MagicMock, patch

from app.routers import admin_cron


class _InsertQuery:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    def execute(self) -> None:
        if self.error:
            raise self.error


class _CronRunsTable:
    def __init__(self) -> None:
        self.payloads: list[dict] = []
        self.errors: list[Exception | None] = []

    def insert(self, payload: dict) -> _InsertQuery:
        self.payloads.append(payload)
        error = self.errors.pop(0) if self.errors else None
        return _InsertQuery(error)


class _SupabaseStub:
    def __init__(self, cron_runs: _CronRunsTable) -> None:
        self.cron_runs = cron_runs

    def table(self, name: str) -> _CronRunsTable:
        assert name == "cron_runs"
        return self.cron_runs


def test_persist_run_retries_without_rows_staged_for_legacy_schema() -> None:
    cron_runs = _CronRunsTable()
    cron_runs.errors.append(
        Exception("Could not find the 'rows_staged' column of 'cron_runs' in the schema cache")
    )

    with patch.object(admin_cron, "supabase", _SupabaseStub(cron_runs)):
        admin_cron._persist_run(
            "ingest_pikalytics",
            started_at_ms=1_700_000_000_000,
            finished_at_ms=1_700_000_001_000,
            status="pass",
            rows_staged=12,
        )

    assert len(cron_runs.payloads) == 2
    assert cron_runs.payloads[0]["rows_staged"] == 12
    assert "rows_staged" not in cron_runs.payloads[1]


def test_persist_run_does_not_retry_unrelated_insert_errors() -> None:
    cron_runs = _CronRunsTable()
    cron_runs.errors.append(Exception("connection refused"))

    with (
        patch.object(admin_cron, "supabase", _SupabaseStub(cron_runs)),
        patch.object(admin_cron.logger, "error", MagicMock()) as mock_error,
    ):
        admin_cron._persist_run(
            "ingest_smogon",
            started_at_ms=1_700_000_000_000,
            finished_at_ms=1_700_000_001_000,
            status="fail",
            error="boom",
        )

    assert len(cron_runs.payloads) == 1
    mock_error.assert_called_once()
