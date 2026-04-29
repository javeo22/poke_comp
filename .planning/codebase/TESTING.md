<!-- refreshed: 2026-04-28 -->
# TESTING.md

**Analysis Date:** 2026-04-28

The Pokemon Champions Companion is a solo MVP. There is no formal test harness on either side; coverage is light by design and concentrated on the parts where a regression would silently corrupt data or break a deterministic numeric output. The sections below describe what does exist and call out the gaps honestly so future plans can prioritise filling them.

## Test Framework

**Runner:**
- Python: **`unittest`** (stdlib), invoked manually as `python -m scripts.test_damage_calc` and `python -m scripts.test_cache_utils`. There is **no `pytest`, no `pytest.ini`, and no `[tool.pytest.ini_options]`** in `api/pyproject.toml`. The test files live in `api/scripts/` (not `tests/`) on purpose so they share the script-style entrypoint convention.
- Web: **No test framework installed.** `web/package.json` has no `jest`, `vitest`, `playwright`, or `@testing-library/*` dependency, and no `test` script. Run-time validation relies on `pnpm lint` + `pnpm exec tsc --noEmit` only.

**Assertion Library:**
- Python: `unittest.TestCase.assertEqual`, `assertGreater`, `assertTrue`, etc. (`api/scripts/test_damage_calc.py`).
- The cache-utils "tests" use a hand-rolled `_check(label, condition)` helper that prints PASS/FAIL and accumulates failures, exiting non-zero on any failure (`api/scripts/test_cache_utils.py:22-28`).

**Run Commands:**

```bash
cd api && uv run python -m scripts.test_damage_calc   # Damage calc golden values
cd api && uv run python -m scripts.test_cache_utils   # Cache key normalization
cd api && uv run python -m scripts.smoke_test         # Champions data integrity
cd api && uv run python -m scripts.validate_data      # 7-check validation report
cd api && uv run python -m scripts.validate_data --fix # Auto-repair mode
```

There is no aggregated `make test` or `pnpm test`. CI does not run any of these — they're manual or cron-driven.

## Test File Organization

**Location:**
- Python tests live in `api/scripts/`, not in a `tests/` directory. Files: `api/scripts/test_damage_calc.py`, `api/scripts/test_cache_utils.py`. They are run as scripts (`python -m scripts.test_damage_calc`).
- Smoke / validation scripts (also in `api/scripts/`) act as integration probes against the live Supabase DB: `api/scripts/smoke_test.py`, `api/scripts/validate_data.py`, `api/scripts/validate_champions_sources.py`, `api/scripts/scan_movepool_gaps.py`.
- There are no co-located `__tests__/` or `*.test.tsx` files anywhere under `web/`.

**Naming:**
- `test_<unit>.py` — unit-style assertion scripts (damage_calc, cache_utils).
- `smoke_test.py` — pass/fail integration probe.
- `validate_<thing>.py` — broader integrity audits that also know how to repair.

**Structure:**

```
api/scripts/
├── test_damage_calc.py        # unittest-based, golden values vs Smogon calc
├── test_cache_utils.py        # script-style PASS/FAIL, normalization checks
├── smoke_test.py              # 5 integrity checks, exits non-zero on FAIL
├── validate_data.py           # 7 deeper checks; --fix mode auto-repairs
├── validate_champions_sources.py  # cross-references Serebii + PokeAPI
└── scan_movepool_gaps.py      # reports missing moves from movepools
```

## Test Structure

**Suite Organization (damage_calc — the most "real" test file):**

```python
import unittest

class TypeChartTests(unittest.TestCase):
    def test_super_effective_combos(self):
        self.assertEqual(type_multiplier("ice", ["dragon", "flying"]), 4.0)
        self.assertEqual(type_multiplier("electric", ["water", "flying"]), 4.0)

    def test_immunities(self):
        self.assertEqual(type_multiplier("ground", ["flying"]), 0)

class DamageCalcTests(unittest.TestCase):
    def test_ice_beam_vs_garchomp_4x(self):
        # Reference numbers verified against Smogon damage calc Gen 9
        sneasler = from_base_stats("Sneasler", ["fighting", "poison"], {...})
        garchomp = from_base_stats("Garchomp", ["dragon", "ground"], {...})
        ice_beam = CalcMove(name="Ice Beam", type="ice", category="special", power=90)
        result = calculate_damage(sneasler, ice_beam, garchomp, is_doubles=False)
        self.assertEqual(result["type_effectiveness"], 4.0)
        self.assertFalse(result["stab"])
        self.assertGreater(result["max_pct"], result["min_pct"])
```

