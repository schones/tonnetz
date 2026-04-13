# SongLab Content Architecture & Data Schema

**Version:** 0.2 (Post-review revision)
**Date:** 2026-03-13
**Purpose:** Define the content model, metadata schema, and organizational structure for the Tonnetz music theory education platform. This document serves as the spec for implementation (Claude Code) and as the basis for adversarial review (Gemini).
**Changes from v0.1:** Reclassified `harmonic_minor` and `modes` as building blocks. Renamed `perceptual_skill` → `skill_guide` with game-link enforcement. Removed `jazz_harmony` from MVP scope. Switched onboarding presets to intent-based naming. Added `producer` persona. Trimmed user profile to MVP scope. Resolved open questions (storage, assessment, Tonnetz nav). Added fog-of-war concept for Tonnetz grid.

---

## 1. Design Principles

1. **Games are the front door.** Most users discover theory backwards — they hit something confusing in a game and need an explanation. The education layer must support this "pull" model, not just "push" curricula.
2. **Metadata over hierarchy.** Content is organized by tags, prerequisites, and relationships — not by rigid tiers. This allows multiple views (paths, reference, contextual help) over the same content.
3. **Depths are lenses, not levels.** A topic viewed through the "playful" lens and the "math" lens are two perspectives on the same idea, not a dumbed-down vs. smart version.
4. **Scalable to 80+ topics** without requiring structural changes — adding a topic means filling out its metadata, not reorganizing the system.

---

## 2. Content Type Taxonomy

Every piece of content belongs to exactly one primary type. These types reflect *what kind of cognitive work the learner is doing*, not difficulty.

| Type | Description | Example Topics | Typical Depths |
|------|-------------|---------------|----------------|
| **building_block** | Sequential foundational knowledge. Must be learned before other things make sense. Has hard prerequisites. | `note_names`, `intervals`, `major_scale`, `triads`, `harmonic_minor`, `modes` | playful, musician, theorist |
| **skill_guide** | Declarative knowledge *about* a perceptual skill — mnemonics, listening strategies, practice tips. Always links to a primary game. Hub content bridges to game practice, never replaces it. | `interval_recognition`, `chord_quality_recognition`, `rhythm_feel`, `relative_pitch` | playful, musician |
| **framework** | Mental models that reorganize existing knowledge. "Aha moment" content. | `circle_of_fifths`, `diatonic_chords`, `tonnetz_geometry`, `neo_riemannian` | musician, theorist, math |
| **reference** | Looked up on demand, not learned linearly. | `key_signatures`, `time_signatures`, `chord_voicing_catalog`, `mode_catalog` | musician, theorist |

### Schema Enforcement Rules
- Every `skill_guide` topic **must** have at least one entry in `related_games` with `relevance: "primary"`. A skill guide without a game link is a dead end.
- Every `building_block` topic **must** have a `quick_summary`.
- `framework` and `reference` topics do not require game links (though they may have them).

### Resolved from v0.1 Review
- **50/50 classification splits:** If a topic introduces a pattern/definition needed by other topics, it's a `building_block` regardless of how conceptually rich it is. The "why" behind the pattern belongs in the `theorist` lens, not in the content type. This resolved `harmonic_minor` and `modes` (both reclassified as building blocks).
- **Perceptual skills in the hub:** Renamed to `skill_guide`. These topics live in the hub but contain declarative knowledge *about* skills (mnemonics, listening strategies), not the skill training itself. They always link to a primary game. A hub entry for "interval recognition" shows what to listen for and links to the Harmony Trainer — it doesn't try to train your ear through text.
- **`jazz_harmony`:** Removed from MVP scope. It's a domain, not a topic. Will be split into constituent topics (`extended_chords`, `tritone_substitution`, `ii_V_I_progression`, etc.) when the platform expands post-MVP.

---

## 3. Topic Schema

