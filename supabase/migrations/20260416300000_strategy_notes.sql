-- Strategy notes: admin-curated competitive content wired into AI prompts

CREATE TABLE strategy_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('archetype', 'matchup', 'general', 'tip')),
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  format TEXT DEFAULT 'vgc2026',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategy_notes_active ON strategy_notes(is_active, format);
CREATE INDEX idx_strategy_notes_tags ON strategy_notes USING GIN(tags);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON strategy_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE strategy_notes ENABLE ROW LEVEL SECURITY;

-- Anyone can read active notes (public data)
CREATE POLICY "Anyone can view active strategy notes"
  ON strategy_notes FOR SELECT
  USING (is_active = TRUE);

-- Only service role can insert/update (admin endpoints use service key)
CREATE POLICY "Service role can manage strategy notes"
  ON strategy_notes FOR ALL
  USING (auth.role() = 'service_role');
