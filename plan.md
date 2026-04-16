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
- [ ] UI polish pass across all features
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

#### Remaining Workstreams
- G: Data source ToS compliance (Game8 HIGH risk, Serebii MEDIUM)
- H: UX flow review (beginner/intermediate/pro user journeys)
- J: Custom AI strategy (phased: caching -> tiered models -> fine-tuning)

### Remaining
- [ ] F7: Damage calculator
- [ ] F8: Sprite display improvements
- [ ] Speed tier reference page
- [ ] Open source release (MIT or Apache 2.0)
- [ ] README with setup instructions
