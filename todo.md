# TODO - Active Tasks

## In Progress

### Improvements Plan v2 (see .claude/plans/rippling-stargazing-codd.md)
- [x] D2: Per-user AI rate limiting + daily quotas + usage tracking
- [x] E2: Terms of Service and Privacy Policy pages
- [x] E2: Update disclaimers (footer attribution, AI disclaimers, copyright)
- [x] C1: Convert PokeballLogo to custom favicon (ico, svg, apple-icon)
- [x] I2: Support/donate page (Ko-fi)
- [x] B1: Avatar system (Pokemon sprite picker, display in nav/profile)
- [x] B2: Profile features (display name, trainer card, expanded stats)
- [x] F2: Centralized name resolver + data freshness API
- [ ] G3: Update LEGAL_AND_DEV_GUIDELINES.md with data source ToS research
- [ ] H: UX flow improvements (landing page, onboarding, beginner/pro paths)
- [ ] K: Cheatsheet UX Overhaul (DB persistence, collapsible, team indicator, PDF fix, shareable)
- [ ] L: Admin Panel (auth, dashboard, pokemon/moves/items manager, meta reviewer, legal QA)
- [ ] M: Cost Controls (aggressive caching, tiered quotas, cost dashboard, prompt optimization, Haiku fallback, sponsor slot)
- [ ] N: Analytics & SEO (Vercel Analytics, sitemap, OpenGraph, structured data, content SEO)
- [ ] O: Support Visibility (top nav link, contextual prompts, supporter badge)
- [ ] P: Strategy Content Ingestion (strategy_notes table, admin editor, wire into AI prompts)

### Visual Polish
- [ ] Full visual consistency audit (responsive testing at 375/768/1280px)

### Data Quality (found by validate_data.py run 2026-04-14)
- [ ] Item legality: 126 Pokemon in smogon usage have non-Champions items (Assault Vest, Safety Goggles etc.) -- items table only covers 138 items (Champions shop), Smogon pulls from broader held-item pool. Options: (a) expand items table with all valid Champions held items, (b) add legality pre-filter in smogon_meta.py ingest
- [ ] Ability legality: Vivillon "Compound Eyes" appears in usage data but isn't in abilities array -- check if Compound Eyes is actually legal in Champions or if it's a scraper artifact
- [ ] Roster integrity: 34 Pokemon in meta_snapshots tier_data not in champions_eligible (e.g. "Wash Rotom", "Alolan Ninetales") -- Game8 uses different name conventions (form names vs base names). Need name normalization or alias mapping in meta scraper

### Data
- [ ] Run Pikalytics ingest for full usage data (scripts/ingest/pikalytics_usage.py)

---

## Up Next
- [ ] Open source release (MIT or Apache 2.0)
- [ ] README with setup instructions
- [ ] Supabase Auth: enable email confirmation in dashboard, configure redirect URL

---

## Backlog
- [ ] Decide on open source license (MIT vs Apache 2.0)
- [ ] F7: Damage calculator
- [ ] F8: Sprite display improvements
- [ ] Speed tier reference page (/speed-tiers)

---