```javascript
// topic schema — one entry per topic in theory-content.js (or future data store)
{
  id: "intervals",                    // unique slug, used as key everywhere
  title: "Intervals",                 // human-readable display name
  subtitle: "The distance between two notes", // one-line description

  // --- Classification ---
  content_type: "building_block",     // building_block | skill_guide | framework | reference
  tags: ["pitch", "melody", "harmony"], // freeform, used for search/filtering
  difficulty: 2,                      // 1-5, derived from prerequisite chain depth

  // --- Prerequisite Graph ---
  prerequisites: ["note_names", "semitones_whole_tones"],  // hard prereqs (must know)
  soft_prerequisites: ["the_staff"],  // helpful but not required
  connections: ["triads", "chord_function", "circle_of_fifths"], // related topics (non-directional)

  // --- Content by Lens ---
  depths: {
    playful: {                        // kid-friendly, sound-and-color-first, minimal text
      available: true,
      summary: "An interval is the space between two notes — small space = close together, big space = far apart.",
      body: "...",                    // full content (markdown or structured)
      min_age: 6                      // content suitability hint
    },
    musician: {                       // practical, instrument-oriented
      available: true,
      summary: "An interval measures the distance between two pitches, named by counting scale degrees.",
      body: "..."
    },
    theorist: {                       // formal music theory language
      available: true,
      summary: "Intervals are classified by quality (major, minor, perfect, augmented, diminished) and size (2nd through octave).",
      body: "..."
    },
    math: {                           // frequency ratios, set theory, group theory
      available: false                // not every topic needs every lens
    }
  },

  // --- Quick Reference ---
  quick_summary: "The distance between two notes, measured in half steps or scale degrees.",  // 1-2 sentences, lens-neutral, for tooltips and time-constrained users
  mnemonic: "Minor 2nd = Jaws theme. Perfect 5th = Star Wars.",  // optional
  
  // --- Connections to Games & Visualizations ---
  related_games: [
    { game_id: "harmony_trainer", relevance: "primary" },   // this topic is core to the game
    { game_id: "melody_match",   relevance: "supporting" }  // this topic helps but isn't central
  ],
  related_visualizations: ["circle_of_fifths", "tonnetz_grid"],  // explorer IDs

  // --- Metadata ---
  estimated_read_time_minutes: {      // per lens, helps with session planning
    playful: 2,
    musician: 4,
    theorist: 6
  },
  
  // --- Creative Sandbox Hooks (for Skratch Studio) ---
  creative_prompts: [                 // optional, only for topics relevant to creation
    "Try playing two notes at the same time. Does it sound nice or crunchy?",
    "Can you make a melody that only uses big jumps?"
  ]
}
```

### Notes on the Schema
- **`difficulty` is computed, not authored.** It equals the longest prerequisite chain leading to this topic + 1. `note_names` (no prereqs) = 1. `neo_riemannian` (deep chain) = 5. This keeps difficulty consistent and auto-updating.
- **`quick_summary` is mandatory for every topic.** This is what the Tips pill shows. It must be lens-neutral and genuinely short.
- **`creative_prompts` are separate from depth content.** They're pedagogical scaffolding for Skratch Studio, not theory explanations. They can reference theory but are written in a directive/playful voice.
- **Not every lens needs a `body`.** Some topics only have 1-2 relevant lenses. `sound_basics` probably has `playful` and `musician` but not `math`. `hexatonic_cycles` has `theorist` and `math` but probably not `playful`.

---

## 4. Game Schema

```javascript
{
  id: "harmony_trainer",
  title: "Harmony Trainer",
  type: "recognition",               // recognition | creative
  
  description: "Identify intervals by ear using pitch detection.",
  
  // --- Theory Integration ---
  core_topics: ["intervals", "semitones_whole_tones"],   // topics this game directly trains
  supporting_topics: ["major_scale", "minor_scale"],      // topics that provide helpful context
  
  // --- Difficulty & Progression ---
  difficulty_range: [1, 3],           // maps to topic difficulty scale
  difficulty_levels: [                // game-internal progression
    { level: 1, label: "Perfect 5ths & Octaves", unlocked_by_default: true },
    { level: 2, label: "Major & Minor 3rds", unlocked_by_default: false },
    // ...
  ],
  
  // --- Session Design ---
  suggested_session_minutes: {
    beginner: 5,                      // keep it short for new/young users
    experienced: 15
  },
  
  // --- Onboarding ---
  intro_screen: {                     // shown on first visit or on demand
    what_youll_learn: "Train your ear to recognize the distance between two notes.",
    what_you_need_to_know: ["note_names"],  // prereq topics, linked
    how_to_play: "...",               // brief gameplay instructions
  }
}
```

