# SongLab Platform — Post-MVP Build Plan (v4)

**Date:** 2026-04-16  
**Status:** Active roadmap  
**Context:** Platform rebranded as SongLab. Phase A complete. MIDI input and Spectrum FFT landed April 14. Audio architecture audit (April 16) revealed broken client-side pitch detection, dead code in audio.js, and a server-side DSP bottleneck incompatible with rhythm games. New Phase A++ added: client-side audio DSP migration, five detection modalities (click/MIDI/onset/pitch/chord), audio interface support (Scarlett 2i2), unified input abstraction. See `docs/audio-architecture.md` for full spec. 18 walkthroughs with audience tracks, rhythm data, and extended chords. 84 song examples. Game audit completed April 11 (see `docs/game-engine-spec.md`). This document scopes the full post-MVP roadmap.

---

## The Five Big Problems

1. **No curriculum.** Games exist but there's no guided path connecting them. A beginner logs in and gets a dashboard of tools with no obvious "start here → go here next" flow.

2. **Gamification is thin.** The platform has trainers and tools but limited game variety. We need more lightweight, fun interactions — especially ones that teach fundamentals (scales, note names, rhythm) without requiring the full weight of Harmony Trainer or Chord Walks.

3. **Missing foundational concepts.** The intro module covers sound → notes → chords → Tonnetz → transforms, but skips circle of fifths, tonal centers/keys, modes, and chord progressions. These are essential connective tissue.

4. **Playful lens is underdeveloped.** The "playful" depth level exists in the content schema but hasn't been refined. After shipping the intro module, we know what "approachable" feels like — time to apply that sensibility to the lens system.

5. **One-size-fits-all experience.** A total beginner, a gigging musician, and a theory nerd all see the same thing. The learn → practice → test framework works for music students, but beginners need something more guided and playful, while advanced users want deeper tools.

**Cross-cutting concern: No AI-powered feedback yet.** The adaptive difficulty and AI tutor feedback system (shared/ai.js / config.js) was specced early but never built for the Tonnetz platform. This enables the most compelling personalization features.

---

## Proposed Phases

### Phase A: Missing Concepts + Voicing Explorer MVP ✅ Complete

**Goal:** Fill the conceptual gaps so the intro module and Theory Hub cover the essential vocabulary a learner needs before games make sense. Build the Voicing Explorer as a layer within the existing Explorer.  
**Depends on:** Phase 5 (intro module) being done.  
**Sessions:** Complete

**A1. Circle of Fifths interactive module** ✅  
Standalone educational page at `/theory/circle-of-fifths` wrapping the existing ChordWheel component with scale playback and educational content panels. Includes vii° diminished chord marker with explanatory text.

**A2. Tonal centers & keys** ✅  
Interactive lesson at `/theory/tonal-centers` with 4-step guided walkthrough (including unresolved V chord moment) and ear training exercise where users identify the tonic from 4 candidate keys.

**A3. Modes overview** ✅  
Interactive mode explorer at `/theory/modes`. Pick a mode, hear it, see it on keyboard, brightness ordering (Lydian → Locrian).

**A4. Chord progressions & common patterns** ✅  
Interactive chord progression player at `/theory/chord-progressions`. Roman numeral overlay on Tonnetz showing chord function. "Songs that use this" references from Song Examples Database (81 entries in `song-examples.js`). **Multi-chord glow worm paths** (voice leading visualization — simultaneous paths showing notes that stay vs. move) still a top priority for future enhancement.

**A5. Voicing Explorer MVP** ✅  
ChordResolver with interval-content fallback, Note Mode with octave-specific keyboard selection, glow worm path visualization, full three-panel bidirectional sync via HarmonyState.

**Fretboard panel** ✅  
Guitar fretboard as a composable Explorer panel (`fretboard-view.js`). Multi-position highlighting with practical voicing clusters. Keyboard/Fretboard/Both toggle on Explorer.

---

### Phase A+: Game Visual Unification + MIDI Input

**Goal:** Unify all game/education page aesthetics under the SongLab design system. Add MIDI input as a shared capability across the platform.  
**Depends on:** Phase A (design tokens and base.html restyle established).  
**Sessions:** 3–5

**A+.1. Game shell CSS extraction** (`game-shell.css`)  
Extract common patterns from existing games into a shared stylesheet: page container, top bar (title + back link + mode tabs), card component, stats bar, setup screen grid, button styles, feedback toast, results screen, leaderboard, mode tabs (Intro/Practice/Test), difficulty selector pills. Each game layers game-specific styles on top.

**A+.2. Game template unification**  
All games extend `base.html` (fix Swing Trainer — currently standalone). All games use design tokens from `design-tokens.css`. Strip inline `<style>` blocks down to game-specific rules only. Consistent warm light theme across all game pages.

**A+.3. MIDI input module** (`midi-input.js`)  
Shared module using Web MIDI API. Publishes noteOn/noteOff events to HarmonyState. Target device: Novation Launchkey 49. Enables:
- **Explorer:** Real-time chord detection from MIDI → Tonnetz lights up
- **SkratchLab:** Play melody over backing tracks with physical keyboard
- **Games:** MIDI keyboard as alternative input for Melody Match, Harmony Trainer
- **Voicing Explorer Live Mode:** Real-time projection of played notes along Tonnetz axes

Pulled forward from Phase F3. The full `NoteInputProvider` abstraction (unifying keyboard clicks, voice/pitch detection, and MIDI under one interface) can come later — basic MIDI → HarmonyState is the immediate win.

---