## Done (2026-04-16)
- [x] Fix: Ko-fi URL updated to real link (ko-fi.com/pokecompapp)
- [x] Fix: Draft team selector showed UUIDs instead of Pokemon names/sprites -- resolved through rosterLookup + pokemonMap
- [x] Fix: AI draft/cheatsheet 500 errors — `.single()` raised on cache miss, switched to `.maybe_single()` (PR #14)
- [x] Fix: SSR `TypeError: Failed to parse URL` — resolved relative `/api` URL to absolute during server rendering
- [x] Fix: Team fetch in draft/cheatsheet also used `.single()` which raised on missing teams
- [x] Fix: UUID pokemon_ids type mismatch — `teams.pokemon_ids` are UUID[] (user_pokemon refs), not PokeAPI int[]; draft/cheatsheet were calling `int(pid)` on UUIDs. Fixed by resolving through user_pokemon table first.
- [x] Fix: `.maybe_single().execute()` returns `None` (not APIResponse with data=None) — added `result is None` guard
- [x] Fix: Claude model ID `claude-sonnet-4-6-20250514` does not exist — corrected to `claude-sonnet-4-6` in draft, cheatsheet, meta routers

## Done (2026-04-15)
- [x] F2: Centralized name resolver (`api/app/services/name_resolver.py`) wired into meta scraper
- [x] F2: `GET /admin/data-freshness` endpoint (latest snapshot dates by source/format)
- [x] F2: Check 8 (meta snapshot roster integrity) added to validate_data.py

## Done (2026-04-15) - Previous
- [x] A1: Quick-Add mode for roster (search Pokemon, auto-fill ability from usage data, one-click save)
- [x] A2: Add to Roster buttons on Meta detail panel and Pokedex detail page
- [x] A3: Showdown import review step (preview parsed Pokemon before confirming import)
- [x] POST /teams/import/preview endpoint (parse without creating data)
- [x] Fix: ES256 JWT auth support (Supabase uses asymmetric tokens, not HS256)
- [x] Fix: NEXT_PUBLIC_SUPABASE_ANON_KEY corrected (publishable key -> JWT format)

## Done
- [x] Repository scaffold (api/, web/, supabase/, infra/, design/)
- [x] pyproject.toml + package.json configs
- [x] .gitignore, .env.example files
- [x] Supabase migration: 9 tables, RLS, indexes, triggers
- [x] FastAPI read endpoints: pokemon, moves, items, abilities (with filters + pagination)
- [x] PokeAPI import script (async bulk import)
- [x] Champions seed script (roster, moves, items)
- [x] Design system: Tactical Nostalgia palette in Tailwind CSS v4
- [x] Pokemon search/filter page (name, type, gen, Champions toggle)
- [x] CI workflow (ruff, pyright, ESLint, tsc)
- [x] Git remote configured (github.com/javeo22/poke_comp.git)
- [x] user_pokemon CRUD API endpoints (hardcoded dev user, auth-ready scoping)
- [x] Roster management UI: page, card, add/edit form modal, status filters
- [x] Top nav bar (Pokedex + Roster + Teams + Meta)
- [x] Teams CRUD API endpoints (mega validation, format filtering)
- [x] Team builder UI: slot picker, mega selector, clone, format filters
- [x] Type coverage component (offensive + defensive analysis grid)
- [x] F4: Meta Tracker -- CRUD endpoints, Game8 scraper (Claude API), tier list UI
- [x] Serebii import script -- Champions-verified movepools, abilities, items, moves, mega abilities
- [x] Fixed champions_eligible for regional forms + added missing items
- [x] Notion roster seed (52 Pokemon from personal Notion database)
- [x] Pikalytics usage data -- pokemon_usage table, API endpoint, 25 Pokemon seeded
- [x] Meta page overhaul -- usage % bars, inline moves/items/abilities, detail panel with competitive data
- [x] Smart roster form -- moves/items sorted by usage %, ability dropdown, item field, stat point editor
- [x] Speed tier reference in stat editor (outspeeds/outsped by meta Pokemon)
- [x] Coverage analyzer on roster page (18-type grid, gap highlighting)
- [x] CSS polish (stagger animations, hover-lift, panel slide-in)
- [x] Legal compliance (fan project disclaimer, data source attribution)
- [x] F5: AI Draft Helper -- POST /draft/analyze endpoint, /draft page with opponent input + team selector, bring-4/leads/threats/calcs/game plan, 24h cache
- [x] Automated multi-source ingestion pipelines (Smogon & Limitless APIs)
- [x] F6: Matchup Log -- CRUD endpoints, /matches page with log form, match cards, filters (outcome/team), stats view (overall/by team/by opponent Pokemon win rates)
- [x] Data pipeline consolidation -- single pokemon_usage table, removed redundant seed scripts, documented three-layer pipeline
- [x] AI Team Cheatsheet -- backend endpoint + frontend page + PDF export utility
- [x] Draft helper <-> matchup log integration (save Win/Loss from draft results)
- [x] F3: Static reference pages -- moves table, items cards, 18x18 type chart
- [x] Deployment configs -- Vercel, GitHub Actions CI/CD
- [x] Full deployment: Vercel (web + API as Python function), Supabase, pokecomp.app live
- [x] Champions data integrity validation layer (api/app/validators.py)
- [x] Pydantic field validators for nature (25 valid) and stat_points (0-252/510)
- [x] DB validators wired into user_pokemon and teams routers
- [x] Supabase Auth: replaced hardcoded dev_user_id with JWT in matchups router
- [x] Fixed login page React hooks ordering bug
- [x] Profile page (/profile) with account info and activity stats
- [x] RLS migration for user_pokemon, teams, matchup_log
- [x] Pokemon detail page (/pokemon/[id]) with movepool, abilities, usage, stats
- [x] Enriched GET /pokemon/{id}/detail endpoint (move details, ability descriptions)
- [x] Pokemon cards clickable (link to detail page)
- [x] Responsive hamburger nav for mobile
- [x] Login page branding (PokeComp logo + tagline)
- [x] Dual RAG: personal matchup history context in draft analysis prompt
- [x] AI disclaimers on draft and cheatsheet responses
- [x] User-friendly 429 rate limit error handling
- [x] Onboarding tour (5-step modal, localStorage persistence, ? button)
- [x] Showdown paste parser (api/app/services/showdown_parser.py)
- [x] POST /teams/import and GET /teams/{id}/export endpoints
- [x] Pre-existing CI lint/format/pyright errors fixed (auth.py, draft.py, teams.py, seed_auth_user.py)
- [x] Added pnpm-lock.yaml for CI cache resolution
- [x] Cheatsheet PDF export button (Export PDF button triggers browser print to PDF)
- [x] Showdown import modal on teams page (paste + team name + format, warnings display)
- [x] Showdown export button on team cards (downloads .txt file)
- [x] Data quality overhaul: Smogon URL fix (gen9vgc2026), ingest validation, API format filtering
- [x] Real Limitless VGC API integration (replaced mock data)
- [x] Pikalytics Champions scraper (scripts/ingest/pikalytics_usage.py)
- [x] Schema hardening: CHECK constraints, abilities.champions_available, tournament_teams dedup
- [x] UI empty-state handling for partial/missing usage data
- [x] Data validation agent (scripts/validate_data.py) with 7 checks + /admin/data-health endpoint
- [x] Smoke test script (scripts/smoke_test.py)
