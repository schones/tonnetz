# Tonnetz Project Status

**Last updated:** 2026-04-06
**Branch:** `redesign/landing-page` (active) · `dev` (prior work)
**Deploy:** Railway from `main`
**Active roadmap:** `docs/tonnetz-next-build-plan.md` (Post-MVP Build Plan v3)

---

## Current Focus

Landing page redesign and IA restructure in progress on `redesign/landing-page` branch.

**Completed this cycle:**

- New landing page: Explorer-centered hero with rotating song examples from song-examples.js
- Nav restructure: Explorer, Ear Training, Rhythm & Play, Patterns, Fundamentals (replaces previous nav groupings)
- Redesign spec: `docs/redesign-spec.md`

**Immediate next steps:**

1. Wire song example hooks into Explorer (clicking a song example loads it in Explorer)
2. Wire song example hooks into Chord Walks (clicking a progression launches a walk)
3. Showcase page build (screenshots + Claude Code build prompt)
4. Full component walkthrough — evaluate every feature, identify gaps
5. Fretboard panel polish — click-to-select notes, visual tuning
6. End-to-end walkthrough as new user → fix anything broken
7. Add BPM control to Swing Trainer
8. Security review + backend proxy check → deploy to main → share URL

---

## What's Working

### Tonnetz Explorer
- Three-panel tool at `/explorer`: Tonnetz neighborhood, chord wheel, keyboard
- All panels synchronized via HarmonyState pub/sub
- Chord-quality coloring (blue=major, coral=minor)
- Chord wheel: dual-ring circle of fifths with diatonic arc highlighting
- Audio playback via music-engine.js / Tone.js / Salamander sampler
- Canonical orientation locked: horizontal=P5, up-right=M3, down-right=m3, major=△, minor=▽

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
- `song-examples.js` — 73 curated real-song theory references (Song Examples DB v1.1 — added 6 swing feel entries with swing_ratio field)

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
- Nav restructured: Explorer, Ear Training, Rhythm & Play, Patterns, Fundamentals (redesign/landing-page branch)
- Active state highlighting on current page nav link
- First-visit dismissible banners on Explorer and Skratch Studio

### Showcase Page (in progress)
- Feature tour page at `/showcase` — designed in Google Stitch, Claude Code build prompt ready
- Page structure: Hero → Explorer (annotated screenshot + before/after) → Games → Skratch Studio → Real Songs → Footer CTA
- Design reference: Stitch export in `stitch-export/` (code.html, DESIGN.md, screen.png)
- Real screenshots with annotation overlays (not AI-generated mockups)
- Real song examples pulled from song-examples.js database
- Awaiting: screenshot captures, Claude Code build, iteration

### Games & Tools
- Harmony Trainer: tips pill, Tonnetz pop-out, education wiring
- Chord Walks: 4 tiers, Learn/Practice/Test, Explore mode
- Rhythm Lab: EKG-style metronome
- Strum Patterns: scrolling timeline
- Chord Spotter: chord quality identification
- Scale Builder: note-by-note scale construction
- **Swing Trainer** ✅ new: ear-training game for jazz swing feel — rotary knob, Gaussian waveform visualization, Practice/Test modes, 4-phase game loop, progressive scoring, session streak counter. At `/games/swing-trainer`. Standalone (not wired to HarmonyState). BPM fixed at 80 for now.
- Skratch Studio: Blockly + audio + music creation blocks
- Visual layer system (visual-config.js, visual-layer.js, visual-toggle.js)
- Theory pages wired into site nav and Theory Hub

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

- Swing Trainer: dial slightly finicky past midpoint (deferred)
- Swing Trainer: song-examples.js swing_ratio field not yet consumed by game
- Swing Trainer: not connected to HarmonyState (intentional for now)
- Games page: Rhythm section grouping (Harmony/Rhythm/Explorer) designed but not yet implemented — Swing Trainer added as flat card with RHYTHM tag
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
| `docs/tonnetz-next-build-plan.md` | **Active roadmap** — Phases A–F + B.5, Song Examples DB, dependency graph |
| `docs/redesign-spec.md` | Landing page redesign & IA restructure spec |
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