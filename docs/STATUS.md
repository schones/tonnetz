# Tonnetz Project Status

**Last updated:** 2026-04-09
**Branch:** `dev` (active — SongLab redesign in progress) · `main` (prod)
**Deploy:** Railway from `main`
**Active roadmap:** `docs/songlab-redesign-plan.md` + `docs/tonnetz-next-build-plan.md`
**Platform name:** SongLab (rebrand from "Music Theory Games" in progress)

---

## Current Focus

SongLab redesign on `dev`. Skratch Studio integration merged in. Explorer DAW redesign complete; remaining surfaces (Skratch Studio DAW, games, branding sweep) still to do before deploy.

**Completed this cycle:**

- **Skratch Studio integration** (merged from `feature/skratch-integration` → `dev`):
  - Code review and fixes on Antigravity-built integration
  - Deduplicated PLR transform math (now imports from `transforms.js`)
  - Removed dead `drawCanvasGrid` code
  - Fixed MIDI export BPM header + drum skip warning
  - Refactored Explorer→Skratch bridge: real-time click streaming → record-and-export pattern
  - Walkthroughs auto-capture progression; free exploration has record/stop toggle
  - Export uses `sessionStorage` + `window.open` (no need to pre-open Skratch Studio)
  - Swapped PolySynth → Salamander piano sampler for chord playback
  - Renamed `/skratch` → `/skratch-studio`
  - Renamed `/games/relative-key-trainer` → `/games/chord-walks`
  - Sound defaults to ON across all pages
  - Added Skratch Studio card to landing page
- **SongLab rebrand kickoff**: "Music Theory Games" → "SongLab"
- **Design tokens**: created `static/css/design-tokens.css` (light/dark theme system, color tokens, fluid typography)
- **Landing page redesign**: MIDI pad song grid, warm light theme, SongLab branding
- **Explorer full redesign**:
  - DAW-style dark theme with transport controls and song info bar
  - Walkthrough sidebar replacing floating overlay bubble
  - Tonnetz animations: pulsing nodes, glow worm paths, ghost trails
  - Chord quality color families (blue=major, green=minor, coral=borrowed)
  - Panel tabs (Tonnetz / Chord Wheel / Fretboard) wired and working
  - "Begin" button for audio activation
  - Harmonic function labels on walkthrough steps
  - Fixed chord wheel visibility behind other panels
- **Planning docs added**:
  - `docs/songlab-redesign-plan.md` — full implementation plan with CSS tokens
  - `docs/tonnetz-next-phase-plan.md` — walkthroughs, song packs, copyright, aesthetics
  - `docs/visual-engine-spec.md` — generative art engine driven by Tonnetz geometry

**Immediate next steps:**

1. Explorer prompt 2 fixes: test all walkthroughs end-to-end, verify ghost trails
2. Skratch Studio DAW redesign (Phase 4)
3. Games + remaining pages: light theme + design tokens (Phase 5)
4. SongLab branding sweep across all pages (Phase 6)
5. Deploy to Railway as SongLab
6. User testing with 15–20 participants
7. Visual engine implementation (post-launch — see `docs/visual-engine-spec.md`)
8. Fix Swing Trainer 500 error on production
9. Polish, merge `dev` → `main`

---

## What's Working

### Tonnetz Explorer ✅ DAW redesign
- DAW-style dark theme at `/explorer`: transport controls, song info bar, walkthrough sidebar
- Tabbed panel area: Tonnetz / Chord Wheel / Fretboard (all wired and synchronized via HarmonyState)
- Chord-quality color families: blue=major, green=minor, coral=borrowed
- Tonnetz animations: pulsing nodes, glow worm paths, ghost trails
- "Begin" button for audio context activation
- Harmonic function labels on walkthrough steps
- Audio via music-engine.js / Tone.js / Salamander sampler (sound defaults to ON)
- Canonical orientation locked: horizontal=P5, up-right=M3, down-right=m3, major=△, minor=▽
- Deep-linking via URL params: ?root=, ?quality=, ?progression=, ?walkthrough=
- Record-and-export bridge to Skratch Studio (sessionStorage + window.open)

### Guided Walkthrough System ✅ sidebar
- Walkthrough sidebar in Explorer (replaced floating overlay bubble) driven by `static/shared/walkthroughs.js`
- 8 song-based walkthroughs: Yesterday voice leading, Am/C relationship (Eleanor Rigby), Creep chromatic mediant, ii-V-I jazz, Mixolydian (Norwegian Wood/Get Lucky), Stairway P transform, deceptive cadence (In My Life), twelve-bar blues
- Each step sets chord state via HarmonyState, auto-plays audio, shows conversational explanation with harmonic function label
- Panel focus: individual steps can dim non-relevant panels
- "You'll also hear this in..." pulls related songs from song-examples.js by matching concept_specifics
- "seeAlso" links on final steps nudge users toward relevant games
- Walkthroughs auto-capture progression for one-click export to Skratch Studio
- Launched from landing page example prompts via /explorer?walkthrough=<id>

