# TODO - Active Tasks

## In Progress

### Phase 3 Remaining
- [ ] Draft helper <-> matchup log integration (save outcomes from draft)
- [ ] UI polish pass across all features
- [ ] Supabase Auth (deferred -- using hardcoded dev user ID)

---

## Up Next (Phase 4 - Week 8+)
- [ ] F3: Static reference pages (moves, items, abilities, type chart)
- [ ] Deploy to Cloud Run + Vercel
- [ ] Open source release (MIT or Apache 2.0)

---

## Backlog
- [ ] Decide on open source license (MIT vs Apache 2.0)
- [ ] Push to GitHub remote
- [ ] F7: Damage calculator
- [ ] F8: Sprite display improvements
- [ ] README with setup instructions

---

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
