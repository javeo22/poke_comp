# Roadmap

**Last bootstrap:** 2026-04-28
**Orientation:** Forward-only. Shipped F1–F6 work is **not** backfilled into phases — see `.planning/STATE.md` for the prose summary of what landed before this roadmap.
**Granularity:** Coarse (solo + Claude; ~4 weeks of MVP timebox remaining out of 8).
**Coverage:** 100% of remaining MVP and proposed requirements mapped (F7, F8, REQ-rag-augmentation, NFR-meta-freshness-pipeline alerting, F9–F15 deferred to Phase 5+).

---

## Phases

- [x] **Phase 1: Stabilize F7 + F8** — Commit untracked damage-calc + sprite-fallback + speed-tiers work, finish UAT, and ship the speed-tiers reference page.
- [x] **Phase 2: Tech-debt cleanup** — Resolve `CONCERNS.md` items that are operationally risky (stale Game8 strings, deprecated `refresh_meta.py`, stale design docs, hardcoded password, pyright noise).
- [x] **Phase 3: REQ-rag-augmentation (Dual RAG)** — Implement `matchup_log` retrieval + `tournament_teams` retrieval + Super-Prompt augmentation per `rag-architecture.md`.
- [x] **Phase 4: Cron alerting + freshness telemetry** — Page a human when `cron_runs` records `fail`; surface freshness state in the admin dashboard.
- [ ] **Phase 5: Data Truth & HITL Review** — Ensure 100% data accuracy by staging suspect scraper results and replacing hardcoded Meta trends.
- [ ] **Phase 6+: Stretch backlog (F9–F10, F12–F15)** — Prioritized post-MVP; prompts for explicit user direction before any item is promoted.

---

## Phase Details

### Phase 1: Stabilize F7 + F8
**Goal:** Land the elevated F7 (damage calculator) and F8 (sprite-fallback + speed-tiers) work cleanly so a fresh checkout builds and the production tree matches the local tree.
**Depends on:** Nothing (current entry point).
**Requirements covered:** F7 — REQ-damage-calculator, F8 — REQ-sprite-and-speed-tiers.
**Constraints in force:** D008 (`next/image unoptimized`), C-LEGAL-IP-USAGE (Fair-Use sprite attribution), C-LEGAL-CHAMPIONS-IP (conservative IP posture for game-specific assets), NFR-mvp-timebox.
**Success criteria** (what must be TRUE when this phase closes):
  1. `git status` reports no untracked files in `web/src/components/ui/sprite-fallback.tsx`, `web/src/lib/errors.ts`, `web/src/app/calc/`, `web/src/app/speed-tiers/`, or `api/app/routers/calc.py` — they are committed alongside the modified consumers (`web/src/app/pokemon/[id]/page.tsx`, `web/src/components/roster/roster-card.tsx`, `web/src/components/meta/pokemon-detail-panel.tsx`, `web/src/components/teams/team-card.tsx`, `api/app/main.py`).
  2. A clean clone runs `pnpm install && pnpm build` and `uv run uvicorn app.main:app` without import errors.
  3. The damage calculator returns deterministic Gen 9 damage rolls (min/max + verdict OHKO/2HKO/3HKO/no-kill) for a known fixture set, exercised by `api/scripts/test_damage_calc.py` (or its pytest successor) in CI.
  4. The speed-tiers page at `/speed-tiers` lists Champions-eligible Pokemon ordered by effective Speed (base + stat-points + nature) with a working format/tier filter and renders 200+ sprites without layout breakage.
  5. `<SpriteFallback>` renders typed SVG when an upstream PokeAPI sprite URL 404s; verified across the four consumer files listed in `CONCERNS.md`.
  6. `/calc` endpoint carries an explicit comment marking it intentionally public (per `CONCERNS.md` audit recommendation).
**Plans:**
- [x] 01-01-PLAN.md — Land F7/F8 work and verify build/calc.

