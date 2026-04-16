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

### C. Data Source Terms of Use Audit (2026-04-15)

| Source | Access Method | robots.txt | ToS | Risk | Action Required |
|--------|-------------|-----------|-----|------|-----------------|
| **PokeAPI** | Public REST API | Permissive | Open-source | LOW | None |
| **Pikalytics** | HTML scraping (1.5s delay) | AI-friendly, explicitly welcomes Claude/GPT | No scraping restrictions found | LOW | Safe to use |
| **Smogon/pkmn** | Public JSON API (pkmn.github.io) | Accessible | MIT license (code), attribution required | LOW | Ensure attribution |
| **Limitless TCG** | Public REST API (1s delay) | No robots.txt (404) | ToS not publicly accessible | MEDIUM | Verify API terms with Limitless support |
| **Serebii** | HTML scraping (0.5s delay, one-time) | Permissive (only blocks /hidden/) | No public ToS, all content copyrighted | MEDIUM | Email webmaster@serebii.net for permission |
| **Game8** | ~~HTML scraping -> Claude extraction~~ **REMOVED** | **Blocks GPTBot, dotbot, Google-Extended** | **Prohibits reverse engineering, unauthorized commercial use** | **HIGH** | **Scraper removed (2026-04-16)** |
| **Limitless VGC** | Public REST API (1s delay) | No robots.txt (404) | Public API, no explicit ToS; widely used by community tools | LOW-MEDIUM | Attribution required; monitor for ToS updates |

**Pikalytics note:** They attribute their own sprites to Smogon's Sprite Project. They provide dedicated `/ai/pokedex/` endpoints for AI access. No "do not scrape" clause found.

**Limitless note:** The Limitless VGC API is a public REST API used by many community tools (Victory Road, Pokemon tools). No published ToS or rate limit documentation found. We use a 1-second delay between requests and cache tournament data locally to minimize load.

**Game8 resolution (2026-04-16):** Scraper removed from codebase. Game8's robots.txt explicitly blocks AI bots and their ToS prohibits reverse engineering. Rather than risk legal issues, tier list data now comes exclusively from Smogon usage stats, Pikalytics tournament data, and Limitless tournament results. The `POST /meta/scrape` endpoint and `scripts/refresh_meta.py` Game8 functionality have been disabled.

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

---

## 4. Development Standards

- **Data Verification**: Any scraped data must go through a verification layer (human or AI) to ensure accuracy before being seeded into the application.
- **Security**: Never store scraped PII (Personally Identifiable Information) if it is accidentally captured.
- **Transparency**: Users should be able to see "Last Updated" timestamps for all meta-sensitive data (Usage %, Tiers, etc.).
