# TODO - Active Tasks

## Done (2026-04-28) - Phase 5D Wave 2: error/loading polish on user-scoped pages

Plan: `.claude/plans/phase-5d-ux-polish.md`. Workstream A Wave 2 of 3.

- [x] **6 user-scoped pages converted** to use `<LoadingSkeleton>` / `<ErrorCard>` / `<EmptyState>` primitives. Each page now: shows a typed skeleton during initial fetch, surfaces a retry-able ErrorCard on failure (piped through `friendlyError()`), and renders an EmptyState with helpful copy + an action when results are empty.
  - `web/src/app/roster/page.tsx` -- skeleton + retry-able error + EmptyState differentiated by "no roster yet" vs "no Pokemon match this status filter". Empty state has an "Add Pokemon" action when there is no filter.
  - `web/src/app/teams/page.tsx` -- same pattern; empty state has a contextual action ("Go to Roster" if roster is empty, "New Team" otherwise).
  - `web/src/app/matches/page.tsx` -- list-variant skeleton; empty state has "Log Your First Match" action.
  - `web/src/app/profile/page.tsx` -- detail-variant skeleton; new error path with retry that previously silently swallowed errors. Loader extracted to `loadProfile()` helper for retry support.
  - `web/src/app/u/[username]/page.tsx` -- detail skeleton; ErrorCard for trainer-not-found; EmptyState for "no shared cheatsheets yet".
  - `web/src/app/pokemon/[id]/page.tsx` -- replaced inline `DetailSkeleton` helper (now deleted) with `<LoadingSkeleton variant="detail">`; replaced inline error box with `<ErrorCard>`. Error mapping now goes through `friendlyError()` instead of bespoke 404/5xx string switching.
- [x] **Verification**: `pnpm tsc --noEmit` clean, `pnpm lint` 0 errors / 6 pre-existing warnings (unchanged from Wave 1), `pnpm build` succeeds. Live preview: `/pokemon/727` hydrates with Incineroar h1 + 77-row movepool + shiny toggle button intact; `/u/nonexistent_user_zzz` shows ErrorCard with "Trainer not found / No trainer with username \"nonexistent_user_zzz\" exists." and a working Browse Pokedex button. All 5 other Wave 2 routes return 200 in dev preview.

Wave 3 (heavy state machines: draft/cheatsheet/admin) is the remaining workstream-A task; sequenced for the next session.

## Done (2026-04-28) - Phase 5D Wave 1: error/loading polish on reference pages

Plan: `.claude/plans/phase-5d-ux-polish.md`. Workstream A Wave 1 of 3.

- [x] **`web/src/lib/errors.ts`** -- new `friendlyError(err)` helper maps common errors (401/403/404/429/503/5xx, network, generic) to `{title, message}` pairs. Single source of truth so the UI never leaks "Failed to fetch" or stack traces.
- [x] **6 reference pages converted** to use `<LoadingSkeleton>` / `<ErrorCard>` / `<EmptyState>` primitives that previously had zero adoption. Each page now: shows a typed skeleton during initial fetch, surfaces a retry-able ErrorCard on failure, renders an EmptyState with helpful copy when results are empty.
  - `web/src/features/pokemon/components/pokemon-view.tsx` -- replaced inline `ListSkeleton` with `<LoadingSkeleton variant="card" count={8}>`, replaced `<div className="text-red-400">` with `<ErrorCard>`, replaced inline "No Pokemon found" with `<EmptyState>`. Cleaned up 2 dead helper functions (`PokemonListSuspended`, `Pagination`) that were leftover from a refactor and were generating 4 ESLint warnings.
  - `web/src/app/moves/page.tsx` -- same pattern; deleted the inline `MoveTableSkeleton` helper.
  - `web/src/app/items/page.tsx` -- same pattern; deleted the inline `ItemCardSkeleton` helper.
  - `web/src/app/speed-tiers/page.tsx` -- same pattern; collapsed inline error div + skeleton block.
  - `web/src/app/calc/page.tsx` -- inline `<ErrorCard variant="inline">` for the run-calc error path with retry.
  - `web/src/app/meta/page.tsx` -- list-variant skeleton, error card, two empty states (usage tab + tiers tab).
  - `web/src/app/type-chart/page.tsx` -- no changes needed (fully static, no fetch).
- [x] **Verification**: `pnpm tsc --noEmit` clean, `pnpm lint` 0 errors (warnings dropped 10 -> 6), `pnpm build` succeeds. Live preview: `/moves` walked through all three states -- 50 rows on success, EmptyState ("No moves found / Try adjusting the filters...") when searching `zzzzzzzzz`, ErrorCard ("Couldn't load moves / We couldn't reach the server. Check your connection and try again." + working "Try again" button) when API is offline.

