# Tonnetz Platform — Post-MVP Build Plan (v2)

**Date:** 2026-03-25
**Status:** Draft for discussion
**Context:** Phase 5 (Intro Module) paused while the Tonnetz Explorer is established as the canonical component foundation. MVP scope (intro, Chord Walks, Harmony Trainer, Skratch Studio, Scale Explorer, backend proxy, polish) is the baseline. This document scopes what comes next.

**2026-03-25 update:** The Tonnetz Explorer was designed and built today — a new top-level tool with three synchronized panels (Tonnetz neighborhood, chord wheel, keyboard) wired through HarmonyState pub/sub. Key decisions: canonical Tonnetz orientation locked (horizontal = P5, up-right = M3, down-right = m3, △ = major, ▽ = minor), chord-quality coloring (blue = major, coral = minor), dual-ring chord wheel (outer = major keys, inner = relative minors) with diatonic arc highlighting. Full spec at `docs/tonnetz-explorer-spec.md`. This fundamentally reshapes the roadmap — see Phase A revisions.

---

## The Five Big Problems

1. **No curriculum.** Games exist but there's no guided path connecting them. A beginner logs in and gets a dashboard of tools with no obvious "start here → go here next" flow.

2. **Gamification is thin.** The platform has trainers and tools but limited game variety. We need more lightweight, fun interactions — especially ones that teach fundamentals (scales, note names, rhythm) without requiring the full weight of Harmony Trainer or Chord Walks.

3. **Missing foundational concepts.** The intro module covers sound → notes → chords → Tonnetz → transforms, but skips circle of fifths, tonal centers/keys, modes, and chord progressions. These are essential connective tissue.

4. **Playful lens is underdeveloped.** The "playful" depth level exists in the content schema but hasn't been refined. After shipping the intro module, we know what "approachable" feels like — time to apply that sensibility to the lens system.

5. **One-size-fits-all experience.** A total beginner, a gigging musician, and a theory nerd all see the same thing. The learn → practice → test framework works for music students, but beginners need something more guided and playful, while advanced users want deeper tools.

**Cross-cutting concern: No AI-powered feedback yet.** The adaptive difficulty and AI tutor feedback system (`shared/ai.js` / `config.js`) was specced early but never built for the Tonnetz platform. This enables the most compelling personalization features.

---

## Proposed Phases

### Phase A: Explorer as Teaching Platform + Missing Concepts
**Goal:** Leverage the Tonnetz Explorer's synchronized three-panel design as the primary teaching surface. Fill conceptual gaps by adding guided "lessons" that direct attention across the Explorer's panels rather than building standalone modules.
**Depends on:** Tonnetz Explorer built (done), intro module rebuilt on top of Explorer components.
**Sessions:** 3–5 (reduced from 4–6 — the Explorer already provides the infrastructure)

**A0. Rebuild intro module on Explorer components** ⭐
- The intro module was paused specifically so the Explorer could establish canonical components first. Now the intro module should be rebuilt to culminate in the Explorer — chapters 1-3 build understanding, chapter 4 ("The Tonnetz") drops the learner into the Explorer with guided prompts.
- The Explorer becomes the "graduation" moment: "Now you know enough to explore freely."

**A1. Circle of Fifths — DONE (subsumed by Explorer)**
- ~~Standalone circle of fifths module~~ → The chord wheel's dual-ring design with diatonic arc highlighting *is* this. The "sliding window" visualization teaches key relationships more intuitively than a standalone widget would.
- Remaining work: wire chord wheel to tooltip engine so hovering/clicking keys surfaces Theory Hub content. Add a "What am I looking at?" overlay for first-time users.

**A2. Tonal centers & keys — Explorer-guided lesson**
- Instead of a standalone lesson, this becomes a guided walkthrough *within the Explorer*:
  - "Click C major on the chord wheel. See the arc? Those 7 chords are your key."
  - "Now click G major. See how the arc shifted by one position? You share 6 of 7 chords."
  - "The Tonnetz panel shows the same thing spatially — neighbors share notes."
- Implementation: a lightweight "lesson overlay" system that highlights specific Explorer panels with prompt text and step-by-step progression. This is reusable for A3 and A4.

