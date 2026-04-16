-- Adds cache_version column to ai_analyses to support a 14-day v1 -> v2
-- grace period for normalized cache keys. Rows written with the new
-- normalization utilities are tagged v2; legacy rows default to v1 and
-- are evicted by migration 20260601000000_drop_v1_cache.sql.

ALTER TABLE ai_analyses
    ADD COLUMN IF NOT EXISTS cache_version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_ai_analyses_cache_version
    ON ai_analyses(cache_version);
