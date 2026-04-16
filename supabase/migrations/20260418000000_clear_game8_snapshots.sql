-- Clears legacy Game8-sourced meta_snapshots rows.
-- The Game8 scraper was removed in Session 2 of 2026-04-16 (workstream G3)
-- after the site added anti-AI ToS and bot blocks. Remaining rows are stale
-- and contain Pokemon name references ("Wash Rotom", etc.) that no longer
-- match the canonical roster after name_resolver was introduced.
--
-- Verified pre-apply state (2026-04-16): 3 rows, all source='Game8',
-- snapshot_date=2026-04-10, pointing at archives/592465.
-- Match is case-insensitive on source and uses source_url ILIKE as a
-- safety fallback so the migration is robust to casing drift.

DELETE FROM meta_snapshots
WHERE LOWER(source) = 'game8' OR source_url ILIKE '%game8%';
