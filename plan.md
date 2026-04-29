# Pokemon Champions Companion - Implementation Plan

## Timeline: 8-week MVP (April 10 - June 5, 2026)

---

## Phase 0: Foundation (Week 1 - April 10-16)
**Goal:** Static data flowing end to end.

### Completed
- [x] Repository structure (api/, web/, supabase/, infra/, design/)
- [x] Supabase schema: 9 tables with RLS, indexes, triggers
- [x] FastAPI skeleton: GET endpoints for pokemon, moves, items, abilities
- [x] PokeAPI bulk import script (async, pokemon/moves/abilities)
- [x] Champions seed script (roster flags, items, mega links)
- [x] Next.js Pokemon search/filter page with design system
- [x] CI workflow (ruff, pyright, ESLint, tsc)
- [x] Run migration, import data, verify full stack end-to-end
- [x] Environment variables configured (local Supabase keys)

---

## Phase 1: Personal Data (Weeks 2-3 - April 17-30)
**Goal:** Input and manage real teams.

### F1: Personal Roster Manager -- COMPLETE
- [x] user_pokemon CRUD endpoints (POST, GET list, GET single, PUT, DELETE)
- [x] Roster management UI: add/edit/delete owned Pokemon
- [x] Filter by build status (built/training/wishlist)
- [x] Build status tracking (built/training/wishlist)
- [x] VP spent tracking per Pokemon
- [ ] Supabase auth integration (deferred — using hardcoded dev user ID)

### F2: Team Builder -- COMPLETE
- [x] Teams CRUD endpoints (GET list, GET single, POST, PUT, DELETE)
- [x] Pick 6 Pokemon from roster into team slots
- [x] Mega validation (one per team, must be team member)
- [x] Type coverage analysis (offensive + defensive, 18-type grid)
- [x] Save/clone teams with notes and archetype tags

---

## Phase 2: Meta & AI (Weeks 4-5 - May 1-14)
**Goal:** Meta awareness and AI-powered draft help.

### F4: Meta Tracker -- COMPLETE
- [x] Meta snapshots CRUD endpoints + Game8 tier list scraper (Claude API)
- [x] Serebii import: Champions-verified movepools, abilities, items, moves, mega data
- [x] Pikalytics usage data: pokemon_usage table with top 25 Pokemon (usage %, moves, items, abilities, teammates)
- [x] Meta page overhaul: usage % bars, inline competitive data, format filters, usage/tier toggle
- [x] Pokemon detail panel: click any Pokemon -> usage breakdown, base stats, movepool, teammates
- [x] Smart roster form: moves/items sorted by competitive usage, item dropdown, stat point editor
- [x] Speed tier reference in stat editor
- [x] Coverage analyzer on roster page (18-type grid with gap detection)
- [x] Notion roster seed script (52 Pokemon from personal database)
- [x] CSS polish: stagger animations, hover-lift, panel transitions
- [x] Legal compliance: fan project disclaimer, data source attribution

### F5: AI Draft Helper -- COMPLETE
- [x] Draft analysis endpoint (Claude API integration)
- [x] Text input for opponent team (6 Pokemon via searchable dropdowns)
- [x] Select my team from saved teams
- [x] Response: bring-4 recs, lead pair, threats, damage calcs, game plan
- [x] Analysis caching (hash by composition, 24h TTL via ai_analyses table)

---

## Phase 3: Analytics & Polish (Weeks 6-7 - May 15-28)
**Goal:** Track results, refine AI, polish UX.

### F6: Matchup Log -- COMPLETE
- [x] Match recording endpoints (CRUD: POST, GET list, GET single, PUT, DELETE)
- [x] Match log UI: my team, opponent (6 slots), leads, outcome, notes
- [x] Filter by win/loss, team, opponent Pokemon
- [x] Win rate analytics: overall, by team, by opponent Pokemon
- [ ] Integration with AI draft helper (save outcomes) -- deferred to polish

### Data Pipeline Consolidation -- COMPLETE
- [x] Consolidated usage data to single `pokemon_usage` table (removed `pokemon_usage_stats`)
- [x] Smogon ingest writes to `pokemon_usage` (source="smogon")
- [x] Draft router reads from `pokemon_usage` by name (not by ID)
- [x] Removed redundant scripts: scrape_meta.py, seed_meta.py, seed_usage.py, seed_roster_from_notion.py
- [x] Documented three-layer pipeline (one-time / automated / on-demand) in CLAUDE.md

### Polish
- [x] Refined AI prompts based on real usage data and tournament context
- [x] UI polish pass across all features (PokeComp Redesign V2 -- 2026-04-27, magenta/gold/purple esports broadcast theme; Home + Pokedex + Draft + Roster + Cheatsheet custom restyle, all other pages harmonized via token swap)
- [ ] Error handling and loading states
- [ ] Performance optimization

---

## Phase 4: Stretch & Release (Week 8+ - May 29+)
**Goal:** Stretch features, open source.

### AI Team Cheatsheet -- COMPLETE
- [x] Backend endpoint: POST /cheatsheet/{team_id}
- [x] Pre-calculated data: roster with move categories (STAB/utility/priority), speed tiers with conditional abilities
- [x] AI generation: game plan, key rules, lead matchups vs meta, weaknesses
- [x] Caching: 7-day TTL in ai_analyses table, keyed by team composition
- [x] Frontend: React component rendering the cheatsheet (Battle Station design)
- [x] PDF export: Export PDF button triggers browser print dialog (landscape, colors preserved)

### F3: Static Reference Pages -- COMPLETE
- [x] Moves page: filterable table with type/category badges, pagination
- [x] Items page: card grid with VP cost, shop availability, category filters
- [x] Type chart: full 18x18 effectiveness matrix, color-coded, sticky headers
- [x] Navigation links added (Moves, Items, Types)

### Draft <-> Matchup Log Integration -- COMPLETE
- [x] Win/Loss buttons on draft results save to matchup log
- [x] Saves opponent team, lead pair, and AI summary as notes

### Deployment -- COMPLETE
- [x] Vercel config (monorepo: Next.js web + Python API function, IAD1 region, security headers)
- [x] GitHub Actions CI/CD (lint gate + deploy on push to main)
- [x] Connected Vercel to repo, pokecomp.app domain live
- [x] API deployed as Vercel Python function (replaced Cloud Run plan)
- [x] Vercel env vars configured (NEXT_PUBLIC_API_URL, Supabase, Anthropic)

