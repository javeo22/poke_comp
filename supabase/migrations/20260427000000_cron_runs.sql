-- Audit log for Vercel Cron invocations.
-- Every cron-wrapped ingest writes one row per run so /admin/data-health
-- can surface real status, duration, and warnings instead of relying on
-- Vercel function logs (which don't persist past the platform's retention
-- window and don't expose row counts).
--
-- Status values:
--   pass  - script ran cleanly and touched at least one row
--   warn  - script ran but produced warnings or touched zero rows
--   fail  - script raised an exception (re-raised as HTTP 500 so Vercel
--           marks the invocation red in its dashboard)

CREATE TABLE IF NOT EXISTS cron_runs (
    id           BIGSERIAL PRIMARY KEY,
    source       TEXT NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at  TIMESTAMPTZ,
    duration_ms  INTEGER,
    status       TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
    rows_inserted INTEGER NOT NULL DEFAULT 0,
    rows_updated  INTEGER NOT NULL DEFAULT 0,
    rows_skipped  INTEGER NOT NULL DEFAULT 0,
    warnings     JSONB NOT NULL DEFAULT '[]'::jsonb,
    error        TEXT
);

CREATE INDEX IF NOT EXISTS cron_runs_source_started_idx
    ON cron_runs (source, started_at DESC);

-- No RLS: this is admin/cron-only audit data, never exposed to end users.
