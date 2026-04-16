-- AI usage logging for per-user rate limiting and cost tracking
-- Date: 2026-04-15

-- ============================================================
-- 1. ai_usage_log table
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(8,5),
  cached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECK constraint on endpoint values
ALTER TABLE ai_usage_log
  ADD CONSTRAINT chk_ai_usage_endpoint
  CHECK (endpoint IN ('draft', 'cheatsheet', 'meta_scrape'));

-- Index for per-user daily quota queries (most common query path)
CREATE INDEX idx_ai_usage_user_date ON ai_usage_log(user_id, created_at DESC);

-- ============================================================
-- 2. RLS: users can read their own usage, API inserts via service key
-- ============================================================

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI usage"
  ON ai_usage_log
  FOR SELECT
  USING (auth.uid() = user_id);
