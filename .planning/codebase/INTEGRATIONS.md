# External Integrations

**Analysis Date:** 2026-04-28

## APIs & External Services

**Pokemon data sources (read-only ingest):**
- **PokeAPI** — primary baseline for Pokemon, moves, abilities. Used in `api/scripts/import_pokeapi.py` (`POKEAPI_BASE = "https://pokeapi.co/api/v2"`, async with `httpx.AsyncClient`, semaphore at `MAX_CONCURRENT = 20`, IDs 1–1025 plus 15 regional forms).
  - SDK/Client: `httpx >= 0.28.0`
  - Auth: none (public API)
  - One-time setup script — re-running gated behind manual command (no scheduled cron)
- **PokeAPI sprites (CDN)** — image source for the frontend. Hosted on `raw.githubusercontent.com/PokeAPI/sprites`. Helper functions in `web/src/lib/sprites.ts` (`pokeArt`, `pokeArtShiny`, `pokeSprite`, `pokeSpriteShiny`, `itemSprite`). Allowed via `images.remotePatterns` in `web/next.config.ts`.

**Champions meta + tournament scraping:**
- **Pikalytics** (`https://pikalytics.com/pokedex/championstournaments`) — primary Champions usage data (tournament-weighted moves, items, abilities, teammates, EV spreads). Scraped in `api/scripts/ingest/pikalytics_usage.py` using `httpx` + `beautifulsoup4`.
  - Custom `User-Agent: PokemonChampionsCompanion/1.0 (+github.com/javeo22/poke_comp)`, `Accept-Language: en-US,en;q=0.9` (Pikalytics content-negotiates and serves localized names without this), 1.5s delay between page fetches, top 50 Pokemon scraped.
  - Translation cache at `api/pikalytics_translations.json` (built by `api/scripts/build_pikalytics_translations.py`).
  - Auth: none. Legal status: SAFE per `LEGAL_AND_DEV_GUIDELINES.md`.
- **Smogon / pkmn.cc** (`https://pkmn.github.io/smogon/data/stats/gen9vgc2026.json`) — supplemental usage stats from VGC 2026 Regulation I ladder play (NOT Champions tournament data). Ingested in `api/scripts/ingest/smogon_meta.py`. Fallback URL: `gen9vgc2025.json`. Writes with `source='smogon'` and will not overwrite existing `pikalytics` rows for the same date.
  - Auth: none.
- **Limitless VGC** (`https://play.limitlesstcg.com/api`) — tournament team listings for the draft helper. Public REST API (`/tournaments?game=VGC&format=all&type=all&completed=true&limit=N`, then per-tournament `/standings`). Ingested in `api/scripts/ingest/limitless_teams.py` with `User-Agent` identification and 1.0s delay between requests.
  - Auth: none (public endpoints).
- **Serebii** (`https://www.serebii.net/pokemonchampions`, `https://www.serebii.net/pokedex-champions`) — Champions-verified static data (movepools, abilities, items, mega data). Scraped in `api/scripts/ingest/serebii_static.py` using `httpx` + `beautifulsoup4`, 0.5s delay, `CONCURRENT_LIMIT = 3`. Marked destructive (`--confirm-destructive` required).
  - Auth: none. Legal status: MEDIUM risk per `LEGAL_AND_DEV_GUIDELINES.md`.
- **Game8** — REMOVED 2026-04-16. `api/scripts/refresh_meta.py` retains the AI-extraction scaffolding but `SOURCES = []` after the ToS audit flagged anti-AI/anti-RE clauses (see `LEGAL_AND_DEV_GUIDELINES.md` §1.C). Script is a no-op until a compliant editorial-tier source is added.

**AI / LLM:**
- **Anthropic Claude API** — used for draft analysis, team cheatsheet generation, and (formerly) tier-list extraction.
  - SDK/Client: `anthropic >= 0.52.0` (Python SDK).
  - Auth: `ANTHROPIC_API_KEY` env var (loaded via `api/app/config.py`).
  - Models: `claude-sonnet-4-6` (default) and `claude-haiku-4-5-20251001` (fallback when daily Sonnet quota exhausted). Pricing per 1M tokens hard-coded in `api/app/ai_quota.py` (`MODEL_PRICING`): Sonnet $3/$15 in/out, Haiku $0.80/$4 in/out.
  - Quota: 3 analyses/day for free users, 30/day + 600/month soft cap for supporters, unlimited for admins (`api/app/ai_quota.py:check_ai_quota`). Enforced per-user via `ai_usage_log` table.
  - Rate limiting: also gated by `slowapi` at 5/min (response in `api/app/main.py:rate_limit_handler`).
  - Cache: AI responses cached 168h (7d) per request hash via `app.services.cache_utils.cache_hash_v2` (versioned `v2:` prefix; legacy `v1:` rows retained for 14-day grace period). Cached responses do not count against quota.
  - Call sites: `api/app/routers/draft.py`, `api/app/routers/cheatsheet.py`, `api/app/services/ai_verifier.py`.

