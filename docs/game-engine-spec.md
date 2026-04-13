# SongLab Games — Audit & Unification Plan

**Date:** 2026-04-11
**Context:** Preparing for `game-flow.js` extraction and visual unification across all games.

---

## Game Classification

### Performance Games (training precision)
These games train a skill the player already understands. No Learn mode needed — fundamentals handles teaching. Progression = tighter tolerances + harder material.

### Learning Games (teaching concepts)
These games teach new material through a pedagogical arc. Intro/Learn mode is essential. Progression = new concepts unlocked by mastery.

---

## Summary Matrix

| Game | Type | Current Modes | Current Difficulty | Adaptive | Extends base.html | Uses Design Tokens |
|------|------|---------------|-------------------|----------|-------------------|-------------------|
| Harmony Trainer | Performance | Practice, Test | Easy/Med/Hard + Adaptive | Pattern A (punishing) | ✅ | Partial |
| Strum Patterns | Performance | Practice, Test | Easy/Med/Hard + Adaptive | Pattern A (punishing) | ✅ | ✅ |
| Swing Trainer | Performance | Practice, Test | Med/Hard only (scoring thresholds) | ❌ | ❌ | ❌ |
| Melody Match | Performance | Practice, Test | Easy/Med/Hard + Adaptive | Pattern A (punishing) | ✅ | Partial |
| Chord Spotter | Performance | Practice, Test | Easy/Med/Hard + Adaptive | Pattern B (better) | ✅ | ✅ |
| Rhythm Lab | Performance | Practice, Test | Easy/Med/Hard | ❌ | ✅ | ❌ (external CSS) |
| Scale Builder | Learning | Intro, Practice, Test | 4 Stages | ❌ | ✅ | Partial |
| Relative Key Trainer | Learning | Learn, Practice, Test | 4 Tiers | ❌ | ✅ | ❌ |

---

## Per-Game Detail

### Harmony Trainer
**Skill:** Sing/play intervals accurately (pitch perception + production)
**Adaptive axes:**
1. Interval pool — Easy (few consonant) → Hard (all 12)
2. Pitch tolerance — Easy ±50¢ → Med ±30¢ → Hard ±15¢
**These axes should be independent.** A player accurate on simple intervals gets harder intervals at forgiving tolerance. A player who knows all intervals but is sloppy gets tighter tolerance on familiar ones.
**ResultDetail:** `{ interval, targetCents, actualCents, held, responseTimeMs }`
**Song connections:** "That's a P5 — the opening of Star Wars." (song-examples DB has interval mappings)
**Needs:** Upgrade to Pattern B adaptive. Shared game shell CSS. Wire ResultDetail logging.

### Strum Patterns
**Skill:** Execute strum patterns in time (motor timing)
**Adaptive axes:**
1. Timing tolerance — Easy ±100ms → Med ±60ms → Hard ±30ms
2. Visual scaffolding — Easy 2 measures lookahead → Med 1 → Hard 0
**These axes should be independent.**
**ResultDetail:** `{ expectedTime, actualTime, deltaMs, strumDirection, beatPosition, patternName }`
**Song connections:** "This is the pattern in 'Folsom Prison Blues.'" (song-examples DB concept_specifics)
**Needs:** Upgrade to Pattern B adaptive. Shared game shell CSS. Wire ResultDetail logging.

### Swing Trainer
**Skill:** Identify swing feel by ear (rhythmic perception)
**Adaptive axes:**
1. BPM — 80 (easy) → 160 (hard). Faster tempo compresses subdivision differences.
2. Target discrimination — start with extremes (straight vs shuffle), progress to adjacent ratios (lite swing vs medium swing).
3. Scoring tolerance — practice thresholds (0.02/0.06/0.12) → test thresholds (0.02/0.04/0.08).
**ResultDetail:** `{ targetRatio, userRatio, delta, bpm, feelLabel }`
**Song connections:** "That was triplet swing (0.67) — the feel in 'Take the A Train.'" (swing_ratio field in song-examples DB)
**Needs:** Extend base.html. Add adaptive mode. Shared game shell CSS. Add BPM control. Wire ResultDetail logging. Fix production 500 error.