**A3. Modes overview**
- Lives as a tab or mode within the Scale Explorer (already in the platform), not a separate tool.
- Interactive: pick a mode, hear it, see it on the keyboard, see the brightness ordering (Lydian → Locrian).
- The Explorer's chord wheel can optionally show modal chord qualities when a mode is selected.

**A4. Chord progressions & common patterns**
- This is where the Explorer really shines: select a key on the chord wheel, then click through a preset progression (I-IV-V-I, I-V-vi-IV, ii-V-I). Watch each chord light up on all three panels simultaneously.
- Roman numeral overlay on the Tonnetz showing chord function.
- Progression presets with cultural references (playful lens: "this is the 'Let It Be' progression").
- The chord wheel's diatonic arc makes it visually obvious *why* these chords belong together.

**A5. Explorer lesson overlay system** (new — enables A2, A4, and future guided content)
- A reusable component: a queue of "steps" that highlight specific panels, play audio, and show prompt text.
- Think of it as a lightweight tutorial engine that works inside the Explorer.
- Each lesson is just a JSON array of steps — easy to author new lessons without touching component code.
- This is the concrete implementation of the learn → scaffold → quiz pattern for Explorer-based content.

**A6. "Hear It in Music" panel** (from game-flow-pattern.md — not yet built)
- A collapsible companion panel available throughout all game phases (Learn, Practice, Test, Explorer lessons).
- Shows 2-3 curated real-world song references for the current concept, scoped by the user's active lens.
- Playful: "Happy Birthday sounds cheerful in major — try humming it starting lower and making it sound sad. That's minor!"
- Musician: "Eleanor Rigby sits on E minor while hinting at G major. That ambiguity between relative keys is what gives it tension."
- Theorist: formal harmonic analysis language.
- No copyrighted audio playback — reference songs the user already knows, describe what to listen for.
- Schema: extends topics in `theory-content.js` with `real_world_examples` per lens (see `game-flow-pattern.md` §8 for full schema).
- Design constraint: 1-3 sentences per example, 2-3 examples per lens per topic. Quality over quantity.
- Authoring plan: hand-write examples for 3-5 core topics first to establish voice, then consider LLM-assisted batch generation with human review.
- The component is shared — build once, drop into any game page. Lives in the topic schema, not in game code.

---

### Phase B: New Games + Content Systems — Expanding the Game Library
**Goal:** More lightweight, fun games that teach fundamentals and give the curriculum something to link to. Also build the Skratch Studio content systems that several curriculum paths depend on. Prioritize games that are quick to build because they reuse existing components.
**Sessions:** 8–12

**B1. Scale Builder** ⭐ (high priority)
- Core mechanic: Given a root note, build a major or minor scale by selecting the correct notes on a keyboard or Tonnetz view.
- Progression: major scales → natural minor → harmonic minor → melodic minor → modes.
- Bonus round: build a melody using only the scale you just constructed, played over the root chord.
- Reuses: KeyboardView, TonnetzNeighborhood, Tone.js, HarmonyState.

**B2. Note Name Trainer**
- Flash-card style: show a note on a staff (or keyboard), name it. Or: hear a note, name it.
- Timed mode for gamification. Streak tracking.
- Simple but fills a gap — many beginners don't know note names fluently.

**B3. Interval Spotter (enhanced)**
- The Harmony Trainer already does interval recognition. This is a focused, simplified version: just intervals, no chords.
- "Name That Interval" — hear two notes, identify the interval.
- Visual: show the interval on the Tonnetz as a distance/direction.
- Reference songs for each interval ("Here Comes the Bride" = P4, "Star Wars" = P5).

**B4. Chord Progression Builder**
- Drag-and-drop Roman numerals to build a 4- or 8-bar progression.
- Hear it play back. See it on the Tonnetz as a path.
- Preset progressions to explore ("try the 50s progression: I-vi-IV-V").
- This bridges theory knowledge and creative application.

**B5. Rhythm Tapper**
- Simplified rhythm game: hear a beat pattern, tap it back.
- Evaluates timing accuracy. Starts with quarter notes, adds eighth notes, syncopation, rests.
- The existing Rhythm Lab has potential but may need a rethink for this simpler mechanic.

