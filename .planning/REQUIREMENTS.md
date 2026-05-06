# Requirements

**Last bootstrap:** 2026-04-28
**Source:** Synthesized from `champions-prd.md` (F1–F15) + `rag-architecture.md` (proposed Dual RAG) + `LEGAL_AND_DEV_GUIDELINES.md` (legal acceptance criteria) + orchestrator-confirmed elevation of F7/F8.

Per orchestrator decision in this bootstrap: **F7 and F8 are ELEVATED from PRD-stretch to MVP.** The PRD's strict scope guard ("anything not in F1-F6 goes to backlog") is overruled to reflect the codebase reality (`web/src/app/calc/`, `web/src/app/speed-tiers/`, `api/app/routers/calc.py`, `web/src/components/ui/sprite-fallback.tsx` already in flight per `.planning/codebase/CONCERNS.md`).

---

## Functional Requirements — MVP (F1–F8)

### F1 — REQ-roster-manager (Personal Roster Manager)
- source: `champions-prd.md` section 5 (F1)
- description: CRUD for Pokemon the user owns (species, item, ability, nature, stat points, moves).
- acceptance:
  - Create / read / update / delete a user-owned Pokemon record.
  - Filter the roster by type, role, tier.
  - Mark each Pokemon as built / training / wishlist.
  - Track VP spent per Pokemon.
- legal/data acceptance:
  - All writes auth'd via `Depends(get_current_user)`; RLS-scoped per Supabase migration `20260414000000_enable_rls.sql`.
- scope: `user_pokemon` table; `web/src/app/roster/`.
- status: shipped (codebase reference: `api/app/routers/user_pokemon.py`, `web/src/app/roster/page.tsx`).

### F2 — REQ-team-builder (Team Builder)
- source: `champions-prd.md` section 5 (F2)
- description: Build, validate, and manage 6-Pokemon teams.
- acceptance:
  - Drag-and-drop 6 Pokemon into a team.
  - Auto-validate the one-Mega-per-team rule.
  - Display team type coverage and weaknesses.
  - Save multiple teams with notes and tags.
  - Quick-clone and modify an existing team.
- legal/data acceptance:
  - RLS on `teams`; team-coverage math runs client-side or via service-role server reads only.
- scope: `teams` table; `web/src/app/teams/`.
- status: shipped (codebase reference: `api/app/routers/teams.py`, `web/src/app/teams/page.tsx`).

### F3 — REQ-static-reference-db (Static Reference Database)
- source: `champions-prd.md` section 5 (F3)
- description: Champions-aware browsable reference for Pokemon, moves, items, abilities, type chart.
- acceptance:
  - Pokemon list with `champions_eligible` filter.
  - Move details: power, accuracy, type, category, target.
  - Item descriptions + Champions shop availability flag.
  - Ability descriptions.
  - Type chart with damage multipliers.
- legal/data acceptance:
  - All reference tables seeded under D003 (Champions overwrites baseline) and D004 (manual item seed); attribution surfaced in UI per C-LEGAL-SOURCE-HIERARCHY.
  - Movepool/abilities are TEXT[] per D002 — name-keyed lookup tolerates the trade-off documented in `CONCERNS.md` (movepool gap detector).
- scope: `pokemon`, `moves`, `items`, `abilities`; `web/src/app/pokemon/`, `web/src/app/moves/`, `web/src/app/items/`.
- status: shipped (codebase references: `api/app/routers/pokemon.py`, `moves.py`, `items.py`, `abilities.py`).

### F4 — REQ-meta-tracker (Meta Tracker)
- source: `champions-prd.md` section 5 (F4)
- description: Surface current meta tier list, archetypes, and usage rates.
- acceptance:
  - Current tier list (singles, doubles, megas).
  - Top archetypes with example teams.
  - Meta Pokemon usage rates with "Last Updated" timestamps (per C-DEV-STANDARDS).
  - Updated weekly via scheduled ingest (per D009 + D010).
