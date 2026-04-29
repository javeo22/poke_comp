## Conflict Detection Report

Generated: 2026-04-28
Mode: merge
Precedence: ADR > SPEC > PRD > DOC
Inputs: 4 docs (1 ADR, 1 SPEC, 1 PRD, 1 DOC)

Cycle detection: passed (no cross-doc cycles; only `LEGAL_AND_DEV_GUIDELINES.md` has cross_refs and they all point to source code, not other ingest docs).
UNKNOWN-confidence-low docs: 0.

---

### BLOCKERS (0)

None.

No LOCKED-vs-LOCKED ADR contradictions detected (only one ADR doc; D001-D009 are scope-disjoint).
No LOCKED ingest decision contradicts an existing locked decision in `.planning/` (the codebase maps under `.planning/codebase/` are observed-from-code reference per orchestrator instruction, not LOCKED context).

---

### WARNINGS (0)

None.

No competing acceptance variants detected — only one PRD in the ingest set, so no same-scope requirement appears with divergent acceptance criteria across PRDs.

---

### INFO (5)

[INFO] PRD architecture text mentions Cloud Run + Cloud Scheduler; production runs on Vercel
  Found: champions-prd.md section 8 says "Backend: Python FastAPI on Cloud Run" and "Scheduled jobs: Cloud Scheduler triggering Python scrapers weekly".
  Resolved: The PRD predates the Vercel migration. Codebase maps (`.planning/codebase/STACK.md`) confirm production is Vercel Python Functions and Vercel Cron. ADR `decisions.md` does not lock either choice, so this is not a contradiction — it is documentation drift in the PRD's narrative architecture section.
  Note: synthesized `context.md` records the PRD's original wording AND the current Vercel reality so downstream planners see the drift; `decisions.md` (synthesized) is unaffected because the ADR set does not pin the runtime.
  Action: roadmapper may want to write a new ADR that formally locks "Vercel Python Functions + Vercel Cron" so this drift can no longer reopen.

[INFO] PRD F4 Meta Tracker references Game8 tier-list scraping; Game8 was removed 2026-04-16 per ToS audit
  Found: champions-prd.md section 5 (F4) and section 9 list "Game8 tier list scrape" as the meta source. LEGAL_AND_DEV_GUIDELINES.md section 1.C marks Game8 HIGH risk and confirms it was REMOVED on 2026-04-16 (zero references in live code, 3 stale rows cleared from `meta_snapshots` via migration `20260418000000_clear_game8_snapshots.sql`).
  Resolved: PRD (Apr 10) is older than the legal audit (Apr 16). Per the legal/operational nature of the constraint, the audit ruling supersedes the PRD's data-source list. Synthesized `requirements.md` REQ-meta-tracker notes the supersession; synthesized `constraints.md` C-LEGAL-SOURCE-AUDIT preserves the "Do not re-introduce" rule.
  Action: roadmapper should regenerate the F4 acceptance text without Game8 wording.

[INFO] rag-architecture.md is "Proposed Architecture" — partially aspirational vs current `draft.py`
  Found: rag-architecture.md status line reads "Proposed Architecture". Codebase (`api/app/routers/draft.py`, 738 lines per CONCERNS.md) implements the current generic stateless AI Draft Helper but does not yet inject the `<limitless_pro_context>` and `<user_personal_context>` blocks; matchup-log similarity queries and the FastAPI retrieval services described in section 4 are not in production.
  Resolved: Treated as a forward-looking SPEC contract for REQ-rag-augmentation. Synthesized `requirements.md` records its status as "proposed (not yet implemented)". Synthesized `constraints.md` C-SPEC-RAG-* records its NFR targets (latency budget, GIN indexes, RLS, empty-state).
  Action: roadmapper should treat REQ-rag-augmentation as a planned roadmap item, not as already-complete capability.

[INFO] PRD lists F7 (damage calc) and F8 (sprites) as stretch; codebase has F7/F8-adjacent work in flight
  Found: champions-prd.md section 6 lists F7 (damage calculator with stat-point inputs) and F8 (sprite display via PokeAPI) as Phase 2+ stretch. `.planning/codebase/CONCERNS.md` reports `web/src/app/calc/`, `web/src/app/speed-tiers/`, and `api/app/routers/calc.py` are present (untracked) and that `todo.md` lists these features as done. Sprite-fallback component is also untracked.
  Resolved: Scope drift, not a contradiction. The PRD never *forbade* F7/F8; it deprioritized them. The current state is "MVP F1-F6 + early stretch (F7, F8) in flight, not yet committed to git". Synthesized `requirements.md` notes the in-flight stretch work in REQ-stretch.
  Action: roadmapper should explicitly elevate F7/F8 from stretch into MVP scope (or carve them into a Phase 5 line item) so the PRD scope guard ("anything not in F1-F6 goes to backlog") is no longer being silently violated.

[INFO] DOC precedence: legal/IP rules treated as binding despite DOC's normally-lowest precedence rank
  Found: Default precedence is ADR > SPEC > PRD > DOC. The legal/IP/ToS rules in LEGAL_AND_DEV_GUIDELINES.md are operational boundaries (can/cannot do), not architectural choices.
  Resolved: Synthesized `constraints.md` documents this elevation explicitly in its preamble — the C-LEGAL-* entries are binding regardless of DOC's precedence rank. No conflict produced because no ADR/SPEC/PRD entry currently contradicts the legal constraints; this is a transparency note for the roadmapper.
  Action: none required; keep the elevation note visible in `constraints.md` so future ingests don't auto-demote legal rules.