### Phase A++: Audio & Input Architecture

**Goal:** Migrate real-time audio DSP from server-side (Python/librosa, ~200 ms latency) to client-side (Web Audio API, ~30 ms latency). Establish five detection modalities as first-class platform capabilities. Add audio interface support. Deliver unified input abstraction for games.  
**Depends on:** Phase A+ (MIDI input landed, shared `Tone.Analyser` exists in Spectrum panel).  
**Spec:** `docs/audio-architecture.md`  
**Sessions:** 3–5

**Why now:** The April 14 MIDI + Spectrum work created the infrastructure (shared FFT analyser, HarmonyState event model) that makes client-side DSP practical. Without this phase, rhythm games (Polyrhythm Trainer, Rhythm Tapper) can't use mic input (server roundtrip too slow), Melody Match is broken in production (calls non-existent routes), and the Scarlett 2i2 sits unused. This is the foundation Phase B's new games build on.

**A++.1. Dead code cleanup** (audio.js)  
Delete broken `startPitchDetection()` / `stopPitchDetection()` (call non-existent `/start_listen` and `/poll_audio` routes) and unreferenced `autocorrelate()`. Keep all note/frequency conversion functions and playback. Fix Melody Match import.

**A++.2. Audio input device selection** (`audio-input.js`)  
Enumerate audio input devices, auto-detect known interfaces (Scarlett, Focusrite, etc.), let user pick. Feed selected device's `MediaStream` into the shared `Tone.Analyser` chain. Spectrum panel (Harmonic Resonance) reads live external audio — guitarist plugs into Scarlett, sees harmonics visualized in real-time. Pairs with `midi-input.js` in a shared "Hardware" settings panel: `🎹 Launchkey 49 ✅` / `🎸 Scarlett 2i2 ✅`. Stores device preference in localStorage.

**A++.3. Onset detection** (`onset-detection.js`)  
Spectral-flux algorithm reading from existing `Tone.Analyser`. Detects attack timing for taps, claps, plucks, vocal "ta." Exports `start(onOnset)` with `{ timestamp, strength }`. Adjustable threshold and cooldown. This is the **highest-leverage single module** — half a day of work, unlocks Polyrhythm Trainer + upgrades Rhythm Lab, Strum Patterns, Swing Trainer. Note: single mic = single onset stream; polyrhythm Level 2 needs two input channels (two keys, two MIDI pads, or mic + keyboard).

**A++.4. Client-side pitch detection** (`pitch-detection.js`)  
YIN algorithm for monophonic pitch (voice, single-note guitar). Strategy pattern: `engine: 'yin'` (free, ~3 KB) swappable to `engine: 'crepe'` (Pro tier, ~5 MB lazy-load, Phase E). Identical callback API regardless of engine: `{ frequency, note, octave, cents, confidence }`. Pedagogical grace window (±15 cents → "close enough"). Confidence threshold below which game shows "Try again" instead of scoring wrong. Replaces server-side `/process_audio_chunk` for real-time games. Fixes Melody Match.

**A++.5. Client-side chord detection** (`chord-detection.js`)  
Port of `chord_detector.py` logic to JS: chroma vector from FFT → template matching (10 chord types) → bass note detection → publish to HarmonyState. Reuses `ChordResolver.resolveChord()` for key-aware disambiguation. Quality depends on source: **interface (Scarlett DI) = excellent; built-in mic = experimental.** UI communicates expectations honestly per source quality.

**A++.6. Unified input provider** (`input-provider.js`)  
Thin abstraction: each game declares supported modalities → provider emits uniform event stream (`noteOn`, `noteOff`, `onset`, `chord`) regardless of source → input-picker UI renders available options as pills. Games are modality-agnostic from day one. Full `NoteInputProvider` from Phase F3 becomes an extension of this foundation rather than a ground-up build.

**Game input support matrix (declared per game):**

| Game | click | midi | onset | pitch | chord |
|---|---|---|---|---|---|
| Harmony Trainer | ✅ | ✅ | — | ✅ | — |
| Strum Patterns | ✅ | — | ✅ | — | — |
| Swing Trainer | ✅ | ✅ | ✅ | — | — |
| Melody Match | ✅ | ✅ | — | ✅ | — |
| Chord Spotter | ✅ | ✅ | — | — | ✅ |
| Rhythm Lab | ✅ | ✅ | ✅ | — | — |
| Scale Builder | ✅ | ✅ | — | ✅ | — |
| Relative Key Trainer | ✅ | — | — | — | — |
| Polyrhythm Trainer (B8) | ✅ | ✅ | ✅ | — | — |
| Voice Leading Detective (B7) | ✅ | ✅ | — | — | ✅ |

**Python backend retention:** Server-side DSP (`pitch_matcher.py`, `chord_detector.py`, `/process_audio_chunk`) stays in codebase as legacy fallback and future "upload recording for analysis" path (Phase E). No changes needed — just stop routing real-time game traffic through it.

---

### Phase B: Game Library + Game Engine Extraction

**Goal:** Extract the shared game engine, unify adaptive difficulty, expand the game library with new game types. All new games built on `input-provider.js` (Phase A++) for modality-agnostic input from day one. Two categories of games identified (see `game-engine-spec.md`):
- **Performance games** (training precision): No Learn mode needed, difficulty axes control tolerance/pool. Harmony Trainer, Strum Patterns, Swing Trainer, Melody Match, Chord Spotter, Rhythm Lab.
- **Learning games** (teaching concepts): Stage-based with Intro/Practice/Test per stage. Scale Builder, Relative Key Trainer.

