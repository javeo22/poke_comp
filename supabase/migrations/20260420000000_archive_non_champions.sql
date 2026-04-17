-- Prune non-Champions Pokemon, moves, and items with archive-first safety.
--
-- User-requested 2026-04-16: "no need to have all 1k pokemon, we just need
-- champions available, same for items and same for movesets."
--
-- Strategy: archive-then-delete. Create `*_archive` tables that mirror the
-- live schemas and copy the rows to be removed, then DELETE from live. If
-- Champions adds a Pokemon in a future patch we can restore from archive
-- without re-downloading PokeAPI.
--
-- Kept rows (NOT deleted):
--   pokemon:
--     - champions_eligible = true (201 rows: 186 base + 15 regional variants)
--     - all megas (id >= 10000) because pokemon.mega_evolution_id FK'd to
--       them from Champions bases. ~59 rows.
--   moves: champions_available = true (494 rows)
--   items: champions_shop_available = true OR id referenced by any
--          user_pokemon.item_id (1 item kept due to active reference)
--
-- Archived + deleted:
--   pokemon: ~839 non-Champions non-mega rows
--   moves:   ~438 non-Champions moves
--   items:   ~32 non-Champions items
--
-- Reversibility: archive tables are standalone. To restore, INSERT
-- archived rows back into the live tables.

-- ============================================================================
-- POKEMON ARCHIVE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pokemon_archive (
  LIKE pokemon INCLUDING DEFAULTS,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_reason TEXT DEFAULT 'non-champions prune 2026-04-17'
);

INSERT INTO pokemon_archive
SELECT p.*, NOW(), 'non-champions prune 2026-04-17'
FROM pokemon p
WHERE NOT p.champions_eligible
  AND p.id < 10000
ON CONFLICT DO NOTHING;

DELETE FROM pokemon
WHERE NOT champions_eligible
  AND id < 10000;

-- ============================================================================
-- MOVES ARCHIVE
-- ============================================================================

CREATE TABLE IF NOT EXISTS moves_archive (
  LIKE moves INCLUDING DEFAULTS,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_reason TEXT DEFAULT 'non-champions prune 2026-04-17'
);

INSERT INTO moves_archive
SELECT m.*, NOW(), 'non-champions prune 2026-04-17'
FROM moves m
WHERE NOT m.champions_available
ON CONFLICT DO NOTHING;

DELETE FROM moves
WHERE NOT champions_available;

-- ============================================================================
-- ITEMS ARCHIVE
-- ============================================================================

CREATE TABLE IF NOT EXISTS items_archive (
  LIKE items INCLUDING DEFAULTS,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_reason TEXT DEFAULT 'non-champions prune 2026-04-17'
);

-- Keep items referenced from any user_pokemon.item_id even if not currently
-- in the Champions shop. That reference is an FK with ON DELETE NO ACTION
-- (default), so deletion would fail and also orphan a user's saved build.
INSERT INTO items_archive
SELECT i.*, NOW(), 'non-champions prune 2026-04-17'
FROM items i
WHERE NOT i.champions_shop_available
  AND NOT EXISTS (
    SELECT 1 FROM user_pokemon up WHERE up.item_id = i.id
  )
ON CONFLICT DO NOTHING;

DELETE FROM items
WHERE NOT champions_shop_available
  AND NOT EXISTS (
    SELECT 1 FROM user_pokemon up WHERE up.item_id = items.id
  );