**B6. Melody Dictation (enhanced Melody Match)**
- Hear a short melody, notate it (select notes on a staff or keyboard in order).
- Starts with 3 notes stepwise, progresses to longer melodies with leaps.
- Different from singing-based Melody Match — this is about ear-to-notation translation.

**B7. Skratch Studio Starter System** (from `tonnetz-content-architecture.md` §7a — engineering prerequisite for curriculum)
- Starters are preconfigured Skratch Studio states that constrain the environment to focus on one concept. The Music Foundations curriculum path depends on these.
- Engineering requirements: config ingestion (from URL param or JS API), feature locking (hide/disable instruments and block categories), block pre-placement (load blocks onto canvas programmatically), "Reset to starter" button (distinct from "Clear All").
- Each starter has: `preload` config (instruments, blocks, available_blocks, locked_features, piano_config), `prompt`, `hints` (shown progressively if stuck), `debrief` (theory connection after exploration), `bridge_to_game` (optional link to a recognition game).
- Initial starters to build: `starter_free_play`, `starter_sound_frequency`, `starter_rhythm_grid`, `starter_note_names`, `starter_tempo_slider`, `starter_dynamics_loud_soft`, `starter_major_scale`, `starter_minor_scale`, `starter_triad_builder`.
- Starters are referenced by `starter_id` in learning path steps.

**B8. Skratch Studio Challenges** (from `tonnetz-content-architecture.md` §7b — creative prompts, not path-integrated)
- Open-ended creative prompts, not tied to a specific path step. Surface as suggestions within Skratch Studio or in the Theory Hub.
- Three challenge types: Exploration ("try this and see what happens"), Constraint ("make something using ONLY these notes"), Imitation ("listen to this pattern and make something similar").
- Schema: `{ id, title, related_topics, difficulty, type, prompt, success_hint, theory_link, unlocks_after }`.
- Challenges completed are tracked in the user profile under `skratch.challenges_completed`.
- Start with 5-8 challenges for beginner-level topics (intervals, rhythm, dynamics, scales).

---

### Phase C: Curriculum & Learning Paths
**Goal:** Build the navigation layer that connects intro content, Theory Hub topics, and games into coherent learning journeys.
**Depends on:** Phases A and B providing enough content and games to link to.
**Sessions:** 4–6

**C1. Define curriculum tracks**
Three tracks (already specced in earlier planning):

- **Music Foundations** (beginner path): ~11 steps from "what is sound" through scales and triads. Default lens: playful. Links heavily to Scale Builder, Note Name Trainer, and Skratch Studio starters.

- **Working Musician** (intermediate path): ~8 steps from intervals through chord function and cadences. Default lens: musician. Links to Harmony Trainer, Chord Walks, Chord Progression Builder, Strum Patterns.

- **Tonnetz & Transforms** (deep diver path): ~6 steps covering Tonnetz geometry through hexatonic cycles. Default lens: theorist/math. Links to Chord Walks (advanced tiers), Puzzle Paths (when built).

**C2. Theory Hub path runner UI**
- Already specced (Task 4.6 in original build plan): step-by-step runner with progress bar, current step display, action buttons linking to games/starters/visualizations, and "Mark Complete" advancement.
- Each step is interactive — no step is "just read this."

**C3. Explorer as curriculum map**
- The Explorer's three-panel design is the natural curriculum navigation surface. Rather than building a separate "fog of war" map, curriculum progress can be visualized *on the chord wheel and Tonnetz panels themselves*:
  - Chord wheel: keys the learner has "mastered" (completed related exercises) are fully colored. Keys they've visited are outlined. Unexplored keys are dimmed.
  - Tonnetz: same principle — explored chord regions are lit, unexplored are fogged.
- Clicking a dimmed region could prompt: "Want to explore D major? Start with [lesson name]."
- This merges the "fog of war" (Phase 8 original plan) and "Tonnetz as navigation" concepts into the Explorer — no separate visualization needed.

