-- Migration: Add scraper_review_queue and is_admin flag
-- Date: 2026-06-03

-- 1. Add is_admin to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Create scraper_review_queue table
CREATE TABLE scraper_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                  -- 'limitless', 'pikalytics'
  payload JSONB NOT NULL,                -- The data intended for tournament_teams/usage
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  external_id TEXT,                      -- tournament_id or other identifier
  metadata JSONB,                        -- AI classification result
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE scraper_review_queue ENABLE ROW LEVEL SECURITY;

-- 4. Admin-only policies
-- We assume users are admins if is_admin = true in user_profiles
CREATE POLICY "Admins can view review queue"
  ON scraper_review_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update review queue"
  ON scraper_review_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can delete review queue"
  ON scraper_review_queue FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- Also allow admins to view/update their own admin flag if needed, 
-- but normally this is set manually or via SQL.
-- For now, let's keep user_profiles policies as they are.
