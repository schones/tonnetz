# Known Issues & Future Fixes — Education Layer

Track issues identified during development that aren't blocking current work but need attention before production.

## Resolved

### TonnetzNeighborhood.recenter() did not sync HarmonyState
- **Fixed:** 2026-03-16
- **Detail:** `recenter()` rebuilt the neighborhood graph and re-rendered the SVG, but did not call `HarmonyState.setTriad()`, so the keyboard view stayed stale. Added a guarded `setTriad()` call inside `recenter()` that checks whether `tonnetzCenter` already matches before updating, preventing infinite loops.

## To Fix Before Production

### Mobile viewport jitter
- **Source:** Gemini review, Phase 0
- **Detail:** `.tt-tooltip` uses `max-height: calc(100vh - 32px)`. On mobile Safari/Chrome, `vh` includes the collapsing address bar area, causing resize jitter. Replace with `dvh` (Dynamic Viewport Height).
- **Priority:** Medium — affects mobile UX

### Focus trapping / aria-modal
- **Source:** Gemini review, Phase 0
- **Detail:** When tooltip is open, keyboard Tab escapes behind the backdrop. Need focus trap inside `.tt-tooltip` and add `aria-modal="true"` to the container.
- **Priority:** Medium — accessibility requirement

### Z-index audit
- **Source:** Gemini review, Phase 0
- **Detail:** Tooltip uses `z-index: 9999`. Canvas games or overlay modals with higher values will cover tooltips. Audit and establish a z-index scale across the platform.
- **Priority:** Low — audit when integrating with canvas-based games

### stopPropagation collisions
- **Source:** Gemini review, Phase 0
- **Detail:** Tooltip relies on `document.addEventListener('click')`. Any game component using `event.stopPropagation()` will block `[data-theory]` triggers inside it. May need direct listeners or a different delegation strategy for embedded tooltips.
- **Priority:** Low — only relevant when embedding tooltips inside interactive game canvases

