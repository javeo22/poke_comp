<!-- refreshed: 2026-04-28 -->
# STRUCTURE.md

**Analysis Date:** 2026-04-28

## Directory Layout

```
poke_comp/
├── CLAUDE.md                          # Project instructions (canonical conventions)
├── LEGAL_AND_DEV_GUIDELINES.md        # Ethical scraping, IP, monetization audit
├── README.md                          # Project README
├── champions-prd.md                   # Product requirements
├── decisions.md                       # Architecture decision log
├── plan.md                            # Implementation plan
├── todo.md                            # Active todo list
├── rag-architecture.md                # AI/RAG design notes
├── package.json                       # Workspace-level npm scripts
├── requirements.txt                   # Top-level Python deps marker
├── vercel.json                        # Vercel config: rewrites, crons, framework
├── seed_user.py                       # Standalone helper (legacy)
├── api/                               # Python FastAPI backend (uv)
│   ├── pyproject.toml                 # uv-managed project, ruff/pyright config
│   ├── uv.lock                        # uv lockfile
│   ├── index.py                       # Vercel ASGI entry (strips /api prefix)
│   ├── .env / .env.example            # Local env (NEVER read .env contents)
│   ├── app/                           # FastAPI application package
│   │   ├── main.py                    # FastAPI() instance, mounts routers, middleware
│   │   ├── auth.py                    # JWT verify (ES256 JWKS, HS256 secret)
│   │   ├── config.py                  # pydantic-settings env resolver
│   │   ├── database.py                # supabase singleton client
│   │   ├── limiter.py                 # slowapi rate limiter
│   │   ├── ai_quota.py                # Daily/monthly AI quota + pricing
│   │   ├── prompt_guard.py            # Sanitize user-supplied free text
│   │   ├── validators.py              # Champions legality validators
│   │   ├── routers/                   # 18 HTTP routers
│   │   │   ├── pokemon.py, moves.py, items.py, abilities.py
│   │   │   ├── user_pokemon.py, teams.py, matchups.py, profile.py
│   │   │   ├── meta.py, usage.py, draft.py, cheatsheet.py, calc.py
│   │   │   ├── strategy.py, ai_usage.py
│   │   │   ├── public.py              # No-auth endpoints
│   │   │   ├── admin.py               # Admin CRUD + dashboards
│   │   │   └── admin_cron.py          # Vercel Cron entry points
│   │   ├── models/                    # Pydantic models (source of truth)
│   │   │   ├── pokemon.py, moves.py, items.py, abilities.py
│   │   │   ├── user_pokemon.py, team.py, matchup.py, profile.py
│   │   │   ├── meta.py, usage.py, draft.py, cheatsheet.py
│   │   │   └── ingest.py              # Shared IngestResult shape
│   │   └── services/                  # Reusable business logic
│   │       ├── damage_calc.py         # Deterministic Gen 9 damage formula
│   │       ├── cache_utils.py         # v2-prefixed cache keys
│   │       ├── ai_verifier.py         # Cross-check AI claims
│   │       ├── showdown_parser.py     # Showdown paste import/export
│   │       ├── strategy_context.py    # Inject admin notes into prompts
│   │       ├── data_freshness.py      # Snapshot age helpers
│   │       └── name_resolver.py       # Pokemon name aliases
│   └── scripts/                       # Data-pipeline scripts
│       ├── import_pokeapi.py          # One-time PokeAPI bulk import
│       ├── seed_champions.py          # One-time Champions seed (--confirm-destructive)
│       ├── refresh_meta.py            # DEPRECATED (Game8 removed)
│       ├── validate_data.py           # 7-check validator (--fix)
│       ├── validate_champions_sources.py  # Read-only Serebii/PokeAPI audit
│       ├── smoke_test.py              # Pass/fail health check
│       ├── seed_auth_user.py          # Local dev helper
│       ├── scan_movepool_gaps.py, build_pikalytics_translations.py
│       ├── test_cache_utils.py, test_damage_calc.py
│       ├── processors/                # Helper modules used by ingest
│       └── ingest/                    # External-source ingest modules
│           ├── smogon_meta.py         # Smogon usage (weekly cron)
│           ├── pikalytics_usage.py    # Pikalytics usage (weekly cron)
│           ├── limitless_teams.py     # Limitless teams (daily cron)
│           └── serebii_static.py     # Serebii movepools (--confirm-destructive)
├── web/                               # Next.js 14 frontend (pnpm)
│   ├── package.json                   # next 16.2.3, react 19.2.4, tailwind v4
│   ├── next.config.ts                 # remotePatterns for PokeAPI sprites
│   ├── tsconfig.json                  # strict mode, "@/*" → "./src/*"
│   ├── eslint.config.mjs, postcss.config.mjs
│   ├── public/                        # Static assets
│   └── src/
│       ├── app/                       # App Router pages
│       │   ├── layout.tsx, providers.tsx, page.tsx
│       │   ├── globals.css            # Tailwind v4 + design tokens
│       │   ├── robots.ts, sitemap.ts, icon.svg, apple-icon.png
│       │   ├── pokemon/{page.tsx, layout.tsx, [id]/}
│       │   ├── teams/, roster/, draft/, cheatsheet/, meta/
│       │   ├── matches/, items/, moves/, profile/, calc/
│       │   ├── speed-tiers/, type-chart/, login/, share/[id]/
│       │   ├── auth/callback/, support/, terms/, privacy/
│       │   ├── admin/                 # Admin dashboard
│       │   └── u/[username]/          # Public profile pages
│       ├── features/                  # Self-contained feature modules
│       │   └── pokemon/{api,components,hooks,types}/
│       ├── components/                # Shared cross-feature UI
│       │   ├── nav.tsx, error-boundary.tsx, ad-slot.tsx
│       │   ├── pokeball-logo.tsx, support-pill.tsx, sponsor-banner.tsx
│       │   ├── data-freshness.tsx, quota-indicator.tsx, onboarding-tour.tsx
│       │   ├── ethical-ads.tsx
│       │   ├── pokemon/, teams/, roster/, cheatsheet/, meta/, profile/
│       │   └── ui/                    # Generic UI atoms
│       │       ├── empty-state.tsx, error-card.tsx, loading-skeleton.tsx
│       │       ├── searchable-dropdown.tsx, sprite-fallback.tsx
│       ├── lib/                       # Shared logic
│       │   ├── api.ts                 # Typed API client
│       │   ├── sprites.ts             # PokeAPI URL builders
│       │   ├── errors.ts              # Error-mapping helpers
│       │   ├── pdf-export.ts          # Cheatsheet PDF generation
│       │   └── ad-routes.ts           # Routes where ads appear
│       ├── types/                     # TypeScript mirrors of Pydantic models
│       │   ├── meta.ts, move.ts, item.ts, team.ts, profile.ts
│       │   ├── matchup.ts, usage.ts, draft.ts, cheatsheet.ts, user-pokemon.ts
│       └── utils/
│           └── supabase/client.ts     # Browser-only Supabase client
├── supabase/                          # Database
│   ├── config.toml                    # Supabase CLI config
│   ├── migrations/                    # 23 timestamped SQL migrations
│   │   ├── 20260410000000_initial_schema.sql
│   │   ├── 20260414000000_enable_rls.sql
│   │   ├── 20260417000000_cache_version.sql
│   │   ├── 20260427000000_cron_runs.sql
│   │   └── ... (20 more, 2026-04-10 → 2026-06-01)
│   └── snippets/                      # Ad-hoc SQL helpers
├── infra/                             # Deployment-related artifacts
│   ├── Dockerfile.api                 # API container (legacy/Cloud Run)
│   └── cloudrun-api.yaml              # Cloud Run config (legacy)
├── design/                            # Design system reference
│   ├── palette.md, cheatsheet-logic.md
│   ├── ANTIGRAVITY_DESIGN_REVIEW.md
│   ├── gengar-team-cheatsheet.html    # Cheatsheet HTML reference
│   └── emails/
├── scripts/                           # Repo-level utility scripts
│   └── seed_user_data.py              # Seed sample user data
├── .github/                           # CI workflows
│   └── workflows/
├── .planning/codebase/                # GSD codebase maps (this output)
└── .vercel/                           # Vercel-link state (gitignored)
```

