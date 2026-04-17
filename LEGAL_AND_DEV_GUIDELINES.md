# Legal and Development Guidelines

This document outlines the ethical and legal framework for the development and potential commercialization of the **Pokémon Champions Companion**.

## 1. Data Acquisition (Web Scraping)

To maintain a sustainable and ethical project, all data acquisition must follow these principles:

### A. Ethical Scraping
- **Respect `robots.txt`**: Always check the targeting site's `robots.txt` before implementing a scraper.
- **Rate Limiting**: Implement delays between requests to ensure no significant load is placed on source servers.
- **Attribution**: Clearly credit the source of the data (e.g., "Data sourced from PokéAPI / Smogon") within the UI and the codebase.
- **Avoid Authentication Bypassing**: Do not scrape data that is behind a login or payment gateway.

### B. Source Hierarchy
1. **Primary**: Open-source APIs (e.g., PokéAPI).
2. **Secondary**: Manual entry/verification from official game sources.
3. **Tertiary**: Scraped community meta-data (only when necessary and with attribution).

### C. Data Source Terms of Use Audit (last reviewed 2026-04-16, Workstream G)

| Source | Access Method | robots.txt | ToS | Risk | Last verified | Status |
|--------|-------------|-----------|-----|------|---------------|--------|
| **PokeAPI** | Public REST API | Permissive | Open-source | LOW | 2026-04-16 | Active |
| **Pikalytics** | HTML scraping (1.5s delay, 25 Pokemon cap) | AI-friendly, explicitly welcomes Claude/GPT | No scraping restrictions found | LOW | 2026-04-16 | Active |
| **Smogon/pkmn** | Public JSON API (pkmn.github.io) | Accessible | MIT license (code), attribution required | LOW | 2026-04-16 | Active |
| **Limitless VGC** | Public REST API (1s delay) | No robots.txt (404) | Public API, no explicit ToS; widely used by community tools | LOW-MEDIUM | 2026-04-16 | Active, attribution given |
| **Serebii** | HTML scraping (0.5s delay, one-time) | Permissive (only blocks /hidden/) | No public ToS, all content copyrighted | MEDIUM | 2026-04-16 | One-time seed only; no repeat scraping |
| **Game8** | ~~HTML scraping -> Claude extraction~~ **REMOVED** | **Blocks GPTBot, dotbot, Google-Extended** | **Prohibits reverse engineering, unauthorized commercial use** | **HIGH** | 2026-04-16 | **Removed -- zero references in live code, confirmed 2026-04-16** |

**Pikalytics note:** They attribute their own sprites to Smogon's Sprite Project. They provide dedicated `/ai/pokedex/` endpoints for AI access. No "do not scrape" clause found.

**Limitless note:** The Limitless VGC API is a public REST API used by many community tools (Victory Road, Pokemon tools). No published ToS or rate limit documentation found. We use a 1-second delay between requests and cache tournament data locally to minimize load.

**Serebii re-audit (2026-04-16):** Confirmed the scraper in `api/scripts/ingest/serebii_static.py` still enforces the original 0.5s `REQUEST_DELAY` between requests. This script is a one-time seed (movepools, abilities, mega data) and is not on any automated schedule -- no repeat fetches without manual invocation. No policy changes observed on serebii.net; recommend re-auditing if the one-time seed is ever re-run.

**Game8 removal confirmation (2026-04-16, Workstream G follow-up):**
- `api/scripts/refresh_meta.py` has had Game8 URLs stripped from `SOURCES`; the script is now a no-op scaffold documented as deprecated.
- Global code search (`api/app/**`, `api/scripts/**`, `web/src/**`) confirms zero remaining `game8` / `Game8` references in live code.
- Database cleanup: 3 stale Game8 rows deleted from `meta_snapshots` on 2026-04-16 via migration `20260418000000_clear_game8_snapshots.sql`.
- `CLAUDE.md` updated to reflect deprecation and remove `POST /meta/scrape` from the on-demand pipeline docs.
- Tier list data now comes exclusively from Smogon usage (`pokemon_usage.source='smogon'`), Pikalytics tournament data (`source='pikalytics'`), and Limitless tournament results (`tournament_teams.source='Limitless'`).

