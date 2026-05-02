# Phase 7: Homepage Resilience & "Regulation M-A" Dashboard - Research

**Researched:** 2026-05-02
**Domain:** UI/UX Polish, Frontend Resilience, Lab Dashboard Aesthetic
**Confidence:** HIGH

## Summary

This phase focuses on transforming the homepage from a generic landing page into a professional "Lab Dashboard" (Regulation M-A Dashboard). The goal is to increase information density, implement resilient fallbacks for meta trends, and adopt a high-tech "esports broadcast" aesthetic using specific CSS patterns and background mascots.

**Primary recommendation:** Adopt a "resiliency-first" approach by embedding `BASELINE_TRENDS` directly in the frontend and using Tailwind v4's CSS-first theme to implement a magenta-tinted dot-grid and scan-line overlay.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Background Mascots | Browser / Client | — | Visual assets rendered via `next/image` with low opacity. |
| Lab Dashboard Aesthetic | Browser / Client | — | CSS-driven effects (dot-grid, scan-lines, decorative brackets). |
| Baseline Fallbacks | Browser / Client | — | Hardcoded data structure ensuring the homepage never looks "empty". |
| Real-time Telemetry | API / Backend | Browser | Meta Trends API providing live usage and swing data. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Framework | App Router and `next/image` for performance. [VERIFIED: package.json] |
| Tailwind CSS | 4.x | Styling | CSS-first configuration and theme variables. [VERIFIED: globals.css] |
| Lucide React | 0.x | Icons | Consistent iconography for telemetry components. [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| PokeAPI Art | — | Assets | High-resolution 'official-artwork' for mascots. [VERIFIED: PokeAPI] |

## Architecture Patterns

### Recommended Project Structure
```
web/src/
├── app/
│   └── page.tsx        # Injection point for dashboard container
├── components/
│   ├── ui/
│   │   ├── lab-dashboard.tsx # New: Container with grid/scan-lines
│   │   └── telemetry-card.tsx # New: High-density data component
│   └── features/
│       └── meta/
│           └── baseline-trends.ts # New: Fallback data
```

### Pattern 1: Lab Dashboard Background
**What:** A 20px dot-grid with a magenta-to-purple radial fade and dimmed background mascots.
**Implementation:** 
- Use `::before` for the dot-grid pattern using `radial-gradient`.
- Use `::after` for the scan-line overlay using a repeating `linear-gradient`.
- Use absolute positioned `next/image` with `opacity-10`, `grayscale`, and `blur-sm`.

### Pattern 2: Resilient Baseline
**What:** Hardcoded "Champions Season M-1" data used as a fallback when the `/meta/trends` API is empty or failing.
**Why:** Prevents the "empty" look during initial load or API outages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mascot Sourcing | Custom scraper | PokeAPI Official Artwork | Reliable, high-res, and stable URLs. |
| Scan-line Animation | JS/Canvas | CSS linear-gradient | Better performance and simpler implementation. |
| Data Persistence | LocalStorage | Embedded Constants | Baseline trends should be instantly available on first paint. |

## Common Pitfalls

### Pitfall 1: Content Overlap
**What goes wrong:** Large background mascots can interfere with the readability of text in the foreground.
**Prevention:** Use `opacity-10` to `opacity-20`, `grayscale`, and ensure mascots are positioned away from central text blocks. Use `pointer-events-none`.

### Pitfall 2: Performance Regressions
**What goes wrong:** Adding large images and complex CSS gradients can increase LCP and CLS.
**Prevention:** Use `next/image` with `priority` and `fill` props. Set specific dimensions if possible or use `aspect-square`.

## Code Examples

### Dot-Grid & Scan-lines (CSS)
```css
/* Source: Derived from standard Lab Dashboard patterns */
.lab-dashboard-bg {
  position: fixed;
  inset: 0;
  background-color: var(--color-surface-lowest);
  background-image: 
    radial-gradient(circle at center, rgba(255, 45, 122, 0.15) 0%, transparent 70%),
    radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 100% 100%, 20px 20px;
}

.scan-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1) 0px,
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
}
```

### Baseline Trends Structure
```typescript
// web/src/features/meta/baseline-trends.ts
export const BASELINE_TRENDS: MetaTrend[] = [
  {
    id: 727,
    pokemon_name: "Incineroar",
    usage_percent: 78.4,
    previous_usage: 76.2,
    swing: 2.2,
    up: true,
    win_rate: 54.2,
    role: "Intimidate Pivot"
  },
  {
    id: 983,
    pokemon_name: "Kingambit",
    usage_percent: 42.1,
    previous_usage: 38.5,
    swing: 3.6,
    up: true,
    win_rate: 51.8,
    role: "Late-game Sweeper"
  }
  // ... add 4 more: Rillaboom, Amoonguss, Urshifu-RS, Gholdengo
];
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PokeAPI | Mascots | ✓ | v2 | Local placeholder |
| Meta API | Live Trends | ✓ | Phase 5 | `BASELINE_TRENDS` |
| Tailwind v4 | Aesthetic | ✓ | — | — |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Ensure fallback data is sanitized and hardcoded. |

## Sources

### Primary (HIGH confidence)
- `web/src/app/globals.css` - Verified theme and existing grid pattern.
- `api/app/models/meta.py` - Verified trend data structure.
- PokeAPI Official Artwork URLs - Verified existence of high-res Incineroar (727) and Kingambit (983).

### Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-05-02
**Valid until:** 2026-06-01
