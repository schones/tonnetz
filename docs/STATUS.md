# Tonnetz Project Status

**Last updated:** 2026-03-23
**Branch:** `education-layer`
**Last commit:** 2ca7076




---

## Completed

### Build Plan Phases
- [x] **Phase 1: Schema Migration** — content_type, difficulty, related_games, visualizations, creative_prompts added to all 33 topics
- [x] **Phase 2: Profile & Onboarding** — localStorage profile manager, onboarding UI, tips pill wired to profile
- [x] **Phase 4: Playful Lens** — DRAFT COMPLETE, NEEDS REFINEMENT. 12 topics have playful lens content. Review and polish before considering done.

### Shared Components (from tonnetz-keyboard-component.md)
- [x] RKT-1: `transforms.js` — PLR math, pitch utilities, interval utilities
- [x] RKT-2: `harmony-state.js` — pub/sub state model
- [x] RKT-3: `tonnetz-neighborhood.js` — SVG renderer (triangle + edge mode) + bugfixes
- [x] RKT-4: `keyboard-view.js` — highlight layer + bugfixes
- [x] RKT-5: Integration test page (`/test/shared`) — working, cleaned up

### Relative Key Trainer
- [x] RKT-6: Levels 1-2 (listen mode) + answer visibility fix
- [x] RKT-REFACTOR: Learn/Practice/Test 3-phase tab structure, 5-step Learn tutorial, shared Salamander sampler
- [x] Salamander sample URL fix (v1 suffix)
- [x] RKT-7: Tier 2 "Find the Relative" — Learn/Practice/Test phases, tier selector, distractor generation, R transform animations
- [x] RKT-8: Explore mode — interactive Tonnetz, P/R/L buttons, breadcrumb trail, depth 1-4
- [x] RKT-9: Tiers 3-4 PLR and chaining
- [x] RKT-10 (education wiring)


## Intro Module (Phase 5: Meet the Tonnetz)

### Completed
- Chapter 1: Sound & Notes — 4 sections (oscillator, keyboard, A440 oboe, keyboard pattern)
- Chapter 2: Intervals & Scales — 3 sections (interval explorer, major scale builder + root picker, major/minor toggle)
- Chapter 3: Chords & Progressions — 4 sections (triad builder, major/minor chords, diatonic harmony, progression player)
- Shared utilities refactored into intro-audio.js (keyboard builder, audio helpers, drag-to-play, QWERTY input)
- Scrollytelling engine: bidirectional IntersectionObserver (onEnter/onLeave), progressive narration reveal, section transitions
- Dynamic Tone.js loader (self-contained, no template changes needed)

### In Progress
- Chapter 4: The Tonnetz (not started)
- Chapter 5: Transforms (not started)

### Architecture Notes
- intro-audio.js: shared keyboard builder, sampler management, constants (CHROMATIC, buildScale, MAJOR_PATTERN, MINOR_PATTERN, buildTriad, chordQuality)
- ch1-sound.js: oscillator + oboe sampler (ch1-only)
- ch2-scales.js: interval explorer, scale builder, root picker, major/minor toggle
- ch3-chords.js: triad builder, chord explorer, diatonic chords, progression player with key transposition
- intro-core.js: supports onActivate (mount once), onEnter/onLeave (scroll state), progressive narration, .intro-section--seen persistence
- All keyboards support click, drag-to-play (glissando), and QWERTY input


### Other
- [x] Clear All canvas bugfix (Skratch Studio)
- [x] MAX_CONTENT_LENGTH added to Flask config
- [x] Debug console.log statements stripped
- [x] CLAUDE.md added for Claude Code context
- [x] B1: Audio bleed fix (playbackGeneration cancellation token)
- [x] B2: Keyboard highlights during Learn/Practice/Test playback
- [x] B3: Common tone colors (blue held, orange moving)
- [x] B5: Tonnetz recenter slide animation (400ms ease-out)
- [x] B6: "Did you notice?" teaching bubble system (5 insights, opt-in engagement)
- [x] B7: Game renamed to "Chord Walks" with tier subtitles
- [x] B11: Intro screen fix + CSS
- [x] Keyboard playback highlight CSS (kv-key--playback)
- [x] Dashboard link fix (/relative → /games/relative-key-trainer)
[x] Visual layer system (visual-config.js, visual-layer.js, visual-toggle.js)
- [x] Tonnetz pop-out panel in Harmony Trainer (depth control, HarmonyState wiring)
- [x] Visual layer wired into Chord Walks
- [x] Sampler proxy fix in Chord Walks (voice instrument compatibility)
- [x] MVP tracker replaces sprint tracker
- [x] Install python-dotenv, verify API proxy setup
[x] Intro module scaffolding (routes, hub, scroll engine, progress tracking, placeholder chapters)
- [x] "Start Here" card on landing page

```

---

## In Progress

### MVP Push (target: April 20, 2026)
See `docs/tonnetz-mvp-tracker.md` for the focused shipping checklist.
Next priorities: backend API proxy, intro module (4 chapters).

### Visual tuning (parked)
Visual layer infrastructure works in both games. Preset refinement
and effect tuning deferred — will revisit before launch.

### Phase 4: Playful Lens — Refinement
- Content exists for 12 topics but needs quality review and polish
- Status: needs a review pass, not new writing

### Phase 3: Auth & Persistence
 - JUST GETTING STARTED

---

## Not Started

### Build Plan Phases
- [ ] Phase 3: Auth & Persistence (Supabase, hybrid storage, API proxy)
-
- [ ] Phase 6: Starters, Paths, Hub (Skratch Studio starters, learning paths, Theory Hub page)
- [ ] Phase 7: Game Progression & Assessment (intro screens, level system, auto-assessment)
- [ ] Phase 8: Fog of War (Tonnetz grid as spatial progress map)
- [ ] Phase 9: Competency Graph (adaptive branching, skill-map.js, mode transitions)
- [ ] Phase 10: Puzzle Paths (new game — pathfinding, progression tracing, ear puzzles)

### Harmony Trainer Enhancements
- [ ] RKT-11: Add keyboard highlight layer
- [ ] RKT-12: Add collapsible Tonnetz panel
- [ ] RKT-13: Wire difficulty-dependent visual behavior

---

## Known Issues
- Sustain pedal bug: Organ/Synth in Skratch Studio (conflict between triggerAttackRelease and sustain state)
- "Clear All" clears blocks but does not reset canvas visuals
- `TonnetzNeighborhood.recenter()` doesn't internally call `HarmonyState.setTriad()` — callers must invoke both
- Full known issues list: `docs/KNOWN-ISSUES.md`

---

## Key Docs
- `docs/tonnetz-build-plan.md` — phased roadmap (10 phases)
- `docs/tonnetz-content-architecture.md` — content model and topic schema
- `docs/tonnetz-keyboard-component.md` — shared component spec (tasks RKT-1 through RKT-13)
- `docs/game-flow-pattern.md` — Learn → Practice → Test pattern
- `docs/puzzle-paths-spec.md` — Puzzle Paths game concept (NEW — add to repo)
- `docs/KNOWN-ISSUES.md` — tracked bugs and fixes
- `docs/AGENT_GUIDE.md` — Claude Code workflow conventions

---

## Update Checklist
After every work session:
1. Update "Last updated" date and "Last commit" hash
2. Move completed items from "In Progress" to "Completed"
3. Update "In Progress" with current state
4. `git add docs/STATUS.md && git commit -m "Update project status"`
