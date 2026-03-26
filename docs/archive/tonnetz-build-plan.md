# Tonnetz Content Architecture — Build Plan

**Based on:** Content Architecture & Data Schema v0.2 (2026-03-13)
**Revised:** 2026-03-17 — Added Phase 3 (Auth & Persistence), Phase 5 (Intro Module), Phase 9 (Competency Graph), and Phase 10 (Puzzle Paths). Renumbered subsequent phases.
**Branch:** `education-layer` (merges to `main` for Railway deploy)
**Workflow:** Plan in claude.ai → Build with Claude Code (Antigravity) → Gemini for review → Dustin manages git
**Repo:** `schones/tonnetz`

---

## How to Read This Plan

Each **Phase** is a coherent chunk of work that ships something independently useful.
Each **Task** within a phase is scoped to one Claude Code session.
Tasks include a ready-to-paste Claude Code prompt (in fenced blocks).
Every prompt follows Dustin's conventions: starts with read-and-verify, ends with "Do not commit."

**Estimated total:** 10 phases, ~45-55 Claude Code sessions.

---

## Phase 1: Schema Migration (Foundation) ✓ COMPLETE
**Goal:** Migrate `theory-content.js` from the flat tier system to the v0.2 content type taxonomy. No UI changes yet — this is pure data work.
**Why first:** Every subsequent phase depends on this metadata being in place.
**Ships:** Nothing user-visible. Internal data upgrade.

### Task 1.1 — Add content_type and quick_summary to all topics ✓

```
Read the file structure starting from the project root, then read
static/shared/theory-content.js to understand the current topic schema.

For each of the 33 topics currently in the file (excluding jazz_harmony
if present — remove it), add two new fields:

1. content_type — one of: "building_block", "skill_guide", "framework", "reference"

   Classifications:
   building_block: sound_basics, note_names, the_staff, rhythm, tempo,
     dynamics, major_scale, minor_scale, triads, intervals,
     semitones_whole_tones, octave, ledger_lines, seventh_chords,
     chromatic_scale, harmonic_minor, modes
   framework: circle_of_fifths, diatonic_chords, chord_function,
     relative_minor_major, cadences, modal_interchange, modulation,
     voice_leading, tonnetz_geometry, tonnetz_transforms, neo_riemannian,
     hexatonic_cycles, borrowed_chords, secondary_dominants
   reference: key_signatures, time_signatures

2. quick_summary — a 1-2 sentence, lens-neutral summary suitable for
   tooltips. Write these yourself based on the topic content already
   in the file. Keep them genuinely short (under 30 words each).

Also remove the tier field (beginner/intermediate/advanced) from each
topic if present.

Verify your changes by logging the count of topics per content_type
to confirm: 17 building_block, 14 framework, 2 reference, 0 skill_guide.

Do not commit — I will handle git myself.
```

### Task 1.2 — Add computed difficulty and related_games ✓

```
Read static/shared/theory-content.js to see the current state after
the content_type migration.

Add two new fields to each topic:

1. difficulty — an integer 1-5, computed from the prerequisite chain.
   For each topic, walk its prerequisites recursively and find the
   longest chain. difficulty = longest_chain_length + 1.
   Topics with no prerequisites = 1.
   Write a helper comment at the top of the file documenting the
   computation method so it can be recomputed if prereqs change.

2. related_games — an array of objects: { game_id, relevance }
   where relevance is "primary" or "supporting".

   Mappings:
   - harmony_trainer: primary for [intervals, semitones_whole_tones],
     supporting for [major_scale, minor_scale, octave, relative_pitch]
   - melody_match: primary for [intervals, rhythm],
     supporting for [major_scale, minor_scale, note_names]
   - chord_spotter: primary for [triads, seventh_chords],
     supporting for [intervals, major_scale, minor_scale, chord_function]
   - rhythm_lab: primary for [rhythm, tempo, time_signatures],
     supporting for [dynamics]
   - strum_patterns: primary for [rhythm],
     supporting for [tempo, dynamics]
   - relative_pitch: primary for [intervals],
     supporting for [semitones_whole_tones, major_scale, octave]
   - skratch_studio: supporting for [rhythm, note_names, intervals,
     triads, major_scale, minor_scale]

   Topics not listed get an empty array: related_games: []

Verify by logging: count of topics at each difficulty level,
and count of topics with 0, 1, 2, 3+ game links.

Do not commit — I will handle git myself.
```

### Task 1.3 — Add related_visualizations and creative_prompts ✓

```
Read static/shared/theory-content.js to see the current state.

Add two new fields to each topic:

1. related_visualizations — array of visualization IDs.
   Use these IDs (visualizations don't exist yet, but we're
   wiring the metadata now):
   - "circle_of_fifths_explorer": link from [circle_of_fifths,
     key_signatures, relative_minor_major, diatonic_chords, modulation]
   - "tonnetz_grid": link from [tonnetz_geometry, tonnetz_transforms,
     neo_riemannian, hexatonic_cycles, triads, intervals]
   - "scale_explorer": link from [major_scale, minor_scale, modes,
     harmonic_minor, chromatic_scale, intervals, semitones_whole_tones]
   - "chord_voicing_visualizer": link from [triads, seventh_chords,
     chord_function, voice_leading, borrowed_chords]
   Topics not listed get an empty array.

2. creative_prompts — array of strings, only for topics relevant
   to Skratch Studio. These are kid-friendly, directive prompts
   for the creative sandbox. Write 2-3 per topic.

   Add creative_prompts to: sound_basics, note_names, rhythm, tempo,
   dynamics, major_scale, minor_scale, triads, intervals, octave.

   Example for intervals:
   ["Try playing two notes at the same time. Does it sound nice or crunchy?",
    "Can you make a melody that only uses big jumps?",
    "Play a note, then play the note right next to it. Now skip 5 notes. Hear the difference?"]

   Topics not listed get: creative_prompts: []

Do not commit — I will handle git myself.
```

### Phase 1 Checkpoint ✓
`theory-content.js` has the full v0.2 topic schema:
id, title, subtitle, content_type, tags, difficulty, prerequisites,
soft_prerequisites, connections, depths (musician/theorist/math),
quick_summary, related_games, related_visualizations, creative_prompts.

Still missing from full schema: playful lens, estimated_read_time_minutes,
mnemonic (these come later in Phase 4).

---

## Phase 2: User Profile & Onboarding (Cold Start Fix)
**Goal:** Build the localStorage profile system and onboarding flow so new users get a guided entry point.
**Why second:** This unlocks everything downstream — paths, progress tracking, fog of war, and personalized tips all depend on having a profile.
**Ships:** Onboarding selector on first visit, profile persisted in localStorage.

### Task 2.1 — localStorage profile manager

```
Read the project structure and understand the current state of
static/shared/ to see what modules exist. Also read
static/shared/theory-content.js and static/shared/theory-engine.js
to understand the existing patterns.

Create a new file: static/shared/user-profile.js

This module manages user profile state in localStorage.
It should export (or expose on window) these functions:

- getProfile() — returns the profile object, or null if none exists
- initProfile(preset) — creates a new profile with the given preset
  and saves to localStorage. Presets and their defaults:
    beginner:       { active_lens: "playful", additional_lenses: [] }
    dabbler:        { active_lens: "playful", additional_lenses: ["musician"] }
    curious_player: { active_lens: "musician", additional_lenses: [] }
    producer:       { active_lens: "musician", additional_lenses: [] }
    deep_diver:     { active_lens: "theorist", additional_lenses: ["musician"] }
    math_explorer:  { active_lens: "math", additional_lenses: ["theorist"] }
  Generate a UUID for user_id. Initialize empty objects for
  topics, games, paths, skratch. Initialize default preferences:
  { show_tooltips: true, tooltip_frequency: "sometimes",
    session_length_preference: "medium" }

- updateTopicStatus(topicId, status, seenVia?) — set topic status
  (unseen/visited/learning/learned). If first time seeing topic,
  record seen_via and first_seen timestamp. Always update last_seen.

- updateGameProgress(gameId, { current_level?, high_score? }) —
  update game progress. Only update high_score if new score > existing.
  Always update last_played timestamp.

- updatePathProgress(pathId, completedStep) — add step to
  completed_steps array, update current_step.

- getActiveLens() — returns the user's active lens string
- setActiveLens(lens) — updates active lens

- resetProfile() — clears localStorage profile entirely

- exportProfile() — returns profile as JSON string (for future migration)
- importProfile(jsonString) — overwrites profile from JSON string

All functions should save to localStorage under key "tonnetz_profile".
Use JSON.stringify/parse. Include basic error handling for corrupt data
(if parse fails, return null and log a warning).

Write a brief test at the bottom of the file (behind a
if (window.TONNETZ_TEST) guard) that exercises each function
and logs results.

Do not commit — I will handle git myself.
```