**C4. Onboarding → curriculum routing**
- The existing onboarding presets (beginner / some experience / experienced musician / theory nerd / just exploring) map directly to curriculum tracks.
- Full preset → path mapping (from `tonnetz-content-architecture.md` §6):
  - `beginner` ("I'm brand new") → Music Foundations, default lens: playful, starting games: Skratch Studio, Rhythm Lab
  - `dabbler` ("I play a little") → Music Foundations (skip steps 0-1) + Ear Training, lens: playful/musician, starting: Melody Match, Harmony Trainer (easy)
  - `curious_player` ("I play but want theory") → Working Musician, lens: musician, starting: Chord Spotter, Harmony Trainer
  - `producer` ("I make beats but don't know theory") → Working Musician + Rhythm & Groove, lens: musician, starting: Skratch Studio, Rhythm Lab, Chord Spotter
  - `deep_diver` ("Show me the deep stuff") → Tonnetz & Transforms, lens: theorist, starting: all unlocked
  - `math_explorer` ("I'm here for the math") → Math of Music, lens: math, starting: Explorer, Chord Walks
- After selecting a preset, users can: toggle individual lenses, mark topics as "already known" to skip them, adjust default game difficulty.
- After onboarding, the dashboard surfaces "Your Path" prominently with a clear "Continue" button.
- First-time visitors who skip onboarding get the beginner path by default.

**C5. Assessment model** (from `tonnetz-content-architecture.md` §8 and §11)
- Four-state topic tracking: unseen → visited → learning → learned.
- Hybrid assessment approach:
  - Game level completions auto-trigger topic status changes for `building_block` and `skill_guide` topics (e.g., completing Harmony Trainer level 3 marks `intervals` as "learned").
  - `framework` and `reference` topics get a manual "Mark as Understood" toggle in the Theory Hub.
- `seen_via` field tracks first encounter context (game, path, hub, tooltip) — enables smarter Tips pill cross-references ("You first saw intervals in the Harmony Trainer — want to see them on the Tonnetz?").
- This is the lightweight version of competency tracking. The full Competency Graph (Phase E) builds on top of this.

**C6. Skill guide topics** (from `tonnetz-content-architecture.md` §2 — new topic type)
- Skill guides contain declarative knowledge *about* perceptual skills — mnemonics, listening strategies, practice tips. They always link to a primary game.
- Candidates to add as new topics in `theory-content.js`: `interval_recognition`, `chord_quality_recognition`, `rhythm_feel`, `relative_pitch_training`, `melodic_dictation`.
- Schema rule: every `skill_guide` must have at least one `related_games` entry with `relevance: "primary"`. A skill guide without a game link is a dead end.
- Content approach: these live in the Theory Hub but bridge to game practice. "Here's what to listen for when identifying a minor third" + "Practice this → Harmony Trainer".

---

### Phase D: Differentiated Experiences by User Level
**Goal:** Make the platform feel different for beginners vs. music students vs. experienced musicians.
**Sessions:** 3–5

**D1. Beginner mode refinements**
- More visual, less text. Bigger buttons, friendlier language, more celebration on success.
- "Playful lens" is the default everywhere — refine it now that the intro module has established the tone.
- Scaffolded freedom: in Skratch Studio, beginners get curated starters with guardrails (limited note range, pre-set instruments). As they progress, more blocks/options unlock.
- Achievement system: simple badges for milestones ("Built your first scale!", "Completed the intro!", "10-day streak!").

**D2. Music student mode**
- The learn → practice → test framework is the default here.
- Each topic has: a Theory Hub explanation (musician lens) → a practice game → a test/assessment in the same game or Skratch Studio.
- Progress tracking shows skill gaps: "Strong on intervals, needs work on chord inversions."

**D3. Experienced musician / theory nerd mode**
- Skip intros by default. Deep-dive content available immediately.
- Tonnetz & Transforms path is surfaced.
- Advanced games and tools: Puzzle Paths, Chord Walks at Tier 3-4, advanced Harmony Trainer.
- Math lens available on everything.
- MIDI input for assessment using real instruments (requires `NoteInputProvider` abstraction from Phase 4 spec).

---

### Phase E: AI-Powered Feedback
**Goal:** Add intelligent, session-aware feedback that spots patterns a simple score can't.
**Depends on:** Backend API proxy (for key security), games generating enough data to analyze.
**Sessions:** 5–8

**E1. Backend AI proxy + session data pipeline**
- The backend API proxy (already required for MVP) gets extended to handle AI feedback requests.
- Each game sends session data (attempts, errors, timing, patterns) to a lightweight endpoint.
- Session data is batched and sent to Claude for analysis at session end (not per-attempt — too expensive and slow).

