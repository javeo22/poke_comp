# Phase 8 Context: Competitive Tools Overhaul & System Polish

## Background
Phase 8 has already delivered the "VGC-grade" Damage Calculator and the "Quick Pick" flow for Draft/Cheatsheets. However, several usability issues and data inconsistencies have surfaced. This context locks in the decisions for the next implementation steps.

## Reusable Assets & Patterns
- **Lab Dashboard Aesthetic:** High-density, esports-inspired UI with decorative telemetry and scan-lines. Used on the homepage and intended for all competitive tools.
- **RAG Infrastructure:** The Draft Helper uses a "Personal RAG" pattern (Meta + Personal Match History).
- **In-Place Set Editor:** The Teambuilder now supports opening the `RosterForm` as a nested modal for rapid iteration.

## Decided Gray Areas

### 1. Meta Tracker (Format Consolidation)
- **Decision:** Remove the "Megas" format from all UI and API filters. Megas are part of the team, not a separate ladder.
- **Focus:** High-resolution tracking for **Doubles** and **Singles** only.
- **Data Depth:** Meta trends should include not just usage %, but also:
    - Top 3 moves/items/abilities (from `pokemon_usage`).
    - Core Teammates.
    - Assigned "Meta Role" (Pivot, Sweeper, Support).

### 2. Speed Tier Benchmarking
- **Decision:** Implement **Benchmark Comparison** over side-by-side.
- **UX:** When viewing or editing a Pokemon's speed, show a relative list of benchmarks they outspeed/underspeed (e.g. "Outspeeds 252 Speed Garchomp", "Outspeed by +1 Dragonite").

### 3. Matchup Intelligence (Personal RAG)
- **Decision:** Use match history as the primary driver for "Personalized Advice".
- **Implementation:** The AI Draft Helper must query the `matchup_log` for specific Pokemon trends (e.g. "You lose 80% of matches against Whimsicott leads").
- **Deferred:** AI Post-Mortem (analyzing why you lost *after* a match) is deferred to Phase 9.

### 4. Admin Empowerment
- **Decision:** Add **Manual Ingest Triggers** to the Admin UI.
- **Goal:** Admins should be able to click a button to force a scrape of Pikalytics or Limitless without waiting for the CRON or using the terminal.

### 5. Maintenance Automation
- **Decision:** Leverage the AI Agent to keep Strategy Notes fresh.
- **Workflow:** Background task synthesized from Meta data + user matchups -> stages a "Strategy Note" update in the Review Queue.

## Technical Blockers (Locked for Fix)
- **Review Queue Table:** Resolve the `public.scraper_review_queue` missing table error. Verification of migration application and schema cache refresh is required.
- **Calc Move Selection:** The 422 error caused by high limits (1500 moves) has been resolved in the backend; frontend must now verify data density.

## Next Steps for Planner
1. Update `MetaTrendResponse` to support full data depth.
2. Implement Benchmark display in `StatPointEditor`.
3. Create Admin route to trigger ingest scripts.
4. Refactor `analyze_draft` to fetch personal match stats for the prompt.
