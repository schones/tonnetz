# Session Log

Reverse chronological. Quick capture after each session: what happened, what was decided, what's next.

---

## 2026-04-10 — Explorer Polish, Rhythm Analysis, Audience Tracks

**Layout & visual polish**

- Platform rename: SongLab → **SkratchLab** (interactive rhythm-building surface), with Explorer remaining the analysis surface
- Font token normalization: introduced `--font-size-2xs` and pushed it through nav/labels for consistent type scale
- Nav consistency pass across all surfaces (alignment, spacing, active state)
- Walkthrough sidebar typography bump: wider sidebar, larger body text for readability
- Real piano keyboard proportions: cream-colored white keys, accurate black-key width and offsets — now the default
- Tonnetz canvas lightened for better contrast against dark theme
- Dark theme overall contrast bump
- Removed Spotify/Apple Music links from song cards
- Fixed fretboard/keyboard proportions in the "Both" view (no more squashing)

**Info pills**

- "Learn" pills on Tonnetz and Chord Wheel headers, linking out to the relevant fundamentals content
- Compact ⓘ pills on Transform and Key controls
- All pill destinations route to fundamentals topic pages

**Game deep-linking**

- Added `CONCEPT_GAME_MAP` for concept → game routing
- "Try this" pills on walkthrough steps that launch the relevant game pre-configured
- Games now read `URLSearchParams` for pre-configured state (root, quality, mode, etc.)

**Base.html restyle**

- Purple palette → warm palette across base template
- New SkratchLab nav inherited by all 20+ child pages automatically
- Consistent look and feel across the platform without per-page edits

**Rhythm analysis (new)**

- 7 new rhythm-focused song entries
- New `concept_specifics` for rhythm: `train_beat`, `shuffle`, `syncopation`, `odd_meter`, `backbeat`
- Folsom Prison Blues dual walkthrough (harmony + rhythm)
- **Rhythm tab in Explorer** as 4th stage tab alongside Tonnetz / Chord Wheel / Fretboard
- Tone.js playback engine with playhead animation over the rhythm grid
- BPM slider on the Rhythm tab
- Bass voice follows the chord root through the progression
- Volume controls per voice
- Keyboard remains playable over the running rhythm (improvise on top)

**Audience tracks (new)**

- 4 new walkthroughs:
  - **Kids:** Let It Go, You've Got a Friend in Me
  - **Students:** Stand By Me, Lean on Me
- New `audience` field on every walkthrough
- Landing page redesign: audience tabs (kids / students / general) with filtered MIDI pad grid

**Decisions**

- All walkthroughs should eventually have rhythm data
- **SkratchLab** is for interactive rhythm building; **Explorer** is for rhythm analysis — clean split between create vs. study
- Rhythm display uses **Option B text notation** (chosen over alternative grid notations)
- Real piano proportions are the keyboard default going forward

**Next priorities**

1. Backfill rhythm data for all remaining walkthroughs
2. Multi-chord glow worm paths on Tonnetz
3. SkratchLab rhythm blocks (Blockly extension)
4. User testing prep

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

- `songlab-redesign-plan.md` — full implementation plan with CSS tokens
- `tonnetz-next-phase-plan.md` — walkthroughs, song packs, copyright, aesthetics
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
