# Decision Log

Architectural and design decisions made during development, with rationale.

---

## D001: Use PokeAPI IDs as primary keys
**Date:** 2026-04-10
**Context:** Pokemon, moves, items, and abilities tables need integer IDs. Could use auto-increment or PokeAPI's stable IDs.
**Decision:** Use PokeAPI integer IDs directly as primary keys.
**Rationale:** Makes imports idempotent, cross-referencing trivial, no mapping layer needed. PokeAPI IDs are stable and well-known (Charizard = 6).

## D002: Denormalized movepool and abilities on pokemon table
**Date:** 2026-04-10
**Context:** Pokemon's `movepool` and `abilities` columns could be TEXT[] (names) or INT[] (FK to moves/abilities tables), or junction tables.
**Decision:** TEXT[] storing move/ability names as strings.
**Rationale:** Simpler queries for display and filtering. No join needed for common operations. Referential integrity not critical for a personal tool at MVP. Migration to FK approach is straightforward if needed later.

## D003: Champions data overwrites PokeAPI baseline
**Date:** 2026-04-10
**Context:** Champions may have different movepools, stats, abilities vs mainline games. Could store both (dual columns) or overwrite.
**Decision:** Overwrite with Champions data. Single column per field.
**Rationale:** This is a Champions tool. Baseline data is just bootstrap. No need to diff against mainline. Keeps schema simple.

## D004: Items seeded manually, not imported from PokeAPI
**Date:** 2026-04-10
**Context:** PokeAPI has 2000+ items. Champions has a VP shop with specific items. Could import all then filter, or seed only relevant ones.
**Decision:** Seed Champions items directly via seed_champions.py. Skip PokeAPI item import.
**Rationale:** Most PokeAPI items are irrelevant (Potions, Key Items, etc.). Champions has its own item economy (VP costs). Manual seed gives full control over what matters.

## D005: No shared types directory
**Date:** 2026-04-10
**Context:** Python backend + TypeScript frontend can't share types directly. Options: shared/ with JSON schemas, auto-gen from OpenAPI, or manual mirroring.
**Decision:** TypeScript interfaces in web/src/types/ manually mirror Pydantic models. No shared/ directory.
**Rationale:** Simplest approach for a solo project. Auto-gen from OpenAPI is a nice-to-have for later. Two sets of types to maintain is manageable with 4 resources.

## D006: Tailwind CSS v4 with CSS-first config
**Date:** 2026-04-10
**Context:** Next.js scaffolded with Tailwind v4 which uses @theme in CSS instead of tailwind.config.ts.
**Decision:** Embrace CSS-first approach. Full design system defined in globals.css @theme block.
**Rationale:** Tailwind v4 default. Keeps design tokens co-located with utility classes. No separate config file to maintain.

## D007: No monorepo tooling (nx, turborepo)
**Date:** 2026-04-10
**Context:** Two apps (api + web) in one repo. Could use monorepo tools for orchestration.
**Decision:** Just two separate package managers (uv + pnpm) in their own directories.
**Rationale:** Solo project. No shared build steps, no shared dependencies. Monorepo tools add complexity with no benefit at this scale.

## D008: next/image with unoptimized for sprites
**Date:** 2026-04-10
**Context:** Pokemon sprites from PokeAPI CDN. next/image requires domain config and adds optimization overhead for tiny pixel art.
**Decision:** Use next/image with `unoptimized` prop.
**Rationale:** Satisfies ESLint rule, avoids image optimization overhead for 96x96 pixel art sprites. Can revisit if we add larger images later.
