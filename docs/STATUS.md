# SongLab Project Status

**Last updated:** 2026-04-17
**Branch:** `dev` (active — SongLab redesign in progress) · `main` (prod)
**Deploy:** Railway from `main`
**Active roadmap:** `docs/songlab-build-plan.md` (v4) + `docs/game-engine-spec.md` + `docs/audio-architecture.md` + `docs/polyrhythm-trainer-spec.md`
**Platform name:** SongLab · SkratchLab (rebrand complete)

---

## Current Focus

SongLab `dev` branch is feature-rich. Phase A and A++ complete. Client-side audio DSP landed April 16-17: five detection modules (onset, pitch, chord, device selection, unified input provider) replace the server-side bottleneck. Melody Match fixed — client-side YIN pitch detection working. Polyrhythm Trainer (B8) shipped with Practice Mode (phase-based BPM ramp) and Challenge Mode (arcade adaptive). Opus 4.7 code review completed; 5 critical blockers resolved. Approaching user testing readiness.

**Next priorities:**
1. Add Polyrhythm Trainer to nav dropdown and landing page
2. Linus and Lucy walkthrough (connects from Polyrhythm Trainer)
3. Business model / monetization spec
4. game-flow.js + adaptive engine extraction (spec: `docs/game-engine-spec.md`)
5. SkratchLab lightweight DAW — song presets, chord loops + rhythm, melody play-over
6. Consolidate triplicated chord-type registries (code review finding)
7. Replace `_suppressAutoPlay` with source-tagged HarmonyState.update() (code review finding)
8. User testing prep (15-20 participants)

**Completed this cycle (April 16-17):**

- **Phase A++ — Audio & Input Architecture (6 modules):**
  - `audio-input.js` — audio interface device selection, Scarlett 2i2 auto-detect, `getUserMedia` with device picker, source quality flag
  - `onset-detection.js` — spectral flux onset detector, reads shared `Tone.Analyser`, adjustable threshold/cooldown
  - `pitch-detection.js` — client-side YIN monophonic pitch, strategy pattern for CREPE Pro-tier upgrade, 15-cent grace window
  - `chord-detection.js` — chroma vector template matching (10 chord types), bass detection, key-aware disambiguation
  - `input-provider.js` — unified input abstraction, modality picker UI, games declare supported inputs
  - Dead code cleanup: removed broken `startPitchDetection`/`stopPitchDetection`/`autocorrelate` from audio.js
  - **Melody Match fixed** — client-side pitch detection replaces broken server route calls
  - Spec: `docs/audio-architecture.md`

- **Polyrhythm Trainer (B8) — new game:**
  - Guitar Hero-style falling-note game at `/games/polyrhythm`, dark DAW theme
  - **Practice Mode:** 5-phase structured ramp (Listen → Layer A → Layer B → Both → Victory), BPM auto-ramps from start to goal within each phase, per-phase results with "Try again at {bpm}"
  - **Challenge Mode:** arcade adaptive (tempo + polyrhythm + tolerance axes), endless scoring, top-5 leaderboard
  - Two vertical lanes (purple/gold), ghost-to-solid falling notes, lane breathing waves, interference wave, particle bursts, receptor rings
  - HTML drum pads below canvas with hit/miss flash animations, phase-aware dimming
  - Song preset buttons (Linus & Lucy, Oye Como Va, Mission Impossible)
  - Web Audio gain chain (oscillator → layerGain → masterGain → destination) for clean audio switching
  - First game built on `input-provider.js` + `onset-detection.js`
  - Spec: `docs/polyrhythm-trainer-spec.md`

- **Opus 4.7 code review + fixes:**
  - Comprehensive overnight review: `docs/code-review-opus47.md`
  - Fixed: SkratchLab broken import (audio-bridge.js), dead route calls (rhythm.js, detection.js), cross-AudioContext wiring (audio-input.js), hardcoded sample rate (chord-detection.js)
  - Dev routes gated behind `app.debug`
  - Orphan files deleted (5 files), unused imports removed, Safari private mode resilience added to user-profile.js
  - Architecture positives confirmed: HarmonyState clean, no secrets client-side, template inheritance consistent

