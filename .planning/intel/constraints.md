# Constraints

Synthesized from DOC `LEGAL_AND_DEV_GUIDELINES.md` (legal/IP/operational) and ADR `decisions.md` (technical contracts that constrain downstream choices).

Per the precedence order (ADR > SPEC > PRD > DOC), the DOC is normally lowest precedence. However, the legal/IP/ToS rules below are operational constraints — non-negotiable boundaries on what the system MAY do — and downstream planners must treat them as binding regardless of their precedence rank.

---

## Legal / IP Constraints (DOC)

### C-LEGAL-ETHICAL-SCRAPING
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 1.A)
- type: operational policy
- content: All scrapers must respect `robots.txt`, implement rate-limiting delays, attribute the source in UI + code, and never bypass authentication or paywalls.

### C-LEGAL-SOURCE-HIERARCHY
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 1.B)
- type: operational policy
- content: Source priority is (1) open-source APIs (PokeAPI), (2) manual entry from official game sources, (3) scraped community meta-data only when necessary and with attribution.

### C-LEGAL-SOURCE-AUDIT (last reviewed 2026-04-16)
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 1.C)
- type: per-source ToS audit
- per-source rulings:
  - PokeAPI — LOW risk; public REST API; permissive robots.txt; open-source. ACTIVE.
  - Pikalytics — LOW risk; HTML scraping with 1.5s delay + 25-Pokemon cap; AI-friendly robots.txt (welcomes Claude/GPT); no scraping restrictions. ACTIVE.
  - Smogon / pkmn — LOW risk; public JSON API at pkmn.github.io; MIT-licensed code; attribution required. ACTIVE.
  - Limitless VGC — LOW–MEDIUM risk; public REST API with 1s delay; no robots.txt (404), no published ToS; widely used by community tools. ACTIVE with attribution.
  - Serebii — MEDIUM risk; HTML scraping with 0.5s delay; permissive robots.txt (only `/hidden/` blocked); no public ToS, content copyrighted. ONE-TIME SEED ONLY; no repeat scraping without re-audit.
  - Game8 — HIGH risk; **REMOVED 2026-04-16**. robots.txt blocks GPTBot, dotbot, Google-Extended; ToS prohibits reverse engineering and unauthorized commercial use. Zero references in live code as of 2026-04-16; 3 stale rows cleared from `meta_snapshots` via migration `20260418000000_clear_game8_snapshots.sql`. **Do not re-introduce.**

### C-LEGAL-AUTOMATION-COMPLIANCE
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 1.C — Automation compliance)
- type: operational policy
- content: All automated ingest runs via Vercel Cron (`vercel.json`) at off-peak UTC hours with the per-source delays listed above. Cron invocations must pass `Authorization: Bearer $CRON_SECRET` (`api/app/routers/admin_cron.py`). No unauthenticated automated traffic to third-party sources.

### C-LEGAL-CHAMPIONS-IP (2026-04-16)
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 1.D)
- type: IP posture
- content:
  - Pokemon Champions launched 2026-04-08; no established fan-tool precedent yet — be conservative with game-specific assets and mechanics.
  - Competitive data (tier lists, usage stats) is community-generated analysis, not copyrighted game content.
  - Move/ability/item names are trademarked but factual references are standard practice (Bulbapedia, Smogon, Serebii precedents).
  - AI analysis of team compositions is transformative use; we generate strategic insight, not reproduced game content.
  - Monitor The Pokemon Company's stance on Champions community tools as the ecosystem matures.

### C-LEGAL-IP-USAGE
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 2)
- type: IP posture
- content:
  - Non-commercial priority — core platform stays free/accessible to avoid direct competition with licensed products.
  - Sprites & artwork — use Fair Use placeholders or official community-sourced sprites; do not bundle into a paid package.
  - Naming — clearly label as a Fan Project; not affiliated with or endorsed by The Pokemon Company.
  - Fair-use defense — transformative purpose is AI Analysis + Team Strategic Guidance.

### C-LEGAL-MONETIZATION
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 3)
- type: business policy
- content:
  - Sell analysis, not data — never charge for raw stats / moves; charge only for premium features (e.g., unlimited AI matchup logs, advanced cloud sync, custom themes).
  - Prefer ad-supported or donation-based (Patreon, Buy Me a Coffee, Ko-fi) over strict SaaS subscriptions — industry standard for safe fan tools.
  - Maintain a public ledger of data provenance to avoid misappropriation claims.

### C-LEGAL-THIRD-PARTY-RECIPIENTS (2026-04-16)
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 3 — Third-Party Data Recipients)
- type: privacy contract
- per-recipient:
  - Anthropic (Claude API) — receives team comps + sanitized matchup notes (via `prompt_guard.py`); no PII; disclosed in Privacy Policy section 3.
  - Supabase — DB + auth host; receives all user data encrypted at rest; PII (emails, auth identifiers); disclosed in Privacy Policy section 3.
  - Vercel — hosting + analytics (privacy-first, no cookies, no cross-site tracking); no PII; Privacy Policy section 3.
  - Ko-fi — donations; only the supporter-chosen Ko-fi username; no payment card details ever received; Privacy Policy section 3.
  - EthicalAds — contextual display ads (free tier only, supporters are ad-free); no PII, no cookies, no cross-site tracking; Privacy Policy section 5.