**E2. Melody Match — pitch pattern analysis**
- After a session, AI analyzes the pattern of pitch errors across rounds.
- Example feedback: "You're nailing intervals within a third, but when the melody jumps a fifth or more, you're consistently landing about a half step flat. Try thinking of the first two notes of 'Star Wars' for that P5 jump."
- Feedback appears on the results screen, not mid-game.

**E3. Strum Patterns — timing analysis**
- AI analyzes where in the beat the user consistently rushes or drags, which strum transitions are weakest.
- Example: "Your down-up transitions are solid but you're rushing the rest between beats 2 and 3. Try counting 'one-and-TWO-and' with emphasis on the rest."

**E4. Harmony Trainer — chord recognition patterns**
- Spots which chord qualities or intervals the user confuses most.
- Example: "You're mixing up minor 7ths and major 7ths — try listening for whether the top note feels 'resolved' (major 7th) or 'bluesy' (minor 7th)."

**E5. Cross-game learning recommendations**
- The Competency Graph concept (Phase 9 from original plan): shared micro-skill tracking across all games.
- AI synthesizes data from multiple games: "You understand intervals well in isolation (Harmony Trainer) but struggle to apply them in melodic context (Melody Match). Try the Scale Builder to bridge that gap."
- Drives adaptive curriculum suggestions: "Based on your progress, I'd recommend focusing on [topic] next."

---

### Phase F: Advanced Features (Post-Curriculum)
**Goal:** The ambitious features that require the curriculum and game infrastructure to be mature.
**Sessions:** 8+ (these are big)

**F1. Puzzle Paths game** (full spec at `docs/puzzle-paths-spec.md`)
- Neo-Riemannian pathfinding: navigate from start chord to target chord using P/L/R transforms.
- Key design decision (from spec): **player selects destination chords** (thinking musically), and the **Tonnetz animates the path** through intermediate P/L/R steps (showing the geometric decomposition). The interaction feels musical while the visualization is educational.
- Four puzzle types: Pathfinding (find a valid path), Progression Tracing (trace a real progression chord-by-chord), Ear-Based (identify chords by ear then trace), Constraint (obey rules like "no P transform" or "all minor chords").
- Progression Library (curated, all transposable to 12 keys): Blues Turnaround (I-IV-I-V-IV-I), 50s Doo-Wop (I-vi-IV-V), Axis of Awesome (I-V-vi-IV), Andalusian Cadence (i-VII-VI-v), Creep (I-III-IV-iv — the IV→iv step is a single P transform, great "aha" moment), Jazz ii-V-I (ii-V-I), Pachelbel's Canon (I-V-vi-iii-IV-I-IV-V).
- Compound move animation speed gated by competency: slow + labeled when learning, fast/skippable once internalized.
- Skratch Studio bridge: after completing a puzzle, offer to open the progression in Skratch Studio as pre-loaded blocks.
- Requires Competency Graph (E5) for puzzle type gating and adaptive difficulty.

**F2. Auth & Persistence** (full spec at `docs/auth-architecture.md`)
- Supabase Auth with magic links + Google OAuth (low friction, no passwords).
- Migrate `user-profile.js` from localStorage-only to Supabase Postgres — same public API, write-through pattern (save locally first, async sync to backend).
- localStorage as offline cache/fallback. Merge strategy on login: per-field most-recent-wins.
- `competency_snapshots` table (append-only, separate from profile JSONB) for Phase E skill tracking.
- Profile schema: JSONB columns for `topics`, `games`, `paths`, `skratch` matching current localStorage shape exactly.
- Auth is optional — app works immediately without it. "Sign in to save progress" is a gentle prompt, not a gate.
- Estimated: 8-10 sessions. Not needed until there are actual users, but must be done before competency graph.

**F3. ~~Fog of War / spatial progress map~~ → Subsumed by Explorer (see C3)**
- The Explorer's chord wheel and Tonnetz panels are the progress visualization surface.
- No separate "fog of war" tool needed — it's a rendering mode within the Explorer.

**F4. MIDI input integration**
- `NoteInputProvider` abstraction: games accept input from keyboard clicks, voice (pitch detection), or MIDI.
- Enables assessment with real instruments — play a scale on your MIDI keyboard, the game evaluates it.
- Launchkey 49 as primary test device.

