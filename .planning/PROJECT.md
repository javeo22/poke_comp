# Pokemon Champions Companion

**One-line:** Personal companion app for the competitive Pokemon Champions player — combines roster tracking, team building, Champions-aware reference data, AI-powered draft analysis, and a matchup log in a single tool.

**Status:** MVP in flight (week ~4 of 8 — F1–F6 shipped, F7/F8 elevated and partially complete).
**Last bootstrap:** 2026-04-28
**Owner:** Solo developer (jav22vega@gmail.com)

---

## Project Type

Personal tool first, portfolio piece second. Open-source after MVP. No teams, no stakeholders — one human + Claude.

---

## Tech Stack

Derived from `.planning/codebase/STACK.md` and locked decisions D001–D010.

**Frontend:**
- Next.js 16.2.3 (App Router) + React 19.2.4
- Tailwind CSS v4 (CSS-first `@theme` config in `web/src/app/globals.css`; **no** `tailwind.config.ts` per D006)
- TanStack Query 5.x (server-state cache, `staleTime: 60s`)
- GSAP 3.x (entrance staggers, V2 design system)
- `next/font` for Inter + JetBrains Mono
- `next/image` with `unoptimized` for sprites (per D008)

**Backend:**
- Python 3.12 + FastAPI 0.115+
- Pydantic models in `api/app/models/` are the type source-of-truth (D005)
- Supabase Python client (no ORM — direct `supabase.table(...).select/.insert/.upsert`)
- `slowapi` rate limiting; `PyJWT` (ES256 + HS256 dual-mode in `api/app/auth.py`)
- 19 routers mounted in `api/app/main.py`

**Database:**
- Supabase (PostgreSQL 17, `pokecomp` project)
- Row Level Security on all user-scoped tables (`user_pokemon`, `teams`, `matchup_log`, `ai_usage_log`, `user_profiles`, `team_cheatsheets`, `strategy_notes`)
- 24 SQL migrations under `supabase/migrations/`
- PokeAPI integer IDs as primary keys for `pokemon`/`moves`/`items`/`abilities` (D001)

**Deployment (production runtime — locked by D010):**
- Vercel (frontend + Python function entry `api/index.py` strips `/api` prefix)
- Vercel Cron — 2 schedules (Hobby plan cap):
  - `/api/admin/cron/daily` at `0 8 * * *` → Limitless tournaments
  - `/api/admin/cron/weekly` at `0 6 * * 1` → Smogon → Pikalytics → validate-data
- Cloud Run scaffolding (`infra/Dockerfile.api`, `infra/cloudrun-api.yaml`) retained as legacy/emergency fallback only
- Domain: `pokecomp.app` (with `www.` alias)

**AI:**
- Anthropic Claude API (`claude-sonnet-4-6` default; `claude-haiku-4-5-20251001` Haiku fallback)

**Package managers:**
- `uv` (Python) in `api/`
- `pnpm@10.33.0` (JS) in `web/` — note Vercel install runs `npm install` so both lockfiles are present
- No monorepo tooling (D007)

**CI:**
- GitHub Actions `.github/workflows/ci.yml` — ruff lint+format, pyright, eslint, `tsc --noEmit`
- `.github/workflows/data_ingestion.yml` — Sunday 02:00 UTC backup ingest

---

## Goals

From `.planning/intel/context.md` and `champions-prd.md` section 2.

**Primary:** Build a personal companion app that helps a competitive Pokemon Champions player make better decisions during team building and ranked battles.

**Secondary:** Demonstrate AI Product Builder skills with a working portfolio piece. Open-source after MVP for community feedback.

---

## Non-goals

Explicit scope guards from `champions-prd.md` section 2.

- Automated battle bot.
- Tournament management system.
- Mainline VGC support (Champions-only — Champions has restricted movepools, item availability differences, and no Terastallization at launch).
- Mobile-first design (desktop-first; mobile is a stretch).
- Multi-user accounts at MVP (RLS is in place but onboarding flow is personal-only).

---

## Success Metrics

From `.planning/intel/requirements.md` (NFR-success-metrics) + `champions-prd.md` section 3.

- Personal usage at least 3x per week.
- Reduces "what should I draft against this team" decision time from minutes to seconds.
- Meta data no more than 7 days stale.
- Becomes the only Champions tool the primary user opens during play.
- 8-week MVP timebox honored (Apr 10 → Jun 5; F1–F6 + F7/F8 only inside the box).

---

## Personas

- **Primary:** Solo competitive Champions doubles player, mid-ladder, building 2–3 teams. (The dev.)
- **Secondary (post-MVP):** Other competitive Champions players who want personal roster tracking with AI assistance.

---

## Scope

