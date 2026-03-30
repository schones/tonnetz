# Tonnetz Project Status

**Last updated:** 2026-03-30
**Branch:** `dev`
**Deploy:** Railway from `main`
**Active roadmap:** `docs/tonnetz-next-build-plan.md` (Post-MVP Build Plan v3)

---

## Current Focus

MVP baseline is nearly complete (intro module chapters 1–3, Explorer, Chord Walks, Harmony Trainer, Skratch Studio). Starting Phase A (missing foundational concepts) while finishing the last MVP items (backend proxy, intro chapter 4 rebuild, polish).

**Immediate next steps:**



1. Guitar instrument option (in progress)
2. Fretboard panel polish — click-to-select notes, visual tuning
3. Intro module chapter 4 rebuild on Explorer components
4. Polish pass — landing page, navigation, first-visit experience


**Goal:** Shareable URL within 1–2 weeks, followed by user testing with 15–20 participants across 4 segments (curious players, producers, students/teachers, beginners).

---

## What's Working

### Tonnetz Explorer
- Three-panel tool at `/explorer`: Tonnetz neighborhood, chord wheel, keyboard
- All panels synchronized via HarmonyState pub/sub
- Chord-quality coloring (blue=major, coral=minor)
- Chord wheel: dual-ring circle of fifths with diatonic arc highlighting
- Audio playback via music-engine.js / Tone.js / Salamander sampler
- Canonical orientation locked: horizontal=P5, up-right=M3, down-right=m3, major=△, minor=▽

### Voicing Explorer (Phase A5 — in progress)

- Note Mode: toggle individual notes on/off across all three panels
- Octave-specific note selection on keyboard (voicing control)
- Compact cluster highlighting on Tonnetz (one node per pitch class, tightest grouping)
- Glow worm path visualization: luminous trail connecting chord tones low-to-high on Tonnetz
-  ChordResolver: identifies chord names from arbitrary note sets, interval-content fallback for non-standard voicings
- Chord wheel sync: highlights recognized chord and re-centers diatonic arc on assembled chord's key
- Play button + spacebar shortcut for hearing assembled voicings
- All three panels synchronized bidirectionally via HarmonyState in both Chord Mode and Note Mode


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

### Intro Module (Chapters 1–3 complete, 4+ paused)
- Chapter 1: Sound & Notes (4 sections)
- Chapter 2: Intervals & Scales (3 sections)
- Chapter 3: Chords & Progressions (4 sections)
- Chapter 4+: paused — will rebuild on Explorer components
- Scrollytelling engine, dynamic Tone.js loader, intro-audio.js utilities

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

### General stuff
- Backend API proxy ✅ complete (Anthropic key server-side in app.py, client calls /api/chat only, .env gitignored)
- Phase A complete: A1 (Circle of Fifths) ✅, A2 (Tonal Centers) ✅, A3 (Modes) ✅, A4 (Chord Progressions) ✅

---

## Not Started

See `docs/tonnetz-next-build-plan.md` for the full phased roadmap:

- **Phase A (remaining):** A3 modes overview, A4 chord progressions with Song Examples DB integration + multiple glow worm paths for voice leading visualization. A1 circle of fifths, A2 tonal centers, and A5 Voicing Explorer core are complete.
- **Pre-MVP:** Fretboard panel (`fretboard-view.js`) — composable Explorer panel for guitarists
- **Phase B:** Extract `game-flow.js` first, then Scale Builder, Note Name Trainer, Interval Spotter, Chord Progression Builder, Rhythm Tapper, Melody Dictation
- **Phase B.5:** Auth & Persistence — Supabase auth, profile migration, resolve Practice vs Test schema (B8), song preferences table
- **Phase C:** Curriculum paths, path runner UI, Tonnetz curriculum map, onboarding routing, Song Examples DB v2 (preference feedback UI)
- **Phase D:** Differentiated experiences by user level (beginner/student/advanced modes, achievements)
- **Phase E:** AI-powered feedback (session analysis, cross-game competency graph, Song Examples DB v3)
- **Phase F:** Puzzle Paths (basic could ship earlier), MIDI input + Voicing Explorer Live Mode, Voicing Explorer advanced (sequence mode, voice leading, shape library), fog of war, social features

---

## Known Issues

- Sustain pedal bug: Organ/Synth in Skratch Studio — `triggerAttackRelease` bypasses sustain state
- Mobile viewport jitter: tooltip uses `100vh` instead of `dvh`
- Focus trapping / aria-modal missing on tooltips
- Z-index audit needed across platform
- stopPropagation collisions with tooltip click delegation
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