### Phase 2: Tech-debt cleanup
**Goal:** Eliminate operationally risky drift flagged in `.planning/codebase/CONCERNS.md` so future ingests / re-seeds cannot regress legal posture or developer onboarding.
**Depends on:** Phase 1 (Phase 1 commits resolve "untracked file shipping production behavior" — Phase 2 picks up everything else).
**Requirements covered:** Indirect — supports NFR-meta-freshness-pipeline + NFR-mvp-timebox by removing landmines that would otherwise consume Phase 3+ time.
**Constraints in force:** C-LEGAL-SOURCE-AUDIT (Game8 must remain removed), C-DEV-STANDARDS, C-LEGAL-CHAMPIONS-IP.
**Success criteria:**
  1. `api/scripts/seed_champions.py` no longer references `game8.co` in literals, docstrings, or `seed_initial_meta()` source attribution. Re-running the seed (with `--confirm-destructive`) cannot re-introduce Game8-attributed rows into `meta_snapshots`.
  2. `api/scripts/refresh_meta.py` is either deleted or shrunk to a placeholder that documents the deprecation and points readers to the cron-driven Smogon/Pikalytics ingest.
  3. `design/palette.md` and `design/ANTIGRAVITY_DESIGN_REVIEW.md` are moved to `design/archive/` (or deleted), and `design/V2.md` (or equivalent) mirrors the V2 spec already documented in `CLAUDE.md`. Future Claude instances loading `design/` see consistent guidance.
  4. `api/scripts/seed_auth_user.py` reads its password from an env var with no default, refuses to run when `SUPABASE_URL` looks like production, and renames the email away from `orbital.net` (legacy "Orbital Archive" leftover).
  5. `api/app/routers/pokemon.py` pyright noise is reduced — either via a typed `SupabaseRow = dict[str, Any]` alias adopted consistently, or a typed wrapper around `.data` access. Target: zero `# type: ignore[assignment]` comments below line 60.
  6. `cache_warmup` cron stub at `api/app/routers/admin_cron.py:197-212` is either implemented or removed; the surface area no longer lies about its readiness.
**Plans:**
- [x] 02-01-PLAN.md — Sanitize Game8, secure seeding, and archive stale docs.

### Phase 3: REQ-rag-augmentation (Dual RAG)
**Goal:** Move the AI Draft Helper from generic stateless reasoning to personalized, retrieval-augmented strategy that combines tournament-stat context with the user's own matchup history.
**Depends on:** Phase 1 (avoids merging into a tree with untracked code), Phase 2 (avoids inheriting stale `refresh_meta.py` / Game8 attribution that would corrupt the prompt context).
**Requirements covered:** REQ-rag-augmentation, REQ-rag-implementation-tasks (subtasks).
**Constraints in force:** C-SPEC-RAG-LATENCY-BUDGET (< 50ms added retrieval), C-SPEC-RAG-INDEX-REQUIREMENT (JSONB GIN), C-SPEC-RAG-RLS-REQUIRED, C-SPEC-RAG-EMPTY-STATE, NFR-ai-cache (24h TTL preserved), C-LEGAL-THIRD-PARTY-RECIPIENTS (Anthropic recipient — ensure `prompt_guard` covers the new context blocks).
**Success criteria:**
  1. JSONB GIN indexes exist on `matchup_log.opponent_team_data` and `tournament_teams.opponent_team_data` (verified via `\d+` in psql or migration file presence).
  2. `api/app/routers/draft.py` injects two XML blocks (`<limitless_pro_context>`, `<user_personal_context>`) into the Claude prompt when relevant retrieval rows exist.
  3. When the user has zero historical matches against the queried archetype, the helper falls back to generic reasoning and emits no empty `<user_personal_context>` block. Verified by a fixture test against a fresh user account.
  4. Retrieval latency budget honored: end-to-end p95 of the two parallel reads is < 50ms in production logs (measured via existing `api/app/logging/` facilities or a one-shot benchmark).
  5. AI quota math (`api/app/ai_quota.py`) accommodates the ~300–800 input-token delta without breaking existing supporter / free caps.
  6. `prompt_guard.py` runs on user-supplied free-text notes that flow into the new context blocks (covers `matchup_log.notes`).
**Plans:**
- [x] 03-01-PLAN.md — Land GIN indexes, Supabase similarity RPCs, and retrieval service.
- [x] 03-02-PLAN.md — Refactor draft helper for XML context injection.
- [x] 03-03-PLAN.md — Verify RAG performance and strategy quality.


