# Known Issues & Future Fixes — Education Layer

Track issues identified during development that aren't blocking current work but need attention before production.

## Resolved

### TonnetzNeighborhood.recenter() did not sync HarmonyState
- **Fixed:** 2026-03-16
- **Detail:** `recenter()` rebuilt the neighborhood graph and re-rendered the SVG, but did not call `HarmonyState.setTriad()`, so the keyboard view stayed stale. Added a guarded `setTriad()` call inside `recenter()` that checks whether `tonnetzCenter` already matches before updating, preventing infinite loops.

## To Fix Before Production

### Swing Trainer 500 on Railway — cannot reproduce locally
- **Reported:** STATUS.md, code-review-opus47.md §5
- **Status:** unreproducible as of 2026-04-17
- **Detail:** `/games/swing-trainer` returns 500 on Railway production but
  renders cleanly (200) locally under both werkzeug (`python3 app.py`) and
  gunicorn (`gunicorn app:app`). STATUS.md previously claimed the template
  didn't extend `base.html`; that's stale — `templates/games/swing-trainer.html`
  does extend it (verified commit `bf102a9`, "Fix swing trainer template
  location"). The template file is byte-identical between `main` and `dev`,
  every referenced static asset (`design-tokens.css`, `styles.css`,
  `game-shell.css`, `audio-toggle.js`) returns 200, and the route handler is a
  one-liner `render_template` with no Python-side branching that could fail.
- **Most likely cause:** Railway deploy artifact — e.g. the slug was built
  before `templates/games/` existed, or the deploy is pinned to an older
  commit. The orphan duplicate at `static/games/swing-trainer.html` was
  deleted this pass so it can't shadow the template again.
- **Next step:** trigger a fresh Railway deploy from `main` and pull the
  server log. If the 500 persists, capture the Railway stack trace — that's
  the missing signal; everything else has been ruled out.
- **Priority:** High — game is linked from main nav and landing page

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

