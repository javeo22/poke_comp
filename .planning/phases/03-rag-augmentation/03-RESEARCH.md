# Phase 3: REQ-rag-augmentation (Dual RAG) - Research

**Researched:** 2026-04-28
**Domain:** AI Retrieval-Augmented Generation (RAG) / PostgreSQL Optimization
**Confidence:** HIGH

## Summary

This research focuses on upgrading the AI Draft Helper from a stateless calculator to a personalized coach using a **Dual RAG** pipeline. The system will fetch global tournament data from `tournament_teams` and personal history from `matchup_log` to augment Claude's prompts. 

Existing implementations of `_fetch_personal_context` and `_fetch_tournament_context` in `draft.py` are suboptimal: they either filter in Python memory or ignore input parameters entirely. This research provides the SQL and architectural patterns to move retrieval to the database layer, ensuring scalability and precision.

**Primary recommendation:** Use PostgreSQL array overlap (`&&`) and intersection counts within SQL to perform similarity searches on `tournament_teams` (IDs) and `matchup_log` (JSONB), and wrap the resulting context in clear XML tags for Claude.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Retrieval Logic | API (FastAPI) | — | API owns the RAG pipeline and DB orchestration. |
| Similarity Query | Database (Postgres) | — | SQL is 10-100x faster than Python for set intersections at scale. |
| Prompt Augmentation | API (FastAPI) | — | API assembles the "Super Prompt" before sending to Anthropic. |
| User Data Isolation | Database (RLS) | API (Auth) | Supabase RLS ensures personal history never leaks between users. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ | Data Storage | Supabase default; excellent JSONB and array support. |
| Anthropic SDK | 0.21+ | LLM Interaction | Official Claude client; supports XML block parsing natively. |
| FastAPI | 0.110+ | Retrieval Service | Asynchronous-capable; already hosting the draft logic. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| GIN Indexes | Native | Query Acceleration | Essential for array and JSONB searching at scale. |

## Architecture Patterns

### Recommended Retrieval Pattern
Instead of fetching all rows and filtering in Python, execute similarity queries directly in SQL.

**Pattern: Array Overlap (Tournament Teams)**
```sql
-- Source: [VERIFIED: PostgreSQL Docs - Array Operators]
SELECT *, (
  SELECT count(*) 
  FROM unnest(pokemon_ids) p 
  WHERE p = ANY(ARRAY[1, 2, 3, 4, 5, 6])
) as overlap_count
FROM tournament_teams
WHERE pokemon_ids && ARRAY[1, 2, 3, 4, 5, 6]
ORDER BY overlap_count DESC, created_at DESC
LIMIT 5;
```

**Pattern: JSONB Set Intersection (Matchup Log)**
```sql
-- Source: [VERIFIED: PostgreSQL Docs - JSONB Functions]
SELECT *, (
  SELECT count(*)
  FROM jsonb_array_elements(opponent_team_data) AS x
  WHERE (x->>'name') = ANY(ARRAY['Pikachu', 'Charizard', ...])
) as overlap_count
FROM matchup_log
WHERE user_id = auth.uid() -- RLS handles this
ORDER BY overlap_count DESC, played_at DESC
LIMIT 5;
```

### Prompt Engineering: XML Injection
Anthropic recommends using XML tags to help Claude distinguish between different context streams.

```xml
<context>
  <limitless_pro_data>
    [Tournament Stats Here]
  </limitless_pro_data>
  <user_personal_history>
    [Matchup Log Data Here]
  </user_personal_history>
</context>
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Similarity Matching | Nested Python Loops | SQL Intersections | Python loops are O(N*M) and bypass DB indexes. |
| Prompt Escaping | Manual f-strings | XML Blocks | Claude is trained on XML boundaries; prevents prompt injection/confusion. |
| Latency Measurement | Custom timers | FastAPI Middleware | Standardized logging across all endpoints. |

## Common Pitfalls

### Pitfall 1: Missing GIN Indexes
**What goes wrong:** As the `tournament_teams` table grows (1000+ teams), the overlap query becomes a sequential scan.
**How to avoid:** Add GIN indexes on `pokemon_ids` and `opponent_team_data` during the Wave 0 DB setup.

### Pitfall 2: Token Budget Exhaustion
**What goes wrong:** If context blocks are too large (e.g., 50 matches), we hit Claude's token limit or increase costs unnecessarily.
**How to avoid:** Limit retrieval to top 5 most similar matches and trim JSON fields (e.g., remove IDs/timestamps if not used by LLM).

## Code Examples

### Optimized Personal Context Retrieval
```python
# [VERIFIED: draft.py current state]
# Current implementation fetches 50 rows and filters in Python.
# PROPOSED implementation using PostgREST/Supabase filter:

def _fetch_personal_context_v2(user_id: str, opponent_names: list[str]) -> str:
    # Uses a RPC or raw SQL snippet to execute the overlap count in DB
    # For MVP, keeping the Python filter is OK if user rows < 500.
    # But for REQ-rag-augmentation, we should at least optimize the query.
    pass
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic Analysis | RAG Augmentation | Phase 3 | Personalized, stateful coaching vs generic stats. |
| In-Memory Filtering | SQL-Level Filtering | Phase 3 | Improved latency and scalability for large history logs. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Retrieval | ✓ | 15.6 | — |
| Anthropic API | LLM | ✓ | 3.5 Sonnet | Haiku |
| Supabase SDK | DB Access | ✓ | 2.4.x | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest |
| Config file | api/pyproject.toml |
| Quick run command | `pytest api/scripts/smoke_test.py` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAG-01 | Dual context injection | Integration | `pytest tests/test_rag.py` | ❌ Wave 0 |
| RAG-02 | GIN Index performance | Performance | `pytest tests/test_db_perf.py` | ❌ Wave 0 |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Supabase RLS on `matchup_log` |
| V5 Input Validation | yes | Pydantic models in `MatchupCreate` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt Leakage | Information Disclosure | `prompt_guard.py` sanitization |
| Unauthorized Read | Information Disclosure | RLS verification (Matchup log isolation) |

## Sources

### Primary (HIGH confidence)
- `rag-architecture.md` - Technical vision and requirements.
- `api/app/routers/draft.py` - Current implementation reference.
- `supabase/migrations/` - Schema definitions.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH - Core project tech.
- Architecture: HIGH - Proven RAG patterns.
- Pitfalls: MEDIUM - Dependent on user data growth.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28
