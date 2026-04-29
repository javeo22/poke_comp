<!-- refreshed: 2026-04-28 -->
# CONVENTIONS.md

**Analysis Date:** 2026-04-28

This document captures the canonical code-style rules for the Pokemon Champions Companion repo. The authoritative high-level rules live in `CLAUDE.md` at the repo root (Title Case names, PokeAPI integer IDs, no-ORM, Pydantic-as-source-of-truth, V2 magenta/gold/purple design system). Everything below describes how those rules are expressed in code.

## Naming Patterns

**Files:**
- Python: `snake_case.py` everywhere (`api/app/routers/pokemon.py`, `api/app/services/damage_calc.py`, `api/app/routers/admin_cron.py`, `api/scripts/test_damage_calc.py`).
- TypeScript/React: `kebab-case.tsx` for components and pages (`web/src/components/roster/roster-card.tsx`, `web/src/components/meta/pokemon-detail-panel.tsx`, `web/src/components/ui/sprite-fallback.tsx`, `web/src/components/error-boundary.tsx`, `web/src/components/teams/team-form.tsx`).
- Next.js App Router special files keep their canonical names: `page.tsx`, `layout.tsx`, `providers.tsx`, `globals.css`. No `route.ts` (Route Handlers) is in use yet; the API lives in `api/app/`.
- "Test" scripts use the `test_<thing>.py` prefix in `api/scripts/` even though they aren't run by pytest (see TESTING.md).

**Identifiers:**
- Python functions and variables: `snake_case` (`list_pokemon_basic`, `_resolve_supabase_url`, `validate_champions_pokemon_batch`).
- Python classes: `PascalCase` (`PokemonBase`, `CalcRequest`, `IngestResult`, `ValidationReport`).
- Python module-level constants: `UPPER_SNAKE_CASE` (`STAT_KEYS`, `MAX_PER_STAT`, `VALID_NATURES`, `EXPECTED_ROSTER_MIN`, `_STATIC_CACHE_HEADER`, `_PLUS_STAT_MULT`).
- Private/module-internal helpers prefixed `_` (`_extract_usage_names`, `_resolve_roster_pokemon_ids`, `_check_roster`, `_jwks_client`, `_persist_run`).
- TypeScript functions and variables: `camelCase` (`apiFetch`, `cachedFetch`, `friendlyError`, `pokeArt`, `itemSprite`, `loadRoster`, `handleSignOut`).
- React components: `PascalCase` (`Nav`, `RosterCard`, `TeamCard`, `SpriteFallback`, `ErrorBoundary`, `EmptyState`, `LoadingSkeleton`, `PokemonView`, `BrandMark`).
- TypeScript interfaces and types: `PascalCase` (`Pokemon`, `PokemonDetail`, `CalcRequest`, `FriendlyError`, `RosterCardProps`, `Team`, `UsageEntry`).
- TypeScript constants and tuples: `UPPER_SNAKE` for the binding, lowercase string values inside (`POKEMON_TYPES`, `FORMATS`).

**Domain entities — universal rules from `CLAUDE.md`:**
- Pokemon, moves, items, abilities use **PokeAPI integer IDs** as primary keys.
- User-owned rows (`teams`, `user_pokemon`, `matchup_log`) use **Supabase UUIDs** (string).
- **Names are stored Title Case** ("Thunder Punch"). Filters use `ilike(...)` for case-insensitive matching but never lowercase the canonical name.
- **Types are stored lowercase** ("dragon", "ground"). The backend lowercases on the way into `CalcPokemon` (`api/app/routers/calc.py:108`).

## Code Style

