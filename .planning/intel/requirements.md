# Requirements

Synthesized from PRD `champions-prd.md` (F1-F6 MVP scope, F7+ stretch) and SPEC `rag-architecture.md` (proposed Dual RAG architecture for the AI Draft Helper).

---

## Functional Requirements (MVP — F1–F6)

### REQ-roster-manager (F1: Personal Roster Manager)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F1)
- description: CRUD for Pokemon the user owns, including species, item, ability, nature, stat points, and moves.
- acceptance:
  - Create / read / update / delete a user-owned Pokemon record.
  - Filter the roster by type, role, tier.
  - Mark each Pokemon as built / training / wishlist.
  - Track VP spent per Pokemon.
- scope: `user_pokemon` table (RLS-scoped); roster UI page.

### REQ-team-builder (F2: Team Builder)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F2)
- description: Build, validate, and manage 6-Pokemon teams.
- acceptance:
  - Drag-and-drop 6 Pokemon into a team.
  - Auto-validate the one-Mega-per-team rule.
  - Display team type coverage and weaknesses.
  - Save multiple teams with notes and tags.
  - Quick-clone and modify an existing team.
- scope: `teams` table (RLS-scoped); team builder UI page.

### REQ-static-reference-db (F3: Static Reference Database)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F3)
- description: Champions-aware browsable reference for Pokemon, moves, items, abilities, and the type chart.
- acceptance:
  - Pokemon list with a Champions-roster filter (`champions_eligible`).
  - Move details: power, accuracy, type, category, target.
  - Item descriptions + Champions shop availability flag.
  - Ability descriptions.
  - Type chart with damage multipliers.
- scope: `pokemon`, `moves`, `items`, `abilities` tables; reference-browse UI pages.

### REQ-meta-tracker (F4: Meta Tracker)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F4)
- description: Surface current meta tier list, archetypes, and usage rates.
- acceptance:
  - Current tier list (singles, doubles, megas).
  - Top archetypes with example teams.
  - Meta Pokemon usage rates (when available).
  - Updated weekly via scheduled ingest (see D009 + constraints).
- scope: `meta_snapshots` (legacy), `pokemon_usage`, `tournament_teams` tables.
- note: PRD's original "Game8 tier list scrape" wording is superseded by the legal audit; tier data now sources from Smogon, Pikalytics, and Limitless. See INFO entry in INGEST-CONFLICTS.md.

### REQ-ai-draft-helper (F5: AI Draft Helper — killer feature)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F5)
- description: Given the opponent's 6 Pokemon and the user's team, return a coached strategy via Claude.
- acceptance:
  - Paste opponent's 6 Pokemon (text input at MVP; OCR is a stretch).
  - Select user's team.
  - Claude API call returns lead pair, back pair, turn-1 plan, key threats, win-probability estimate.
  - Save outcomes to a personal matchup log (feeds REQ-matchup-log).
- scope: `draft` router; `ai_analyses` table for response cache.
- linked: REQ-rag-augmentation (proposed evolution of the prompt context).

### REQ-matchup-log (F6: Matchup Log)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 5, F6)
- description: Record + analyze ranked matches.
- acceptance:
  - Record per match: my team, opponent team, lead chosen, outcome, notes.
  - Filter past matches by archetype, win/loss, opponent Pokemon.
  - Personal win-rate per archetype.
- scope: `matchup_log` table; matches UI page.

---

## Functional Requirements (proposed evolution — SPEC)

### REQ-rag-augmentation (Dual RAG for AI Draft Helper)
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md
- status: proposed (not yet implemented; current `draft.py` is the generic stateless version)
- description: Augment Claude prompts for the AI Draft Helper with two retrieval streams: global tournament stats (Limitless) and personal matchup history (`matchup_log`).
- acceptance:
  - On draft request, FastAPI executes two parallel reads:
    - Query A — `tournament_teams` / `tournament_matchups`: pro win rate, top-cut leads, common Tera types where opponent comp ≥ 3 matching Pokemon.
    - Query B — `matchup_log` (RLS-scoped to current user): user win rate, past leads, free-text notes where opponent_team_data is similar.
  - FastAPI assembles a "Super Prompt" with `<limitless_pro_context>` and `<user_personal_context>` XML blocks plus the `<request>` payload.
  - Claude returns a synthesized, personalized strategy (not regurgitated stats).
  - Empty-state handler: gracefully fall back to generic reasoning when the user has 0 historical matches against the archetype.
- non-functional:
  - Storage impact: negligible (kilobytes per match; Supabase free tier supports hundreds of thousands of logs).
  - Latency budget: < 50ms added by the two reads.
  - JSONB GIN index on `opponent_team_data` to keep similarity lookups instant.
  - AI cost delta: ~300–800 input tokens per request (~$0.001/request at Claude Sonnet 4 pricing).
- scope: `tournament_teams`, `tournament_matchups`, `matchup_log` (with JSONB GIN indexes + RLS); FastAPI retrieval services; LLM wrapper refactor.

### REQ-rag-implementation-tasks (subtasks of REQ-rag-augmentation)
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md (section 4)
- acceptance:
  - Database adjustments: ensure `matchup_log` and `tournament_teams` JSONB structures are searchable; correct RLS in place.
  - FastAPI retrieval services: Python service classes that execute the overlap queries (similar arrays of Pokemon).
  - Prompt update: refactor LLM wrapper to accept and inject the `<limitless_pro_context>` and `<user_personal_context>` blocks.
  - Empty-state handlers: 0-history fallback path implemented end-to-end.

---

## Stretch Requirements (PRD Section 6, Phase 2+)

### REQ-stretch (F7–F15)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 6)
- status: post-MVP backlog (per the PRD's own scope guard in section 11: "Anything not in F1-F6 goes to backlog").
- items:
  - F7 — Damage calculator with Champions stat-point inputs.
  - F8 — Sprite display via PokeAPI sprite URLs.
  - F9 — VP-cost calculator for full-team builds.
  - F10 — Counter-team builder ("build me a team that beats rain stall").
  - F11 — Tournament team scraping from Limitless VGC when Champions data appears.
  - F12 — Screenshot OCR for opponent team preview.
  - F13 — Public read-only mode for sharing teams via URL.
  - F14 — Discord bot integration for matchup queries.
  - F15 — Push notification when meta tier list updates.
- note: Codebase observation (see INGEST-CONFLICTS.md INFO) — F7 (`/calc`) and F8-adjacent (`/speed-tiers`) work has begun, sources untracked. Treat as scope drift, not a contradiction.

---

## Non-Functional Requirements

### NFR-success-metrics
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 3)
- targets:
  - Personal usage at least 3x per week.
  - Reduce "what should I draft against this team" decision time from minutes to seconds.
  - Meta data no more than 7 days stale.
  - Becomes the only Champions tool the primary user opens during play.

### NFR-mvp-timebox
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (sections 10, 11)
- target: 8-week MVP. F1–F6 only inside the box; F7+ deferred. Anti-scope-creep is an explicit, named risk.

### NFR-meta-freshness-pipeline
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 11) + decisions.md D009
- target: Weekly automated meta refresh; manual updates supported. Use Claude API for resilient page parsing rather than brittle CSS selectors (PRD risk-mitigation).

### NFR-ai-cache
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 12, open question 2 — answered)
- target: AI analysis cached by hash of team composition with 24-hour TTL (`ai_analyses.request_hash` UNIQUE).

### NFR-non-goals
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 2)
- explicit non-goals: automated battle bot, tournament management system, mainline VGC support, mobile-first design, multi-user accounts at MVP.
