# Game Flow Pattern: Learn → Practice → Test

**Version:** 0.1 (Initial design)
**Date:** 2026-03-17
**Purpose:** Define a consistent three-phase game flow pattern shared across all Tonnetz recognition games. This replaces the current ad-hoc "level" system with a pedagogically grounded structure.
**Context:** Sits alongside `tonnetz-content-architecture.md` and `tonnetz-keyboard-component.md`. The first game to implement this pattern is the Relative Key Trainer.

---

## 1. The Problem

The current game structure jumps straight to quizzing. Players with no background have to guess — which isn't fun and doesn't teach. Players who already know the material aren't challenged. There's no on-ramp and no way to build understanding before being tested.

The "level" metaphor (Level 1, Level 2...) implies a linear difficulty ladder, but what players actually need is three different *modes of engagement* with the same material:

1. **"Show me"** — I don't know this yet, let me watch and listen
2. **"Let me try"** — I think I get it, let me experiment with guidance
3. **"Test me"** — I'm ready, quiz me without help

---

## 2. The Three Phases

### Learn (Guided Introduction)

The player watches and listens. The game demonstrates the concept with full visual scaffolding. No questions asked, no right or wrong. The player's only action is "Next" (and optionally "Replay").

**Design principles:**
- Scripted sequence of examples, not random
- Build from simple to complex across 3-5 examples
- Full annotations visible: chord labels, note names, transform arrows, common tones, moving tones
- Audio plays automatically with each example
- Tonnetz and keyboard highlight in sync — player sees the concept from both perspectives
- Brief, clear narration text above or below the visualization (1-2 sentences per example, not a wall of text)
- Player can replay any example
- No scoring, no timer, no pressure
- Ends with a "Ready to practice?" transition

**Player interaction:** Passive. Click "Next" / "Replay" / "Back" only.

**Visual state:**
| Component | State |
|-----------|-------|
| Tonnetz | Fully animated, annotations on, scripted highlights |
| Keyboard | Highlights shown, display mode (not playable) |
| Audio | Auto-plays with each step |
| Question area | Narration text, "Next" button |

### Practice (Guided Exploration)

The player does it themselves, but with training wheels. The game asks questions, and the visual scaffolding helps the player find the answer. Wrong answers get gentle, specific feedback — not just "incorrect" but *why* and *what to look for*.

**Design principles:**
- Same concept as Learn, but now the player is the one making choices
- Visual scaffolding is present but not giving away the answer — the Tonnetz neighborhood is visible (so spatial relationships are there to discover), but the answer triad isn't highlighted
- Interactive mode: player clicks triads on the Tonnetz, or notes on the keyboard, or answer buttons
- Feedback is immediate and educational:
  - Correct: "Yes! A minor shares C and E with C major — only one note moved." + full transform animation
  - Incorrect: "That's C minor — that's the *parallel* minor (P transform), not the relative. The relative minor is one step further on the Tonnetz." + highlight both the wrong answer and the right answer
- Unlimited attempts per question (or 2-3 attempts before revealing)
- No scoring pressure — or soft scoring ("You're getting the hang of it!")
- Replay audio freely
- 5-8 rounds, can repeat as many times as desired
- Ends with "Ready for the challenge?" transition

**Player interaction:** Active. Click Tonnetz triads, keyboard notes, or answer buttons. Click "Replay" for audio. Click "Show me" to reveal the answer if stuck.

**Visual state:**
| Component | State |
|-----------|-------|
| Tonnetz | Interactive (clickable triads), neighborhood visible, answer NOT highlighted until player acts |
| Keyboard | "Both" mode (playable + highlights after answer) |
| Audio | Plays on round start + replay button |
| Question area | Question text, answer buttons or "click the Tonnetz" prompt, feedback text |

### Test (Challenge)

The quiz. No visual scaffolding during the question. Pure ear training (for recognition games). The reveal after answering is the final learning moment — the full transform animation shows what they should have heard.

**Design principles:**
- Audio plays, player answers from ear alone
- No Tonnetz highlights, no keyboard highlights until after the answer
- Answer options are buttons (not Tonnetz interaction — too easy to guess spatially)
- Feedback after answering: full visual reveal (transform animation, common tones, moving tone)
- Scoring matters: track accuracy, show results at end
- 10 rounds per session
- Clear results screen with score and option to retry or advance
- Unlocks based on performance (e.g., 8/10 to advance)