- **Bug fixes:**
  - Quality name mismatch between chord-resolver.js and transforms.js (dim→diminished, aug→augmented, etc.)
  - TypeError in _notesFromTriad when triadNotes returned null for unrecognized qualities
  - Tonnetz crash (buildNeighborhood) on unrecognized chord types — try/catch guard added
  - kv-key--midi missing CSS → changed MIDI source to 'user' for existing highlight styles
  - Duplicate audio on MIDI chord detection → _suppressAutoPlay wrapper
  - Keyboard octave jump on chord detection → manual HarmonyState.update with real MIDI octaves

**Completed previous cycle (April 9-13):**

- **Project rename (April 13):** Tonnetz → SongLab across GitHub, Railway, CLAUDE.md, README.md, doc filenames, cross-references. Music theory "Tonnetz" references preserved.

- **Extended chord support (April 13):**
  - `CHORD_TYPES` dictionary in transforms.js: triads, 7ths (dom7/maj7/min7/dim7/half-dim7/minmaj7), sus (sus2/sus4/7sus4), extended (add9/dom9/maj9/min9)
  - `chordPCs`, `chordNotes`, `baseTriad`, `extensionNotes`, `chordSymbol` utility functions
  - HarmonyState: `activeChord` field, `setChord()`, `highlightChord()`, chordType-aware `setProgressionIndex()`
  - Keyboard extension rendering: gold ring highlights, interval labels (♭7, 7, etc.)
  - Tonnetz extension nodes: glowing nodes + dashed connectors for notes beyond the triad
  - Chord labels: `activeChord.symbol` preferred ("B7", "Cmaj7") across Explorer + Tonnetz
  - Folsom Prison, Johnny B. Goode, ii-V-I, Lean On Me walkthroughs updated with chordType

- **Three new walkthroughs (April 13):**
  - Bridge Over Troubled Water (diminished passing chords, musician)
  - Oh! Darling (augmented passing chord, student)
  - Life on Mars? (advanced augmented connectors, musician)
  - All with rhythm data, song-examples.js entries, landing page grid placement

- **Fundamentals Chapter 4: "Beyond Triads" (April 13):**
  - 5 interactive sections: Adding the Seventh, The Tritone, Diminished & Augmented, Suspended Chords, Hearing Them in Songs
  - Root selectors, type toggles, gold extension highlights, coral tritone spotlight, resolution animations, song card jukebox
  - Chapters renumbered: Meet the Tonnetz → Ch5, Transforms → Ch6
  - Hub page, routing, intro-hub.js updated for 6 chapters
  - 3-octave keyboards sized to fill wider containers

- **Global typography overhaul (April 13):**
  - design-tokens.css font scale increased ~40% across all sizes
  - Explorer scoped 2x font override removed (no longer needed)
  - Fundamentals layout widened: sections 1000px, interactives 900px, narration 800px
  - Fundamentals keyboards: global size overrides in intro.css for all chapters


- **Game visual unification (Phase A+.1/A+.2)**: game-shell.css extracted, all 8 games migrated, index.html converted to extend base.html, Swing Trainer converted to Jinja2 template, ~500 lines duplicate CSS removed, all legacy color vars → design tokens


- **Game audit & build plan update (April 11-12)**:
  - Full audit of all 8 games: Harmony Trainer, Strum Patterns, Swing Trainer, Melody Match, Chord Spotter, Rhythm Lab, Scale Builder, Relative Key Trainer
  - Two game types identified: Performance (no Learn mode, difficulty axes) and Learning (stage-based, Intro/Practice/Test)
  - Adaptive engine standardized on Pattern B (promote after N correct, demote after N wrong) with independent axes per game
  - ResultDetail schema designed for competency graph (per-game detail shapes)
  - MIDI input pulled forward from Phase F to Phase A+ (new `midi-input.js` shared module)
  - SkratchLab lightweight DAW vision captured (song presets, chord loops, melody play-over)
  - Two new games designed: Voice Leading Detective (B7), Polyrhythm Trainer (B8)
  - Vienna (Billy Joel) walkthrough planned
  - Build plan updated to v4: new Phase A+, fast path to Competency Graph (B → B.5 → E5), updated session budget
  - Created `docs/game-engine-spec.md`
