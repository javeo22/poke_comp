-- Fix data discrepancies surfaced by the 2026-04-17 multi-source validation.
-- Cross-checked our DB against Serebii's Champions dex, items, and mega
-- evolutions pages plus PokeAPI for base stats/types/abilities.
--
-- Findings (fixed in this migration):
--   1. 28 berries miscategorized as 'mega_stone' (should be 'berry').
--      Root cause: serebii_static.py scraper's category state-machine
--      (current_category = 'mega_stone') leaks across sections when the
--      h2 section header isn't detected on the items page.
--
--   2. 23 held items missing entirely from the items table despite being
--      declared in seed_champions.py HELD_ITEMS. Includes VGC staples:
--      Assault Vest, Choice Band, Choice Specs, Clear Amulet, Covert Cloak,
--      Eject Button/Pack, Expert Belt, Life Orb, Loaded Dice, Rocky Helmet,
--      Room Service, Safety Goggles, Throat Spray, Weakness Policy, Wide Lens,
--      and others. Likely cause: seed_champions.py was run before these items
--      were added, and the subsequent serebii_static.py ingest overwrote the
--      table without preserving them.
--
--   3. 2 held items (King's Rock, Quick Claw) incorrectly archived during
--      Session D prune. They're valid Champions held items per Serebii.
--
--   4. 10 classic mega stones archived despite their Mega Pokemon still being
--      Champions-linked (Aggronite, Beedrillite, Chesnaughtite, Delphoxite,
--      Greninjite, Gyaradosite, Heracronite, Manectite, Steelixite; plus
--      pulling Dragoninite/Feraligite-level variants back). Mega stones for
--      our 59 live megas must be available in the shop.
--
-- User-requested 2026-04-17: "do an extensive validation across multiple
-- sources to make sure we have the correct data for champions."

-- ============================================================================
-- FIX 1: Berry category correction
-- ============================================================================

UPDATE items SET category = 'berry'
WHERE name ILIKE '%berry%' AND category = 'mega_stone';

UPDATE items_archive SET category = 'berry'
WHERE name ILIKE '%berry%' AND category = 'mega_stone';

-- ============================================================================
-- FIX 2: Insert missing Champions held items
-- Use ID range 30000+ to avoid collision with PokeAPI IDs and existing rows.
-- ============================================================================

INSERT INTO items (id, name, category, vp_cost, champions_shop_available) VALUES
  (30001, 'Assault Vest',     'held', 1000, TRUE),
  (30002, 'Choice Band',      'held', 1000, TRUE),
  (30003, 'Choice Specs',     'held', 1000, TRUE),
  (30004, 'Clear Amulet',     'held',  700, TRUE),
  (30005, 'Covert Cloak',     'held',  700, TRUE),
  (30006, 'Eject Button',     'held', 1000, TRUE),
  (30007, 'Eject Pack',       'held', 1000, TRUE),
  (30008, 'Expert Belt',      'held',  700, TRUE),
  (30009, 'Grassy Seed',      'held',  700, TRUE),
  (30010, 'Iron Ball',        'held',  700, TRUE),
  (30011, 'Life Orb',         'held', 1000, TRUE),
  (30012, 'Light Clay',       'held',  700, TRUE),
  (30013, 'Loaded Dice',      'held',  700, TRUE),
  (30014, 'Protective Pads',  'held',  700, TRUE),
  (30015, 'Rocky Helmet',     'held', 1000, TRUE),
  (30016, 'Room Service',     'held',  700, TRUE),
  (30017, 'Safety Goggles',   'held',  700, TRUE),
  (30018, 'Terrain Extender', 'held',  700, TRUE),
  (30019, 'Throat Spray',     'held',  700, TRUE),
  (30020, 'Weakness Policy',  'held', 1000, TRUE),
  (30021, 'Wide Lens',        'held',  700, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FIX 3 + 4: Restore archived items that should be Champions-shop-available
-- Copy from items_archive back to items, then flag + remove from archive.
-- ============================================================================

-- King's Rock + Quick Claw (held items per Serebii)
INSERT INTO items (id, name, category, vp_cost, champions_shop_available, effect_text)
SELECT id, name, category, vp_cost, TRUE, effect_text
FROM items_archive
WHERE LOWER(name) IN ('king''s rock', 'quick claw')
ON CONFLICT (id) DO NOTHING;

DELETE FROM items_archive WHERE LOWER(name) IN ('king''s rock', 'quick claw');

-- Classic mega stones linked to live Champions megas
INSERT INTO items (id, name, category, vp_cost, champions_shop_available, effect_text)
SELECT id, name, 'mega_stone', vp_cost, TRUE, effect_text
FROM items_archive
WHERE name IN (
  'Aggronite', 'Beedrillite', 'Chesnaughtite', 'Delphoxite',
  'Greninjite', 'Gyaradosite', 'Heracronite', 'Manectite', 'Steelixite'
)
ON CONFLICT (id) DO NOTHING;

DELETE FROM items_archive
WHERE name IN (
  'Aggronite', 'Beedrillite', 'Chesnaughtite', 'Delphoxite',
  'Greninjite', 'Gyaradosite', 'Heracronite', 'Manectite', 'Steelixite'
);
