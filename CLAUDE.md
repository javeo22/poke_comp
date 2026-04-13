# Pokemon Champions Companion - Project Instructions

## Project Overview
Personal companion app for Pokemon Champions (competitive battling game, launched April 8, 2026). Solo side project, 8-week MVP timeline. Personal tool first, portfolio piece second.

## Tech Stack (fixed, do not suggest alternatives)
- **Frontend:** Next.js 14 with App Router, Tailwind CSS v4
- **Backend:** Python FastAPI
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Deployment:** Cloud Run (API), Vercel (web)
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
- **No borders:** UI uses background color shifts, not 1px borders (design spec)
- **Radii:** Minimum 1rem ("chunky") or pill (9999px), never 4px/8px
- **Text color:** Use on-surface (#E2E1F1), never pure white (#FFFFFF)

## Design System: The Orbital Archive (Antigravity)
The UI is a holographic projection floating in a weightless void. See `design/ANTIGRAVITY_DESIGN_REVIEW.md`.
- **Core Principle:** Elements orbit the user; they are never "fixed" or "heavy."
- **Z-Axis Depth:** Mandatory use of CSS `perspective: 1000px` on main layouts.
- **Motion:** GSAP is the source of truth for all physics. No instant snaps. No generic ease-out.
- **Glassmorphism:** `backdrop-filter: blur(16px)` with variable opacity (30-70%) based on elevation.
- **Shadows:** Natural, ultra-diffused ambient occlusion. Shadows tint towards surface color.
- **No Borders:** Strictly prohibited. Use tonal shifts and glass refraction for definition.
- **Interaction:** Every hover must trigger a 3D tilt or slight Z-lift. Stagger all grid entrances.

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
- **Tier list refresh (AI):** `cd api && uv run python -m scripts.refresh_meta`

## Data Pipeline
Scripts are organized into three layers:

**One-time setup** (run once, re-run on game patches):
- `scripts/import_pokeapi.py` -- PokeAPI bulk import (pokemon, moves, abilities)
- `scripts/seed_champions.py` -- Champions roster flags, items, mega links
- `scripts/ingest/serebii_static.py` -- Champions-verified movepools, abilities, items, moves, mega data

**Automated refresh** (scheduled weekly/daily):
- `scripts/ingest/smogon_meta.py` -- Usage stats from Smogon -> `pokemon_usage` table
- `scripts/ingest/limitless_teams.py` -- Tournament teams -> `tournament_teams` table
- `scripts/refresh_meta.py` -- AI-extracted tier lists -> `meta_snapshots` table (daily cron)

**On-demand** (via API):
- `POST /meta/scrape` -- Trigger Game8 tier list scrape from the API
