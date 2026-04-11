# TODO - Active Tasks

## In Progress

### Week 1 Remaining (Phase 0)
- [ ] Run 001_initial_schema.sql against Supabase project
- [ ] Configure .env files with real Supabase URL + service key
- [ ] Run `uv run python -m scripts.import_pokeapi` to populate reference data
- [ ] Update Champions roster in seed_champions.py with actual game data
- [ ] Run `uv run python -m scripts.seed_champions`
- [ ] Start API (`uv run uvicorn app.main:app --reload`) and verify endpoints
- [ ] Start web (`pnpm dev`) and verify Pokemon search page with real data
- [ ] Push to GitHub remote

---

## Up Next (Phase 1 - Weeks 2-3)
- [ ] Set up Supabase Auth (email/password for single user)
- [ ] user_pokemon CRUD endpoints
- [ ] Roster management UI
- [ ] Teams CRUD endpoints
- [ ] Team builder UI with drag-and-drop
- [ ] Type coverage analysis component

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
