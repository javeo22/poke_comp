<!-- refreshed: 2026-04-28 -->
# CONCERNS.md

**Analysis Date:** 2026-04-28

This document audits the Pokemon Champions Companion codebase for technical debt, fragile areas, security considerations, performance concerns, and documentation drift. Findings are split into:
- **Observed-from-code:** Confirmed by inspecting source files at the cited paths.
- **Inferred-from-context:** Flagged because of stated project context (`CLAUDE.md`, `LEGAL_AND_DEV_GUIDELINES.md`, `decisions.md`, recent commit history) rather than direct code defects.

---

## Tech Debt

### Untracked file shipping production behavior
- Issue: `web/src/components/ui/sprite-fallback.tsx` is **untracked in git** (per `git status`), yet it is imported by 4 production files.
- Files using it:
  - `web/src/app/pokemon/[id]/page.tsx` (line 10)
  - `web/src/components/roster/roster-card.tsx` (line 4)
  - `web/src/components/meta/pokemon-detail-panel.tsx` (line 5)
  - `web/src/components/teams/team-card.tsx` (line 4)
- Impact: A clean clone or CI checkout will fail to build (`Module not found: @/components/ui/sprite-fallback`). Already-deployed Vercel previews could be running off a stale tree if Vercel reads from a checkout that doesn't include the local copy.
- Fix approach: `git add web/src/components/ui/sprite-fallback.tsx` and commit alongside the other modified files. The file itself is small (56 lines) and well-formed (observed-from-code: pure SVG, no external deps).

### Other untracked files mentioned in production imports
- `web/src/lib/errors.ts` — untracked, imported by every recently-touched page (`friendlyError(err)` helper). Same risk profile as `sprite-fallback.tsx`.
- `web/src/app/calc/` — untracked directory (the new F7 damage-calculator UI).
- `web/src/app/speed-tiers/` — untracked directory (the new F8 speed-tier reference page).
- `api/app/routers/calc.py` — untracked, but already wired into `api/app/main.py` (line 81 via `app.include_router(calc.router)`).
- Impact: Same as above — a fresh checkout will not build. `todo.md` says these features are done; commit them.
- Fix approach: Commit all `??` entries from `git status` together with their `M` siblings in a single "Phase 5B feature completion" commit, since they are tied to the same workstream.

### Stale launch-week Game8 reference inside the seed script
- File: `api/scripts/seed_champions.py:899-900`
- Issue: After Game8 was removed (2026-04-16, ToS audit) the `seed_initial_meta()` function still hardcodes `"source_url": "https://game8.co/games/Pokemon-Champions/archives/592465"` and `"source": "Game8"` when upserting `meta_snapshots`. This script is documented as one-time seed and now requires `--confirm-destructive`, but the literals remain.
- Impact: If the destructive seed is ever re-run, it would *re-insert* Game8-attributed rows into `meta_snapshots`, undoing migration `20260418000000_clear_game8_snapshots.sql` and re-introducing exactly the legal exposure that the audit removed.
- Fix approach: Either (a) drop `seed_initial_meta()` entirely now that tier data is sourced from `pokemon_usage` (Smogon/Pikalytics) or (b) replace the source URL/name with a neutral marker (e.g., `"source": "launch-seed"`, `"source_url": null`) so a future re-seed is not a regression vector.

### `refresh_meta.py` is a no-op zombie
- File: `api/scripts/refresh_meta.py`
- Issue: `SOURCES: list[dict] = []` (line 25). The script's entire reason for existence (Game8 tier scraping) was removed. The 350+ lines of AI-extraction scaffolding remain.
- Impact: Confused new readers ("why does refresh_meta exist?"); risk of a future contributor naïvely adding a new source without re-doing the ToS audit.
- Fix approach: Either delete the file outright, or shrink it to a 10-line placeholder that documents the deprecation and instructs readers to use the cron-driven Smogon/Pikalytics ingest. Reference `LEGAL_AND_DEV_GUIDELINES.md` section 1.C.