## Directory Purposes

**`api/app/` (FastAPI application package):**
- Purpose: All HTTP-served Python code
- Contains: `main.py` (entry), `auth.py`, `config.py`, `database.py`, `limiter.py`, `ai_quota.py`, `prompt_guard.py`, `validators.py`; subpackages `routers/`, `models/`, `services/`
- Key files: `api/app/main.py`, `api/app/auth.py`, `api/app/database.py`

**`api/app/routers/`:**
- Purpose: One HTTP router per resource family
- Contains: 18 modules; each defines `router = APIRouter(prefix="/...", tags=[...])` and is mounted in `main.py`
- Key files: `pokemon.py`, `draft.py`, `cheatsheet.py`, `admin.py`, `admin_cron.py`, `public.py`

**`api/app/models/`:**
- Purpose: Pydantic models — request/response shapes, source of truth for types
- Contains: One file per resource + `ingest.py` (shared `IngestResult`)
- Key files: `pokemon.py` (PokemonBase/Basic/Detail), `ingest.py`

**`api/app/services/`:**
- Purpose: Reusable business logic with no FastAPI dependency
- Contains: `damage_calc.py`, `cache_utils.py`, `ai_verifier.py`, `showdown_parser.py`, `strategy_context.py`, `data_freshness.py`, `name_resolver.py`
- Key files: `damage_calc.py` (pure-Python Gen 9 formula)

