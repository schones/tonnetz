# Tonnetz Project Status

**Last updated:** 2026-03-25
**Branch:** `main` (merged from `education-layer`)
**Deploy:** Railway from `main`
**Active roadmap:** `docs/tonnetz-next-build-plan.md` (Post-MVP Build Plan v2)

---

## Current Focus

Shipping the MVP: backend API proxy, intro module rebuilt on Explorer components, polish pass. Goal is a shareable URL within 1–2 weeks, followed by user testing with 15–20 participants.

**Immediate next steps:**
1. Backend API proxy (1 session — non-negotiable before sharing)
2. Rebuild intro module chapter 4 on Explorer components
3. Polish pass — landing page, navigation, first-visit experience
4. Security review — no exposed keys, CORS, CSP header
5. User testing across 4 segments (curious players, producers, students/teachers, beginners)

---

## What's Working

### Tonnetz Explorer
- Three-panel tool at `/explorer`: Tonnetz neighborhood, chord wheel, keyboard
- All panels synchronized via HarmonyState pub/sub
- Chord-quality coloring (blue=major, coral=minor)
- Chord wheel: dual-ring circle of fifths with diatonic arc highlighting
- Audio playback via music-engine.js / Tone.js / Salamander sampler
- Canonical orientation locked: horizontal=P5, up-right=M3, down-right=m3, major=△, minor=▽

### Shared Components
- `transforms.js` — PLR math, pitch utilities, interval utilities
- `harmony-state.js` — pub/sub state model
- `tonnetz-neighborhood.js` — SVG renderer with chord-quality coloring
- `keyboard-view.js` — highlight layer, click interaction
- `chord-wheel.js` — dual-ring circle of fifths

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

### Education Infrastructure
- Onboarding & profile system (localStorage)
- Theory Hub page (34 topics, content type taxonomy)
- Phase 1 schema migration complete (content_type, difficulty, related_games, visualizations, creative_prompts)

---

## Not Started

See `docs/tonnetz-next-build-plan.md` for the full phased roadmap:

- **Phase A:** Explorer lesson overlay, tonal centers/keys lessons, chord progressions, modes, "Hear It in Music" panel
- **Phase B:** Scale Builder, Note Name Trainer, Interval Spotter, Chord Progression Builder, Rhythm Tapper, Melody Dictation, Skratch Studio starter system + challenges
- **Phase C:** Curriculum paths, path runner UI, Explorer as curriculum map, assessment model, skill guide topics
- **Phase D:** Differentiated experiences by user level
- **Phase E:** AI-powered feedback (session analysis, cross-game competency graph)
- **Phase F:** Puzzle Paths, auth/Supabase, MIDI input, sound-to-visual mapping, social features

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
| `docs/tonnetz-next-build-plan.md` | **Active roadmap** — Phases A–F, session budgets, dependency graph |
| `docs/tonnetz-explorer-spec.md` | Explorer design, panel specs, canonical orientation |
| `docs/tonnetz-content-architecture.md` | Content model, topic schema, lens system, starters, challenges |
| `docs/game-flow-pattern.md` | Learn → Practice → Test pattern, "Hear It in Music" spec |
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
