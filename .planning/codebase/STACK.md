# Technology Stack

**Analysis Date:** 2026-04-28

## Languages

**Primary:**
- Python 3.12 — backend API in `api/` (FastAPI). Pinned via `requires-python = ">=3.12"` in `api/pyproject.toml`. CI matrix and Cloud Run image both use 3.12 (the `infra/Dockerfile.api` base is `python:3.14-slim` but `pyproject.toml`/`tool.pyright` constrain to 3.12 — the Dockerfile is unused on Vercel; production runs on Vercel Python functions).
- TypeScript 5.x — frontend in `web/` (Next.js 14/16 App Router). Strict mode enabled in `web/tsconfig.json` (`"strict": true`).

**Secondary:**
- SQL (PostgreSQL 17) — Supabase migrations under `supabase/migrations/` (24 numbered files, `20260410000000_initial_schema.sql` through `20260601200000_movepool_overrides.sql`). DB major version pinned in `supabase/config.toml` (`major_version = 17`).
- Shell — ad-hoc data scripts; no build scripts.

## Runtime

**Environment:**
- **Backend (production):** Vercel Python Function. Single entry point `api/index.py` wraps the FastAPI app with an ASGI prefix-stripping middleware (`_StripApiPrefix`) so all routes mount under `/api/*`. Vercel rewrites `/api/(.*)` → `/api/index.py` per `vercel.json`.
- **Backend (alt, unused):** Cloud Run scaffolding kept in `infra/Dockerfile.api` + `infra/cloudrun-api.yaml` for migration off Vercel if needed (containerized, port 8080, `min_scale=0`, `max_scale=3`, 512Mi/1 CPU).
- **Backend (dev):** `uv run uvicorn app.main:app --reload` (port 8000).
- **Frontend (production):** Vercel (Next.js, region `iad1` per `vercel.json`).
- **Frontend (dev):** `next dev` (port 3000).
- **Database:** Supabase-hosted PostgreSQL (managed; `pokecomp` project ID per `CLAUDE.md`). Local dev DB available via `supabase` CLI on ports 54321/54322.

**Package Manager:**
- **Python:** `uv` (Astral) — lockfile `api/uv.lock` present and committed. Installed via `astral-sh/setup-uv@v6` in CI.
- **JavaScript:** `pnpm@10.33.0` (declared in `web/package.json` `"packageManager"`). Lockfile `web/pnpm-lock.yaml` is the canonical lock; an `npm`-generated `web/package-lock.json` also exists alongside it (Vercel install command shells out to `npm install`, so both lockfiles are present — see `vercel.json` `"installCommand": "npm install && cd web && npm install"`).
- **Root:** Minimal `package.json` at repo root pinning only `next: 16.2.3` to satisfy Vercel's framework auto-detection.

## Frameworks

**Core (backend):**
- `fastapi >= 0.115.0` — HTTP framework. App composed in `api/app/main.py`, 19 routers mounted (`pokemon`, `moves`, `items`, `abilities`, `user_pokemon`, `teams`, `meta`, `usage`, `draft`, `cheatsheet`, `matchups`, `ai_usage`, `profile`, `admin`, `admin_cron`, `public`, `strategy`, `calc`).
- `uvicorn[standard] >= 0.34.0` — ASGI server (dev only; Vercel uses its own ASGI adapter).
- `pydantic-settings >= 2.7.0` — env-driven config in `api/app/config.py` (`Settings` with `env_file=.env`).
- `slowapi >= 0.1.9` — rate limiting (`api/app/limiter.py`, custom 429 handler in `api/app/main.py`).

