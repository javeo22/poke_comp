# Pokemon Champions Companion - Project Instructions

## Project Overview
Personal companion app for Pokemon Champions (competitive battling game, launched April 8, 2026). Solo side project, 8-week MVP timeline. Personal tool first, portfolio piece second.

## Tech Stack (fixed, do not suggest alternatives)
- **Frontend:** Next.js 14 with App Router, Tailwind CSS v4
- **Backend:** Python FastAPI
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Deployment:** Vercel (web + API as Python function), Supabase (database)
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **Package managers:** uv (Python), pnpm (JavaScript)
- **Data sources:** PokeAPI for bulk import, targeted scraping for Champions meta

## Repository Structure
```
poke_comp/
├── api/          # Python FastAPI backend (uv)
├── web/          # Next.js 14 frontend (pnpm)
├── supabase/     # SQL migration files
├── infra/        # Dockerfiles, Cloud Run configs
├── design/       # Design system specs
├── .github/      # CI workflows
```

## Key Conventions
- **IDs:** Pokemon, moves, items, abilities use PokeAPI integer IDs as primary keys
- **Names:** Stored as Title Case ("Thunder Punch", not "thunder-punch")
- **No ORM:** Direct Supabase client queries, SQL migrations
- **Types:** Pydantic models (Python) are source of truth; TypeScript interfaces mirror manually
- **Borders:** 1px solid `outline-variant` on cards, panels, and inputs for clear boundaries.
- **Radii:** 0.75rem for cards, 0.5rem for buttons/inputs, 9999px only for badges/dots.
- **Text color:** Use on-surface (#E4E7ED), never pure white (#FFFFFF).

## Design System: Battle Station
Tactical, high-contrast dark UI built for competitive play scan speed. Information-dense but never cluttered.
- **Core Principle:** Scan speed over spectacle. Data in 200ms during live matches.
- **Flat Materiality:** Opaque panels with borders. No glassmorphism, no 3D perspective, no backdrop-blur.
- **Motion:** GSAP for entrance staggers and panel slides. 2D only -- no 3D tilt, no perspective transforms.
- **Cards:** `.card` (static) or `.card-interactive` (hoverable) classes. Opaque bg-surface-low with 1px border.
- **Buttons:** `.btn-primary` (solid sky blue) or `.btn-ghost` (transparent with border). No gradients, no glow.
- **Inputs:** `.input-field` class. Focus ring with primary color.
- **Hover:** CSS-only `transition-colors duration-150`. No GSAP hover effects.
- **Grid entrance:** `gsap.fromTo` with `{ opacity: 0, y: 20 }` -> `{ opacity: 1, y: 0 }`, stagger 0.03s.

## Data Model Decisions
- `movepool` and `abilities` on pokemon table are TEXT[] (denormalized, no FK to moves/abilities tables)
- Champions data overwrites PokeAPI baseline -- no dual columns for base vs Champions values
- Items are seeded manually via Champions seed script (not imported from PokeAPI)

## Post-Implementation Checklist
After completing any implementation work, always update:
1. `todo.md` — check off completed items, add new ones if needed
2. `plan.md` — mark completed tasks
3. **Notion project page** — https://www.notion.so/Pokemon-Champions-Companion-33f1ec88fdeb81dd8994d30a7be3c5b5

## Working With Me
- Ask clarifying questions before major decisions
- Present 2-3 options with trade-offs when multiple valid approaches exist
- Do not use emojis
- Pause for review after each major chunk
- Respect 8-week timeline: features not in F1-F6 do not ship in MVP
- Ask instead of guessing about Pokemon Champions mechanics (game is new)

## Commands
- **API dev server:** `cd api && uv run uvicorn app.main:app --reload`
- **Web dev server:** `cd web && pnpm dev`
- **API lint:** `cd api && uv run ruff check app/ scripts/`
- **API types:** `cd api && uv run pyright app/ scripts/`
- **Web lint:** `cd web && pnpm lint`
- **Web build:** `cd web && pnpm build`
- **PokeAPI import:** `cd api && uv run python -m scripts.import_pokeapi`
- **Champions seed:** `cd api && uv run python -m scripts.seed_champions`
- **Serebii import:** `cd api && uv run python -m scripts.ingest.serebii_static`
- **Usage ingest (Smogon):** `cd api && uv run python -m scripts.ingest.smogon_meta`
- **Teams ingest (Limitless):** `cd api && uv run python -m scripts.ingest.limitless_teams`
- **Usage ingest (Pikalytics):** `cd api && uv run python -m scripts.ingest.pikalytics_usage`
- **Tier list refresh (AI):** `cd api && uv run python -m scripts.refresh_meta`
- **Data validation:** `cd api && uv run python -m scripts.validate_data`
- **Data validation (fix mode):** `cd api && uv run python -m scripts.validate_data --fix`
- **Smoke test:** `cd api && uv run python -m scripts.smoke_test`
- **Seed user data:** `cd api && uv run python ../scripts/seed_user_data.py`

## Data Pipeline

**Source of truth (2026-04-17 onward): the live Supabase DB.**

The curated roster + items + moves + abilities in the `pokecomp` Supabase project
is the authoritative state. External sources (PokeAPI, Serebii, seed script lists)
sometimes list things that aren't actually in the Champions shop / game (e.g. 21
held items that exist in PokeAPI but have never shipped to the live shop), or
have ingest-time bugs that cause category drift (e.g. berries miscategorized as
mega_stone pre-2026-04-17).

