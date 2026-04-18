-- Manual movepool overrides for Pokemon where the upstream ingest pipeline
-- (PokeAPI baseline + Serebii overlay) misses moves that ship in the actual
-- live Champions game.
--
-- This migration is the surgical fix layer of the Workstream-3 layered
-- defense. The systematic fixes (validator + scraper) come later; this is
-- where verified-by-eye moves get patched in immediately.
--
-- Pattern:
--   UPDATE pokemon
--   SET movepool = ARRAY(SELECT DISTINCT unnest(movepool || ARRAY['Move A','Move B']))
--   WHERE name = 'Pokemon Name';
--
-- Move names must match the canonical casing in the `moves` table (PokeAPI
-- convention: Title Case for the first word, lowercase after hyphens, e.g.
-- "Freeze-dry", "Will-o-wisp"). Use:
--   SELECT name FROM moves WHERE name ILIKE '%freeze%';
-- to confirm before adding.
--
-- DISTINCT unnest() makes this idempotent -- re-running adds no duplicates.

-- 2026-04-17 fix: Alolan Ninetales (id 10104, "Ninetales Alola") was missing
-- Freeze-dry, its iconic Ice/Special move that hits Water 4x. Reported by user
-- after seeing it in-game.
UPDATE pokemon
SET movepool = ARRAY(SELECT DISTINCT unnest(movepool || ARRAY['Freeze-dry']))
WHERE name = 'Ninetales Alola';
