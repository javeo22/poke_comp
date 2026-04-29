# Decisions (Locked)

Synthesized from ADR `decisions.md` (locked per manifest, all 9 entries treated as Accepted/locked).

---

## D001 — PokeAPI integer IDs as primary keys
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: pokemon, moves, items, abilities — primary key strategy
- decision: Use PokeAPI integer IDs directly as primary keys for `pokemon`, `moves`, `items`, `abilities`. No auto-increment, no mapping layer.
- rationale: Idempotent imports; trivial cross-referencing; PokeAPI IDs are stable and well-known (Charizard = 6).

## D002 — Denormalized movepool and abilities (TEXT[])
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: `pokemon` table — `movepool`, `abilities` columns
- decision: Store `movepool` and `abilities` as `TEXT[]` of names on the `pokemon` row. No FK to moves/abilities tables, no junction tables.
- rationale: Simpler queries for display + filtering; no joins for common ops; referential integrity not critical at MVP; FK migration remains cheap if ever needed.

## D003 — Champions data overwrites PokeAPI baseline
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: data ingestion — Champions vs mainline divergence (movepools, stats, abilities)
- decision: Overwrite PokeAPI baseline values with Champions-verified values. Single column per field; no dual-column "base vs Champions".
- rationale: This is a Champions-only tool; baseline is just bootstrap; no diff-against-mainline use case.

## D004 — Items seeded manually, not imported from PokeAPI
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: `items` table — population strategy
- decision: Seed Champions items directly via `seed_champions.py`. Skip PokeAPI item import entirely.
- rationale: PokeAPI ships 2000+ items, most irrelevant (Potions, Key Items). Champions has its own VP-priced shop economy; manual seed gives full control.

## D005 — No shared types directory; manual mirror
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: type sharing between Python backend and TypeScript frontend
- decision: Pydantic models in `api/app/models/` are source of truth. TypeScript interfaces in `web/src/types/` are mirrored manually. No `shared/` directory, no OpenAPI codegen at MVP.
- rationale: Solo project; OpenAPI codegen is a nice-to-have for later; two sets of types are manageable at MVP scale.

## D006 — Tailwind CSS v4 with CSS-first `@theme` config
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: design system configuration
- decision: Embrace Tailwind v4's CSS-first approach. Full design tokens defined in `web/src/app/globals.css` `@theme` block. No `tailwind.config.ts`.
- rationale: Tailwind v4 default; tokens co-located with utilities; no separate config to maintain.

## D007 — No monorepo tooling
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: repo orchestration — `api/` + `web/`
- decision: Two separate package managers (`uv` for Python, `pnpm` for JavaScript) in their own directories. No nx, no turborepo.
- rationale: Solo project; no shared build steps or shared dependencies; monorepo tooling adds cost without benefit at this scale.

## D008 — `next/image` with `unoptimized` for sprites
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-10
- scope: image rendering for Pokemon sprites
- decision: Use `next/image` with `unoptimized` prop for PokeAPI sprite URLs.
- rationale: Satisfies ESLint rule; avoids optimization overhead for 96x96 pixel art; revisit if larger images are added.

## D009 — Multi-source data ingestion strategy (volatility-tiered)
- source: /Users/javiervega/projects/poke_comp/decisions.md
- status: locked
- date: 2026-04-12
- scope: external data sources for game data + meta
- decision: Categorize sources by volatility:
  - Static — Serebii (one-time / monthly): base roster, VP shop data.
  - Meta — Pikalytics (weekly): usage stats, item popularity, move trends.
  - Contextual — Limitless (weekly): tournament team comps, matchup history.
- rationale: Serebii is protective but the data is static (hit once); Pikalytics + Limitless are open/community-driven and supply the meta. Reduces external load and keeps data fresh.
- related-constraint: see `constraints.md` C-LEGAL-* for ethical scraping and per-source ToS audit.