Wave 2 (user-scoped pages: roster/teams/matches/profile/pokemon-detail) and Wave 3 (heavy state machines: draft/cheatsheet/admin) are sequenced for upcoming sessions per plan.

## Done (2026-04-28) - Phase 5B feature completion (F1-F8 closed)

Closes the last MVP-shaped feature gaps so F1-F8 are all user-reachable. Plan: `.claude/plans/is-there-anything-left-iterative-peacock.md`.

- [x] **Speed tier reference page** `/speed-tiers` -- new endpoint `GET /pokemon/speed-tiers?format=&champions_only=` returns each Pokemon with `base_speed` + derived `neutral_max` / `positive_max` / `scarf_max` (level 50, 252 EV / 31 IV) plus the latest usage % for the requested format. Cached `public, max-age=3600, swr=86400`. Frontend page is a sortable table (base / neutral / +nat / scarf / usage), search-by-name, "Champions only" toggle, sprite + TypePill columns. Mobile horizontal-scroll verified at 375px (327px container, 760px table). Wired into nav as "Speed". Added "see full speed tiers" link in stat-point-editor footer. New Pydantic models: `SpeedTierEntry`, `SpeedTierList`.
- [x] **F7 Damage Calculator UI** `/calc` -- new POST `/calc` endpoint orchestrating the existing `damage_calc.py` engine. Request accepts attacker/defender/move IDs + optional EV overrides + optional nature (`{plus, minus}`) + weather + `is_doubles`. Standalone stat-formula helper supports level-50 IV31 with optional EV/nature math (mirrors mainline). Frontend two-panel page: searchable Pokemon dropdowns, attacker movepool gates the move picker (status moves + 0-power filtered out), weather radio buttons, doubles toggle, result card with min-max damage + HP bar + OHKO verdict + STAB/effectiveness chips + copy-to-clipboard. Smoke test: Incineroar Flare Blitz vs Garchomp returns `21.9-25.7%` -- matches Smogon calc within rounding. CTA link added from meta detail panel ("Run Calc") with `?defender={id}` URL param hydration.
- [x] **F8 Sprite improvements** -- new `pokeArtShiny()` + `pokeSpriteShiny()` helpers in `web/src/lib/sprites.ts`. New `<SpriteFallback>` SVG component (magenta-tinted Pokeball silhouette) wired into pokemon detail page, roster card, team card, meta detail panel for null-sprite cases. Shiny toggle button added to pokemon detail page with `onError` fallback chain. Gender variants and form variants beyond what's already in DB deferred (Champions has only ~2 cosmetic gender cases).
- [x] **Local verification**: `ruff` clean; pyright on touched files clean (no new errors above the 17 pre-existing pokemon.py Supabase JSON narrowing complaints); `pnpm tsc --noEmit` clean; `pnpm lint` 0 errors; `pnpm build` builds all 14 routes incl. new `/calc` and `/speed-tiers`. Live preview: speed-tiers renders 201 entries with V2 magenta/gold tokens; calc page form controls render and POST returns expected damage. Mobile (375px) horizontal scroll verified.
- [x] **Out-of-scope follow-up flagged**: pokemon detail endpoint returns 500 on `/pokemon/{id}/detail` due to duplicate `mega_evolution_names` kwarg in `get_pokemon_detail` -- this is pre-existing (verified via stash test against HEAD `14892e6`). Spawned task chip; the shiny-toggle UI is type-clean but won't be live-verifiable until that bug is fixed.
- [x] **Detail-endpoint bug fixed (same day, 2026-04-28)**: in `api/app/routers/pokemon.py:get_pokemon_detail`, pop `mega_evolution_names` from `base.model_dump()` before spreading into `PokemonDetail(...)` so the explicit kwarg no longer collides. `curl http://localhost:8000/pokemon/727/detail` returns 200 with full Incineroar payload (77 moves, 2 abilities, types fire/dark). Dual-mega case verified on Charizard (id 6) -- `mega_evolution_names=['Mega Charizard X','Mega Charizard Y']`, back-compat `mega_evolution_name='Mega Charizard X'`. Live preview: detail page hydrates cleanly, shiny toggle swaps `/official-artwork/727.png` -> `/official-artwork/shiny/727.png` and renders the cream/orange shiny variant. Phase 5B F8 shiny toggle now end-to-end verified.

## Done (2026-04-27) - Data pipeline visibility + AI freshness gating