### Skratch Studio Integration ✅ new
- `/skratch-studio` route (renamed from `/skratch`)
- Record-and-export pattern: Explorer captures progression → exports via sessionStorage → Skratch Studio opens with session preloaded
- Free exploration has record/stop toggle
- PLR transform math deduplicated — imports from `transforms.js`
- MIDI export: BPM header + drum skip warning fixes
- Skratch Studio card on landing page
- DAW redesign still pending (Phase 4)

### Landing Page & Navigation ✅ SongLab rebrand
- Warm light-theme landing page with MIDI pad song grid and SongLab branding
- Hero tagline, subtitle about musical intuition, 2×2 category grid, Fundamentals footer link
- Skratch Studio card alongside Explorer entry
- Nav: Explorer, Ear Training (dropdown), Rhythm & Play (dropdown), Patterns (dropdown), Fundamentals
- No instance of "theory" in user-facing UI
- `/games/chord-walks` (renamed from `/games/relative-key-trainer`)

### Design System ✅ new
- `static/css/design-tokens.css` — light/dark theme tokens, color palette, fluid typography
- Explorer fully on the dark token set; remaining surfaces still to migrate (Phase 5)

### Voicing Explorer (Phase A5 — core complete)
- Note Mode: toggle individual notes on/off across all three panels
- Octave-specific note selection on keyboard (voicing control)
- Compact cluster highlighting on Tonnetz (one node per pitch class, tightest grouping)
- Glow worm path visualization: luminous trail connecting chord tones low-to-high on Tonnetz
- ChordResolver: identifies chord names from arbitrary note sets, interval-content fallback for non-standard voicings
- Chord wheel sync: highlights recognized chord and re-centers diatonic arc on assembled chord's key
- Play button + spacebar shortcut for hearing assembled voicings
- All three panels synchronized bidirectionally via HarmonyState in both Chord Mode and Note Mode
- Remaining MVP items (ProjectionEngine, ShapeDragger) deferred to Phase F

### Chord Progression Engine
- Multi-path glow worm visualization (animated playthrough with fading trails)
- Fixed Tonnetz center during progression playback
- Common-tone highlighting between chord transitions
- Transport: startPlayback, stopPlayback, stepProgression, resetPlayback
- Progression state management in HarmonyState

### Fretboard Panel
- Composable Explorer panel at static/shared/fretboard-view.js
- Multi-position highlighting with practical voicing clusters
- Keyboard/Fretboard/Both toggle on Explorer
- Test page at /test/fretboard

### Shared Components
- `transforms.js` — PLR math, pitch utilities, interval utilities
- `harmony-state.js` — pub/sub state model
- `tonnetz-neighborhood.js` — SVG renderer with chord-quality coloring
- `keyboard-view.js` — highlight layer, click interaction
- `chord-wheel.js` — dual-ring circle of fifths
- `song-examples.js` — 73 curated real-song references (Song Examples DB v1.1 — added 6 swing feel entries with swing_ratio field)
- `walkthroughs.js` — 8 guided Explorer walkthroughs with step data, panel focus, and concept_specifics tags

### Intro Module
- Chapter 1: Sound & Notes (4 sections)
- Chapter 2: Intervals & Scales (3 sections)
- Chapter 3: Chords & Progressions (4 sections)
- Chapter 4: Meet the Tonnetz — rebuilt on shared Explorer components
- Chapter 5: Transforms (3 sections)
- Scrollytelling engine, dynamic Tone.js loader, intro-audio.js utilities
- End-of-chapter "What's Next" cards with contextual game/theory links (all 5 chapters)

### Onboarding & Navigation
- Onboarding preset cards (6 presets)
- Post-onboarding routing to appropriate entry point
- Returning user index page state
- Active state highlighting on current page nav link
- First-visit dismissible banners on Explorer and Skratch Studio

### Showcase Page (in progress)
- Feature tour page at `/showcase` — designed in Google Stitch, Claude Code build prompt ready
- Page structure: Hero → Explorer (annotated screenshot + before/after) → Games → Skratch Studio → Real Songs → Footer CTA
- Design reference: Stitch export in `stitch-export/` (code.html, DESIGN.md, screen.png)
- Awaiting: screenshot captures, Claude Code build, iteration