### C-DEV-STANDARDS
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (section 4)
- type: operational policy
- content:
  - Data verification — scraped data must pass a verification layer (human or AI) before being seeded.
  - Security — never store accidentally captured PII.
  - Transparency — surface "Last Updated" timestamps on all meta-sensitive data (usage %, tiers).

---

## Technical Constraints (ADR — derived from locked decisions)

### C-TECH-PK-POKEAPI-IDS
- source: /Users/javiervega/projects/poke_comp/decisions.md (D001)
- type: schema contract
- content: Primary keys for `pokemon`, `moves`, `items`, `abilities` MUST be the corresponding PokeAPI integer IDs. No auto-increment, no surrogate keys.

### C-TECH-MOVEPOOL-ABILITIES-TEXT-ARRAY
- source: /Users/javiervega/projects/poke_comp/decisions.md (D002)
- type: schema contract
- content: `pokemon.movepool` and `pokemon.abilities` columns MUST be `TEXT[]` of names. No FK joins, no junction tables, at MVP.

### C-TECH-CHAMPIONS-OVERWRITES-BASELINE
- source: /Users/javiervega/projects/poke_comp/decisions.md (D003)
- type: data ingestion contract
- content: Champions-verified values overwrite PokeAPI baseline in place. Single column per field; no `base_*` vs `champions_*` dual columns.

### C-TECH-ITEMS-MANUAL-SEED
- source: /Users/javiervega/projects/poke_comp/decisions.md (D004)
- type: data ingestion contract
- content: `items` table is populated only by `seed_champions.py`. PokeAPI item import is explicitly out of scope.

### C-TECH-NO-SHARED-TYPES-DIR
- source: /Users/javiervega/projects/poke_comp/decisions.md (D005)
- type: code structure
- content: Pydantic models in `api/app/models/` are source of truth; TypeScript interfaces in `web/src/types/` mirror manually. No `shared/` directory; no OpenAPI codegen at MVP.

### C-TECH-TAILWIND-V4-CSS-FIRST
- source: /Users/javiervega/projects/poke_comp/decisions.md (D006)
- type: tooling contract
- content: All Tailwind tokens MUST live in `web/src/app/globals.css` `@theme` blocks. No `tailwind.config.ts`.

### C-TECH-NO-MONOREPO-TOOLING
- source: /Users/javiervega/projects/poke_comp/decisions.md (D007)
- type: tooling contract
- content: No nx, no turborepo, no Lerna. Two independent package managers (`uv` for Python, `pnpm` for JavaScript) within `api/` and `web/`.

### C-TECH-NEXT-IMAGE-UNOPTIMIZED
- source: /Users/javiervega/projects/poke_comp/decisions.md (D008)
- type: rendering contract
- content: Pokemon sprites rendered via `next/image` MUST set `unoptimized`. No domain config; no optimization pipeline for 96x96 pixel art.

### C-TECH-INGESTION-VOLATILITY-TIERED
- source: /Users/javiervega/projects/poke_comp/decisions.md (D009)
- type: data pipeline contract
- content: Ingestion sources are tiered:
  - Static (Serebii) — one-time / monthly cadence; base roster + VP shop.
  - Meta (Pikalytics) — weekly; usage stats, items, move trends.
  - Contextual (Limitless) — weekly; tournament team comps + matchup history.
- enforces: C-LEGAL-SOURCE-AUDIT (per-source delays, ToS posture).

---

## SPEC-Derived Constraints (proposed; not yet locked)

### C-SPEC-RAG-LATENCY-BUDGET
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md (section 3)
- type: NFR (proposed)
- content: Dual-RAG retrieval reads MUST add < 50ms to FastAPI response time when implemented.

### C-SPEC-RAG-INDEX-REQUIREMENT
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md (section 3)
- type: schema requirement (proposed)
- content: GIN indexes on JSONB columns containing `opponent_team_data` (in `matchup_log` and `tournament_teams`) are required to keep similarity lookups instant as data scales.

### C-SPEC-RAG-RLS-REQUIRED
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md (section 4, step 1)
- type: security requirement (proposed)
- content: `matchup_log` MUST be RLS-scoped to the current user; `tournament_teams` is global read but write-restricted to the ingest service role.

### C-SPEC-RAG-EMPTY-STATE
- source: /Users/javiervega/projects/poke_comp/rag-architecture.md (section 4, step 4)
- type: behavior contract (proposed)
- content: When the user has zero historical matches against an archetype, the AI Draft Helper MUST gracefully fall back to generic reasoning rather than emitting an empty `<user_personal_context>` block that confuses the model.
