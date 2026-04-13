# Session Log

Reverse chronological. Quick capture after each session: what happened, what was decided, what's next.

---

## 2026-04-13 — Extended Chord Support, Rename, New Walkthroughs
Focus: Extended chord type system (7ths, diminished, augmented, sus), project rename Tonnetz → SongLab, three new walkthroughs, Explorer visual polish.
Project rename: Tonnetz → SongLab

GitHub repo renamed schones/tonnetz → schones/songlab
Railway service renamed
CLAUDE.md rewritten with SongLab branding, updated doc references
README.md completely rewritten — describes current platform (Explorer, SkratchLab, Games, Fundamentals)
Doc files renamed: tonnetz-content-architecture.md → content-architecture.md, tonnetz-explorer-spec.md → explorer-spec.md, tonnetz-keyboard-component.md → keyboard-component-spec.md, tonnetz-redesign-spec.md → redesign-spec.md
Cross-references updated in STATUS.md, songlab-build-plan.md, voicing-explorer-spec.md, game-flow-pattern.md, claude-code-preferences.md
Music theory concept references to "Tonnetz" left unchanged (correct usage)

Extended chord support (new feature)

transforms.js: Added CHORD_TYPES dictionary (triads, 7ths, sus, extended), chordPCs(), chordNotes(), baseTriad(), extensionNotes(), chordSymbol(). All exported via ES modules + window.Transforms. 6 self-tests added.
harmony-state.js: Added activeChord state field, setChord(root, type, role), highlightChord(root, type, role). setProgressionIndex() branches on chord.chordType (falls back to triad path). clearProgression() and setTriad()/highlightTriad() clear activeChord. 28 tests passing.
Design principle: Triads stay the core; extensions are an additive layer. Tonnetz triangles unchanged; extension notes shown as extra glowing nodes with dashed connectors.
Spec doc: docs/extended-chords-spec.md created

Walkthrough data updates

Folsom Prison Blues: All 5 steps → chordType: "dom7", labels updated (I7/IV7/V7)
Johnny B. Goode: dom7 treatment on C/F/G
ii-V-I Jazz: Dm→min7, G→dom7, C→maj7
Lean On Me: Cmaj7 on C-chord steps

Three new walkthroughs

Bridge Over Troubled Water (musician) — 7 steps, diminished passing chords (F♯°, G♯°), borrowed iv (Fm), gospel ballad 82 BPM. Teaches chromatic bass movement via diminished chords.
Oh! Darling (student) — 5 steps, E→E+→A augmented passing chord, B7 dominant turnaround, 12/8 doo-wop 58 BPM. Simplest augmented chord example.
Life on Mars? (musician) — 8 steps, three augmented chromatic connectors (C+, A+, F♯+), art rock ballad 68 BPM. Advanced augmented chord usage with key destabilization.
All three added to song-examples.js with concept_specifics
Oh! Darling on landing page Students tab; Bridge and Life on Mars on Musicians tab

Visual rendering