**F5. HarmonyState animation queue** (from `tonnetz-keyboard-component.md` §2)
- The HarmonyState spec includes an `animationQueue` concept — a queue of typed animation events (`transform`, `highlight`, `playback`) with duration and delay.
- This enables choreographed multi-step animations: play a chord, pause, animate the transform, highlight the moving tone, play the result.
- Currently animations are ad-hoc per game. Centralizing them in HarmonyState would make the Explorer lesson overlay (A5) and Puzzle Paths (F1) significantly easier to build.
- Consider building this when the lesson overlay or Puzzle Paths reveals the need for it.

**F6. Collaborative / social features**
- Share your Skratch Studio creations.
- Leaderboards for games (optional, not the primary motivation).
- "Challenge a friend" on specific exercises.

**F7. Sound-to-visual mapping in Skratch Studio** (from past design sessions — prompts need rewrite for Tonnetz stack)
- Audio-reactive starter programs: Pitch Painter, Note Garden, Bounce.
- AudioBridge pattern feeding `currentPitch` / `currentNoteName` / `currentVolume` into the canvas sandbox.
- Particle system with presets (sparkles, rain, mist, confetti).
- Blockly blocks for event→effect rules (sound triggers visual changes).
- Note: old prompts were written for vanilla JS / React stack and are stale. Need full rewrite targeting Flask/Jinja2 + `music-engine.js`.

---

## Dependency Graph

```
Tonnetz Explorer (DONE — canonical components established)
  ↓
Phase A (Missing Concepts + Intro rebuild on Explorer)
  ↓
Phase B (New Games) ←——— can start in parallel with A
  ↓
Phase C (Curriculum) ←—— needs A + B to have enough content
  ↓                       Explorer lesson overlay (A5) feeds directly into C2/C3
Phase D (Differentiated UX) ←—— needs C for path structure
  ↓
Phase E (AI Feedback) ←—— needs backend proxy + mature games
  ↓
Phase F (Advanced) ←—— needs E for adaptive features
```

The Explorer is now the foundation layer. Phases A and B can run in parallel. The lesson overlay system (A5) is a key enabler for curriculum (C) — build it early. C depends on A + B. D and E can partially overlap. F is the long tail.

---

## New Game Ideas — Brainstorm Backlog

These are ideas that didn't make the Phase B cut but are worth revisiting:

**Explorer-native games (no separate page needed):**
- **Explorer Quiz Mode:** Given a key highlighted on the chord wheel, identify which chord is the V, the vi, etc. by clicking the Tonnetz. Reversal: given a chord on the Tonnetz, identify its function in the current key.
- **Chord Wheel Chase:** A chord lights up on the chord wheel, play it on the keyboard panel before time runs out. Progressive — starts with triads, adds 7ths.

**Ear training:**
- **Cadence Identifier:** Hear a cadence (perfect, plagal, deceptive, half), name it.
- **Chord Inversion Trainer:** Hear a chord, identify root position vs. 1st vs. 2nd inversion.
- **Voice Leading Detective:** Hear two chords — which voice moved? Click the note that changed. Tonnetz visualization shows the move. (from keyboard-component.md §8.4)

**Theory application:**
- **Key Signature Speed Run:** Flash a key signature, name the key. Timed. Good for music students.
- **Transpose It:** Given a melody in one key, transpose it to another. Visual + audio.
- **Modulation Game:** Navigate between keys using pivot chords. Extension of Chord Walks at depth 2+ with chained transforms. (from keyboard-component.md §8.4)

**Performance / instrument:**
- **Sight-Reading Simulator:** See notes on a staff, play them on the keyboard in time. Requires MIDI for full experience.
- **Blues Scale Improviser:** Given a 12-bar blues backing track, play along using the blues scale. AI evaluates note choices and timing.

**Backlog items from MVP tracker (B8-B11):**
- B8: Practice vs Test redesign — revisit the visual distinction between modes
- B9: Major/minor chord colors on Tonnetz — now partially done (Explorer has blue/coral)
- B10: Playable input as assessment — use keyboard/voice/MIDI performance as test evidence instead of clicking buttons
- B11: (completed)

