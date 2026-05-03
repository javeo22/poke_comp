# Phase 8 Research: Competitive Tools Overhaul & System Polish

## Objectives
1.  **Meta Tracker Depth:** Join `get_meta_trends` with `pokemon_usage` for deep data.
2.  **Speed Benchmarking:** Refactor `StatPointEditor` to show dynamic benchmarks.
3.  **Manual Ingest Triggers:** Add Admin buttons for background ingest tasks.
4.  **Personal RAG:** Inject specific species-based win/loss history into AI Draft.
5.  **Format Consolidation:** Remove "Megas" format from the system.
6.  **Database Fix:** Resolve `scraper_review_queue` table availability.

## Technical Analysis

### 1. Meta Tracker Depth
- **Current State:** `get_meta_trends` RPC (SQL) returns basic stats and placeholders.
- **Implementation:** Modify the RPC to join with `pokemon_usage` on `pokemon_name` and `snapshot_date`. Extract `moves`, `items`, `abilities`, and `teammates` from the JSONB blob.
- **Model Update:** `api/app/models/meta.py:MetaTrendResponse` needs:
    - `top_moves: list[str]`
    - `top_items: list[str]`
    - `top_abilities: list[str]`
    - `top_teammates: list[str]`

### 2. Speed Benchmarking
- **Current State:** `StatPointEditor` uses hardcoded tiers.
- **Implementation:** Use `fetchSpeedTiers` (already in `lib/api.ts`) to get the full benchmark set.
- **Logic:** Compare `finalSpeed` with `neutral_max`, `positive_max`, and `scarf_max` from the top 20 meta threats. Render as a "Benchmarks" side-list.

### 3. Manual Ingest Triggers
- **Current State:** Ingest logic is in `admin_cron.py` and standalone scripts.
- **Implementation:**
    - Create `@router.post("/ingest/{source}")` in `api/app/routers/admin.py`.
    - Use `BackgroundTasks` to avoid timing out the UI.
    - Sources: `pikalytics`, `limitless`, `smogon`.

### 4. Personal RAG (Draft Helper)
- **Current State:** Generic "similar match history" search.
- **Implementation:** 
    - Create a helper to query `matchup_log` for specific opponent Pokemon names.
    - Calculate `wins / total` for each species.
    - Inject as a specific "Historical Performance" block in the prompt: `Whimsicott: 1-4 (20% WR)`.

### 5. Format Consolidation
- **Locations to update:**
    - `web/src/types/meta.ts`: `META_FORMATS`
    - `web/src/types/team.ts`: `FORMATS`
    - `api/app/models/meta.py`: `format` regex
    - `api/app/models/team.py`: `format` regex
- **Action:** Remove `'megas'` from all lists and regex patterns.

### 6. Database Fix
- **Verification:** Check `supabase/migrations/20260603000000_scraper_review_queue.sql`.
- **Root Cause Hypotheses:**
    1. Migration not applied.
    2. RLS policy (admin check) blocking the `GET /review/pending` call because the user profile `is_admin` flag isn't set.
- **Fix:** Ensure user profile has `is_admin = true`.

## Proposed Plan
- **08-01:** Database Fix & Format Consolidation.
- **08-02:** Meta Tracker Depth (SQL + Models + UI).
- **08-03:** Speed Benchmarking (StatPointEditor).
- **08-04:** Manual Ingest Triggers & Personal RAG.