### Melody Match
**Skill:** Hear a melody, sing it back note-by-note (pitch perception + reproduction)
**Adaptive axes:**
1. Interval complexity — Easy stepwise → Med + 3rds → Hard + leaps
2. Melody length — 3 notes → 7 notes (currently manual, should auto-advance)
3. Replay limit — unlimited → 3 → 1 (not yet implemented)
**Already has:** perSkill tracking and selectWeighted for biasing toward weak notes. Proto-competency-graph.
**ResultDetail:** `{ melody: [...], sungNotes: [...], perNote: [{target, sung, semitoneDist}] }`
**Song connections:** "That melody used the same ascending M2 shape as 'Happy Birthday.'"
**Progression feel:** Unlock longer melodies as accuracy improves. Player feels this as "I can hold more in my head now."
**Needs:** Upgrade to Pattern B adaptive. Auto-advance melody length. Shared game shell CSS. Wire ResultDetail logging.

### Chord Spotter
**Skill:** Identify chord quality by ear (harmonic perception)
**Adaptive axes:**
1. Chord type pool — Easy (Maj/Min) → Med (+ Dim/Dom7/Maj7/Min7) → Hard (+ Aug/sus2/sus4/m7b5)
**Single axis.** Could add voicing/inversion and register as future axes.
**Already has:** Pattern B adaptive (promote after 4, demote after 2). Best adaptive implementation currently.
**ResultDetail:** `{ chordQuality, rootNote, userAnswer, correct }`
**Song connections:** "That was a Dom7 — the sound in 'Johnny B. Goode.'"
**Needs:** Shared game shell CSS. Wire ResultDetail logging. Already in good shape otherwise.

### Rhythm Lab
**Skill:** Keep a steady beat (basic timekeeping)
**Adaptive axes:**
1. Timing tolerance — Easy ±100ms → Med ±50ms → Hard ±25ms
**Single axis.** Role is beginner gateway to Strum Patterns.
**ResultDetail:** `{ expectedTime, actualTime, deltaMs, beatIndex, bpm, timeSig }`
**Song connections:** Limited — mostly a pure skill trainer. Could reference time signature examples ("This is 3/4 — the feel in waltz music").
**Needs:** Add adaptive mode. Shared game shell CSS. Wire ResultDetail logging.

### Scale Builder
**Skill:** Construct scales from whole/half steps (music theory knowledge)
**Progression:** 4 pedagogical stages, each with Intro → Practice → Test
- Stage 1: W-W-H-W-W-W-H pattern
- Stage 2: Tetrachords & fourths
- Stage 3: Key chaining via shared tetrachords (Tonnetz appears)
- Stage 4: Relative minor
**No Easy/Med/Hard needed.** Stages ARE the progression. Test completion unlocks next stage.
**ResultDetail:** `{ stage, rootNote, expectedNotes: [...], selectedNotes: [...], correct }`
**Song connections:** Limited — theory-building game.
**This is the template** for stage-based game-flow.js support.
**Needs:** Shared game shell CSS. Wire ResultDetail logging.

### Relative Key Trainer
**Skill:** Identify and apply PLR transforms (neo-Riemannian theory)
**Progression:** 4 tiers with Learn → Practice → Test per tier
- Tier 1: P transform only
- Tier 2: L transform
- Tier 3: R transform
- Tier 4: Chained transforms
**No Easy/Med/Hard needed.** Tiers ARE the progression (same model as Scale Builder).
**ResultDetail:** `{ transform, startChord, targetChord, userAnswer, correct, tier }`
**Song connections:** "That L transform is how the verse moves in 'Creep.'"
**Needs:** Shared game shell CSS. Wire ResultDetail logging.

---

## Unification Work

### 1. Shared Game Shell CSS (`game-shell.css`)
Extract from existing games into a shared stylesheet:
- Page container (max-width, padding, centering)
- Top bar (title + back link + mode tabs)
- Card component
- Stats bar (score, streak, accuracy, question counter)
- Setup screen grid (2-column form layout)
- Button styles (primary, secondary, success, danger, large)
- Feedback toast (success green, miss coral)
- Results screen layout
- Leaderboard component
- Mode tabs (Intro/Learn / Practice / Test)
- Difficulty selector (Easy/Med/Hard/Adaptive pill group)