### Recognition vs. Creative Games
- **Recognition games** (Harmony Trainer, Chord Spotter, Melody Match, Rhythm Lab, Relative Pitch, Strum Patterns): structured, quiz-based, with clear right/wrong answers. Education layer provides tooltips and hints. Progress is measurable (accuracy, speed).
- **Creative games** (Skratch Studio): open-ended, no wrong answers. Education layer provides creative prompts and challenges instead of corrections. Progress is harder to measure — track what features/concepts the user has engaged with rather than scores.

---

## 5. Visualization / Explorer Schema

```javascript
{
  id: "circle_of_fifths",
  title: "Circle of Fifths Explorer",
  type: "explorer",                   // explorer (interactive) | diagram (static illustration)
  
  description: "Interactive circle showing key relationships, relative minors, and chord families.",
  standalone: true,                   // can be used independently from the Theory Hub
  
  // --- Topic Connections ---
  primary_topics: ["circle_of_fifths", "key_signatures", "relative_minor_major"],
  secondary_topics: ["diatonic_chords", "modulation", "cadences"],
  
  // --- Interaction Modes ---
  guided_mode: true,                  // can walk user through a scripted exploration
  free_mode: true,                    // can be used as an open sandbox
  
  // --- Embeddable ---
  embed_contexts: ["theory_hub", "game_sidebar", "standalone_page"]
}
```

### Planned Visualizations
1. **Circle of Fifths Explorer** — key relationships, signatures, relative keys
2. **Tonnetz Grid** — note relationships, chord transforms, neo-Riemannian operations
3. **Scale Explorer** — visual/audible scale construction, mode comparison
4. **Voicing Explorer** — chord shapes on the Tonnetz, interval projection, drag-to-transpose, glow worm path visualization. Subsumes the originally planned "Chord Voicing Visualizer." See `voicing-explorer-spec.md` for full details.

---

## 6. Learning Paths

A path is a curated, ordered sequence of steps. Each step combines a topic with one or more of: a recognition game, a Skratch Studio starter, and a visualization. Skratch Studio serves as the creative sandbox throughout — every step that doesn't have a recognition game uses a Starter to make the concept hands-on.

### Path Step Schema