**`api/scripts/`:**
- Purpose: CLI-runnable scripts for data pipeline + maintenance
- Contains: One-time setup scripts (root level), automated refresh (`ingest/`), validators (`validate_data.py`, `smoke_test.py`)
- Key files: `import_pokeapi.py`, `seed_champions.py`, `validate_data.py`, `ingest/smogon_meta.py`, `ingest/pikalytics_usage.py`, `ingest/limitless_teams.py`, `ingest/serebii_static.py`

**`web/src/app/`:**
- Purpose: Next.js App Router pages + special files
- Contains: One folder per route, plus `layout.tsx`, `page.tsx`, `providers.tsx`, `globals.css`, `robots.ts`, `sitemap.ts`, icons
- Key files: `layout.tsx`, `providers.tsx`, route folders

**`web/src/features/`:**
- Purpose: Self-contained feature modules (api + components + hooks + types co-located)
- Contains: Currently only `pokemon/` (with `api/`, `components/`, `hooks/`, `types/` subfolders)
- Pattern note: Other features still live in `web/src/components/<feature>/` + `web/src/types/<feature>.ts`; `features/pokemon/` is the future-direction template

**`web/src/components/`:**
- Purpose: Cross-feature shared UI
- Contains: Top-level building blocks (`nav.tsx`, `error-boundary.tsx`, `ad-slot.tsx`, etc.) + per-feature subfolders (`teams/`, `roster/`, `cheatsheet/`, `meta/`, `profile/`) + generic `ui/` atoms
- Key files: `nav.tsx`, `error-boundary.tsx`, `ui/sprite-fallback.tsx`

**`web/src/lib/`:**
- Purpose: Shared client-side logic (not React components)
- Contains: `api.ts` (typed API client), `sprites.ts`, `errors.ts`, `pdf-export.ts`, `ad-routes.ts`
- Key files: `api.ts`

**`web/src/types/`:**
- Purpose: TypeScript interface mirrors of Pydantic models
- Contains: One file per resource family
- Pattern: Hand-maintained — Pydantic in `api/app/models/` is source of truth

**`web/src/utils/supabase/`:**
- Purpose: Supabase browser client factory (auth tokens only — no data fetching)
- Contains: `client.ts`
- Pattern: Returns `null` when env vars missing so app degrades gracefully without Supabase

**`supabase/migrations/`:**
- Purpose: Hand-written SQL migrations applied via Supabase dashboard
- Contains: 23 timestamped files (`YYYYMMDDhhmmss_description.sql`)
- Naming: `{14-digit timestamp}_{snake_case description}.sql`

**`infra/`:**
- Purpose: Container + Cloud Run deployment artifacts (legacy from pre-Vercel-Functions era)
- Contains: `Dockerfile.api`, `cloudrun-api.yaml`
- Pattern: Production deploys via Vercel; `infra/` is kept for emergency fallback

**`design/`:**
- Purpose: Design system reference and design-review notes
- Contains: `palette.md`, design review HTML, email templates
- Pattern: Reference only — implementation lives in `web/src/app/globals.css` + Tailwind v4 tokens

## Key File Locations

