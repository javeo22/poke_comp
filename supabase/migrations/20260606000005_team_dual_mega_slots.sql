-- Allow a saved team to record up to two Mega options while preserving the
-- existing single-Mega columns for older API consumers.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS mega_pokemon_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mega_form_pokemon_ids INT[] NOT NULL DEFAULT '{}';

UPDATE teams
SET mega_pokemon_ids = ARRAY[mega_pokemon_id]
WHERE mega_pokemon_id IS NOT NULL
  AND cardinality(mega_pokemon_ids) = 0;

UPDATE teams
SET mega_form_pokemon_ids = ARRAY[mega_form_pokemon_id]
WHERE mega_form_pokemon_id IS NOT NULL
  AND cardinality(mega_form_pokemon_ids) = 0;

ALTER TABLE teams
  DROP CONSTRAINT IF EXISTS teams_mega_pokemon_ids_max_2,
  DROP CONSTRAINT IF EXISTS teams_mega_form_pokemon_ids_max_2,
  DROP CONSTRAINT IF EXISTS teams_mega_form_count_matches_pokemon_count;

ALTER TABLE teams
  ADD CONSTRAINT teams_mega_pokemon_ids_max_2
    CHECK (cardinality(mega_pokemon_ids) <= 2),
  ADD CONSTRAINT teams_mega_form_pokemon_ids_max_2
    CHECK (cardinality(mega_form_pokemon_ids) <= 2),
  ADD CONSTRAINT teams_mega_form_count_matches_pokemon_count
    CHECK (
      cardinality(mega_form_pokemon_ids) = 0
      OR cardinality(mega_form_pokemon_ids) = cardinality(mega_pokemon_ids)
    );