### Task 2.2 — Onboarding UI

```
Read the project structure, then read templates/base.html and
templates/index.html to understand the current Jinja2 template
structure and styling approach (CSS custom properties, light/dark
theme toggle).

Read static/shared/user-profile.js to understand the profile API.

Create an onboarding modal/overlay that appears on first visit
(when getProfile() returns null). Requirements:

1. Full-screen overlay with the Tonnetz branding style.

2. Welcome message: "Welcome to Tonnetz — learn music theory
   through play."

3. Six preset cards, each showing:
   - The user-facing label (e.g., "I'm brand new to music")
   - A brief 1-line description of what they'll start with
   - A relevant icon or emoji

   Presets (in display order):
   - beginner: "I'm brand new to music" / "Start from the very beginning with sound, rhythm, and notes."
   - dabbler: "I play an instrument a little" / "You know some basics — let's fill in the gaps."
   - producer: "I make beats but don't know theory" / "You have great ears — let's add vocabulary."
   - curious_player: "I play and want to understand theory" / "Connect what you play to why it works."
   - deep_diver: "I know theory, show me the deep stuff" / "Advanced harmony, transforms, and analysis."
   - math_explorer: "I'm here for the math" / "Frequency ratios, group theory, and geometric music theory."

4. Clicking a card calls initProfile(preset) and dismisses the
   overlay with a smooth transition.

5. Style it to match the existing Tonnetz aesthetic — use the
   existing CSS custom properties for colors. Respect light/dark
   theme. Cards should have the subtle hover effects consistent
   with the dashboard style.

6. Add a small "Change later in Settings" note at the bottom.

7. Add a "Skip for now" link that creates a default profile
   with preset "beginner" so users aren't blocked.

Integrate the overlay into the page load flow: if no profile
exists, show the overlay before the main content is interactive.

Do not commit — I will handle git myself.
```

### Task 2.3 — Wire profile into existing Tips pill

```
Read static/shared/theory-engine.js and static/shared/user-profile.js.

Update the theory engine / tips pill to be profile-aware:

1. When showing a tooltip for a topic, use getActiveLens() to
   determine which depth to display by default. Fall back through:
   active_lens → first available additional_lens → "musician".

2. When a tooltip is shown, call updateTopicStatus(topicId, "visited",
   "tooltip") if the topic was previously "unseen".

3. If a topic's status is "learned", the tips pill should deprioritize
   it (show it less frequently or mark it differently — e.g., a
   subtle checkmark icon).

4. Use the quick_summary field (added in Phase 1) as the default
   tooltip text, with a "Read more" expansion to the full depth body.

Keep backward compatibility: if no profile exists (getProfile()
returns null), fall back to current behavior (show musician depth,
no status tracking).

Test locally with python3 app.py — verify tooltips adapt when you
switch profiles between beginner (playful lens) and curious_player
(musician lens).

Do not commit — I will handle git myself.
```

### Phase 2 Checkpoint
New users see an onboarding selector. Profile is saved in localStorage.
Tips pill adapts to the user's chosen lens. Topic visits are tracked.
**Test:** Clear localStorage, reload → onboarding appears. Select a
preset → profile created. Play a game → tooltips use correct lens.

---

## Phase 3: Auth & Persistence (NEW)
**Goal:** Replace localStorage-only profile storage with authenticated accounts and server-side persistence. Add backend proxy for API key security.
**Why third:** The adaptive content model (intro module, game Learn phases, fog of war) only works well if the platform remembers users across devices and browser resets. This is also a prerequisite for production deployment — the API key security work was already flagged as a must-do.
**Ships:** Login/signup flow, persistent user profiles, secure API proxy.
**Independent of:** Phases 4 and 5 (can be built in any order).

### Task 3.1 — Design auth & persistence architecture (claude.ai)

Design task, not a code task. Decide on:
- Auth provider: Supabase Auth (magic links + Google OAuth) is the leading candidate. Low friction, good Flask integration, free tier generous.
- Database: Supabase Postgres. The user profile JSON schema from Phase 2 maps directly to a `profiles` table.
- Migration strategy: `user-profile.js` keeps the same API surface (`getProfile()`, `updateTopicStatus()`, etc.) but calls the backend instead of localStorage. localStorage becomes a write-through cache for offline resilience.
- Session management: Flask session with JWT from Supabase, or cookie-based.
- Anonymous → authenticated migration: users who played without logging in can claim their localStorage profile when they create an account.

Deliverable: A short architecture doc (`docs/auth-architecture.md`) covering the above decisions, database schema, API endpoints, and migration path.

### Task 3.2 — Supabase setup and Flask integration

```
Read docs/auth-architecture.md for the design decisions.
Read app.py to understand the current Flask route structure.
Read static/shared/user-profile.js to understand the profile API.

Set up Supabase integration:

1. Add supabase-py to requirements.txt.

2. Create a profiles table in Supabase (provide the SQL migration):
   - id (UUID, primary key, matches Supabase auth.users.id)
   - profile_data (JSONB — stores the full profile object)
   - created_at, updated_at (timestamps)

3. Add Flask routes for auth:
   - POST /auth/signup — email magic link or OAuth redirect
   - POST /auth/login — magic link or OAuth
   - POST /auth/logout — clear session
   - GET /auth/callback — OAuth callback handler

4. Add Flask routes for profile CRUD:
   - GET /api/profile — returns profile JSON (requires auth)
   - PUT /api/profile — updates profile JSON (requires auth)
   - POST /api/profile/claim — migrates a localStorage profile
     to the authenticated user's account

5. Add auth middleware that checks for valid session on
   protected routes.

6. Store Supabase credentials in environment variables
   (SUPABASE_URL, SUPABASE_KEY). Add to Railway env config.

Do not commit — I will handle git myself.
```

### Task 3.3 — Migrate user-profile.js to hybrid storage

```
Read static/shared/user-profile.js (the localStorage implementation).
Read the new Flask auth/profile routes from Task 3.2.

Update user-profile.js to use a hybrid storage strategy:

1. If user is authenticated (check for session cookie or token):
   - All reads: fetch from /api/profile, cache in localStorage
   - All writes: write to localStorage immediately (optimistic),
     then POST to /api/profile in background
   - On conflict: server wins (server data is newer)

2. If user is not authenticated:
   - Behave exactly as before (localStorage only)
   - Show a subtle prompt after 3+ sessions: "Create an account
     to save your progress across devices"

3. The API surface (getProfile, updateTopicStatus, etc.) stays
   identical. Callers don't need to know about the storage backend.

4. Add a claimLocalProfile() function that POSTs the current
   localStorage profile to /api/profile/claim when a user
   signs up for the first time.

Test: Create a localStorage profile → sign up → verify profile
migrates to Supabase → clear localStorage → reload → profile
loads from server.

Do not commit — I will handle git myself.
```

### Task 3.4 — Backend API proxy and security review

```
Read app.py and all templates/static files that make external
API calls (e.g., Tone.js sample loading, any fetch calls).

1. Identify any API keys or secrets currently exposed in
   client-side code. Create Flask proxy routes so the client
   calls your backend, and the backend calls the external API
   with the key server-side.

2. Add rate limiting to the proxy routes (Flask-Limiter or
   similar).

3. Security review checklist:
   - No API keys in client JS or HTML
   - No hardcoded secrets in source (use env vars)
   - CORS configured correctly for Railway domain
   - Auth routes protected against CSRF
   - Profile API validates input (reject oversized payloads,
     validate JSON structure)
   - Supabase RLS policies on the profiles table (users can
     only read/write their own profile)

4. Document any findings or remaining concerns in
   docs/SECURITY-REVIEW.md.

Do not commit — I will handle git myself.
```

### Phase 3 Checkpoint
Users can create accounts (magic link or Google OAuth). Profiles persist
server-side and sync across devices. Anonymous play still works with
localStorage, with a migration path to authenticated accounts. No API
keys exposed in client code.
**Test:** Anonymous user plays → creates account → profile migrates.
Log out → log in on different browser → profile loads. Verify no
secrets in client source.