**In MVP (this bootstrap):**
- F1 Personal Roster Manager
- F2 Team Builder
- F3 Static Reference Database
- F4 Meta Tracker (Smogon + Pikalytics + Limitless — **Game8 explicitly excluded**, see C-LEGAL-SOURCE-AUDIT)
- F5 AI Draft Helper (generic stateless today; RAG augmentation tracked as REQ-rag-augmentation)
- F6 Matchup Log
- **F7 Damage Calculator** (ELEVATED from stretch — `api/app/routers/calc.py` + `web/src/app/calc/`, in flight, untracked)
- **F8 Sprite + Speed-Tiers Reference** (ELEVATED from stretch — `web/src/components/ui/sprite-fallback.tsx` + `web/src/app/speed-tiers/`, in flight, untracked)

**Out of MVP (backlog):**
- F9–F15 (VP calc, counter-team builder, OCR, public sharing, Discord bot, push notifications)
- REQ-rag-augmentation (Dual RAG SPEC — proposed, separate roadmap phase)

---

## Ecosystem Stance

From `LEGAL_AND_DEV_GUIDELINES.md` and `.planning/intel/context.md`.

- Pokemon Champions launched 2026-04-08 — no fan-tool precedent yet; be conservative.
- Project is explicitly a **Fan Project**; no affiliation with The Pokemon Company, Nintendo, or Game Freak. Disclaimer in footer.
- Transformative use (AI analysis + strategic guidance) is the primary fair-use defense.
- Monetization is donation/ad-supported only (Ko-fi, EthicalAds); never charge for raw stats/data.
- Public data-provenance ledger required to defend against misappropriation claims.
- Game8 removed entirely from the data pipeline as of 2026-04-16 (HIGH risk per ToS audit). Tier data sources from Smogon, Pikalytics, Limitless. **Do not re-introduce.**

---

<decisions>

All ten decisions are LOCKED. Downstream phases cannot silently override them.

## D001 — PokeAPI integer IDs as primary keys
- locked: 2026-04-10
- scope: `pokemon`, `moves`, `items`, `abilities`
- decision: Use PokeAPI integer IDs directly as primary keys. No auto-increment, no mapping layer.
- source: `decisions.md` D001

## D002 — Denormalized movepool and abilities (TEXT[])
- locked: 2026-04-10
- scope: `pokemon` table — `movepool`, `abilities` columns
- decision: Store as `TEXT[]` of names on the `pokemon` row. No FK, no junction tables.
- source: `decisions.md` D002

## D003 — Champions data overwrites PokeAPI baseline
- locked: 2026-04-10
- scope: data ingestion — Champions vs mainline divergence
- decision: Single column per field; overwrite PokeAPI baseline with Champions-verified values. No `base_*` vs `champions_*` dual columns.
- source: `decisions.md` D003

## D004 — Items seeded manually
- locked: 2026-04-10
- scope: `items` table — population strategy
- decision: Seed Champions items via `api/scripts/seed_champions.py`. No PokeAPI item import.
- source: `decisions.md` D004

## D005 — No shared types directory; manual mirror
- locked: 2026-04-10
- scope: type sharing across Python ↔ TypeScript
- decision: Pydantic in `api/app/models/` is source of truth; `web/src/types/` is a manual mirror. No `shared/`, no OpenAPI codegen at MVP.
- source: `decisions.md` D005

## D006 — Tailwind CSS v4 with CSS-first `@theme` config
- locked: 2026-04-10
- scope: design system configuration
- decision: All tokens live in `web/src/app/globals.css` `@theme` blocks. No `tailwind.config.ts`.
- source: `decisions.md` D006

## D007 — No monorepo tooling
- locked: 2026-04-10
- scope: repo orchestration
- decision: Two independent package managers (`uv`, `pnpm`) in `api/` and `web/`. No nx, turborepo, Lerna.
- source: `decisions.md` D007

## D008 — `next/image` with `unoptimized` for sprites
- locked: 2026-04-10
- scope: image rendering for Pokemon sprites
- decision: `next/image` with `unoptimized` prop for PokeAPI sprite URLs.
- source: `decisions.md` D008

## D009 — Multi-source data ingestion strategy (volatility-tiered)
- locked: 2026-04-12
- scope: external data sources
- decision: Three tiers — Static (Serebii, one-time/monthly), Meta (Pikalytics, weekly), Contextual (Limitless, weekly). Tier-by-tier ToS audit binds cadence.
- source: `decisions.md` D009

## D010 — Vercel Python Functions + Vercel Cron is the production runtime
- locked: 2026-04-28 (this bootstrap)
- scope: production runtime + scheduled jobs
- decision: FastAPI is deployed as a Vercel Python Function via `api/index.py` (strips `/api` prefix). Scheduled ingest runs on Vercel Cron with the 2-schedule cap consolidated in `vercel.json`. The Cloud Run config (`infra/Dockerfile.api`, `infra/cloudrun-api.yaml`) is retained as legacy/emergency fallback only and is not the deploy target.
- rationale: Single-platform deploy + native cron + edge cache + simpler env management. Hobby cron cap (2 schedules) accepted; consolidated daily/weekly aggregators already shipped (`api/app/routers/admin_cron.py`).
- supersedes: `champions-prd.md` section 8 ("Backend: Python FastAPI on Cloud Run" / "Cloud Scheduler triggering Python scrapers weekly"). The PRD's narrative architecture predates the migration; this ADR pins the new reality.
- source: orchestrator-confirmed bootstrap decision; INFO note from `INGEST-CONFLICTS.md` resolved.