```javascript
{
  id: "foundations",
  title: "Music Foundations",
  description: "From zero to reading and hearing music — with Skratch Studio as your playground.",
  target_personas: ["beginner", "dabbler"],
  default_lens: "playful",
  estimated_total_minutes: 120,

  steps: [
    // --- Step 0: Meet Skratch Studio ---
    {
      topic_id: null,                         // no theory topic — this is pure onboarding
      game_id: "skratch_studio",
      starter_id: "starter_free_play",        // everything unlocked, no constraints
      visualization_id: null,
      prompt: "This is your music playground. Poke around. Make some noise. Nothing can break."
    },

    // --- Step 1: What is Sound? ---
    {
      topic_id: "sound_basics",
      game_id: "skratch_studio",
      starter_id: "starter_sound_frequency",  // single oscillator + frequency slider
      visualization_id: null,
      prompt: "Drag the slider. What happens to the sound when you go up? Down?"
    },

    // --- Step 2: Rhythm ---
    {
      topic_id: "rhythm",
      game_id: "rhythm_lab",                  // recognition game first
      starter_id: "starter_rhythm_grid",      // then: drums only, loop grid
      visualization_id: null,
      prompt: "Feel the beat first, then build your own pattern."
    },

    // --- Step 3: Note Names ---
    {
      topic_id: "note_names",
      game_id: "skratch_studio",
      starter_id: "starter_note_names",       // piano, 1 octave, keys labeled
      visualization_id: "scale_explorer",
      prompt: "Play every white key from left to right. You just played C-D-E-F-G-A-B."
    },

    // --- Step 4: Tempo ---
    {
      topic_id: "tempo",
      game_id: "skratch_studio",
      starter_id: "starter_tempo_slider",     // drum loop from Step 2, BPM slider added
      visualization_id: null,
      prompt: "Same pattern, but now you control the speed. Slow it way down. Speed it way up."
    },

    // --- Step 5: Dynamics ---
    {
      topic_id: "dynamics",
      game_id: "skratch_studio",
      starter_id: "starter_dynamics_loud_soft", // pre-built melody, volume envelope available
      visualization_id: null,
      prompt: "This melody sounds flat and boring. Can you make it start quiet and get LOUD?"
    },

    // --- Step 6: Octave ---
    {
      topic_id: "octave",
      game_id: "skratch_studio",
      starter_id: "starter_octave_jump",      // piano, 2 octaves, C notes highlighted
      visualization_id: "scale_explorer",
      prompt: "Play this C. Now play THIS C. Same note, different height. That's an octave."
    },

    // --- Step 7: Semitones & Whole Tones ---
    {
      topic_id: "semitones_whole_tones",
      game_id: "skratch_studio",
      starter_id: "starter_half_whole_steps",  // piano zoomed C-E, steps color-coded
      visualization_id: null,
      prompt: "Play two keys right next to each other — that tiny step is a semitone. Skip one — that's a whole tone."
    },

    // --- Step 8: Intervals ---
    {
      topic_id: "intervals",
      game_id: "harmony_trainer",             // recognition game first
      starter_id: "starter_interval_builder", // piano, drag notes apart, interval name shown live
      visualization_id: "tonnetz_grid",
      prompt: "Train your ear first, then build your own intervals and watch them change."
    },

    // --- Step 9: Major Scale ---
    {
      topic_id: "major_scale",
      game_id: "skratch_studio",
      starter_id: "starter_major_scale",      // piano, only white keys active (C major), W/H pattern shown
      visualization_id: "scale_explorer",
      prompt: "Play these keys in order. Hear 'Do Re Mi'? That pattern of whole and half steps is a major scale."
    },

    // --- Step 10: Minor Scale ---
    {
      topic_id: "minor_scale",
      game_id: "skratch_studio",
      starter_id: "starter_minor_scale",      // piano, A minor (white keys starting on A)
      visualization_id: "scale_explorer",
      prompt: "Same keys, different starting point. Hear how it sounds darker? That's a minor scale."
    },

    // --- Step 11: Triads ---
    {
      topic_id: "triads",
      game_id: "chord_spotter",               // recognition game first
      starter_id: "starter_triad_builder",    // piano with chord-building: pick root, see triad build
      visualization_id: "chord_voicing_visualizer",
      prompt: "Hear some chords first, then build your own. Stack every other note — that's a triad."
    }
  ]
}
```

### Step Design Principles
- **Every step is interactive.** No step is "just read this." Either a recognition game, a Skratch Studio starter, or both.
- **Games come before starters when both exist.** Train your ear (structured) → then create with the concept (open-ended). The game gives confidence; the starter gives ownership.
- **Starters get progressively richer.** Step 1 has one block and a slider. Step 11 has chord-building tools. This mirrors the learner's growing vocabulary.
- **Starters can reference earlier starters.** Step 4 (tempo) reloads the drum loop from Step 2 (rhythm) with a BPM slider added, reinforcing continuity.
- **Steps that use Skratch Studio set `game_id: "skratch_studio"` and `starter_id` to the specific config.** Steps that use only a recognition game set `starter_id: null` (or include a starter as an optional follow-up).

### Onboarding Presets → Path Mapping

Preset IDs are intent-based, not demographic. User-facing labels are friendly and descriptive.

