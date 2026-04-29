<!-- refreshed: 2026-04-28 -->
# ARCHITECTURE.md

**Analysis Date:** 2026-04-28

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│             Next.js 14 App Router, React 19, Tailwind v4                 │
│  web/src/app/**/page.tsx   web/src/components/**   web/src/features/**   │
└────────────┬───────────────────────────────────────────────┬─────────────┘
             │  fetch via web/src/lib/api.ts (apiFetch)      │ Supabase JS
             │  Bearer = Supabase access_token (ES256)       │ (auth only)
             ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│   Vercel Rewrites: /api/(.*) → /api/index.py  (vercel.json)              │
│   _StripApiPrefix ASGI middleware strips `/api`  (api/index.py)          │
└────────────┬─────────────────────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    FastAPI App (Python 3.12, uv)                         │
│                         api/app/main.py                                  │
│  Routers (18) │ Auth ES256/HS256 │ Services │ Pydantic Models           │
│  api/app/     │ api/app/auth.py  │ api/app/ │ api/app/models/*.py       │
│  routers/     │ + limiter.py     │ services/│                           │
└────────────┬─────────────────────────────────────────────┬───────────────┘
             │ supabase-py (NO ORM)                        │ Anthropic SDK
             ▼                                             ▼
┌──────────────────────────────────────┐    ┌─────────────────────────────┐
│   Supabase (PostgreSQL + RLS)        │    │  Anthropic Claude API       │
│  Tables: pokemon, moves, items,      │    │  claude-sonnet-4-6 (paid),  │
│   abilities, user_pokemon, teams,    │    │  claude-haiku-4-5 (free)    │
│   pokemon_usage, meta_snapshots,     │    │  Used by: draft, cheatsheet,│
│   matchup_log, profiles, cron_runs,  │    │   ai_verifier               │
│   ai_usage_log, ai_analyses, ...     │    └─────────────────────────────┘
│  SOURCE OF TRUTH (since 2026-04-17)  │
│  Migrations: supabase/migrations/    │
└──────────────────────────────────────┘
             ▲
             │ Vercel Cron → /api/admin/cron/{daily,weekly}
             │ Bearer $CRON_SECRET (hmac.compare_digest)
             │
┌──────────────────────────────────────────────────────────────────────────┐
│           Data Pipeline (Python; CLI + Vercel Cron HTTP)                 │
│                                                                          │
│  ONE-TIME SETUP (--confirm-destructive required for destructive)         │
│   api/scripts/import_pokeapi.py        PokeAPI bulk import               │
│   api/scripts/seed_champions.py        Champions roster + items + megas  │
│   api/scripts/ingest/serebii_static.py Champions movepools/abilities     │
│   api/scripts/validate_champions_sources.py  Read-only audit             │
│                                                                          │
│  AUTOMATED REFRESH (Vercel Cron, vercel.json)                            │
│   scripts/ingest/smogon_meta.py        Smogon usage    (weekly Mon 06)   │
│   scripts/ingest/pikalytics_usage.py   Tournament usage (weekly Mon 07)  │
│   scripts/ingest/limitless_teams.py    Tournament teams (daily 08)       │
│   scripts/refresh_meta.py              DEPRECATED (Game8 removed)        │
│   Each module: run(dry_run=False) -> IngestResult                        │
│                                                                          │
│  VALIDATION                                                              │
│   scripts/validate_data.py   7 integrity checks; --fix mode              │
│   scripts/smoke_test.py      Pass/fail health check                      │
│   GET /admin/data-health     Live DB monitoring endpoint                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI app | Mount routers, CORS, security headers, rate-limit handler | `api/app/main.py` |
| Vercel ASGI shim | Strip `/api` prefix so routes work under Vercel rewrites | `api/index.py` |
| Auth | Verify Supabase JWT (ES256 via JWKS, HS256 via shared secret) | `api/app/auth.py` |
| Settings | Centralize env-var resolution | `api/app/config.py` |
| Supabase client | Singleton `Client` from service-role key | `api/app/database.py` |
| Rate limiter | slowapi `Limiter` keyed on remote address | `api/app/limiter.py` |
| AI quota | Per-user daily/monthly caps, model pricing, usage logging | `api/app/ai_quota.py` |
| Prompt guard | Sanitize free-text user input before LLM calls | `api/app/prompt_guard.py` |
| Validators | Champions legality checks (items/moves/abilities/natures) | `api/app/validators.py` |
| Reference routers | Read-only data | `api/app/routers/{pokemon,moves,items,abilities,usage,meta}.py` |
| User-data routers | CRUD for roster/teams/matchups/profile | `api/app/routers/{user_pokemon,teams,matchups,profile}.py` |
| AI routers | Draft analysis, cheatsheet generation | `api/app/routers/{draft,cheatsheet,ai_usage}.py` |
| Calc router | Deterministic damage calculator | `api/app/routers/calc.py` |
| Strategy router | Admin-curated strategy notes | `api/app/routers/strategy.py` |
| Public router | No-auth endpoints | `api/app/routers/public.py` |
| Admin router | Admin-only data CRUD + dashboards | `api/app/routers/admin.py` |
| Admin cron router | Vercel Cron endpoints + cron_runs audit | `api/app/routers/admin_cron.py` |
| Damage calc service | Pure-Python Gen 9 damage formula | `api/app/services/damage_calc.py` |
| Cache utils | Deterministic v2-prefixed cache keys | `api/app/services/cache_utils.py` |
| AI verifier | Cross-checks AI output against deterministic calc | `api/app/services/ai_verifier.py` |
| Showdown parser | Import/export Showdown paste format | `api/app/services/showdown_parser.py` |
| Strategy context | Inject admin notes into AI prompts | `api/app/services/strategy_context.py` |
| Data freshness | Snapshot age + stale flags | `api/app/services/data_freshness.py` |
| Name resolver | Pokemon name aliases | `api/app/services/name_resolver.py` |
| Pydantic models | Request/response shapes (source of truth) | `api/app/models/*.py` |
| IngestResult shape | Uniform shape for every ingest job | `api/app/models/ingest.py` |
| Web entrypoint | Root layout, providers, fonts, JSON-LD | `web/src/app/layout.tsx`, `web/src/app/providers.tsx` |
| Web pages | App Router pages | `web/src/app/{pokemon,teams,roster,draft,cheatsheet,meta,calc,...}/page.tsx` |
| API client | Typed fetch wrapper, JWT injection, in-memory TTL cache | `web/src/lib/api.ts` |
| Sprite helpers | PokeAPI URL builders | `web/src/lib/sprites.ts` |
| Errors helpers | Shared error mapping | `web/src/lib/errors.ts` |
| Supabase client | Browser-only client for auth tokens | `web/src/utils/supabase/client.ts` |
| Pokemon feature | Self-contained feature module | `web/src/features/pokemon/{api,components,hooks,types}/` |
| Shared components | Cross-feature UI | `web/src/components/{nav,error-boundary,ad-slot,profile,teams,roster,meta,cheatsheet,ui}/` |
| Type defs | TypeScript mirrors of Pydantic | `web/src/types/*.ts` |

## Pattern Overview

**Overall:** Hybrid serverless monorepo — Next.js 14 App Router (RSC + Client Components) on Vercel calls a Python FastAPI backend deployed as a single Vercel Function (`api/index.py`), backed by Supabase Postgres with Row Level Security. AI features call Anthropic Claude through the FastAPI layer.

**Key Characteristics:**
- **No ORM.** All DB access via `supabase-py`'s table builder (`supabase.table("...").select(...)`); SQL migrations only
- **Pydantic is the type source of truth.** TS types in `web/src/types/` and `web/src/features/pokemon/types/` are hand-mirrored
- **PokeAPI integer IDs as primary keys.** Pokemon/moves/items/abilities all use PokeAPI integer IDs
- **Title-Case names.** Stored as `"Thunder Punch"`, never `"thunder-punch"`
- **Live DB is source of truth (since 2026-04-17).** External sources can drift; on-demand migrations preferred over destructive re-runs
- **Single shared `IngestResult` shape** for every ingest/validate/cron job
- **Two-layer auth** in `api/app/auth.py`: ES256 (JWKS) + HS256 (shared secret)
- **`use client` ubiquitous.** Most pages need session tokens for `apiFetch`, so they're client components; root layout is a server component

## Layers

**Presentation (web):**
- Purpose: Render UI, gather input, attach JWT to API calls
- Location: `web/src/app/`, `web/src/components/`, `web/src/features/`
- Contains: App Router pages, React 19 client components, Tailwind v4
- Depends on: `web/src/lib/api.ts`, `web/src/utils/supabase/client.ts`

**API client (web):**
- Purpose: Typed `fetch` wrapper; resolves API base URL across SSR/CSR; JWT injection; in-memory TTL cache for slow GETs
- Location: `web/src/lib/api.ts`
- Contains: `apiFetch`, `cachedFetch`, `apiFetchText`, per-resource functions (`fetchPokemon`, `analyzeDraft`, etc.)
- Depends on: `@/types/*`, `@/features/pokemon/types`, `@/utils/supabase/client`

**HTTP entry (api):**
- Purpose: ASGI prefix-strip so Vercel `/api/*` hits FastAPI's bare-prefix routes
- Location: `api/index.py` (Vercel); `cd api && uv run uvicorn app.main:app --reload` (local)
- Contains: `_StripApiPrefix` middleware

**Routers (api):**
- Purpose: HTTP handlers, request validation, response shaping
- Location: `api/app/routers/`
- Contains: 18 routers, one per resource family
- Depends on: `app.auth`, `app.database`, `app.models`, `app.services`

**Services (api):**
- Purpose: Reusable business logic (damage calc, cache keys, AI verification, Showdown parsing, name resolution, data freshness, strategy context)
- Location: `api/app/services/`

**Data access (api):**
- Purpose: Singleton Supabase client; direct table queries (no repository layer)
- Location: `api/app/database.py`

**Ingest pipeline (api/scripts):**
- Purpose: Pull external data and write to Supabase
- Location: `api/scripts/` and `api/scripts/ingest/`
- Contains: Module per source; each exposes `run(dry_run=False) -> IngestResult`
- Used by: CLI (`uv run python -m scripts.ingest.smogon_meta`) and HTTP cron (`/admin/cron/*`)

**Persistence:**
- Purpose: Postgres tables + RLS policies + migrations
- Location: `supabase/migrations/*.sql` (23 timestamped files, 2026-04-10 → 2026-06-01)

## Data Flow

### Primary Read Path: Pokemon Detail Page

1. User navigates to `/pokemon/[id]` (`web/src/app/pokemon/[id]/page.tsx`)
2. Component calls `fetchPokemonDetail(id)` (`web/src/lib/api.ts:187`)
3. `apiFetch` resolves URL: `/api/pokemon/{id}/detail` (Vercel) or `http://localhost:8000/pokemon/{id}/detail` (dev)
4. Vercel rewrite sends to `/api/index.py`; `_StripApiPrefix` strips `/api`
5. FastAPI routes to `get_pokemon_detail` (`api/app/routers/pokemon.py:198`)
6. Handler calls `supabase.table("pokemon").select("*").eq("id", id).single().execute()`
7. Handler batch-fetches `moves`, `abilities`, `pokemon_usage` (latest snapshot per format)
8. Pydantic `PokemonDetail` validates and serializes
9. `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` set
10. JSON returns to browser; sprite art loaded from `raw.githubusercontent.com/PokeAPI/sprites`

### Primary Write Path: AI Draft Analysis

1. User submits draft form on `/draft` (`web/src/app/draft/page.tsx`)
2. Client calls `analyzeDraft(body, model)` (`web/src/lib/api.ts:471`)
3. `apiFetch` attaches `Authorization: Bearer <Supabase JWT>`
4. POST `/draft/analyze` hits `api/app/routers/draft.py`
5. `Depends(get_current_user)` (`api/app/auth.py:22`) verifies ES256 (JWKS) or HS256
6. slowapi rate limiter (5/min) checks via `app.state.limiter`
7. `check_ai_quota` (`api/app/ai_quota.py`) enforces daily/monthly caps
8. Cache check via `cache_hash_v2` (`api/app/services/cache_utils.py`); evicts rows older than latest `pokemon_usage` snapshot
9. On miss: prompt built with `prompt_guard.sanitize_user_text` + `strategy_context.fetch_strategy_context`; Anthropic SDK call (`claude-sonnet-4-6` default, `claude-haiku-4-5-20251001` for free tier)
10. `ai_verifier.verify_draft_analysis` cross-checks AI damage rolls against `damage_calc.calculate_damage`
11. Persist to `ai_analyses`, log to `ai_usage_log`, return `DraftResponse`

### Cron Pipeline: Weekly Aggregator

1. Vercel Cron fires `GET /api/admin/cron/weekly` Mon 06:00 UTC (`vercel.json:14`)
2. `Authorization: Bearer $CRON_SECRET` sent automatically
3. `_StripApiPrefix` → FastAPI → `cron_weekly` (`api/app/routers/admin_cron.py:300`)
4. `require_cron_secret` does `hmac.compare_digest`
5. `_aggregate("cron_weekly", [...])` runs three steps via `asyncio.to_thread`:
   - `smogon_meta.run(False)` — Smogon usage upsert (skips Pokemon with same-day Pikalytics rows)
   - `pikalytics_usage.run(False)` — primary usage source
   - `validate_data` with `fix=True` — orphan cleanup
6. Each step persists `cron_runs` row (status pass/warn/fail; rows; warnings; error tb)
7. Aggregator persists its own `cron_runs` row with merged counts
8. HTTP response: 200 (pass/warn) or 500 on step failure
9. `/admin/data-health` reads `cron_runs` for the dashboard

**State Management:**
- Client: TanStack Query v5 (`web/src/app/providers.tsx`), `staleTime: 60s`, no refetch on focus
- Server: stateless; only module-level singletons are `supabase` (DB), `_jwks_client` (auth), `limiter` (rate-limit)
- Cache: in-memory `Map` in `apiFetch` (5-min TTL, browser-only — explicitly skipped on server)

## Key Abstractions

**`IngestResult` (Pydantic):**
- Purpose: Uniform shape — `source`, `rows_inserted/updated/skipped`, `warnings`, `duration_ms`, `dry_run`
- Examples: `api/app/models/ingest.py`; returned by every `run()` in `api/scripts/ingest/*.py`
- Pattern: Single shape so cron audit log + manual CLI runs render identically

**`run(dry_run=False) -> IngestResult` convention:**
- Purpose: Shared callable signature on every ingest module
- Examples: `api/scripts/ingest/smogon_meta.py:330`, `pikalytics_usage.py`, `limitless_teams.py`
- Pattern: CLI calls `run()` directly; cron HTTP wraps in `_record_cron_run` to persist `cron_runs`

**Cache key versioning (`v2:` prefix):**
- Purpose: Allow cache schema evolution without throwing away old rows
- Examples: `api/app/services/cache_utils.py:16` (`CACHE_VERSION = 2`)
- Pattern: Try v2 hash first, fall back to v1 during 14-day grace window before migration `20260601000000_drop_v1_cache.sql`

**`PokemonBase` / `PokemonBasic` / `PokemonDetail` tiering:**
- Purpose: Different payload sizes (~80% reduction for pickers)
- Examples: `api/app/models/pokemon.py:4-76`
- Pattern: Endpoint per tier (`/pokemon`, `/pokemon/basic`, `/pokemon/{id}/detail`)

**`get_current_user` / `get_admin_user` `Depends`:**
- Purpose: FastAPI dependency injection for auth
- Examples: `api/app/auth.py:22`, `api/app/routers/admin.py:32`
- Pattern: Standard routes add `user_id: str = Depends(get_current_user)`; admin routes wrap `_: str = Depends(get_admin_user)`

## Entry Points

**Web — Root layout** (`web/src/app/layout.tsx`): Triggered by all Next.js page renders. Loads Inter + JetBrainsMono, JSON-LD schema, `<Providers>` (TanStack Query), `<Nav>`, `<OnboardingTour>`, `<AdSlot>`, footer.

**Web — Home page** (`web/src/app/page.tsx`): `GET /`. Hero, live draft board demo, meta movers, roster + cheatsheet split; calls `fetchPublicStats()`.

**API — Local dev** (`api/app/main.py` via `uv run uvicorn app.main:app --reload`): HTTP on port 8000. Mounts 18 routers, CORS, security headers, rate-limit handler, `/health`.

**API — Vercel** (`api/index.py`): Any `/api/*` request (rewritten by `vercel.json`). Strips `/api` prefix, hands to `app.main:app`.

**Cron — daily** (`/api/admin/cron/daily` → `cron_daily` in `api/app/routers/admin_cron.py:284`): `0 8 * * *` per `vercel.json`. Runs `limitless_teams.run(False, None)`.

**Cron — weekly** (`/api/admin/cron/weekly` → `cron_weekly` in `api/app/routers/admin_cron.py:300`): `0 6 * * 1` per `vercel.json`. Runs `smogon_meta` → `pikalytics_usage` → `validate_data --fix`.

**CLI scripts** (`api/scripts/*.py`, `api/scripts/ingest/*.py`): `cd api && uv run python -m scripts.<name>` (see `CLAUDE.md` § Commands). Same `run()` callables as cron; destructive scripts require `--confirm-destructive`.

## Architectural Constraints

- **Threading:** FastAPI is async, but routers/services are sync (httpx + supabase-py are sync). Cron endpoints wrap ingest calls in `asyncio.to_thread` (`api/app/routers/admin_cron.py:154`) to avoid blocking the event loop.
- **Global state:** Module-level singletons in `api/app/database.py` (`supabase`), `api/app/auth.py` (`_jwks_client`), `api/app/limiter.py` (`limiter`), `api/app/main.py` (`app`, `app.state.limiter`). Anthropic client is per-request, not global.
- **Vercel cold starts:** Every cold start re-imports `api/app/`. JWKS responses cached in-process via `PyJWKClient(cache_keys=True)`.
- **Hobby plan cron cap:** Vercel Hobby allows 2 cron jobs. Per-source endpoints exist for manual triggers but only `/cron/daily` and `/cron/weekly` are scheduled (see `api/app/routers/admin_cron.py:215-223`).
- **No ORM, no migrations framework.** Hand-written SQL in `supabase/migrations/`, applied via Supabase dashboard.
- **TypeScript types are hand-mirrored from Pydantic.** No code-gen — schema drift possible.
- **API base URL resolution differs SSR vs CSR.** `web/src/lib/api.ts:40-50` uses `VERCEL_URL` for SSR, `window.location` (relative) for CSR.
- **Auth deferred when env unset.** `web/src/utils/supabase/client.ts` returns `null` when env vars missing — pages render but `Authorization` header omitted.

## Anti-Patterns

### Catching every exception inside ingest scripts and returning HTTP 200 with a warning

**What happens:** Pre-2026-04-27 cron handlers caught every exception inside the ingest scripts and returned 200 with a `warnings: [...]` payload, so Vercel's invocation list never went red.
**Why it's wrong:** Silent failures — broken ingests went undetected for days.
**Do this instead:** Let the ingest script raise; `_record_cron_run` (`api/app/routers/admin_cron.py:89`) catches at the boundary, persists `status="fail"` to `cron_runs`, and re-raises as HTTPException(500). Vercel's invocation list now shows red on real failures.

### Trusting external sources as ground truth

**What happens:** Re-running `seed_champions.py` or `serebii_static.py` overwrites the curated live DB with launch-era assumptions — including 21 items that exist in PokeAPI/source code but never shipped to the Champions shop.
**Why it's wrong:** Production state regresses; categorization drift reappears.
**Do this instead:** Live Supabase DB is the source of truth since 2026-04-17. Apply on-demand migrations under `supabase/migrations/` after manual in-game verification. Both destructive scripts refuse to run without `--confirm-destructive` (warning banner in `api/scripts/seed_champions.py:3-19`).

### AI hallucinated damage rolls leaking into draft output

**What happens:** Earlier draft prompts let Claude invent damage strings like "65-78%".
**Why it's wrong:** Numbers were wrong, undermining trust.
**Do this instead:** AI proposes scenarios; deterministic `damage_calc.calculate_damage` (`api/app/services/damage_calc.py`) computes ranges. `ai_verifier.verify_draft_analysis` cross-checks every claim before response leaves the server.

### Server-side use of the in-memory `apiFetch` cache

**What happens:** A naive cache `Map` would persist across users in a serverless function instance.
**Why it's wrong:** User A's data leaks into user B's response.
**Do this instead:** `web/src/lib/api.ts:110` gates the cache behind `typeof window !== "undefined"` so server-side renders always re-fetch.

## Error Handling

**Strategy:** HTTPException at route boundary; structured logging in cron; user-friendly detail messages bubbled to client.

**Patterns:**
- Routers raise `HTTPException(status_code=..., detail="...")` with explicit codes
- `api/app/main.py:34` registers a custom `RateLimitExceeded` handler returning a friendly "AI analysis is limited to 5 requests per minute" message
- `web/src/lib/api.ts:84` extracts `body.detail` from non-OK responses for error toasts
- `web/src/lib/errors.ts` provides shared error-mapping helpers
- `web/src/components/ui/error-card.tsx` and `web/src/components/error-boundary.tsx` are the UI surfaces
- Cron failures persist full traceback in `cron_runs.error`; surface on `/admin/data-health` via `_stale_warnings`

## Cross-Cutting Concerns

**Logging:** Stdlib `logging` with module-level loggers; structured `logger.info("cron.%s result=%s ...")` lines. Web uses `console.error` + Vercel Analytics (`@vercel/analytics/react`).

**Validation:** Pydantic at API ingress; shared validators in `api/app/validators.py`; `api/scripts/validate_data.py` runs 7 integrity checks weekly via cron.

**Authentication:** `Depends(get_current_user)` for user routes; `Depends(get_admin_user)` for admin (`api/app/routers/admin.py:32`); `require_cron_secret` for cron; `/public/*` and `/health` unauthenticated.

**Caching:** Edge `Cache-Control` on static reference endpoints; `ai_analyses` table for AI cache (cheatsheet 30d, draft 7d); 5-min in-memory `Map` per browser tab.

**Security:** Security headers in `api/app/main.py:47` and `vercel.json:16`; service-role Supabase key never leaves server; rate limit 5/min on AI endpoints; RLS enabled per `supabase/migrations/20260414000000_enable_rls.sql`.