`api/scripts/test_damage_calc.py:27-117`. The tolerance comment (lines 11-13) is important: numbers are cross-checked by hand against `https://calc.pokemonshowdown.com/` with a +/- 1 HP tolerance per roll.

**Smoke / validation pattern (`api/scripts/smoke_test.py`):**

```python
def _check_roster(sb: Client) -> list[str]:
    result = sb.table("pokemon").select("id", count=CountMethod.exact).eq("champions_eligible", True).execute()
    count = result.count or 0
    if count < 180:
        return [f"FAIL: Only {count} Champions-eligible Pokemon (expected 180+)"]
    if count > 300:
        return [f"WARN: {count} Champions-eligible Pokemon seems high (expected <300)"]
    return []

# Each check returns a list of FAIL/WARN strings; main accumulates and exit-1s on any FAIL.
```

`api/scripts/smoke_test.py:22-36, 134-163`. The `validate_data.py` agent uses the same shape but produces a structured `ValidationReport` with `CheckResult` dataclasses (`api/scripts/validate_data.py:47-97`).

## Mocking

**Framework:** Not used.

**Patterns:**
- The damage_calc tests build inputs by hand from the real Pokemon base stats and call `calculate_damage()` directly — no mocks because the function is pure.
- The cache_utils tests pass plain dicts/lists into the normalization helpers — also pure.
- The smoke_test and validate_data scripts hit the **real production Supabase project** with the service-role key. There is no test DB and no mocked Supabase client.

**What to Mock (when adding tests):**
- HTTP calls to PokeAPI / Pikalytics / Smogon / Limitless. The ingest scripts (`api/scripts/ingest/*.py`) currently use real `httpx` requests; future tests should fixture the response payloads.
- Anthropic Claude API calls in `api/app/services/ai_verifier.py` and `api/app/routers/draft.py`, `cheatsheet.py`. These are billed and slow.

**What NOT to Mock:**
- Pure deterministic functions (`damage_calc`, `cache_utils.normalize_*`, `validators.*`). Test against real inputs, expected outputs.

## Fixtures and Factories

**Test Data:**
- No factory framework. Sample Pokemon are constructed inline in `test_damage_calc.py` from canonical base stats (Garchomp, Sneasler, Incineroar, Whimsicott).
- No JSON fixture files for tests. Two large data exports do exist for inspection only: `api/champions_validation_report.json`, `api/movepool_gaps_report.json`, `api/pikalytics_translations.json`, `api/validation_report.json`. These are tool outputs, not test fixtures.

**Location:**
- Inline in the test file. Build helpers (`from_base_stats`, `CalcMove`, `CalcPokemon`) are imported from `api/app/services/damage_calc.py`.

## Coverage

**Requirements:** None enforced. No coverage tool configured (`coverage.py`, `pytest-cov`, `c8`, `nyc`).

**View Coverage:** Not available.

**Honest gaps (this repo is solo-MVP — these are intentionally untested):**

| Area | File(s) | Tested? | Notes |
|------|---------|---------|-------|
| Damage calculator | `api/app/services/damage_calc.py` | **Yes** (unit) | Golden values vs Smogon, lvl 50, ~5 scenarios. |
| Cache key normalization | `api/app/services/cache_utils.py` | **Yes** (script) | PASS/FAIL on dedupe, sort, order-independence. |
| Champions data integrity | `pokemon_usage`, `tournament_teams`, `items`, `abilities` | **Yes** (smoke + validate_data) | 5 + 7 checks, runs in cron + on demand. |
| FastAPI routers | `api/app/routers/*.py` | **No** | No route-level tests. Most have inline `Depends(get_current_user)` and Supabase calls; would need TestClient + mocked DB. |
| Pydantic validators | `api/app/validators.py` | **No** | `validate_nature`, `validate_stat_points`, `validate_champions_pokemon_batch` — pure Python, easy to add. |
| AI quota / cost tracking | `api/app/ai_quota.py` | **No** | Money-on-the-line code path. |
| Auth (`api/app/auth.py`) | ES256 + HS256 JWT verify | **No** | No tests. |
| Showdown parser | `api/app/services/showdown_parser.py` | **No** | Round-trip parse/export untested. |
| Damage calc HTTP wrapper | `api/app/routers/calc.py` | **No** | `_final_stat`, nature math — only the underlying `damage_calc` is tested. |
| Ingest scripts | `api/scripts/ingest/*.py` | **Partial** | Validated by smoke_test on actual ingested rows; no unit coverage of parsing. |
| Web — any component | `web/src/**` | **No** | Zero tests. `pnpm lint` + `tsc --noEmit` are the only safety net. |
| Web — `friendlyError` | `web/src/lib/errors.ts` | **No** | Pure function, ideal first vitest target. |
| Web — `apiFetch` / `cachedFetch` | `web/src/lib/api.ts` | **No** | Cache TTL / SSR-vs-browser branching untested. |
| Web — sprite helpers | `web/src/lib/sprites.ts` | **No** | Trivial, low priority. |

