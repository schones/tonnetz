# Tonnetz Platform — Post-MVP Build Plan (v3)

**Date:** 2026-03-26  
**Status:** Active roadmap  
**Context:** Phase 5 (Intro Module) nearing completion. MVP scope (intro, Chord Walks, Harmony Trainer, Skratch Studio, Explorer, backend proxy, polish) is the baseline. This document scopes what comes next.

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

### Phase A: Intro Module Completion + Missing Concepts

**Goal:** Fill the conceptual gaps so the intro module and Theory Hub cover the essential vocabulary a learner needs before games make sense.  
**Depends on:** Phase 5 (intro module) being done.  
**Sessions:** 4–6

**A1. Circle of Fifths interactive module**  
Already specced and partially prototyped (see circle-of-fifths.js work from Phase 1A). SVG with 12 keys in fifths order, inner ring for relative minors. Click a key → highlight diatonic chords, show relative minor, play scale. Wire to tooltip engine. Lives in Theory Hub as a featured visualization and is linkable from intro module.

**A2. Tonal centers & keys**  
Short interactive lesson: "A key is a home base." Play a progression, identify the tonic. Show how all other notes/chords relate to it. Connect to circle of fifths: keys that are neighbors share almost all their notes.

**A3. Modes overview**  
Not a deep dive — just enough to say "the major scale has 7 starting points, each with a different flavor." Interactive: pick a mode, hear it, see it on the keyboard, see the brightness ordering (Lydian → Locrian). Can live as a tab within the Scale Explorer or as a standalone Theory Hub entry.

**A4. Chord progressions & common patterns**  
Interactive chord progression player: select a key, see/hear I-IV-V-I, I-V-vi-IV, ii-V-I, etc. Roman numeral overlay on Tonnetz showing chord function. "Songs that use this" references from the Song Examples Database (see cross-cutting section below).

---

### Phase B: New Games — Expanding the Game Library

**Goal:** More lightweight, fun games that teach fundamentals and give the curriculum something to link to. Prioritize games that are quick to build because they reuse existing components.  
**Sessions:** 6–10

**B1. Scale Builder** ⭐ (high priority)  
Core mechanic: Given a root note, build a major or minor scale by selecting the correct notes on a keyboard or Tonnetz view. Progression: major scales → natural minor → harmonic minor → melodic minor → modes. Bonus round: build a melody using only the scale you just constructed, played over the root chord. Reuses: KeyboardView, TonnetzNeighborhood, Tone.js, HarmonyState.

**B2. Note Name Trainer**  
Flash-card style: show a note on a staff (or keyboard), name it. Or: hear a note, name it. Timed mode for gamification. Streak tracking. Simple but fills a gap — many beginners don't know note names fluently.

**B3. Interval Spotter (enhanced)**  
The Harmony Trainer already does interval recognition. This is a focused, simplified version: just intervals, no chords. "Name That Interval" — hear two notes, identify the interval. Visual: show the interval on the Tonnetz as a distance/direction. Reference songs for each interval from the Song Examples Database.

**B4. Chord Progression Builder**  
Drag-and-drop Roman numerals to build a 4- or 8-bar progression. Hear it play back. See it on the Tonnetz as a path. Preset progressions to explore from the Song Examples Database ("try the 50s progression: I-vi-IV-V"). This bridges theory knowledge and creative application.

**B5. Rhythm Tapper**  
Simplified rhythm game: hear a beat pattern, tap it back. Evaluates timing accuracy. Starts with quarter notes, adds eighth notes, syncopation, rests. The existing Rhythm Lab has potential but may need a rethink for this simpler mechanic.

**B6. Melody Dictation (enhanced Melody Match)**  
Hear a short melody, notate it (select notes on a staff or keyboard in order). Starts with 3 notes stepwise, progresses to longer melodies with leaps. Different from singing-based Melody Match — this is about ear-to-notation translation.

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
- **Music Foundations** (beginner path): ~11 steps from "what is sound" through scales and triads. Default lens: playful. Links heavily to Scale Builder, Note Name Trainer, and Skratch Studio starters.
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
More visual, less text. Bigger buttons, friendlier language, more celebration on success. "Playful lens" is the default everywhere — refine it now that the intro module has established the tone. Scaffolded freedom: in Skratch Studio, beginners get curated starters with guardrails (limited note range, pre-set instruments). As they progress, more blocks/options unlock. Achievement system: simple badges for milestones ("Built your first scale!", "Completed the intro!", "10-day streak!").

**D2. Music student mode**  
The learn → practice → test framework is the default here. Each topic has: a Theory Hub explanation (musician lens) → a practice game → a test/assessment in the same game or Skratch Studio. Progress tracking shows skill gaps: "Strong on intervals, needs work on chord inversions."

**D3. Experienced musician / theory nerd mode**  
Skip intros by default. Deep-dive content available immediately. Tonnetz & Transforms path is surfaced. Advanced games and tools: Puzzle Paths, Chord Walks at Tier 3-4, advanced Harmony Trainer. Math lens available on everything. MIDI input for assessment using real instruments (requires NoteInputProvider abstraction from Phase 4 spec).

---

### Phase E: AI-Powered Feedback

**Goal:** Add intelligent, session-aware feedback that spots patterns a simple score can't.  
**Depends on:** Backend API proxy (for key security), auth (for user identity), games generating enough data to analyze.  
**Sessions:** 5–8

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
Neo-Riemannian pathfinding: navigate from start chord to target chord using P/L/R transforms. Progression Library: blues turnaround, doo-wop, Axis of Awesome, Andalusian cadence, Creep, jazz ii-V-I, Pachelbel's Canon. Uses Song Examples DB for real-song context on each progression. Requires Competency Graph (E5) for adaptive difficulty.