| Preset | Label (shown to user) | Default Lens | Recommended Paths | Starting Games |
|--------|-----------------------|-------------|-------------------|----------------|
| `beginner` | "I'm brand new to music" | playful | Music Foundations | Skratch Studio, Rhythm Lab |
| `dabbler` | "I play an instrument a little" | playful / musician | Music Foundations (skip Steps 0-1), Ear Training Basics | Melody Match, Harmony Trainer (easy) |
| `curious_player` | "I play but want to understand theory" | musician | Why Chords Work, Ear Training Deep Dive | Chord Spotter, Harmony Trainer |
| `producer` | "I make beats but don't know theory" | musician | Why Chords Work, Rhythm & Groove | Skratch Studio, Rhythm Lab, Chord Spotter |
| `deep_diver` | "I know theory, show me the deep stuff" | theorist | Advanced Harmony, Tonnetz & Transforms | All unlocked |
| `math_explorer` | "I'm here for the math" | math | Math of Music, Tonnetz & Transforms | Tonnetz Grid explorer |

### Tuning Beyond Presets
After selecting a preset, users can:
- Toggle individual lenses on/off (e.g., "show me the math too")
- Mark topics as "already known" to skip them in paths
- Adjust default game difficulty
- These preferences are stored in the user profile (see §8)

---

## 7. Skratch Studio Content Layer

Skratch Studio gets its own content approach because it's creative, not quiz-based. It serves two roles:

1. **Sandbox for learning paths** — via Starters that constrain and pre-configure the environment to focus on one concept.
2. **Open-ended creative tool** — via Challenges that prompt exploration without constraints.

### 7a. Starters (Path-Integrated Sandbox Mode)

A Starter is a preconfigured Skratch Studio state designed to teach a specific concept. It constrains what's available so the learner focuses on one idea at a time. Starters are referenced from Learning Path steps (§6).

```javascript
{
  id: "starter_dynamics_loud_soft",
  topic_id: "dynamics",
  title: "Loud and Soft",

  // --- Pre-configured state ---
  preload: {
    instruments: ["drums"],           // which instruments are available
    blocks: [                         // blocks pre-placed on canvas
      { type: "drum_loop", config: { pattern: "basic_4bar", bpm: 100 } }
    ],
    available_blocks: ["volume_envelope"],  // blocks the user can add
    locked_features: ["melody", "bass", "loop_pedal"],  // hidden/disabled
    piano_config: null,               // or { octaves: 2, start_note: "C4", highlighted_keys: ["C4", "E4", "G4"] }
    bpm: 100,
    key: null                         // or "C_major" to constrain available notes
  },

  // --- The lesson ---
  prompt: "This drum loop sounds the same the whole way through. Can you make it start soft and end LOUD?",
  hints: [                            // shown progressively if user seems stuck
    "Look for the volume block — drag it onto your loop.",
    "Try setting the start volume low and the end volume high."
  ],

  // --- After they've explored ---
  debrief: "You just used dynamics — that's how musicians control volume to make music feel alive.",
  theory_link: "dynamics",            // "Want to learn more?" → Theory Hub

  // --- Optional: bridge to a recognition game ---
  bridge_to_game: null                // or { game_id: "...", prompt: "Now try hearing it..." }
}
```

### Engineering Requirement: Starter Loading System
Skratch Studio currently supports keyboard starter packs but not full preconfigured states with block pre-loading and feature locking. The Starter system requires:
1. **Config ingestion** — Skratch Studio accepts a starter config object (from URL param, postMessage, or JS API) that sets instruments, blocks, constraints.
2. **Feature locking** — ability to hide/disable instruments and block categories not relevant to the current lesson.
3. **Block pre-placement** — load blocks onto the canvas programmatically.
4. **State reset** — "Reset to starter" button that restores the original config (distinct from "Clear All").

This is a prerequisite for the Learning Paths that use Skratch Studio (Phase 4 of the build plan).

### 7b. Challenges (Open-Ended Creative Prompts)

Challenges are standalone creative prompts, not tied to a specific path step. They can appear as suggestions within Skratch Studio or in the Theory Hub.

