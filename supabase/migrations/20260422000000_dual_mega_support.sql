-- Support multiple mega evolutions per Pokemon (Charizard has X and Y).
-- Add mega_evolution_ids INT[] to replace the single mega_evolution_id FK.
-- Add mega_form_pokemon_id INT to teams so a team can record which specific
-- mega form is designated (e.g. Mega Charizard X vs Y).

-- Step 1: add the array column to pokemon
ALTER TABLE pokemon
  ADD COLUMN IF NOT EXISTS mega_evolution_ids INT[] NOT NULL DEFAULT '{}';

-- Step 2: backfill from the existing single FK
UPDATE pokemon
SET mega_evolution_ids = ARRAY[mega_evolution_id]
WHERE mega_evolution_id IS NOT NULL;

-- Step 3: give Charizard (id=6) both megas
--   10034 = Mega Charizard X (Fire/Dragon, Tough Claws)
--   10035 = Mega Charizard Y (Fire/Flying, Drought)
UPDATE pokemon
SET mega_evolution_ids = ARRAY[10034, 10035]
WHERE id = 6;

-- Step 4: add the form selector to teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS mega_form_pokemon_id INT REFERENCES pokemon(id);