**Core (frontend):**
- `next` 16.2.3 — App Router (`web/src/app/`). 24 route directories under `web/src/app/` including `roster/`, `teams/`, `draft/`, `cheatsheet/`, `meta/`, `pokemon/[id]/`, `u/[username]/`, `share/`, `auth/callback/`, `admin/`, `calc/`, `speed-tiers/`.
- `react` 19.2.4 + `react-dom` 19.2.4.
- `@tanstack/react-query` ^5.99.0 + `@tanstack/react-query-next-experimental` ^5.99.0 — server-state cache (provider in `web/src/app/providers.tsx`, `staleTime: 60s`, `refetchOnWindowFocus: false`).
- `tailwindcss` ^4 + `@tailwindcss/postcss` ^4 — styling. Tailwind v4 (no `tailwind.config.js`; configuration is in CSS via `@theme` blocks). PostCSS pipeline declared in `web/postcss.config.mjs`. Tokens defined in `web/src/app/globals.css`.

**Testing:**
- None configured. No `pytest`/`vitest`/`jest`/`playwright` declared in `api/pyproject.toml` or `web/package.json`. Test-adjacent scripts exist (`api/scripts/smoke_test.py`, `api/scripts/test_damage_calc.py`, `api/scripts/test_cache_utils.py`) but are run manually as standalone modules, not under a test runner.

**Build/Dev:**
- `ruff >= 0.9.0` — Python lint + format (target `py312`, line length 100, rules `E,F,I,N,W`; per-file `E501` ignores in `api/pyproject.toml`).
- `pyright >= 1.1.390` — Python type checking (`typeCheckingMode = "basic"`, Python 3.12).
- `eslint` ^9 + `eslint-config-next` 16.2.3 — JS/TS lint via flat config (`web/eslint.config.mjs`, extends `nextVitals` + `nextTs`).
- `typescript` ^5 — `tsc --noEmit` runs in CI for type checking.

## Key Dependencies

**Critical (backend):**
- `supabase >= 2.13.0` — Postgres client (singleton `supabase` in `api/app/database.py`, created from service-role key). The codebase has no ORM — all queries are direct `supabase.table(...).select/.insert/.upsert/.execute()` calls.
- `anthropic >= 0.52.0` — Claude SDK. Used in `api/app/routers/draft.py`, `api/app/routers/cheatsheet.py`, and `api/app/services/ai_verifier.py` for AI analysis. Models hard-coded in `api/app/ai_quota.py`: `claude-sonnet-4-6` (default) and `claude-haiku-4-5-20251001` (Haiku fallback).
- `httpx >= 0.28.0` — async HTTP client used by every ingest script (PokeAPI, Smogon, Pikalytics, Limitless, Serebii).
- `beautifulsoup4 >= 4.12.0` — HTML parsing for `pikalytics_usage.py` and `serebii_static.py`.
- `PyJWT >= 2.8.0` — Supabase JWT verification (`api/app/auth.py`). Supports both ES256 (asymmetric, JWKS-fetched) and HS256 (symmetric, legacy).

**Critical (frontend):**
- `@supabase/ssr` ^0.5.1 + `@supabase/supabase-js` ^2.45.0 — auth (`web/src/utils/supabase/client.ts` for browser, `web/src/app/auth/callback/route.ts` for server-side OAuth code exchange).
- `gsap` ^3.15.0 + `@gsap/react` ^2.1.2 — animations (entrance staggers per the V2 design system; registered in `web/src/app/providers.tsx`).
- `html2canvas-pro` ^2.0.2 + `jspdf` ^4.2.1 — client-side PDF export (`web/src/lib/pdf-export.ts`, dynamic-imported to avoid SSR breakage).
- `@vercel/analytics` ^2.0.1 — pageview analytics, mounted in `web/src/app/layout.tsx`.

**Infrastructure:**
- `postgrest` (transitive via `supabase-py`) — Supabase calls use `postgrest.types.CountMethod` directly (`api/app/ai_quota.py`, `api/app/routers/public.py`, `api/app/routers/profile.py`).
- `next/font` Google fonts — `Inter` + `JetBrains_Mono` loaded server-side in `web/src/app/layout.tsx` (CSS variables `--font-inter`, `--font-jetbrains-mono`).