- **legal acceptance (binding, supersedes PRD wording):**
  - Tier/usage data sources are limited to Smogon, Pikalytics, Limitless. **Game8 is excluded per C-LEGAL-SOURCE-AUDIT (2026-04-16) and may not be re-introduced.**
  - All ingest runs via Vercel Cron with `Authorization: Bearer $CRON_SECRET` and per-source delays (Pikalytics 1.5s, Limitless 1s) per C-LEGAL-AUTOMATION-COMPLIANCE.
  - Source attribution surfaced in UI for every meta-derived row.
- scope: `meta_snapshots` (legacy, accepts non-Game8 sources only), `pokemon_usage`, `tournament_teams`; `web/src/app/meta/`.
- status: shipped (codebase reference: `api/app/routers/meta.py`, `usage.py`, `web/src/app/meta/page.tsx`).
- note: PRD's original Game8-scrape language is superseded; see INGEST-CONFLICTS.md INFO entries.

### F5 — REQ-ai-draft-helper (AI Draft Helper — killer feature)
- source: `champions-prd.md` section 5 (F5)
- description: Given the opponent's 6 Pokemon and the user's team, return a coached strategy via Claude.
- acceptance:
  - Paste opponent's 6 Pokemon (text input at MVP; OCR is post-MVP F12).
  - Select user's team.
  - Claude API call returns lead pair, back pair, turn-1 plan, key threats, win-probability estimate.
  - Save outcomes to a personal matchup log (feeds F6).
  - Cache responses by hash of team composition with 24-hour TTL (`ai_analyses.request_hash` UNIQUE) per NFR-ai-cache.
- legal acceptance:
  - User-supplied opponent text and notes pass through `api/app/prompt_guard.py` before Claude call (C-LEGAL-THIRD-PARTY-RECIPIENTS — Anthropic recipient).
  - AI quotas enforced per `api/app/ai_quota.py` (Free 3/day, Supporter 30/day + 600/month, Admin unlimited).
  - When `pokemon_usage` data is staler than `STALE_USAGE_THRESHOLD_DAYS = 14`, AI endpoints fall back to non-503 generic reasoning (current behavior post-2026-04-27 fix; see `services/data_freshness.py`).
- scope: `api/app/routers/draft.py`, `ai_analyses` table.
- status: shipped (generic stateless variant); RAG augmentation tracked separately as REQ-rag-augmentation.
- linked: REQ-rag-augmentation (proposed evolution).

### F6 — REQ-matchup-log (Matchup Log)
- source: `champions-prd.md` section 5 (F6)
- description: Record + analyze ranked matches.
- acceptance:
  - Record per match: my team, opponent team, lead chosen, outcome, notes.
  - Filter past matches by archetype, win/loss, opponent Pokemon.
  - Personal win-rate per archetype.
- legal/data acceptance:
  - RLS-scoped (`matchup_log` per `20260414000000_enable_rls.sql`).
  - Free-text notes never leave Supabase except via `prompt_guard.py`-sanitized AI calls.
- scope: `matchup_log` table; `web/src/app/matches/`.
- status: shipped (codebase reference: `api/app/routers/matchups.py`, `web/src/app/matches/page.tsx` — flagged 892-line splitting candidate in `CONCERNS.md`).

### F7 — REQ-damage-calculator (ELEVATED to MVP) — Damage Calculator
- source: `champions-prd.md` section 6 (F7); orchestrator-confirmed elevation 2026-04-28.
- description: Deterministic Gen 9 damage calculator with Champions stat-point inputs.
- acceptance:
  - User selects attacker (species + level + stat points + nature + item + ability + move) and defender (species + level + stat points + nature + item + ability).
  - User selects format (singles / doubles), weather, terrain, and any toggleable modifiers (e.g., critical hit, Tera type once supported).
  - Backend (`api/app/routers/calc.py` + `api/app/services/damage_calc.py`) returns min/max damage rolls and percentage of defender HP.
  - Output renders speed comparison and a verdict (OHKO / 2HKO / 3HKO / no kill range).
  - Public endpoint (no auth required) — explicit comment in `api/app/routers/calc.py` flags intentional public exposure (per `CONCERNS.md` security audit recommendation).
- legal/data acceptance:
  - All formula constants traceable to publicly documented Gen 9 mechanics; no copyrighted text reproduced.
  - "Calculation source: Pokemon Champions verified data" attribution surfaced.