**F2. Fog of War / spatial progress map**  
The Tonnetz grid as a progress visualization: explored regions are revealed, unexplored areas are dimmed. Ties into curriculum completion and game performance. This is the aspirational "you can see your musical knowledge growing" feature.

**F3. MIDI input integration**  
NoteInputProvider abstraction: games accept input from keyboard clicks, voice (pitch detection), or MIDI. Enables assessment with real instruments — play a scale on your MIDI keyboard, the game evaluates it. Launchkey 49 as primary test device.

**F4. Collaborative / social features**  
Share your Skratch Studio creations. Leaderboards for games (optional, not the primary motivation). "Challenge a friend" on specific exercises.

---

## Song Examples Database — Cross-Cutting Asset

The Song Examples Database is a curated collection of real-song references that illustrate theory concepts. It evolves across three versions as the platform matures.

### v1: Static Asset (ships during Phase A/B)

A single `song-examples.json` file in the repo containing ~50+ entries. No auth dependency. Surfaced by concept + age bracket + user's onboarding preset.

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

---

## Dependency Graph

```
Phase A (Missing Concepts)
  │
  │  ← can run in parallel ─────────────────────┐
  ↓                                              │
Phase B (New Games)                              │
  │                                              │
  │  Song Examples DB v1 ────────────────────────┘
  │  (static JSON, ships alongside A/B content)
  │
  ↓
Phase B.5 (Auth & Persistence)
  │  ├── Supabase setup + auth UI
  │  ├── Backend proxy extension
  │  ├── localStorage → Supabase migration
  │  ├── Resolve B8 (Practice vs Test schema)
  │  └── Song preferences table (empty)
  │
  ↓
Phase C (Curriculum & Learning Paths)
  │  ├── Persistent progress tracking
  │  └── Song Examples DB v2 (preference feedback UI)
  │
  ↓
Phase D (Differentiated UX) ←── needs C for path structure
  │
  ↓
Phase E (AI Feedback) ←── needs auth + backend proxy + mature games
  │  └── Song Examples DB v3 (AI-enhanced references)
  │
  ↓
Phase F (Advanced) ←── needs E for adaptive features
```

Phases A and B can run in parallel. C depends on both + B.5. D and E can partially overlap. F is the long tail.

---

## New Game Ideas — Brainstorm Backlog

These are ideas that didn't make the Phase B cut but are worth revisiting:

- **Key Signature Speed Run:** Flash a key signature, name the key. Timed. Good for music students.
- **Chord Inversion Trainer:** Hear a chord, identify root position vs. 1st vs. 2nd inversion.
- **Cadence Identifier:** Hear a cadence (perfect, plagal, deceptive, half), name it.
- **Transpose It:** Given a melody in one key, transpose it to another. Visual + audio.
- **Sight-Reading Simulator:** See notes on a staff, play them on the keyboard in time. Requires MIDI for full experience.
- **Blues Scale Improviser:** Given a 12-bar blues backing track, play along using the blues scale. AI evaluates note choices and timing.
- **Voice Leading Detective:** Hear two chords — which voice moved? Click the note that changed. Tonnetz visualization shows the move.

---

## Open Design Questions

1. **Learn → scaffold → quiz framework:** Should this be extracted as a shared component before building more games, or should we let the pattern emerge from 2–3 more implementations first? (Current take: build Scale Builder and one more game using the pattern manually, then extract.)

2. **Tonnetz as navigation:** How literal should this be? Full spatial map with fog of war, or a simpler node graph that uses Tonnetz aesthetics? The full spatial version is more distinctive but harder to build and potentially confusing for beginners.

3. **Achievement system:** Badges? Points? Streaks? What motivates without feeling cheap? Research suggests progress visualization (seeing your knowledge grow on the Tonnetz map) may be more motivating than badges for adults.

4. **AI feedback frequency:** Per-session is the plan, but should there be a lighter "nudge" system that doesn't require an API call? E.g., rule-based hints that fire when the game detects a pattern (3 consecutive errors on the same interval type → show a tip).

5. **Content authoring workflow:** As the number of topics, games, and curriculum steps grows, the current approach of manually editing theory-content.js gets unwieldy. At what point do we need a simple CMS or at least a structured data format with validation?

---

## Session Budget Estimate

| Phase | Sessions | Cumulative | Notes |
|-------|----------|------------|-------|
| A: Missing Concepts | 4–6 | 4–6 | Circle of fifths partially done |
| B: New Games | 6–10 | 10–16 | Scale Builder is highest priority |
| Song DB v1 | 1–2 | 11–18 | Mostly content curation |
| B.5: Auth & Persistence | 2–3 | 13–21 | Focused infrastructure sprint |
| C: Curriculum | 4–6 | 17–27 | Includes Song DB v2 preference UI |
| D: Differentiated UX | 3–5 | 20–32 | Mostly configuration + polish |
| E: AI Feedback | 5–8 | 25–40 | Includes Song DB v3 |
| F: Advanced | 8+ | 33–48+ | Long tail, each feature is big |

**At 3–4 sessions/week: ~2–3 months through Phase D, ~3–4 months through Phase E.**

---

## Immediate Next Steps (This Week)

1. Finish Phase 5 (intro module) — the current sprint.
2. Ship MVP (backend proxy, polish pass, deploy).
3. Review this document and prioritize: which Phase A/B items to tackle first?
4. Design session for Scale Builder (highest-value new game).
5. Design session for Circle of Fifths integration with intro module.
6. Begin curating Song Examples DB v1 content (can happen in parallel with everything).