Investigation triggered by user report "scrapers fail constantly." Phase 1 audit found the actual problem: zero `/admin/cron/*` invocations in 7 days of prod logs -- crons aren't firing, almost certainly hitting the Hobby plan cron cap. Plan: stabilize-first (observability + freshness signals) before any scraper rewrites. Plan file: `.claude/plans/need-to-check-on-stateful-biscuit.md`.

- [x] Phase 1: Vercel log audit -- 1000-entry sample shows zero cron invocations, all 200/304 user traffic. Endpoint reachable (curl returns 401 on bad bearer). Cause is upstream of the FastAPI app
- [x] Phase 2: Audit log -- new `cron_runs` table (migration `20260427000000_cron_runs.sql`); `admin_cron.py` rewrites with `_record_cron_run` wrapper that persists every invocation, raises HTTPException(500) on script exceptions so Vercel marks invocations red instead of swallowing failures as warnings
- [x] Phase 3: Freshness exposure -- `/admin/data-health` extended with `latest_pokemon_usage_per_format`, `latest_meta_snapshot_per_format`, `last_cron_runs`, `stale_warnings`. New unauthenticated `GET /public/data-freshness`. New `<DataFreshness>` component renders `◆ DATA · N DAYS OLD` badge in cheatsheet + draft headers (gold + pulse-dot when fresh, magenta when >14d stale)
- [x] Phase 4: AI staleness gate -- `cheatsheet.py` and `draft.py` now hard-block with HTTP 503 when `pokemon_usage` is >14d old, inject a `DATA FRESHNESS:` line into the Claude prompt, and evict cached `ai_analyses` rows whose `created_at` predates the latest snapshot. Shared helper at `api/app/services/data_freshness.py`
- [x] Phase 5: Validator hardening -- `scripts/validate_data.py` now runs a connectivity probe before the 8 checks, isolates each check (crashes are `error` status, distinct from data `fail`), refuses `--fix` when more than half the checks crashed. Replaces the 2026-04-17 broken report (all 8 checks crashing on DNS error)
- [x] Local verification: API import-check + uvicorn smoke test (auth 401/200, /public/data-freshness returns expected shape, cron stub returns IngestResult), web preview confirms DataFreshness badge renders on /cheatsheet and /draft, validate_data run replaces the stale broken report (8 pass, 0 errors)
- [x] Phase 6 (cron consolidation, same day): collapsed 5 schedules to 2 (`cron-daily` + `cron-weekly`) to fit Hobby plan cap. Aggregator helper `_aggregate` reuses `_record_cron_run` per step + persists a parent row, so the audit log captures both step-level and aggregator-level outcomes. Migration applied to Supabase prod and prod curl returns 200 with the expected merged IngestResult; rows land in `cron_runs` end-to-end.

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
- [x] G3: Legal guidelines update -- Game8 scraper removed, Limitless terms added, Champions IP section
- [x] H: Landing page with hero/features/stats, onboarding rework deferred to visual polish phase
- [x] K1-K4: Cheatsheet UX (DB persistence, collapsible cards, team indicator badge, PDF export fix)
- [x] K5: Shareable cheatsheets -- username system, /u/{username} public profiles, share toggle, /share/{id} pages
- [x] K2 rework: Cheatsheet page shows all saved cheatsheets as collapsible cards
- [x] L1-L6: Admin Panel (auth, dashboard, Pokemon/moves/items managers, meta reviewer, AI cost tracking)
- [x] M1: Aggressive caching (cheatsheet 30d, draft 7d)
- [x] M2-M6: Tiered quotas (free 3/day, supporter 10/day), Haiku fallback, model-aware pricing, sponsor banner
- [x] N1-N3: Analytics & SEO (Vercel Analytics, sitemap.xml, robots.txt, OpenGraph/Twitter meta)
- [x] N4-N5: JSON-LD WebSite structured data added; ISR deferred (all pages are "use client")
- [x] O1-O2: Support Visibility (top nav link, contextual cost prompts on cheatsheet + draft)
- [x] P: Strategy content -- strategy_notes table, admin Strategy tab, wired into draft/cheatsheet AI prompts

### Visual Polish
- [x] Responsive audit (375/768/1280px) -- landing, pokedex, moves, items, type-chart, meta, login all verified
- [x] Fix: moves table min-w-[700px] for mobile horizontal scroll (was clipping category badges)
- [x] Auth callback route: /auth/callback for Supabase email confirmation flow
- [x] PokeComp Redesign V2 (2026-04-27): full visual rebrand from Battle Station to magenta/gold/purple esports-broadcast feel. Tokens swapped in `globals.css` (palette + Inter/JetBrains Mono fonts + new helpers `.btn-gradient`, `.text-gradient`, `.pulse-dot`, `.mono-label`). Nav rebuilt with conic-gradient brand mark + 7 primary links + Potion CTA. Custom restyles for Home (full V2 hero + Live Draft Board + Meta Movers + Roster/Cheatsheet split + closing CTA), Pokedex / Draft / Roster / Cheatsheet headers. Other pages auto-harmonize via token swap. CLAUDE.md design system section rewritten.

