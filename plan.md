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
- [ ] Run migration against Supabase instance
- [ ] Run PokeAPI import script, verify data
- [ ] Run Champions seed script with real roster data
- [ ] Test full stack: API -> frontend with real data
- [ ] Environment variables configured for both apps

---

## Phase 1: Personal Data (Weeks 2-3 - April 17-30)
**Goal:** Input and manage real teams.

### F1: Personal Roster Manager
- [ ] user_pokemon CRUD endpoints (POST, PUT, DELETE)
- [ ] Roster management UI: add/edit/delete owned Pokemon
- [ ] Filter by type, role, tier, build status
- [ ] Build status tracking (built/training/wishlist)
- [ ] VP spent tracking per Pokemon
- [ ] Supabase auth integration

### F2: Team Builder
- [ ] Teams CRUD endpoints
- [ ] Drag-and-drop 6 Pokemon into team
- [ ] Mega validation (one per team)
- [ ] Type coverage analysis (offensive + defensive)
- [ ] Save/clone teams with notes and tags

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
