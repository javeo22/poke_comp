# Context

Synthesized from PRD `champions-prd.md` (problem, goals, personas, success metrics) and DOC `LEGAL_AND_DEV_GUIDELINES.md` (project posture, ecosystem stance).

---

## Problem Statement
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 1)
- Pokemon Champions launched **2026-04-08** as a competitive battling platform with restricted movepools vs mainline games, item availability differences, no Terastallization at launch, and an evolving meta.
- Existing tools (Game8, Pikalytics, Pokepaste) are too generic, slow to update for Champions-specific data, or scattered across multiple sites.
- There is no single tool that combines personal roster tracking, Champions-specific build data, AI-powered matchup analysis, and a draft helper for team preview.

## Goals
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 2)
- Primary — Build a personal companion app that helps a competitive Pokemon Champions player make better decisions during team building and ranked battles.
- Secondary — Demonstrate AI Product Builder skills with a working portfolio piece. Open-source after MVP for community feedback.

## Non-goals
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 2)
- Automated battle bot.
- Tournament management system.
- Mainline VGC support.
- Mobile-first design.
- Multi-user accounts at MVP.

## Success Metrics
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 3)
- Personal usage at least 3x per week.
- Reduces "what should I draft against this team" decision time from minutes to seconds.
- Meta data no more than 7 days stale.
- Becomes the only Champions tool the primary user opens during play.

## User Personas
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 4)
- Primary — Solo competitive Champions doubles player, mid-ladder, building 2–3 teams.
- Secondary (post-MVP) — Other competitive Champions players who want personal roster tracking with AI assistance.

## Architecture Posture (from PRD, Apr 10 — see synthesis note)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 8)
- Frontend — Next.js 14 (App Router) + Tailwind CSS.
- Backend — Python FastAPI; PRD originally said "on Cloud Run", current production runs on Vercel Python Functions (see SYNTHESIS.md INFO note).
- Database — Supabase (PostgreSQL) with Row Level Security.
- AI — Anthropic Claude API (`claude-sonnet-4-6`).
- Static assets — Supabase Storage for sprite cache (PRD intent; codebase uses PokeAPI CDN directly with `next/image unoptimized` per D008).
- Scheduled jobs — PRD said "Cloud Scheduler triggering Python scrapers weekly"; current production uses Vercel Cron (see SYNTHESIS.md INFO note).
- Package managers — `uv` (Python), `pnpm` (JavaScript).

## Phasing (from PRD, Apr 10)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 10)
- Phase 0 (Week 1) — DB schema, Supabase setup, PokeAPI bulk import. Static reference data end-to-end.
- Phase 1 (Weeks 2–3) — Personal roster CRUD, Team Builder UI, basic team coverage analysis.
- Phase 2 (Weeks 4–5) — Meta tracker with manual update scripts, tier list scraper (now Smogon/Pikalytics, not Game8), first AI Draft Helper.
- Phase 3 (Weeks 6–7) — Matchup log, win-rate analytics, refined AI prompts, polish.
- Phase 4 (Week 8+) — Stretch features as time allows. Open-source release.

## Risks (PRD-acknowledged, with mitigations)
- source: /Users/javiervega/projects/poke_comp/champions-prd.md (section 11)
- Meta data stales faster than scraping — manual update workflow first; Claude API for parsing instead of brittle CSS selectors.
- Source-site HTML changes break scrapers — Claude-based parsing is resilient at "cents per update" cost.
- Scope creep kills the project — strict 8-week MVP timebox; F1–F6 only.
- Champions patches break data assumptions — version meta snapshots with dates; build update flows from day one.
- Audience too small for business case — treat as personal tool + portfolio piece; do not optimize monetization until 100+ active users.

## Open Questions (PRD section 12 — resolutions noted)
- Streamlit vs Next.js for MVP — RESOLVED: Next.js (long-term polish).
- AI analysis caching — RESOLVED: hash by team composition, 24h TTL (`ai_analyses.request_hash`).
- Open-source license — OPEN: MIT or Apache 2.0.
- Public landing page at MVP — RESOLVED: personal-only first.

## Project Posture / Ecosystem Stance (from DOC)
- source: /Users/javiervega/projects/poke_comp/LEGAL_AND_DEV_GUIDELINES.md (sections 1.D, 2, 3)
- Pokemon Champions is a brand-new title (launched 2026-04-08) — no fan-tool precedent yet; be conservative.
- The project is explicitly framed as a Fan Project; no affiliation with The Pokemon Company, Nintendo, or Game Freak.
- Transformative use (AI analysis + strategic guidance) is the primary fair-use defense.
- Monetization is donation/ad-supported only; never charge for raw data/stats.
- Public data-provenance ledger is required to defend against misappropriation claims.
- Game8 has been removed entirely from the data pipeline as of 2026-04-16 (HIGH risk per ToS audit). Tier data now sources from Smogon, Pikalytics, and Limitless.