</decisions>

---

## Constraints Summary

Full detail in `.planning/intel/constraints.md`. Headlines:

**Legal / IP / Operational (non-negotiable, regardless of precedence rank):**
- C-LEGAL-ETHICAL-SCRAPING — robots.txt, rate limits, attribution; no auth/paywall bypass.
- C-LEGAL-SOURCE-HIERARCHY — open APIs > manual entry > scraped data with attribution.
- **C-LEGAL-SOURCE-AUDIT (2026-04-16)** — per-source rulings:
  - PokeAPI / Pikalytics / Smogon — LOW risk, ACTIVE.
  - Limitless — LOW–MEDIUM, ACTIVE with attribution.
  - Serebii — MEDIUM, ONE-TIME SEED ONLY.
  - **Game8 — HIGH, REMOVED. Do not re-introduce.**
- C-LEGAL-AUTOMATION-COMPLIANCE — all cron via `Authorization: Bearer $CRON_SECRET`.
- C-LEGAL-CHAMPIONS-IP — conservative IP posture; transformative-use defense.
- C-LEGAL-IP-USAGE — non-commercial priority; Fair Use placeholders for assets.
- C-LEGAL-MONETIZATION — donations/ads only; never charge for raw data.
- C-LEGAL-THIRD-PARTY-RECIPIENTS — Anthropic, Supabase, Vercel, Ko-fi, EthicalAds disclosed in Privacy Policy.
- C-DEV-STANDARDS — verification layer for scraped data; no PII storage; "Last Updated" timestamps on meta-sensitive UI.

**Technical (ADR-derived, schema/code contracts):**
- C-TECH-PK-POKEAPI-IDS, C-TECH-MOVEPOOL-ABILITIES-TEXT-ARRAY, C-TECH-CHAMPIONS-OVERWRITES-BASELINE, C-TECH-ITEMS-MANUAL-SEED, C-TECH-NO-SHARED-TYPES-DIR, C-TECH-TAILWIND-V4-CSS-FIRST, C-TECH-NO-MONOREPO-TOOLING, C-TECH-NEXT-IMAGE-UNOPTIMIZED, C-TECH-INGESTION-VOLATILITY-TIERED.

**SPEC-derived (proposed, gate REQ-rag-augmentation):**
- C-SPEC-RAG-LATENCY-BUDGET (< 50ms added by Dual RAG retrieval).
- C-SPEC-RAG-INDEX-REQUIREMENT (JSONB GIN indexes on `opponent_team_data`).
- C-SPEC-RAG-RLS-REQUIRED (`matchup_log` RLS-scoped; `tournament_teams` global read, ingest-write).
- C-SPEC-RAG-EMPTY-STATE (graceful 0-history fallback; never emit empty `<user_personal_context>`).

---

## Working Conventions

From `CLAUDE.md`. Hard-pinned for every phase:

- **IDs:** PokeAPI integer IDs as primary keys (echoes D001).
- **Names:** Title Case ("Thunder Punch", not "thunder-punch").
- **No ORM:** Direct Supabase client queries; SQL migrations.
- **Borders:** 1px solid `outline-variant` on cards, panels, inputs.
- **Radii:** 0.875rem cards, 0.5rem buttons/inputs, 9999px badges/dots only.
- **Text color:** Use `on-surface` (#EDE9F4); never pure white.
- **V2 design system (Apr 27):** Magenta/gold/purple esports broadcast theme. `#0a0510` near-black background. Magenta `#FF2D7A` (primary/live/danger), gold `#FFD23F` (CTA), purple `#7E22CE` (AI/contextual), green/amber for success/warning. Inter + JetBrains Mono. No glassmorphism, no 3D perspective.
- **Brand mark:** 30×30 conic-gradient tile (magenta → purple → gold) wrapping near-black square with gold "P". Never use Pokeball/Nintendo IP.
- **Disclaimer:** "A solo fan project. Not affiliated with The Pokemon Company, Nintendo, or Game Freak." in footer + closing CTA.

---

## Source-of-Truth Map

- **PROJECT.md (this file)** — pinned context for every phase; locked decisions.
- **REQUIREMENTS.md** — F1–F8 MVP, F9–F15 backlog, REQ-rag-augmentation, NFRs.
- **ROADMAP.md** — forward-only phases (no backfill of shipped work).
- **STATE.md** — current position, active phase, last update.
- **`.planning/intel/`** — synthesized ingest (decisions, requirements, constraints, context).
- **`.planning/codebase/`** — observed-from-code maps (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS).
- **`CLAUDE.md`** — operating conventions for human + Claude collaboration.
- **Live Supabase DB** — source of truth for static game data from 2026-04-17 onward (per `CLAUDE.md` Data Pipeline section).
