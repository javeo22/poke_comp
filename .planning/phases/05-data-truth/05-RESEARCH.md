# Phase 5: Data Truth & HITL Review - Research

**Researched:** 2026-05-01
**Domain:** Data Quality, AI Classification, Human-in-the-Loop (HITL), UI Refinement
**Confidence:** HIGH

## Summary

This phase focuses on ensuring the accuracy and freshness of the data powering the Pokemon Champions Companion. We are moving from a prototype-heavy ingestion model to a production-grade pipeline with verification layers.

Key objectives:
1. Automated classification of Limitless tournaments to ensure only "Champions" format data is ingested.
2. A staging/review system (HITL) to prevent suspect scraper data from going live without admin oversight.
3. Dynamic homepage meta trends that reflect the actual state of the database.
4. UI unification, bringing the "esports broadcast" aesthetic to the team cheatsheet.

**Primary recommendation:** Implement a centralized `scraper_review_queue` table and a `TournamentClassifier` service using Claude to gate ingestion.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tournament Classification | API (Claude) | — | Complex semantic matching of tournament descriptions. |
| Data Staging/Review | Database (Postgres) | API | Review queue must persist between scraper runs and admin sessions. |
| Meta Trend Calculation | API | Database | Calculating "swings" and ranking usage requires DB joins and window functions. |
| Esports UI Rendering | Browser | — | Purely aesthetic adaptation of Tailwind v4 classes and GSAP staggers. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anthropic SDK | 0.x | AI Classification | Used for semantic filtering of tournament data. [VERIFIED: api/app/services/] |
| Supabase | 2.x | Persistence | Storage for the review queue and meta snapshots. [VERIFIED: package.json] |
| FastAPI | 0.115+ | API Layer | Serves the review queue and meta preview endpoints. [VERIFIED: api/requirements.txt] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| Pydantic | 2.x | Data Validation | Strict typing for scraper payloads and review records. |
| GSAP | 3.x | Animations | Replicating the "esports" entrance staggers. [VERIFIED: web/package.json] |

## Architecture Patterns

### Recommended Project Structure
```
api/app/
├── services/
│   ├── ai_classifier.py    # NEW: Tournament format filtering
│   └── review_service.py   # NEW: Review queue logic
├── routers/
│   ├── admin_review.py     # NEW: Review queue management
│   └── meta.py             # UPDATED: Dynamic preview endpoint
web/src/
├── app/
│   ├── admin/
│   │   └── review/         # NEW: HITL Dashboard
│   └── (home)/
│       └── meta-preview.tsx # NEW: Dynamic component
└── components/
    └── cheatsheet/
        └── cheatsheet-content.tsx # UPDATED: Esports theme
```

### Pattern 1: AI Tournament Classifier
**What:** A semantic filter using Claude to categorize tournaments.
**Why:** Limitless TCG hosts many "VGC" tournaments that are not "Champions" format. Keywords alone are insufficient due to naming variations.

**Classification Categories:**
- `CHAMPIONS`: Matches project rules (restricted movepool, specific items, no Tera).
- `VGC_STANDARD`: Official Scarlet/Violet regulations (Reg G, etc.).
- `OTHER`: Non-competitive or unrelated games.

### Pattern 2: Staging-to-Live (HITL)
**What:** Scrapers write to `scraper_review_queue` with `status='PENDING'`. Admin reviews in UI, which then triggers a move to `tournament_teams` or `pokemon_usage_stats`.
**Why:** Scrapers are brittle. False positives in archetype detection or malformed move data can corrupt the RAG context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String similarity for formats | Custom regex | Claude (semantic) | Format names like "Champs Cup" vs "S1 Champions" vs "Champions Format" are semantically identical but hard to regex. |
| Admin Auth | Custom JWT logic | Supabase Auth (Service Role) | Secure the review queue for admin-only access using existing Supabase roles. |

## Common Pitfalls

