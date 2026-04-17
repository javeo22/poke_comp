-- Matchup log revamp: add 4 tournament-prep fields.
--
-- User-reported 2026-04-16: "we need to improve the way the log matches
-- work (it needs a visual revamp and a more useful fields for information)."
--
-- Added columns:
--   `format`        -- "ladder" | "bo1" | "bo3" | "tournament" | "friendly"
--                     Separates casual ladder reps from tournament prep in stats.
--   `tags`          -- TEXT[], free-form archetype labels (e.g. "rain", "trick-room")
--                     Lets users slice stats by strategic pattern.
--   `close_type`    -- "blowout" | "close" | "comeback" | "standard"
--                     Post-match reflection tag; aids identifying weak spots.
--   `mvp_pokemon`   -- TEXT, which of my Pokemon carried the win / which failed.
--                     Nullable so it's optional.
--
-- All four are optional and backfill-safe: existing rows get NULLs.

ALTER TABLE matchup_log
  ADD COLUMN IF NOT EXISTS format TEXT
    CHECK (format IS NULL OR format IN ('ladder', 'bo1', 'bo3', 'tournament', 'friendly')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS close_type TEXT
    CHECK (close_type IS NULL OR close_type IN ('blowout', 'close', 'comeback', 'standard')),
  ADD COLUMN IF NOT EXISTS mvp_pokemon TEXT;

-- Index to support the upcoming "by format" and "by tag" stats breakdowns.
CREATE INDEX IF NOT EXISTS idx_matchup_log_format
  ON matchup_log(user_id, format)
  WHERE format IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matchup_log_tags
  ON matchup_log USING GIN(tags);
