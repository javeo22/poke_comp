-- Fix base Pokemon data that picked up regional form metadata.
--
-- Base Raichu is Electric-only and can use Static / Lightning Rod.
-- Alolan Raichu is Electric/Psychic and has Surge Surfer.

UPDATE pokemon
SET
  types = ARRAY['electric']::TEXT[],
  base_stats = '{"hp":60,"attack":90,"defense":55,"sp_attack":90,"sp_defense":80,"speed":110}'::JSONB,
  abilities = ARRAY['Static','Lightning Rod']::TEXT[]
WHERE id = 26
  AND name = 'Raichu';

UPDATE pokemon
SET
  types = ARRAY['electric','psychic']::TEXT[],
  base_stats = '{"hp":60,"attack":85,"defense":50,"sp_attack":95,"sp_defense":85,"speed":110}'::JSONB,
  abilities = ARRAY['Surge Surfer']::TEXT[]
WHERE id = 10100
  AND name = 'Raichu Alola';

UPDATE pokemon
SET
  types = ARRAY['fire']::TEXT[],
  base_stats = '{"hp":90,"attack":110,"defense":80,"sp_attack":100,"sp_defense":80,"speed":95}'::JSONB,
  abilities = ARRAY['Intimidate','Flash Fire','Justified']::TEXT[]
WHERE id = 59
  AND name = 'Arcanine';

UPDATE pokemon
SET
  types = ARRAY['water']::TEXT[],
  base_stats = '{"hp":95,"attack":100,"defense":85,"sp_attack":108,"sp_defense":70,"speed":70}'::JSONB,
  abilities = ARRAY['Torrent','Shell Armor']::TEXT[]
WHERE id = 503
  AND name = 'Samurott';

UPDATE pokemon
SET
  types = ARRAY['ice']::TEXT[],
  base_stats = '{"hp":95,"attack":117,"defense":184,"sp_attack":44,"sp_defense":46,"speed":28}'::JSONB,
  abilities = ARRAY['Own Tempo','Ice Body','Sturdy']::TEXT[]
WHERE id = 713
  AND name = 'Avalugg';

UPDATE pokemon
SET
  types = ARRAY['fire']::TEXT[],
  base_stats = '{"hp":78,"attack":84,"defense":78,"sp_attack":109,"sp_defense":85,"speed":100}'::JSONB,
  abilities = ARRAY['Blaze','Flash Fire']::TEXT[]
WHERE id = 157
  AND name = 'Typhlosion';
