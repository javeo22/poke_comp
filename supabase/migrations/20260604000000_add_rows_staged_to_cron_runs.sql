-- Add rows_staged to cron_runs to track items sent to HITL review queue.
ALTER TABLE cron_runs ADD COLUMN rows_staged INTEGER NOT NULL DEFAULT 0;