### Phase 4: Cron alerting + freshness telemetry
**Goal:** Close the "no automated alerting on cron failures" gap from `CONCERNS.md` so a multi-week silent failure cannot leave AI endpoints in fallback mode without anyone noticing.
**Depends on:** Phase 1 (untracked work landed) — no other hard dependency.
**Requirements covered:** Closes the alerting half of NFR-meta-freshness-pipeline. (The gating half is already shipped via `services/data_freshness.py` + the `STALE_USAGE_THRESHOLD_DAYS = 14` fix.)
**Constraints in force:** C-LEGAL-AUTOMATION-COMPLIANCE (any new outbound webhook respects per-recipient policy), C-LEGAL-THIRD-PARTY-RECIPIENTS (if a Slack/email recipient is added, it goes into the Privacy Policy ledger).
**Success criteria:**
  1. When `_record_cron_run` writes a `fail` row to `cron_runs`, an out-of-band notification reaches the operator (Vercel webhook → Slack, email, or push) within 5 minutes of the failure.
  2. `/admin/data-health` surfaces the most recent `cron_runs` status per schedule (`cron_daily`, `cron_weekly`) plus age of the oldest active source's last successful refresh.
  3. The privacy ledger / Privacy Policy section 3 is updated if a new third-party recipient (Slack workspace, etc.) is introduced.
  4. The alert is verified end-to-end by a deliberate failure injection (e.g., temporarily expired `CRON_SECRET` or a forced `raise` in a stub run).
**Plans:**
- [x] 04-01-PLAN.md — Implement alerting service and admin health dashboard.
- [x] 04-02-PLAN.md — Integration, compliance, and end-to-end verification.

### Phase 5: Data Truth & HITL Review
**Goal:** Ensure 100% data accuracy by staging suspect scraper results and replacing hardcoded Meta trends.
**Depends on:** Phase 4.
**Requirements covered:** F11 (Limitless Champions data), F4 (Meta Tracker evolution).
**Constraints in force:** D009 (Claude-powered parsing), C-LEGAL-SOURCE-AUDIT.
**Success criteria:**
  1. All scraper data (Limitless/Pikalytics) lands in a `scraper_review_queue` instead of production tables.
  2. AI classifier distinguishes between Champions and Standard VGC tournament formats.
  3. Admin UI at `/admin/review` allows for approval/rejection of staged data.
  4. Homepage meta trends fetch from `/api/meta/trends` and display real-time usage swings.
  5. Cheatsheet design matches the homepage esports broadcast aesthetic.
**Plans:**
- [ ] 05-01-PLAN.md — Foundation: DB staging, AI classifier, and review logic.
- [ ] 05-02-PLAN.md — Scraper refactor: adopt staging-first ingestion.
- [ ] 05-03-PLAN.md — Admin UI: build the HITL review dashboard.
- [ ] 05-04-PLAN.md — Dynamic Meta: build trends API and unify UI design.

### Phase 6+: Stretch backlog (F9–F10, F12–F15)
**Goal:** Prioritize post-MVP enhancements after the timebox closes. **No item ships without explicit user direction.**
**Depends on:** Phases 1–5 (and a successful MVP launch checkpoint).
**Requirements covered:** F9 (VP-cost calculator), F10 (counter-team builder), F12 (OCR), F13 (public-share polish), F14 (Discord bot), F15 (push notifications).
**Constraints in force:** All of PROJECT.md's locked decisions remain — F12 OCR cannot bypass `prompt_guard.py`; F13 must hold to RLS + the public-share posture already shipped.
**Success criteria:**
  1. Each promoted item gets its own phase entry (with full Goal / Depends-on / Requirements / Constraints / Success Criteria / Plans block) before any code lands.
  2. The corresponding REQUIREMENTS.md row is moved out of "Stretch Backlog" and into a numbered phase, and the traceability table is updated.
  3. Promotion is recorded in STATE.md with date and reason.
**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stabilize F7 + F8 | 1/1 | Completed | 2026-04-29 |
| 2. Tech-debt cleanup | 1/1 | Completed | 2026-04-29 |
| 3. REQ-rag-augmentation | 3/3 | Completed | 2026-04-30 |
| 4. Cron alerting + freshness telemetry | 2/2 | Completed | 2026-04-30 |
| 5. Data Truth + HITL Review | 0/4 | Active (current) | - |
| 6+. Stretch backlog | 0/TBD | Backlog | - |

---

## Coverage Notes

- All MVP requirements (F7, F8 elevated) and the proposed evolution (REQ-rag-augmentation) are mapped.
- Pre-roadmap shipped work (F1–F6 + generic F5 AI helper) is intentionally **not** backfilled into a phase per orchestrator directive. See STATE.md.
- F9–F15 remain in the explicit Stretch Backlog; promotion requires user direction.
- The "no CI for the API" `CONCERNS.md` note is partly stale (CI does run ruff + pyright per `.github/workflows/ci.yml`); confirm and de-list during Phase 2 rather than carve a separate phase.
- The "long routers / pages — splitting candidates" `CONCERNS.md` note (892-line `matches/page.tsx`, etc.) is **deferred** to post-MVP per `CONCERNS.md`'s own recommendation; not in any current phase.