- scope: `api/app/routers/calc.py`, `api/app/services/damage_calc.py`, `web/src/app/calc/`.
- status: in flight; **untracked in git** per `git status` (`api/app/routers/calc.py`, `web/src/app/calc/`). Damage formula tested via standalone script `api/scripts/test_damage_calc.py` (not pytest — see CONCERNS.md test gaps).
- gate: pyright + ruff clean; pytest gate added before this requirement is closed (per `.planning/codebase/CONCERNS.md` — "No tests for damage_calc.py" is High priority).

### F8 — REQ-sprite-and-speed-tiers (ELEVATED to MVP) — Sprite Fallback + Speed-Tiers Reference
- source: `champions-prd.md` section 6 (F8); orchestrator-confirmed elevation 2026-04-28.
- description: Robust sprite rendering across the app + a speed-tiers reference page.
- acceptance:
  - `<SpriteFallback>` component (`web/src/components/ui/sprite-fallback.tsx`) renders a typed SVG placeholder when a PokeAPI sprite URL fails to load. Used by `web/src/app/pokemon/[id]/page.tsx`, `web/src/components/roster/roster-card.tsx`, `web/src/components/meta/pokemon-detail-panel.tsx`, `web/src/components/teams/team-card.tsx`.
  - Speed-tiers page at `web/src/app/speed-tiers/` lists Champions-eligible Pokemon ordered by base Speed (with stat-point and nature bonuses applied), filterable by format/tier and groupable by speed bracket.
  - Page renders 200+ sprites without breaking layout; lazy-load or Vercel-edge sprite proxy considered (per `CONCERNS.md` performance note — sprite fetching has no app-level cache).
- legal/data acceptance:
  - Sprites loaded via `next/image` `unoptimized` from `raw.githubusercontent.com/PokeAPI/sprites/master/...` per D008 + `web/next.config.ts` allowlist.
  - Item sprites under `/sprites/items/<slug>.png` per `CLAUDE.md` design system.
  - Source attribution: "Sprite art via PokeAPI / Bulbapedia community contributions" rendered in page footer.
- scope: `web/src/components/ui/sprite-fallback.tsx`, `web/src/lib/errors.ts` (helper), `web/src/app/speed-tiers/`.
- status: in flight; **untracked in git** (sprite-fallback + errors.ts + speed-tiers directory). Imports already exist in committed components — clean checkout currently fails to build per `CONCERNS.md`.

---

## Functional Requirement — Forward-Looking (Proposed Evolution)

### REQ-rag-augmentation (Dual RAG for AI Draft Helper)
- source: `rag-architecture.md` (Proposed Architecture)
- status: **proposed, not yet implemented.** Current `api/app/routers/draft.py` is the generic stateless variant; matchup-log similarity queries and the FastAPI retrieval services are not in production.
- description: Augment Claude prompts for the AI Draft Helper with two retrieval streams — global tournament stats from `tournament_teams` (Limitless) and personal matchup history from `matchup_log` (RLS-scoped).
- acceptance:
  - On draft request, FastAPI executes two parallel reads:
    - Query A — `tournament_teams` / `tournament_matchups`: pro win rate, top-cut leads, common Tera types where opponent comp ≥ 3 matching Pokemon.
    - Query B — `matchup_log` (RLS-scoped to current user): user win rate, past leads, free-text notes where opponent_team_data overlaps.
  - FastAPI assembles a "Super Prompt" with `<limitless_pro_context>` and `<user_personal_context>` XML blocks plus the `<request>` payload.
  - Claude returns a synthesized, personalized strategy.
  - Empty-state handler: when the user has 0 historical matches against the archetype, fall back to generic reasoning (per C-SPEC-RAG-EMPTY-STATE).
- non-functional gates:
  - C-SPEC-RAG-LATENCY-BUDGET — added retrieval reads < 50ms total.
  - C-SPEC-RAG-INDEX-REQUIREMENT — JSONB GIN index on `opponent_team_data` in `matchup_log` and `tournament_teams`.
  - C-SPEC-RAG-RLS-REQUIRED — `matchup_log` RLS-scoped per user; `tournament_teams` global read, ingest-only write.
  - C-SPEC-RAG-EMPTY-STATE — never emit empty `<user_personal_context>` block.
  - AI cost delta: ~300–800 input tokens per request (~$0.001 / request at Sonnet pricing).