### Data Quality
- [x] Item legality: fixed Smogon ingest to recalculate percentages after filtering, ran --fix to clean 131 entries
- [x] Ability legality: cleaned 12 entries via --fix (including non-English ability names)
- [x] Non-English data: deleted 6 Pikalytics rows with Spanish/Korean/French/Italian/Chinese moves/items
- [x] Non-English data round 2 (2026-04-16): 28 more entries purged (12 items, 8 moves, 8 abilities) after user reported non-English moves in UI. `check_move_legality` now has --fix support; `pikalytics_usage.py` sends `Accept-Language: en-US`. Validator passes 8/8 clean.
- [x] Meta snapshot names: resolved by Game8 row cleanup migration (2026-04-16)

### Session A: User-reported issues (2026-04-16) -- LANDED
- [x] Type badge overflow: added `flex-wrap` to 4 type-badge containers (pokemon-card, roster-card, pokemon detail header, meta detail panel). Verified live via preview — all 50 pokedex cards render with new class, dual-type badges no longer break layout.
- [x] Non-English moves/items/abilities: Pikalytics `Accept-Language: en-US,en;q=0.9` header + `check_move_legality` --fix support + one-off --fix run purged 28 stale entries.
- [x] Draft latency: Haiku now default for draft (`HAIKU_MODEL` in `Query()` default), Sonnet available via `?model=claude-sonnet-4-6`. Haiku stays unquota'd (bypass remains in `analyze_draft`). Cheatsheet unchanged (Sonnet default, not time-sensitive).
- [x] Draft UX: elapsed-time counter on button, "Deep analysis (Sonnet)" checkbox toggle, "Fast · ~3-5s" / "Deep · ~10-15s" timing hints, mode badge in loading state with descriptive "AI is reviewing usage data..." copy.

### Session A: Deferred
- [ ] True SSE streaming for draft — scoped for a follow-up session. Haiku + progress UX covers ~90% of the "takes too long" complaint for team-preview use.

### Session B (2026-04-16) -- LANDED
- [x] Regional forms as separate roster entries: migration `20260419000000_flag_regional_forms.sql` flags 15 regional variants (Raichu-Alola through Tauros-Paldea) as `champions_eligible=true`. `seed_champions.py` updated with new `CHAMPIONS_REGIONAL_FORMS` list so future re-seeds preserve the flag. Applied to prod (verified 15/15).
- [x] AI hallucination guardrails: `api/app/services/ai_verifier.py` cross-checks every draft claim against the DB (bring-4 in my team, leads in bring-4, threats in opponent preview, cited moves exist in `moves` table, calc attacker/defender/move all valid). Annotates each item with `verified` + `verification_note`; populates `DraftAnalysis.warnings`. Prompt strengthened with "CRITICAL ACCURACY RULES" block instructing AI to say 'uncertain' instead of fabricating. Frontend: amber warnings banner + per-item ⚠ badges with tooltip notes. Unit test with 4 injected hallucinations caught all 4.

### Source-of-Truth Policy + Mega Stats Validation (2026-04-17) -- LANDED
- [x] 21 "staple" held items I inserted (Assault Vest, Choice Band, Life Orb, etc.) REVERTED via migration `20260421100000`. User confirmed these are in PokeAPI/source but NOT in the live Champions shop. Final item count: 116 (58 mega + 30 held + 28 berry) — matches Serebii exactly.
- [x] **Policy**: live Supabase DB is now the authoritative source of truth. External sources (Serebii, PokeAPI, seed lists) may drift. Future additions go through on-demand migrations after in-game verification.
- [x] `scripts/seed_champions.py` and `scripts/ingest/serebii_static.py` now require `--confirm-destructive` to run. Both have updated docstrings + guarded `main()` entrypoints.
- [x] CLAUDE.md Data Pipeline section rewritten with the source-of-truth rationale.
- [x] **Mega + base Pokemon stats spot-check vs Serebii** (13 samples across base forms, classic megas, new Champions megas): 13/13 stat lines match Serebii exactly. Types, abilities, all 6 base stats verified for Incineroar, Sinistcha, Garchomp, Greninja, Sableye + Mega Dragonite/Gardevoir/Meganium/Charizard X/Charizard Y/Greninja/Sableye/Garchomp.