## Test Types

**Unit Tests:**
- Scope: pure deterministic functions only — type chart, stat conversion, damage rolls, cache key normalization.
- Approach: `unittest` for `damage_calc`, hand-rolled `_check` script for `cache_utils`.
- Files: `api/scripts/test_damage_calc.py`, `api/scripts/test_cache_utils.py`.

**Integration Tests:**
- Scope: data integrity against live Supabase DB.
- Approach: query the real `pokemon`, `pokemon_usage`, `items`, `abilities`, `tournament_teams`, `meta_snapshots`, `cron_runs` tables; assert relationships and Champions-legality.
- Files: `api/scripts/smoke_test.py`, `api/scripts/validate_data.py`, `api/scripts/validate_champions_sources.py`, `api/scripts/scan_movepool_gaps.py`.

**E2E Tests:**
- Not used. No Playwright, Cypress, or Puppeteer.

## Common Patterns

**Async Testing:**
- Not applicable — no async tests. All current tests are synchronous. The FastAPI app is sync (`def`, not `async def`) end-to-end except the rate-limit handler and CORS middleware.

**Error Testing:**
- The damage_calc tests assert on derived flags (`result["is_guaranteed_ohko"]`, `result["skipped_reason"]`) rather than raising/asserting exceptions.
- Validators raise `HTTPException` directly — they're untested but would be tested via `with self.assertRaises(HTTPException) as ctx:` and inspecting `ctx.exception.status_code` / `ctx.exception.detail` if added.

## CI and Gating

**`.github/workflows/ci.yml` (runs on `main` push and PRs to `main`):**
- `api-checks` job (working dir `api/`, Ubuntu, `astral-sh/setup-uv@v6`):
  - `uv sync --extra dev`
  - `uv run ruff check app/ scripts/`
  - `uv run ruff format --check app/ scripts/`
  - `uv run pyright app/ scripts/`
- `web-checks` job (working dir `web/`, Ubuntu, pnpm 10, Node 22):
  - `pnpm install --frozen-lockfile`
  - `pnpm lint` (ESLint flat config)
  - `pnpm exec tsc --noEmit`

**No tests are run in CI.** No `python -m scripts.test_damage_calc` invocation. No web build (just lint + typecheck). Merges are gated only on lint and type-check passing.

**`.github/workflows/data_ingestion.yml`** (Sunday 02:00 UTC + manual `workflow_dispatch`):
- Runs `scripts.ingest.smogon_meta` and `scripts.ingest.limitless_teams` against production Supabase (uses `secrets.SUPABASE_URL` + `secrets.SUPABASE_SERVICE_KEY`).
- This is data refresh, not testing — but a failure here is the only signal that the ingest is broken outside of manual smoke runs.

**Vercel Cron (`vercel.json` lines 12-15):**
- `0 8 * * *` — `/api/admin/cron/daily` (Limitless tournament teams).
- `0 6 * * 1` — `/api/admin/cron/weekly` (Smogon + Pikalytics + validate_data, including the weekly Mon 09:30 UTC `--fix` mode noted in `CLAUDE.md`).
- Cron failures persist a `cron_runs` row with status `fail` and bubble HTTPException(500); Vercel's invocation list shows red on 500s, so silent failures are no longer possible (`api/app/routers/admin_cron.py:13-19`).

## Summary

This codebase has **two real unit-test files** (~250 lines combined) and **four integration/health scripts** that probe the live DB. There is no test framework installed for the web side. The intentional bet is: lint + strict TypeScript + Pydantic + the deterministic damage_calc unit tests + nightly data-integrity probes catch enough regressions for an 8-week solo MVP, while leaving room to add `pytest` and `vitest` post-MVP.

**Highest-leverage next tests to add (when test infra lands):**
1. `vitest` — `web/src/lib/errors.ts` `friendlyError()` matrix (pure function, drives every UI error message).
2. `pytest` — `api/app/validators.py` (`validate_nature`, `validate_stat_points`) — pure Python, no DB.
3. `pytest` — `api/app/auth.py` JWT verification with seeded ES256/HS256 tokens.
4. `pytest` + `httpx.MockTransport` — ingest scripts (`api/scripts/ingest/*.py`) parsing logic against fixtured response payloads.
5. `vitest` — `web/src/lib/api.ts` cache TTL behaviour and SSR vs browser URL resolution.