### REQ-rag-implementation-tasks (subtasks of REQ-rag-augmentation)
- source: `rag-architecture.md` section 4
- acceptance:
  - DB adjustments — verify `matchup_log` and `tournament_teams` JSONB structures are searchable; add GIN indexes; confirm RLS.
  - FastAPI retrieval services — Python service classes that execute overlap queries (similar arrays of Pokemon).
  - Prompt update — refactor LLM wrapper in `draft.py` to accept and inject the two context blocks.
  - Empty-state handler — 0-history fallback path implemented end-to-end.

---

## Stretch Backlog (F9–F15) — Post-MVP

Per `champions-prd.md` section 6 + scope guard in section 11. **Not scheduled for current MVP timebox.** Promotions from this list require explicit user direction (F7 and F8 were promoted in the 2026-04-28 bootstrap; nothing else is).

- **F10** — Team Builder Helper (assist in building balanced rosters/teams using AI and meta data).
- **F11** — Tournament team scraping from Limitless VGC when richer Champions data appears.
- **F12** — Screenshot OCR for opponent team preview.
- **F13** — Public read-only mode for sharing teams via URL.
- **F14** — Discord bot integration for matchup queries.
- **F15** — Push notification when meta tier list updates.
- (F9 Discarded)

---

## Non-Functional Requirements

### NFR-success-metrics
- source: `champions-prd.md` section 3
- targets:
  - Personal usage at least 3x per week.
  - "What should I draft against this team" decision time: minutes → seconds.
  - Meta data no more than 7 days stale.
  - Becomes the only Champions tool the primary user opens during play.

### NFR-mvp-timebox
- source: `champions-prd.md` sections 10, 11
- target: 8-week MVP (Apr 10 → Jun 5, 2026). F1–F6 (+ F7/F8 elevated this bootstrap) only inside the box. Anti-scope-creep is a named risk.

### NFR-meta-freshness-pipeline
- source: `champions-prd.md` section 11 + D009 + D010
- target: Weekly automated meta refresh via Vercel Cron. Manual-update path retained. Use Claude API for resilient page parsing rather than brittle CSS selectors. `STALE_USAGE_THRESHOLD_DAYS = 14` gates AI endpoints (downgrade to generic reasoning, not 503, per fix `14892e6`).

### NFR-ai-cache
- source: `champions-prd.md` section 12 (open question 2 — answered)
- target: AI analysis cached by hash of team composition with 24-hour TTL (`ai_analyses.request_hash` UNIQUE).

### NFR-non-goals
- source: `champions-prd.md` section 2
- explicit non-goals: automated battle bot, tournament management system, mainline VGC support, mobile-first design, multi-user accounts at MVP.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| F1 — REQ-roster-manager | (shipped pre-roadmap) | Done |
| F2 — REQ-team-builder | (shipped pre-roadmap) | Done |
| F3 — REQ-static-reference-db | (shipped pre-roadmap) | Done |
| F4 — REQ-meta-tracker | (shipped pre-roadmap) | Done |
| F5 — REQ-ai-draft-helper | (shipped pre-roadmap) | Done (generic; RAG pending) |
| F6 — REQ-matchup-log | (shipped pre-roadmap) | Done |
| F7 — REQ-damage-calculator | Phase 1 | Done |
| F8 — REQ-sprite-and-speed-tiers | Phase 1 | Done |
| REQ-rag-augmentation | Phase 3 | In Progress |
| REQ-rag-implementation-tasks | Phase 3 | Done |
| F9–F15 | Phase 5+ | Backlog |
| NFR-success-metrics | All phases | Active gate |
| NFR-mvp-timebox | All phases | Active gate |
| NFR-meta-freshness-pipeline | Phase 4 (alerting) | Partial (gating done; alerts pending) |
| NFR-ai-cache | (shipped pre-roadmap) | Done |
| NFR-non-goals | All phases | Active gate |

Pre-roadmap shipped work is intentionally not backfilled into a phase per the orchestrator's forward-only ROADMAP directive. See `.planning/STATE.md` for the prose summary of what landed before bootstrap.
