# Phase 7: Homepage Resilience & "Regulation M-A" Dashboard

## Goal
Fix the "empty" look of the homepage by adopting a professional "Lab Dashboard" aesthetic, implementing 100% accurate baseline fallbacks from the actual Champions Season M-1 data, and increasing information density with real-time Regulation M-A telemetry.

## Key Changes

### 1. Data Resiliency (Strict Roster & Tiers)
- **Baseline Meta:** Define a `BASELINE_TRENDS` constant using the actual S-Tier and A+ Tier Pokemon from `seed_champions.py`: **Incineroar, Kingambit, Garchomp, Dragonite, Glimmora, and Sinistcha.**
- **Tier-Centric UI:** Add a prominent "S-TIER" and "A+ TIER" badge to trending Pokemon cards.
- **Reference Match:** If match history is empty, show a "Reference: Regulation M-A Lead" matchup (e.g., Incineroar/Kingambit vs. Garchomp/Torkoal).

### 2. "Regulation M-A" Dashboard Integration
- **Context Card:** Add a prominent, full-width dashboard panel below the Hero titled **"CURRENT REGULATION: M-A (SEASON M-1)"**.
- **Rules Display:** List specific Champions rules (Doubles, Level 50, No Duplicates, Mega Evolution Only).
- **Site Telemetry:** Show live site stats styled as "SYSTEM TELEMETRY" with scan-line effects.

### 3. Visual Density (Ending the "Black Void")
- **Background Mascots:** Use dimmed, large-scale **Incineroar** or **Kingambit** artwork behind Hero text.
- **Esports Grid:** Apply a 20px dot-grid background with a magenta-to-purple radial fade.
- **Frame Corner Brackets:** Add decorative brackets to boards for "Laboratory Feed" look.

### 4. Interactive Hero Polish
- **Quick Draft Bar:** Wider/taller input with "Quick Picks" pills for Top 3 S-Tier mons.
- **Navigation:** Elevate "Browse Pokedex" as a primary dashboard action.

## Success Criteria
1. Homepage looks "full" and professional even on zero-data local installs.
2. NO hallucinations (Metagross, old regs) remain in the UI.
3. Every board has "Reference" data fallbacks that look like live data.
4. UI density is increased by 30-40% through decorative telemetry and background textures.