## Configuration

**Environment:**
- `api/app/config.py` — single `Settings` class loading from `.env` and OS env. Variables:
  - `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` fallback)
  - `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` fallback) — service-role key, bypasses RLS server-side
  - `SUPABASE_JWT_SECRET` — only required for legacy HS256 tokens; ES256 tokens use Supabase JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  - `ANTHROPIC_API_KEY`
  - `CORS_ORIGINS` (default: `http://localhost:3000,https://pokecomp.app,https://www.pokecomp.app`)
  - `ADMIN_USER_IDS` — comma-separated Supabase UUIDs; admins bypass AI quotas and unlock `/admin/*` endpoints
  - `CRON_SECRET` — shared bearer token validated with `hmac.compare_digest` for `/admin/cron/*` endpoints
- `web/src/utils/supabase/client.ts` — browser client reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `web/src/lib/api.ts` — API base URL resolution: `NEXT_PUBLIC_API_URL` → `VERCEL_URL` → `http://localhost:8000`. Production uses same-origin `/api`.
- `.env` files exist locally (gitignored) — never read; secrets surfaced only by name above.

**Build:**
- `web/next.config.ts` — `images.remotePatterns` whitelists `raw.githubusercontent.com/PokeAPI/**` so `next/image` accepts PokeAPI sprites.
- `web/postcss.config.mjs` — only `@tailwindcss/postcss`.
- `web/tsconfig.json` — `target: ES2017`, `moduleResolution: bundler`, path alias `@/* → ./src/*`, `next` plugin.
- `vercel.json` — root config: `framework: nextjs`, `installCommand: "npm install && cd web && npm install"`, `buildCommand: "cd web && npm run build"`, `outputDirectory: "web/.next"`. Adds global response headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- `supabase/config.toml` — local-dev Supabase CLI config (Postgres 17, ports 54321–54327, auth `jwt_expiry: 3600`, `enable_signup: true`, no SMS/MFA enabled). Production config lives in the Supabase dashboard.

## Platform Requirements

**Development:**
- Python 3.12, `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
- Node 22 (CI uses `actions/setup-node@v4` with `node-version: 22`), `pnpm` 10.x.
- A Supabase project with URL, service-role key, anon key, and (legacy) JWT secret.
- An Anthropic API key for AI features.
- Optional: Supabase CLI for running local Postgres and migrations.

**Production:**
- **Frontend + Backend:** Vercel (single project; Next.js auto-detected, Python function deployed from `api/index.py`).
- **Database:** Supabase (managed Postgres + Auth + Storage). RLS enabled per `supabase/migrations/20260414000000_enable_rls.sql`.
- **Cron:** Vercel Cron — two scheduled invocations defined in `vercel.json`:
  - `/api/admin/cron/daily` at `0 8 * * *` (daily 08:00 UTC) → Limitless tournaments ingest
  - `/api/admin/cron/weekly` at `0 6 * * 1` (Monday 06:00 UTC) → Smogon → Pikalytics → validate-data
  - Per-source endpoints (`/admin/cron/ingest-smogon`, `/admin/cron/ingest-pikalytics`, `/admin/cron/ingest-limitless`, `/admin/cron/validate-data`, `/admin/cron/cache-warmup`) remain manually triggerable but are NOT scheduled (Hobby plan 2-cron cap).
- **CI:** GitHub Actions — `.github/workflows/ci.yml` runs ruff lint+format, pyright, eslint, and `tsc --noEmit` on every PR and push to `main`. `.github/workflows/data_ingestion.yml` runs Sunday 02:00 UTC as a backup ingest path (Smogon + Limitless) — overlaps with Vercel Cron but doesn't write the `cron_runs` audit row.
- **Domain:** `pokecomp.app` (with `www.` alias). Configured in CORS allow-list and `metadataBase` URL (`web/src/app/layout.tsx`).

---

*Stack analysis: 2026-04-28*