---

## Phase 4: Playful Lens & Content Expansion
**Goal:** Add the kid-friendly "playful" lens to beginner topics so the `beginner` and `dabbler` presets actually have age-appropriate content.
**Why here:** The onboarding flow promises a playful experience for beginners, so the content needs to exist.
**Ships:** Playful depth content for ~10-12 core building_block topics.
**Independent of:** Phase 3 (Auth) and Phase 5 (Intro Module). Can be built in any order.

### Task 4.1 — Write playful lens content (LLM-assisted)

This is a content authoring task, not a code task. Use claude.ai (this conversation or a new one) to draft playful lens content for these topics:

```
Topics to write playful lens for:
sound_basics, note_names, rhythm, tempo, dynamics, major_scale,
minor_scale, intervals, triads, octave, semitones_whole_tones,
the_staff

For each topic, write:
- summary (1-2 sentences, age 6-10 appropriate, uses metaphors
  and sensory language, avoids jargon)
- body (3-6 short paragraphs, conversational, uses "you" voice,
  references sounds and physical experience over abstract concepts,
  includes "Try this!" interactive prompts where relevant)

Voice guide for playful lens:
- Talk like a friendly music teacher with a 9-year-old
- Use analogies to things kids know (playground, animals, weather)
- "An octave is like when you and your dad sing the same song
  together — same note, but his voice is lower"
- Never use terms like "frequency", "interval quality",
  "scale degree" without immediately explaining them in plain words
- Keep paragraphs to 2-3 sentences max
- Include at least one "Try this!" moment per topic
```

Review and edit the drafts yourself before proceeding to 4.2.

### Task 4.2 — Add playful lens to theory-content.js

```
Read static/shared/theory-content.js to see the current depths structure.

I will provide you with playful lens content for the following topics
as a JSON object. For each topic, add a "playful" key to the depths
object with { available: true, summary: "...", body: "..." }.

[Paste the reviewed content from Task 4.1 here]

For topics NOT in this list, add: playful: { available: false }
to their depths object (if not already present) so the schema is
consistent.

Verify: count topics where playful.available === true. Should be 12.

Do not commit — I will handle git myself.
```

---

## Phase 5: Intro Module — "Meet the Tonnetz" (NEW)
**Goal:** Build an animated, interactive walkthrough that introduces the Tonnetz grid, basic music concepts (as needed), and the P/R/L transforms. Serves as the shared foundation that all transform-based games can reference.
**Why here:** The Relative Key Trainer's Learn phase and the "Tonnetz & Transforms" learning path both need this. Building it before paths and game content avoids duplicating Tonnetz intro material in every game.
**Ships:** `/intro/tonnetz` route with a chaptered, animated walkthrough. Adaptive entry points based on user profile.
**Independent of:** Phase 3 (Auth) and Phase 4 (Playful Lens). Can be built in any order.

### Design: Chapter Structure with On/Off Ramps

The intro module is divided into chapters. Users can enter at any chapter and exit after any chapter. A chapter menu at the top shows all chapters with completion status. A quick self-assessment or profile-based routing suggests where to start.

**Chapter 1: Sound & Notes** (skippable for anyone who plays an instrument)
- Step 1.1: Sound is vibration. Animate a waveform. Tone.js plays a pure tone. User drags a slider to change pitch — hear it go up and down.
- Step 1.2: We named the notes. 12 notes appear around a circle (chromatic clock). Each lights up and plays as it appears. "You already know these — Do, Re, Mi..."
- Step 1.3: Notes repeat in octaves. Same note, different height. Play C3 and C4 together. The circle pulses to show the octave relationship.

**Chapter 2: Chords — Notes That Sound Good Together** (skippable for anyone who knows triads)
- Step 2.1: Some notes sound good together. Play a fifth (C-G). Play a third (C-E). Highlight these intervals on the chromatic circle.
- Step 2.2: Three notes make a chord. Build C major triad (C-E-G), hear it. Build A minor triad (A-C-E), hear it. "Major sounds bright. Minor sounds dark."
- Step 2.3: Interactive — user clicks notes on the circle to build triads. Feedback tells them what they built.

