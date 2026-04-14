-- Schema hardening: CHECK constraints and champions_available on abilities
-- Date: 2026-04-15

-- ============================================================
-- 1. Format column CHECK constraints
-- ============================================================

-- pokemon_usage.format: only valid Champions formats
ALTER TABLE pokemon_usage
  ADD CONSTRAINT chk_pokemon_usage_format
  CHECK (format IN ('doubles', 'singles'));

-- meta_snapshots.format: includes megas for tier list display
ALTER TABLE meta_snapshots
  ADD CONSTRAINT chk_meta_snapshots_format
  CHECK (format IN ('doubles', 'singles', 'megas'));

-- teams.format: already has this from initial schema, but ensure it exists
-- (safe: Postgres ignores ADD CONSTRAINT IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_format_check'
  ) THEN
    ALTER TABLE teams
      ADD CONSTRAINT teams_format_check
      CHECK (format IN ('singles', 'doubles', 'megas'));
  END IF;
END $$;

-- ============================================================
-- 2. Source column CHECK constraint
-- ============================================================

ALTER TABLE pokemon_usage
  ADD CONSTRAINT chk_pokemon_usage_source
  CHECK (source IN ('smogon', 'pikalytics', 'manual'));

-- ============================================================
-- 3. abilities.champions_available column
-- ============================================================

ALTER TABLE abilities
  ADD COLUMN IF NOT EXISTS champions_available BOOLEAN DEFAULT FALSE;

-- Populate: mark abilities as champions_available if they appear
-- on any Champions-eligible Pokemon's ability list.
-- This is a one-time backfill; the seed scripts will maintain it.
UPDATE abilities
SET champions_available = TRUE
WHERE name IN (
  SELECT DISTINCT unnest(abilities)
  FROM pokemon
  WHERE champions_eligible = TRUE
);

-- Index for filtering by availability
CREATE INDEX IF NOT EXISTS idx_abilities_champions
  ON abilities(champions_available) WHERE champions_available = TRUE;

-- ============================================================
-- 4. pokemon_usage.usage_percent range constraint
-- ============================================================

ALTER TABLE pokemon_usage
  ADD CONSTRAINT chk_pokemon_usage_percent
  CHECK (usage_percent >= 0 AND usage_percent <= 100);

-- ============================================================
-- 5. tournament_teams unique constraint for deduplication
-- ============================================================

-- Prevent duplicate entries for the same tournament + placement
ALTER TABLE tournament_teams
  ADD CONSTRAINT uq_tournament_placement
  UNIQUE (tournament_name, placement);