**Player interaction:** Click answer buttons. Click "Replay" for audio. No Tonnetz/keyboard interaction during the question.

**Visual state:**
| Component | State |
|-----------|-------|
| Tonnetz | Grid visible but no highlights until answer reveal |
| Keyboard | Display mode, no highlights until answer reveal |
| Audio | Plays on round start + replay button |
| Question area | Question text, answer buttons, score display |

---

## 3. Phase Transitions

Phases are **always available**, not locked behind completion. A player can jump straight to Test if they want. But the UI should guide new players through the natural order.

```
┌─────────────────────────────────────────────────────┐
│                   GAME PAGE                          │
│                                                      │
│   [Learn]    [Practice]    [Test]                    │
│    ──●──       ──○──        ──○──                    │
│                                                      │
│   First visit → starts on Learn                      │
│   After Learn → gentle nudge to Practice             │
│   After Practice → gentle nudge to Test              │
│   Anytime → player can click any phase               │
│                                                      │
│   Profile tracks: phases_seen, practice_attempts,    │
│   test_high_score per game per difficulty             │
└─────────────────────────────────────────────────────┘
```

**First visit flow:**
1. Game opens on Learn phase automatically
2. After completing Learn, a "Try it yourself →" button transitions to Practice
3. After a few Practice rounds, "Ready for the challenge? →" transitions to Test
4. All three tabs remain clickable — the player can always go back

**Return visit flow:**
1. Game opens on the last phase the player used (from localStorage profile)
2. If the player hasn't completed Learn yet, default to Learn
3. If they've completed Learn but not practiced, default to Practice
4. If they've practiced, default to Test

**Profile tracking (extends existing user-profile.js):**
```javascript
// Per game, per difficulty:
games: {
  relative_key_trainer: {
    phases_completed: ["learn"],    // which phases they've finished
    last_phase: "practice",         // where to resume
    practice_attempts: 3,           // how many practice sessions
    test_high_score: null,          // best test score (null = never tested)
    test_attempts: 0,
    current_difficulty: 1,          // which difficulty tier within the game
  }
}
```

---

## 4. Difficulty Tiers (Orthogonal to Phases)

Phases (Learn/Practice/Test) and difficulty tiers are **independent axes**. Each difficulty tier has its own Learn, Practice, and Test content.

For the Relative Key Trainer:

| Tier | Name | Concept | Learn examples | Practice task | Test task |
|------|------|---------|----------------|---------------|-----------|
| 1 | "Major or Minor?" | Hear the difference between major and minor | 3-4 pairs of major/minor on the same root | "Is this major or minor?" with Tonnetz scaffolding | "Is this major or minor?" audio only |
| 2 | "Find the Relative" | Identify relative major/minor pairs | 3-4 R transform demos on different keys | "Click the relative minor on the Tonnetz" | "Which is the relative minor?" multiple choice |
| 3 | "Hear the Pivot" | Recognize modulation to relative key | 2-3 passages that modulate, with pivot point marked | "When does the key change?" with visual timeline | "When does the key change?" audio only |
| 4 | "PLR Explorer" | All three transforms | P, L, R demos side by side | "Which transform is this?" with Tonnetz | "Which transform?" audio only |
| 5 | "Chain Transforms" | Multi-step transform paths | 2-step chain demos on Tonnetz | "Trace the path" on interactive Tonnetz | "What's the final chord?" audio only |

Tier unlocking: complete Test phase with 8+ correct in the current tier to unlock the next tier.

---

## 5. How This Applies to Existing Games

This pattern applies primarily to **recognition games**. Creative games (Skratch Studio) have a different flow.

