-- Add username (for public profiles) and supporter flag (for tiered quotas)

ALTER TABLE user_profiles
  ADD COLUMN username TEXT UNIQUE CHECK (username ~ '^[a-z0-9_-]{3,20}$'),
  ADD COLUMN supporter BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX idx_profiles_username ON user_profiles(username)
  WHERE username IS NOT NULL;

-- Allow anyone to view profiles that have a public username set
CREATE POLICY "Anyone can view public profiles"
  ON user_profiles FOR SELECT
  USING (username IS NOT NULL);
