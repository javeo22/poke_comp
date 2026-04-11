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

### Remaining
- [x] Run migration against Supabase instance (local via supabase start, 2026-04-10)
- [x] Run PokeAPI import script, verify data (1025 Pokemon, 919 moves, 307 abilities, 15 regional forms)
- [x] Run Champions seed script with real roster data (186 roster, 59 megas, 117 items, 3 meta snapshots)
- [x] Test full stack: API -> frontend with real data
- [x] Environment variables configured for both apps (local Supabase keys)

---

## Phase 1: Personal Data (Weeks 2-3 - April 17-30)
**Goal:** Input and manage real teams.

### F1: Personal Roster Manager
- [x] user_pokemon CRUD endpoints (POST, GET list, GET single, PUT, DELETE)
- [x] Roster management UI: add/edit/delete owned Pokemon
- [x] Filter by build status (built/training/wishlist)
- [x] Build status tracking (built/training/wishlist)
- [x] VP spent tracking per Pokemon
- [ ] Supabase auth integration (deferred — using hardcoded dev user ID)

### F2: Team Builder
- [x] Teams CRUD endpoints (GET list, GET single, POST, PUT, DELETE)
- [x] Pick 6 Pokemon from roster into team slots
- [x] Mega validation (one per team, must be team member)
- [x] Type coverage analysis (offensive + defensive, 18-type grid)
- [x] Save/clone teams with notes and archetype tags

---

## Phase 2: Meta & AI (Weeks 4-5 - May 1-14)
**Goal:** Meta awareness and AI-powered draft help.

### F4: Meta Tracker
- [ ] Meta snapshots CRUD endpoints
- [ ] Game8 tier list scraper (Claude API parsing)
- [ ] Tier list display UI (singles, doubles, megas)
- [ ] Top archetypes with example teams
- [ ] Weekly manual update workflow

### F5: AI Draft Helper
- [ ] Draft analysis endpoint (Claude API integration)
- [ ] Text input for opponent team (6 Pokemon)
- [ ] Select my team from saved teams
- [ ] Response: lead pair, back pair, turn 1 plan, threats
- [ ] Analysis caching (hash by composition, 24h TTL)

---

## Phase 3: Analytics & Polish (Weeks 6-7 - May 15-28)
**Goal:** Track results, refine AI, polish UX.

### F6: Matchup Log
- [ ] Match recording endpoints
- [ ] Match log UI: my team, opponent, leads, outcome, notes
- [ ] Filter by archetype, win/loss, opponent Pokemon
- [ ] Win rate analytics per archetype
- [ ] Integration with AI draft helper (save outcomes)

### Polish
- [ ] Refined AI prompts based on real usage data
- [ ] UI polish pass across all features
- [ ] Error handling and loading states
- [ ] Performance optimization

---

## Phase 4: Stretch & Release (Week 8+ - May 29+)
**Goal:** Stretch features, open source.

- [ ] F3: Static reference pages (moves, items, abilities, type chart)
- [ ] F7: Damage calculator
- [ ] F8: Sprite display improvements
- [ ] Deploy to Cloud Run + Vercel
- [ ] Open source release (MIT or Apache 2.0)
- [ ] README with setup instructions