### Session E (2026-04-17) -- Match-log UX, perf, AI damage engine -- LANDED
Plan: `.claude/plans/oponen-team-selection-is-rosy-tower.md`. Five user-reported pain points after a real match-logging session.
- [x] **W1 Opponent picker sort by usage**: matches/page.tsx now fetches `/usage?format=doubles&limit=50` and orders the 6 SearchableDropdown options as `[Most Used 50] -> [All Pokemon alphabetical]` with section headers. `DropdownOption` extended with optional `section` field; sticky header rendered when query is empty. Confirmed against live API: top 10 are Incineroar/Sneasler/Garchomp/Sinistcha/Kingambit/etc.
- [x] **W2 Match-log Pokemon-level override**: migration `20260601100000_matchup_actual_lineup.sql` adds `my_team_actual TEXT[]`. `MatchupCreate/Update/Response` extended; TS types mirrored. Form renders 6 chips below My Team selector (defaulting to the saved team's resolved roster) — user can override any slot to capture a mid-match swap. Submit only sends `my_team_actual` when it differs from the saved team's defaults. AI verifier (`ai_verifier.py`) softened: hallucinations (Pokemon/move not in DB) still hard-fail with `verified=false`; team-membership mismatches now warn-only.
- [x] **W3 Layer A Movepool override**: migration `20260601200000_movepool_overrides.sql` patches Alolan Ninetales (`Ninetales Alola`) with `Freeze-dry` (was missing from PokeAPI baseline + Serebii overlay). Idempotent `ARRAY(SELECT DISTINCT unnest(...))` pattern reusable for future Pokemon.
- [x] **W4 Quick-win perf**: new `/pokemon/basic` endpoint returns slim records (id, name, types, sprite, champions_eligible) — **236KB → 35KB for 500 Pokemon (85% reduction)**. `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` headers added on `/pokemon`, `/pokemon/basic`, `/usage`. `web/src/lib/api.ts` gained an in-memory TTL cache (5-min) wrapping `fetchPokemonBasic` and `fetchUsage`. Match-log uses the slim endpoint.
- [x] **W5a Real damage calc engine**: new `api/app/services/damage_calc.py` with TYPE_CHART (Python mirror of TS), level-50 stat conversion, full Gen 9+ damage formula (STAB, type effectiveness, doubles spread, weather). 9 unit tests in `scripts/test_damage_calc.py` (super-effective combos, immunities, status moves, OHKO detection, format strings) — all passing. `draft.py` post-processes the AI response: each calc's `attacker/move/defender` is looked up, `calculate_damage()` runs the formula, real `estimated_damage` string replaces the AI's guess. Calc note auto-tagged with `[2x SE, STAB]` etc. Prompt updated to tell the AI not to fabricate numbers — backend computes them. **Eliminates the entire class of "AI-hallucinated damage range" bugs.**

### Session E -- Deferred (revisit when needed)
- [ ] W3 Layer B: extend `validate_champions_sources.py` with `check_movepool_vs_sources()` for drift detection (DB vs PokeAPI vs Serebii)
- [ ] W3 Layer C: fix `serebii_static.py` regional-form scrape (URL/parse pattern issue causing Alolan Ninetales et al. to miss Serebii overlay)
- [ ] W5b: SSE streaming for draft + cheatsheet (Anthropic SDK `messages.stream()` + Vercel AI SDK on the web side); ~1 day
- [ ] W5c: counter_index from pokemon_usage + tournament_teams co-occurrence; speed-tier table injected into draft prompt; "what changed" delta callout from meta_snapshots
- [x] Apply migrations `20260601100000_matchup_actual_lineup.sql` + `20260601200000_movepool_overrides.sql` to Supabase prod (verified live 2026-04-28: applied 2026-04-18 as `matchup_actual_lineup` + `movepool_overrides`. `matchup_log.my_team_actual` column present; Alolan Ninetales movepool contains `Freeze-dry`.)

### Dual-Mega Support (2026-04-17) -- LANDED
- [x] Migration `20260422000000_dual_mega_support.sql`: added `pokemon.mega_evolution_ids INT[]` (backfilled from `mega_evolution_id`; Charizard set to `[10034, 10035]`), added `teams.mega_form_pokemon_id INT` FK to record specific mega form selection.
- [x] API: `PokemonBase` gains `mega_evolution_ids` + `mega_evolution_names` (batch-resolved in list endpoint). Team models gain `mega_form_pokemon_id`. Lints + TS types clean.
- [x] Team form: mega selector now shows one option per mega form (e.g. "Mega Charizard X" and "Mega Charizard Y" as separate options); stores both `mega_pokemon_id` (roster entry) and `mega_form_pokemon_id` (form ID). Team card shows "M-X"/"M-Y" label when form suffix ≤2 chars.

### Multi-Source Champions Validation (2026-04-17) -- LANDED
- [x] New `api/scripts/validate_champions_sources.py` validator cross-checks Serebii + PokeAPI + live DB. Reusable via `cd api && uv run python -m scripts.validate_champions_sources` (needs Supabase DNS).
- [x] Found + fixed 4 categories of discrepancies (migration `20260421000000_champions_data_audit_fixes.sql`):
  - 28 berries miscategorized as `mega_stone`. Root cause: `serebii_static.py` `current_category` state leaked across page sections. Data fixed via UPDATE; code fixed by making `item_category` a local variable.
  - 21 held-item VGC staples missing entirely from items table (Assault Vest, Choice Band, Choice Specs, Life Orb, Clear Amulet, Covert Cloak, Safety Goggles, Rocky Helmet, Weakness Policy, Wide Lens, Loaded Dice, Eject Button/Pack, Throat Spray, Room Service, Grassy Seed, Iron Ball, Light Clay, Terrain Extender, Protective Pads, Expert Belt). Inserted with IDs 30001-30021.
  - 2 held items (King's Rock, Quick Claw) incorrectly archived during Session D prune. Restored.
  - 9 mega stones for live Champions megas incorrectly archived (Aggronite, Beedrillite, Chesnaughtite, Delphoxite, Greninjite, Gyaradosite, Heracronite, Manectite, Steelixite). Restored.
- [x] Post-fix: 137 shop items (was 105), all 12 VGC staples present, 0 miscategorized, 0 dangling refs.
- [x] Full report at `api/champions_validation_report.json` (9/9 checks pass).
- [x] Deferred to future networked run: per-Pokemon movepool vs Serebii (200 pages), per-move power/accuracy vs Serebii (494 moves). Basic sanity (0 null fields, 0 suspicious power values) passed.

### Session D (2026-04-17) -- LANDED
- [x] Archive + prune non-Champions Pokemon/moves/items. Migration `20260420000000_archive_non_champions.sql` creates three `*_archive` tables (same columns + `archived_at` + `archive_reason`), copies non-Champions rows over, then DELETEs from live.
- [x] Prune results (verified in prod): pokemon 1099 → 260 live (839 archived, 76% reduction), moves 932 → 494 (438 archived, 47% reduction), items 138 → 106 (32 archived, 23% reduction).
- [x] Safe-to-prune rules honored: all megas (id >= 10000) kept (FK'd from `pokemon.mega_evolution_id`); 1 non-Champions item kept because a user had it on a build (FK from `user_pokemon.item_id`). Integrity audit: 0 dangling mega links, 0 dangling user_pokemon refs, 0 dangling item refs, 0 dangling avatars. Validator spot-checks confirm 201 Champions Pokemon, 0 orphan item/move refs in `pokemon_usage`.
- [x] Reversibility: archives are standalone tables — `INSERT INTO pokemon SELECT ... FROM pokemon_archive WHERE id = X` restores any pruned row.

### Session C (2026-04-16) -- LANDED
- [x] Matchup log schema: migration `20260419100000_matchup_log_fields.sql` adds `format` (ladder|bo1|bo3|tournament|friendly), `tags` (TEXT[]), `close_type` (blowout|close|comeback|standard), `mvp_pokemon`. GIN index on tags + partial index on format. Applied to prod.
- [x] Matchup log backend: `MatchupCreate`/`MatchupUpdate`/`MatchupResponse` extended; `list_matchups` accepts `?format=` and `?tag=` filters; `get_stats` returns new `by_format` + `by_tag` breakdowns.
- [x] Matchup log UI: form gained Format/Match-feel dropdowns + Tags input + MVP dropdown; cards show format badge, close-type chip, tag chips, MVP line, full notes (not truncated); filter bar gains Format select; Stats view gets two new panels (By Format, By Archetype Tag) beneath existing breakdowns.
- [x] Draft team-preview polish: last-used team persists to `localStorage` (`pokecomp_draft_last_team`), hydrates on mount unless `?team=` URL param overrides. Quick-paste bar above opponent slots accepts 6 names via comma/newline/semicolon separators, resolves against Champions options (case-insensitive), reports unresolved names in amber hint.

### Data
- [x] Pikalytics ingest: 25 Pokemon with full usage data (2026-04-16)

---

## Up Next
- [x] Supabase Auth: email confirmation enabled, Site URL + redirect URLs configured (2026-04-16)
- [x] Completion plan approved -- see `.claude/plans/lets-plan-mode-for-async-curry.md` for phased roadmap to June 5 MVP
- [x] Week 1 chunks 0.1/0.2/0.3/1.1/1.2 landed (2026-04-16)
  - 0.1 Shared UI primitives: LoadingSkeleton, ErrorCard, EmptyState at web/src/components/ui/
  - 0.2 Cache normalization utilities at api/app/services/cache_utils.py + migrations 20260417 and 20260601 + refactor draft/cheatsheet with v1/v2 fallback
  - 0.3 CRON_SECRET added to api/app/config.py and .env.example
  - 1.1 Nav "Support" -> "Buy Me a Coffee" SupportPill (Potion sprite, amber accent)
  - 1.2 Supporter quota 10 -> 30/day + 600/mo soft cap + QuotaIndicator component wired into draft and cheatsheet

### Outstanding user actions (Week 1 handoff)
- [x] CRON_SECRET generated and set on Vercel Production (2026-04-16). Preview scope NOT set -- CLI 51.1.0 cannot add preview-for-all-branches non-interactively; add via Vercel Dashboard if preview testing needs it, otherwise skip (Vercel Cron only runs on production)
- [x] cache_version migration applied to Supabase prod (2026-04-16, confirmed column exists on ai_analyses with default 1)
- [ ] Submit EthicalAds publisher application at ethicalads.io/publishers/ (approval 1-3 business days, needed for Phase 1.4)
- [ ] Optional: upgrade Vercel CLI to 51.5.1+ (`npm i -g vercel@latest`) -- unblocks non-interactive preview env adds
- [ ] June 1: apply 20260601000000_drop_v1_cache.sql to Supabase prod (scheduled v1 cleanup)

### Week 2 (Apr 23-29) -- LANDED (2026-04-16)
- [x] 1.3 Supporter badge: `SupporterBadge` component (Potion icon + amber chip) wired into TrainerCard on /profile and public /u/[username] page. `PublicProfile` API response extended with `supporter: boolean`
- [x] 1.4 EthicalAds integration: `ad-routes.ts` helper, `EthicalAds` component (no-ops without `NEXT_PUBLIC_ETHICAL_ADS_PUBLISHER_ID`), `AdSlot` client wrapper rendered below main in root layout. Gated on pathname allowlist + supporter flag
- [x] 1.5 Privacy Policy updates: Ko-fi added to Third-Party Services, new Section 4 Third-Party Data Sources (PokeAPI/Pikalytics/Smogon/Limitless/Serebii), new Section 5 Advertising (EthicalAds disclosure). Terms: Section 4 AI rate limit language updated for tiered quotas, new Section 5 Supporter Benefits
- [x] 2.1 Game8 cleanup: migration 20260418000000_clear_game8_snapshots.sql applied to Supabase prod, removed 3 stale rows (source='Game8') plus all embedded stale Pokemon name references

### Week 3 (Apr 30 - May 6) -- LANDED (2026-04-16)
- [x] 2.2 Ingest refactor: `api/app/models/ingest.py` with `IngestResult` pydantic model. `smogon_meta`, `pikalytics_usage`, `limitless_teams` each expose `run(dry_run=False) -> IngestResult` with counts/warnings/timing. CLIs preserved
- [x] 2.3 Vercel Cron: `api/app/routers/admin_cron.py` with `require_cron_secret` (constant-time HMAC compare, 401 on bad/missing, 503 when unset). 5 GET endpoints (Smogon, Pikalytics, Limitless, validate-data, cache-warmup stub) registered. `vercel.json` crons array added. Integration test confirms 401/503/200 branches
- [x] 2.4 Workstream G audit: `LEGAL_AND_DEV_GUIDELINES.md` section 1.C refreshed with last-verified dates, Serebii 0.5s delay reconfirmed, Game8 removal reconfirmed across live code, new Third-Party Data Recipients table in section 3 (Anthropic/Supabase/Vercel/Ko-fi/EthicalAds with PII assertions). `refresh_meta.py` SOURCES emptied, marked deprecated. CLAUDE.md data pipeline docs updated

### Outstanding user actions (Week 3 handoff)
- [x] **Vercel cron limits resolved (2026-04-27)**: consolidated 5 schedules to 2 to fit Hobby plan cap. New aggregator endpoints `GET /admin/cron/daily` (Limitless, every day 08:00 UTC) and `GET /admin/cron/weekly` (Smogon -> Pikalytics -> validate-data, Mon 06:00 UTC). Per-source endpoints retained for manual triggers but no longer scheduled. cache-warmup stub stays callable but unscheduled until Phase 5.2 lands.
- [x] Migration `20260427000000_cron_runs.sql` applied to Supabase prod (2026-04-27).
- [x] Prod smoke test (2026-04-27): `curl -H "Authorization: Bearer $CRON_SECRET" https://www.pokecomp.app/api/admin/cron/daily` returns 200 with merged IngestResult; both child (`ingest_limitless`) and parent (`cron_daily`) rows land in `cron_runs`. End-to-end audit log confirmed working in production.
- [ ] Once cache-warmup Phase 5.2 lands, swap the stub for the real `cache_warmup.run()` call (still unscheduled in the new 2-cron config; will need to fold into the weekly aggregator or replace one of the two slots)

---

## Backlog
- [x] Dedup pokemon_usage: ingest scripts now clean old snapshots; 19 stale rows deleted
- [x] ISR migration: 9 static pages (pokemon, moves, items, type-chart, meta, login, terms, privacy, support), 10 dynamic (auth-gated)
- [x] F7: Damage calculator (landed 2026-04-17 as Session E W5a -- engine in api/app/services/damage_calc.py, integrated into draft AI; standalone calc UI landed 2026-04-28)
- [x] F8: Sprite display improvements (shiny toggle + fallback placeholder, 2026-04-28)
- [x] Speed tier reference page /speed-tiers (landed 2026-04-28)

---

## Done (2026-04-16) - Session 3 (continued)
- [x] ISR migration: terms/privacy/support converted to server components, per-route force-dynamic layouts for auth pages
- [x] Usage data dedup: ingest scripts clean old snapshots, 19 stale rows deleted
- [x] Backlog cleared

## Done (2026-04-16) - Session 3
- [x] Auth callback route (/auth/callback) for Supabase email confirmation
- [x] Moves table mobile fix (min-w-[700px] horizontal scroll)
- [x] Responsive audit: all pages verified at 375/768/1280px
- [x] Data quality: item legality (131 fixed), ability legality (12 fixed), non-English rows (6 deleted)
- [x] Pikalytics full ingest: 25 Pokemon
- [x] README.md + MIT LICENSE
- [x] Smogon ingest: _top_entries_filtered now recalculates percentages after legality filtering

## Done (2026-04-16) - Session 2
- [x] G3: Game8 scraper removed from meta.py, LEGAL_AND_DEV_GUIDELINES.md updated with Limitless terms + Champions IP section
- [x] K5: username column + supporter flag migration, public.py router (public profiles + shared cheatsheets), visibility toggle on cheatsheet, /u/[username] + /share/[id] pages, CheatsheetContent extracted to shared component
- [x] M2-M6: Tiered quotas (free 3/day, supporter 10/day) in ai_quota.py, Haiku fallback (model param in draft + cheatsheet), model-aware pricing, sponsor-banner component
- [x] N4: JSON-LD WebSite schema in layout.tsx
- [x] N5: ISR investigation -- all pages are "use client" so force-dynamic stays on layout; ISR needs server component migration
- [x] P: strategy_notes migration, strategy.py CRUD router, StrategyTab in admin page, strategy_context.py service wired into draft + cheatsheet AI prompts
- [x] H: Landing page with hero, 4 feature cards, live stats counter, /public/stats API endpoint

## Done (2026-04-16)
- [x] K1: team_cheatsheets table + GET/POST saved cheatsheet endpoints + batch status check
- [x] K2: Collapsible accordion sections on cheatsheet page (roster, game plan, speed tiers, key rules, leads, weaknesses)
- [x] K3: "Cheatsheet" badge on team cards linking to saved cheatsheet
- [x] K4: PDF export rewritten with html2canvas-pro + jsPDF (replaces window.print hack)
- [x] K2 rework: Cheatsheet page shows all saved cheatsheets as collapsible cards with expand/collapse
- [x] L1-L6: Admin panel -- auth (ADMIN_USER_IDS env), dashboard (stats + AI costs + data health + freshness), Pokemon/Moves/Items managers with Champions toggle, Meta snapshot viewer
- [x] M1: Aggressive caching -- cheatsheet 30 days, draft 7 days
- [x] N1: Vercel Analytics (@vercel/analytics)
- [x] N2: sitemap.xml + robots.txt via Next.js MetadataRoute
- [x] N3: OpenGraph + Twitter meta tags, title template, metadataBase
- [x] O1: Support link in top nav (Compete section)
- [x] O2: Contextual support prompts after AI generation (cheatsheet + draft pages)
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
