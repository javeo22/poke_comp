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

### AI Team Cheatsheet -- IN PROGRESS
- [x] Backend endpoint: POST /cheatsheet/{team_id}
- [x] Pre-calculated data: roster with move categories (STAB/utility/priority), speed tiers with conditional abilities
- [x] AI generation: game plan, key rules, lead matchups vs meta, weaknesses
- [x] Caching: 7-day TTL in ai_analyses table, keyed by team composition
- [ ] Frontend: React component rendering the cheatsheet (Antigravity design)
- [ ] PDF export: downloadable version matching design/gengar-team-cheatsheet.html

### Other Stretch
- [ ] F3: Static reference pages (moves, items, abilities, type chart)
- [ ] F7: Damage calculator
- [ ] F8: Sprite display improvements
- [ ] Deploy to Cloud Run + Vercel
- [ ] Open source release (MIT or Apache 2.0)
- [ ] README with setup instructions