```javascript
{
  id: "challenge_big_jumps",
  title: "Leap of Faith",
  related_topics: ["intervals"],
  difficulty: 1,
  type: "exploration",               // exploration | constraint | imitation
  
  prompt: "Can you make a melody that only uses BIG jumps between notes? Try skipping over at least 3 keys each time.",
  
  success_hint: "Those big jumps are called 'leaps' — musicians use them to make melodies feel dramatic or surprising.",
  
  theory_link: "intervals",          // "Want to know more?" links to this topic
  
  unlocks_after: null                // or a previous challenge ID for sequencing
}
```

### Challenge Types
- **Exploration**: "Try this and see what happens" (no right answer)
- **Constraint**: "Make something using ONLY these notes/rhythms" (creative within rules)
- **Imitation**: "Listen to this pattern and make something similar" (bridges to recognition skills)

---

## 8. User Profile & Progress Tracking

### MVP Storage: localStorage
Zero-friction start — no auth, no account creation. Users play immediately. The profile schema is designed as a clean JSON object so it can later be migrated to a backend (Postgres, Supabase, etc.) without restructuring — the migration is just "change where you read/write."

```javascript
{
  user_id: "...",                     // generated UUID, stored in localStorage

  // --- Onboarding ---
  persona_preset: "curious_player",   // selected during onboarding
  active_lens: "musician",            // current default depth
  additional_lenses: ["theorist"],    // also show these when available

  // --- Topic Progress ---
  topics: {
    "intervals": {
      status: "learned",              // unseen | visited | learning | learned
      seen_via: "harmony_trainer",    // first encounter context (game, path, hub, tooltip) — enables smarter Tips pill cross-references
      first_seen: "2026-03-10T...",
      last_seen: "2026-03-13T..."
    },
    // ...
  },

  // --- Game Progress ---
  games: {
    "harmony_trainer": {
      current_level: 3,
      high_score: 85,                 // single best score, not history
      last_played: "2026-03-13T..."
    },
    // ...
  },

  // --- Path Progress ---
  paths: {
    "foundations": {
      current_step: 4,
      completed_steps: [0, 1, 2, 3],
      started: "2026-03-10T..."
    }
  },

  // --- Skratch Studio ---
  skratch: {
    challenges_completed: ["challenge_big_jumps"],
    features_used: ["drums", "bass", "melody", "loop_pedal"],
    creations_saved: 3
  },

  // --- Preferences ---
  preferences: {
    show_tooltips: true,
    tooltip_frequency: "sometimes",   // always | sometimes | only_when_stuck
    session_length_preference: "short" // short (<5 min) | medium (5-15) | long (15+)
  }
}
```

### What Was Cut from v0.1 (Revisit Post-MVP)
- `accuracy_history` arrays → replaced with single `high_score` to avoid document bloat
- `lenses_viewed` per topic → low ROI for MVP
- `sessions` count and `total_minutes` per game → nice analytics, not needed for core UX
- Multi-device sync, auth → deferred until retention proves value

### Progress Visualization on the Tonnetz Grid
The Tonnetz grid is a natural progress map: each node is a note, each region represents a harmonic concept. As users learn topics and complete game levels, regions of the grid "light up" or become interactive. This turns the grid into both a learning tool and a progress dashboard — you can see what you know and what's adjacent to explore next.

**Fog of War (MVP approach):** The grid starts with only foundational nodes illuminated (e.g., the C major scale region). All other regions are dimmed/"undiscovered." As prerequisite topics and game levels are completed, adjacent regions reveal themselves. This creates a natural "what should I learn next?" signal — it's whatever's at the edge of what's already lit up.

**Navigation integration:** The Tonnetz grid serves as the primary progress/navigation surface for returning users. New users go through the onboarding preset flow first, then see their grid with initial regions illuminated based on their preset. Clicking an illuminated node opens the relevant topic, game, or path step. Hovering a dimmed-but-adjacent node shows a preview: "Learn about triads → (requires: intervals, major_scale)".