---

## Open Design Questions

1. **Learn → scaffold → quiz framework:** Should this be extracted as a shared component before building more games, or should we let the pattern emerge from 2-3 more implementations first? (Current take: build Scale Builder and one more game using the pattern manually, then extract.)

2. **Tonnetz as navigation:** The Explorer's three-panel design partially answers this — progress visualization can happen on the chord wheel and Tonnetz panels directly (see C3). Remaining question: should the Explorer *also* serve as the main dashboard/landing page, replacing the current dashboard grid? Or should it be one click away, with the dashboard being a simpler "your path + your games" view?

3. **Achievement system:** Badges? Points? Streaks? What motivates without feeling cheap? Research suggests progress visualization (seeing your knowledge grow on the Tonnetz map) may be more motivating than badges for adults.

4. **AI feedback frequency:** Per-session is the plan, but should there be a lighter "nudge" system that doesn't require an API call? E.g., rule-based hints that fire when the game detects a pattern (3 consecutive errors on the same interval type → show a tip). The game-flow-pattern spec calls these "soft scoring" — no numerical score in Practice mode, but streak tracking and encouraging feedback. This tier (local rule-based hints) could ship before the AI proxy is built, giving immediate value.

5. **Content authoring workflow:** As the number of topics, games, and curriculum steps grows, the current approach of manually editing `theory-content.js` gets unwieldy. At what point do we need a simple CMS or at least a structured data format with validation? The content architecture spec suggests the authoring pipeline needs lens voice guides → hand-written examples → LLM batch generation. See the Content Authoring Pipeline section below.

6. **Explore mode placement:** The game-flow-pattern spec asks whether Explore mode is a 4th tab alongside Learn/Practice/Test, or a toggle within Practice. Chord Walks already has Explore as a separate mode. Should this be standardized across all games? Leaning toward: Explore is a separate mode accessible from Practice, not a full tab — it should feel like "I want to just mess around" rather than a formal phase.

7. **Skratch Studio as assessment:** The content architecture spec envisions Skratch Studio starters as the "test" in learn→scaffold→quiz — can the user apply the concept creatively? But this is harder to score than a quiz. For beginners, is "they spent time in the starter and played around" sufficient evidence of engagement, or do we need measurable success criteria? Leaning toward: for beginners, engagement = success. For music students, add optional "did you try X?" prompts.

