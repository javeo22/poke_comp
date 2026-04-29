# Synthesis Summary

Generated: 2026-04-28
Mode: merge
Precedence: ADR > SPEC > PRD > DOC

This file is the single entry point for downstream consumers (`gsd-roadmapper`). All synthesized intel is split into the per-type files below; conflicts are recorded separately.

---

## Inputs

Docs synthesized: 4 total
- 1 ADR  — `/Users/javiervega/projects/poke_comp/decisions.md` (locked, 9 decisions D001-D009)
- 1 SPEC — `/Users/javiervega/projects/poke_comp/rag-architecture.md` (Proposed Architecture; not locked)
- 1 PRD  — `/Users/javiervega/projects/poke_comp/champions-prd.md` (v1.0, 2026-04-10; not locked)
- 1 DOC  — `/Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md` (last reviewed 2026-04-16; not locked)

Cross-ref cycle detection: passed. (Only the DOC has cross_refs; all point at source code, not other ingest docs.)
UNKNOWN-confidence-low docs: 0.

Existing context examined (codebase maps from `/gsd-map-codebase`, not treated as LOCKED per orchestrator instruction):
- `.planning/codebase/STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`
- `CLAUDE.md`

---

## Outputs

Per-type intel:
- `/Users/javiervega/projects/poke_comp/.planning/intel/decisions.md` — 9 locked decisions (D001-D009).
- `/Users/javiervega/projects/poke_comp/.planning/intel/requirements.md` — 6 MVP functional requirements (F1-F6), 1 proposed RAG evolution (REQ-rag-augmentation + subtasks), 1 stretch grouping (F7-F15), 5 NFRs.
- `/Users/javiervega/projects/poke_comp/.planning/intel/constraints.md` — 8 legal/IP/operational constraints (C-LEGAL-*, C-DEV-*), 9 technical constraints (C-TECH-*), 4 SPEC-derived proposed constraints (C-SPEC-RAG-*).
- `/Users/javiervega/projects/poke_comp/.planning/intel/context.md` — problem statement, goals, non-goals, success metrics, personas, architecture posture, phasing, risks, open-question resolutions, ecosystem stance.

Conflicts report:
- `/Users/javiervega/projects/poke_comp/.planning/INGEST-CONFLICTS.md` — 0 BLOCKERS, 0 WARNINGS, 5 INFO entries.

---

## Headline Counts

- Decisions locked: 9 (all from `decisions.md` D001-D009).
- Requirements (functional, MVP F1-F6): 6 — REQ-roster-manager, REQ-team-builder, REQ-static-reference-db, REQ-meta-tracker, REQ-ai-draft-helper, REQ-matchup-log.
- Requirements (proposed evolution from SPEC): 1 — REQ-rag-augmentation (with implementation subtasks).
- Stretch backlog grouping: F7-F15 (post-MVP per PRD section 6).
- Non-functional requirements: 5 (success metrics, MVP timebox, meta freshness, AI cache TTL, non-goals).
- Constraints (legal/IP/operational): 8.
- Constraints (technical, ADR-derived): 9.
- Constraints (SPEC-derived, proposed): 4.

---

## Synthesis Notes for the Roadmapper

1. **The ADR is the strongest source.** `decisions.md` is treated as locked per the manifest; D001-D009 should appear verbatim in the roadmapper's decision register. No two ADR entries contradict each other (they cover disjoint scopes: PK strategy, denormalization, data overwrite, item seeding, type sharing, Tailwind config, monorepo tooling, image rendering, ingestion strategy).

2. **The SPEC is forward-looking, not implemented.** `rag-architecture.md` describes a proposed Dual RAG augmentation of the AI Draft Helper. The current `api/app/routers/draft.py` is the generic stateless version. REQ-rag-augmentation should be planned as future work; do not assume it is shipping today.

3. **The PRD's data-source narrative is partially superseded.** Specifically:
   - "Cloud Run + Cloud Scheduler" wording in PRD section 8 has been overtaken by Vercel Python Functions + Vercel Cron in production. The ADR set does not lock this; the roadmapper may want to capture a new ADR.
   - "Game8 tier list scrape" in PRD section 5 (F4) and section 9 has been removed entirely as of 2026-04-16 per the DOC's ToS audit. Tier data now flows from Smogon, Pikalytics, and Limitless. Constraints `C-LEGAL-SOURCE-AUDIT` enforces "do not re-introduce".

4. **F7/F8 stretch features are partially in flight.** The PRD's strict scope guard ("anything not in F1-F6 goes to backlog") is being relaxed in practice — `web/src/app/calc/`, `web/src/app/speed-tiers/`, and `api/app/routers/calc.py` exist (currently untracked per `CONCERNS.md`). The roadmapper should formally elevate or scope these into a phase rather than leaving them as undocumented drift.

5. **Legal constraints bind operationally regardless of precedence rank.** The DOC is normally lowest precedence, but its scraping/IP/monetization rules are operational boundaries on what the system MAY do. Synthesized `constraints.md` documents this elevation in its preamble. Treat all `C-LEGAL-*` entries as non-negotiable.

6. **Where the codebase has implemented features beyond the PRD, treat as scope drift rather than contradiction.** Per orchestrator guidance, codebase maps are observed-from-code reference, not LOCKED context — they cannot trigger BLOCKERs against ingest docs.

---

## Status

STATUS: READY — safe to route. No BLOCKERs, no competing-variants WARNINGs.
The 5 INFO entries are transparency notes (drift / supersession / scope evolution) for the roadmapper's awareness; none gate the workflow.
