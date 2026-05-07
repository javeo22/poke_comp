-- Add durable structured match-review fields from the UX audit.
--
-- All fields are nullable and additive. Existing logs continue to validate,
-- while tournament sets, opponent selections, replay URLs, and post-game
-- adjustments become queryable instead of being buried in notes.

ALTER TABLE matchup_log
  ADD COLUMN IF NOT EXISTS replay_url TEXT,
  ADD COLUMN IF NOT EXISTS opponent_name TEXT,
  ADD COLUMN IF NOT EXISTS opponent_rating INTEGER,
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS round_label TEXT,
  ADD COLUMN IF NOT EXISTS game_number INTEGER,
  ADD COLUMN IF NOT EXISTS set_id UUID,
  ADD COLUMN IF NOT EXISTS opponent_lead_pair TEXT[],
  ADD COLUMN IF NOT EXISTS opponent_selected_four TEXT[],
  ADD COLUMN IF NOT EXISTS my_selected_four TEXT[],
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS win_condition TEXT,
  ADD COLUMN IF NOT EXISTS key_turn TEXT,
  ADD COLUMN IF NOT EXISTS adjustment_note TEXT;

ALTER TABLE matchup_log
  ALTER COLUMN my_team_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matchup_log_user_event
  ON matchup_log(user_id, event_name)
  WHERE event_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matchup_log_user_set
  ON matchup_log(user_id, set_id)
  WHERE set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matchup_log_my_selected_four
  ON matchup_log USING GIN(my_selected_four);

CREATE INDEX IF NOT EXISTS idx_matchup_log_opponent_selected_four
  ON matchup_log USING GIN(opponent_selected_four);