8. **Seventh chords in Explorer:** Punted for now (Explorer spec decision #3), but when? Adding 7ths would double the chord vocabulary and requires UI changes to the chord wheel. Worth revisiting after the triadic foundation is solid and users request it.

---

## Session Budget Estimate

| Phase | Sessions | Notes |
|-------|----------|-------|
| A: Explorer-based concepts | 3–5 | Circle of fifths done; lesson overlay + "Hear It in Music" are key enablers |
| B: New Games + Content Systems | 8–12 | Scale Builder highest priority; Skratch starters needed for curriculum |
| C: Curriculum | 5–7 | Explorer + lesson overlay reduce effort; assessment model + skill guides add scope |
| D: Differentiated UX | 3–5 | Mostly configuration + polish |
| E: AI Feedback | 5–8 | Backend proxy already in MVP scope; rule-based hints can ship earlier |
| F: Advanced | 8+ | Long tail, fog of war subsumed by Explorer |
| **Total** | **32–45** | At 3-4 sessions/week: ~2-3 months |

---

## Immediate Next Steps (This Week)

1. ~~Finish Phase 5 (intro module)~~ → Paused. Explorer establishes canonical components first (done).
2. Rebuild intro module on Explorer components (A0) — the intro should culminate in the Explorer.
3. Ship MVP (backend proxy, polish pass, deploy).
4. Build the Explorer lesson overlay system (A5) — this is the reusable infrastructure for guided content.
5. Design session for Scale Builder (highest-value new game, Phase B1).
6. Chord progressions in the Explorer (A4) — high visual payoff, leverages everything the Explorer already does.

---

## Pre-Share Security Checklist (from `auth-architecture.md` §9 + `tonnetz-mvp-tracker.md`)

Before sending the URL to anyone:

- [ ] Backend API proxy is live — no API keys in client JS
- [ ] `SUPABASE_SERVICE_KEY` (if auth is built) is in Railway env vars only, never in client code
- [ ] No raw SQL in Flask routes (use parameterized queries)
- [ ] CORS configured: allow only Railway domain and localhost
- [ ] Rate limiting on `/api/proxy` (prevent abuse of proxied keys)
- [ ] Content-Security-Policy header set (restrict script sources)
- [ ] No secrets in git (`.gitignore` covers `.env`, `config.js`, etc.)
- [ ] Intro module all chapters working
- [ ] Landing page → onboarding → intro → games flow is smooth
- [ ] Test on someone else's browser/device at least once
- [ ] No console errors on any page
- [ ] No debug endpoints or test routes exposed

---

## Known Issues to Fix Before Production (from `KNOWN-ISSUES.md`)

- **Mobile viewport jitter:** `.tt-tooltip` uses `max-height: calc(100vh - 32px)`. On mobile Safari/Chrome, `vh` includes the collapsing address bar. Replace with `dvh`. (Medium priority)
- **Focus trapping / aria-modal:** When tooltip is open, keyboard Tab escapes behind the backdrop. Need focus trap and `aria-modal="true"`. (Medium — accessibility)
- **Z-index audit:** Tooltip uses `z-index: 9999`. Canvas games or overlay modals with higher values will cover tooltips. Establish a z-index scale. (Low)
- **stopPropagation collisions:** Tooltip relies on `document.addEventListener('click')`. Game components using `stopPropagation()` will block `[data-theory]` triggers. May need direct listeners. (Low)
- **Sustain pedal bug:** Organ/Synth in Skratch Studio — `triggerAttackRelease` bypasses sustain state. Fix requires checking sustain and using separate `triggerAttack`/`triggerRelease` calls.
- **TonnetzNeighborhood.recenter()** doesn't internally call `HarmonyState.setTriad()` — callers must invoke both.

---

## Content Authoring Pipeline (from `tonnetz-content-architecture.md` §11)

With 50-80 topics × 2-4 lenses each, that's 100-320 content bodies. Plus `real_world_examples` for the "Hear It in Music" panel. The pipeline needs planning:

1. **Write lens voice guides first** — define exact tone, vocabulary level, and example style for each lens (playful, musician, theorist, math). These are the "style sheets" for all content generation.
2. **Hand-write 3-5 core topics per lens** to establish the voice and validate the schema.
3. **LLM-assisted batch generation** for remaining topics, with human review. The musician and theorist lenses need accuracy — wrong harmonic analysis is worse than no example at all.
4. **Real-world examples** (for "Hear It in Music"): hand-curate musician-lens examples (they need to be musically accurate). Playful lens can be more creatively generated.
5. **Validation tooling:** The existing `validateTheory()` function catches broken references. Extend it to check for: every `skill_guide` has a primary game link, every `building_block` has a `quick_summary`, no orphan topics in prerequisite graph.

---

## Key Reference Documents

| Document | Location | What it covers |
|----------|----------|----------------|
| Explorer spec | `docs/tonnetz-explorer-spec.md` | Panel specs, interaction model, component reuse plan |
| Content architecture | `docs/tonnetz-content-architecture.md` | Topic schema, content types, lens system, starters, challenges, profile |
| Game flow pattern | `docs/game-flow-pattern.md` | Learn→Practice→Test phases, "Hear It in Music" panel, real-world examples schema |
| Auth architecture | `docs/auth-architecture.md` | Supabase auth, profile migration, write-through pattern, competency snapshots, security |
| Keyboard component | `docs/tonnetz-keyboard-component.md` | HarmonyState design, animation queue, Tonnetz+keyboard linking |
| Puzzle Paths | `docs/puzzle-paths-spec.md` | Compound moves, progression library, four puzzle types, competency hooks |
| Build plan (original) | `docs/tonnetz-build-plan.md` | 10-phase plan with Claude Code prompts (some tasks complete, some superseded) |
| Known issues | `docs/KNOWN-ISSUES.md` | Tracked bugs and fixes |
| STATUS.md | `STATUS.md` | Single source of truth for current project state |
| MVP tracker | `docs/tonnetz-mvp-tracker.md` | Session-budget-based MVP checklist (partially superseded by this doc) |