- **SkratchLab rebrand**: Skratch Studio → SkratchLab (user-facing text + URL paths /skratchlab)
- **Explorer visual polish**:
  - Keyboard: cream white keys (#E8E2D6), real piano proportions, scalable via CSS overrides
  - Tonnetz: lighter canvas (#1E1C17), visible grid edges/nodes
  - Dark theme contrast bump across all text colors
  - Walkthrough sidebar: wider (300px), bigger text, enlarged step badges
  - Removed dead Spotify/Apple Music links
  - Fixed fretboard/keyboard proportions in "Both" view
- **Info pills**: "Learn" pills on panel headers, compact ⓘ on Transform/Key controls, linking to fundamentals
- **Game deep-linking**: CONCEPT_GAME_MAP, "Try this" pills on walkthrough steps, games read URLSearchParams
- **Base.html restyle**: warm SongLab palette, dropdown nav restored (Ear Training, Rhythm & Play, Games, Learn), dark theme support
- **SkratchLab top-level nav**: promoted from dropdown to standalone nav link
- **Rhythm analysis (new feature)**:
  - Rhythm tab in Explorer (4th stage tab), renders beat patterns from walkthrough data
  - Tone.js playback engine with playhead animation
  - BPM slider, volume controls (Rhythm + Chords separate)
  - Bass follows chord root, keyboard plays over running rhythm
  - 7 new rhythm-tagged song entries in song-examples.js
  - All walkthroughs backfilled with rhythm data (including 6/8 for Norwegian Wood)
- **Audience tracks (new feature)**:
  - 4 new walkthroughs: Let It Go, You've Got a Friend in Me (kids), Stand By Me, Lean on Me (students)
  - All walkthroughs tagged with audience + category
  - Landing page: audience tabs filter MIDI pad song grid
- **SkratchLab Rhythm Builder (new feature)**:
  - Interactive 4×8 drum machine grid (kick/snare/hihat/strum)
  - Preset patterns (rock, train, disco, hiphop, shuffle, backbeat)
  - Tone.js playback, BPM slider, export to Blockly blocks
  - Rhythm data exports from Explorer → SkratchLab via sessionStorage
- **Tutorial page**: 10-section walkthrough at /tutorial using Norwegian Wood
- **Playback fixes**: first chord replay, Shift/CapsLock sustain, piano reset on walkthrough start
- **Landing page**: Melody Match + Strum Patterns added to games grid, tutorial link

---

## What's Working



### Tonnetz Explorer ✅ fully restyled + Spectrum + MIDI
- DAW-style dark theme at `/explorer`: transport controls, song info bar, walkthrough sidebar
- Tabbed panel area: Tonnetz / Chord Wheel / Fretboard / **Rhythm** / **Spectrum** (all wired and synchronized via HarmonyState)
- **Spectrum tab (Harmonic Resonance):** real-time FFT particle visualizer, particles colored by chord function, spectral envelope with peak-hold
- **MIDI input:** Web MIDI API via `midi-input.js`, Launchkey 49 auto-detect, keyboard size selector (25/49/61/88)
- **Chord lock-in:** freeze MIDI-detected chord for P/R/L transform exploration, sustain pedal toggle, chained transforms
- **Key-aware chord resolution:** ambiguous chords (aug/dim) resolve using diatonic context from KEY selector
- Shared FFT analyser in audio chain (`KeyboardView.getAnalyser()`) — all instruments feed spectrum
- Chord-quality color families: blue=major, green=minor, coral=borrowed
- Tonnetz animations: pulsing nodes, glow worm paths, ghost trails
- Cream keyboard keys with real piano proportions, lightened Tonnetz canvas
- Info pills: "Learn" on panel headers, ⓘ on controls → link to fundamentals content
- Rhythm tab: renders beat pattern from walkthrough data, Tone.js playback with playhead, BPM slider
- Separate volume controls for rhythm and chords
- Shift/CapsLock sustain for keyboard playback
- Keyboard plays over running rhythm without restarting beat
- Audio via music-engine.js / Tone.js / Salamander sampler (piano default for walkthroughs)
- Canonical orientation locked: horizontal=P5, up-right=M3, down-right=m3, major=△, minor=▽
- Deep-linking via URL params: ?root=, ?quality=, ?progression=, ?walkthrough=
- Record-and-export bridge to SkratchLab (sessionStorage + window.open) — includes rhythm data

### Guided Walkthrough System ✅ with rhythm + audience tracks + extended chords + key context
- Walkthrough sidebar in Explorer driven by `static/shared/walkthroughs.js`
- **18 walkthroughs** across 3 audiences:
  - Kids: Let It Go (pop formula), You've Got a Friend in Me (shuffle feel)
  - Students: Stand By Me (doo-wop loop), Lean on Me (gospel piano, Cmaj7), Oh! Darling (augmented passing chord, 11-step full verse)
  - Musicians: Yesterday, Eleanor Rigby, Creep, ii-V-I jazz (min7/dom7/maj7), Norwegian Wood (Mixolydian), Stairway (P transform), In My Life (deceptive cadence), Johnny B. Goode (twelve-bar blues, dom7), Folsom Prison Blues (train beat, dom7), Why Does My Heart (Moby), Bridge Over Troubled Water (diminished passing chords), Life on Mars? (augmented connectors), Vienna (chromatic mediant)
- All walkthroughs tagged with `key` field — KEY dropdown syncs on walkthrough load
- Extended chord types: `chordType` field on steps drives `highlightChord()` path, showing full chord symbols (B7, Cmaj7, F♯°, E+) on Tonnetz and keyboard
- All walkthroughs have rhythm data (time sig, BPM, feel, beat pattern)
- Walkthrough focus override: user's manual tab choice respected, reset on new song
- Categories: Voice Leading, Transforms, Jazz Harmony, Modes & Scales, Progressions, Rhythm & Feel
- Each step: chord state via HarmonyState, auto-play, conversational explanation, harmonic function label
- "Try this" game pills with deep-linking (CONCEPT_GAME_MAP → pre-configured URL params)
- "You'll also hear this in..." related songs from song-examples.js
- Panel focus: steps can dim non-relevant panels or auto-switch to Rhythm tab
- Walkthroughs auto-capture progression for export to SkratchLab

### SkratchLab ✅ renamed + Rhythm Builder
- `/skratchlab` route (renamed from `/skratch-studio`)
- Top-level nav link alongside Explorer
- Interactive Rhythm Builder: 4×8 drum machine grid, preset patterns, Tone.js playback, export to Blockly blocks
- Rhythm data imports from Explorer via sessionStorage (pre-loads grid + BPM)
- Record-and-export pattern: Explorer captures progression → SkratchLab opens with session preloaded
- PLR transform math deduplicated — imports from `transforms.js`
- MIDI export: BPM header + drum skip warning fixes
- Transport conflict handling between Rhythm Builder and main Run engine

### Landing Page & Navigation ✅ audience-segmented
- Warm light-theme landing page with audience tabs (Kids/Students/Musicians)
- MIDI pad song grid filters by selected audience, category badges on cards
- Hero tagline, subtitle, Explorer preview, tool cards, game cards (6 games)
- Tutorial link below tagline
- Dropdown nav in base.html: Explorer, SkratchLab, Ear Training (4), Rhythm & Play (2), Games (2), Learn (6)
- Dark theme dropdown support for Explorer/SkratchLab standalone navs
- Active state highlighting on current page nav link
- No instance of "theory" in user-facing UI

### Tutorial Page ✅ new
- `/tutorial` — 10-section walkthrough using Norwegian Wood as example
- Covers full feature set: song picker, walkthrough sidebar, Tonnetz, chord wheel, transforms, game pills, rhythm tab, keyboard/sustain, SkratchLab export
- Feature callout boxes, "Try it" links with deep-link params

### Design System ✅ complete
- `static/css/design-tokens.css` — light/dark theme tokens, **global font scale increased ~40% (April 13)**
- Explorer and SkratchLab fully on dark DAW token set
- Base.html warm palette cascades to all game/theory/intro pages
- All hardcoded pixel font sizes replaced with design tokens
- Real piano keyboard proportions as default

### Song Examples Database
- **84 entries** in song-examples.js (v1.1 + rhythm + extended chord additions)
- Rhythm concept_specifics: train_beat, shuffle, syncopation, odd_meter, backbeat
- Swing feel entries with swing_ratio field
- Consumed by: walkthroughs, game deep-links, "also hear this in" related songs

### Voicing Explorer (Phase A5 — core complete)
- Note Mode: toggle individual notes across all three panels
- Glow worm path visualization
- ChordResolver with interval-content fallback
- Full three-panel bidirectional sync via HarmonyState

### Chord Progression Engine
- Multi-path glow worm visualization (animated playthrough with fading trails)
- Fixed Tonnetz center during progression playback
- Common-tone highlighting between chord transitions

### Fretboard Panel
- Composable Explorer panel at static/shared/fretboard-view.js
- Multi-position highlighting with practical voicing clusters
- Keyboard/Fretboard/Both toggle on Explorer

### Shared Components
- `transforms.js` — PLR math, pitch utilities, interval utilities, **CHORD_TYPES**, chordPCs/chordNotes/baseTriad/extensionNotes/chordSymbol
- `harmony-state.js` — pub/sub state model, **setChord/highlightChord** for extended chord types
- `tonnetz-neighborhood.js` — SVG renderer with chord-quality coloring, **extension node rendering**
- `keyboard-view.js` — real piano proportions, highlight layer, click interaction, **extension ring highlights**, shared `Tone.Analyser` owner
- `chord-wheel.js` — dual-ring circle of fifths
- `song-examples.js` — 84 curated real-song references
- `walkthroughs.js` — 17 guided Explorer walkthroughs with rhythm data, audience tags, category labels, extended chord types
- `audio-input.js` — audio interface device selection (Scarlett auto-detect), source quality flag
- `onset-detection.js` — spectral flux onset detector, reads shared Tone.Analyser
- `pitch-detection.js` — client-side YIN pitch detection, CREPE strategy pattern for Pro tier
- `chord-detection.js` — chroma template matching, 10 chord types, bass detection
- `input-provider.js` — unified input abstraction, modality picker UI
- `midi-input.js` — Web MIDI API, Launchkey 49 auto-detect, device persistence

### Intro Module ✅ 6 chapters
- 6 chapters: Sound & Notes, Intervals & Scales, Chords & Progressions, **Beyond Triads** (new), Meet the Tonnetz, Transforms
- Beyond Triads: 5 interactive sections with root selectors, type toggles, tritone demo, song card jukebox
- 3-octave keyboards sized to fill wider containers, global key size overrides
- End-of-chapter "What's Next" cards

### Games & Tools
- Harmony Trainer, Chord Walks (4 tiers), Rhythm Lab, Strum Patterns, Chord Spotter, Scale Builder, Melody Match
- **Swing Trainer**: ear-training for jazz swing feel (rotary knob, waveform viz, Practice/Test)
- **Polyrhythm Trainer** (new): Guitar Hero-style falling-note game. Practice Mode (phase-based BPM ramp: Listen → Layer A → Layer B → Both → Victory) and Challenge Mode (arcade adaptive with leaderboard). Dark DAW theme, drum pads, lane breathing waves. First game on `input-provider.js` + `onset-detection.js`. Spec: `docs/polyrhythm-trainer-spec.md`
- **SkratchLab**: Blockly + audio + music blocks + Rhythm Builder
- All games accept URL params for deep-linking from walkthroughs
- Visual layer system (visual-config.js, visual-layer.js, visual-toggle.js)

### General
- Backend API proxy ✅ complete
- Phase A complete: A1 ✅ A2 ✅ A3 ✅ A4 ✅ A5 ✅
- Phase A++ complete: client-side audio DSP, 5 detection modalities, device selection, input provider
- Opus 4.7 code review completed: `docs/code-review-opus47.md` — 5 critical blockers resolved

---

## Not Started

See `docs/songlab-build-plan.md` (v4) for the full phased roadmap:

- **Phase A+:** Game visual unification (`game-shell.css` extraction, all games extend base.html) — partially complete (CSS extracted, templates unified, MIDI module landed)
- **Multi-chord glow worm paths** — visualize chord progressions/transitions with simultaneous paths showing voice leading (notes that stay vs. move)
- **SkratchLab lightweight DAW** — song presets, chord loops + rhythm, melody play-over, instrument selection (parallel to Phase B)
- **Phase B:** Extract `game-flow.js` (Pattern B adaptive, independent axes, ResultDetail schema), new games (Voice Leading Detective, Note Name Trainer, Interval Spotter, Chord Progression Builder, Rhythm Tapper, Melody Dictation). **Polyrhythm Trainer ✅ complete (B8)**
- **Phase B.5:** Auth & Persistence — Supabase auth, profile migration, ResultDetail → Supabase
- **Phase E5:** Competency Graph — fast path (B → B.5 → E5), cross-game skill tracking. CREPE pitch engine upgrade (Pro tier).
- **Phase C:** Curriculum paths, path runner UI, Tonnetz curriculum map
- **Phase D:** Differentiated experiences by user level
- **Phase E1–E4:** Per-game AI-powered feedback
- **Phase F:** Puzzle Paths, NoteInputProvider full abstraction (extends A++.6), Voicing Explorer advanced, social features
- **Architecture cleanup (from code review):** consolidate triplicated chord-type registries into transforms.js, replace `_suppressAutoPlay` with source-tagged HarmonyState.update(), standardize factory-function naming across detection modules

---

## Known Issues

- **Swing Trainer 500 on production** — could not reproduce locally (April 17). Template extends base.html correctly. Likely Railway deploy state issue. Need fresh deploy + production stack trace capture. See `docs/KNOWN-ISSUES.md`.
- **Railway cold start** — ~15s first load after inactivity (hobby tier), warn testers
- **Rhythm Lab + Strum Patterns mic paths disabled** — dead route calls commented out, TODO points to onset-detection.js migration. Keyboard/spacebar input still works.
- **Harmony Trainer still uses server-side pitch detection** — `/process_audio_chunk` → librosa. Migration guide in `templates/harmony.html` comment block.
- **`_suppressAutoPlay` load-bearing** — 17 sites in explorer.html. Code review recommends source-tagged HarmonyState.update(). Deferred.
- **Triplicated chord-type registries** — transforms.js, chord-resolver.js, chord-detection.js. Consolidation into transforms.js recommended.
- **`/api/chat` proxy hardening** — model allowlist and server-side system prompt recommended. Not a blocker.
- Swing Trainer: dial slightly finicky past midpoint
- Swing Trainer: song-examples.js swing_ratio field not yet consumed by game
- SkratchLab Rhythm Builder: strum row doesn't export to Blockly (no strum block exists)
- Sustain pedal bug: Organ/Synth in SkratchLab — `triggerAttackRelease` bypasses sustain state
- Mobile/responsive not tested — deferred to post-MVP
- SkratchLab: "Clear All" button clears blocks but not canvas — needs canvas reset
- Polyrhythm Trainer not yet in nav dropdown or landing page
- Full list: `docs/KNOWN-ISSUES.md`
- **Backlog:** Enharmonic sharp/flat toggle for Fundamentals keyboards (deferred)

---

## Key Docs

| Doc | Purpose |
|---|---|
| `docs/songlab-build-plan.md` | **Active roadmap** (v4) — Phases A–F + A+ + A++ + B.5, dependency graph, session budget |
| `docs/audio-architecture.md` | **Audio & Input spec** — detection modalities, client-side DSP, device selection, input provider, CREPE upgrade path |
| `docs/polyrhythm-trainer-spec.md` | **Polyrhythm Trainer spec** (v2) — Practice/Challenge modes, drum pads, phase-based ramp |
| `docs/code-review-opus47.md` | **Code review** — Opus 4.7 comprehensive review, 5 sections, severity ratings |
| `docs/game-engine-spec.md` | **Game audit** — per-game analysis, adaptive axes, ResultDetail schemas, new game designs |
| `docs/design-system-reference.md` | CSS tokens, color palette, typography — design system reference |
| `docs/visual-engine-spec.md` | Generative art engine spec (Tonnetz-driven, post-launch) |
| `docs/explorer-spec.md` | Explorer design, panel specs, canonical orientation |
| `docs/voicing-explorer-spec.md` | Voicing Explorer — chord shapes, glow worm paths, projections |
| `docs/content-architecture.md` | Content model, topic schema, lens system |
| `docs/game-flow-pattern.md` | Learn → Practice → Test pattern (to be updated with audit findings) |
| `docs/auth-architecture.md` | Supabase auth, profile migration, security checklist |
| `docs/KNOWN-ISSUES.md` | Tracked bugs and fixes |
| `docs/claude-code-preferences.md` | Claude Code workflow conventions |
| `docs/extended-chords-spec.md` | Extended chord type system — CHORD_TYPES, data model, visual rendering |
---

## Update Protocol

After every work session:
1. Update "Last updated" date
2. Update "Current Focus" with what's active and what's next
3. Move completed items into "What's Working"
4. Add new bugs to "Known Issues"
5. Commit: `git add docs/ && git commit -m "Update project status"`