**Depends on:** Phase A++ (input-provider.js, onset/pitch/chord detection modules).  
**Sessions:** 6–10  

**First task: Extract `game-flow.js` shared module**

Supports both game structures via a single state machine. Key design decisions from game audit:

*Adaptive engine (Pattern B — standardize across all games):*  
Promote after N consecutive correct, demote after N consecutive wrong. Each game can have **independent adaptive axes** that promote/demote separately. Examples:
- Harmony Trainer: interval pool (what intervals) + pitch tolerance (±50¢/30¢/15¢) as independent axes
- Strum Patterns: timing tolerance (±100/60/30ms) + visual scaffolding (lookahead measures) as independent axes
- Melody Match: interval complexity + melody length + replay limit

*ResultDetail logging (competency-graph-ready schema):*  
Every game logs structured results through game-flow.js. Common envelope: `{ gameId, timestamp, mode, difficulty, duration, correct, detail: {...} }`. Game-specific detail shapes designed for future competency graph aggregation (see `game-engine-spec.md` for per-game schemas). Stored in localStorage until Phase B.5, then piped to Supabase.

*Song connections:*  
All games surface "Hear it in a song" callouts where song-examples DB has relevant entries. Links to Explorer walkthroughs from game context. Closes the loop: game → song → walkthrough → game.

**B1. Scale Builder** ✅  
4-stage learning game with Intro/Practice/Test per stage. Animated eighth-note mascot. Stages: Major Scale → Tetrachords & Fourths → Key Chain → Relatives. Best-structured game — template for learning game pattern in game-flow.js.

**B2. Note Name Trainer**  
Flash-card style: show a note on a staff (or keyboard), name it. Or: hear a note, name it. Timed mode for gamification. Streak tracking. Simple but fills a gap — many beginners don't know note names fluently.

**B3. Interval Spotter (enhanced)**  
The Harmony Trainer already does interval recognition. This is a focused, simplified version: just intervals, no chords. "Name That Interval" — hear two notes, identify the interval. Visual: show the interval on the Tonnetz as a distance/direction. Reference songs for each interval from the Song Examples Database.

**B4. Chord Progression Builder**  
Drag-and-drop Roman numerals to build a 4- or 8-bar progression. Hear it play back. See it on the Tonnetz as a path. Preset progressions to explore from the Song Examples Database ("try the 50s progression: I-vi-IV-V"). This bridges theory knowledge and creative application.

**B5. Rhythm Tapper**  
Hear a beat pattern, tap it back. Evaluates timing accuracy. Starts with quarter notes, adds eighth notes, syncopation, rests. Bridges Rhythm Lab (basic beat-keeping) and Strum Patterns (complex motor patterns).

**B6. Melody Dictation (enhanced Melody Match)**  
Hear a short melody, notate it (select notes on a staff or keyboard in order). Starts with 3 notes stepwise, progresses to longer melodies with leaps. Different from singing-based Melody Match — this is about ear-to-notation translation.

**B7. Voice Leading Detective** ⭐ (high priority — depends on multi-chord glow worm paths)  
Given a start chord and target chord, change the fewest notes to get there. Three levels:
- Level 1 (Single transforms): C major → A minor — one note moves (R transform). Player identifies which note and where.
- Level 2 (Chained transforms): C major → F minor — find shortest path on Tonnetz. Multiple solutions; scored by fewest moves.
- Level 3 (Real progressions): Voice lead through I-vi-IV-V. Practical application for songwriting/arranging.
The "so what?" moment for neo-Riemannian theory — bridges learning games (Relative Key Trainer teaches P/L/R) with musical application. Direct consumer of multi-chord glow worm visualization. Three-panel Explorer is the interface. Pro extension: explore alternative voicings for musicality (inversions, drop-2, rootless).

**B8. Polyrhythm Trainer** ⭐ (first game built natively on `input-provider.js` + `onset-detection.js`)  
Two buttons/keys, each mapped to a different rhythm layer. Tap both simultaneously. **Primary mic modality: onset detection** (clap, tap, voice "ta") — not pitch. Single mic = single onset stream, so Level 2 uses two keyboard keys or two MIDI pads; mic handles Level 1 only.
- Level 0 (Listen): Just hear the polyrhythm with visual showing lock points. No interaction.
- Level 1 (Feel it): Tap ONE layer (mic onset or key), other plays automatically.
- Level 2 (Split it): Tap BOTH layers (two keys, two MIDI pads). Accuracy scored per layer independently.
- Level 3 (Real songs): Play polyrhythms from real songs at tempo (e.g., Linus and Lucy dotted quarter vs straight eighth).
Progression: 2:3 → 3:4 → dotted patterns → exotic ratios. Visual: two horizontal scrolling ribbons with shared "now" line. Could leverage SkratchLab Rhythm Builder grid. See `docs/audio-architecture.md` for onset detection constraints.

---

### SkratchLab Evolution: Lightweight DAW (parallel to Phase B)

**Goal:** Evolve SkratchLab from a block-coding tool into a creative music playground — a super lightweight DAW that appeals to kids, casual users, and anyone who wants to *make* something rather than be tested.  
**Sessions:** 3–5 (can run in parallel with Phase B game work)

**Vision:** Pick a song from the song-examples DB → chord progression loops automatically → drums/rhythm run underneath (from walkthrough rhythm data) → player plays melody on top via keyboard, MIDI, or drag-and-drop note blocks. Basically GarageBand for theory-aware play.