### 2. `game-flow.js` shared module
**State machine:** Supports two game structures:
- **Performance games:** Setup → Practice/Test (no Learn mode, difficulty axes)
- **Learning games:** Setup → Intro → Practice → Test (stage-based, unlockable)

**Adaptive engine (Pattern B):**
```
AdaptiveEngine({
  axes: [
    { name: 'pool', levels: ['easy', 'medium', 'hard'], promoteAfter: 4, demoteAfter: 2 },
    { name: 'tolerance', levels: ['easy', 'medium', 'hard'], promoteAfter: 3, demoteAfter: 2 }
  ]
})
```
Each axis promotes/demotes independently. Game provides `getDifficultyConfig(axisName, level)`.

**Result logging:**
```
gameFlow.logResult({
  correct: true,
  detail: { ...game-specific ResultDetail }
})
```
Stored in localStorage now, piped to Supabase after B.5.

**Session summary:**
`gameFlow.getSessionSummary()` returns strengths, weaknesses, and patterns from accumulated results. Rendered by a shared `SessionSummary` component on the results screen.

### 3. Visual unification
- All games extend `base.html` (fix Swing Trainer)
- All games use design tokens from `design-tokens.css`
- All games use `game-shell.css` for layout bones
- Game-specific styles layered on top (minimal)
- Consistent warm light theme across all game pages

### 4. Song connections
- Add "Hear it in a song" callouts to all games where song-examples DB has relevant entries
- Link to Explorer walkthroughs from game context
- Closes the loop: game → song → walkthrough → game

---

## ResultDetail Schema (Competency Graph Ready)

All results share a common envelope:

```javascript
{
  gameId: string,
  timestamp: ISO string,
  mode: 'practice' | 'test',
  difficulty: { axis1: 'easy'|'medium'|'hard', axis2: ... },
  duration: ms,
  correct: boolean,
  detail: { ...game-specific }
}
```

Game-specific `detail` shapes:

| Game | Detail Fields |
|------|---------------|
| Harmony Trainer | interval, targetCents, actualCents, held, responseTimeMs |
| Strum Patterns | expectedTime, actualTime, deltaMs, strumDirection, beatPosition, patternName |
| Swing Trainer | targetRatio, userRatio, delta, bpm, feelLabel |
| Melody Match | melody[], sungNotes[], perNote[{target, sung, semitoneDist}] |
| Chord Spotter | chordQuality, rootNote, userAnswer, correct |
| Rhythm Lab | expectedTime, actualTime, deltaMs, beatIndex, bpm, timeSig |
| Scale Builder | stage, rootNote, expectedNotes[], selectedNotes[], correct |
| Relative Key Trainer | transform, startChord, targetChord, userAnswer, correct, tier |
| Voice Leading Detective | startChord, targetChord, optimalMoves, playerMoves, notesChanged[], transformPath[], timeMs |
| Polyrhythm Trainer | polyrhythm, bpm, layer1[{expected, actual, deltaMs}], layer2[{expected, actual, deltaMs}], perLayerAccuracy |

---

## Planned: Voice Leading Detective (new game)

**Type:** Hybrid (learning + performance)
**Skill:** Find the minimal voice movement between two chords
**Core mechanic:** Given a start chord and target chord, change the fewest notes on the keyboard/fretboard to get there. The Tonnetz shows the geometric path; the glow worm visualization shows which notes moved vs stayed.

**Three levels:**

| Level | Challenge | What it teaches |
|-------|-----------|-----------------|
| 1 — Single transforms | C major → A minor (R transform). One note moves. Player identifies which note moves and where. | P, L, R transforms as physical keyboard/fretboard actions |
| 2 — Chained transforms | C major → F minor. Not a single P/L/R. Player finds shortest path on Tonnetz. Multiple valid solutions; scored by fewest moves. | Tonnetz as a navigation tool, transform chaining |
| 3 — Real progressions | "Voice lead through I-vi-IV-V in C." Player voices each chord with minimal movement from the previous one. | Practical voice leading for songwriting and arranging |

