-- Revert the 21 items inserted by 20260421000000_champions_data_audit_fixes.sql
-- per user feedback 2026-04-17: these items exist in game source code but
-- are NOT visible or usable in the live Champions shop. The live DB is the
-- source of truth; external sources (Serebii items.shtml, seed_champions.py
-- HELD_ITEMS, PokeAPI) are not authoritative for what has actually shipped.
--
-- Lesson captured in CLAUDE.md Data Pipeline section: cross-source audits
-- catch drift but the final word is in-game inspection by the user.

DELETE FROM items WHERE id BETWEEN 30001 AND 30021;
