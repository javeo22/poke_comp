-- Migration: Setup New Expert Analysis Tables
-- Date: 2026-04-12
-- Adds pokemon_usage_stats and tournament_teams for the Multi-Source Ingestion Strategy

-- 1. Store the Smogon API Data (The "Pulse")
CREATE TABLE pokemon_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pokemon_id INT REFERENCES pokemon(id), -- Links to the base PokeAPI ID
  snapshot_date DATE NOT NULL,
  format TEXT NOT NULL,                  -- e.g., 'champions-doubles'
  usage_percent FLOAT,
  common_items JSONB,                    -- e.g., {"Focus Sash": 45.2, "Life Orb": 20.1}
  common_moves JSONB,                    -- e.g., {"Protect": 99.1, "Close Combat": 85.0}
  common_teammates JSONB,                -- e.g., {"Whimsicott": 30.5}
  source TEXT DEFAULT 'Smogon/Pkmn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pokemon_id, snapshot_date, format)
);

-- Index for usage stats
CREATE INDEX idx_pokemon_usage_stats_lookup ON pokemon_usage_stats(format, snapshot_date DESC, usage_percent DESC);
CREATE INDEX idx_pokemon_usage_stats_pokeid ON pokemon_usage_stats(pokemon_id);

-- 2. Store the Limitless Data (The "Pros")
CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_name TEXT NOT NULL,
  placement INT NOT NULL,                -- e.g., 1 (for 1st place)
  pokemon_ids INT[] NOT NULL,            -- Array of the 6 Pokemon IDs
  archetype TEXT,                        -- e.g., "Rain Stall", "Trick Room"
  source TEXT DEFAULT 'Limitless',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tournament lookups
CREATE INDEX idx_tournament_teams_placement on tournament_teams(placement);