**Analytics:**
- **Vercel Analytics** — pageview tracking via `@vercel/analytics/react` `<Analytics />`, mounted in `web/src/app/layout.tsx`. No PII, no cookies, no extra config required.

## Data Storage

**Databases:**
- **Supabase Postgres 17** — single managed database, project ID `pokecomp`.
  - Connection (server, service-role): `api/app/database.py` constructs a singleton `supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)`. Service-role key bypasses RLS.
  - Connection (browser, anon): `web/src/utils/supabase/client.ts` via `@supabase/ssr.createBrowserClient` using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Returns `null` if env vars missing (auth deferred / public-mode fallback).
  - Connection (server-side OAuth code exchange): `web/src/app/auth/callback/route.ts` via `@supabase/ssr.createServerClient` with `cookies()` adapter from `next/headers`.
  - RLS: enabled in migration `supabase/migrations/20260414000000_enable_rls.sql`; user-scoped tables (`user_pokemon`, `teams`, `matchup_log`, `user_profiles`, `strategy_notes`, `team_cheatsheets`, `ai_usage_log`) require auth. Reference data (`pokemon`, `moves`, `items`, `abilities`, `pokemon_usage`, `tournament_teams`) is publicly readable.
  - Migrations: 24 SQL files under `supabase/migrations/` from `20260410000000_initial_schema.sql` to `20260601200000_movepool_overrides.sql`. Applied via `supabase` CLI `db push` (no in-app migration runner).
  - Client: direct `supabase-py` calls (no ORM); `postgrest.types.CountMethod` used for count queries.

**File Storage:**
- Supabase Storage is enabled in `supabase/config.toml` (`[storage] file_size_limit = "50MiB"`, `[storage.s3_protocol] enabled = true`) but no buckets are configured and no upload code paths exist in the API or web. Effectively unused — all imagery is sourced from external CDNs (PokeAPI sprites).

**Caching:**
- No external cache (Redis/Memcached). AI response cache lives in the Postgres `ai_analyses` table keyed by `cache_hash_v2`; React Query handles client-side staleness (`staleTime: 60_000` in `web/src/app/providers.tsx`).

## Authentication & Identity