**Coexists with traditional nav:** The grid is the "home" view, but a conventional menu/sidebar remains available for direct access to games, the Theory Hub, and paths. Not every user will connect with spatial navigation, and accessibility requires a text-based alternative.

---

## 9. Content Relationships Graph

```
                    ┌──────────────┐
                    │  TOPIC       │
                    │  (34 → 80+)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     prerequisites    connections    depths/lenses
     (directional)   (bidirectional) (1-4 per topic)
              │            │            │
              ▼            ▼            ▼
        other topics  other topics   content bodies
                                    (playful, musician,
                                     theorist, math)
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌────────┐      ┌──────────────┐
│ GAME   │◄────►│ VISUALIZATION│
│ (7+)   │      │ / EXPLORER   │
└────────┘      │ (4+)         │
    │           └──────────────┘
    │                   │
    ▼                   ▼
game-specific      guided tours,
difficulty         free exploration,
levels,            embed in hub
intro screens      or standalone

    ┌───────────────────────┐
    │     LEARNING PATH     │
    │  (ordered sequence    │
    │   of topic + game +   │
    │   visualization steps)│
    └───────────┬───────────┘
                │
                ▼
          maps to onboarding
          persona presets
```

---

## 10. Migration Plan from Current Structure

The current `theory-content.js` uses a flat tier system (beginner/intermediate/advanced) with 3 depths (musician/theorist/math) per topic. Here's how to migrate:

### What Stays
- Topic IDs (slugs) — no renaming needed
- Prerequisite graph — already defined and correct
- Depth content (musician/theorist/math) — reused as lenses
- Tags and connections — already defined

### What Changes
- **Add `content_type`** to each topic (building_block, skill_guide, framework, reference)
- **Add `playful` lens** where appropriate (primarily beginner building_block topics)
- **Add `quick_summary`** to every topic (mandatory, 1-2 sentences)
- **Add `creative_prompts`** to topics relevant to Skratch Studio
- **Add `related_games`** with relevance level (primary/supporting)
- **Add `related_visualizations`**
- **Replace tier field** with computed `difficulty` (chain depth)
- **Add `estimated_read_time_minutes`** per lens

### What's New
- Learning path definitions (new data structure)
- Onboarding preset → path mapping
- User profile schema (new, requires backend/storage decision)
- Skratch Studio challenge definitions (new content type)
- Game schema metadata (intro screens, difficulty levels)

### Migration Order
1. Add `content_type` and `quick_summary` to all 34 topics (required foundation)
2. Add `related_games` mappings (enables bidirectional game↔topic links)
3. Define 2-3 initial learning paths (enough to test the cold start flow)
4. Add `playful` lens to 8-10 beginner topics (enough to serve young users)
5. Build onboarding preset selector UI
6. Add user profile / progress tracking (localStorage for MVP — see §8)
7. Build Skratch Studio challenge system
8. Add remaining lenses, paths, and visualizations iteratively

---

## 11. Open Questions & Resolutions

### Resolved

1. **Storage (was Q1):** localStorage for MVP. Zero auth friction, instant play. Schema is designed as serializable JSON for future migration to Postgres/Supabase without restructuring. Railway filesystem writes (current `scores.json`) are an anti-pattern for PaaS deploys — localStorage replaces this.

2. **Perceptual skills in the hub (was Q4):** Renamed to `skill_guide`. These topics contain declarative knowledge *about* skills (mnemonics, what to listen for) and always link to a primary game. They don't try to train skills through text.

3. **Tonnetz grid as navigation (was Q3):** Yes, it's the primary progress/navigation surface for returning users, with a fog-of-war model (see §8). Coexists with traditional menu nav for accessibility and direct access.

4. **Assessment (was Q7):** Hybrid approach. Game level completions auto-trigger topic status changes for associated `building_block` and `skill_guide` topics. `framework` and `reference` topics get a manual "Mark as Understood" toggle in the Theory Hub. Four-state model: unseen → visited → learning → learned.

### Still Open

