# State

**Last updated:** 2026-04-28
**Bootstrap mode:** merge-bootstrap-from-ingest (no prior PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md existed; only `.planning/codebase/` maps and `.planning/intel/` synthesis were on disk)

---

## Project Reference

**Name:** Pokemon Champions Companion
**Core value:** Personal companion app for the competitive Pokemon Champions player — roster + team builder + Champions-aware reference + AI draft helper + matchup log, in one tool.
**Current focus:** Stabilize the F7 (damage calculator) and F8 (sprite-fallback + speed-tiers reference) work so the production tree matches a clean checkout, then close down tech-debt landmines, then ship the Dual RAG augmentation for the AI Draft Helper.

---

## Current Position

**Milestone:** MVP completion (8-week timebox: 2026-04-10 → 2026-06-05).

**Position prose:**
Mid-flight. Roughly four weeks into the eight-week MVP timebox. **F1 (roster manager), F2 (team builder), F3 (static reference DB), F4 (meta tracker), F5 (AI draft helper — generic stateless variant), and F6 (matchup log) have shipped** per `plan.md` and the codebase reality (`api/app/routers/{user_pokemon,teams,pokemon,moves,items,abilities,meta,usage,draft,matchups}.py`, `web/src/app/{roster,teams,pokemon,moves,items,meta,draft,matches}/`). 

**F7 (damage calculator)** and **F8 (sprite-fallback + speed-tiers)** are in flight — the new files exist locally but are **untracked in git** as of this bootstrap (`web/src/components/ui/sprite-fallback.tsx`, `web/src/lib/errors.ts`, `web/src/app/calc/`, `web/src/app/speed-tiers/`, `api/app/routers/calc.py`). Several committed files already import the untracked components (`web/src/app/pokemon/[id]/page.tsx`, `web/src/components/roster/roster-card.tsx`, `web/src/components/meta/pokemon-detail-panel.tsx`, `web/src/components/teams/team-card.tsx`, `api/app/main.py:81`), which means a clean clone currently fails to build. This bootstrap formally **elevates F7 and F8 from PRD-stretch to MVP scope** to reflect that reality.

The Dual RAG augmentation per `rag-architecture.md` (REQ-rag-augmentation) is **proposed but not yet implemented** — current `api/app/routers/draft.py` is the generic stateless prompt; the `<limitless_pro_context>` and `<user_personal_context>` blocks, JSONB GIN indexes, and FastAPI retrieval services from the SPEC are queued for Phase 3.

Production runtime is **Vercel Python Functions + Vercel Cron** (locked this bootstrap as D010, superseding the PRD's Cloud Run / Cloud Scheduler narrative). Hobby cron cap of 2 schedules accepted; daily + weekly aggregators are consolidated in `vercel.json`.

Game8 is **out of the data pipeline** as of 2026-04-16 (HIGH risk per ToS audit) — tier/usage data sources from Smogon, Pikalytics, and Limitless. Stale Game8 references in `api/scripts/seed_champions.py` and the deprecated `api/scripts/refresh_meta.py` are cleanup targets in Phase 2.

**Active phase:** Phase 1 — Stabilize F7 + F8.

---

## Roadmap Snapshot

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Stabilize F7 + F8 | **Active** |
| 2 | Tech-debt cleanup | Not started |
| 3 | REQ-rag-augmentation (Dual RAG) | Not started |
| 4 | Cron alerting + freshness telemetry | Not started |
| 5+ | Stretch backlog (F9–F15) | Backlog |

Pre-roadmap shipped work (F1–F6 + NFR-ai-cache) is intentionally **not** backfilled per orchestrator directive — this roadmap is forward-only.

---

## Performance Metrics

Tracked against NFR-success-metrics. Snapshot at bootstrap:
- Personal usage: anecdotally on track (3x/week target).
- AI cache: TTL = 24h, keyed by `ai_analyses.request_hash` UNIQUE — shipped.
- Meta freshness: gated at 14 days (`STALE_USAGE_THRESHOLD_DAYS`); fallback to generic reasoning rather than 503 (per recent fix `14892e6`). Active alerting still pending (Phase 4).
- Cron load: 2 of 2 Hobby schedules used; further additions require consolidation or Pro upgrade.

---

## Accumulated Context

### Decisions (locked, see PROJECT.md for full text)
- D001 — PokeAPI integer IDs as primary keys.
- D002 — Movepool/abilities as TEXT[] denormalized.
- D003 — Champions data overwrites PokeAPI baseline (single column).
- D004 — Items seeded manually via `seed_champions.py`; no PokeAPI item import.
- D005 — No shared types directory; manual TS mirror of Pydantic.
- D006 — Tailwind v4 CSS-first `@theme` config.
- D007 — No monorepo tooling.
- D008 — `next/image unoptimized` for sprites.
- D009 — Volatility-tiered ingestion (Serebii static / Pikalytics meta / Limitless contextual).
- D010 — **NEW** Vercel Python Functions + Vercel Cron is production runtime; Cloud Run config retained as legacy fallback only.

### Open Todos (Phase 1 entry)
- Commit untracked F7/F8 files in a single coherent change (don't split — they wedge a clean checkout otherwise).
- Convert `api/scripts/test_damage_calc.py` from a standalone script into a pytest module gated by CI.
- Mark `/calc` endpoint with an explicit "intentionally public" comment per `CONCERNS.md` audit recommendation.
- Verify the speed-tiers page handles 200+ sprite renders without GitHub-rate-limit blowback (consider Vercel Edge sprite proxy if needed; defer the proxy to Phase 5+ unless it blocks Phase 1).

### Blockers
- None at bootstrap.

### Active risks (carry from `champions-prd.md` section 11)
- Scope creep — explicit anti-pattern; F9–F15 must remain backlog.
- Source-site HTML drift — Pikalytics / Limitless / Smogon ingest scripts are not unit-tested against snapshot fixtures (CONCERNS.md test-coverage gap; Phase 4 candidate).
- Champions patch breaks data assumptions — version meta snapshots with dates already in place; movepool gap detector exists.

---

## Session Continuity

**Where to resume next session:** Start Phase 2 Tech-debt cleanup. Begin by auditing `api/scripts/seed_champions.py` for Game8 strings.

**Last session intent:** Execute Phase 1 stabilization. Committed untracked files for F7/F8.

**Files written this session:**
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md` (this file)

**Files referenced (not modified):**
- `.planning/intel/{SYNTHESIS,decisions,requirements,constraints,context}.md`
- `.planning/codebase/{STACK,INTEGRATIONS,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md`
- `.planning/INGEST-CONFLICTS.md`
- `CLAUDE.md`
rements,constraints,context}.md`
- `.planning/codebase/{STACK,INTEGRATIONS,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md`
- `.planning/INGEST-CONFLICTS.md`
- `CLAUDE.md`
