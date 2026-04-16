-- Cleanup migration for the cache v1 -> v2 rollover.
-- Applied 2026-06-01 after a 14-day grace window during which v1 keys
-- continued to serve. All v1 rows are dropped here; the column is kept
-- in case a future rollover reuses the pattern.

DELETE FROM ai_analyses WHERE cache_version = 1;
