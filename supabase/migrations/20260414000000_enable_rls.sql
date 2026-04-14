-- Enable Row Level Security on user-scoped tables.
-- Defense-in-depth: the API uses the service key (bypasses RLS),
-- but this prevents direct anon-key access to other users' data.

-- ── Enable RLS ──────────────────────────────────────────────────────

ALTER TABLE user_pokemon ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_log ENABLE ROW LEVEL SECURITY;

-- ── user_pokemon policies ───────────────────────────────────────────

CREATE POLICY "Users can view own roster entries"
  ON user_pokemon FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roster entries"
  ON user_pokemon FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roster entries"
  ON user_pokemon FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own roster entries"
  ON user_pokemon FOR DELETE
  USING (auth.uid() = user_id);

-- ── teams policies ──────────────────────────────────────────────────

CREATE POLICY "Users can view own teams"
  ON teams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own teams"
  ON teams FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own teams"
  ON teams FOR DELETE
  USING (auth.uid() = user_id);

-- ── matchup_log policies ────────────────────────────────────────────

CREATE POLICY "Users can view own matchups"
  ON matchup_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own matchups"
  ON matchup_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own matchups"
  ON matchup_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own matchups"
  ON matchup_log FOR DELETE
  USING (auth.uid() = user_id);