**Python (`api/`):**
- Linter and formatter: `ruff` (`api/pyproject.toml` lines 24-33).
- `target-version = "py312"`, `line-length = 100`.
- Lint rule selection: `["E", "F", "I", "N", "W"]` — pycodestyle errors/warnings, pyflakes, import-order (`I`), PEP 8 naming (`N`). No `B`, `UP`, etc.
- Per-file ignores: `scripts/seed_champions.py` and `scripts/test_damage_calc.py` opt out of `E501` because they contain large literal data tables. New files should respect 100 columns without the override.
- `ruff format --check` gates merges in CI (`.github/workflows/ci.yml:29`).
- Type checker: `pyright` in `basic` mode (`api/pyproject.toml:35-37`). `# type: ignore[assignment]` is the accepted escape hatch when reading untyped Supabase result rows (`api/app/routers/pokemon.py:65`).
- Long type-chart matrices may use `# fmt: off` + `# ruff: noqa: E501` to keep alignment readable (`api/app/services/damage_calc.py:27-28`).

**TypeScript / React (`web/`):**
- Linter: ESLint flat config in `web/eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Globally ignores `.next/`, `out/`, `build/`, `next-env.d.ts`. Run via `pnpm lint`.
- TypeScript compiler: `web/tsconfig.json` runs `strict: true`, `target: ES2017`, `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true`. CI also runs `pnpm exec tsc --noEmit` (`.github/workflows/ci.yml:59`).
- Inline `eslint-disable-next-line @typescript-eslint/no-explicit-any` is allowed for admin endpoints that proxy untyped Supabase rows (`web/src/lib/api.ts:829, 834, 848, 853, 866, 871, 882, 887`). Do not use `any` in user-facing code.
- No Prettier config — formatting follows ESLint defaults plus author convention. Indentation: 2 spaces.

**General:**
- Avoid emojis in code, comments, and commit messages (`CLAUDE.md` "Working With Me").

## Import Organization

**Python (enforced by ruff `I`):**
1. Standard library (`from datetime import ...`, `from typing import Any`).
2. Third-party (`from fastapi import ...`, `from pydantic import BaseModel`, `from supabase import ...`).
3. First-party `app.*` and `scripts.*` (`from app.config import settings`, `from app.database import supabase`, `from scripts.ingest import smogon_meta`).

Example: `api/app/routers/pokemon.py:1-18`.

**TypeScript:**
- Order observed in `web/src/app/calc/page.tsx`, `web/src/lib/api.ts`, `web/src/components/roster/roster-card.tsx`:
  1. Built-in / framework (`"react"`, `"next/image"`, `"next/navigation"`, `"next/link"`).
  2. Third-party (`"@supabase/ssr"`, `"@tanstack/react-query"`, `"gsap"`, `"@gsap/react"`).
  3. Type-only imports — usually a separate `import type { ... }` group.
  4. Project imports via path alias — UI primitives, then features, then types.
- ESLint does not enforce a strict order; keep groups visually separated by blank lines.

**Path Aliases:**
- Single alias: `@/*` → `web/src/*` (`web/tsconfig.json:21-23`). Always use `@/...`, never relative paths that climb out of a feature directory.
  - Components: `@/components/...`
  - Lib helpers: `@/lib/api`, `@/lib/errors`, `@/lib/sprites`
  - Types: `@/types/team`, `@/types/usage`
  - Feature-scoped: `@/features/pokemon/components/...`, `@/features/pokemon/types`, `@/features/pokemon/api`
  - Supabase client: `@/utils/supabase/client`

## Error Handling

**API → user-friendly UI copy is a two-stage pipeline:**

**Stage 1 — API (`api/app/routers/*`):** Every router raises `fastapi.HTTPException` with a clear status code and string `detail`. Never bubble raw exceptions.
- 400 — validation failures (Champions eligibility, nature, stat points, missing roster entries). See `api/app/validators.py` and `api/app/routers/teams.py`.
- 401 — auth issues (`api/app/auth.py:36, 73, 80, 88, 92` and `api/app/routers/admin_cron.py:46, 49`).
- 403 — admin-only routes (`api/app/routers/admin.py:36`).
- 404 — entity not found. Pattern: catch the Supabase `Exception` raised by `.single()` and re-raise:

```python
try:
    result = supabase.table("pokemon").select("*").eq("id", pokemon_id).single().execute()
except Exception as exc:
    raise HTTPException(status_code=404, detail="Pokemon not found") from exc
```

`api/app/routers/pokemon.py:191-194`, `api/app/routers/calc.py:144, 154, 164`.
- 429 — rate limit. Custom JSON shape returned by `app.exception_handler(RateLimitExceeded)` in `api/app/main.py:34-44`.
- 500 — only for genuine server bugs; cron failures persist a `cron_runs` row with status `fail` then bubble HTTPException(500) (`api/app/routers/admin_cron.py:99-100`).
- 503 — `CRON_SECRET not configured` and stale-data gates.
- `noqa: BLE001` is the accepted comment when an `except Exception` block is intentional (cron audit + persisted failure path).

**Stage 2 — Web (`web/src/lib/errors.ts`):** All catches must funnel error objects through `friendlyError(err)` which returns `{ title, message }`. The matcher inspects substrings of the API `detail` (`401`, `403`, `404`, `429`, `503`, `5xx`, `failed to fetch`, `network`, `stale_data`, etc.) and maps them to short user-friendly copy. Never surface stack traces or raw `Failed to fetch` messages. See `web/src/lib/errors.ts:23-103`.

**Component-level pattern:**
- Page components: `try { ... } catch (err) { setError(friendlyError(err).message); }` (e.g. `web/src/app/roster/page.tsx:69-75`, `web/src/app/pokemon/[id]/page.tsx:39-43`, `web/src/app/calc/page.tsx:56`).
- Render the error with `<ErrorCard title="..." message={error} />` from `web/src/components/ui/error-card.tsx`.
- React rendering errors are caught by `<ErrorBoundary fallback={...}>` (`web/src/components/error-boundary.tsx`) — wrap any feature surface that pulls remote data, especially anything inside `<Suspense>` (`web/src/features/pokemon/components/pokemon-view.tsx:57-68`).

**`web/src/lib/api.ts` extracts the FastAPI `detail` string before throwing:**

```ts
let detail = `API error: ${res.status} ${res.statusText}`;
try { const body = await res.json(); if (body.detail) detail = body.detail; } catch {}
throw new Error(detail);
```

`web/src/lib/api.ts:84-94, 139-148`.

## Logging

**Python:** Standard `logging` module. The cron router uses a named logger:

```python
logger = logging.getLogger("cron")
logger.error("cron.persist_failed source=%s exc=%s", source, exc)
```

`api/app/routers/admin_cron.py:37, 80`. Format keys lowercase with dot-separated namespaces (`cron.persist_failed`).

**TypeScript:** Use `console.error` for unexpected client errors caught at the boundary (`web/src/components/error-boundary.tsx:24`). Do NOT log inside `friendlyError`; it is pure.

## Comments and Docstrings

**Python:**
- Module-level docstrings describe purpose, scope, and usage (see `api/app/services/damage_calc.py:1-18`, `api/app/routers/admin_cron.py:1-19`, `api/scripts/validate_data.py:1-22`).
- Public functions get triple-quoted docstrings; complex helpers explain the formula or business decision (e.g. `_final_stat` in `api/app/routers/calc.py:76-97`).
- Inline `# ──` separators are used to break long files into sections (`api/app/validators.py:14, 51, 88`).

**TypeScript:**
- JSDoc comments are used for shared utilities that ship UX guarantees (`web/src/lib/errors.ts:1-9`, `web/src/components/ui/sprite-fallback.tsx:1-4`).
- Component prop interfaces are declared inline above the component, not in a separate file.

## Function and Module Design

**Python routers:**
- One `APIRouter` per file with a `prefix` and `tags` (`router = APIRouter(prefix="/calc", tags=["calc"])`).
- Routes are short — extract validation/setup into private `_helpers` in the same file (`api/app/routers/teams.py:_resolve_roster_pokemon_ids`, `_validate_mega`).
- Auth dependencies are injected via `user_id: str = Depends(get_current_user)` for user-scoped endpoints, `Depends(get_admin_user)` for admin-only.
- Pagination follows `limit: int = Query(50, ge=1, le=N)` + `offset: int = Query(0, ge=0)`.
- Cache-Control headers for static-ish data go in a module constant: `_STATIC_CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400"` (`api/app/routers/pokemon.py:25`).

**Python models (`api/app/models/*.py`):**
- Pure Pydantic `BaseModel` classes — these are the source of truth (`CLAUDE.md`).
- Slim variants for list views where payload size matters: `PokemonBasic` is ~80% smaller than `PokemonBase` (`api/app/models/pokemon.py:24-38`).
- Detail variants extend the base: `class PokemonDetail(PokemonBase): ...` (`api/app/models/pokemon.py:70`).

**TypeScript types (`web/src/types/*.ts`, `web/src/features/*/types/index.ts`):**
- Mirror the Pydantic models manually. Mismatches are bugs; check both sides when changing a field.
- Co-locate domain types with the feature when they only matter to that feature (`web/src/features/pokemon/types/index.ts`).
- Cross-feature types live in `web/src/types/` (`team.ts`, `usage.ts`, `cheatsheet.ts`, `matchup.ts`, `profile.ts`, etc.).

**React components:**
- Always `"use client"` for components that use hooks, state, or browser APIs. App-Router pages default to server components; almost every page in this repo opts into client mode because they call `fetch*` from `@/lib/api` directly.
- Provider tree lives in `web/src/app/providers.tsx` (TanStack Query client + GSAP plugin registration).
- Layout is in `web/src/app/layout.tsx` and is the only place fonts (`Inter`, `JetBrains_Mono`) are loaded.
- Route segments that need to be fully dynamic add their own `layout.tsx` next to `page.tsx` (e.g. `web/src/app/calc/layout.tsx`, `web/src/app/roster/layout.tsx`, `web/src/app/teams/layout.tsx`, `web/src/app/speed-tiers/layout.tsx`). The root layout comment notes: "Dynamic pages (cheatsheet, draft, roster) have their own layout with force-dynamic" (`web/src/app/layout.tsx:23-24`).
- Component prop types use `interface ComponentNameProps { ... }`, declared just above the component.

## Data Fetching

**API client (`web/src/lib/api.ts`):**
- All HTTP calls go through `apiFetch<T>(path, options)` — sets `Content-Type: application/json`, attaches the Supabase access token as `Authorization: Bearer ...` when a session exists, decodes JSON, throws with the API `detail`.
- Slow-changing GETs (`fetchPokemonBasic`, `fetchSpeedTiers`, `fetchUsage`) use `cachedFetch` — a 5-minute in-memory map keyed on path + serialized params. The cache is browser-only (skipped during SSR).
- DELETE handlers and `apiFetchText` re-implement the auth header inline because they don't use the JSON helper (minor duplication).
- New endpoints: add a typed wrapper in `web/src/lib/api.ts`. Don't fetch from components.

**TanStack Query (`@tanstack/react-query` v5):**
- Used for streaming Suspense fetches: `usePokemonSuspense` calls `useSuspenseQuery({ queryKey: ["pokemon", filters], queryFn: () => pokemonApi.getPokemon(filters) })` (`web/src/features/pokemon/api/index.ts:22-27`).
- Default options set globally in `web/src/app/providers.tsx:10-21`: `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- The non-Suspense fetch pattern is plain `useEffect` + `fetch*` + `setLoading` / `setError` (`web/src/app/roster/page.tsx`, `web/src/app/pokemon/[id]/page.tsx`, `web/src/app/calc/page.tsx`). Both styles coexist; Suspense is preferred for new feature surfaces, plain effects are fine for simple pages.