1. **Content authoring pipeline:** With 50-80 topics × 2-4 lenses each, that's 100-320 content bodies. LLM-assisted drafting with human review is likely necessary. The schema should define exact tone/voice constraints per lens to make generation reliable. **Action needed:** Write lens voice guides (playful, musician, theorist, math) before batch-generating content.

2. **Multiplayer / social:** Not in scope now, but does the schema need any hooks for future social features (shared progress, challenges between users, teacher dashboards)? **Current stance:** No hooks yet. The user profile schema is simple enough to extend later. Teacher dashboards would require auth, which is a post-MVP concern.

3. **Offline / PWA:** If this needs to work offline eventually (especially for mobile), the content architecture needs to support pre-caching. **Current stance:** The content is all static JSON/markdown — naturally cacheable. No blockers identified, but no PWA work planned for MVP.

---

## 12. Appendix: Current Topic → Content Type Classification

Draft classification of all 33 existing topics (34 minus `jazz_harmony`, deferred from MVP). **`harmonic_minor` and `modes` reclassified as building blocks per v0.2 review.**

### Building Blocks
- `sound_basics` — What is sound, frequency, amplitude
- `note_names` — Letter names, sharps/flats, enharmonics
- `the_staff` — Lines, spaces, clefs
- `rhythm` — Beat, subdivision, note durations
- `tempo` — BPM, tempo markings
- `dynamics` — Volume markings (pp to ff)
- `major_scale` — Whole/half step pattern, construction
- `minor_scale` — Natural minor, relationship to major
- `triads` — Major/minor/dim/aug triad construction
- `intervals` — Distance between pitches, quality and size
- `semitones_whole_tones` — Half steps, whole steps as building units
- `octave` — Octave equivalence, register
- `ledger_lines` — Extending the staff
- `seventh_chords` — Adding the 7th to triads
- `chromatic_scale` — All 12 notes, no hierarchy
- `harmonic_minor` — Raised 7th scale pattern (why it exists = theorist lens)
- `modes` — Dorian, Phrygian, etc. scale patterns (modes-as-rotations = theorist lens)

### Skill Guides
- (Not yet broken out as standalone topics — currently implicit in games.)
- **Candidates to add:** `interval_recognition`, `chord_quality_recognition`, `rhythm_feel`, `relative_pitch_training`, `melodic_dictation`
- **Rule:** Every skill_guide must link to a primary game.

### Frameworks
- `circle_of_fifths` — Key relationships, navigation
- `diatonic_chords` — Chords built from scale degrees
- `chord_function` — Tonic, subdominant, dominant roles
- `relative_minor_major` — Parallel key relationships
- `cadences` — Harmonic punctuation (authentic, plagal, etc.)
- `modal_interchange` — Borrowing chords from parallel modes
- `modulation` — Changing keys within a piece
- `voice_leading` — How individual notes move between chords
- `tonnetz_geometry` — The grid structure, axes, note layout
- `tonnetz_transforms` — P, L, R operations on the grid
- `neo_riemannian` — Formal theory of triadic transformations
- `hexatonic_cycles` — Six-chord cycles on the Tonnetz
- `borrowed_chords` — Using chords from parallel keys
- `secondary_dominants` — V/x chords, tonicization

### Reference
- `key_signatures` — Which sharps/flats for each key
- `time_signatures` — Meter notation, simple vs. compound

### Deferred from MVP
- `jazz_harmony` — Too broad; will be split into `extended_chords` (building_block), `tritone_substitution` (framework), `ii_V_I_progression` (framework), and potentially others when the platform expands.

### Classification Notes
- `harmonic_minor` reclassified from framework → building_block. It introduces a scale pattern that other topics depend on. The functional explanation ("why the raised 7th?") is the theorist *lens*, not a reason to change the content type.
- `modes` reclassified from framework → building_block. Same logic — the scale patterns are foundational; "modes as rotations" is a framework *lens* on building_block content.
- `cadences` stays as framework — it doesn't introduce new notes/patterns, it explains how existing chords function at phrase boundaries.