### Games & Tools
- Harmony Trainer: tips pill, Tonnetz pop-out, education wiring
- Chord Walks: 4 tiers, Learn/Practice/Test, Explore mode
- Rhythm Lab: EKG-style metronome
- Strum Patterns: scrolling timeline
- Chord Spotter: chord quality identification
- Scale Builder: note-by-note scale construction
- **Swing Trainer**: ear-training game for jazz swing feel — rotary knob, Gaussian waveform visualization, Practice/Test modes, 4-phase game loop, progressive scoring, session streak counter. At `/games/swing-trainer`. Standalone (not wired to HarmonyState). BPM fixed at 80 for now.
- Skratch Studio: Blockly + audio + music creation blocks
- Visual layer system (visual-config.js, visual-layer.js, visual-toggle.js)

### Education Infrastructure
- Onboarding & profile system (localStorage)
- Theory Hub page (34 topics, content type taxonomy)
- Phase 1 schema migration complete

### General
- Backend API proxy ✅ complete (Anthropic key server-side in app.py, client calls /api/chat only, .env gitignored)
- Phase A complete: A1 ✅ A2 ✅ A3 ✅ A4 ✅ A5 ✅

---

## Not Started

See `docs/tonnetz-next-build-plan.md` for the full phased roadmap:

- **Phase B:** Extract `game-flow.js` first, then Scale Builder, Note Name Trainer, Interval Spotter, Chord Progression Builder, Rhythm Tapper, Melody Dictation
- **Phase B.5:** Auth & Persistence — Supabase auth, profile migration, resolve Practice vs Test schema (B8), song preferences table
- **Phase C:** Curriculum paths, path runner UI, Tonnetz curriculum map, Song Examples DB v2 (preference feedback UI)
- **Phase D:** Differentiated experiences by user level
- **Phase E:** AI-powered feedback (session analysis, cross-game competency graph, Song Examples DB v3)
- **Phase F:** Puzzle Paths, MIDI input, Voicing Explorer advanced, fog of war, social features

---

## Known Issues

- **Swing Trainer 500 on production** — route returning server error, needs investigation before deploy
- Swing Trainer: dial slightly finicky past midpoint (deferred)
- Swing Trainer: song-examples.js swing_ratio field not yet consumed by game
- Swing Trainer: not connected to HarmonyState (intentional for now)
- Walkthrough card UI: needs polish pass (sizing, transitions, mobile responsiveness)
- Sustain pedal bug: Organ/Synth in Skratch Studio — `triggerAttackRelease` bypasses sustain state
- Mobile viewport jitter: tooltip uses `100vh` instead of `dvh`
- Focus trapping / aria-modal missing on tooltips
- Z-index audit needed across platform
- stopPropagation collisions with tooltip click delegation
- Mobile/responsive not tested — deferred to post-MVP
- Skratch Studio: "Clear All" button clears blocks but not canvas — needs canvas reset
- Full list: `docs/KNOWN-ISSUES.md`

---

## Key Docs

| Doc | Purpose |
|---|---|
| `docs/songlab-redesign-plan.md` | **Active roadmap** — SongLab rebrand & redesign plan with CSS tokens |
| `docs/tonnetz-next-phase-plan.md` | Walkthroughs, song packs, copyright, aesthetics roadmap |
| `docs/visual-engine-spec.md` | Generative art engine spec (Tonnetz-driven, post-launch) |
| `docs/tonnetz-next-build-plan.md` | Post-MVP build plan (Phases A–F + B.5, Song Examples DB) |
| `docs/redesign-spec.md` | Prior landing page redesign & IA restructure spec |
| `docs/tonnetz-explorer-spec.md` | Explorer design, panel specs, canonical orientation |
| `docs/voicing-explorer-spec.md` | Voicing Explorer — chord shapes, glow worm paths, projections, MIDI (future) |
| `docs/tonnetz-content-architecture.md` | Content model, topic schema, lens system, starters, challenges |
| `docs/game-flow-pattern.md` | Learn → Practice → Test pattern |
| `docs/auth-architecture.md` | Supabase auth, profile migration, security checklist |
| `docs/puzzle-paths-spec.md` | Puzzle Paths game concept and progression library |
| `docs/tonnetz-keyboard-component.md` | HarmonyState API, animation queue, component reuse |
| `docs/KNOWN-ISSUES.md` | Tracked bugs and fixes |
| `docs/claude-code-preferences.md` | Claude Code workflow conventions |
| `stitch-export/` | Showcase page design reference (Stitch HTML, DESIGN.md, screen.png) |
| `claude-code-prompt-showcase.md` | Claude Code build prompt for /showcase page |
| `docs/archive/tonnetz-build-plan.md` | Original 10-phase plan (superseded) |
| `docs/archive/tonnetz-mvp-tracker.md` | Original MVP tracker (superseded) |

---

## Update Protocol

After every work session:
1. Update "Last updated" date
2. Update "Current Focus" with what's active and what's next
3. Move completed items into "What's Working"
4. Add new bugs to "Known Issues"
5. Commit: `git add STATUS.md && git commit -m "Update project status"`