**Chapter 3: The Tonnetz — A Map of Harmony** (the core — most intermediate users enter here)
- Step 3.1: The grid reveal. The chromatic circle "unfolds" into the Tonnetz grid via animation. Fifths go one direction, major thirds go another, minor thirds go the third. The C major triad from Chapter 2 is now a triangle on the grid.
- Step 3.2: Navigating the grid. User clicks nodes, hears notes. Clicks a triangle, hears the chord. "Every triangle is a chord. The grid shows how they connect."
- Step 3.3: Why this matters. Show two distant keys on a piano (C major → F# major = confusing). Show them on the Tonnetz (connected by a clear path). "The Tonnetz shows relationships the piano hides."

**Chapter 4: Transforms — Moving Through Harmony** (the payoff)
- Step 4.1: **P (Parallel)** — C major → C minor. Animate one vertex sliding. Same root, different mood. User triggers it by clicking. Hear both chords. "Same starting note, but the feeling changes."
- Step 4.2: **R (Relative)** — C major → A minor. Animate the triangle flipping along the shared edge. Two shared notes, new key. User triggers it. "These two keys are relatives — they share most of their notes."
- Step 4.3: **L (Leading Tone)** — C major → E minor. The smallest possible move on the grid. User triggers it. "One note moves by just a half step, and the whole mood shifts."
- Step 4.4: Playground — all three transforms available. User clicks any triangle, then chooses P, R, or L to move. Free exploration with audio feedback. "You're navigating the Tonnetz."

### Entry Point Routing

Based on user profile (or self-assessment if no profile):
- `beginner` / `dabbler` preset → Start at Chapter 1
- `curious_player` / `producer` preset → Start at Chapter 2
- `deep_diver` / `math_explorer` preset → Start at Chapter 3
- Topic `triads` status is `learned` → Skip to Chapter 3
- Topic `tonnetz_geometry` status is `learned` → Skip to Chapter 4
- All chapters completed → Show Chapter 4 playground directly (quick refresher)

### Completion Tracking

On completing each chapter, update the user profile:
- Chapter 1 → mark `sound_basics`, `note_names`, `octave` as `visited`
- Chapter 2 → mark `triads`, `intervals` as `visited`
- Chapter 3 → mark `tonnetz_geometry` as `visited`
- Chapter 4 → mark `tonnetz_transforms` as `visited`; mark `relative_minor_major` as `visited`
- Full completion → set a `tonnetz_intro_completed: true` flag in profile

### Task 5.1 — Intro module scaffolding and chapter navigation

```
Read the project structure, then read templates/base.html,
static/shared/tonnetz-neighborhood.js, static/shared/keyboard-view.js,
and static/shared/harmony-state.js to understand existing shared
components. Also read static/shared/user-profile.js for profile access.

Create the intro module scaffolding:

1. Add a /intro/tonnetz route in app.py that renders
   templates/intro-tonnetz.html.

2. intro-tonnetz.html extends base.html. It contains:
   - A chapter navigation bar at the top showing 4 chapters
     as labeled nodes/tabs. Completed chapters show a checkmark.
     Current chapter is highlighted. Clicking a chapter jumps to it.
   - A main content area where chapter steps render.
   - Back/Next navigation buttons at the bottom.
   - A "Skip to [suggested chapter]" link based on user profile
     (use the entry point routing logic described in the spec).

3. Create static/intro/intro-tonnetz.js as the main controller.
   It manages:
   - Current chapter and step state
   - Chapter completion tracking (calls updateTopicStatus on completion)
   - Step transitions with CSS fade/slide animations
   - A step rendering framework: each step is a function that
     receives the content container and returns a cleanup function.

4. Create static/intro/intro-tonnetz.css with styles for the
   chapter nav, step container, and transition animations.
   Use existing CSS custom properties. Respect light/dark theme.

5. Leave placeholder content for each chapter step (just a title
   and description) — we'll build the actual animated content in
   subsequent tasks.

6. Add "Introduction" link to the main navigation, and add a
   prominent "Start Here" card on the dashboard that links to
   /intro/tonnetz for users who haven't completed it.

Do not commit — I will handle git myself.
```

### Task 5.2 — Chapter 1: Sound & Notes (animated SVG + Tone.js)

```
Read static/intro/intro-tonnetz.js to understand the step
rendering framework from Task 5.1. Read the Tone.js usage
patterns in existing game files (e.g., the Relative Key Trainer
or Harmony Trainer) for audio conventions.

Build the three steps for Chapter 1:

Step 1.1 — Sound is vibration:
- Animate an SVG waveform (sine wave) that responds to a
  frequency slider. Use Tone.js Oscillator to play the tone.
- Slider range: ~100Hz to ~1000Hz. Visual wave period changes
  with frequency.
- Brief text overlay: "Sound is vibration. Drag the slider."
- Auto-advance hint after 5 seconds of interaction.

Step 1.2 — We named the notes:
- SVG chromatic circle: 12 nodes arranged in a clock layout.
- Notes appear one at a time with a fade-in animation, each
  playing its pitch via Tone.js Sampler (Salamander) as it appears.
- After all 12 appear, pulse them in sequence (chromatic scale).
- Text: "Musicians gave each vibration a letter name."

Step 1.3 — Notes repeat in octaves:
- Same chromatic circle, now show two concentric rings (octave 3
  and octave 4). Play C3 then C4, then together.
- Animate a connecting line between the two C nodes.
- Text: "Same note, different height. This pattern repeats forever."

Each step should:
- Use CSS transitions for element appearance (no heavy animation libs)
- Play audio only on user interaction or after a brief delay
  (respect browser autoplay policies — require a click to start)
- Have a "Next →" affordance that's clear but not pushy
- Clean up Tone.js resources on step exit

Do not commit — I will handle git myself.
```

### Task 5.3 — Chapter 2: Chords (interactive triad building)

```
Read static/intro/intro-tonnetz.js and the Chapter 1 step code
from Task 5.2 for patterns.

Build the three steps for Chapter 2:

Step 2.1 — Some notes sound good together:
- Chromatic circle from Chapter 1 (reuse the SVG component).
- Highlight C and G, draw a line between them, play the interval.
  Text: "These two notes are a fifth apart — they sound stable."
- Then highlight C and E, draw that line, play it.
  Text: "These are a third apart — they add warmth."
- Intervals can auto-play in sequence or on click.

Step 2.2 — Three notes make a chord:
- Highlight C-E-G on the circle, forming a triangle. Play C major.
  Text: "Three notes together = a chord. This one sounds bright."
- Then highlight A-C-E, forming a different triangle. Play A minor.
  Text: "This one sounds darker. Same idea, different feeling."
- Toggle between them on click so the user hears the contrast.

Step 2.3 — Build your own:
- Chromatic circle is now interactive. User clicks any node to
  select it. When exactly 3 nodes are selected, play the chord
  and display what it is (e.g., "C major", "F# diminished").
- Use a simple triad detection function (root + intervals →
  chord quality).
- Text: "Click three notes. What did you build?"
- "Clear" button to reset selections.

Do not commit — I will handle git myself.
```

### Task 5.4 — Chapter 3: The Tonnetz grid reveal (the big animation)

```
Read static/intro/intro-tonnetz.js, the Chapter 1-2 code for
patterns, and static/shared/tonnetz-neighborhood.js for the
existing Tonnetz SVG renderer.

Build the three steps for Chapter 3. This is the centerpiece
of the intro module.

Step 3.1 — The grid reveal:
- Start with the chromatic circle from Chapter 2 (with the
  C major triangle still visible).
- Animate the transformation: the circle "unfolds" into a
  Tonnetz grid. This is the big moment — take time with it.
  Approach: morph node positions from circular layout to grid
  layout using CSS transitions or requestAnimationFrame.
  The C major triangle remains highlighted throughout the morph
  so the user sees continuity.
- Once the grid is formed, label the axes: "← Fifths →",
  "↗ Major thirds", "↘ Minor thirds" (or similar).
- Text: "The circle just became a grid. Same notes, new layout."
- Use the TonnetzNeighborhood component for the final grid state
  if possible, or build a simplified version for the intro.

Step 3.2 — Navigating the grid:
- The Tonnetz grid is now interactive. User clicks nodes to hear
  notes. User clicks triangles (or the space between three nodes)
  to hear chords.
- Highlight the current selection. Show the chord name.
- Text: "Every triangle is a chord. Click around."
- Encourage exploration for 10-15 seconds before showing "Next".

Step 3.3 — Why this matters:
- Show a piano keyboard (use KeyboardView component if suitable)
  with C major highlighted. Then highlight F# major — they're
  far apart on the keyboard.
- Show the same two chords on the Tonnetz — they're connected
  by a clear path of transforms.
- Text: "On a piano, some keys feel far apart. On the Tonnetz,
  you can see how they're actually connected."
- Optionally animate the path between them.

Do not commit — I will handle git myself.
```

### Task 5.5 — Chapter 4: P, R, L transforms (interactive)

```
Read static/intro/intro-tonnetz.js, Chapter 3 code for the
Tonnetz grid, and static/shared/transforms.js for the P/R/L
transform logic.

Build the four steps for Chapter 4:

Step 4.1 — P (Parallel):
- Tonnetz grid showing C major triangle highlighted.
- Animate: one vertex slides to transform C major → C minor.
  Play both chords in sequence with a brief pause.
- Text: "P = Parallel. Same root note, different mood."
- User can click to toggle back and forth (C major ↔ C minor).

Step 4.2 — R (Relative):
- Start with C major triangle.
- Animate: the triangle flips along its shared edge to become
  A minor. Two nodes stay fixed, one moves. Play both chords.
- Text: "R = Relative. These keys are family — they share
  almost all their notes."
- User toggles C major ↔ A minor.

Step 4.3 — L (Leading Tone):
- Start with C major triangle.
- Animate: one vertex moves by a half step to become E minor.
  Play both chords.
- Text: "L = Leading Tone. The smallest move on the grid
  creates a completely new chord."
- User toggles C major ↔ E minor.

Step 4.4 — Playground:
- Full Tonnetz grid, interactive. User clicks any triangle to
  select it (highlight + play chord).
- Three buttons appear: P, R, L. Clicking one applies the
  transform — the highlight animates to the new triangle and
  the new chord plays.
- A breadcrumb trail shows the sequence of transforms applied
  (e.g., "C major → R → A minor → L → F major → P → F minor").
- Text: "You're navigating the Tonnetz. Where will you go?"
- No "Next" button — this is a sandbox. A "Finish" button
  marks the intro as complete and returns to the dashboard
  (or suggests the Relative Key Trainer game).

On completing Chapter 4, update the profile:
- Set tonnetz_intro_completed: true
- Mark relevant topics as visited (see spec above)

Do not commit — I will handle git myself.
```

### Phase 5 Checkpoint
The `/intro/tonnetz` route delivers a complete, chaptered walkthrough
from sound basics through P/R/L transforms. Entry points adapt to
user profile. Completion updates topic status.
**Test:** New user (beginner preset) → starts at Chapter 1, walks through
all 4 chapters. Experienced user (deep_diver preset) → jumps to Chapter 3.
Verify audio plays, animations are smooth, profile updates on completion.
Verify the Chapter 4 playground allows free exploration with P/R/L.

---

## Phase 6: Skratch Studio Starters, Learning Paths & Theory Hub
**Goal:** Build the Skratch Studio starter loading system, the path system, and a basic Theory Hub page.
**Why here:** With profiles, content types, playful lenses, and the intro module in place, we need the path infrastructure to deliver guided learning. The Foundations path depends on Skratch Studio starters, so that engineering comes first.
**Ships:** Skratch Studio lesson mode, Theory Hub page, 3 learning paths with full interactivity.
**Depends on:** Phases 2, 4, and 5 (profile system, playful content, intro module all feed into paths).

### Task 6.1 — Skratch Studio starter loading system

```
Read the Skratch Studio code to understand the current architecture.
Start from the project root, then read templates/skratch-studio.html
and all JS files in static/skratch-studio/ (especially studio.js,
blocks.js, music-engine.js, and sandbox.js).

Also read docs/tonnetz-content-architecture.md, specifically §7a (Starters)
for the schema and requirements.

Build a starter loading system for Skratch Studio that allows it
to accept a preconfigured state. Requirements:

1. Config ingestion: Skratch Studio accepts a starter config via
   URL parameter (e.g., ?starter=starter_rhythm_grid) that loads
   a JSON config from a starters data file.

2. Feature locking: ability to hide/disable instruments and block
   categories not relevant to the current lesson.

3. Block pre-placement: load blocks onto the canvas programmatically.

4. State reset: "Reset to starter" button that restores the original
   config (distinct from "Clear All").

5. Create a starters data file (static/skratch-studio/skratch-starters.js)
   with 2 initial starters for testing:

   starter_free_play: {
     instruments: all, blocks: [], available_blocks: all,
     locked_features: [], piano_config: null, bpm: 120, key: null,
     prompt: "This is your music playground. Make some noise!",
     hints: [], debrief: null, theory_link: null
   }

   starter_rhythm_grid: {
     instruments: ["drums"], blocks: [a basic 4-bar drum pattern],
     available_blocks: ["drum_loop", "drum_hit"],
     locked_features: ["melody", "bass", "piano"],
     piano_config: null, bpm: 100, key: null,
     prompt: "Make a pattern that repeats. Tap along with it.",
     hints: ["Try putting a kick on beats 1 and 3.",
             "Now add a snare on beats 2 and 4."],
     debrief: "That repeating pattern is called rhythm — the heartbeat of music.",
     theory_link: "rhythm"
   }

Test that ?starter=starter_rhythm_grid loads the constrained state
and ?starter= (empty) or no param loads normally.

Do not commit — I will handle git myself.
```

### Task 6.2 — Build all Foundations path starters

```
Read static/skratch-studio/skratch-starters.js and docs/tonnetz-content-architecture.md
(§6, the full Foundations path with all 12 steps and starter IDs).

Add the remaining starter configs for the Foundations path:

- starter_sound_frequency: single oscillator block, frequency slider,
  no other instruments. Prompt: "Drag the slider. What happens to
  the sound when you go up? Down?"

- starter_note_names: piano only, 1 octave (C4-B4), keys labeled
  with note names. Lock drums/bass/melody blocks.
  Prompt: "Play every white key from left to right."

- starter_tempo_slider: reload the drum loop from starter_rhythm_grid,
  add a BPM slider (range 40-200). Lock everything except tempo control.
  Prompt: "Same pattern, but now you control the speed."

- starter_dynamics_loud_soft: pre-built simple melody (C-E-G-E-C),
  volume envelope block available to add. Lock new instruments.
  Prompt: "This melody sounds flat. Make it start quiet and get LOUD."

- starter_octave_jump: piano, 2 octaves (C3-B4), C notes highlighted
  in both octaves. Lock blocks. Prompt: "Play this C. Now play
  THIS C. Same note, different height."

- starter_half_whole_steps: piano zoomed to C4-E4, half steps
  color-coded one color, whole steps another. Lock blocks.
  Prompt: "Play two keys right next to each other — that's a
  semitone. Skip one — that's a whole tone."

- starter_interval_builder: piano, 1 octave, two movable note
  markers that display the interval name between them as they move.
  Prompt: "Drag the notes apart — watch the name change."

- starter_major_scale: piano, only white keys active (C major),
  whole/half step pattern shown as colored markers between keys.
  Prompt: "Play these keys in order. Hear 'Do Re Mi'?"

- starter_minor_scale: piano starting on A, white keys only,
  A minor scale highlighted. Prompt: "Same keys, different
  starting point. Hear how it sounds darker?"

- starter_triad_builder: piano with chord-building mode — user
  picks a root note and sees the triad (root, 3rd, 5th) highlight
  automatically. Can toggle major/minor.
  Prompt: "Pick any note. Now stack — that's a chord."

Adapt each starter to what Skratch Studio can actually do given
the loading system built in Task 6.1. If a starter requires
functionality that doesn't exist yet (like the interval name
display), implement a simplified version and leave a TODO comment.

Test each starter loads correctly via URL parameter.

Do not commit — I will handle git myself.
```

### Task 6.3 — Design remaining paths (claude.ai)

Use claude.ai to design the other 2 paths. Music Foundations
is already fully designed in the architecture doc. Still needed:

1. **"Why Chords Work"** — curious_player/producer path. ~8 steps.
   Assumes note_names and scales are known. Start from intervals,
   through triads, diatonic_chords, chord_function, cadences.
   Include Chord Spotter and Harmony Trainer at relevant steps.
   Some steps may use Skratch Studio starters (e.g., "build a
   I-IV-V progression"). Default lens: musician.

2. **"Tonnetz & Transforms"** — deep_diver/math_explorer path.
   ~6 steps covering tonnetz_geometry through hexatonic_cycles.
   Visualization-heavy (Tonnetz Grid at most steps). No Skratch
   Studio starters needed — this path is more conceptual.
   Default lens: theorist/math.
   **Note:** This path should reference the Intro Module (Phase 5)
   as a prerequisite or embed its Chapter 3-4 content as the
   first steps.

### Task 6.4 — Learning paths data file

```
Read the project structure and static/shared/theory-content.js.
Read docs/tonnetz-content-architecture.md §6 for the full Foundations path.

Create a new file: static/shared/learning-paths.js

This file exports (or exposes on window) an array of learning path
objects. Include all 3 paths:

[Paste the Foundations path from the architecture doc,
plus the 2 paths designed in Task 6.3]

Also create a helper function getPathsForPreset(preset) that
returns all paths whose target_personas array includes the given
preset string.

Do not commit — I will handle git myself.
```

### Task 6.5 — Theory Hub page

```
Read templates/base.html to understand the template structure.
Read static/shared/theory-content.js and static/shared/learning-paths.js
for the data layer. Read static/shared/user-profile.js for profile state.

Create a new route and template for the Theory Hub:

1. Add a /hub route in app.py that renders templates/hub.html.

2. hub.html extends base.html. It has two main sections:

   a. "Your Paths" (top) — shows learning paths recommended for the
      user's preset (use getPathsForPreset). Each path shows title,
      description, and a progress bar based on completed steps from
      the user profile. Clicking a path enters it at the current step.
      If no profile exists, show paths for "beginner" as default.

   b. "All Topics" (below) — a browsable grid/list of all topics,
      organized by content_type (Building Blocks, Frameworks,
      Reference — don't show Skill Guides section until those topics
      exist). Each topic card shows: title, quick_summary, difficulty
      dots (1-5), content_type badge, and status indicator from the
      user profile (unseen/visited/learning/learned).

      Clicking a topic card opens an expandable detail view or
      navigates to a topic page showing the full depth content
      for the user's active lens, with tabs/buttons to switch lenses.

3. Add "Theory Hub" to the main navigation.

4. Style to match the existing Tonnetz dashboard aesthetic.
   Use existing CSS custom properties. Respect light/dark theme.

Do not commit — I will handle git myself.
```

### Task 6.6 — Path runner UI

```
Read static/shared/learning-paths.js, static/shared/user-profile.js,
and the Theory Hub template from Task 6.5.

Build a path runner — the UI for stepping through a learning path:

1. When a user clicks "Start" or "Continue" on a path in the
   Theory Hub, open the path runner view.

2. The runner shows the current step:
   - The step's prompt text (large, friendly)
   - The topic content for the user's active lens (expandable)
   - Action buttons based on what the step includes:
     - If game_id is a recognition game → "Play [Game Name]" button
       that navigates to the game
     - If starter_id exists → "Open in Skratch Studio" button that
       opens Skratch Studio with ?starter=[starter_id]
     - If visualization_id exists → "Explore" button (links to
       visualization, or shows placeholder if not yet built)
   - "Mark Complete & Next Step →" button that calls
     updatePathProgress and advances to the next step.
   - "← Previous Step" for review.

3. A step progress bar showing all steps as dots/nodes,
   with completed steps filled and current step highlighted.

4. On the final step, show a completion message and suggest
   the next path or free exploration.

5. Save progress to profile on each step completion.

Do not commit — I will handle git myself.
```

### Task 6.7 — Bidirectional game ↔ topic links

```
Read the game page templates and static/shared/theory-content.js.

Add bidirectional navigation between games and topics:

1. On each game page, add a small "Learn" section (collapsible
   sidebar or footer panel) that lists the game's core_topics
   and supporting_topics with links to their Theory Hub entries.
   Use the topic's quick_summary as preview text.

2. On each topic's detail view in the Theory Hub, show a
   "Practice this" section listing related_games with relevance
   indicators. "Primary" games get prominent buttons.
   "Supporting" games get smaller text links.

3. After a game session ends (or on the results screen if one
   exists), show a contextual suggestion: "Want to understand
   [topic]? Read about it →" linking to the most relevant topic
   the player struggled with (if tracking exists) or the primary
   topic.

Keep it unobtrusive — the game experience comes first.

Do not commit — I will handle git myself.
```

### Phase 6 Checkpoint
Users can browse all topics in the Theory Hub, follow the Music
Foundations path with Skratch Studio starters at every step,
and navigate between games and theory content.
**Test:** Start the Foundations path as a beginner. Step 0 opens
Skratch Studio in free play mode. Step 2 opens Rhythm Lab, then
the rhythm starter in Skratch Studio. Step 8 opens Harmony Trainer,
then the interval builder starter. Verify path progress saves and
the hub shows progress bars updating.

---

## Phase 7: Game Progression & Assessment
**Goal:** Add difficulty levels to games, auto-assessment for topic status, and game intro screens.
**Why here:** With paths and profiles in place, we can now close the loop — game performance feeds back into topic progress.
**Ships:** Game intro screens, level progression, auto-marking topics.

### Task 7.1 — Game intro screens

```
Read the game templates to understand how games currently load.
Read static/shared/theory-content.js for the game → topic mappings.
Read static/shared/user-profile.js for profile access.

For each recognition game (harmony_trainer, melody_match,
chord_spotter, rhythm_lab, relative_pitch, strum_patterns),
add an intro screen that shows on first visit (check profile)
or when the user clicks an "Info" button:

1. What you'll learn (1 sentence)
2. What you'll need to know — list prerequisite topics with
   status indicators from the profile. Link to Theory Hub entries.
   If prereqs are "unseen", suggest reading them first (but don't
   block — the user can dismiss and play anyway).
3. How to play — brief gameplay instructions
4. A "Let's go!" button that dismisses the intro and starts the game.

Mark the intro as "seen" in the profile so it doesn't show again
(add an intros_seen array to the profile preferences, or a per-game
flag in games[gameId]).

Style consistently with the onboarding overlay aesthetic.

Do not commit — I will handle git myself.
```

### Task 7.2 — Game level system and auto-assessment

```
Read the game JS files to understand how scoring/difficulty
currently works in each game. Read static/shared/user-profile.js.

This task is game-specific and may need to be split across
multiple sessions depending on game complexity. Start with
Harmony Trainer as the reference implementation, then apply
the pattern to other games.

For Harmony Trainer:
1. Define difficulty levels:
   - Level 1: Perfect 5ths & Octaves (unlocked by default)
   - Level 2: Major & Minor 3rds
   - Level 3: Perfect 4ths & Major 2nds
   - Level 4: All intervals within an octave
   - Level 5: Compound intervals

2. Unlock logic: completing a level (e.g., 80%+ accuracy over
   10 questions) unlocks the next level.

3. After each session, call updateGameProgress with current_level
   and high_score.

4. Auto-assessment: when a player completes Level 2, auto-set
   the "intervals" topic status to "learning". When they complete
   Level 4, auto-set to "learned". Define these trigger mappings
   as data, not hardcoded logic, so they're easy to adjust:

   assessment_triggers: [
     { level: 2, topic: "intervals", status: "learning" },
     { level: 4, topic: "intervals", status: "learned" },
     { level: 1, topic: "semitones_whole_tones", status: "learning" },
     // etc.
   ]

Document the pattern clearly so it can be replicated for
Chord Spotter, Melody Match, etc. in subsequent sessions.

Do not commit — I will handle git myself.
```

### Task 7.3 — Replicate level system for remaining games

Repeat the pattern from 7.2 for: chord_spotter, melody_match,
rhythm_lab, relative_pitch, strum_patterns. Each session handles
1-2 games depending on complexity.

---

## Phase 8: Tonnetz Grid Progress Map (Fog of War)
**Goal:** Transform the Tonnetz grid visualization into a spatial progress map with fog-of-war discovery.
**Why last:** This is the most complex and most visually impressive feature. It depends on all previous phases — profile, progress tracking, topic relationships, and game levels all feed into it.
**Ships:** Interactive Tonnetz grid homepage showing progress, discoverable regions, and navigation to topics/games.

### Task 8.1 — Design the grid-to-topic mapping

Use claude.ai to design how topics and concepts map to regions of
the Tonnetz grid. This is a design task:
- Which nodes/regions correspond to which topics?
- What's the "C major starting area" that beginners see?
- How do framework topics (which aren't single notes) map to
  regions vs. connections between regions?
- What visual states exist? (hidden, dimmed, discovered, learning, mastered)

### Task 8.2 — Build the interactive progress grid

```
[Prompt will depend on design decisions from 8.1.
This is likely 2-3 Claude Code sessions for the visualization,
interactivity, and profile integration.]
```

### Task 8.3 — Integrate as homepage for returning users

```
[Update index.html to show the Tonnetz grid as the primary
navigation surface for users with a profile. New users still
see the onboarding flow. Add traditional nav fallback.]
```

---

## Phase 9: Competency Graph (Adaptive Branching Infrastructure)
**Goal:** Build a shared competency tracking system that monitors demonstrated micro-skills across games and drives adaptive branching — changing the *type* of challenge, not just the difficulty.
**Why here:** With game levels (Phase 7) generating performance data and the profile system storing state, we can now layer on cross-game intelligence. This is the system that keeps existing games from feeling flat — it unlocks mode shifts within a game session and gates puzzle types in Puzzle Paths (Phase 10).
**Ships:** Shared `skill-map.js` module, adaptive mode transitions in Harmony Trainer and Relative Key Trainer, competency-aware UI cues.
**Depends on:** Phase 2 (profile), Phase 7 (game levels provide the raw signals).

### Task 9.1 — Design the competency graph (claude.ai)

Design task, not a code task. Define:

- **Micro-skill taxonomy:** The atomic skills the system tracks. Examples:
  - `identify_major_minor` — can distinguish major from minor triads
  - `hear_P_transform` — recognizes the Parallel transformation by ear
  - `hear_L_transform` — recognizes the Leading Tone transformation by ear
  - `hear_R_transform` — recognizes the Relative transformation by ear
  - `trace_2chord_progression` — can follow a 2-chord path on the Tonnetz
  - `trace_3chord_progression` — can follow a 3-chord path on the Tonnetz
  - `chain_transforms` — can apply 2+ P/L/R transforms in sequence
  - `identify_interval_by_ear` — can name intervals aurally
  - `recognize_blues_turnaround` — identifies blues progression by ear
  - `recognize_common_progressions` — identifies doo-wop, axis, etc.
  - etc.

- **Skill relationships:** Which skills are prerequisites for others. This forms the graph structure.

- **Demonstration criteria:** What constitutes "demonstrated" for each skill. E.g., `identify_major_minor` requires 8/10 correct in Harmony Trainer Level 1.

- **Game signal mappings:** Which game events feed which skills. A single game session might update multiple skills.

- **Mode transition rules:** For each game, what competency state triggers a mode shift. E.g., Harmony Trainer: `identify_major_minor` demonstrated → unlock "which transformation connects these?" mode.

Deliverable: `docs/competency-graph-spec.md` covering the taxonomy, relationships, demonstration criteria, and transition rules.

### Task 9.2 — Build skill-map.js

```
Read docs/competency-graph-spec.md for the design.
Read static/shared/user-profile.js for the profile API.
Read static/shared/theory-content.js for the topic schema pattern.

Create a new file: static/shared/skill-map.js

This module manages the competency graph. It should expose:

1. Skill taxonomy data: an object defining all micro-skills with
   their IDs, display names, descriptions, prerequisite skills,
   and demonstration criteria.

2. getSkillStatus(skillId) — returns the current status of a
   skill for the active user: "undiscovered", "emerging", or
   "demonstrated". Reads from the user profile.

3. updateSkillFromGameEvent(gameId, eventData) — called by games
   after significant events (completing a level, streak of correct
   answers, etc.). Evaluates demonstration criteria and updates
   skill status in the profile if thresholds are met.

4. getAvailableModes(gameId) — returns an array of mode objects
   that the current user has unlocked for a given game, based on
   their demonstrated skills. Each mode has an ID, display name,
   description, and required skills.

5. getNextChallengeDimension(gameId) — suggests what the game
   should offer next based on which skills are demonstrated vs
   emerging. This is the core adaptive branching query.

6. getSkillsForGame(gameId) — returns all skills that a game
   can assess, with their current status.

Store skill status in the user profile under a new `competencies`
key (extend the profile schema). Format:
{
  skill_id: {
    status: "undiscovered" | "emerging" | "demonstrated",
    evidence: [{ game: "harmony_trainer", timestamp: ..., detail: ... }],
    first_seen: timestamp,
    demonstrated_at: timestamp | null
  }
}

Include a lightweight test behind a window.TONNETZ_TEST guard.

Do not commit — I will handle git myself.
```

### Task 9.3 — Integrate competency graph into Harmony Trainer

```
Read static/shared/skill-map.js for the competency API.
Read the Harmony Trainer game code to understand its current
level and scoring system (from Phase 7).

Wire the Harmony Trainer to the competency graph:

1. After each answer, call updateSkillFromGameEvent with the
   relevant event data (what was asked, was it correct, current
   streak, etc.).

2. At session start, call getAvailableModes("harmony_trainer")
   and present unlocked modes to the user. Modes should include:
   - "Identify" (default): identify chord quality (existing behavior)
   - "Transform": hear two chords, name the transformation (unlocked
     when identify_major_minor is demonstrated)
   - "Trace": hear a 2-3 chord progression, trace the path on a
     mini Tonnetz view (unlocked when hear_P_transform and
     hear_R_transform are demonstrated)

3. Mode transitions within a session: if the player is in
   "Identify" mode and demonstrates the threshold skill mid-session,
   offer a transition prompt: "You've got a good ear for this.
   Ready to hear how chords move?" with an option to switch modes
   or stay in current mode.

4. The transition framing should feel like unlocking/discovery,
   not leveling up or being tested. Use encouraging, exploratory
   language.

Do not commit — I will handle git myself.
```

### Task 9.4 — Integrate competency graph into Relative Key Trainer

```
Read static/shared/skill-map.js for the competency API.
Read the Relative Key Trainer game code.

Wire the Relative Key Trainer to the competency graph:

1. After each answer, call updateSkillFromGameEvent with relevant
   event data.

2. At session start, call getAvailableModes("relative_key_trainer")
   and present unlocked modes. Modes should include:
   - "Relative keys" (default): identify relative major/minor
   - "Parallel keys": identify parallel major/minor (unlocked
     when relative major/minor skill is demonstrated)
   - "Mixed": "is this the relative or parallel minor?" (unlocked
     when both relative and parallel skills are demonstrated)

3. Same mid-session transition pattern as Harmony Trainer:
   detect when threshold is met, offer exploratory prompt to
   switch modes.

Do not commit — I will handle git myself.
```

### Phase 9 Checkpoint
The competency graph tracks micro-skills across games. Harmony
Trainer and Relative Key Trainer both report game events and
offer adaptive mode transitions. A player who masters chord
identification is offered transformation challenges without
leaving the game.
**Test:** Fresh profile → play Harmony Trainer → demonstrate
major/minor identification → receive prompt to try "Transform"
mode → switch modes → demonstrate P/R transforms → Relative
Key Trainer now shows "Mixed" mode available. Verify competency
data persists in profile across sessions.

---

## Phase 10: Puzzle Paths Game
**Goal:** Build a new standalone game where players navigate the Tonnetz graph from a start chord to a target chord (or through a real musical progression) using neo-Riemannian transformations.
**Why here:** With the competency graph, Tonnetz neighborhood renderer, transforms.js, and audio infrastructure all in place, Puzzle Paths can leverage the full platform. It's also the most Tonnetz-native game concept — it uses the topology as the core gameplay mechanic.
**Ships:** New `/games/puzzle-paths` route with pathfinding, progression tracing, ear-based, and constraint puzzle types.
**Depends on:** Phase 9 (competency graph for gating and signals), Phase 7 (game infrastructure patterns), tasks 10.1-10.2 (transforms.js, harmony-state.js).
**Full spec:** `docs/puzzle-paths-spec.md`

### Task 10.1 — Progression library data file

```
Read docs/puzzle-paths-spec.md for the full game spec.
Read static/shared/theory-content.js for the data file pattern.
Read static/shared/transforms.js for the P/L/R transform logic.

Create static/shared/progression-library.js — a data file
containing curated musical progressions mapped to Tonnetz paths.

Each progression entry should include:
- id (string, e.g., "blues_turnaround")
- name (display name, e.g., "Blues Turnaround")
- genre_tags (array, e.g., ["blues", "rock"])
- degrees (array of roman numerals, e.g., ["I","IV","I","V","IV","I"])
- reference_key (the key used for the canonical example, e.g., "C")
- chords_in_reference_key (array, e.g., ["C","F","C","G","F","C"])
- difficulty (1-5)
- real_world_context (string describing where this shows up in
  actual music, with specific song examples)
- tags for which transformations are emphasized

Include at minimum these progressions:
- Blues Turnaround (I-IV-I-V-IV-I)
- 50s Doo-Wop (I-vi-IV-V)
- Axis of Awesome (I-V-vi-IV)
- Andalusian Cadence (i-VII-VI-v)
- Creep Progression (I-III-IV-iv)
- Jazz ii-V-I (ii-V-I)
- Pachelbel's Canon (I-V-vi-iii-IV-I-IV-V)
- Plagal Cadence (IV-I)
- Deceptive Cadence (V-vi)
- 12-Bar Blues (full form)

Each progression should be transposable to all 12 keys via a
helper function: transposeProgression(progressionId, targetKey).

Do not commit — I will handle git myself.
```

### Task 10.2 — Tonnetz pathfinding algorithm

```
Read static/shared/transforms.js for the P/L/R transform logic.
Read docs/puzzle-paths-spec.md for context on how pathfinding
is used in the game.

Add pathfinding functions to transforms.js (or create a new
file static/shared/tonnetz-pathfinder.js if transforms.js is
getting large):

1. findShortestPath(startChord, endChord) — BFS over the
   Tonnetz graph using P/L/R as edges. Returns an array of
   { chord, transform } steps. Returns null if unreachable
   (shouldn't happen on a connected Tonnetz, but handle it).

2. findAllPaths(startChord, endChord, maxLength) — returns all
   paths up to maxLength steps. For puzzle validation and for
   showing alternative solutions.

3. decomposeCompoundMove(startChord, endChord) — given two chords
   that aren't a single P/L/R apart, returns the shortest P/L/R
   sequence connecting them. This is the core algorithm that
   powers the animated path tracing when a player "leaps" to
   a non-adjacent chord.

4. validatePath(chords) — given an array of chords, verify that
   each consecutive pair is reachable via P/L/R transforms and
   return the transform sequence.

Write thorough tests behind a window.TONNETZ_TEST guard:
- Verify C major → C minor is a single P step
- Verify C major → A minor is a single L step
- Verify C major → F major requires compound moves
- Verify shortest path lengths for known examples
- Verify decomposeCompoundMove returns valid sequences

Do not commit — I will handle git myself.
```

### Task 10.3 — Puzzle Paths game scaffolding

```
Read docs/puzzle-paths-spec.md for the full game spec.
Read an existing game template (e.g., Harmony Trainer or
Relative Key Trainer) for the Flask route + template pattern.
Read static/shared/tonnetz-neighborhood.js for the Tonnetz
SVG renderer.
Read static/shared/skill-map.js for competency integration.

Build the Puzzle Paths game scaffolding:

1. Add a /games/puzzle-paths route in app.py that renders
   templates/puzzle-paths.html.

2. Create templates/puzzle-paths.html extending base.html.
   Layout:
   - Tonnetz neighborhood view (reuse TonnetzNeighborhood
     component) as the main play area
   - Puzzle info panel: puzzle name, type, constraints, and
     real-world context blurb
   - Path trail display: shows the sequence of chords visited
     with transformation labels between them
   - Audio controls: "Play full path" button
   - Puzzle navigation: next puzzle, retry, back to menu

3. Create static/puzzle-paths/puzzle-paths.js as the main
   game controller. It manages:
   - Puzzle state: current puzzle, player position, path history,
     moves remaining (if constrained)
   - Tonnetz interaction: player clicks a chord on the Tonnetz
     to move there
   - Compound move animation: when player selects a non-adjacent
     chord, call decomposeCompoundMove and animate through each
     intermediate step with configurable speed
   - Transformation labels: appear along the animated trail after
     each step completes
   - Audio playback: play each chord during animation, play full
     path on completion
   - Puzzle completion detection and feedback

4. Create static/puzzle-paths/puzzle-paths.css with game-specific
   styles. Use existing CSS custom properties. Respect light/dark
   theme. Give this game its own accent color consistent with the
   per-game color system.

5. Implement Pathfinding Puzzles only for this task (simplest
   type). Load a puzzle definition: { startChord, targetChord,
   moveConstraint (optional) }. Player navigates to the target.
   On success, show feedback and play the full path.

6. Add "Puzzle Paths" to the game grid on the dashboard.

Do not commit — I will handle git myself.
```

### Task 10.4 — Progression Tracing puzzle type

```
Read static/puzzle-paths/puzzle-paths.js for the game framework.
Read static/shared/progression-library.js for the progression data.

Add the Progression Tracing puzzle type:

1. Puzzle setup: load a progression from the library, display
   its name, genre tag, and optionally play an audio preview of
   the target progression.

2. Gameplay: the player traces the progression chord by chord on
   the Tonnetz. For each step, they click the next chord in the
   sequence. Compound moves animate through intermediate P/L/R
   steps as designed (player leaps, Tonnetz shows the work).

3. After each chord selection:
   - If correct: animate the compound move, play the chord,
     advance to the next step
   - If incorrect: gentle feedback ("That's [chord name] — the
     progression goes to [expected chord name]. Try again.")
     Don't penalize heavily — this is about learning the shape.

4. On completion: play the full progression, show the complete
   path visualization, display the real_world_context blurb
   from the progression library.

5. Offer "Explore in Skratch Studio" button that opens Skratch
   Studio with the progression pre-loaded as blocks (if the
   starter system supports dynamic configs, use that; otherwise
   link to Skratch Studio with a query param encoding the chord
   sequence).

6. Key transposition: include a "Try in another key" option
   that reloads the same progression transposed. Start with
   the reference key, suggest nearby keys (G, F, Am) next.

Test with Blues Turnaround and Doo-Wop progressions.

Do not commit — I will handle git myself.
```

### Task 10.5 — Ear-based and Constraint puzzle types

```
Read static/puzzle-paths/puzzle-paths.js and the existing
puzzle type implementations.

Add two more puzzle types:

1. Ear-Based Puzzles:
   - Puzzle plays a progression audio without showing chord labels
   - Player must identify each chord by ear and trace the path
   - Reuse the audio infrastructure from Harmony Trainer for
     chord playback
   - On each step: player selects a chord, hears it played back,
     confirms or changes their choice
   - On completion: reveal all chord names and transformations
   - Gate behind competency: only available when relevant aural
     identification skills are demonstrated (query skill-map.js)

2. Constraint Puzzles:
   - Load a puzzle with start chord, target chord, and one or
     more constraint rules
   - Constraints implemented as filter functions that validate
     each proposed move:
     - "no_P": filter out P transform moves
     - "only_L_R": only allow L and R transforms
     - "all_minor": every chord in the path must be minor
     - "exact_N_moves": path must be exactly N steps
   - Invalid moves are grayed out on the Tonnetz or gently
     blocked with a tooltip explaining the constraint
   - Multiple solutions acknowledged on completion

3. Puzzle menu/selector: organize puzzles by type and difficulty.
   Show which puzzle types are unlocked based on competency.
   Show completion status for each puzzle.

Do not commit — I will handle git myself.
```

### Task 10.6 — Competency integration and adaptive puzzle selection

```
Read static/shared/skill-map.js for the competency API.
Read static/puzzle-paths/puzzle-paths.js for the game state.
Read docs/puzzle-paths-spec.md for the difficulty progression.

Wire Puzzle Paths into the competency graph:

1. Puzzle type gating: use getSkillStatus to determine which
   puzzle types are available:
   - Pathfinding: always available (entry point)
   - Progression Tracing: available when identify_major_minor
     is demonstrated
   - Ear-Based: available when identify_interval_by_ear is
     demonstrated
   - Constraint: available when chain_transforms is demonstrated

2. Difficulty progression: within each puzzle type, use
   getNextChallengeDimension to suggest appropriate difficulty.
   Start with 2-chord puzzles in C, progress to longer
   progressions in less familiar keys.

3. Skill reporting: after each puzzle completion, call
   updateSkillFromGameEvent to report demonstrated skills:
   - Completed a compound move → "chain_transforms" evidence
   - Traced a blues turnaround → "recognize_blues_turnaround"
   - Completed an ear-based puzzle → relevant aural skill
   - Completed a constraint puzzle → relevant transform skill

4. Compound move animation speed: query competency for
   chain_transforms skill. If demonstrated, offer a "fast
   animation" or "skip animation" toggle. If emerging, use
   moderate speed. If undiscovered, use slow speed with
   prominent labels.

5. Cross-game suggestions: after completing certain puzzles,
   suggest related activities in other games. E.g., after
   tracing a blues turnaround: "Want to explore blues chords
   in Skratch Studio?" or "Test your ear for these intervals
   in Harmony Trainer."

Do not commit — I will handle git myself.
```

### Phase 10 Checkpoint
Puzzle Paths is a fully playable game with four puzzle types.
Players navigate the Tonnetz by selecting destination chords,
with compound moves animating through intermediate P/L/R steps.
The progression library provides real-world musical context.
Competency integration gates puzzle types and adapts difficulty.
**Test:** New player → starts with simple 2-chord pathfinding
puzzles → demonstrates skill → progression tracing unlocks →
trace a blues turnaround in C → see the animated compound moves
→ "Try in another key" → trace in G → "Explore in Skratch Studio"
→ opens pre-loaded progression. Verify ear-based puzzles are
locked until aural skills are demonstrated in Harmony Trainer.

---

## What's NOT in This Plan (Post-MVP)

- **Skratch Studio open-ended challenges** (§7b of architecture doc) — build after core path loop is proven
- **Skill guide topics** — write these after games have level systems that need them
- **Additional learning paths** beyond the initial 3
- **Additional Skratch Studio starters** for "Why Chords Work" and "Tonnetz & Transforms" paths
- **Mobile optimization** — responsive design pass after core features are stable
- **Additional visualizations** (Circle of Fifths Explorer, Scale Explorer, Chord Voicing Visualizer) — Phase 8 proves the pattern, then expand
- **Content batch generation** — write lens voice guides, then LLM-generate remaining depths
- **PWA / offline support**
- **Social features / teacher dashboards**
- **Puzzle Paths multiplayer/leaderboard** — fewest moves, fastest time
- **Procedurally generated puzzles** — algorithmic puzzle generation for pathfinding and constraint types
- **Competency graph expansion** — extend to all games beyond Harmony Trainer and Relative Key Trainer
- **Learn → scaffold → quiz flow pattern** — shared framework for consistent intro → practice → test progression across all games

---

## Quick Reference: Phase Dependencies

```
Phase 1 (Schema Migration) ✓
  └─→ Phase 2 (Profile & Onboarding, localStorage)
       ├─→ Phase 3 (Auth & Persistence) ←── independent
       ├─→ Phase 4 (Playful Lens Content) ←── independent
       └─→ Phase 5 (Intro Module: "Meet the Tonnetz") ←── independent
            └─→ Phase 6 (Starters, Paths, Hub) ←── needs 2, 4, 5
                 └─→ Phase 7 (Game Progression & Assessment)
                      └─→ Phase 8 (Tonnetz Grid Map)
                      └─→ Phase 9 (Competency Graph) ←── needs 2, 7
                           └─→ Phase 10 (Puzzle Paths) ←── needs 9, transforms.js
```

Phases 3, 4, and 5 are all independent of each other — they can be
built in any order or interleaved. They all require Phase 2.
Phase 6 requires Phases 2, 4, and 5. Phase 3 (Auth) is technically
independent of the content pipeline and can be done at any point
after Phase 2, but must be complete before production deployment.

Within Phase 6, Tasks 6.1-6.2 (starter system) and 6.3-6.4 (path
data) are independent and can overlap. Tasks 6.5-6.7 depend on
both being complete.

Phase 8 (Fog of War) and Phase 9 (Competency Graph) both depend on
Phase 7 but are independent of each other — they can be built in
either order or interleaved. Phase 10 (Puzzle Paths) depends on
Phase 9 and on the shared transforms.js/TonnetzNeighborhood
components from the Relative Key Trainer task sequence.