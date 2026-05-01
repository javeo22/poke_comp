# Phase 05-01 Validation Strategy: Data Truth Foundation

## Automated Verification
1. **Database Schema:**
    - `grep "scraper_review_queue" supabase/migrations/20260603000000_scraper_review_queue.sql`
    - Verify table columns: `source`, `payload`, `status`, `metadata`.
2. **AI Classifier:**
    - `pytest api/tests/test_classifier.py`
    - Test cases: "Champions format" (Pass), "Regulation G" (Fail), "Standard VGC" (Fail).
3. **Review Logic:**
    - `pytest api/tests/test_review_logic.py`
    - Verify `approve_record` correctly moves data from queue to `tournament_teams` / `pokemon_usage`.

## Success Metrics
- **Classification Accuracy:** 100% on known "Champions" vs "VGC Standard" test set.
- **Latency:** AI classification response < 3s (acceptable for async scraper background tasks).
- **Data Integrity:** Approved records maintain foreign key integrity with the `pokemon` table.