**Entry Points:**
- `api/app/main.py` — FastAPI app for local `uv run uvicorn`
- `api/index.py` — Vercel ASGI entry (strips `/api` prefix)
- `web/src/app/layout.tsx` — Next.js root layout
- `web/src/app/page.tsx` — `/` home page
- `vercel.json` — Vercel rewrites + cron schedule

**Configuration:**
- `CLAUDE.md` — canonical conventions (read first)
- `api/pyproject.toml` — uv project, ruff/pyright settings
- `api/.env.example` — required env vars template
- `web/package.json` — pnpm dependencies, scripts
- `web/next.config.ts` — image remotePatterns
- `web/tsconfig.json` — `"@/*": ["./src/*"]` path alias
- `web/postcss.config.mjs` — Tailwind v4 plugin
- `supabase/config.toml` — Supabase CLI settings

**Core Logic:**
- `api/app/auth.py` — JWT verification (ES256 + HS256)
- `api/app/database.py` — Supabase singleton
- `api/app/services/damage_calc.py` — deterministic damage formula
- `api/app/services/cache_utils.py` — v2 cache keys
- `api/app/services/ai_verifier.py` — AI claim verification
- `api/app/routers/admin_cron.py` — cron audit log + aggregators
- `web/src/lib/api.ts` — typed API client
- `web/src/lib/sprites.ts` — PokeAPI URL builders

**Data Pipeline:**
- `api/scripts/import_pokeapi.py` — one-time PokeAPI bulk import
- `api/scripts/seed_champions.py` — Champions seed (destructive)
- `api/scripts/ingest/{smogon_meta,pikalytics_usage,limitless_teams,serebii_static}.py` — refresh modules
- `api/scripts/validate_data.py` — 7-check validator
- `api/app/models/ingest.py` — shared `IngestResult` shape

**Testing:**
- `api/scripts/test_cache_utils.py`, `test_damage_calc.py` — script-style unit checks
- `api/scripts/smoke_test.py` — pass/fail data health check
- (No formal test framework wired up — see CONCERNS.md when generated)

## Naming Conventions

**Files (Python):**
- `snake_case.py` — every Python file (modules, scripts)
- Examples: `admin_cron.py`, `damage_calc.py`, `pikalytics_usage.py`, `validate_data.py`

**Files (TypeScript):**
- `kebab-case.tsx`/`kebab-case.ts` — components and lib files
- Examples: `error-boundary.tsx`, `pokemon-detail-panel.tsx`, `sprite-fallback.tsx`, `pdf-export.ts`
- Reserved Next.js names (lowercase, no dash): `layout.tsx`, `page.tsx`, `providers.tsx`, `globals.css`, `robots.ts`, `sitemap.ts`

**Directories:**
- All lowercase, kebab-case for multi-word
- Next.js dynamic routes: `[id]/`, `[username]/`
- Examples: `web/src/app/u/[username]/`, `api/scripts/ingest/`

**Migrations:**
- `{YYYYMMDDhhmmss}_{snake_case_description}.sql`
- Examples: `20260427000000_cron_runs.sql`, `20260601000000_drop_v1_cache.sql`

**Pydantic models:**
- `PascalCase` class names; `Base`/`Detail`/`Basic`/`Create`/`Update`/`Response`/`List` suffixes
- Examples: `PokemonBase`, `PokemonDetail`, `PokemonBasicList`, `UserPokemonCreate`, `IngestResult`

**TypeScript interfaces:**
- `PascalCase`; mirrors Python class names where 1:1
- Examples: `PokemonDetail`, `DraftRequest`, `CheatsheetResponse`

**Functions:**
- Python: `snake_case` (e.g., `get_pokemon_detail`, `_extract_usage_names`); leading underscore for module-private
- TypeScript: `camelCase` (e.g., `fetchPokemonDetail`, `apiFetch`, `cachedFetch`); leading underscore avoided

**Pokemon/move/item names in DB:**
- `Title Case` strings, e.g. `"Thunder Punch"`, `"Choice Scarf"`, `"Garchomp"`
- Never `"thunder-punch"`, never `"thunderpunch"`

**Primary keys:**
- Pokemon, moves, items, abilities use `id INTEGER` from PokeAPI (not surrogate UUID)
- User-data tables (`user_pokemon`, `teams`, `matchup_log`, `profiles`) use `uuid` PKs

## Where to Add New Code

