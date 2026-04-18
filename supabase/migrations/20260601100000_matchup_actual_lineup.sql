-- Allow per-match override of which Pokemon were actually run.
--
-- User-reported 2026-04-17: when logging a match, the form forces a single
-- saved-team UUID. If you swapped a Pokemon between draft analysis and the
-- actual game, you can't record the real lineup -- and damage calcs from the
-- pre-match analysis flag those swaps as "not on your team."
--
-- `my_team_actual` is an optional array of Pokemon names (Title Case, same
-- format as `opponent_team_data[].name`). NULL means "the saved team's
-- roster is what was run" (existing behavior, all old rows). When present,
-- it's the source of truth for what the user actually fielded.

ALTER TABLE matchup_log
  ADD COLUMN IF NOT EXISTS my_team_actual TEXT[];
