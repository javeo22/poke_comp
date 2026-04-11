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
