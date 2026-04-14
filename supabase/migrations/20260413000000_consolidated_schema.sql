-- Pokemon Champions Companion - Consolidated Schema
-- Run against a fresh Supabase project via SQL Editor
-- Combines initial schema + usage tables + tournament teams
-- Skips pokemon_usage_stats (consolidated into pokemon_usage)
-- Drops auth.users FK on user_id (auth deferred, using hardcoded dev user)

-- ============================================================
-- Static reference data
-- ============================================================

CREATE TABLE IF NOT EXISTS pokemon (
  id INT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  types TEXT[] NOT NULL,
  base_stats JSONB NOT NULL,
  abilities TEXT[] NOT NULL,
  movepool TEXT[] NOT NULL,
  champions_eligible BOOLEAN DEFAULT FALSE,
  generation INT,
  mega_evolution_id INT REFERENCES pokemon(id),
  sprite_url TEXT
);

CREATE TABLE IF NOT EXISTS moves (
  id INT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  power INT,
  accuracy INT,
  target TEXT,
  effect_text TEXT,
  champions_available BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS items (
  id INT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  effect_text TEXT,
  category TEXT,
  vp_cost INT,
  champions_shop_available BOOLEAN DEFAULT FALSE,
  last_verified TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS abilities (
  id INT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  effect_text TEXT,
  champions_available BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_pokemon_name ON pokemon(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_champions ON pokemon(champions_eligible) WHERE champions_eligible = TRUE;
CREATE INDEX IF NOT EXISTS idx_pokemon_types ON pokemon USING GIN(types);
CREATE INDEX IF NOT EXISTS idx_moves_type ON moves(type);
CREATE INDEX IF NOT EXISTS idx_moves_name ON moves(name);
CREATE INDEX IF NOT EXISTS idx_abilities_name ON abilities(name);

-- ============================================================
-- Personal data (no FK to auth.users — using dev user ID)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_pokemon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pokemon_id INT NOT NULL REFERENCES pokemon(id),
  item_id INT REFERENCES items(id),
  ability TEXT,
  nature TEXT,
  stat_points JSONB,
  moves TEXT[],
  notes TEXT,
  build_status TEXT CHECK (build_status IN ('built', 'training', 'wishlist')),
  vp_spent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  pokemon_ids UUID[] NOT NULL,
  mega_pokemon_id UUID,
  notes TEXT,
  archetype_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_pokemon_user ON user_pokemon(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pokemon_status ON user_pokemon(user_id, build_status);
CREATE INDEX IF NOT EXISTS idx_teams_user ON teams(user_id);

-- ============================================================
-- Meta, usage, and analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('doubles', 'singles', 'megas')),
  tier_data JSONB NOT NULL,
  source_url TEXT,
  source TEXT,
  UNIQUE (snapshot_date, format)
);

CREATE TABLE IF NOT EXISTS pokemon_usage (
  id SERIAL PRIMARY KEY,
  pokemon_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('doubles', 'singles')),
  usage_percent FLOAT NOT NULL CHECK (usage_percent >= 0 AND usage_percent <= 100),
  moves JSONB,
  items JSONB,
  abilities JSONB,
  teammates JSONB,
  spreads JSONB,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'pikalytics' CHECK (source IN ('smogon', 'pikalytics', 'manual')),
  UNIQUE (pokemon_name, format, snapshot_date)
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_name TEXT NOT NULL,
  placement INT NOT NULL,
  pokemon_ids INT[] NOT NULL,
  archetype TEXT,
  source TEXT DEFAULT 'Limitless',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_name, placement)
);

CREATE TABLE IF NOT EXISTS matchup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  my_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  opponent_team_data JSONB,
  lead_pair JSONB,
  outcome TEXT CHECK (outcome IN ('win', 'loss')),
  notes TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash TEXT UNIQUE NOT NULL,
  opponent_team JSONB,
  my_team JSONB,
  response_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pokemon_usage_lookup ON pokemon_usage(format, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_pokemon_usage_name ON pokemon_usage(pokemon_name);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_placement ON tournament_teams(placement);
CREATE INDEX IF NOT EXISTS idx_abilities_champions ON abilities(champions_available) WHERE champions_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_matchup_log_user ON matchup_log(user_id);
CREATE INDEX IF NOT EXISTS idx_matchup_log_played ON matchup_log(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_hash ON ai_analyses(request_hash);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_expiry ON ai_analyses(expires_at);
CREATE INDEX IF NOT EXISTS idx_meta_snapshots_lookup ON meta_snapshots(format, snapshot_date DESC);

-- ============================================================
-- RLS (disabled for dev — using service key + hardcoded user)
-- Enable when Supabase Auth is integrated
-- ============================================================

-- ALTER TABLE user_pokemon ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE matchup_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_pokemon_updated_at
  BEFORE UPDATE ON user_pokemon
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