**What exists now:**
- Blockly workspace with PLR transform blocks, music blocks, audio blocks
- Rhythm Builder (4×8 drum machine grid with presets, Tone.js playback, export to Blockly)
- Record-and-export bridge from Explorer (sessionStorage → pre-loaded session)
- MIDI export via MidiWriterJS

**What's needed:**
1. **Song preset loader** — pick a song from song-examples DB, auto-load chord loop + rhythm pattern + BPM. Kid-friendly subset with simple progressions.
2. **Melody lane** — a track where users place/play notes over the backing. Could be piano-roll style, step sequencer, or real-time via keyboard/MIDI.
3. **Instrument selector** — swap between piano, guitar, synth, etc. for each track.
4. **Mix controls** — volume per track (drums, chords, melody), already partially built for rhythm/chords separation.
5. **Theory connection** — "You just played over a I-V-vi-IV progression. Here's what that looks like on the Tonnetz." One-tap link to Explorer with the progression loaded.

**Why this matters:**
- Different kind of appeal than games — creative play, not assessment
- Kids don't want to be quizzed; they want to make something that sounds cool
- Natural on-ramp: preset songs → tweak the beat → add melody → "I made music"
- Connects to MIDI input (A+.3) — play Launchkey 49 over backing tracks
- Teacher use case: "open SkratchLab, pick a song, play along" — instant class activity

---

### Phase B.5: Auth & Persistence

**Goal:** Add user authentication and server-side persistence so curriculum progress, preferences, and assessment data survive across sessions and devices.  
**Depends on:** Phase B providing enough learn/practice/test implementations to resolve B8 (Practice vs Test schema).  
**Sessions:** 2–3

**Why here and not earlier or later:**
- **Not earlier:** Phases A and B are rapid iteration on content and games. Auth adds deployment complexity (Supabase project, env vars, OAuth config) and slows down the build loop. localStorage works fine for single-device development and testing.
- **Not later:** Phase C creates structured curriculum paths (8–11 steps) where losing progress is genuinely painful. Phase D tracks achievements. Phase E requires authenticated API calls for session data. All three assume persistent identity.
- **Why B.5 specifically:** By the end of Phase B, you'll have built Scale Builder and 1–2 more games using the learn/practice/test pattern. That's 4+ implementations (Chord Walks, Harmony Trainer, Scale Builder, +1) — enough data to confidently resolve B8 and design the Supabase schema without rework.

**B.5.1. Supabase project setup**  
Create project, configure auth providers (email + optional Google/GitHub OAuth), set up database tables: `user_profiles`, `game_sessions` (with `mode` enum: practice | test | explore), `user_song_preferences` (created empty, populated by Phase C).