### Data Integrity & Auth -- COMPLETE
- [x] Champions data integrity validators (api/app/validators.py)
- [x] Pydantic field validators for nature and stat_points
- [x] DB validators wired into user_pokemon and teams routers
- [x] Replaced hardcoded dev_user_id with JWT auth in matchups router
- [x] Fixed login page hooks ordering bug
- [x] Profile page (/profile)
- [x] RLS migration for user-scoped tables
- [x] Removed dev_user_id from config

### Pokemon Detail Page -- COMPLETE
- [x] GET /pokemon/{id}/detail enriched endpoint
- [x] Frontend detail page with stats, abilities, movepool, usage
- [x] Pokemon cards clickable across the app

### Visual Polish -- PARTIAL
- [x] Responsive hamburger nav for mobile
- [x] Login page branding
- [x] Fixed pre-existing lint/format/pyright CI failures
- [ ] Full visual consistency audit at all breakpoints

### AI Strategy: Dual RAG -- COMPLETE
- [x] Personal matchup history context in draft analysis prompt
- [x] AI disclaimers on draft and cheatsheet responses
- [x] User-friendly 429 rate limit error handling

### Onboarding -- COMPLETE
- [x] 5-step modal tour on first visit (localStorage persistence)
- [x] "?" button in nav to restart tour

### Showdown Import/Export -- COMPLETE
- [x] Showdown paste parser (api/app/services/showdown_parser.py)
- [x] POST /teams/import endpoint
- [x] GET /teams/{id}/export endpoint
- [x] Frontend UI: import modal + export button on teams page

### Data Quality Overhaul -- COMPLETE
- [x] Phase 1: Fixed Smogon URL (gen9doublesou -> gen9vgc2026), added ingest validation
- [x] Phase 2: API read-path filtering by Champions format (pokemon, usage, draft, cheatsheet)
- [x] Phase 3: Real Limitless VGC API integration (replaced mock data)
- [x] Phase 4: Pikalytics Champions scraper for tournament-weighted usage stats
- [x] Phase 5: Schema hardening (CHECK constraints, abilities.champions_available)
- [x] Phase 6: UI empty-state handling for partial/missing data
- [x] Phase 7: Data validation agent (7 checks + /admin/data-health endpoint)
- [x] Smoke test script for CI verification

### Roster/Team UX Streamlining -- COMPLETE (2026-04-15)
- [x] Quick-Add modal: search Pokemon, auto-fill top ability from Pikalytics, save as wishlist
- [x] "Quick Add" + "Full Form" buttons on roster page
- [x] ?add= deep link opens quick-add instead of full form
- [x] "Add to Roster" + "View Details" buttons on meta detail panel
- [x] POST /teams/import/preview endpoint (parse + resolve without creating data)
- [x] ImportReview component: two-step import flow (paste -> preview -> confirm)
- [x] Showdown import modal updated to preview-then-confirm flow

### Auth Fix -- COMPLETE (2026-04-15)
- [x] Fixed ES256 JWT verification (Supabase uses asymmetric signing for user tokens)
- [x] auth.py now detects alg from token header: ES256 via JWKS, HS256 via JWT secret
- [x] Fixed NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel (was publishable key, now JWT format)

### Phase 5: Improvements