**Why this matters:**
- Bridges learning games (Relative Key Trainer teaches P/L/R) and performance games (applying that knowledge musically)
- The "so what?" moment for neo-Riemannian theory — this is why the Tonnetz is useful
- Direct consumer of the multi-chord glow worm path visualization
- Three-panel Explorer is the perfect interface: make a move on keyboard → see the geometry on Tonnetz → glow worm shows what traveled

**Adaptive axes:**
1. Transform complexity — single P/L/R → chains → arbitrary chord pairs
2. Chord vocabulary — triads only → 7th chords → extended voicings
3. Time pressure — untimed exploration → timed challenge

**ResultDetail:** `{ startChord, targetChord, optimalMoves, playerMoves, notesChanged[], transformPath[], timeMs }`
**Song connections:** "That I→vi transition uses the R transform — you hear it in 'Let It Be.'"

**Dependencies:** Multi-chord glow worm paths (shows the voice leading visually). Builds on Relative Key Trainer content. Could ship Level 1 as soon as glow worm paths are built.

---

## Planned: Polyrhythm Trainer (new game)

**Type:** Performance
**Skill:** Play two independent rhythm layers simultaneously (rhythmic independence / limb coordination)
**Core mechanic:** Two buttons (or keyboard keys, or MIDI pads), each mapped to a different rhythm layer. Player taps both patterns simultaneously. Timing accuracy evaluated per layer independently.

**Three levels:**

| Level | Challenge | What it teaches |
|-------|-----------|-----------------|
| 1 — Feel it | Hear the polyrhythm, tap along with ONE layer while the other plays automatically. Get the feel of how the layers interlock. | Polyrhythm perception — hearing independent layers |
| 2 — Split it | Tap BOTH layers simultaneously — one hand per rhythm. Accuracy scored per layer. | Limb independence, the core motor skill |
| 3 — Real songs | Play polyrhythms pulled from real song examples at tempo. | Musical application of the skill |

**Polyrhythm progression:**
- 2:3 (most common — waltz against duple)
- 3:4 (Afro-Cuban clave feel)
- Dotted quarter vs straight eighth (Linus and Lucy / Vince Guaraldi)
- 4:3 and more exotic ratios at advanced levels

**Adaptive axes:**
1. Rhythmic complexity — 2:3 → 3:4 → dotted patterns → exotic ratios
2. Tempo — slower = easier to separate the layers
3. Timing tolerance — wide → tight windows per layer independently

**ResultDetail:** `{ polyrhythm, bpm, layer1: [{expected, actual, deltaMs}], layer2: [{expected, actual, deltaMs}], perLayerAccuracy }`
**Song connections:** "That's the Linus and Lucy feel — Vince Guaraldi's dotted quarter against straight eighths." Also: "Mission Impossible uses 5:4." Connects to song-examples DB rhythm entries.

**UI:** Could leverage the SkratchLab Rhythm Builder grid — two rows, each an independent pattern. Visual playback shows both layers with separate playheads or a combined visualization showing where beats align and diverge.

**Dependencies:** None — could build on top of existing Tone.js + mic/keyboard input. Natural extension of Rhythm Lab.

---

## Priority Order

1. Extract `game-shell.css` + `game-flow.js` (foundation for everything else)
2. Wire Chord Spotter first (already closest to target — Pattern B adaptive, good design token usage)
3. Harmony Trainer + Strum Patterns (upgrade to Pattern B, decouple axes)
4. Melody Match (upgrade adaptive, auto-advance length)
5. Swing Trainer (extend base.html, add adaptive, add BPM control)
6. Rhythm Lab (add adaptive, position as gateway)
7. Scale Builder + Relative Key Trainer (already well-structured, just wire to shared modules)
8. Song connection callouts across all games

---

## Walkthrough Backlog

| Song | Artist | Why | Key Concepts |
|------|--------|-----|--------------|
| **Vienna** | Billy Joel | Chromatic mediant (I → III via E/G♯), descending chromatic bass line, emotional harmonic tension. Dustin learning this on piano. | Chromatic mediant, bass voice leading, P/L/R transforms |
| Take Five | Dave Brubeck | 5/4 time signature, unusual meter feel | Odd meter, rhythm |
| Superstition | Stevie Wonder | Syncopation masterclass, clavinet groove | Syncopation, rhythm, funk feel |
