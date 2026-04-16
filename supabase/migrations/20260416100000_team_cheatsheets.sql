-- Team cheatsheets: persistent storage for AI-generated cheatsheets
-- Replaces ephemeral ai_analyses cache with per-team saved cheatsheets

CREATE TABLE IF NOT EXISTS team_cheatsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cheatsheet_json JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One cheatsheet per team (latest overwrites)
CREATE UNIQUE INDEX idx_team_cheatsheets_team ON team_cheatsheets(team_id);
CREATE INDEX idx_team_cheatsheets_user ON team_cheatsheets(user_id);
CREATE INDEX idx_team_cheatsheets_public ON team_cheatsheets(is_public) WHERE is_public = TRUE;

-- RLS
ALTER TABLE team_cheatsheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cheatsheets"
  ON team_cheatsheets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cheatsheets"
  ON team_cheatsheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cheatsheets"
  ON team_cheatsheets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cheatsheets"
  ON team_cheatsheets FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public cheatsheets"
  ON team_cheatsheets FOR SELECT
  USING (is_public = TRUE);

-- Auto-update updated_at
CREATE TRIGGER set_team_cheatsheets_updated_at
  BEFORE UPDATE ON team_cheatsheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
