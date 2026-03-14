# Tonnetz Content Architecture — Build Plan

**Based on:** Content Architecture & Data Schema v0.2 (2026-03-13)
**Branch:** `education-layer` (merges to `main` for Railway deploy)
**Workflow:** Plan in claude.ai → Build with Claude Code (Antigravity) → Gemini for review → Dustin manages git
**Repo:** `schones/tonnetz`

---

## How to Read This Plan

Each **Phase** is a coherent chunk of work that ships something independently useful.
Each **Task** within a phase is scoped to one Claude Code session.
Tasks include a ready-to-paste Claude Code prompt (in fenced blocks).
Every prompt follows Dustin's conventions: starts with read-and-verify, ends with "Do not commit."

**Estimated total:** 6 phases, ~25-30 Claude Code sessions, buildable over 6-10 weeks depending on pace. Phase 4 (Skratch Studio starters + paths + hub) is the largest phase.

---

## Phase 1: Schema Migration (Foundation)
**Goal:** Migrate `theory-content.js` from the flat tier system to the v0.2 content type taxonomy. No UI changes yet — this is pure data work.
**Why first:** Every subsequent phase depends on this metadata being in place.
**Ships:** Nothing user-visible. Internal data upgrade.

### Task 1.1 — Add content_type and quick_summary to all topics

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

Do not change any existing fields (prerequisites, connections, tags,
depths, etc.) — only add content_type, quick_summary, and remove tier.

Verify your changes by logging the count of topics per content_type
to confirm: 17 building_block, 14 framework, 2 reference, 0 skill_guide.

Do not commit — I will handle git myself.
```

### Task 1.2 — Add computed difficulty and related_games

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

### Task 1.3 — Add related_visualizations and creative_prompts

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

### Phase 1 Checkpoint
At this point, `theory-content.js` has the full v0.2 topic schema:
id, title, subtitle, content_type, tags, difficulty, prerequisites,
soft_prerequisites, connections, depths (musician/theorist/math),
quick_summary, related_games, related_visualizations, creative_prompts.

Still missing from full schema: playful lens, estimated_read_time_minutes,
mnemonic (these come later in Phase 3).

**Test:** `python3 app.py` → verify the existing tooltip engine and Tips pill
still work with the updated data structure. No regressions.

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

## Phase 3: Playful Lens & Content Expansion
**Goal:** Add the kid-friendly "playful" lens to beginner topics so the `beginner` and `dabbler` presets actually have age-appropriate content.
**Why third:** The onboarding flow promises a playful experience for beginners, so the content needs to exist.
**Ships:** Playful depth content for ~10-12 core building_block topics.

### Task 3.1 — Write playful lens content (LLM-assisted)

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

Review and edit the drafts yourself before proceeding to 3.2.

### Task 3.2 — Add playful lens to theory-content.js

```
Read static/shared/theory-content.js to see the current depths structure.

I will provide you with playful lens content for the following topics
as a JSON object. For each topic, add a "playful" key to the depths
object with { available: true, summary: "...", body: "..." }.

[Paste the reviewed content from Task 3.1 here]

For topics NOT in this list, add: playful: { available: false }
to their depths object (if not already present) so the schema is
consistent.

Verify: count topics where playful.available === true. Should be 12.

Do not commit — I will handle git myself.
```

---

## Phase 4: Skratch Studio Starters, Learning Paths & Theory Hub
**Goal:** Build the Skratch Studio starter loading system, the path system, and a basic Theory Hub page.
**Why fourth:** With profiles, content types, and playful lenses in place, we need the path infrastructure to deliver guided learning. The Foundations path depends on Skratch Studio starters, so that engineering comes first.
**Ships:** Skratch Studio lesson mode, Theory Hub page, 3 learning paths with full interactivity.

### Task 4.1 — Skratch Studio starter loading system

```
Read the Skratch Studio code to understand the current architecture.
Start from the project root, then read templates/skratch-studio.html
and all JS files in static/skratch-studio/ (especially studio.js,
blocks.js, music-engine.js, and sandbox.js).

Also read docs/content-architecture.md, specifically §7a (Starters)
for the schema and requirements.

Build a starter loading system for Skratch Studio that allows it
to accept a preconfigured state. Requirements:

1. Config ingestion: Skratch Studio accepts a starter config via
   URL parameter (e.g., ?starter=starter_rhythm_grid) that loads
   a JSON config from a starters data file.

2. Feature locking: ability to hide/disable instruments and block
   categories listed in the config's locked_features array.

3. Block pre-placement: load blocks listed in the config's blocks
   array onto the Blockly canvas programmatically on startup.

4. Piano config: if the starter has piano_config, configure the
   piano to show only the specified octave range and highlight
   the specified keys.

5. Starter UI elements:
   - Show the starter's prompt text in a banner at the top.
   - Show hints progressively (one at a time) via a "Need a hint?"
     button.
   - Show the debrief text when the user clicks "I'm done" or
     after a reasonable time.
   - A "Reset to starter" button that restores the original
     preconfigured state (distinct from "Clear All").

6. If no ?starter= param is present, Skratch Studio loads
   normally with no constraints (backward compatible).

Create a new file static/skratch-studio/skratch-starters.js that holds the
starter config data. For now, include just two starter configs
as proof of concept:

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

### Task 4.2 — Build all Foundations path starters