| Game | Tier 1 concept | Natural fit? | Notes |
|------|---------------|-------------|-------|
| **Relative Key Trainer** | Major vs. minor | ✓ First implementation | Full Tonnetz + Keyboard |
| **Harmony Trainer** | Easy intervals (P5, P8) | ✓ Strong fit | Learn: hear + see intervals. Practice: identify with keyboard visible. Test: audio only |
| **Chord Spotter** | Major vs. minor triads | ✓ Strong fit | Very similar to Relative Key Trainer Tier 1 |
| **Melody Match** | Simple melodic patterns | ✓ | Learn: see + hear patterns. Practice: replay/reconstruct. Test: identify |
| **Rhythm Lab** | Basic beat patterns | ✓ | Learn: watch + hear. Practice: tap along. Test: identify patterns |
| **Strum Patterns** | Basic strum patterns | ✓ | Same structure |
| **Relative Pitch** | Close intervals | ✓ | Nearly identical to Harmony Trainer |

The shared pattern means a player who learns how Learn/Practice/Test works in one game immediately understands the flow in every other game.

---

## 6. Shared Game Flow Module

To avoid implementing this per-game, build a shared module: `static/shared/game-flow.js`

This module provides:
- Phase state management (current phase, transitions, completion tracking)
- Phase UI chrome (Learn/Practice/Test tabs, transition prompts)
- Profile integration (save/restore phase progress)
- Shared feedback patterns (correct/incorrect animations, reveal timing)

Games provide:
- Phase-specific content (Learn script, Practice questions, Test questions)
- Phase-specific interaction handlers
- Difficulty tier definitions
- Game-specific UI (Tonnetz, keyboard, custom visualizations)

```javascript
// Sketch of the game-flow API (not final)
const flow = GameFlow.init({
  gameId: 'relative_key_trainer',
  containerId: 'game-container',
  tiers: [ /* tier definitions */ ],
  
  // Game provides these callbacks per phase:
  onLearnStep(step, state)    { /* render Learn content for this step */ },
  onPracticeRound(round, state) { /* set up Practice round */ },
  onPracticeAnswer(answer, state) { /* handle Practice answer */ },
  onTestRound(round, state)   { /* set up Test round */ },
  onTestAnswer(answer, state) { /* handle Test answer */ },
});
```

This module is **future work** — the Relative Key Trainer implements the pattern directly first. Once a second game adopts it, extract the shared parts.

---

## 7. Relative Key Trainer — Concrete Implementation

This section defines exactly what the Relative Key Trainer does in each phase for Tier 1 and Tier 2, using the existing components.

### Tier 1: "Major or Minor?"

**Learn (3 examples):**

1. "This is C major. Three notes — C, E, G — stacked to make a bright, happy sound."
   → `HarmonyState.setTriad('C', 'major')`. Audio plays I-IV-V-I in C major.
   → Tonnetz: C major highlighted, full annotations. Keyboard: C, E, G lit.

2. "Now listen to C minor. Same root note, but the middle note drops — E becomes E♭. Hear how it darkens?"
   → `HarmonyState.setTransform('P', 'C', 'major')`. Audio plays i-iv-V-i in C minor.
   → Tonnetz: P transform animation (ghost C major → primary C minor). Keyboard: moving tone E→E♭.

3. "Here's G major..." → same pattern, different key.
   → `HarmonyState.setTriad('G', 'major')`, then `setTransform('P', 'G', 'major')`.

4. "One more. Listen without looking — then check if you were right."
   → Audio plays (F major or F minor, randomly). Tonnetz/keyboard hidden behind a "Reveal" button.
   → Player clicks Reveal to see the answer. Gentle transition to Practice.

**Practice (5-8 rounds):**

- Audio plays a chord progression (random major or minor from the easy key pool)
- Tonnetz shows the grid but NO triad highlighted
- Keyboard is in "both" mode — player can click keys to explore
- Two buttons: "Major" / "Minor"
- Player can click "Replay" for audio, or click keys on the keyboard to compare
- On answer:
  - Correct: Tonnetz lights up the triad, green feedback, "That's right — hear the [bright/dark] quality?"
  - Incorrect: Tonnetz lights up, red feedback, "This is actually [major/minor]. Listen again — hear how it sounds [brighter/darker]?" + auto-replays audio
- "Show me" button available if stuck (reveals without penalty, but noted in profile)
- No hard scoring — soft encouragement ("3 in a row!", "You're getting it!")

**Test (10 rounds):**

- Audio plays, no visual hints
- "Major" / "Minor" buttons
- Replay button
- After answer: full reveal (Tonnetz + keyboard highlight + audio replay)
- Score tracked: X/10
- Results screen: 8+ → "Tier 2 unlocked!", <8 → "Try again" or "Back to Practice"