**Auth Provider: Supabase Auth**
- Frontend flow: email/password + magic-link / OAuth code exchange via `@supabase/ssr`. Server route `web/src/app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)` and redirects to `/roster` (or `?next=`).
- Backend verification: `api/app/auth.py:get_current_user` — `HTTPBearer` dependency that:
  1. Decodes the JWT header to detect `alg`.
  2. **ES256 path** (newer Supabase projects, asymmetric): fetches signing key from JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` using `PyJWKClient` (cached). Decodes with `algorithms=["ES256"]`, `verify_aud=False`. This is the default for the production project (per `MEMORY.md` `project_auth_config.md`).
  3. **HS256 path** (legacy, symmetric): decodes with `SUPABASE_JWT_SECRET`. Raises 500 if secret not configured.
  4. Returns `payload["sub"]` (Supabase user UUID).
- Admin gating: `api/app/routers/admin.py:get_admin_user` checks the user UUID against the `ADMIN_USER_IDS` env var (comma-separated). 403 if not in the allow-list. Admins also bypass AI quotas (`api/app/ai_quota.py:_is_admin`).
- Cron auth: `api/app/routers/admin_cron.py:require_cron_secret` — constant-time `hmac.compare_digest` of the `Authorization: Bearer ...` header against `CRON_SECRET`. Required because Vercel Cron sends GETs and there is no signed payload to verify.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Bugsnag, Datadog, OpenTelemetry, or equivalent integrations declared in either `api/pyproject.toml` or `web/package.json`. Errors surface only in Vercel function logs.
- Frontend has a custom `web/src/components/error-boundary.tsx` for client-side React error fallback and `web/src/lib/errors.ts:friendlyError` for normalizing fetch/API error messages into user-facing copy.

**Logs:**
- Backend: stdlib `logging` (e.g. `logger = logging.getLogger("cron")` in `api/app/routers/admin_cron.py`, `logger = logging.getLogger(__name__)` in `api/app/routers/draft.py`). Logs flow to Vercel function stdout — no centralized log sink.
- Cron audit log persisted to Postgres: every `/admin/cron/*` invocation writes a `cron_runs` row (`supabase/migrations/20260427000000_cron_runs.sql`) with `source`, `started_at`, `finished_at`, `duration_ms`, `status` (`pass`/`warn`/`fail`), `rows_inserted/updated/skipped`, `warnings` (jsonb), and `error` (string). Surfaced through `/admin/data-health`.
- AI usage audit log: every Anthropic call writes one `ai_usage_log` row with `user_id`, `endpoint`, `model`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `cached` (`api/app/ai_quota.py:log_ai_usage`).

## CI/CD & Deployment

**Hosting:**
- **Vercel** — single Next.js project at `pokecomp.app`. Hosts both the web app (built from `web/`) and the FastAPI backend (deployed as a Python function from `api/index.py`). Region pinned to `iad1` (`vercel.json`).
- **Supabase** — managed Postgres + Auth + Storage. Project URL provided via `SUPABASE_URL`.
- **Cloud Run scaffolding (unused)** — `infra/Dockerfile.api` + `infra/cloudrun-api.yaml` retained as an off-Vercel migration path; not wired to any pipeline.

**CI Pipeline:**
- **GitHub Actions: `.github/workflows/ci.yml`** — runs on every PR and push to `main`. Two jobs:
  - `api-checks`: `actions/checkout@v4`, `astral-sh/setup-uv@v6`, `uv sync --extra dev`, `uv run ruff check`, `uv run ruff format --check`, `uv run pyright`.
  - `web-checks`: `actions/checkout@v4`, `pnpm/action-setup@v4` (v10), `actions/setup-node@v4` (Node 22, pnpm cache), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm exec tsc --noEmit`.
- **GitHub Actions: `.github/workflows/data_ingestion.yml`** — Sunday 02:00 UTC (and `workflow_dispatch`). Installs `uv`, syncs deps, runs `scripts.ingest.smogon_meta` and `scripts.ingest.limitless_teams`. Overlaps with Vercel Cron — kept as a backup path (does NOT update the `cron_runs` audit table since it bypasses the FastAPI cron endpoint).
- **Vercel Cron** — see "Webhooks & Callbacks" below; the production scheduling path.

## Environment Configuration

**Required env vars (backend, `api/app/config.py`):**
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` fallback) — Supabase project URL.
- `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` fallback) — service-role key (server-only, bypasses RLS).
- `SUPABASE_JWT_SECRET` — only required for legacy HS256 tokens; ES256 production tokens use JWKS.
- `ANTHROPIC_API_KEY` — Claude API key.
- `CORS_ORIGINS` — comma-separated allow-list (default: `http://localhost:3000,https://pokecomp.app,https://www.pokecomp.app`).
- `ADMIN_USER_IDS` — comma-separated Supabase user UUIDs.
- `CRON_SECRET` — bearer token for `/admin/cron/*` endpoints.

**Required env vars (frontend):**
- `NEXT_PUBLIC_SUPABASE_URL` — used by `web/src/utils/supabase/client.ts` and `web/src/app/auth/callback/route.ts`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key.
- `NEXT_PUBLIC_API_URL` (optional; defaults to `/api` in production via Vercel rewrites, `http://localhost:8000` in dev).
- `VERCEL_URL` (auto-injected by Vercel) — used to construct absolute API URLs during SSR.

**Secrets location:**
- Production: Vercel Project Settings → Environment Variables (no `.env` files committed).
- CI: GitHub repository secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` referenced in `.github/workflows/data_ingestion.yml`).
- Cloud Run scaffolding: GCP Secret Manager (`secretKeyRef` entries in `infra/cloudrun-api.yaml` for `supabase-url`, `supabase-service-key`, `anthropic-api-key`).
- Local: `.env` file in `api/` (gitignored, loaded via `pydantic-settings` `model_config = {"env_file": ".env"}`).

## Webhooks & Callbacks

**Incoming:**
- **Vercel Cron → `/api/admin/cron/*`** — only two endpoints scheduled per `vercel.json` (Hobby-plan 2-cron cap):
  - `GET /api/admin/cron/daily` at `0 8 * * *` → runs `limitless_teams.run()`. Aggregator persists one `cron_runs` row for the daily run plus one per step.
  - `GET /api/admin/cron/weekly` at `0 6 * * 1` → runs `smogon_meta.run()` → `pikalytics_usage.run()` → `validate_data --fix` (in order; Pikalytics is the primary source so it overwrites Smogon where they overlap).
  - All cron handlers wrap synchronous ingest scripts via `asyncio.to_thread` and gate on `Authorization: Bearer $CRON_SECRET`. Failures re-raise as HTTP 500 so Vercel marks the invocation red. Per-source endpoints (`/admin/cron/ingest-smogon`, `/admin/cron/ingest-pikalytics`, `/admin/cron/ingest-limitless`, `/admin/cron/validate-data`, `/admin/cron/cache-warmup`) remain individually invokable for manual triggers but are not scheduled.
- **Supabase Auth → `/auth/callback`** — `web/src/app/auth/callback/route.ts` handles OAuth/magic-link `code` exchange, then redirects to `/roster` (or `?next=...`).
- **Public unauthenticated endpoints** — `api/app/routers/public.py` exposes `GET /public/data-freshness` (last `pokemon_usage` snapshot per format) and shared cheatsheet routes. No auth required, no PII.

**Outgoing:**
- HTTP GETs to `pokeapi.co`, `pkmn.github.io`, `pikalytics.com`, `play.limitlesstcg.com/api`, `serebii.net` (all read-only, all custom `User-Agent` identification).
- HTTPS calls to Anthropic Messages API via the `anthropic` SDK.
- Supabase REST/PostgREST calls via `supabase-py` and `@supabase/ssr`.
- No outbound webhooks (no Slack/Discord/email notifications configured).

---

*Integration audit: 2026-04-28*
