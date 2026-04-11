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

## Design System
See `design/palette.md` for full spec. Key points:
- **Fonts:** Space Grotesk (headers/labels), Plus Jakarta Sans (body)
- **Surface hierarchy:** surface -> surface-low -> surface-mid -> surface-high -> surface-highest
- **Glass panels:** primary-container at 40-60% opacity with backdrop-blur
- **Accent colors:** primary (#C1C1FF), secondary/neon teal (#56E8C5), tertiary/berry red (#E8567A)

## Data Model Decisions
- `movepool` and `abilities` on pokemon table are TEXT[] (denormalized, no FK to moves/abilities tables)
- Champions data overwrites PokeAPI baseline -- no dual columns for base vs Champions values
- Items are seeded manually via Champions seed script (not imported from PokeAPI)

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