### Documentation drift: stale design system specs
- Files:
  - `design/palette.md` — describes "Orbital Archive" / glassmorphism with `primary_container` (#6667AB) on `surface` (#12131D), backdrop-blur, "No-Line Rule" prohibiting 1px borders.
  - `design/ANTIGRAVITY_DESIGN_REVIEW.md` — proposes "Antigravity," "Dynamic Void," "Refractive Surfaces," GSAP-as-physics-engine.
- Issue: Both contradict the current V2 system documented in `CLAUDE.md`, which is explicitly "magenta/gold/purple esports broadcast theme" with `#0a0510` background, **1px outline-variant borders required**, "no glassmorphism, no 3D perspective."
- Impact: A future Claude instance (or human contributor) loading the `design/` folder will get directly contradictory guidance vs. `CLAUDE.md`. The "No-Line Rule" in `palette.md` is the polar opposite of the current convention.
- Fix approach: Move both files into `design/archive/` (or delete) and add a fresh `design/V2.md` that mirrors the V2 spec already in `CLAUDE.md`. The `gengar-team-cheatsheet.html` and `cheatsheet-logic.md` look V2-aligned and can stay.

### Mixed legacy seed metadata
- File: `api/scripts/seed_champions.py` docstring (line 33): `Data sourced from serebii.net and game8.co on 2026-04-10 (launch week).`
- Issue: Comment still names Game8 even after removal.
- Impact: Documentation lies; a future audit could think Game8 is still in scope.
- Fix approach: Strike `game8.co` from the docstring; align with the audit log.

### `seed_auth_user.py` ships a hardcoded password
- File: `api/scripts/seed_auth_user.py` lines 21-23
- Issue: Hardcoded UUID `bc5bc231-9f20-42cf-9bfa-bca4f5dfcd36`, email `commander@orbital.net` ("orbital" — leftover from the deprecated "Orbital Archive" theme), password `password123`.
- Impact: Dev convenience script (not invoked by API routes), but if anyone runs it against the production Supabase project, an account with a trivial password is created. The seed UUID is also referenced by `seed_user_data.py` and may be wired into seed test fixtures.
- Fix approach: Read the password from an env var with no default (fail-loud if missing). Rename the email away from `orbital.net` to align with current branding. Add a `--prod-refuse` guard or check `SUPABASE_URL` against a `localhost`/`127.0.0.1` allowlist.

### Long routers / pages — splitting candidates
- `api/app/routers/cheatsheet.py` — **892 lines.** Saved-cheatsheet persistence, AI prompt construction, response parsing, validity checking, and 5 endpoints in one file.
- `api/app/routers/draft.py` — **738 lines.** Same shape (AI prompt + response shaping + cache + endpoint).
- `api/app/routers/admin.py` — **516 lines.** Mixes data-health, AI-cost dashboard, and CRUD for 6 entity types (pokemon/moves/items/abilities/meta-snapshots/strategy-notes).
- `web/src/app/matches/page.tsx` — **892 lines.** Single client component handling list + filter + create + edit + delete + AI matchup analysis.
- `web/src/app/draft/page.tsx` — **866 lines.**
- `web/src/app/admin/page.tsx` — **750 lines.** Five admin tabs in one client component.
- `web/src/lib/api.ts` — **896 lines.** All API call functions for the entire app live here.
- Impact: Cognitive load for edits; merge-conflict risk; harder to test in isolation.
- Fix approach: Defer until post-MVP unless one of these areas is being actively iterated.

---

## Known Bugs

### `cache_warmup` cron endpoint is a documented stub
- File: `api/app/routers/admin_cron.py:197-212`
- Symptoms: `GET /admin/cron/cache-warmup` returns `200` with a warning string `"cache_warmup not yet implemented (Phase 5.2)"` and a structured log line `cron.cache_warmup result=warn reason=not_implemented`.
- Trigger: Any caller hitting that endpoint. Not currently invoked by the consolidated `cron_daily`/`cron_weekly` aggregators, so production cron load is unaffected.
- Fix path: Implement Phase 5.2 cache warmup or remove the endpoint to keep the surface area honest.

### Pre-existing pyright complaints in `pokemon.py`
- File: `api/app/routers/pokemon.py`
- Symptoms: 17 pre-existing pyright errors flagged in `todo.md` (Supabase `.data` JSON narrowing). Repeatedly noted in commit logs as "above the 17 pre-existing pokemon.py complaints."
- Impact: Type-checker noise; obscures new errors; `# type: ignore[assignment]` comments scattered through the file (lines 60-261).
- Fix path: Define a `SupabaseRow = dict[str, Any]` alias and adopt it consistently, or migrate to a typed Supabase client wrapper.

---

## Security Considerations

### Service-role key usage is server-only (verified)
- Files: `api/app/database.py:5`, `api/app/config.py:14-20`
- Behavior: The Python API constructs the Supabase client with the service-role key (read from `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS. The frontend (`web/src/utils/supabase/client.ts:5`, `web/src/app/auth/callback/route.ts:15`) only reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **No service-role leakage observed.**
- Risk: None observed. Worth re-checking on every Vercel env-var rotation that the service key is **not** added to the frontend env.

### RLS coverage
- Files: `supabase/migrations/20260414000000_enable_rls.sql`, `20260415100000_ai_usage_log.sql`, `20260416000000_user_profiles.sql`, `20260416100000_team_cheatsheets.sql`, `20260416300000_strategy_notes.sql`
- Coverage: All user-scoped tables have RLS + policies — `user_pokemon`, `teams`, `matchup_log`, `ai_usage_log`, `user_profiles`, `team_cheatsheets`, `strategy_notes`.
- `cron_runs` (`supabase/migrations/20260427000000_cron_runs.sql:30`) intentionally has no RLS — admin/cron-only.
- Concern (low): No policy is ever written for the curated public tables (`pokemon`, `moves`, `items`, `abilities`, `pokemon_usage`, `meta_snapshots`, `tournament_teams`). RLS is *not* enabled on them. Today the API uses the service key so this is irrelevant, but if a future feature ever exposes the anon key direct-to-table, those tables would be world-writable from the client. Recommendation: enable RLS on read-only reference tables with a single permissive `SELECT` policy and no write policies; defense-in-depth at trivial cost.

### Cron-endpoint auth
- File: `api/app/routers/admin_cron.py:40-49`
- Behavior: `require_cron_secret` uses `hmac.compare_digest` (constant-time), checks for `Bearer ` prefix, fails closed if `CRON_SECRET` is not configured (`503`).
- Risk: Implementation looks correct. **Watch:** `CRON_SECRET` must be set in Vercel env. If unset, the endpoint returns 503 and Vercel Cron will report failures.

### Supabase JWT validation
- File: `api/app/auth.py`
- Behavior: Inspects unverified header, dispatches to ES256 (JWKS fetch via `jwt.PyJWKClient`) or HS256 (shared secret). Unsupported `alg` -> 401. Expired -> 401.
- Concern (low): `options={"verify_aud": False}` for both algorithms (lines 57, 70). Fine for a single-tenant Supabase project, but no audience check at all.
- Concern (low): The `_jwks_client` global cache (line 11) is process-level — fine for a single Vercel function invocation, but each cold-start re-fetches the JWKS.
- Concern (none): No path that swallows JWT errors silently. All errors raise `HTTPException(401)`.

### Public endpoints (no auth) — audit
- `GET /pokemon/*`, `GET /moves/*`, `GET /abilities/*`, `GET /items/*`, `GET /usage/*`, `GET /meta/*` — read-only reference data, intentionally public. Safe.
- `GET /public/data-freshness`, `GET /public/stats`, `GET /public/u/{username}`, `GET /public/u/{username}/cheatsheets`, `GET /public/cheatsheet/{id}` — intentional, route prefix is `/public`. Verified at `api/app/routers/public.py:117-254`. Public cheatsheets only return rows with `is_public = TRUE` (line 213). Safe.
- `GET /strategy` (list) — `api/app/routers/strategy.py:41-47` — public reads of active strategy notes. Mutations (`POST/PUT/DELETE`) require admin auth. Safe.
- `POST /calc` — `api/app/routers/calc.py:130` — public, no auth check. **Likely intentional** (the damage calculator is a reference tool), but worth confirming. Risk: read-only Supabase queries against `pokemon` and `moves`, no per-user state. Recommend explicit comment marking it as intentionally public.
- `GET /profile/check-username/{username}` — public username availability check. Intentional.
- All POST/PUT/PATCH/DELETE on user data go through `Depends(get_current_user)` (verified across `user_pokemon.py`, `teams.py`, `matchups.py`, `profile.py`, `cheatsheet.py`, `strategy.py`).

### Admin-only endpoints
- File: `api/app/routers/admin.py:32-37`
- Behavior: `get_admin_user` checks the validated user UUID against the `ADMIN_USER_IDS` env (comma-separated). If the env is empty, *all* admin access is denied (line 35: `if not allowed or user_id not in allowed`). Correctly fail-closed.

### CORS
- File: `api/app/main.py:56-62`
- Behavior: `allow_credentials=True` with `allow_origins=settings.cors_origins.split(",")` (default: `localhost:3000`, `pokecomp.app`, `www.pokecomp.app`). No wildcard. Safe.

### Prompt injection / AI input sanitization
- File: `api/app/prompt_guard.py` (45 lines), referenced from `api/app/routers/draft.py:21`.
- Note: Cheatsheet endpoint does not appear to import `prompt_guard` — confirm whether user-named teams or notes flow into the cheatsheet prompt unsanitized.

---

## Performance Bottlenecks

### `/pokemon/{id}/detail` issues 4-7 sequential Supabase queries
- File: `api/app/routers/pokemon.py:198-289`
- Problem: One pokemon fetch + one moves batch + one abilities batch + two usage queries (one per format, doubles + singles, in a loop) + one mega-resolve batch = up to 6 sequential round-trips per detail page load.
- Cause: Supabase client is synchronous; each call blocks. No parallelization with `asyncio.gather`.
- Impact: Cold-cache TTFB on `/pokemon/727` is the sum of 6 RTTs to Supabase.
- Improvement path: (a) Run the two `pokemon_usage` queries in a single query with `.in_("format", ["doubles", "singles"])` and group client-side. (b) Issue moves + abilities + usage + mega in parallel via `asyncio.to_thread(...)` or move to async Supabase.

### Sprite fetching has no app-level cache
- File: `web/src/lib/sprites.ts`
- Behavior: Returns raw URLs to `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/...`. No CDN proxy, no Next.js image optimization (`next/image` is used with `unoptimized` per `decisions.md` D008), no service-worker cache.
- Impact: Speed-tiers page renders 200+ sprites at once -> 200+ GitHub requests on cold load.
- Improvement path: Either (a) proxy through a Vercel Edge Function with `Cache-Control: public, max-age=31536000`, (b) ingest sprites into Supabase Storage at seed time, or (c) point at PokeAPI's CDN if/when available.

### N+1 risk in matches/profile pages
- File: `web/src/app/matches/page.tsx` (892 lines), `api/app/routers/profile.py:177` (`_compute_expanded_stats`)
- Concern: Not directly verified line-by-line, but a 892-line client page with multiple resource lists is a classic N+1 trap.
- Improvement path: Audit on next iteration. Worth a load-test at >100 matches.

### In-memory client cache
- File: `web/src/lib/api.ts:99-121`
- Behavior: `cachedFetch` uses a `Map` keyed by path+params with a 5-minute TTL. Comment explicitly says "Skipped on the server" — server-side bypasses the cache to avoid cross-user leakage in serverless functions. Good.

---

## Fragile Areas

### Denormalized `movepool` and `abilities` (TEXT[])
- Files: `api/app/routers/pokemon.py:215` (`.in_("name", movepool)`), `decisions.md:13-17` (D002).
- Why fragile: No referential integrity between `pokemon.movepool` and `moves.name` (both TEXT-keyed, no FK). A move name typo, a Title-Case drift, or a Champions patch that renames a move silently produces an empty `move_details` array — the frontend renders "0 moves" with no error.
- Detection: `scripts/scan_movepool_gaps.py` exists for exactly this concern — `api/movepool_gaps_report.json` is the most recent audit output (committed).
- Documented trade-off: D002 explicitly accepts this trade. Not a bug, just fragile-by-choice.
- Mitigation: Continue running `validate_data.py` (which the weekly cron does, with `--fix`). Consider a CI step that runs `scan_movepool_gaps.py` and fails the build on new gaps.

### Champions data overwrites PokeAPI baseline
- Decision: `decisions.md:19-23` (D003). No dual columns.
- Why fragile: A faulty Champions data ingest can corrupt the baseline, and there is no "revert to PokeAPI baseline" button. Recovery requires re-running `import_pokeapi.py`.
- Mitigation: Live DB is the source of truth (post-2026-04-17). `champions_validation_report.json` and `validation_report.json` checked into `api/`. `validate_data.py --fix` runs weekly via cron.

### Manual TS-mirror of Pydantic models
- Files: `api/app/models/*.py` (Python source-of-truth) ↔ `web/src/types/*.ts` (manual mirror).
- Decision: `decisions.md:33-35` (D005). Explicitly accepts manual mirroring.
- Why fragile: A Pydantic field rename or type change must be hand-applied to TypeScript. CI does not catch the drift.
- Mitigation: Could generate types from FastAPI's OpenAPI schema (`openapi-typescript`).

### Cron freshness gating
- Files: `api/app/services/data_freshness.py`, hard-coded `STALE_USAGE_THRESHOLD_DAYS = 14` (referenced in `cheatsheet.py`, `draft.py`, `admin.py`, `public.py`).
- Why fragile: If Vercel Cron fails for >14 consecutive days (Hobby plan limits, account suspension, secret rotation), every AI endpoint returns `503` and the app is effectively dead. The `cron_runs` audit table + `/admin/data-health` are designed to catch this, but there is no automated alerting.
- Mitigation: Add an alert (Vercel webhook, Slack, email) when the most recent `cron_runs` row for `cron_weekly` or `cron_daily` is `fail` or older than expected.

### Multi-source `pokemon_usage` reconciliation
- File: `api/app/routers/admin_cron.py:300-328` (weekly aggregator).
- Behavior: Smogon ingest runs first, Pikalytics second. Pikalytics overwrites where they overlap.
- Why fragile: If Pikalytics scrape fails mid-run (the aggregator catches and continues), a partial overwrite can leave stale Smogon rows for some Pokemon and fresh Pikalytics rows for others — same `format` + `snapshot_date`, mixed sources.
- Mitigation: A composite-source health check could flag mixed-source snapshot dates. Not currently in `validate_data.py`.

### Silent `except Exception` in non-critical paths
- Files (sample): `api/app/routers/cheatsheet.py:73,92,602,651`, `public.py:28,77`, `profile.py:174`, `admin.py:102,263`, `ai_quota.py:88`, `services/data_freshness.py:37`.
- Pattern: Returns empty/default data on any failure. Useful for "table not yet migrated" or auth-metadata fallback, but masks Supabase outages — the app appears to work but renders empty.
- Mitigation: At minimum, log the swallowed exception (`logger.warning`) instead of `pass`. The cron endpoints already do this correctly (`admin_cron.py:80`).

---

## Scaling Limits

### Vercel Hobby cron cap
- File: `vercel.json` (only 2 cron entries: `cron-daily` + `cron-weekly`).
- Limit: Hobby plan = 2 cron schedules. The 5-cron design was consolidated to 2 on 2026-04-27 (per `todo.md` "Phase 6 (cron consolidation)").
- Pressure: Adding any new periodic job requires either consolidating more aggregators or upgrading to Pro.

### AI cost ceilings
- File: `api/app/ai_quota.py:12-14`
- Limits: Free = 3/day, Supporter = 30/day + 600/month soft cap. Admin = unlimited.
- Pressure: Supporter cap is generous; if/when supporter count grows, monthly soft cap may need a hard cap. `/admin/ai-costs` (line 246) gives visibility.

---

## Dependencies at Risk

### Tailwind CSS v4
- File: `web/package.json` (`"tailwindcss": "^4"`).
- Risk: Tailwind v4 is recent; CSS-first `@theme` config (per D006) is a paradigm shift. Breaking changes between v4 minors are possible.
- Mitigation: Lock to a specific minor when MVP ships.

### Next.js 16
- File: `web/package.json` (`"next": "16.2.3"`).
- Risk: Major version. Watch for App-Router or React Server Component breaking changes in 16.x patches.

### Supabase Python client + JWT
- File: `api/app/auth.py:1` (PyJWT) + supabase-py.
- Risk: Supabase's JWT signing algorithm migration (HS256 -> ES256) is the reason `auth.py` handles both. If Supabase deprecates HS256 entirely, the HS256 branch can be removed; if a third algorithm is added, new code is required.

---

## Missing Critical Features

### No automated alerting on cron failures
- Problem: `cron_runs` table records failures, but nothing pages a human. A two-week silent failure leaves the app in `503` mode for AI endpoints.
- Fix path: Add a webhook-on-failure to the `_record_cron_run` wrapper or a separate `cron_alerter` that runs after `cron_weekly` and posts to Slack/email when status is `fail`.

### No CI for the API
- Files: No `.github/workflows/api.yml` was located. Note: `.github/workflows/ci.yml` does run `ruff check`, `ruff format --check`, and `pyright` on the API per the TESTING.md analysis — confirm whether this concern is still accurate before acting on it.
- Problem (potentially stale): If CI for Python only runs on the web side, `pyright` regressions on `api/` would not be caught.
- Fix path: Verify `.github/workflows/ci.yml` contents include the `api-checks` job; if not, add it.

### Improvements Plan v2 workstreams pending
- Reference: `todo.md:60` ("Improvements Plan v2 (see .claude/plans/rippling-stargazing-codd.md)"). Memory note: "10-workstream plan from Apr 15; Workstream A done, D-J pending."
- Status: Workstream A (loading/error/empty primitives) is now done (`todo.md` 2026-04-28 entries). D-J pending. No code-level TODO/FIXME comments reference these workstreams.
- Risk: Plan docs not committed to source control beyond `.claude/plans/` mean these workstreams are invisible to code-only readers.

---

## Test Coverage Gaps

### No automated test suite for the API
- Files: `api/scripts/test_cache_utils.py`, `api/scripts/test_damage_calc.py`, `api/scripts/smoke_test.py`.
- Coverage: Standalone scripts, not pytest. No CI gating on tests.
- Priority: **High** for any feature that touches money (AI quota, supporter status) or user data integrity (teams, matchups). Low for read-only reference endpoints.
- Fix path: Add `pytest` + a small handful of integration tests using `TestClient(app)` against a local Supabase or a fixture DB. Start with `auth.py` (token validation paths) and `ai_quota.py` (quota math).

### No tests for `damage_calc.py`
- File: `api/scripts/test_damage_calc.py` exists but it's a script, not a pytest module. The recent F7 work added this engine to the public `/calc` endpoint.
- Risk: A regression in damage formulas (rounding, STAB, weather, doubles spread) would silently produce wrong numbers — and damage numbers are the most-checkable output a user has.
- Fix path: Convert the smoke-test-style file into pytest with assertions and add a CI gate.

### No tests for ingest scripts
- Files: `api/scripts/ingest/*.py`.
- Risk: A breaking change in Smogon/Pikalytics/Limitless HTML structure produces an empty or malformed `pokemon_usage` table. The cron endpoint will record `warn` (rows == 0), but the data freshness gate will flip the AI endpoints to 503.
- Fix path: Snapshot a known-good HTML response for each source under `tests/fixtures/` and run the parsers against the fixtures in CI.

### No tests for RLS policies
- File: `supabase/migrations/20260414000000_enable_rls.sql`.
- Risk: A future migration that adds a column or table without RLS could expose user data. Today it's all behind the service-role key, but defense-in-depth deserves a check.
- Fix path: Add a one-shot integration test that connects with the *anon* key and confirms it cannot read another user's row.

### Frontend has no tests
- Files: No `*.test.tsx` / `*.spec.tsx` discovered under `web/src/`.
- Risk: The 892-line `matches/page.tsx` and 866-line `draft/page.tsx` are state-machine-heavy and edited frequently.
- Priority: **Low** during MVP. Add Playwright smoke tests post-launch.