**New API endpoint:**
- Pick (or create) the right router under `api/app/routers/<resource>.py`
- Add Pydantic models in `api/app/models/<resource>.py`
- Mount the router in `api/app/main.py:8-27` (the `from app.routers import (...)` block) and `app.include_router(...)` block
- Add a TypeScript interface to `web/src/types/<resource>.ts`
- Add a fetch function to `web/src/lib/api.ts`

**New frontend page:**
- Create `web/src/app/<route>/page.tsx` (and `layout.tsx` if needed for `force-dynamic`)
- Add the link to `PRIMARY_LINKS` in `web/src/components/nav.tsx:19` if it's a top-level nav item
- Add the route to `web/src/lib/ad-routes.ts` if ads should appear
- Add to `web/src/app/sitemap.ts` if it should be indexed

**New shared UI component:**
- Generic atom → `web/src/components/ui/<component>.tsx`
- Cross-feature widget → `web/src/components/<component>.tsx`
- Feature-specific → `web/src/components/<feature>/<component>.tsx` (existing pattern) or `web/src/features/<feature>/components/<component>.tsx` (newer pattern; only `pokemon` uses this so far)

**New Pokemon-feature code:**
- Use `web/src/features/pokemon/` (api / components / hooks / types subfolders)

**New Pydantic model:**
- `api/app/models/<resource>.py`
- If ingest-related, reuse `IngestResult` from `api/app/models/ingest.py`

**New ingest source:**
- Create `api/scripts/ingest/<source>.py`
- Expose `run(dry_run=False) -> IngestResult` (mandatory contract)
- Add CLI block at bottom: `if __name__ == "__main__": main()` with `--dry-run` flag
- Wire to a cron aggregator in `api/app/routers/admin_cron.py` if it should run automatically (respect 2-cron Vercel Hobby cap)
- Document in `CLAUDE.md` § Commands

**New SQL migration:**
- `supabase/migrations/{YYYYMMDDhhmmss}_{description}.sql`
- Apply via Supabase dashboard SQL editor
- Update RLS policies in the same migration
- Update affected Pydantic models + TypeScript types

**New utility/helper:**
- Python pure-Python helper used across routers → `api/app/services/<name>.py`
- Python module-level config → `api/app/<name>.py` (top-level package)
- TypeScript shared helper → `web/src/lib/<name>.ts`

**New admin endpoint:**
- Add to `api/app/routers/admin.py` with `_: str = Depends(get_admin_user)`
- Surface in admin dashboard at `web/src/app/admin/page.tsx`

**New cron job:**
- Per-source endpoint: add to `api/app/routers/admin_cron.py` (still useful for manual triggers even if not scheduled)
- Add as a step inside `cron_daily` or `cron_weekly` aggregator (Vercel Hobby cap = 2 schedules)
- Update schedule in `vercel.json:12-15` only if absolutely necessary

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis output (this document family)
- Generated: Yes (by `/gsd-map-codebase` command and codebase-mapper subagents)
- Committed: Yes (acts as up-to-date documentation)

**`.claude/`:**
- Purpose: Claude Code project state (worktrees, plans, agent memory)
- Generated: Yes
- Committed: Partially — see `.gitignore`; worktrees explicitly excluded from this analysis scope

**`.vercel/`:**
- Purpose: Vercel CLI link state
- Generated: Yes (by `vercel link`)
- Committed: No (gitignored)

**`.github/workflows/`:**
- Purpose: GitHub Actions CI (lint, tests)
- Generated: No (hand-maintained)
- Committed: Yes

**`web/.next/`, `web/node_modules/`, `api/.venv/`:**
- Purpose: Build output / installed packages
- Generated: Yes
- Committed: No

**`api/__pycache__/`, `web/.ruff_cache/`, `api/.ruff_cache/`:**
- Purpose: Tool caches
- Generated: Yes
- Committed: No

**`api/champions_validation_report.json`, `api/movepool_gaps_report.json`, `api/validation_report.json`, `api/pikalytics_translations.json`:**
- Purpose: Build artifacts from validation/translation scripts (non-secret)
- Generated: Yes (by validator scripts)
- Committed: Yes (used as inputs by other scripts)

**`api/.env`, `web/.env.example`:**
- Purpose: Environment config templates / local secrets
- Generated: No
- Committed: `.env.example` yes, `.env` no
