# Tonnetz Project Status

**Last updated:** 2026-03-31
**Branch:** `dev`
**Deploy:** Railway from `main`
**Active roadmap:** `docs/tonnetz-next-build-plan.md` (Post-MVP Build Plan v3)

---

## Current Focus

Phase A complete. MVP polish sprint in progress — targeting shareable URL this week for user testing with 15–20 participants across 4 segments (curious players, producers, students/teachers, beginners).

**Immediate next steps:**

1. Verify Chapter 4 Tonnetz fix + test full chapter flow
2. Verify post-onboarding routing, end-of-chapter next-steps cards, first-visit banners, nav cleanup, returning user index state
3. Fretboard panel polish — click-to-select notes, visual tuning
4. End-to-end walkthrough as new user → fix anything broken
5. Deploy to main → share URL

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
- `song-examples.js` — 67 curated real-song theory references (Song Examples DB v1)

### Intro Module
- Chapter 1: Sound & Notes (4 sections)
- Chapter 2: Intervals & Scales (3 sections)
- Chapter 3: Chords & Progressions (4 sections)
- Chapter 4: Meet the Tonnetz — rebuilt on shared Explorer components (TonnetzNeighborhood, KeyboardView, ChordWheel via HarmonyState). Progressive panel reveal: Tonnetz only → + keyboard → + chord wheel.
- Chapter 5: Transforms (3 sections)
- Scrollytelling engine, dynamic Tone.js loader, intro-audio.js utilities
- End-of-chapter "What's Next" cards with contextual game/theory links (all 5 chapters)

### Onboarding & Navigation
- Onboarding preset cards (6 presets: beginner, dabbler, producer, curious_player, deep_diver, math_explorer)
- Post-onboarding routing: beginner→/intro, dabbler→/intro/2, producer→/intro/3, curious_player→/intro/4, deep_diver→/explorer, math_explorer→/explorer
- Returning user index page state: "Continue Chapter N" or "Course complete" based on intro progress
- Nav restructured: Theory dropdown, Explorer, Games dropdown (all 6 games), Skratch Studio, Start Here
- Active state highlighting on current page nav link
- First-visit dismissible banners on Explorer and Skratch Studio

### Games & Tools
- Chord Walks: 4 tiers, Learn/Practice/Test, Explore mode
- Harmony Trainer: tips pill, Tonnetz pop-out, education wiring
- Skratch Studio: Blockly + audio + music creation blocks
- Visual layer system (visual-config.js, visual-layer.js, visual-toggle.js)
- Theory pages wired into site nav and Theory Hub

### Education Infrastructure
- Onboarding & profile system (localStorage)
- Theory Hub page (34 topics, content type taxonomy)
- Phase 1 schema migration complete (content_type, difficulty, related_games, visualizations, creative_prompts)

### General
- Backend API proxy ✅ complete (Anthropic key server-side in app.py, client calls /api/chat only, .env gitignored)
- Phase A complete: A1 (Circle of Fifths) ✅, A2 (Tonal Centers) ✅, A3 (Modes) ✅, A4 (Chord Progressions) ✅, A5 (Voicing Explorer core) ✅

---

## Not Started

See `docs/tonnetz-next-build-plan.md` for the full phased roadmap:

- **Phase B:** Extract `game-flow.js` first, then Scale Builder, Note Name Trainer, Interval Spotter, Chord Progression Builder, Rhythm Tapper, Melody Dictation
- **Phase B.5:** Auth & Persistence — Supabase auth, profile migration, resolve Practice vs Test schema (B8), song preferences table
- **Phase C:** Curriculum paths, path runner UI, Tonnetz curriculum map, Song Examples DB v2 (preference feedback UI)
- **Phase D:** Differentiated experiences by user level (beginner/student/advanced modes, achievements)
- **Phase E:** AI-powered feedback (session analysis, cross-game competency graph, Song Examples DB v3)
- **Phase F:** Puzzle Paths (basic could ship earlier), MIDI input + Voicing Explorer Live Mode, Voicing Explorer advanced (sequence mode, voice leading, shape library, ProjectionEngine, ShapeDragger), fog of war, social features

---

## Known Issues

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
| `docs/tonnetz-explorer-spec.md` | Explorer design, panel specs, canonical orientation |
| `docs/voicing-explorer-spec.md` | Voicing Explorer — chord shapes, glow worm paths, projections, MIDI (future) |
| `docs/tonnetz-content-architecture.md` | Content model, topic schema, lens system, starters, challenges |
| `docs/game-flow-pattern.md` | Learn → Practice → Test pattern |
| `docs/auth-architecture.md` | Supabase auth, profile migration, security checklist |
| `docs/puzzle-paths-spec.md` | Puzzle Paths game concept and progression library |
| `docs/tonnetz-keyboard-component.md` | HarmonyState API, animation queue, component reuse |
| `docs/KNOWN-ISSUES.md` | Tracked bugs and fixes |
| `docs/claude-code-preferences.md` | Claude Code workflow conventions |
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