## Styling — Tailwind CSS v4 + V2 Token System

**Token plumbing:**
- `web/postcss.config.mjs` loads `@tailwindcss/postcss`.
- All theme tokens live in `web/src/app/globals.css` under `@theme inline { ... }` (Tailwind v4 syntax). This is the authoritative palette + radii + font + type-color map.
- The V2 redesign palette and rules are spelled out in `CLAUDE.md` "Design System: PokeComp Redesign (V2 — Apr 27 2026)".

**Color tokens (use these — never hex literals in components):**
- Backgrounds: `bg-surface`, `bg-surface-low`, `bg-surface-mid`, `bg-surface-high`, `bg-surface-highest`.
- Brand: `bg-primary` / `text-primary` / `border-primary` (#FF2D7A magenta) — primary, live state, danger.
- CTA: `bg-accent` / `text-accent` (#FFD23F gold) — main CTA buttons.
- AI/contextual: `bg-purple` / `text-purple-soft`.
- Status: `bg-success` (#22c55e), `bg-tertiary` (#F59E0B amber, legacy warning, kept for back-compat).
- Text: `text-on-surface` (#EDE9F4), `text-on-surface-muted`, `text-on-surface-dim`. **Never use pure `text-white`.**
- Borders: `border-outline-variant` (#2a1f33) is the universal 1px card/panel/input border. Hover state lifts to `rgba(255,210,63,.35)` (gold).
- Type colors: `bg-type-fire`, `text-type-water`, `border-type-electric`, etc. — all 18 types.

**Required UI component classes (defined in `web/src/app/globals.css`):**
- `.card` — static card. `rgba(15,9,22,.6)` background, `1px solid var(--color-outline-variant)` border, `0.875rem` radius.
- `.card-interactive` — same as `.card` but with hover transitions (gold-tinted border + subtle background lift).
- `.btn-primary` — solid gold CTA, dark text, the design's main action button.
- `.btn-gradient` — magenta→gold linear gradient for hero / strong-action moments.
- `.btn-ghost` — transparent + 1px outline-variant border.
- `.input-field` — gold focus ring (was crimson pre-V2).
- `.mono-label` — `font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase;` for the `◆ LABEL · COUNT` mono headers.
- `.text-gradient` — magenta→gold text fill.
- `.pulse-dot` — animated live-state indicator.
- `.status-dot` + `.status-built` / `.status-training` / `.status-wishlist` — roster status LEDs (`web/src/components/roster/roster-card.tsx:10-20`).
- `.image-rendering-pixelated` — apply on every PokeAPI front-sprite `<Image>` for crispness.

**Radii (always use the token, never an arbitrary value):**
- Cards/panels: `0.875rem` (`var(--radius-card)`).
- Buttons/inputs: `0.5rem` (`var(--radius-button)`).
- Badges/dots only: `9999px`.

**Typography:**
- Body and display: `font-display` / `font-body` → Inter (`var(--font-inter)`).
- Mono: `font-mono` → JetBrains Mono. Use for ALL-CAPS labels, telemetry, IDs, percentages.
- Headlines tracked tight: `tracking-[-0.035em]` to `tracking-[-0.045em]` (see `web/src/features/pokemon/components/pokemon-view.tsx:45`).

**The mono-label header pattern:**

```tsx
<div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-2">
  ◆ POKEDEX · CHAMPIONS-ELIGIBLE
</div>
```

`web/src/features/pokemon/components/pokemon-view.tsx:42-44`. This pattern repeats across every feature page.

**Type pills:**
- Use `<TypeBadge type={t} />` from `web/src/features/pokemon/components/type-badge.tsx`. Flat color from `--color-type-<name>`, dark text, mono uppercase.

**Brand mark:**
- `<BrandMark>` in `web/src/components/nav.tsx:201-220` — 30×30 conic-gradient tile (magenta → purple → gold) wrapping a near-black square with a gold "P". Never use Pokeball/Nintendo IP.

## Sprites and Imagery

**Helpers (`web/src/lib/sprites.ts`):**
- `pokeArt(id)` / `pokeArtShiny(id)` — PokeAPI `pokemon/other/official-artwork/{id}.png` for hero/card art (large displays).
- `pokeSprite(id)` / `pokeSpriteShiny(id)` — PokeAPI `pokemon/{id}.png` front sprites for matrices, lists, cheatsheets, picker rows.
- `itemSprite(slug)` — PokeAPI `items/{slug}.png` for held items and the "Buy me a Potion" tip jar (slug, not name).

**Rendering rules:**
- Always use `next/image` (`<Image>`) — `web/next.config.ts` whitelists `raw.githubusercontent.com/PokeAPI/**` for `next/image`.
- For pixel-art front sprites and item sprites: pass `unoptimized` and add `className="image-rendering-pixelated"` (see `web/src/components/nav.tsx:255-260`, `web/src/components/roster/roster-card.tsx:51-59`).
- For official artwork: pass `unoptimized`, add `className="drop-shadow-lg"` (`web/src/app/pokemon/[id]/page.tsx:99-107`).
- Always handle missing sprites: render `<SpriteFallback size={N} />` from `web/src/components/ui/sprite-fallback.tsx` when `sprite_url` is null or `onError` fires (e.g. `web/src/app/pokemon/[id]/page.tsx:97-110`).

**Disclaimer (mandatory in footer + closing CTAs):** "A solo fan project. Not affiliated with The Pokemon Company, Nintendo, or Game Freak." (`web/src/app/layout.tsx:134-136`).

## Auth and User Context

- Frontend session: `createClient()` from `web/src/utils/supabase/client.ts` returns `null` when env vars are unset (auth is deferred-tolerant).
- Backend verification: `get_current_user` in `api/app/auth.py` peeks at the JWT `alg` header and dispatches to ES256 (Supabase JWKS) or HS256 (legacy symmetric). Treat ES256 as the modern default; HS256 is back-compat only.
- Admin gate: `get_admin_user` in `api/app/routers/admin.py:32-37` — checks `user_id in ADMIN_USER_IDS` env var. Use this `Depends(...)` on every admin route.
- Cron gate: `require_cron_secret` in `api/app/routers/admin_cron.py:40-49` — constant-time check of `Authorization: Bearer $CRON_SECRET`. All `/admin/cron/*` paths use this.

## Environment and Config

- Backend config: `api/app/config.py` `Settings(BaseSettings)` reads from `.env`. Accepts both `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`, both `SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- Frontend config: `process.env.NEXT_PUBLIC_*` only (`web/src/lib/api.ts:41`, `web/src/utils/supabase/client.ts:5-6`).
- API base: `NEXT_PUBLIC_API_URL` falls back to `http://localhost:8000` in dev. In production it's `/api` (relative), which `api.ts` rewrites to absolute URLs during SSR using `VERCEL_URL` (`web/src/lib/api.ts:40-50`).

## Common Commands

| Task | Command |
|------|---------|
| Run API dev server | `cd api && uv run uvicorn app.main:app --reload` |
| Run web dev server | `cd web && pnpm dev` |
| Lint Python | `cd api && uv run ruff check app/ scripts/` |
| Format-check Python | `cd api && uv run ruff format --check app/ scripts/` |
| Type-check Python | `cd api && uv run pyright app/ scripts/` |
| Lint web | `cd web && pnpm lint` |
| Type-check web | `cd web && pnpm exec tsc --noEmit` |
| Build web | `cd web && pnpm build` |
| Smoke test | `cd api && uv run python -m scripts.smoke_test` |
| Damage calc tests | `cd api && uv run python -m scripts.test_damage_calc` |
| Cache util tests | `cd api && uv run python -m scripts.test_cache_utils` |
| Data validation | `cd api && uv run python -m scripts.validate_data` |
| Data validation (auto-fix) | `cd api && uv run python -m scripts.validate_data --fix` |

CI on `main` and PRs: `.github/workflows/ci.yml` runs `ruff check`, `ruff format --check`, `pyright`, `pnpm lint`, and `pnpm exec tsc --noEmit`. Any failure blocks merge.