**Automation compliance (2026-04-16):** ingest scripts are now scheduled via Vercel Cron (`vercel.json`) at off-peak UTC hours with respectful delays already documented per source. All cron invocations pass `Authorization: Bearer $CRON_SECRET` (`api/app/routers/admin_cron.py`) -- no unauthenticated automated traffic to third-party sources.

---

### D. Pokemon Champions IP Considerations (2026-04-16)

Pokemon Champions launched April 8, 2026. As a new title:
- **No established fan tool precedent** yet -- be conservative with game-specific assets and mechanics
- **Competitive data** (tier lists, usage stats) is community-generated analysis, not copyrighted game content
- **Move/ability/item names** are trademarked but factual references are standard in fan tools (Bulbapedia, Smogon, Serebii all do this)
- **AI analysis** of team compositions is transformative use -- we generate strategic insight, not reproduced game content
- Monitor The Pokemon Company's stance on Champions community tools as the ecosystem matures

---

## 2. Intellectual Property (IP) Usage

The project utilizes trademarked and copyrighted assets belonging to **The Pokémon Company**, **Nintendo**, and **Game Freak**.

### A. Usage Boundaries
- **Non-Commercial Priority**: While the tool may eventually be public, the core platform should remain free/accessible to avoid direct competition with licensed products.
- **Sprites & Artwork**: Use "Fair Use" placeholders or official community-sourced sprites where available, ensuring they are not sold as part of a premium package.
- **Naming**: Ensure the project is clearly labeled as a **Fan Project** and is not affiliated with or endorsed by The Pokémon Company.

### B. Fair Use Defense
- **Transformative Purpose**: The primary value of this tool is **AI Analysis** and **Team Strategic Guidance**, which does not exist in the original games. This transformation of raw data into strategic insight is our strongest defense for Fair Use.

---

## 3. Monetization Strategy

If the project is released publicly, the following monetization guidelines apply to minimize legal risk:

- **Sell Analysis, Not Data**: Never charge for access to Pokémon stats or moves. If monetizing, charge for premium *features* (e.g., unlimited AI matchup logs, advanced cloud syncing, or custom theme engines).
- **Ad/Donation Model**: Prioritize ad-supported or donation-based (Patreon/BuyMeACoffee) models over strict SaaS subscriptions, as this is the industry standard for safe fan tools.
- **Transparency**: Maintain a public ledger of where data comes from to avoid "misappropriation" claims from other community sites.

### Third-Party Data Recipients (2026-04-16)

| Recipient | Purpose | Data Sent | PII? | Disclosed in |
|-----------|---------|-----------|------|--------------|
| **Anthropic (Claude API)** | AI draft/cheatsheet analysis | Team compositions, user-authored matchup notes (sanitized via `prompt_guard.py`) | No -- no user IDs, emails, or auth tokens sent to Anthropic | Privacy Policy Section 3 |
| **Supabase** | Database + auth hosting | All user data (encrypted at rest) | Yes (emails, auth identifiers) | Privacy Policy Section 3 |
| **Vercel** | Hosting + Analytics | Page views, performance metrics | No -- Vercel Analytics is privacy-first, no cookies, no cross-site tracking | Privacy Policy Section 3 |
| **Ko-fi** | Donations (supporter tier) | Only the Ko-fi username the supporter chooses to share | No -- we never receive payment card details | Privacy Policy Section 3 |
| **EthicalAds** | Contextual display ads (free tier only) | Page URL + user-agent for contextual matching | **No** -- ethicalads.io does not collect PII, use cookies, or cross-site track. Supporters are ad-free. | Privacy Policy Section 5 |

---

## 4. Development Standards

- **Data Verification**: Any scraped data must go through a verification layer (human or AI) to ensure accuracy before being seeded into the application.
- **Security**: Never store scraped PII (Personally Identifiable Information) if it is accidentally captured.
- **Transparency**: Users should be able to see "Last Updated" timestamps for all meta-sensitive data (Usage %, Tiers, etc.).