### Tier 2: "Find the Relative"

**Learn (4 examples):**

1. "You know C major. Its relative minor is A minor — they share the same notes from the C major scale, but A minor uses A as home base instead of C."
   → `HarmonyState.setTriad('C', 'major')`. Pause. Then `setTransform('R', 'C', 'major')`.
   → Tonnetz: R transform animation. Keyboard: common tones (C, E) stay, G→A moves.
   → "See how only one note changed? C and E stayed put. G moved up to A."

2. "Here's another pair: G major and E minor."
   → Same pattern. "Every major key has a relative minor hiding inside it."

3. "F major and D minor." → Same pattern.

4. "Quick check — here's B♭ major. Can you guess the relative minor before I show you?"
   → Audio plays B♭ major. Pause. Player clicks "Show me."
   → R transform reveals G minor.

**Practice (5-8 rounds):**

- Audio plays a major chord progression
- Tonnetz shows the major triad highlighted (primary) with PLR neighbors visible but not highlighted
- "Which is the relative minor?" — three answer buttons (correct + 2 distractors)
- OR: "Click the relative minor on the Tonnetz" — player clicks a neighbor triangle
- On correct: R transform animation, minor progression plays, green feedback, "You found it! Notice how C and E stayed the same?"
- On incorrect: "That's [X minor] — the [parallel/leading-tone] neighbor. The *relative* is the R arrow." → animate to correct answer
- "Show me" button available

**Test (10 rounds):**

- Audio plays major progression
- Tonnetz shows grid only (no highlights)
- Three answer buttons
- After answer: R transform reveal animation
- Score: 8+ → Tier 3 unlocked

---

## 8. Real World Examples ("Hear It in Music")

Concepts stick when players connect them to music they already know. A collapsible "Hear it in music" panel is available throughout all three phases — during Learn, between Practice rounds, after Test results. It's not a phase, it's a companion.

### How It Surfaces

**In Learn narration (light touch):** The scripted Learn text can reference real music where it's natural, without making it the focus. Example: "Every major key has a relative minor. You've heard this — songs that feel like they shift between happy and sad without actually changing key are often moving between a major key and its relative minor."

**As a collapsible panel (main surface):** A "Hear it in music" button or expandable section that shows 2-3 curated examples for the current concept. Available in all phases. Content is filtered by the player's active lens from their profile.

**After Test results:** The results screen can include a "Now that you can hear it..." section with a featured example. This is reward content — you proved you understand the concept, here's where it lives in the wild.

### Content Scoped by Lens

The same concept gets different examples depending on the player's lens. A beginner doesn't need harmonic analysis of Eleanor Rigby. An experienced musician doesn't need "try humming Happy Birthday in minor."

| Lens | Tone | Example style |
|------|------|--------------|
| playful | Familiar, no jargon | "Happy Birthday sounds cheerful in major — try humming it starting lower and making it sound sad. That's minor!" |
| musician | Practical, reference real songs | "Eleanor Rigby — the verse sits on E minor while the melody hints at G major. That ambiguity between relative major and minor is what gives it tension." |
| theorist | Analytical, harmonic language | "The relative major/minor ambiguity in 'Eleanor Rigby' reflects Aeolian-Ionian modal interchange — the pitch collection is shared, but tonal center is established through bass motion and melodic emphasis." |
| math | Structural, group theory | "The R transform is an involution in the PLR group (order 2). Applying R twice returns to the original triad — this algebraic property is why relative major/minor feels like a 'toggle' rather than a 'journey.'" |

### Schema Extension

Extends the existing topic schema in `theory-content.js`:

```javascript
// Per topic — added alongside existing fields
real_world_examples: {
  playful: [
    {
      description: "Happy Birthday sounds cheerful in major. Hum it starting lower and make it sound sad — that's minor!",
      reference: null,
      audio_hint: null
    }
  ],
  musician: [
    {
      description: "Eleanor Rigby sits in E minor while the melody outlines G major. The ambiguity between relative keys is what gives it that unresolved, bittersweet quality.",
      reference: "Eleanor Rigby — The Beatles",
      audio_hint: "Listen to the opening strings vs. the vocal melody"
    },
    {
      description: "Stairway to Heaven opens in A minor and gradually modulates to its relative C major. The solo section is where C major fully arrives.",
      reference: "Stairway to Heaven — Led Zeppelin",
      audio_hint: "Compare the intro fingerpicking to the final solo section"
    }
  ],
  theorist: [
    {
      description: "The relative major/minor relationship in Rigby reflects Aeolian-Ionian modal interchange — shared pitch collection, tonal center established through bass motion and melodic emphasis rather than leading-tone resolution.",
      reference: "See Everett (2004), 'Making Sense of Rock's Tonal Systems'"
    }
  ]
}
```