### Pitfall 1: Classification Hallucination
**What goes wrong:** Claude might confidently classify a tournament as "Champions" because it sees a few restricted items, even if it's a standard VGC tournament.
**Prevention:** Provide 3-5 "few-shot" examples in the prompt, including tricky "edge" cases.

### Pitfall 2: Stale Meta Swings
**What goes wrong:** Calculating "up/down" trends based on the current vs. previous week fails if a week was skipped.
**Prevention:** Use SQL window functions (`LAG() OVER (PARTITION BY pokemon_id ORDER BY snapshot_date)`) to find the actual previous record, regardless of date gaps.

## Code Examples

### AI Classifier Prompt Concept
```python
PROMPT = """
Categorize the following tournament into one of: [CHAMPIONS, VGC_STANDARD, OTHER].

Rules for CHAMPIONS format:
- No Terastallization allowed.
- Restricted Movepool (e.g. no Spore, no Follow Me on certain mons).
- Mega Evolutions ARE allowed.

Tournament Name: {name}
Description: {description}

Return ONLY a JSON object: {"category": "...", "confidence": 0.0, "reason": "..."}
"""
```

### Review Queue Schema
```sql
CREATE TABLE scraper_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                  -- 'limitless', 'pikalytics'
  payload JSONB NOT NULL,                -- The data intended for tournament_teams/usage
  status TEXT DEFAULT 'PENDING',         -- PENDING, APPROVED, REJECTED
  external_id TEXT,                      -- tournament_id
  metadata JSONB,                        -- AI classification result
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded Homepage Stats | Dynamic `/api/meta/preview` | Phase 5 | Eliminates drift between dev-hardcoding and real meta data. |
| Blind Ingestion | HITL Review Queue | Phase 5 | Prevents corrupted RAG context from bad scraper data. |
| Heuristic Filtering | AI-Powered Semantic Filter | Phase 5 | Handles complex tournament naming schemes. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Limitless API provides descriptions | Task 1 | Lower classification accuracy if only name is available. |
| A2 | Supabase `pokemon_usage_stats` has enough history | Task 3 | "Swing" calculation might show 0.0 for all mons initially. |

## Open Questions (RESOLVED)

1. **How should we handle bulk-approval?** 
   - (RESOLVED) A "Select All" feature will be implemented in the Admin UI for records with AI confidence > 0.9.
2. **What happens to REJECTED data?**
   - (RESOLVED) REJECTED records will be retained for 30 days to prevent redundant scraping of invalid data, then purged.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Anthropic API | AI Classifier | ✓ | Claude 3.5 | None |
| Supabase SQL | Review Queue | ✓ | Postgres 17 | None |
| Limitless API | Data Source | ✓ | v1 | Mock data |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest |
| Quick run command | `pytest api/tests/test_review_queue.py` |
| Full suite command | `pytest api/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLSF-01 | Tournament names correctly classified | Unit | `pytest api/tests/test_classifier.py` | ❌ Wave 0 |
| STAG-01 | Data moved from queue to live on approval | Integration | `pytest api/tests/test_review_queue.py` | ❌ Wave 0 |
| META-01 | Home preview returns top 6 by usage | Integration | `pytest api/tests/test_meta_preview.py` | ❌ Wave 0 |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Admin-only RLS/Middleware for `/admin` endpoints. |
| V5 Input Validation | yes | Pydantic validation for review queue payloads. |

### Known Threat Patterns for FastAPI/Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege Escalation | Elevation of Privilege | Verify `is_admin` flag on `user_profiles` before allowing review actions. |
| Scraper Payload Injection | Tampering | Strict JSON schema validation via Pydantic. |

## Sources

### Primary (HIGH confidence)
- `api/scripts/ingest/limitless_teams.py` - Existing scraper implementation.
- `api/app/services/ai_verifier.py` - Existing AI pattern.
- `web/src/app/page.tsx` - Hardcoded meta preview location.
- Play! Limitless API Docs - Verified tournament schema.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: MEDIUM (HITL UX can be tedious)

**Research date:** 2026-05-01
**Valid until:** 2026-05-31
