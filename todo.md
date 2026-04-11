# TODO - Active Tasks

## In Progress

### Week 1 Remaining (Phase 0)
- [x] Run 001_initial_schema.sql against Supabase project (local via supabase start)
- [x] Configure .env files with real Supabase URL + service key (local keys)
- [x] Run `uv run python -m scripts.import_pokeapi` to populate reference data
- [x] Run `uv run python -m scripts.seed_champions`
- [x] Start API (`uv run uvicorn app.main:app --reload`) and verify endpoints
- [x] Start web (`pnpm dev`) and verify Pokemon search page with real data
- [ ] Push to GitHub remote

---

## Up Next (Phase 1 - Weeks 2-3)
- [ ] Set up Supabase Auth (email/password for single user) — deferred, using hardcoded dev user ID
- [x] user_pokemon CRUD endpoints (GET list, GET single, POST, PUT, DELETE)
- [x] Roster management UI (roster page, card, form modal, nav bar, status filters)
- [x] Teams CRUD endpoints (GET list, GET single, POST, PUT, DELETE with mega validation)
- [x] Team builder UI (slot picker from roster, format filter, clone, mega selector)
- [x] Type coverage analysis component (offensive + defensive, 18-type grid)

---

## Backlog
- [ ] Investigate Champions-specific movepool differences from PokeAPI
- [ ] Determine Champions item shop availability from Serebii
- [ ] Decide on open source license (MIT vs Apache 2.0)
- [ ] Set up Cloud Run deployment for API
- [ ] Set up Vercel deployment for web

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
- [x] Top nav bar (Pokedex + Roster + Teams)
- [x] Teams CRUD API endpoints (mega validation, format filtering)
- [x] Team builder UI: slot picker, mega selector, clone, format filters
- [x] Type coverage component (offensive + defensive analysis grid)
