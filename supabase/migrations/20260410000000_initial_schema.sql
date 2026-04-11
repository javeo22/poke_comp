-- Pokemon Champions Companion - Initial Schema
-- Run against Supabase SQL Editor or via supabase db push

-- ============================================================
-- Static reference data (public read, no RLS needed)
-- ============================================================

CREATE TABLE pokemon (
  id INT PRIMARY KEY,                              -- PokeAPI national dex ID
  name TEXT NOT NULL UNIQUE,
  types TEXT[] NOT NULL,
  base_stats JSONB NOT NULL,                       -- {hp, attack, defense, sp_attack, sp_defense, speed}
  abilities TEXT[] NOT NULL,
  movepool TEXT[] NOT NULL,
  champions_eligible BOOLEAN DEFAULT FALSE,
  generation INT,
  mega_evolution_id INT REFERENCES pokemon(id),
  sprite_url TEXT
);

CREATE TABLE moves (
  id INT PRIMARY KEY,                              -- PokeAPI move ID
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,                          -- physical, special, status
  power INT,
  accuracy INT,
  target TEXT,
  effect_text TEXT,
  champions_available BOOLEAN DEFAULT FALSE
);

CREATE TABLE items (
  id INT PRIMARY KEY,                              -- PokeAPI item ID
  name TEXT NOT NULL UNIQUE,
  effect_text TEXT,
  category TEXT,
  vp_cost INT,
  champions_shop_available BOOLEAN DEFAULT FALSE,
  last_verified TIMESTAMPTZ
);

CREATE TABLE abilities (
  id INT PRIMARY KEY,                              -- PokeAPI ability ID
  name TEXT NOT NULL UNIQUE,
  effect_text TEXT
);

-- Indexes for common lookups
CREATE INDEX idx_pokemon_name ON pokemon(name);
CREATE INDEX idx_pokemon_champions ON pokemon(champions_eligible) WHERE champions_eligible = TRUE;
CREATE INDEX idx_pokemon_types ON pokemon USING GIN(types);
CREATE INDEX idx_moves_type ON moves(type);
CREATE INDEX idx_moves_name ON moves(name);
CREATE INDEX idx_abilities_name ON abilities(name);

-- ============================================================
-- Personal data (user-scoped, RLS enforced)
-- ============================================================

CREATE TABLE user_pokemon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pokemon_id INT NOT NULL REFERENCES pokemon(id),
  item_id INT REFERENCES items(id),
  ability TEXT,
  nature TEXT,
  stat_points JSONB,                               -- {hp, attack, defense, sp_attack, sp_defense, speed}
  moves TEXT[] CHECK (array_length(moves, 1) = 4),
  notes TEXT,
  build_status TEXT CHECK (build_status IN ('built', 'training', 'wishlist')),
  vp_spent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL,                            -- singles, doubles, megas
  pokemon_ids UUID[] NOT NULL,
  mega_pokemon_id UUID,
  notes TEXT,
  archetype_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user data
CREATE INDEX idx_user_pokemon_user ON user_pokemon(user_id);
CREATE INDEX idx_user_pokemon_status ON user_pokemon(user_id, build_status);
CREATE INDEX idx_teams_user ON teams(user_id);

-- ============================================================
-- Meta and analytics
-- ============================================================

CREATE TABLE meta_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  format TEXT NOT NULL,                            -- singles, doubles, megas
  tier_data JSONB NOT NULL,
  source_url TEXT,
  source TEXT,
  UNIQUE (snapshot_date, format)
);

CREATE TABLE matchup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  my_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  opponent_team_data JSONB,
  lead_pair JSONB,
  outcome TEXT CHECK (outcome IN ('win', 'loss')),
  notes TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash TEXT UNIQUE NOT NULL,
  opponent_team JSONB,
  my_team JSONB,
  response_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_matchup_log_user ON matchup_log(user_id);
CREATE INDEX idx_matchup_log_played ON matchup_log(user_id, played_at DESC);
CREATE INDEX idx_ai_analyses_hash ON ai_analyses(request_hash);
CREATE INDEX idx_ai_analyses_expiry ON ai_analyses(expires_at);
CREATE INDEX idx_meta_snapshots_lookup ON meta_snapshots(format, snapshot_date DESC);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE user_pokemon ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_log ENABLE ROW LEVEL SECURITY;

-- user_pokemon: users see only their own rows
CREATE POLICY user_pokemon_select ON user_pokemon FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_pokemon_insert ON user_pokemon FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_pokemon_update ON user_pokemon FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_pokemon_delete ON user_pokemon FOR DELETE USING (auth.uid() = user_id);

-- teams: users see only their own rows
CREATE POLICY teams_select ON teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY teams_update ON teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY teams_delete ON teams FOR DELETE USING (auth.uid() = user_id);

-- matchup_log: users see only their own rows
CREATE POLICY matchup_log_select ON matchup_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY matchup_log_insert ON matchup_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY matchup_log_update ON matchup_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY matchup_log_delete ON matchup_log FOR DELETE USING (auth.uid() = user_id);

-- Static tables and meta_snapshots: public read, no RLS
-- ai_analyses: no RLS (shared cache, keyed by team composition hash)

-- ============================================================
-- Updated_at trigger for user-scoped tables
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