**B.5.2. Auth UI**  
Login/signup modal, session management, "continue as guest" fallback (localStorage mode still works for anonymous users who don't want to create an account).

**B.5.3. Extend backend API proxy**  
The MVP backend proxy (already handling API key security) gets auth middleware. Routes: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`.

**B.5.4. Profile migration**  
One-time migration of localStorage profile → Supabase `user_profiles` table. Schema matches current localStorage shape + auth metadata. On first authenticated login, if localStorage profile exists, prompt "Import your existing progress?" and migrate.

**B.5.5. Resolve B8: Practice vs Test schema**  
`game_sessions` table: user_id, game_id, mode (practice | test | explore), score, duration, timestamp, and a game-specific metadata JSON column for flexible per-game data (intervals attempted, chords confused, timing accuracy, etc.). Practice sessions accumulate freely. Test sessions are gated and track pass/fail for curriculum advancement.

**B.5.6. Song preferences table**  
`user_song_preferences`: user_id, example_id, rating (+1/-1), timestamp. Created during setup, populated by Phase C feedback UI.

**What B.5 does NOT include:** Competency Graph, cross-device sync of mid-session game state, social features, admin/teacher dashboards.

---

### Phase C: Curriculum & Learning Paths

**Goal:** Build the navigation layer that connects intro content, Theory Hub topics, and games into coherent learning journeys.  
**Depends on:** Phases A and B providing enough content and games to link to. Phase B.5 providing persistent user state.  
**Sessions:** 4–6

**C1. Define curriculum tracks**  
Three tracks (already specced in earlier planning):
- **Music Foundations** (beginner path): ~11 steps from "what is sound" through scales and triads. Default lens: playful. Links heavily to Scale Builder, Note Name Trainer, and SkratchLab starters.
- **Working Musician** (intermediate path): ~8 steps from intervals through chord function and cadences. Default lens: musician. Links to Harmony Trainer, Chord Walks, Chord Progression Builder, Strum Patterns.
- **Tonnetz & Transforms** (deep diver path): ~6 steps covering Tonnetz geometry through hexatonic cycles. Default lens: theorist/math. Links to Chord Walks (advanced tiers), Puzzle Paths (when built).

**C2. Theory Hub path runner UI**  
Already specced (Task 4.6 in original build plan): step-by-step runner with progress bar, current step display, action buttons linking to games/starters/visualizations, and "Mark Complete" advancement. Each step is interactive — no step is "just read this." Progress persists in Supabase.

**C3. Tonnetz as curriculum map**  
Visual navigation using the Tonnetz grid itself as a map of learning progress. Topics/games are nodes. Edges represent prerequisites or natural next steps. Completed nodes are lit up. Current frontier is highlighted. Unexplored territory is dimmed. This is the "fog of war" concept from Phase 8 of the original plan — now grounded in curriculum structure rather than arbitrary game progression.

**C4. Onboarding → curriculum routing**  
The existing onboarding presets (beginner / some experience / experienced musician / theory nerd / just exploring) map directly to curriculum tracks. After onboarding, the dashboard surfaces "Your Path" prominently with a clear "Continue" button. First-time visitors who skip onboarding get the beginner path by default.

**C5. Song Examples DB v2: preference feedback UI**  
Add thumbs up/down buttons wherever song examples appear (Theory Hub, game contexts, tips pill). Votes stored in `user_song_preferences` (Supabase). Example selection logic updated: prefer examples whose `preference_tags` overlap with the user's highest-weighted genres. Fall back to age/era bracket if no preference data exists. Genre affinity computed server-side from accumulated votes — simple weighted model, no ML needed.

---

### Phase D: Differentiated Experiences by User Level

**Goal:** Make the platform feel different for beginners vs. music students vs. experienced musicians.  
**Sessions:** 3–5

**D1. Beginner mode refinements**  
More visual, less text. Bigger buttons, friendlier language, more celebration on success. "Playful lens" is the default everywhere — refine it now that the intro module has established the tone. Scaffolded freedom: in SkratchLab, beginners get curated starters with guardrails (limited note range, pre-set instruments). As they progress, more blocks/options unlock. Achievement system: simple badges for milestones ("Built your first scale!", "Completed the intro!", "10-day streak!").

**D2. Music student mode**  
The learn → practice → test framework is the default here. Each topic has: a Theory Hub explanation (musician lens) → a practice game → a test/assessment in the same game or SkratchLab. Progress tracking shows skill gaps: "Strong on intervals, needs work on chord inversions."

**D3. Experienced musician / theory nerd mode**  
Skip intros by default. Deep-dive content available immediately. Tonnetz & Transforms path is surfaced. Advanced games and tools: Puzzle Paths, Chord Walks at Tier 3-4, advanced Harmony Trainer. Math lens available on everything. MIDI input for assessment using real instruments (available from Phase A+.3). Voice Leading Detective Level 3 for practical voice leading exploration.

---

### Phase E: AI-Powered Feedback

**Goal:** Add intelligent, session-aware feedback that spots patterns a simple score can't.  
**Depends on:** Backend API proxy (for key security), auth (for user identity), games generating enough data to analyze.  
**Sessions:** 5–8

**Shortened path available:** The critical dependency chain is B (game-flow.js + ResultDetail logging) → B.5 (auth/persistence) → E5 (Competency Graph). Phases C and D are *not* prerequisites for E5 — the graph works with just games and auth. This path is ~10–16 sessions. C and D can run in parallel or after E5.

**E1. Backend AI proxy + session data pipeline**  
The backend API proxy gets extended to handle AI feedback requests. Each game sends session data (attempts, errors, timing, patterns) to a lightweight endpoint. Session data is batched and sent to Claude for analysis at session end (not per-attempt — too expensive and slow).

**E2. Melody Match — pitch pattern analysis**  
After a session, AI analyzes the pattern of pitch errors across rounds. Example feedback: "You're nailing intervals within a third, but when the melody jumps a fifth or more, you're consistently landing about a half step flat. Try thinking of the first two notes of 'Star Wars' for that P5 jump." (References Song Examples DB.) Feedback appears on the results screen, not mid-game.

**E3. Strum Patterns — timing analysis**  
AI analyzes where in the beat the user consistently rushes or drags, which strum transitions are weakest. Example: "Your down-up transitions are solid but you're rushing the rest between beats 2 and 3. Try counting 'one-and-TWO-and' with emphasis on the rest."

**E4. Harmony Trainer — chord recognition patterns**  
Spots which chord qualities or intervals the user confuses most. Example: "You're mixing up minor 7ths and major 7ths — try listening for whether the top note feels 'resolved' (major 7th) or 'bluesy' (minor 7th)."

**E5. Cross-game learning recommendations (Song Examples DB v3)**  
The Competency Graph concept (Phase 9 from original plan): shared micro-skill tracking across all games. AI synthesizes data from multiple games: "You understand intervals well in isolation (Harmony Trainer) but struggle to apply them in melodic context (Melody Match). Try the Scale Builder to bridge that gap." AI references familiar songs from the user's preference-weighted examples. Drives adaptive curriculum suggestions.

---

### Phase F: Advanced Features (Post-Curriculum)

**Goal:** The ambitious features that require the curriculum and game infrastructure to be mature.  
**Sessions:** 8+ (these are big)

**F1. Puzzle Paths game**  
Neo-Riemannian pathfinding: navigate from start chord to target chord using P/L/R transforms. Progression Library: blues turnaround, doo-wop, Axis of Awesome, Andalusian cadence, Creep, jazz ii-V-I, Pachelbel's Canon. Uses Song Examples DB for real-song context on each progression. *Note: basic Puzzle Paths (pathfinding + progression tracing, types 1 and 2 in the spec) could ship with Phase B or C without waiting for Phase E. Only ear-based puzzles require the competency graph dependency.*

**F2. Fog of War / spatial progress map**  
The Tonnetz grid as a progress visualization: explored regions are revealed, unexplored areas are dimmed. Ties into curriculum completion and game performance.

**F3. NoteInputProvider full abstraction**  
Extends the thin `input-provider.js` from Phase A++ into the complete unified input system: input recording/playback for replays, input quantization for rhythm games, multi-source mixing (e.g., MIDI + onset simultaneously), per-game input analytics, and full assessment-with-real-instruments capability. The A++ thin version handles event routing and UI; this phase adds the infrastructure for deep game integration.

**F4. Voicing Explorer — Advanced Features**  
Post-MIDI additions: Sequence Mode (record/playback melodies with interval projections applied), voice leading visualization (show which notes move between chord shapes, with optional neo-Riemannian P/L/R labels), shape library (save/recall voicings, requires auth), advanced projection UI (multiple simultaneous projections, inversion awareness). See `voicing-explorer-spec.md`.

**F5. Collaborative / social features**  
Share your SkratchLab creations. Leaderboards for games (optional, not the primary motivation). "Challenge a friend" on specific exercises.

---

## Song Examples Database — Cross-Cutting Asset

The Song Examples Database is a curated collection of real-song references that illustrate theory concepts. It evolves across three versions as the platform matures.

### v1: Static Asset ✅ (shipped)

A single `song-examples.js` file in the repo containing 81 entries (v1.1 + rhythm additions). No auth dependency. Surfaced by concept + age bracket + user's onboarding preset. Includes `swing_ratio` field for swing feel entries and `concept_specifics` for rhythm (train_beat, shuffle, syncopation, odd_meter, backbeat).

**Schema per entry:**
```json
{
  "id": "jaws_m2",
  "concept_ids": ["intervals"],
  "concept_specifics": ["minor_2nd"],
  "game_ids": ["harmony_trainer", "melody_match", "interval_spotter"],
  "song": "Jaws Theme",
  "artist": "John Williams",
  "year": 1975,
  "genre_tags": ["film_score", "orchestral"],
  "insight": {
    "playful": "The scary shark music? Just two notes going back and forth, one tiny step apart. That's why it sounds so tense!",
    "musician": "The Jaws ostinato is a semitone oscillation (E-F) — a minor 2nd. It's a masterclass in how a single interval creates tension through repetition and rhythm alone.",
    "theorist": "Williams exploits the minor 2nd's inherent dissonance. The interval's instability combined with rhythmic acceleration creates anticipatory dread without harmonic resolution."
  },
  "min_age": 6,
  "era_tags": ["classic", "film"],
  "demo": {
    "notes": ["E3", "F3"],
    "rhythm": "quarter-quarter",
    "tempo": 120,
    "loop": true
  },
  "preference_tags": ["film", "scary", "orchestral"]
}
```

**Where v1 surfaces:**
- Theory Hub: "hear it in a song" links on topic cards
- Phase A4 chord progressions: "Songs that use this" on each progression
- Phase B3 Interval Spotter: reference song for each interval
- Phase B4 Chord Progression Builder: preset progressions with song context
- Intro module: song references woven into narration
- Tips pill: optional "real song" links in tooltip content

### v2: Preference-Aware (ships during Phase C)

Auth exists. Adds thumbs up/down feedback UI (task C5), Supabase storage, genre affinity scoring, and preference-weighted example selection. See Phase C5 for details.

### v3: AI-Enhanced (ships during Phase E)

AI feedback references the song database in personalized recommendations. See Phase E2 and E5 for details.

### Initial Seed Categories

**Intervals:** Jaws (m2), Happy Birthday (M2), Smoke on the Water (m3), When the Saints Go Marching In (M3), Here Comes the Bride (P4), Star Wars (P5), The Simpsons (tritone), Somewhere Over the Rainbow (octave)

**Key/Tonality:** Eleanor Rigby (major vs minor ambiguity), Happy by Pharrell (unambiguous major), Billie Jean (unambiguous minor), Hey Jude (major with minor inflections)

**Chord Progressions:** Creep (I-III-IV-iv, chromatic mediant + borrowed chord), Pachelbel's Canon (I-V-vi-iii-IV-I-IV-V), Let It Be / No Woman No Cry / Axis of Awesome (I-V-vi-IV), 12-bar blues (I-I-I-I-IV-IV-I-I-V-IV-I-V), Don't Stop Believin' (I-V-vi-IV)

**Transforms / Neo-Riemannian:** Creep's III as chromatic mediant (L transform), film score examples for P/L/R chains

**Rhythm:** We Wish You a Merry Christmas (3/4), Mission Impossible (5/4), Take Five (5/4)

**Scales/Modes:** Simpsons theme (Lydian), Get Lucky / Norwegian Wood (Mixolydian), So What (Dorian), White Rabbit (Phrygian)

### Walkthrough Scaling Strategy

14 hand-curated walkthroughs shipped. 81 songs in database. Scaling plan:
- **Batch 1 (manual):** ✅ 14 flagship walkthroughs with rich annotations, rhythm data, audience tags
- **Batch 2 (semi-auto):** Build a walkthrough generator — given a song's chord array, auto-generate walkthrough steps with generic annotations. Hand-tune for featured songs.
- **Ongoing:** New songs added to `song-examples.js` automatically get basic walkthroughs

**Walkthrough backlog:** Vienna (Billy Joel — chromatic mediant, bass voice leading), Take Five (5/4 odd meter), Superstition (syncopation)

### Song Packs Architecture (ships with Phase C or later)

Free core of songs/games/tools available to everyone, plus add-on packs that unlock additional content. Packs are curated collections with pedagogical framing, difficulty progression, and genre-specific annotations.

**Pack structure:**
```
/static/packs/
  core.json          ← free, ships with platform (~12-15 songs)
  classic-rock.json
  jazz-standards.json
  americana.json
  kids-songs.json
  pop-hits.json
```

Each pack is a JSON file with song entries, a learning path order, and milestones. Pack loader in JS merges pack songs into the `song-examples.js` registry. Supabase (Phase B.5) stores which packs a user has access to.

**Monetization:** Free tier = core pack + all tools/Explorer/games. Paid packs = $3-5 each or $15/year for all. Teachers get bulk/classroom pricing. Free tier is the distribution engine — never paywall the tools.

**Kids pack:** Simpler visual language, songs kids know, game-first entry, shorter walkthroughs (3-4 chords), eighth-note mascot as guide. Nursery rhymes and public domain songs are safe. Disney/modern movie songs require licensing — avoid unless licensed.

### Copyright Considerations

**What's safe:**
- Chord progressions: not copyrightable in the US (*Skidmore v. Led Zeppelin*, 2020)
- Functional analysis: teaching "this song uses I-V-vi-IV" is factual/educational
- Song titles: generally not copyrightable (trademark can arise with distinctive titles)
- Your original annotations and walkthrough text: 100% yours
- Salamander piano playing chord progressions: fine (generated audio, not sampled recordings)

**What needs caution:**
- Lyrics: never include, not even one line
- Melody transcription: stick to chords only
- Specific arrangements: transcribing a specific guitar voicing from a recording approaches arrangement copyright
- Album art, artist photos: don't include
- "Play along" features synced to recordings: avoid

**Safe framing pattern per song:** title + artist (factual reference), key + tempo (factual), chord progression in symbols (not copyrightable), original walkthrough annotations, link to listen on Spotify/Apple Music.

**IP attorney consult planned before commercializing paid packs.**

---

## Dependency Graph

```
Phase A (Missing Concepts + Voicing Explorer MVP) ✅ Complete
  │
  ↓
Phase A+ (Game Visual Unification + MIDI Input)
  │  ├── A+.1: game-shell.css extraction
  │  ├── A+.2: game template unification
  │  └── A+.3: MIDI input module ✅ (landed April 14)
  │
  ↓
Phase A++ (Audio & Input Architecture) ← current focus
  │  ├── A++.1: dead code cleanup (audio.js)
  │  ├── A++.2: audio-input.js (Scarlett + device picker)
  │  ├── A++.3: onset-detection.js (highest leverage)
  │  ├── A++.4: pitch-detection.js (YIN; CREPE upgrade in Phase E)
  │  ├── A++.5: chord-detection.js (port of chord_detector.py)
  │  └── A++.6: input-provider.js (thin unified abstraction)
  │
  │  ← can run in parallel ──────────────────────────────┐
  ↓                                                       │
Phase B (Game Library + Game Engine)                       │
  │  First: extract game-flow.js (Pattern B adaptive,     │
  │         ResultDetail logging, independent axes)        │
  │  B7 Voice Leading Detective needs glow worm paths     │
  │  B8 Polyrhythm Trainer: first game on input-provider  │
  │                                                       │
  │  SkratchLab DAW (parallel) ──────────────────────────┘
  │  Song Examples DB v1 ✅ (84 entries)
  │
  ↓
Phase B.5 (Auth & Persistence)
  │  ├── Supabase setup + auth UI
  │  ├── ResultDetail → Supabase migration
  │  └── Song preferences table
  │
  │  ┌──────────────────────────────────────────────┐
  ↓  ↓                                              │
Phase E5 (Competency Graph)  ← FAST PATH            │
  │  Cross-game skill tracking from ResultDetail    │
  │  Skips C and D on the fast path                 │
  │                                                 │
  │  ← can run in parallel ────────────────────────┐│
  ↓                                                ││
Phase C (Curriculum & Learning Paths)              ││
  │  └── Song Examples DB v2 (preference UI)       ││
  │                                                ││
  ↓                                                ││
Phase D (Differentiated UX)                        ││
  │                                                ││
  ↓                                                ││
Phase E1–E4 (Per-game AI Feedback)  ←──────────────┘│
  │  ├── Song Examples DB v3 (AI-enhanced)          │
  │  └── CREPE pitch engine upgrade (Pro tier)      │
  │                                                 │
  ↓                                                 │
Phase F (Advanced)  ←───────────────────────────────┘
  │  ├── F1: Puzzle Paths
  │  ├── F3: NoteInputProvider full abstraction (extends A++.6)
  │  ├── F4: Voicing Explorer advanced
  │  └── F5: Social features
```

**Fast path to Competency Graph:** A+ → A++ → B → B.5 → E5 (~13–21 sessions).  
C and D can run in parallel or after. SkratchLab DAW is parallel to B.

---

## New Game Ideas — Brainstorm Backlog

These are ideas that didn't make the Phase B cut but are worth revisiting:

- **Key Signature Speed Run:** Flash a key signature, name the key. Timed. Good for music students.
- **Chord Inversion Trainer:** Hear a chord, identify root position vs. 1st vs. 2nd inversion. Natural extension of Chord Spotter.
- **Cadence Identifier:** Hear a cadence (perfect, plagal, deceptive, half), name it.
- **Transpose It:** Given a melody in one key, transpose it to another. Visual + audio.
- **Sight-Reading Simulator:** See notes on a staff, play them on the keyboard in time. Requires MIDI for full experience.
- **Blues Scale Improviser:** Given a 12-bar blues backing track, play along using the blues scale. AI evaluates note choices and timing. Natural SkratchLab integration.

---

## Open Design Questions

1. **Learn → scaffold → quiz framework:** ~~Should this be extracted as a shared component before building more games?~~ **Resolved:** Extract `game-flow.js` at the start of Phase B. Game audit (April 11) established two game types: Performance (no Learn mode, difficulty axes) and Learning (stage-based, Intro/Practice/Test). Pattern B adaptive as standard. Independent axes per game. See `game-engine-spec.md`.

2. **Tonnetz as navigation:** How literal should this be? Full spatial map with fog of war, or a simpler node graph that uses Tonnetz aesthetics? The full spatial version is more distinctive but harder to build and potentially confusing for beginners.

3. **Achievement system:** Badges? Points? Streaks? What motivates without feeling cheap? Research suggests progress visualization (seeing your knowledge grow on the Tonnetz map) may be more motivating than badges for adults.

4. **AI feedback frequency:** Per-session is the plan, but should there be a lighter "nudge" system that doesn't require an API call? E.g., rule-based hints that fire when the game detects a pattern (3 consecutive errors on the same interval type → show a tip). **Decision (April 11):** Don't build interim session-level feedback — go straight to Competency Graph via fast path (B → B.5 → E5). Design ResultDetail schema now so logging is graph-ready from day one.

5. **Content authoring workflow:** As the number of topics, games, and curriculum steps grows, the current approach of manually editing theory-content.js gets unwieldy. At what point do we need a simple CMS or at least a structured data format with validation?

6. **SkratchLab as lightweight DAW vs. block-coding tool:** How far does SkratchLab evolve toward a DAW? Song presets, melody lanes, and mix controls make it appealing to casual users, but the Blockly workspace is the unique differentiator. Need to find the balance — or split into two modes (Creative Play / Code Mode).

7. **MusicNotes-style licensing for song packs:** Chord progressions are not copyrightable (Skidmore v. Led Zeppelin 2020), but playable backing tracks that closely reproduce original recordings may approach mechanical license territory. IP attorney consult planned before commercializing paid packs.

---

## Session Budget Estimate

| Phase | Sessions | Cumulative | Notes |
|-------|----------|------------|-------|
| A: Missing Concepts | — | — | ✅ Complete (A1–A5 + fretboard) |
| A+: Visual Unification + MIDI | 3–5 | 3–5 | CSS extraction, template unification, MIDI module. A+.3 ✅ |
| A++: Audio & Input Architecture | 3–5 | 6–10 | Client-side DSP, device picker, onset/pitch/chord detection, input provider |
| B: Games + Engine | 6–10 | 12–20 | game-flow.js first, then new games. B1 Scale Builder ✅ |
| SkratchLab DAW | 3–5 | 15–25 | Parallel to Phase B |
| Song DB v1 | — | — | ✅ Complete (84 entries in song-examples.js) |
| B.5: Auth & Persistence | 2–3 | 17–28 | Focused infrastructure sprint |
| E5: Competency Graph (fast path) | 1–2 | 18–30 | Skips C/D — just needs B + B.5 |
| C: Curriculum | 4–6 | 22–36 | Can run after or parallel to E5 |
| D: Differentiated UX | 3–5 | 25–41 | Mostly configuration + polish |
| E1–E4: Per-game AI Feedback | 4–6 | 29–47 | Per-game analysis sessions. CREPE upgrade here. |
| F: Advanced | 8+ | 37–55+ | Long tail |

**At current pace (~10–16 sessions/week): A+ through E5 in ~2–3 weeks. Full platform through Phase D in ~4–5 weeks.**

---

## Immediate Next Steps (as of 2026-04-16)

1. **Audio dead code cleanup** — Delete broken `startPitchDetection`/`stopPitchDetection`/`autocorrelate` from audio.js. Verify Melody Match is broken in production. (A++.1)
2. **Audio input device selection** — `audio-input.js`, Scarlett auto-detect, device picker, Spectrum panel reads live external audio. (A++.2)
3. **Onset detection** — `onset-detection.js`, spectral flux, highest-leverage single module. (A++.3)
4. **Client-side pitch detection** — `pitch-detection.js` (YIN), fix Melody Match, fix Harmony Trainer. CREPE strategy pattern for Phase E. (A++.4)
5. **Client-side chord detection** — `chord-detection.js`, port of chord_detector.py, interface-recommended. (A++.5)
6. **Input provider** — `input-provider.js`, thin unified abstraction + picker UI. (A++.6)
7. **game-flow.js extraction** — Pattern B adaptive, independent axes, ResultDetail schema. Wire all existing games. (B, first task)
8. **Polyrhythm Trainer** — First game built natively on input-provider + onset-detection. (B8)
9. **User testing prep** — 15–20 participants. Visual unification + working mic input must be done first.

---

## Key Docs

| Doc | Purpose |
|---|---|
| `docs/audio-architecture.md` | **Audio & Input spec** — detection modalities, client-side DSP, device selection, input provider, CREPE upgrade path |
| `docs/game-engine-spec.md` | **Game audit** — per-game analysis, adaptive axes, ResultDetail schemas, new games |
| `docs/design-system-reference.md` | CSS tokens, color palette, typography — design system reference |
| `docs/visual-engine-spec.md` | Generative art engine spec (Tonnetz-driven, post-launch) |
| `docs/explorer-spec.md` | Explorer design, panel specs, canonical orientation |
| `docs/voicing-explorer-spec.md` | Voicing Explorer — chord shapes, glow worm paths, projections |
| `docs/content-architecture.md` | Content model, topic schema, lens system |
| `docs/game-flow-pattern.md` | Learn → Practice → Test pattern (to be updated with audit findings) |
| `docs/auth-architecture.md` | Supabase auth, profile migration, security checklist |
| `docs/KNOWN-ISSUES.md` | Tracked bugs and fixes |
| `docs/claude-code-preferences.md` | Claude Code workflow conventions |

