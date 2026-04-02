```markdown
# Design System Documentation: The Harmonic Resonance

## 1. Overview & Creative North Star
**Creative North Star: The Celestial Score**
This design system moves away from the "software tool" aesthetic and toward a "digital instrument" experience. Music theory is the study of invisible structures; therefore, the UI should feel like a luminous map of the stars. We achieve this through **The Celestial Score**—a philosophy where content is held together by gravity and light rather than rigid boxes and lines.

To break the "template" look, we utilize **Intentional Asymmetry**. Key headers should be oversized and occasionally bleed off-grid or overlap with background elements to create a sense of movement. We avoid the "flat" look by treating the Z-axis as a series of translucent, overlapping layers that mimic the complexity of a musical composition.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the deep, quiet energy of a late-night studio session.

### The Palette Roles
*   **Background (`#111125`):** The "void" or silence. All elements emerge from here.
*   **Primary (Lavender/Purple - `primary`):** Represents interaction and the "rhythm" of the app. Used for active states and primary pathways.
*   **Tertiary (Amber/Orange - `tertiary`):** Represents "harmonic highlights." Used sparingly for critical alerts, active chord states, or "Eureka" moments in the explorer.

### The "No-Line" Rule
**Lines are forbidden for sectioning.** Traditional 1px borders create visual noise that distracts from the mathematical beauty of music. 
*   **The Transition:** Boundaries must be defined solely through background color shifts. A `surface_container_low` section sitting on a `surface` background provides enough contrast to define a zone without the "jail cell" feeling of a border.
*   **Nesting:** Depth is created by "stepping" the surface tiers. A `surface_container_highest` card should sit inside a `surface_container_low` layout, creating a natural, soft lift.

### Signature Textures & Glassmorphism
*   **The Glass Rule:** Floating panels (like tooltips or navigation overlays) must use `surface_container` with a `backdrop-blur` (20px–40px) and a semi-transparent alpha. This makes the UI feel like it is floating within the deep indigo space.
*   **Vibrant Gradients:** Main CTAs should never be flat. Use a linear gradient from `primary` to `primary_container` (at a 135-degree angle) to give interactive elements a "glowing" soul.

---

## 3. Typography: Editorial Authority
We use typography to create a narrative hierarchy.

*   **Display & Headlines (`plusJakartaSans`):** Use these for "The Statement." Large, bold, and airy. These are your architectural anchors. 
    *   *Design Note:* Use `display-lg` for section headers with a letter-spacing of `-0.02em` to create a sophisticated, premium editorial feel.
*   **Body & Titles (`manrope`):** Chosen for its technical precision. It bridges the gap between the organic headers and the mathematical nature of music theory.
*   **Labels (`inter`):** Micro-copy and data points use Inter for maximum legibility at small scales (`label-sm`).

---

## 4. Elevation & Depth: Tonal Layering
In this design system, shadows and borders are replaced by **Ambient Light**.

### The Layering Principle
Hierarchy is achieved by stacking the surface-container tiers.
1.  **Level 0 (Background):** `surface`
2.  **Level 1 (Sectioning):** `surface_container_low`
3.  **Level 2 (Cards/Content):** `surface_container_highest`

### Ambient Shadows
When a component must float (e.g., a modal or a primary action button), use an **Extra-Diffused Shadow**:
*   **Blur:** 30px to 60px.
*   **Opacity:** 6%–10%.
*   **Color:** Tint the shadow using the `primary` or `on_surface` color rather than pure black. This mimics a glow rather than a drop shadow.

### The "Ghost Border" & Glow
For the signature Tonnetz explorer cards, we utilize the **Glow Border**. Instead of a solid line, use a CSS `linear-gradient` border from `primary` to `secondary` at 20% opacity. This creates a "subtle purple-to-blue glow" that defines the card’s edge through light, not structure.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`). Large corner radius (`full`). No border.
*   **Secondary:** Ghost style. No background fill, but uses the "Ghost Border" (`outline_variant` at 20% opacity).
*   **Tertiary/Amber:** Reserved for high-value highlights (e.g., "Correct Harmony" or "Record").

### Cards & Lists
*   **Rule:** Forbid divider lines. Use `1.4rem` (`spacing.4`) or `2rem` (`spacing.6`) of vertical white space to separate items.
*   **Interaction:** On hover, a card should shift from `surface_container_high` to `surface_container_highest` and increase its "Glow Border" opacity to 40%.

### Input Fields
*   **Style:** Avoid the "box" look. Use `surface_container_low` with a subtle `surface_container_highest` bottom-stroke.
*   **Focus State:** The bottom-stroke should expand into a `primary` glow.

### Additional Signature Components
*   **The Chord Node:** A circular interactive element using `tertiary_container` for active states. It should utilize a `backdrop-blur` to feel integrated into the Tonnetz grid.
*   **Visualizer Bars:** Use the `secondary_fixed_dim` color for a muted, professional look, peaking into `tertiary` for high-intensity frequencies.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use generous whitespace (`spacing.8` and above) to let the typography breathe.
*   **Do** overlap elements. Let a musical notation graphic sit 20px behind a text block to create depth.
*   **Do** use "Ambient Light" to guide the eye toward the `primary` lavender actions.

### Don’t
*   **Don't** use `#000000` for shadows. It kills the "deep navy" atmosphere.
*   **Don't** use standard Material Design "elevated" shadows. They look like legacy software.
*   **Don't** use 1px solid white or grey lines. If you feel you need a line, use a background color shift instead.
*   **Don't** crowd the interface. If a screen feels full, increase the spacing scale rather than shrinking the elements.

---

*This document is a living guide. When in doubt, ask: "Does this feel like a tool, or does it feel like a masterpiece?" Aim for the latter.*```