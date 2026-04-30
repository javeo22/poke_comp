# Design System Specification: Tactical Nostalgia & High-Gloss Futurism

## 1. Overview & Creative North Star: "The Orbital Archive"

The Creative North Star for this design system is **The Orbital Archive**. We are designing a digital constellation—a weightless, holographic interface floating in an infinite space. We have moved beyond the "chassis" of hardware into the pure energy of data. This system celebrates **Spatial Freedom** and **Momentum**.

To break the "standard template" look, we lean into **Dynamic Perspective** and **Atmospheric Depth**. Interaction shouldn't just be about clicks; it should be about shifting gravity. We achieve this through:
- **Perspective Displacement:** Main layout containers use CSS `perspective` and `translateZ` to pull content out of the screen.
- **Orbital Grouping:** Elements are not "mounted"; they hover in proximity. Clusters should feel like they are held together by mutual attraction.
- **High-Contrast Scales:** Use massive `display-lg` headers against ultra-refined `label-sm` metadata to create a premium, editorial feel.

## 2. Colors: Tonal Depth & The "Atomic" Glow

The palette is anchored by the rich, translucent depth of `primary_container` (#6667AB) set against a void-like `surface` (#12131D).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Traditional dividers are a sign of "template" thinking. Boundaries must be defined exclusively through background color shifts. Use `surface_container_low` for secondary content areas sitting on a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to create "nested" depth:
- **Base Layer:** `surface` (The "Dark Slate" chassis).
- **Secondary Well:** `surface_container_low` (Recessed areas of the hardware).
- **Interactive Component:** `surface_container_highest` (Raised buttons or modules).

### The "Glass & Gradient" Rule
To capture the "Atomic Purple" essence, floating elements (modals, dropdowns, primary cards) must use **Glassmorphism**:
- **Fill:** `primary_container` at 40-60% opacity.
- **Backdrop-Blur:** 12px to 20px.
- **Signature Gradient:** Main CTAs should use a linear gradient from `primary` (#C1C1FF) to `primary_container` (#6667AB) at a 135-degree angle to simulate a high-gloss plastic finish.

## 3. Typography: The Monospaced Editorial

This system utilizes a "High-Tech/High-Human" pairing. 

- **The Technical Voice (Space Grotesk):** Used for all Headers (`display`, `headline`, `label`). Its geometric, monospaced qualities evoke 90s BIOS screens and hardware manuals.
- **The Human Voice (Plus Jakarta Sans):** Used for all `body` and `title` scales. It provides the modern, readable balance necessary for a 2026 application.

**Hierarchy Note:** Use `label-md` in all-caps with increased letter-spacing (0.05rem) for technical metadata or "serial numbers" to lean into the retro-hardware aesthetic.

## 4. Elevation & Depth: Z-Axis Orbiting
 
Shadows in this system are not "drop shadows"—they are **Distance Indicators**.

- **The Orbital Principle:** Elements aren't just "higher"; they are "closer" to the lens. Use `translateZ` in combination with varying blur. 
- **Dynamic Shadows:** For floating panels, use a nested shadow technique to simulate deep distance: `box-shadow: 0 10px 20px rgba(0,0,0,0.1), 0 30px 60px rgba(0,0,0,0.05)`.
- **The refraction Rim:** Instead of a Ghost Border, use a 1px `linear-gradient` border at 20% opacity that mimics the "edge highlight" of curved glass.
- **The Gloss Factor:** Apply a subtle top-down inner highlight (1px, white at 10% opacity) to the top edge of purple containers to mimic light hitting a plastic edge.

## 5. Components: The Hardware Interface

### Buttons
- **Primary:** `primary_container` fill with a high-gloss gradient. `xl` (3rem) rounded corners. On hover, add a `secondary` (Neon Teal) outer glow.
- **Secondary:** Transparent fill with a `Ghost Border`. Use `Space Grotesk` for the label.
- **Tertiary:** Text-only using `tertiary` (Berry Red) for destructive actions or "Emergency Stop" style interactions.

### Chips & Glowing Indicators
- **Status Chips:** Use `secondary_container` for "Active" states. To simulate a GameBoy LED, include a 4px circle with a `box-shadow` glow of the same color.

### Input Fields
- **Styling:** Recessed look. Use `surface_container_lowest` with an inner shadow.
- **Focus State:** Transition the border-less container to have a 2px `secondary` glow.

### Cards & Lists
- **No Dividers:** Forbid the use of lines. Use `1.5rem` (`md`) vertical spacing to separate list items.
- **Circuit Patterns:** Use a tiled SVG of a circuit board (at 3% opacity) only within `surface_container_high` backgrounds to add "under-the-hood" texture.

### Additional Component: The "D-Pad" Navigation
For lateral navigation, use a clustered button group with `lg` (2rem) rounded corners, mimicking a physical directional pad, located in a fixed corner of the UI.

## 6. Do's and Don'ts

### Do:
- **Do** use `xl` corner radius (3rem) for main application containers to mimic the GameBoy hardware shell.
- **Do** lean into the Berry Red (`tertiary`) sparingly—it should feel like a specialized "Start/Select" button, reserved for critical actions.
- **Do** allow typography to breathe. Give headers ample margin-bottom.

### Don't:
- **Don't** use pure white (#FFFFFF). Use `on_surface` (#E2E1F1) to maintain the "Retro-OLED" feel.
- **Don't** use standard 4px or 8px border radii. If it’s not "Chunky" (`1rem`+) or "Pill" (`9999px`), it doesn't belong in this system.
- **Don't** use flat, opaque purple. If it's `primary_container`, it should almost always have a subtle transparency or gradient.