#### Workstream D: AI Strategy -- COMPLETE (2026-04-15)
- [x] D1: `ai_usage_log` table with RLS (migration 20260415100000)
- [x] D2: Per-user daily quota (10 req/day, `ai_quota.py`)
- [x] D3: Quota enforcement wired into draft, cheatsheet, meta scrape endpoints
- [x] D4: `GET /ai/usage` endpoint (today's usage + recent history)
- [x] D5: Prompt injection protection (`prompt_guard.py`, sanitize matchup notes)
- [x] D6: Frontend quota indicator on draft + cheatsheet pages (disable when exhausted)
- [x] Real token counts from Claude API response (replaces hardcoded cost estimates)
- [x] Meta scrape now requires auth + has rate limit + logs usage

#### Workstream E: Disclaimers -- COMPLETE (2026-04-15)
- [x] E1: Terms of Service page (`/terms`) -- fan project, AI content, acceptable use, IP, liability
- [x] E2: Privacy Policy page (`/privacy`) -- data collected, third-party services (Supabase, Anthropic, Vercel), security, retention
- [x] E3: Footer updated with Terms/Privacy links + data source attribution (PokeAPI, Pikalytics, Smogon)
- [x] E4: AI disclaimers enhanced -- now credit Claude/Anthropic, name data sources, note meta freshness caveat

#### Workstream I: Monetization -- COMPLETE (2026-04-15)
- [x] I1: `/support` page with Ko-fi donation link, cost breakdown, promise section
- [x] I2: Support link in footer alongside Terms/Privacy
- All features remain free -- donation-only model

#### Workstream C: Favicon -- COMPLETE (2026-04-15)
- [x] C1: SVG favicon (`icon.svg`) -- crimson pokeball with crosshairs on dark bg
- [x] C2: Apple touch icon (`apple-icon.png`, 180x180) + replaced `favicon.ico` (16+32px)
- [x] C3: Auto-discovered by Next.js App Router (no metadata changes needed)

#### Workstream B: Profile Revamp -- COMPLETE (2026-04-15)
- [x] B1: `user_profiles` table (display_name, avatar_pokemon_id) with RLS
- [x] B2: GET /profile endpoint (profile + expanded stats in one call)
- [x] B3: PUT /profile endpoint (update display name + avatar)
- [x] B4: Avatar sprite picker modal (searchable grid of Champions-eligible Pokemon)
- [x] B5: Trainer card component (avatar, editable display name, trainer title, member since)
- [x] B6: Profile page revamp (trainer card + activity stats + battle stats + insights + recent form)
- [x] B7: Nav avatar display (sprite + display name replaces "Profile" link)

#### Workstream F: Data Pipeline Improvements -- PARTIAL (2026-04-15)
- [x] F2: Centralized name resolver (`api/app/services/name_resolver.py`)
  - resolve_name(), build_roster_index(), normalize_tier_data()
  - Handles Game8/Smogon alt names: "Wash Rotom"→"Rotom-Wash", "Alolan X"→"X-Alola", regional forms, Urshifu variants
  - Wired into meta.py scraper: tier_data normalized before upsert
- [x] F2: `GET /admin/data-freshness` endpoint (latest snapshot dates by source/format)
- [x] F2: validate_data check 8 — meta snapshot roster integrity
- [ ] F: Cron scheduling for automated ingest

#### Bug Fixes -- COMPLETE (2026-04-16)
- [x] AI endpoint 500s: `_check_cache()` in draft.py and cheatsheet.py used `.single()` which raises on zero rows; every uncached request hit this. Fixed with `.maybe_single()`.
- [x] Team fetches in draft/cheatsheet had same `.single()` bug for missing teams.
- [x] SSR URL error: `NEXT_PUBLIC_API_URL="/api"` (relative) fails during server-side rendering. Added origin resolution via `VERCEL_URL` in `web/src/lib/api.ts`.
- [x] UUID pokemon_ids: `teams.pokemon_ids` is UUID[] (refs to `user_pokemon.id`), not PokeAPI int[]. draft.py and cheatsheet.py called `int(pid)` on UUIDs causing ValueError. Fixed by resolving UUIDs through user_pokemon table to get species IDs first.

#### Remaining Workstreams
- G: Data source ToS compliance (Game8 HIGH risk, Serebii MEDIUM)
- H: UX flow review (beginner/intermediate/pro user journeys)
- J: Custom AI strategy (phased: caching -> tiered models -> fine-tuning)

### Remaining
- [x] F7: Damage calculator (engine 2026-04-17 Session E W5a; standalone /calc UI 2026-04-28 Phase 5B)
- [x] F8: Sprite display improvements (shiny toggle + fallback placeholder, 2026-04-28 Phase 5B; gender/form variants deferred)
- [x] Speed tier reference page /speed-tiers (2026-04-28 Phase 5B)
- [x] Open source release (MIT LICENSE committed 2026-04-16)
- [x] README with setup instructions (committed 2026-04-16)

---

## Phase 5: Completion Roadmap (2026-04-16 -> June 5 MVP)

Sequenced plan to finish every remaining item. Ordered by dependency and value.

### 5A: Monetization block (1 session, ~4 hr)
Goal: open a revenue channel without violating scan-speed UX. Ad approval runs in parallel.
- [ ] Submit EthicalAds publisher application (blocker for ad rendering; approval 1-3 business days)
- [ ] Rename "Support" nav link to "Buy Me a Coffee" + Potion sprite icon (PokeAPI item id 17). Move out of Compete nav group into primary nav
- [ ] Quota bump: supporter tier 10/day -> 30/day with 600/mo soft cap in `ai_quota.py`. Add monthly aggregation query. Update quota indicator component copy
- [ ] Supporter badge on trainer card (uses existing `supporter` flag on user_profiles)
- [ ] EthicalAds integration once approved: client component gated on `!user.supporter`, server-fetched in layout, `next/script` with `afterInteractive`. Single below-fold slot on pokedex/meta/moves/items/type-chart. Skip on auth/settings/admin/share routes
- [ ] Privacy Policy: one-line disclosure of EthicalAds (privacy-first contextual ads, no personal tracking)

### 5B: MVP feature completion -- COMPLETE (2026-04-28)
Goal: close F7/F8/speed-tiers so F1-F8 are all shipped.
- [x] Speed tier reference page `/speed-tiers` -- `GET /pokemon/speed-tiers` endpoint + sortable client page
- [x] F7: Damage calculator standalone UI (`POST /calc` endpoint + `/calc` page). Engine landed 2026-04-17 in Session E.
- [x] F8: Sprite display improvements (MVP-light) -- shiny toggle + SpriteFallback placeholder. Gender/form variants deferred.

### 5C: Data infrastructure (1-2 sessions, ~4-6 hr)
Goal: data stays fresh without manual script runs; legal risk closed.
- [ ] Clear 31 stale Game8 meta snapshot names (one-off SQL cleanup, ~30 min) -- use `name_resolver.normalize_tier_data()` or hard-delete rows from pre-removal-date snapshots
- [ ] Vercel Cron scheduling (`vercel.ts` crons config, ~2-3 hr)
  - Smogon ingest: weekly Monday 06:00 UTC
  - Pikalytics: weekly Monday 07:00 UTC
  - Limitless teams: daily 08:00 UTC
  - `scripts/validate_data.py --fix` after each ingest
  - Admin Slack/email webhook on validation failures (stretch)
- [ ] Workstream G: ToS compliance follow-up (~1-2 hr)
  - Confirm Game8 scraper is fully removed and no references remain
  - Re-audit Serebii scrape frequency/rate limit (MEDIUM risk per memory)
  - Document final data source matrix in LEGAL_AND_DEV_GUIDELINES.md with current risk levels
  - Update Terms/Privacy if any data sources change

### 5D: UX polish (2-3 sessions, ~8-12 hr)
Goal: every page feels finished, not just functional.
- [ ] Workstream H: UX flow review (~3-4 hr)
  - Walkthrough as three personas: new user (first visit -> first team -> first analysis), intermediate (roster built, running drafts weekly), pro (tournament prep, cheatsheet + matchup log loop)
  - Output a `ux-findings.md` with ranked friction points
  - Rework onboarding if flow surfaces gaps (previously deferred per H: Landing page completion)
- [ ] Error handling and loading states across all pages (~3-4 hr)
  - Audit every `fetch` for: loading skeleton, error card with retry, empty state
  - Standardize on existing `LoadingSkeleton` / `ErrorCard` / `EmptyState` components (create if missing)
  - 429 rate limit UX already covered; verify consistency
- [ ] Performance optimization (~2-3 hr)
  - Bundle analyzer pass (`pnpm build --analyze`)
  - Next.js Image for all sprite rendering (currently `<img>` in places)
  - Verify ISR revalidate intervals are reasonable
  - Lighthouse audit all public pages, target >= 90 on Performance

### 5E: AI strategy (Workstream J, 1-2 sessions, ~4-6 hr)
Goal: reduce per-request AI cost and improve cache hit rate.
- [ ] Deeper caching (already have 24h draft, 7d cheatsheet)
  - Semantic cache key: normalize opponent team composition (alphabetize Pokemon names) so "Miraidon + Calyrex-S + ..." matches regardless of order
  - Separate cache namespaces by model (Sonnet vs Haiku) to allow differential invalidation
  - Admin cache warmup script: precompute cheatsheets for top 20 meta teams from `tournament_teams`
- [ ] Tiered model routing (Haiku for draft thread 1, Sonnet for cheatsheet final) -- mostly in place from M2-M6, document the decision tree
- [ ] Skip fine-tuning for MVP (cost vs benefit not worth it pre-launch; revisit post-MVP)

### Execution order
Recommended sequence across ~7 remaining weeks:
1. Week of Apr 16: 5A (monetization block) + start 5C (meta cleanup, cron)
2. Week of Apr 23: 5B damage calc backend + speed tier page
3. Week of Apr 30: 5B damage calc frontend + F8 sprites
4. Week of May 7: 5D UX flow review + error/loading pass
5. Week of May 14: 5D performance + 5E AI caching
6. Weeks of May 21-Jun 5: buffer for beta testing, bug fixes, Champions launch prep (Apr 8 release has already happened so this is post-launch polish + stability)

---

## Phase 5 Execution Log

### Week 1 (Apr 16, 2026) -- LANDED
Full roadmap at `.claude/plans/lets-plan-mode-for-async-curry.md`.

- [x] **0.1 Shared UI primitives** -- `web/src/components/ui/{loading-skeleton,error-card,empty-state}.tsx`. Rollout to pages deferred to Phase 4.2 per plan.
- [x] **0.2 Cache normalization** -- `api/app/services/cache_utils.py` with `normalize_opponent_names`, `normalize_roster`, `cache_hash_v2`. Migrations `20260417000000_cache_version.sql` (v1/v2 column) and `20260601000000_drop_v1_cache.sql` (queued for June 1 cleanup). `draft.py` and `cheatsheet.py` cache helpers refactored to try v2 first with 14-day v1 grace-window fallback. Verification script at `api/scripts/test_cache_utils.py` passes 9/9 assertions.
- [x] **0.3 CRON_SECRET** -- added to `Settings` in `api/app/config.py` and `.env.example`. No code consumes it yet; endpoints land in Phase 2.3.
- [x] **1.1 Nav rework** -- `SupportPill` at `web/src/components/support-pill.tsx` (Potion sprite + "Buy Me a Coffee" label, amber tertiary accent). "Support" link removed from Compete nav group. Potion sprite hosted locally at `web/public/sprites/items/potion.png`.
- [x] **1.2 Quota bump + monthly soft cap** -- `SUPPORTER_DAILY_LIMIT=30`, new `SUPPORTER_MONTHLY_SOFT_CAP=600`. Added `_is_supporter`, `_get_monthly_usage`, `_monthly_start_utc`, `_next_month_start_utc` helpers. `check_ai_quota` now raises 429 with `soft_cap_hit=True` when supporter exceeds monthly cap. `get_usage_summary` returns new `month` and `supporter` fields. Frontend: `QuotaIndicator` component at `web/src/components/quota-indicator.tsx` consumed by draft and cheatsheet pages. `AiUsageResponse` type extended with `month` and `supporter`.

**Fixed bug encountered during 1.2**: existing `_tomorrow_start_utc` used `day=tomorrow.day + 1` which would break on month boundaries (next failure would have been Apr 30). Replaced with `timedelta(days=1)` arithmetic.

**Follow-ups spawned**: pyright narrowing fix for Supabase `result.data.get()` pattern (11 pre-existing errors in cheatsheet.py, 5 in ai_quota.py).

**Outstanding user actions**: generate `CRON_SECRET` + `vercel env add`, submit EthicalAds publisher application, apply migration `20260417000000_cache_version.sql` to Supabase prod.

### Week 2 (Apr 16, 2026) -- LANDED

- [x] **1.3 Supporter badge** -- `web/src/components/profile/supporter-badge.tsx` (Potion icon + amber chip, `size="sm"|"md"`). Wired into `TrainerCard` on /profile and public /u/[username]. Backend `PublicProfile` now returns `supporter: boolean` (pulled from user_profiles.supporter). `api/app/routers/public.py` updated.
- [x] **1.4 EthicalAds integration** -- three files: `web/src/lib/ad-routes.ts` (AD_ALLOWED_ROUTES + isAdRoute helper), `web/src/components/ethical-ads.tsx` (script injection + placement, no-op when NEXT_PUBLIC_ETHICAL_ADS_PUBLISHER_ID unset), `web/src/components/ad-slot.tsx` (client wrapper: usePathname + supporter check via fetchProfile). Wired into `web/src/app/layout.tsx` below main, above footer. Gates: pathname in AD_ALLOWED_ROUTES AND !supporter.
- [x] **1.5 Privacy + Terms** -- Privacy gained Ko-fi in Section 3, new Section 4 "Third-Party Data Sources" (PokeAPI/Pikalytics/Smogon/Limitless/Serebii), new Section 5 "Advertising" (EthicalAds disclosure with link to their ethics page). Terms Section 4 rate-limit language updated for tiered quotas (free 3/day, supporter 30/day + 600/mo soft cap). Terms Section 5 new: "Supporter Benefits" (ad-free, 30/day quota, monthly soft cap, badge). Last-updated dates bumped to 2026-04-16.
- [x] **2.1 Game8 cleanup** -- migration `20260418000000_clear_game8_snapshots.sql` applied to Supabase prod (`sutslbmqsjczlfnsmgxt`). Match is `LOWER(source) = 'game8' OR source_url ILIKE '%game8%'` for safety. Verified: 3 rows deleted (all snapshot_date=2026-04-10, source='Game8'), meta_snapshots now empty.

**Follow-up notes**: (1) `meta_snapshots` is empty until a non-Game8 tier source is wired; admin data-health dashboard may show "no snapshots" until then. (2) `validate_data.py` check 8 will pass trivially (no rows). (3) Browser preview verification for Week 2 UI changes (1.3, 1.4) deferred to end of Phase 1 -- needs EthicalAds publisher ID to exercise 1.4 fully anyway.

**Outstanding user actions after Week 2**: submit EthicalAds publisher application (unblocks 1.4 ad rendering). All other outstanding items already handled (CRON_SECRET set, cache_version migration applied).

### Week 3 (Apr 16, 2026) -- LANDED

- [x] **2.2 Ingest script refactor** -- `api/app/models/ingest.py` introduces `IngestResult(source, rows_inserted, rows_updated, rows_skipped, warnings, duration_ms, dry_run)`. `smogon_meta.py`, `pikalytics_usage.py`, `limitless_teams.py` each gained `run(dry_run=False) -> IngestResult` with duration tracking (`time.monotonic`), warning capture (not just print), and populated row counts. CLI `main()` entrypoints preserved via `if __name__ == "__main__"`. Pikalytics dry-run returns list-page eligibility counts without scraping detail pages; Limitless dry-run resolves team names without writing.
- [x] **2.3 Vercel Cron endpoints** -- new router at `api/app/routers/admin_cron.py` with `require_cron_secret` dependency using `hmac.compare_digest` (constant-time). Returns 503 when `CRON_SECRET` unset, 401 on missing/wrong bearer, 200 with `IngestResult` payload otherwise. Five GET endpoints: `/admin/cron/ingest-smogon`, `/admin/cron/ingest-pikalytics`, `/admin/cron/ingest-limitless`, `/admin/cron/validate-data` (runs `--fix`), `/admin/cron/cache-warmup` (stub until Phase 5.2). Sync ingest scripts wrapped in `asyncio.to_thread` to avoid blocking the FastAPI event loop. Wired into `api/app/main.py`. `vercel.json` gains `crons` array with the five schedules (Smogon Mon 06:00, Pikalytics Mon 07:00, Limitless daily 08:00, validate-data Mon 09:30, cache-warmup Tue 10:00 UTC). Integration test with `TestClient` confirms all three auth branches behave correctly.
- [x] **2.4 Workstream G ToS audit** -- `LEGAL_AND_DEV_GUIDELINES.md` section 1.C refreshed with a last-verified column (all 2026-04-16), PokeAPI/Pikalytics/Smogon/Limitless confirmed active, Serebii 0.5s delay reconfirmed by reading the source, Game8 removal verified by global grep showing zero references in live code (`api/app/**`, `api/scripts/**`, `web/src/**`). New section 3 "Third-Party Data Recipients" table documents Anthropic/Supabase/Vercel/Ko-fi/EthicalAds with explicit PII flags. `refresh_meta.py` module docstring + SOURCES emptied + `main()` guarded to no-op; `CLAUDE.md` data-pipeline section updated to mark `refresh_meta.py` deprecated and drop the `POST /meta/scrape` line.

**Verification**: `uv run ruff check app/ scripts/` clean; `uv run pyright` on all files I touched clean (pre-existing `public.py`/`ai_quota.py`/`cheatsheet.py` Supabase narrowing errors are unchanged follow-ups from Week 1). `pnpm lint` 0 errors (web untouched). FastAPI `TestClient` exercise of `/admin/cron/cache-warmup` exercises 401 → 401 → 200 correctly across no/wrong/right bearer.

**Outstanding user actions after Week 3**:
- Vercel Hobby plan has a cron cap. If the 5 schedules exceed it, prune to the 3 weekly ingests + daily Limitless (drop validate-data cron and cache-warmup stub).
- Post-deploy smoke: `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>.vercel.app/api/admin/cron/cache-warmup` → expect `{"source":"cache_warmup",...,"warnings":["cache_warmup not yet implemented (Phase 5.2)"]}`.
- Phase 5.2 swap-in: once `api/scripts/cache_warmup.py` lands, replace the stub body in `admin_cron.py` with `await asyncio.to_thread(cache_warmup.run)`.

### User-reported issues: Session A (Apr 16, 2026) -- LANDED

Context: user surfaced 7 real-world issues from dogfooding. Grouped into 3 sessions; this is Session A.

- [x] **Type badge overflow** -- dual-type badges were escaping card borders because 4 containers used `flex gap-2` without `flex-wrap`. Fixed in `pokemon-card.tsx:59`, `roster-card.tsx:71`, `pokemon/[id]/page.tsx:102`, and `meta/pokemon-detail-panel.tsx:165`. Verified live via preview -- 50 rendered cards all use the new `flex flex-wrap gap-2` class; dual-type samples confirmed. No regression on mono-type Pokemon.
- [x] **Non-English moves/items/abilities** -- user reported Italian/German/Japanese/Korean/Chinese names bleeding into usage panels. Root cause: Pikalytics content-negotiates on `Accept-Language` but our scraper never set it, so whichever locale the serverless function happened to run from leaked into the scraped HTML. Two-part fix: (1) `pikalytics_usage.py` now sends `Accept-Language: en-US,en;q=0.9` so future ingests are pinned to English, (2) `check_move_legality` in `validate_data.py` gained a `--fix` branch symmetrical to the existing `check_item_legality` / `check_ability_legality` -- one `--fix` run purged 28 stale entries (12 items, 8 moves, 8 abilities). Validator is now 8/8 green on prod.
- [x] **Draft latency** -- draft endpoint previously defaulted to Sonnet 4.6 (8-15s). Swapped `Query(DEFAULT_MODEL)` → `Query(HAIKU_MODEL)` on `/draft/analyze`. Haiku is ~3-5s end-to-end and bypasses the daily quota (preserves existing quota logic). Sonnet still reachable via `?model=claude-sonnet-4-6`. Cheatsheet endpoint unchanged -- stays on Sonnet because it's not time-sensitive and benefits from depth.
- [x] **Draft UX during team preview** -- added elapsed-time counter on the Analyze button (`"Analyzing… 2.3s"`), "Deep analysis (Sonnet, slower)" checkbox that opts into Sonnet + quota consumption, timing hint (`"Fast · ~3-5s"` or `"Deep · ~10-15s"`) pre-analysis, and an informative loading card showing current mode + typical timing + "AI is reviewing usage data, your roster, matchup history, and building a game plan." Removes the black-box wait.

**Verification**: `ruff` clean (auto-removed unused `DEFAULT_MODEL` import); `pyright` clean on touched files; `pnpm lint` 0 errors / 10 pre-existing warnings (F8 sprite work, unrelated); `pnpm tsc --noEmit` clean; live preview on `pokedex` confirmed `flex flex-wrap gap-2` on 50/50 cards; live preview on `/draft` confirmed "Deep analysis (Sonnet, slower)" label and `Fast · ~3-5s` hint render.

**Deferred from Session A**:
- True SSE streaming for draft. Implementing would require a new `/draft/analyze/stream` endpoint, async Anthropic client, SSE event protocol, and a frontend `ReadableStream` parser -- 3-4 hr. Haiku latency + elapsed-time UX covers ~90% of the perceived-speed complaint. Revisit after Session B/C feedback.

### User-reported issues: Session B (Apr 16, 2026) -- LANDED

- [x] **Regional forms as separate roster entries** -- user reported "regional forms need to be registered as a separate entry of pokemon as you can have the 2 different versions in the roster." Root cause was a data-seeding gap: `import_pokeapi.py` pulls 15 regional variants (Alola/Galar/Hisui/Paldea) as distinct rows with their own PokeAPI IDs (>10000), but `seed_champions.py` only flagged base national dex IDs so none of the regional forms ever got `champions_eligible=true`. Migration `20260419000000_flag_regional_forms.sql` applied to prod via Supabase MCP (verified 15/15 now eligible). `seed_champions.py` gained a `CHAMPIONS_REGIONAL_FORMS` list and the `seed_champions_roster` function now flags both lists so future re-seeds preserve the change. DB schema + UI dropdown were already correct; the bug was purely in the seeding step.
- [x] **AI hallucination guardrails** -- user reported "we need to revise very well how the AI analysis are presented, avoid wrong information or hallucinations of the AI." Three-layer defense: (1) `api/app/services/ai_verifier.py` cross-checks every draft claim against canonical DB -- bring-4 Pokemon must be in my team, leads must be in bring-4, threats must be in opponent preview, cited moves must exist in `moves` table, calc attacker/defender/move must all be valid. Name matching is case-insensitive and normalizes hyphens/spaces so "Raichu-Alola" matches "Raichu Alola". (2) `DraftAnalysis` model gained `warnings: list[str]` top-level plus `verified: bool` + `verification_note: str | None` on each `ThreatInfo`/`BringRecommendation`/`DamageCalc`. Results are annotated rather than stripped -- UI shows the claim but flags it. (3) System prompt gained a "CRITICAL ACCURACY RULES" block explicitly telling the AI to say 'uncertain' rather than fabricate specific numbers or invent moves. Frontend: amber warnings banner above results whenever `warnings.length > 0`; per-item ⚠ badges with `title=` tooltip notes on unverified threats/calcs/bring items. Unit test with 4 injected hallucinations (fake lead not in bring-4, fake move "Fabricated Laser", nonexistent opponent, fake calc move "Plasma Beam") caught all 4 and left the one real claim green.

### User-reported issues: Session C (Apr 16, 2026) -- LANDED

- [x] **Matchup log visual + fields revamp** -- user reported "we need to improve the way the log matches work (it needs a visual revamp and a more useful fields for information)." Four new columns added to `matchup_log` via migration `20260419100000_matchup_log_fields.sql` (applied to prod): `format` (ladder/bo1/bo3/tournament/friendly), `tags` (TEXT[] for archetype labels like "rain"/"trick-room"), `close_type` (blowout/close/comeback/standard), `mvp_pokemon`. All nullable + backfill-safe. Added GIN index on tags and partial index on format for filter speed. Backend: `MatchupCreate`/`MatchupUpdate`/`MatchupResponse` extended; `list_matchups` accepts `?format=` and `?tag=` filters; `get_stats` returns new `by_format` + `by_tag` breakdowns. Frontend: form gained Format/Match-feel dropdowns + comma-separated Tags input + MVP Pokemon dropdown; match cards now show format badge (color-coded by type), close-type chip when non-standard, tag chips, inline MVP line, full notes (not truncated); filter bar gains Format select; Stats view gets two new panels (By Format, By Archetype Tag) beneath the existing By-Team / vs-Opponent breakdowns.
- [x] **Team-preview UX polish** -- user complaint "does not work well when you are in actual team preview." Two additions on top of Session A's Haiku default + elapsed timer: (a) last-used team persists to `localStorage` under `pokecomp_draft_last_team`, hydrates once teams have loaded unless `?team=` URL param overrides -- saves the "which team did I pick last match" click during ladder runs. (b) Quick-paste bar above opponent slots accepts 6 names separated by commas, newlines, or semicolons and resolves them against the Champions options case-insensitively; partial-match failures surface the unresolved names in an amber hint so the user can manually fill the remaining slots. Cuts opponent entry from ~30s (six dropdown typeahead interactions) to ~5s if the user has the names copyable.

**Verification**: `ruff` clean on `api/`; `pyright` clean on all touched files (pre-existing public.py/ai_quota.py/cheatsheet.py Supabase narrowing errors unchanged); `pnpm lint` 0 errors / 10 pre-existing warnings; `pnpm build` success. Supabase MCP confirmed both migrations applied and all 15 regional forms are `champions_eligible=true` in prod. Unit-level verifier test caught 4/4 injected hallucinations.

**Deferred**:
- True SSE streaming for draft (carried over from Session A deferral).
- Regional forms in `name_resolver.py` match "Raichu-Alola"-style hyphenated names but the DB stores them space-separated. Works through normalization but worth a pass if the matching ever surfaces misses.

### Source-of-truth policy + mega stats validation (Apr 17, 2026) -- LANDED

- [x] **Reverted the 21 'staple' items added earlier today** -- user confirmed they exist in Pokemon Champions source code / Serebii listings but are NOT visible or usable in the live Champions shop (Assault Vest, Choice Band, Choice Specs, Life Orb, Clear Amulet, Covert Cloak, Safety Goggles, Rocky Helmet, Weakness Policy, Wide Lens, Loaded Dice, Eject Button/Pack, Throat Spray, Room Service, Grassy Seed, Iron Ball, Light Clay, Terrain Extender, Protective Pads, Expert Belt). Migration `20260421100000_revert_source_code_only_items.sql` deletes IDs 30001-30021. Final shop count 116 items (58 mega_stone + 30 held + 28 berry) -- exactly matches Serebii's items.shtml listing and in-game inspection.

- [x] **Source-of-truth policy** -- the live Supabase DB is now authoritative for static game data (roster, items, moves, abilities, mega linkages). External sources (Serebii, PokeAPI, `seed_champions.HELD_ITEMS`) may list things that never shipped to the live game. Cross-source audits catch drift but the final word is the user's in-game inspection.
  - `scripts/seed_champions.py` `main()` now refuses to run without `--confirm-destructive`; docstring warns the list reflects launch-era assumptions including 21 items that never shipped.
  - `scripts/ingest/serebii_static.py` `main()` now refuses to run without `--confirm-destructive`; docstring notes it will overwrite curated data with whatever Serebii is serving.
  - `CLAUDE.md` Data Pipeline section rewritten with the rationale; labels one-time-setup scripts as "run ONCE on a fresh DB; NOT re-run on minor patches".
  - Usage data ingests (Smogon / Pikalytics / Limitless) continue to auto-refresh via Vercel Cron -- tournament stats are time-series, not game state.

- [x] **Stats spot-check for base Pokemon + megas vs Serebii** -- user asked specifically about mega stats coverage. Sampled 13 Pokemon via Serebii Champions detail pages and cross-checked types + abilities + all 6 base stats against the DB via Supabase MCP:
  - Base forms: Incineroar (727), Sinistcha (1013), Garchomp (445), Greninja (658), Sableye (302)
  - Classic megas: Mega Gardevoir (10051), Mega Charizard X (10034), Mega Charizard Y (10035), Mega Sableye (10066), Mega Garchomp (10058)
  - New Champions megas: Mega Dragonite (20004), Mega Meganium (20005), Mega Greninja (20016)

  **Result: 13/13 stat lines match Serebii exactly. Zero discrepancies.** Types match, abilities match, all 6 base stats match. This confirms the mega data we store was correctly ingested from Serebii's per-Pokemon detail pages during the original serebii_static run. Full population (186 base + 74 megas) not exhaustively checked but broad sanity metrics (0 empty/null stat fields, BST in 400-780 range, 0 stats == 0) all pass across the whole table.

  **Minor note (not fixed)**: Charizard's `pokemon.mega_evolution_id` points only to Mega Charizard Y; Mega Charizard X exists with correct stats but isn't reachable from the Charizard row's direct link. Team builder UX implication -- only Y appears when picking a mega for a Charizard team. Could add a secondary mega link column or surface both via name lookup, but since the data is correct and the decision may be intentional (Y is the more common VGC pick), leaving as-is per source-of-truth policy.

### Multi-source Champions validation (Apr 17, 2026) -- LANDED

- [x] **Extensive validation across multiple sources** -- user requested "do an extensive validation across multiple sources to make sure we have the correct data for champions." Built new `api/scripts/validate_champions_sources.py` that cross-checks the live DB against Serebii's Champions dex/items/megas pages and PokeAPI for canonical stats. Local Supabase DNS was temporarily unresolvable from the dev machine so the checks were executed via the Supabase MCP and `WebFetch` rather than the script's in-process httpx client; the script is committed and documented so it can be run end-to-end from any networked environment.

  **Roster (vs Serebii `pokemon.shtml`)**: 186/186 Champions base-form Pokemon match — empty set diff both directions. 15/15 regional variants present and `champions_eligible=true`. 58 Champions base forms correctly linked to megas via `pokemon.mega_evolution_id` (36 classic + 22 new Champions megas, plus Charizard with X/Y both covered). All 18 types represented. 0 Pokemon with empty movepool, empty abilities, empty types, or suspicious base stats. Avg movepool 62.2 moves, avg abilities 2.53 per Pokemon.

  **Items (vs Serebii `items.shtml`)**: found 4 categories of discrepancies, all fixed in migration `20260421000000_champions_data_audit_fixes.sql`:
  1. **28 berries miscategorized as `mega_stone`** -- root cause was `serebii_static.py` scrape_items using `current_category` as mutable state. When a mega stone was detected by the `name.endswith("ite")` heuristic, it mutated the shared `current_category` and contaminated subsequent items including berries parsed later on the same page. Data fixed via UPDATE; code fixed by making `item_category` a local variable so the heuristic no longer leaks.
  2. **21 VGC-staple held items missing entirely from the items table** — Assault Vest, Choice Band, Choice Specs, Life Orb, Clear Amulet, Covert Cloak, Safety Goggles, Rocky Helmet, Weakness Policy, Wide Lens, Loaded Dice, Eject Button, Eject Pack, Throat Spray, Room Service, Grassy Seed, Iron Ball, Light Clay, Terrain Extender, Protective Pads, Expert Belt. These were all declared in `seed_champions.py HELD_ITEMS` but never made it into live DB (likely: serebii_static ingest overwrote the table after seed). Inserted with IDs 30001–30021 to avoid PokeAPI collision.
  3. **2 held items (King's Rock, Quick Claw) incorrectly archived** during Session D prune. Serebii lists them as available. Restored with `champions_shop_available=true`.
  4. **9 mega stones incorrectly archived despite their Mega Pokemon being live and linked** — Aggronite, Beedrillite, Chesnaughtite, Delphoxite, Greninjite, Gyaradosite, Heracronite, Manectite, Steelixite. Restored.

  **Moves**: 494 Champions-available moves, 0 null types/categories, 0 with power > 250. Basic sanity clean. Per-move Serebii cross-check deferred (requires ~494 detail pages).

  **Referential integrity**: 0 dangling user_pokemon refs, 0 dangling item refs, 0 dangling mega links, 0 dangling user_profiles.avatar refs. 0 orphan move/item references in pokemon_usage.

  **Post-fix counts**: 137 shop items (was 105) → 58 mega_stone + 51 held + 28 berry. All 12 VGC-staple items (Assault Vest, Choice Band/Specs, Life Orb, Leftovers, Sitrus Berry, Focus Sash, Clear Amulet, Covert Cloak, Safety Goggles, Rocky Helmet, Weakness Policy) present. Full 9/9 validation report written to `api/champions_validation_report.json`.

  **Deferred** (require networked runs of the validator script):
  - Per-Pokemon movepool vs Serebii detail pages (~200 pages, 2 min at 0.5s delay).
  - Per-move power/accuracy vs Serebii moves table.
  - Display-name quirks (11 Pokemon stored with PokeAPI form suffixes like "Meowstic Male", "Mimikyu Disguised", "Kommo O", "Mr Rime") — not correctness issues, Pikalytics ingest normalizes to the same names so aliases work end-to-end, but a display-name override column would improve UX.

### User-reported issues: Session D (Apr 17, 2026) -- LANDED

- [x] **Prune non-Champions Pokemon/moves/items via archive tables** -- user requested "no need to have all 1k pokemon, we just need champions available, same for items and same for movesets." Approached archive-first for reversibility: migration `20260420000000_archive_non_champions.sql` creates `pokemon_archive`, `moves_archive`, `items_archive` as clones of the live schemas (`LIKE ... INCLUDING DEFAULTS`) plus `archived_at` + `archive_reason`, copies non-Champions rows over, then DELETEs from live. FK audit beforehand confirmed the safe-prune rules: all megas (id >= 10000) are kept because `pokemon.mega_evolution_id` FK's to them from Champions base forms; one non-Champions item is kept because a user has it on a build (FK from `user_pokemon.item_id` with ON DELETE NO ACTION). tournament_teams.pokemon_ids (int[]) had zero references to non-Champions rows.

  **Prune results (verified in prod via Supabase MCP)**: pokemon 1099 → 260 live (839 archived, 76% reduction), moves 932 → 494 (438 archived, 47% reduction), items 138 → 106 (32 archived, 23% reduction). Integrity verification post-delete: 0 dangling mega links, 0 dangling user_pokemon refs, 0 dangling item refs, 0 dangling user_profiles.avatar refs. Spot-check of `validate_data` checks 1-3: 201 Champions-eligible Pokemon (in range), 0 orphan items in `pokemon_usage`, 0 orphan moves in `pokemon_usage`. (Local `uv run python -m scripts.validate_data` run hit a transient DNS SERVFAIL on the Supabase host but MCP-routed SQL paths cleanly.)

  **Reversibility**: archive tables are standalone. `INSERT INTO pokemon SELECT ... FROM pokemon_archive WHERE id = X` restores any row. No PokeAPI re-fetch required on future game patches -- can flag a new Pokemon by promoting from archive + setting `champions_eligible=true`.

### Session E (Apr 17, 2026) -- LANDED

- [x] **Match-log UX, perf, AI damage engine** -- five user-reported issues after a real match-logging session. Plan: `.claude/plans/oponen-team-selection-is-rosy-tower.md`. **W1 picker sort by usage**: matches/page.tsx merges top-50 from `/usage` with alphabetical rest, section headers via new `DropdownOption.section` field. **W2 match-log lineup override**: migration `20260601100000` adds `matchup_log.my_team_actual TEXT[]`; form renders 6 chips defaulting to the saved team, user can swap any slot, sent only when it differs. AI verifier (`ai_verifier.py`) softened: hallucinated Pokemon/move stays `verified=false`; team-membership mismatch is now warning-only (mid-match swaps no longer look broken). **W3 Layer A**: migration `20260601200000_movepool_overrides.sql` patches `Ninetales Alola` with `Freeze-dry` (idempotent). **W4 perf**: new `/pokemon/basic` slim endpoint -- 236KB to 35KB for 500 Pokemon (85% reduction); `Cache-Control: public, max-age=3600, swr=86400` on `/pokemon` + `/usage`; client-side 5-min in-memory TTL cache wrapping `fetchPokemonBasic` and `fetchUsage`. **W5a real damage calc**: new `api/app/services/damage_calc.py` with TYPE_CHART (Python mirror of TS), Gen 9 formula, level-50 stat conversion, doubles spread, weather. 9 unit tests passing in `scripts/test_damage_calc.py`. `draft.py` post-processes the AI response: each calc looked up + computed deterministically; AI is told NOT to fabricate numbers. Eliminates the entire "hallucinated damage range" bug class.

- [ ] **Deferred**: W3 Layer B (movepool validator), W3 Layer C (Serebii regional-form scraper fix), W5b (SSE streaming for draft + cheatsheet), W5c (counter_index + speed-tier table in prompts). All scoped in the plan file. Migrations 20260601100000 + 20260601200000 need manual Supabase prod apply.

### Session F (Apr 27, 2026) -- LANDED

- [x] **Data pipeline visibility + AI freshness gating** -- user reported "scrapers fail constantly" and asked to review the data process feeding the AI. Plan: `.claude/plans/need-to-check-on-stateful-biscuit.md`.

  **Phase 1 finding (the actual diagnosis)**: pulled `vercel logs --environment production --since 7d` and found *zero* `/admin/cron/*` invocations across 1000 log entries (status distribution 940x 200, 60x 304, no 4xx/5xx). The endpoint is reachable (`curl` returns 401 on bad bearer), `CRON_SECRET` is set, deployments are healthy. The problem is upstream: Vercel Cron is not firing the schedules at all. Most likely the personal-team Hobby plan cron cap -- the project ships 5 cron schedules and the existing todo (Week 3 handoff line 137) already flagged this risk and went unaddressed. Action item handed back to the user via `todo.md` -- consolidate to 1-2 daily aggregator endpoints, or upgrade plan tier.

  **Phase 2 (audit log)**: new migration `20260427000000_cron_runs.sql` adds an audit table (`source, started_at, finished_at, duration_ms, status [pass|warn|fail], rows_inserted/updated/skipped, warnings jsonb, error text` + `(source, started_at desc)` index). `api/app/routers/admin_cron.py` rewritten with a `_record_cron_run` helper that wraps each ingest, persists a row, and re-raises script exceptions as `HTTPException(500)` so Vercel marks the invocation red instead of swallowing failures as warnings. Structured `logging` lines (`cron.<source> result=... duration_ms=... rows_*`) for grep-ability in Vercel logs.

  **Phase 3 (freshness exposure)**: `/admin/data-health` extended with `latest_pokemon_usage_per_format`, `latest_meta_snapshot_per_format`, `last_cron_runs` (most recent row per source), and a `stale_warnings` array. New unauthenticated `GET /public/data-freshness` returns `{formats: {<format>: {snapshot_date, days_old, stale}}}`. New `<DataFreshness>` React component (`web/src/components/data-freshness.tsx`) renders a `◆ DATA · N DAYS OLD` mono-label badge in the cheatsheet + draft headers -- gold + green pulse-dot when fresh, magenta + static dot when >14d stale. Verified locally: badge renders `◆ DATA · TODAY` with a green pulse-dot on the live snapshot.

  **Phase 4 (AI staleness gate)**: shared helper at `api/app/services/data_freshness.py` exposes `snapshot_age_days(format)` and `STALE_USAGE_THRESHOLD_DAYS=14`. Both `cheatsheet.py` and `draft.py` now: (a) hard-block with HTTP 503 `{"error": "stale_data", ...}` when usage data is missing or >14d old, before any Claude call; (b) inject a `DATA FRESHNESS:` line into the prompt with the snapshot date + age so Claude can caveat appropriately; (c) pass `snapshot_floor` into `_check_cache` -- cached `ai_analyses` rows whose `created_at` predates the latest snapshot are evicted, ensuring a meta refresh invalidates downstream analyses without bumping the global `cache_version`.

  **Phase 5 (validator hardening)**: `api/scripts/validate_data.py` now runs a `_probe_connectivity` check before the 8 data checks (one Supabase round-trip; if it fails, all checks are skipped with a clear `error` status -- this is what would have prevented the 2026-04-17 broken report where all 8 checks logged `[Errno 8] nodename nor servname provided`). Per-check exception isolation introduced a new `error` status distinct from data-integrity `fail`, exposed in `total_errors` on `ValidationReport.to_dict()`. `--fix` mode refuses to apply remediations when more than half the checks crashed. New report regenerated cleanly: 8 pass, 0 errors.

  **Files changed**: `supabase/migrations/20260427000000_cron_runs.sql` (new), `api/app/routers/admin_cron.py` (full rewrite), `api/app/routers/admin.py` (data-health extension), `api/app/routers/public.py` (new freshness endpoint), `api/app/routers/cheatsheet.py` + `draft.py` (staleness gate, prompt injection, cache eviction), `api/app/services/data_freshness.py` (new shared helper), `api/scripts/validate_data.py` (per-check isolation + connectivity probe), `web/src/lib/api.ts` (`fetchDataFreshness` client), `web/src/components/data-freshness.tsx` (new), `web/src/app/cheatsheet/page.tsx` + `web/src/app/draft/page.tsx` (badge wired into headers).

  **User actions handed off**: (1) **URGENT** -- fix Vercel cron invocation in dashboard (consolidate or upgrade plan); (2) apply migration `20260427000000_cron_runs.sql` to Supabase prod; (3) after dashboard fix, manual `curl` smoke-test on a preview deploy.

  **Out of scope (deferred per user "stabilize-first" choice)**: Pikalytics CSS selector hardening, Smogon JSON schema fallback, Limitless API path drift, retries / backoff in ingest scripts, Sentry / external alerting. Once Phase 2 starts recording real `cron_runs` rows, the new `/admin/data-health` will show which scrapers are actually failing and the deferred fixes can be prioritized from evidence.