Changes to static game data (new Pokemon, new items, movepool updates) should
happen via **on-demand migrations** after manual verification in-game, not via
blanket re-runs of the destructive seed/ingest scripts. `seed_champions.py` and
`serebii_static.py` require `--confirm-destructive` to run for this reason.

Usage data (Smogon / Pikalytics / Limitless) can continue to auto-refresh via
Vercel Cron -- tournament stats are time-series, not game state.

Scripts are organized into three layers:

**One-time setup** (run ONCE on a fresh DB; NOT re-run on minor patches):
- `scripts/import_pokeapi.py` -- PokeAPI bulk import (pokemon, moves, abilities)
- `scripts/seed_champions.py` -- Champions roster flags, items, mega links. Requires `--confirm-destructive`.
- `scripts/ingest/serebii_static.py` -- Champions-verified movepools, abilities, items, moves, mega data. Requires `--confirm-destructive`.
- `scripts/validate_champions_sources.py` -- read-only audit against Serebii + PokeAPI; produces `api/champions_validation_report.json`.

**Automated refresh** (Vercel Cron, wired in `vercel.json`):
- `scripts/ingest/smogon_meta.py` -- Usage stats from Smogon (gen9vgc2026) -> `pokemon_usage` table (Mon 06:00 UTC)
- `scripts/ingest/pikalytics_usage.py` -- Tournament-weighted usage stats from Pikalytics -> `pokemon_usage` table (Mon 07:00 UTC)
- `scripts/ingest/limitless_teams.py` -- Tournament teams from Limitless VGC API -> `tournament_teams` table (daily 08:00 UTC)
- `scripts/refresh_meta.py` -- DEPRECATED 2026-04-16: Game8 source removed per ToS audit; SOURCES empty (see LEGAL_AND_DEV_GUIDELINES.md section 1.C)

Each ingest script exposes `run(dry_run=False) -> IngestResult` (see `api/app/models/ingest.py`), invoked via CLI or the cron HTTP endpoints under `/admin/cron/*` (see `api/app/routers/admin_cron.py`). Cron endpoints require `Authorization: Bearer $CRON_SECRET`.

**Validation** (run after ingest or on-demand):
- `scripts/validate_data.py` -- 8-check data integrity validator (--fix mode to auto-repair); Vercel Cron runs `--fix` weekly Mon 09:30 UTC
- `scripts/smoke_test.py` -- Quick pass/fail data health check
- `GET /admin/data-health` -- API endpoint for data health monitoring