```
Read static/skratch-studio/skratch-starters.js and docs/content-architecture.md
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
the loading system built in Task 4.1. If a starter requires
functionality that doesn't exist yet (like the interval name
display), implement a simplified version and leave a TODO comment.

Test each starter loads correctly via URL parameter.

Do not commit — I will handle git myself.
```

### Task 4.3 — Design remaining paths (claude.ai)

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

### Task 4.4 — Learning paths data file

```
Read the project structure and static/shared/theory-content.js.
Read docs/content-architecture.md §6 for the full Foundations path.

Create a new file: static/shared/learning-paths.js

This file exports (or exposes on window) an array of learning path
objects. Include all 3 paths:

[Paste the Foundations path from the architecture doc,
plus the 2 paths designed in Task 4.3]

Also create a helper function getPathsForPreset(preset) that
returns all paths whose target_personas array includes the given
preset string.

Do not commit — I will handle git myself.
```

### Task 4.5 — Theory Hub page

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

### Task 4.6 — Path runner UI

```
Read static/shared/learning-paths.js, static/shared/user-profile.js,
and the Theory Hub template from Task 4.5.

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

### Task 4.7 — Bidirectional game ↔ topic links

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

### Phase 4 Checkpoint
Users can browse all topics in the Theory Hub, follow the Music
Foundations path with Skratch Studio starters at every step,
and navigate between games and theory content.
**Test:** Start the Foundations path as a beginner. Step 0 opens
Skratch Studio in free play mode. Step 2 opens Rhythm Lab, then
the rhythm starter in Skratch Studio. Step 8 opens Harmony Trainer,
then the interval builder starter. Verify path progress saves and
the hub shows progress bars updating.

---

## Phase 5: Game Progression & Assessment
**Goal:** Add difficulty levels to games, auto-assessment for topic status, and game intro screens.
**Why fifth:** With paths and profiles in place, we can now close the loop — game performance feeds back into topic progress.
**Ships:** Game intro screens, level progression, auto-marking topics.

### Task 5.1 — Game intro screens

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

### Task 5.2 — Game level system and auto-assessment

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

### Task 5.3 — Replicate level system for remaining games

Repeat the pattern from 5.2 for: chord_spotter, melody_match,
rhythm_lab, relative_pitch, strum_patterns. Each session handles
1-2 games depending on complexity.

---

## Phase 6: Tonnetz Grid Progress Map (Fog of War)
**Goal:** Transform the Tonnetz grid visualization into a spatial progress map with fog-of-war discovery.
**Why last:** This is the most complex and most visually impressive feature. It depends on all previous phases — profile, progress tracking, topic relationships, and game levels all feed into it.
**Ships:** Interactive Tonnetz grid homepage showing progress, discoverable regions, and navigation to topics/games.

### Task 6.1 — Design the grid-to-topic mapping

Use claude.ai to design how topics and concepts map to regions of
the Tonnetz grid. This is a design task:
- Which nodes/regions correspond to which topics?
- What's the "C major starting area" that beginners see?
- How do framework topics (which aren't single notes) map to
  regions vs. connections between regions?
- What visual states exist? (hidden, dimmed, discovered, learning, mastered)

### Task 6.2 — Build the interactive progress grid

```
[Prompt will depend on design decisions from 6.1.
This is likely 2-3 Claude Code sessions for the visualization,
interactivity, and profile integration.]
```

### Task 6.3 — Integrate as homepage for returning users

```
[Update index.html to show the Tonnetz grid as the primary
navigation surface for users with a profile. New users still
see the onboarding flow. Add traditional nav fallback.]
```

---

## What's NOT in This Plan (Post-MVP)

- **Skratch Studio open-ended challenges** (§7b of architecture doc) — build after core path loop is proven
- **Skill guide topics** — write these after games have level systems that need them
- **Additional learning paths** beyond the initial 3
- **Additional Skratch Studio starters** for "Why Chords Work" and "Tonnetz & Transforms" paths
- **Backend migration** (localStorage → Postgres/Supabase) — when multi-device or auth is needed
- **Mobile optimization** — responsive design pass after core features are stable
- **Additional visualizations** (Circle of Fifths Explorer, Scale Explorer, Chord Voicing Visualizer) — Phase 6 proves the pattern, then expand
- **Content batch generation** — write lens voice guides, then LLM-generate remaining depths
- **PWA / offline support**
- **Social features / teacher dashboards**

---

## Quick Reference: Phase Dependencies

```
Phase 1 (Schema Migration) ✓
  └─→ Phase 2 (Profile & Onboarding)
       ├─→ Phase 3 (Playful Lens Content)
       └─→ Phase 4 (Starters, Paths & Hub)
            │  ├─ 4.1-4.2: Skratch Studio starter system
            │  ├─ 4.3-4.4: Path data (can overlap with 4.1-4.2)
            │  ├─ 4.5-4.6: Theory Hub + path runner
            │  └─ 4.7: Bidirectional links
            └─→ Phase 5 (Game Progression & Assessment)
                 └─→ Phase 6 (Tonnetz Grid Map)
```

Within Phase 4, Tasks 4.1-4.2 (starter system) and 4.3-4.4 (path
data) are independent and can overlap. Tasks 4.5-4.7 depend on
both being complete. The Theory Hub (4.5) can be built and tested
with path data alone — starters add interactivity but the hub
works without them (steps just link to regular Skratch Studio).