### Design Constraints

- **No audio playback of copyrighted material.** We reference songs and describe what to listen for. The learning value comes from the player already knowing the song — "oh, THAT'S what's happening there."
- **Keep it short.** 1-3 sentences per example. This isn't a music history lecture.
- **Reference, not exhaustive.** 2-3 examples per lens per topic is plenty. Quality over quantity.
- **Authorable independently.** Examples can be added to topics without changing game code. A future content pass can bulk-add examples across all topics.
- **Cross-game reuse.** Any game that covers the `relative_minor_major` topic can pull the same examples. The examples live in the topic schema, not in the game.

### Implementation Notes

- The panel component reads `real_world_examples[activeLens]` from the current topic via `theory-content.js`
- Falls back gracefully if no examples exist for the active lens (hide the panel, don't show an empty state)
- The component is shared — build once, drop into any game page
- Not in scope for the initial Relative Key Trainer build. Add after the Learn/Practice/Test flow is solid. First priority is authoring the examples for `relative_minor_major` and `triads` topics.

---

## 9. Open Questions

1. **Should Learn auto-advance or require clicking "Next"?** Leaning toward: require "Next" so the player controls the pace. Auto-advancing feels rushed.

2. **How much Practice before suggesting Test?** Leaning toward: after 5 correct answers (not necessarily consecutive), show a subtle "Ready for the challenge?" prompt. But don't block — the Test tab is always clickable.

3. **Should Practice have scoring?** Leaning toward: no numerical score, but track streak and show encouraging feedback. Scoring adds pressure that undermines the exploratory feel.

4. **How does this interact with the education layer tips pill?** The tips pill (from Phase 2-3 work) should appear during all three phases. During Learn, it reinforces the narration. During Practice and Test, it provides on-demand theory context.

5. **Where does "Explore mode" (from the original spec) fit?** The original spec had a sandbox toggle within the game. This could be a fourth tab alongside Learn/Practice/Test, or it could be folded into Practice (since Practice is already semi-exploratory). Leaning toward: make it accessible from Practice as a "Free explore" toggle that removes the question prompts and lets the player just click around the Tonnetz and keyboard.

6. **Shared module timing.** Build the pattern directly in the Relative Key Trainer first. When the second game (probably Harmony Trainer) adopts it, extract `game-flow.js`. Don't abstract prematurely.

7. **Real world examples authoring.** With 34 topics × 2-4 lenses × 2-3 examples, that's potentially 200+ entries. LLM-assisted drafting with human curation is likely necessary. The musician and theorist lenses need accuracy — wrong harmonic analysis is worse than no example at all. **Action needed:** Author examples for 3-5 core topics by hand first to establish the voice, then consider batch generation.

---

## 10. Implementation Sequence

Replaces tasks 10.6-10.10 from the original `tonnetz-keyboard-component.md`:

| Task | Description | Sessions |
|------|-------------|----------|
| 10.6 | Refactor Relative Key Trainer: phase tabs UI, Learn phase for Tier 1 | 1-2 |
| 10.7 | Practice phase for Tier 1 (interactive Tonnetz, feedback system) | 1-2 |
| 10.8 | Test phase for Tier 1 (what exists now, cleaned up) | 1 |
| 10.9 | Learn + Practice + Test for Tier 2 ("Find the Relative") | 1-2 |
| 10.10 | Profile integration, phase transitions, localStorage persistence | 1 |
| 10.11 | Add Tonnetz/keyboard to Harmony Trainer (original 10.11-10.13) | 2-3 |
| 10.12 | Education layer wiring (tips, tooltips, intro screen) | 1 |

**Estimated total: 8-12 Claude Code sessions.**