Keyboard (keyboard-view.js): Extension notes render with .kv-key--extension class (ring outline in gold #D4A03C), interval labels (♭7, 7, etc.) from EXT_INTERVAL_LABELS map
Tonnetz (tonnetz-neighborhood.js): Extension nodes rendered as smaller glowing nodes (accent color, 0.45→0.75 opacity pulse) with dashed connector lines to nearest triad node
Chord labels: chord-bubble-renderer.js and Explorer both prefer activeChord.symbol ("B7", "Cmaj7") over triad-derived labels
Duplicate label fix: Resolved doubled chord label on Tonnetz (two renderers writing to same position)
Stale activeChord fix: setTriad()/highlightTriad() now clear activeChord to null

Explorer visual polish

Walkthrough sidebar width increased (300px → 400px)
Keyboard key sizes increased (white 120→180px, black 76→115px)
Font sizes doubled throughout Explorer via scoped CSS variable overrides (.sl-explorer)
Tonnetz SVG node labels unaffected (sized in SVG coordinate space)
Panel area flex rebalanced (sl-stage flex: 1 1 0 with min-height floor)

Bug fixes

Walkthrough opening chord double-play suppressed (init audio flag)
Stale activeChord when switching between extended and plain-triad walkthroughs

Decisions

Diminished/augmented on Tonnetz: rendered as standard triangles (they ARE triads). Extension nodes only for 4+ note chords.
Real songs in educational content: chord progressions are not copyrightable; song titles/artist names are factual. Safe for analysis and reference. Consult IP attorney before commercializing song packs.
Oh! Darling as student-level augmented intro; Life on Mars as musician-level. Pedagogical arc: simple → complex.
Flexible panel sizing deferred — default proportions adjusted instead.

Next priorities

Fundamentals Chapter: "Beyond Triads" (7ths, sus, dim, aug — with real-song references linking to walkthroughs)
Verify diminished/augmented rendering in new walkthroughs (setChord with dim/aug triads)
Audit remaining walkthroughs for chordType opportunities
Flexible Explorer panel sizing (user-draggable splitters)
MIDI input module (unchanged from priority stack)


## 2026-04-12 — Game Audit, Build Plan v4, MIDI & SkratchLab Vision

**Game audit (full platform review)**

- Audited all 8 games one by one: code structure, difficulty mechanics, adaptive implementation, styling consistency
- Classified games into two types:
  - **Performance** (training precision, no Learn mode): Harmony Trainer, Strum Patterns, Swing Trainer, Melody Match, Chord Spotter, Rhythm Lab
  - **Learning** (teaching concepts, stage-based with Intro/Practice/Test): Scale Builder, Relative Key Trainer
- Found two different adaptive algorithms in use: Pattern A (punishing — one miss demotes) in Harmony Trainer/Melody Match/Strum Patterns, Pattern B (better — configurable thresholds) in Chord Spotter only
- Standardized on Pattern B with independent axes per game (e.g., Harmony Trainer: interval pool + pitch tolerance as separate axes that promote/demote independently)
- Designed ResultDetail schema for all games — competency-graph-ready from day one
- Identified per-game adaptive axes and song connection opportunities
- Swing Trainer doesn't extend base.html (standalone HTML file) — needs fix
- Created `docs/game-engine-spec.md` with full per-game detail

**New game designs**

- **Voice Leading Detective**: Find minimal voice movement between chords. Three levels (single P/L/R transform → chained transforms → real progressions). The "so what?" moment for neo-Riemannian theory. Depends on multi-chord glow worm paths. Pro extension: explore alternative voicings for musicality.
- **Polyrhythm Trainer**: Two independent rhythm layers (2:3, 3:4, Linus and Lucy dotted quarter pattern). Three levels (tap one layer → both → real songs at tempo). Inspired by playing Vince Guaraldi.

**Build plan updated to v4**

- Phase A marked fully complete
- New Phase A+: game visual unification (game-shell.css extraction) + MIDI input (pulled forward from Phase F)
- MIDI input as shared `midi-input.js` module (Web MIDI API → HarmonyState, Launchkey 49 target)
- SkratchLab lightweight DAW vision captured: song presets with auto chord loops + rhythm, melody play-over, instrument selection — creative play for kids/casual users
- Fast path to Competency Graph identified: A+ → B → B.5 → E5 (skipping C/D), ~10-16 sessions, ~1 week at current pace
- Voice Leading Detective and Polyrhythm Trainer added to Phase B
- Vienna (Billy Joel) added to walkthrough backlog
- Session budget updated to reflect actual pace
- Dependency graph redrawn

**Decisions**

- Don't build interim session-level feedback system — go straight to Competency Graph via fast path
- Design ResultDetail schema now so all game logging is graph-ready from day one
- Store results in localStorage until B.5, then pipe to Supabase
- Game visual unification has zero dependencies — do it first (Phase A+)
- MIDI input is a single-session win that immediately improves Explorer + SkratchLab
- Chord Spotter is the starting point for game-flow.js extraction (already closest to target pattern)
- Rhythm Lab is a beginner gateway to Strum Patterns, not a standalone game
- Scale Builder is the template for learning game structure in game-flow.js
- Song connections ("Hear it in a song") should be added to all games where song-examples DB has relevant entries

**Doc consolidation**

- `tonnetz-next-build-plan.md` → **`songlab-build-plan.md`** (renamed, updated to v4)
- `game-audit-plan.md` → **`game-engine-spec.md`** (renamed — it's a spec, not an audit)
- `songlab-redesign-plan.md` → **`design-system-reference.md`** (renamed — it's a reference, not a plan)
- `tonnetz-next-phase-plan.md` → **archived** to `docs/archive/` (unique content folded into songlab-build-plan.md: walkthrough scaling, song packs architecture, copyright considerations)
- `game-flow-pattern.md` → kept for now, archive after game-flow.js extraction
- All cross-references updated across STATUS.md, SESSION_LOG.md, build plan, game engine spec

**Next session priorities**

1. MIDI input module
2. SkratchLab lightweight DAW
3. Multi-chord glow worm paths
4. game-flow.js extraction

**Evening implementation sprint (Phase A+.1 / A+.2)**

- Extracted `static/shared/game-shell.css` — shared layout for all games (setup/stats/feedback/results/pills/song tips)
- Migrated all 8 games to game-shell.css: Chord Spotter, Melody Match, Scale Builder, Harmony Trainer, Strum Patterns, Relative Key Trainer, Rhythm Lab, Swing Trainer
- Converted `index.html` to extend base.html — unified nav with dropdowns, single source of truth
- Converted Swing Trainer from standalone HTML to Jinja2 template extending base.html
- ~500 lines of duplicate inline CSS removed
- All legacy color vars replaced with SongLab design tokens
- Swing Trainer production 500 error likely fixed (now uses url_for for assets)
- JS class-name aliases used for Scale Builder and Relative Key Trainer where JS hard-codes selectors — clean up during game-flow.js extraction

---

## 2026-04-10 — Explorer Polish, Rhythm Analysis, Audience Tracks, SkratchLab Rhythm Builder, Tutorial

**Layout & visual polish**

- Renamed Skratch Studio → SkratchLab (user-facing brand + URL paths /skratchlab)
- Added --font-size-2xs design token; replaced all hardcoded pixel font sizes with tokens across Explorer and SkratchLab
- Normalized SkratchLab nav to match Explorer (36px logo, consistent padding/sizing)
- Bumped walkthrough sidebar typography: note text to font-size-base, sidebar width 270→300px, enlarged step badges
- Standardized keyboard to real piano proportions (black/white width 0.468, height 0.633)
- Keyboard white keys now cream (#E8E2D6) with dark labels, white labels on chord highlights
- Tonnetz panel body lightened (#1E1C17), grid edges/nodes more visible
- Bumped dark theme contrast: --daw-text-dim, --daw-text-mute, --daw-text-ghost all brighter
- Removed dead Spotify/Apple Music placeholder links
- Fixed fretboard/keyboard proportions in "Both" view: Tonnetz protected with min-height 280px, fretboard constrained with max-height 220px

**Info pills in Explorer**

- "Learn" pills (gold, labeled) on Tonnetz and Chord Wheel panel headers → /intro/4, /theory/circle-of-fifths
- Compact ⓘ circles (gold) on Transform and Key controls → /intro/5, /theory/tonal-centers
- Tonnetz pill wrapped in flex container with label to prevent floating

**Game deep-linking from walkthroughs**

- CONCEPT_GAME_MAP routes concept_specifics to relevant games with pre-configured URL params
- Walkthrough steps show "Try this" game pills (Chord Walks, Chord Spotter, Scale Builder, Harmony Trainer)
- Games read URLSearchParams on load: tier, transform, root, interval, mode, progression, difficulty
- Pills deep-link with context derived from walkthrough step (root note, transform type, etc.)

**Base.html restyle**

- Replaced old purple color scheme with SongLab warm palette (gold/blue/coral) in base.html
- Restored dropdown navigation: Ear Training (4 items), Rhythm & Play (2 items), Games (2 items), Learn (6 items incl. Fundamentals + Tutorial)
- SkratchLab promoted to top-level nav link alongside Explorer
- Added Nunito 400/500 weights; fixed hardcoded purple hex in harmony.html and relative-key-trainer.html
- All 20+ game/theory/intro pages inherit new look via cascade
- Dark theme dropdown support for Explorer/SkratchLab

**Rhythm analysis — new feature**

- Added 7 rhythm-tagged song entries to song-examples.js (Folsom Prison Blues, Ring of Fire, Mama Tried, Cry Cry Cry, Jackson, Get Rhythm, Superstition)
- New rhythm concept_specifics: train_beat, shuffle, syncopation, odd_meter, backbeat
- Folsom Prison Blues walkthrough: first dual harmony+rhythm walkthrough (I-IV-V + train beat)
- New Rhythm tab in Explorer stage (4th tab alongside Tonnetz/Chord wheel/Fretboard)
- Rhythm tab renders beat pattern from walkthrough data: time sig, BPM, feel label, BOOM/chk/SNAP grid
- Rhythm playback engine: three Tone.js synths (bass, snare, strum), looped Tone.Sequence, playhead animation
- BPM slider with live Tone.Transport update (no sequence restart)
- Bass note follows chord root from HarmonyState as walkthrough advances
- Keyboard plays chords over running rhythm without restarting beat (setRoot method)
- Separate Rhythm and Chords volume sliders in controls bar
- Fixed keyboard same-key replay (plays chord on repeated clicks)
- Backfilled rhythm data on ALL walkthroughs, including 6/8 for Norwegian Wood
- Rhythm renderer handles variable-length patterns (6/8, 4/4, etc.)

**Audience tracks — new feature**

- 4 new walkthroughs: Let It Go, You've Got a Friend in Me (kids), Stand By Me, Lean on Me (students)
- All walkthroughs tagged with audience field (kids/student/musician) and category
- Walkthrough categories backfilled: Voice Leading, Transforms, Jazz Harmony, Modes & Scales, Progressions, Rhythm & Feel
- Landing page redesigned: audience tabs (Kids/Students/Musicians) at top, MIDI pad grid filters by audience
- Category badges on song pad cards (Progression, Rhythm, Transforms, Jazz, etc.)
- Added Melody Match and Strum Patterns to landing page games grid

**SkratchLab rhythm builder — new feature**

- Interactive 4×8 drum machine grid in SkratchLab channel strip (kick/snare/hihat/strum)
- Click cells to toggle beats on/off, instrument-colored cells
- Preset patterns: rock, train beat, disco, hip hop, shuffle, backbeat
- Tone.js playback with playhead animation, BPM slider
- Export to Blockly blocks (play_kick/play_snare/play_hihat at mapped bar:beat:sixteenth times)
- Transport conflict handling: rhythm builder stops when main Run plays, and vice versa
- Rhythm data exports from Explorer → SkratchLab via sessionStorage (pre-loads Rhythm Builder grid and BPM)

**Tutorial page — new**

- New /tutorial route: 10-section scrollable page using Norwegian Wood as example song
- Covers: song picker, walkthrough sidebar, Tonnetz, chord wheel, transforms, game pills (Scale Builder link), rhythm tab, keyboard/sustain, SkratchLab export, and "keep exploring" with song suggestions
- Tutorial link added to landing page below tagline
- Feature callout boxes with gold left border highlighting specific UI elements

**Playback fixes**

- Fixed first chord not playing on walkthrough start: reset _lastRoot/_lastQuality, 200ms delay on explicit playChord
- Added Shift/CapsLock sustain: hold Shift for momentary, CapsLock toggles, playChord skips releaseAll when active
- Reset to piano instrument on walkthrough start

**Decisions**

- All walkthroughs should have rhythm data, even standard 4/4 — "boring" rhythm is still a lesson
- Rhythm tab is a reliable feature, not sometimes-feature
- SkratchLab is the right place for interactive rhythm building; Explorer is for analysis
- Option B (text notation: BOOM-chk-SNAP-chk) for Explorer rhythm display
- Info pills: "Learn" variant on panel headers, compact ⓘ on controls bar
- Real piano key proportions as default in keyboard-view.js; pages scale via CSS overrides
- SkratchLab promoted to top-level nav — earned its own spot
- Railway cold start: warn testers about 15s first load, don't optimize yet

**Next session priorities**

1. Multi-chord glow worm paths on Tonnetz (voice leading — top priority feature)
2. More rhythm walkthroughs: Take Five (5/4), Superstition (syncopation)
3. SkratchLab rhythm building improvements (more presets, strum export)
4. User testing prep (15-20 participants)
5. Swing Trainer production 500 error fix
6. Landing page polish: verify all links, test all walkthroughs end-to-end

---

## 2026-04-09 — Skratch Studio Integration + SongLab/Explorer Redesign

**Skratch Studio integration (merged `feature/skratch-integration` → `dev`)**

- Reviewed and fixed code from `feature/skratch-integration` branch (built by Antigravity agent)
- Deduplicated PLR transform math — Skratch was carrying its own copy; now imports from shared `transforms.js`
- Removed dead `drawCanvasGrid` code
- Fixed MIDI export: BPM header now written, drum tracks correctly skipped with warning instead of crashing
- Refactored Explorer→Skratch bridge from real-time click streaming to a record-and-export pattern: Explorer captures the progression, exports via `sessionStorage`, then `window.open` launches Skratch Studio with the session preloaded (no need to pre-open Skratch)
- Walkthroughs auto-capture progression as they play; free exploration has a record/stop toggle
- Swapped PolySynth → Salamander piano sampler for chord playback (consistency with Explorer)
- Renamed routes: `/skratch` → `/skratch-studio`, `/games/relative-key-trainer` → `/games/chord-walks`
- Sound now defaults to ON across all pages
- Added Skratch Studio card to landing page
- Squash-merged to `dev`

**SongLab redesign (on `dev`)**

- Platform rebrand kickoff: "Music Theory Games" → **SongLab**
- Created `static/css/design-tokens.css` — light/dark theme system, color tokens, fluid typography (single source of truth for the redesign)
- Landing page redesign: MIDI pad song grid layout, warm light theme, SongLab branding
- **Explorer full redesign**:
  - DAW-style dark theme with transport controls and song info bar
  - Walkthrough sidebar replaces the floating overlay bubble
  - Tonnetz animations: pulsing nodes, glow worm paths, ghost trails
  - Chord quality color families: blue=major, green=minor, coral=borrowed
  - Panel tabs (Tonnetz / Chord Wheel / Fretboard) wired and working
  - "Begin" button for audio context activation
  - Harmonic function labels on walkthrough steps
  - Fixed chord wheel visibility behind other panels

**Planning docs added** (`docs/`)

- `design-system-reference.md` — full implementation plan with CSS tokens
- `tonnetz-next-phase-plan.md` — walkthroughs, song packs, copyright, aesthetics (archived April 12 — content folded into `songlab-build-plan.md`)
- `visual-engine-spec.md` — generative art engine driven by Tonnetz geometry (post-launch)

**Decisions**

- Skratch bridge is record-and-export (not live streaming) — simpler, more reliable, and lets users re-export edited progressions
- Explorer is the canonical surface for the new dark DAW aesthetic; light theme stays for landing page and pedagogy surfaces
- SongLab is the platform name going forward — rebrand sweep is its own phase

**Still TODO**

- Explorer prompt 2 fixes: test all walkthroughs end-to-end, verify ghost trails
- Skratch Studio DAW redesign (Phase 4)
- Games + remaining pages: light theme + design tokens (Phase 5)
- SongLab branding sweep across all pages (Phase 6)
- Deploy to Railway as SongLab
- User testing with 15–20 participants
- Visual engine implementation (post-launch)

## 2026-04-07 — Landing Page Redesign, Nav Restructure & Guided Walkthrough System

- Full product rethink session: assessed every feature on the site against target audience (musicians brushing up on skills + teachers as distribution channel)
- North star established: "Help people become better musicians" — not a theory textbook
- Decided: remove the word "theory" from all user-facing UI
- Decided: Explorer is the centerpiece — the Tonnetz externalizes the spatial map that experienced musicians navigate by instinct
- Decided: everything stays, but organized into four categories: Visualize, Ear Training, Rhythm & Creation, Patterns
- Created redesign spec (`docs/redesign-spec.md`) covering landing page, nav, song integration, and guided walkthroughs
- Built new landing page: hero ("Harmony has a shape. Explore it."), rotating song example prompts (8 curated from song-examples.js), Explorer preview, 2×2 category grid, Fundamentals footer link
- Nav restructured: Explorer, Ear Training, Rhythm & Play, Patterns, Fundamentals — replaces Theory/Practice Games/Skratch Studio/Start Here/Tour
- Built Explorer deep-linking: URL params (?root=, ?quality=, ?progression=, ?walkthrough=) so landing page examples load the Explorer in the right state
- Built guided walkthrough system (`static/shared/walkthroughs.js`): floating card overlay in Explorer with step-by-step concept walkthroughs grounded in real songs
  - 8 walkthroughs: Yesterday voice leading, Am/C relationship (Eleanor Rigby), Creep chromatic mediant, ii-V-I jazz, Mixolydian (Norwegian Wood/Get Lucky), Stairway P transform, deceptive cadence (In My Life), twelve-bar blues
  - Each step sets chord state, plays audio, shows conversational explanation
  - Panel focus: individual steps can dim non-relevant panels to direct attention (e.g., focus keyboard for voice leading, focus Tonnetz for transforms)
  - "You'll also hear this in..." line pulls related songs from song-examples.js by matching concept_specifics
  - "seeAlso" links on final steps nudge users toward relevant games (Chord Walks, Strum Patterns, etc.)
  - Next/Back/Exit navigation, step indicator, smooth transitions
- Fixed: Explorer no longer flashes C major before loading walkthrough's first chord
- Wife's idea: walkthroughs should actually show the concept, not just link to the tool. She was right.
- All work on `redesign/landing-page` branch
- Decided: tagline "Harmony has a shape. Explore it." — respects the musician, invites curiosity
- Decided: subtitle frames Tonnetz as "the map of the territory musicians already navigate by instinct"
- Decided: category labels avoid "theory" — Visualize, Ear Training, Rhythm & Play, Patterns
- Decided: intro course repositioned as "Fundamentals" — opt-in, not a gate
- Decided: rotating song prompts use curated questions a musician actually has, grounded in real songs
- Decided: walkthroughs are the Phase 2 evolution — turn "cool visualization" into "I learned something in 30 seconds"
- Known issue: Swing Trainer returning 500 on production — needs fix before deploy
- Next: polish walkthrough card UI, surface song examples contextually in games (Chord Walks, Chord Spotter, Scale Builder), fix Swing Trainer 500, update STATUS.md/SESSION_LOG.md in repo, merge to dev when ready

## 2026-04-06 — Landing Page Redesign & Nav Restructure

- Redesign planning conversation: rethought landing page and information architecture from scratch
- Created redesign spec (`docs/redesign-spec.md`) covering new landing page concept and nav restructure
- Built new landing page: Explorer-centered hero with rotating song examples pulled from song-examples.js — visitors immediately see the tool in action
- Nav restructure: replaced previous groupings with Explorer, Ear Training, Rhythm & Play, Patterns, Fundamentals — organizes content by learning domain rather than feature type
- All work on `redesign/landing-page` branch (3 commits: spec, landing page rebuild, nav restructure)
- Decided: landing page should lead with the Explorer as the product's strongest hook
- Decided: song examples rotate on the landing page to show real musical context
- Decided: nav categories reflect how musicians think about practice, not how the app is built
- Next: wire song example hooks into Explorer (click example → loads in Explorer), wire into Chord Walks, continue showcase page build

## 2026-04-01 evening — Showcase Page

- Designed and planned `/showcase` feature tour page — standalone scrolling page to make the product's features immediately obvious to visitors (especially teachers)
- Explored Google Stitch (Google Labs AI design tool, March 2026 update) as a design workflow tool
- Used Stitch in Thinking mode (Gemini 3.1 Pro) to generate a full-page design comp from a detailed prompt + 6 app screenshots
- Stitch output: section layouts, annotation styles for Explorer panels, game cards grid, glassmorphism labels, scroll pacing — exported as HTML/CSS + DESIGN.md + screen.png
- Decided: showcase uses real screenshots with annotation overlays, not AI-generated mockups or stylized illustrations
- Decided: page lives at `/showcase` within the app (not a separate site)
- Decided: Stitch export used as visual reference/design spec — Claude Code builds the actual Jinja2 template to fit Flask/Jinja2 stack
- Stitch design system ("Harmonic Resonance"): deep indigo background (#111125), lavender/purple interactive elements, amber/orange highlights, glassmorphism panels, Plus Jakarta Sans/Manrope/Inter typography, "no-line" sectioning philosophy, glow borders
- Page structure finalized: Hero → Explorer (annotated 4-panel screenshot + C major→A minor before/after) → Games "Mastery through Play" (Intro→Practice→Test pill + 4 game cards) → Skratch Studio (split layout with real screenshot) → Real Songs You Know (3 progression cards from song-examples.js) → Footer CTA
- Created Claude Code build prompt (`claude-code-prompt-showcase.md`) with full technical spec
- Decided: no explicit "for teachers" pitch section — if the showcase is done right, teachers will naturally want to use it
- Decided: "Real Songs" section pulls from the 67-entry song-examples.js database
- Decided: annotations hide on mobile, game cards responsive (4→2→1 col)
- Stitch export saved to `stitch-export/` in repo (code.html, DESIGN.md, screen.png)
- Next: full component walkthrough tomorrow, capture remaining screenshots (Explorer with A minor selected), run Claude Code build prompt, iterate on result

## 2026-04-01 late night

- Built Swing Trainer game (`static/games/swing-trainer.html`) — Tonnetz's first dedicated rhythm ear-training game
- Core engine: Tone.js swing sequencer, Ab major ostinato, swing ratio stored in ref variable (real-time knob → audio with no transport restart)
- Waveform visualization: Gaussian pulse train showing swing ratio geometrically — upbeat pulse migrates right as ratio increases
- Knob control: SVG rotary dial, 270° travel, vertical drag, three unlabeled detent markers at 50%/67%/75%
- Four-phase game loop: Listen (target groove plays 4 measures) → Match (straight 4/4 starts, knob live) → Lock In → Reveal (waveform overlay + score)
- Practice mode: ghost groove continues under match phase, waveform visible, generous scoring
- Test mode: groove stops after listen, no waveform during match, tight scoring
- Progressive scoring: Locked in / Close / In the pocket / Keep listening — thresholds differ by mode
- Session streak counter (consecutive "Locked in" results), resets on anything below Close
- Added to Tonnetz: Flask route, nav entry, card #8 in Practice Games grid with RHYTHM tag
- Updated song-examples.js to v1.1: added RHYTHM — SWING FEEL section with 6 new entries (bossa_nova_straight, lite_swing_scarborough, medium_swing_st_louis, triplet_swing_guaraldi, hard_bop_minnie, shuffle_blues_rising_sun), added swing_ratio field to demo schema
- Decided: Practice/Test mode toggle locked per session, not per round
- Decided: straight 4/4 starts immediately at 50% in match phase (Practice) or random position (Test)
- Decided: BPM fixed at 80 for now, BPM control to be added next session
- Decided: games page section restructure (Harmony/Rhythm/Explorer) deferred — Swing Trainer added as flat card with RHYTHM tag for now
- Decided: Swing Trainer is standalone for now, not wired to HarmonyState
- Known issues: dial slightly finicky past midpoint (deferred), swing_ratio field in song-examples not yet consumed by game
- Reminders set: (1) add BPM control to swing trainer, (2) consume swing_ratio in game from song-examples, (3) security review + backend proxy check before production push

## 2026-03-31 morning

- Chapter 4 rebuild on Explorer components: Claude Code (Opus) built initial version, but Tonnetz container ID mismatch + Tone.js not loaded caused errors. Opus session hit 0% context — killed and restarted with focused fix prompt on Sonnet.
- Designed and queued full MVP polish sprint (4 prompts total):
  - Post-onboarding routing: preset → destination mapping (beginner→/intro, dabbler→/intro/2, producer→/intro/3, curious_player→/intro/4, deep_diver→/explorer, math_explorer→/explorer)
  - End-of-chapter "What's Next" cards: contextual game/theory links for all 5 chapters, shared component
  - First-visit dismissible banners for Explorer and Skratch Studio (tracked in localStorage profile)
  - Nav cleanup: Games dropdown (all 6 games), Skratch Studio link, active state highlighting
  - Returning user index state: "Continue Chapter N" / "Course complete" replaces "Start Here" card
- All 4 prompts executed (Sonnet). Banners confirmed working. Other items need verification next session.
- Decided: Supabase deferred to post-MVP. localStorage sufficient for initial user testing round.
- Decided: Mobile/responsive deferred to post-MVP.
- Decided: Use Sonnet for Claude Code builds, Opus for planning/design/review.
- Phase A confirmed fully complete (A1–A5 all done as of yesterday, STATUS.md was stale).
- Updated STATUS.md and SESSION_LOG.md.
- Next: verify all polish changes, fretboard polish, end-to-end new-user walkthrough, deploy.

## 2026-03-30 afternoon

- Full docs update: applied 15-issue cross-reference audit from Friday to all md files
- Created voicing-explorer-spec.md v0.3 (was missing from repo)
- Archived old doc versions in docs/archive/
- Removed stale AGENT_GUIDE.md
- Fixed glow worm blur bleeding over Tonnetz node labels (SVG render order + blur reduction)
- Started A4 Session 1: multi-path glow worm progression engine (running in Claude Code)
- Decided: A4 lives at /theory/chord-progressions as lesson page embedding Explorer panels
- Decided: animated playthrough with fading trails (not all-at-once)
- Decided: Song Examples DB integration with dual tabs — "By Pattern" + "By Song"
- Decided: common-tone flash during chord transitions (white/gold pulse, ~500ms)
- Workflow: Sonnet as default Claude Code model, Opus for multi-file architectural prompts
- Tested progression engine, Session 2 (page UI), A3 modes, fretboard panel
- Theory pages are wired into dropdown nav

## 2026-03-29 (Saturday)

- Voicing Explorer MVP build session — shipped Note Mode, glow worm path, ChordResolver, 3-panel sync
- 474 insertions across 5 modified files + 2 new modules (chord-bubble-renderer.js, chord-resolver.js)
- Decided: glow worm over convex hull (encodes voicing order)
- Decided: chord wheel arc re-centers on assembled chord's key as tonic
- Decided: ChordResolver enhanced HarmonyState rather than separate detection
- Ideas captured: multiple simultaneous glow worm paths, chord shapes as Skratch Studio blocks

## 2026-03-27 (Friday evening)

- Full spec cross-reference audit: 15 issues identified across all docs
- Created voicing-explorer-spec.md v0.3 (MVP scope, composable panels, resolved open questions)
- Updated all docs with fixes (orientation, 4→3 panels, phase numbering, Song DB status)
- Decided: "tools teachers find useful" positioning (not teacher dashboard)
- Decided: alternative voicings = killer use case for working musicians
- Decided: fretboard panel as pre-MVP composable panel
- Decided: game-flow.js extraction at Phase B start
- Note: doc updates weren't committed until 2026-03-30 — need to close this loop faster

## 2026-03-27 (Thursday)

- Phase A1 complete: Circle of Fifths page at /theory/circle-of-fifths
- Phase A2 complete: Tonal Centers lesson at /theory/tonal-centers (4-step walkthrough + ear training)
- Debugged: playBtn.disabled state not resetting, audioReady toggle issue
- Backend API proxy confirmed complete and secure
- Decided: defer auth/persistence to Phase B.5 as planned

## 2026-03-23

- Visual layer system built (visual-config.js, visual-layer.js, visual-toggle.js)
- Replaced sprint tracker with MVP tracker
- Updated STATUS.md as source of truth
