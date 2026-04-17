# Polyrhythm Trainer — Game Spec (B8)

**Created:** 2026-04-16
**Updated:** 2026-04-17
**Status:** v2 — Practice/Challenge mode redesign
**Type:** Performance game
**Theme:** Dark DAW (matches Explorer/SkratchLab)
**Route:** `/games/polyrhythm`
**Template:** `templates/games/polyrhythm.html`
**JS:** `static/games/polyrhythm.js`
**Depends on:** `onset-detection.js`, `input-provider.js`, `audio-input.js`, `game-shell.css`, `design-tokens.css`

---

## Overview

Guitar Hero-style falling-note game that teaches rhythmic independence — the ability to hear and play two independent rhythm layers simultaneously. Two vertical lanes (purple and gold), notes fall toward receptor rings, player taps drum pads in time. Visual design emphasizes the relationship between the two layers through wave interference patterns.

Two modes: **Practice** (structured training ramp for a specific polyrhythm) and **Challenge** (arcade-style adaptive difficulty). Practice Mode is the core pedagogical tool — it walks the player through learning one polyrhythm from slow to performance tempo. Challenge Mode is the show-off arcade for experienced players.

First game built natively on `input-provider.js` and `onset-detection.js`.

---

## Visual Design

### Stage

Dark background (#111), full-width canvas. Two vertical lanes positioned at 33% and 67% of canvas width. Lane colors: purple (#7F77DD / #534AB7) for Layer A, gold (#EF9F27 / #BA7517) for Layer B.

### Falling Notes

Notes spawn at the top of the canvas and fall toward the hit zone near the bottom.

**Ghost-to-solid fade:** notes start as barely-visible outlines at the top (alpha ~0.08, radius ~4px, stroke width ~1px) and gradually materialize as they approach the hit zone (alpha ~1.0, radius ~12px, stroke width ~2.5px). Progression is linear based on vertical position.

**Note anatomy:**
- Outer ring: colored stroke, thickens with proximity
- Fill: semi-transparent, same hue
- Inner dot: smaller solid circle at center (~35% of note radius)
- Trail: faint vertical stroke extending upward from the note (~0.06 alpha)
- Pulse halo: when note is within ~12% of hit zone, animated ring expands/contracts at ~14 Hz

### Hit Zone

Horizontal band at y = HIT_Y (~67% of canvas height, 280px of 420px). Subtle white gradient glow across full width. Notes that miss continue falling below and fade out before reaching the canvas bottom.

**Receptor rings:** hollow circles at each lane's x-position. Default state: faint colored stroke (alpha 0.2). On tap: bright flash (alpha 0.8), expanding ring, radial color bloom behind.

### Feedback

**Particle burst:** 12–14 particles on good/perfect hit. Spawn from receptor position, random angles, gravity pulls down, life ~1 second, colored to match lane.

**Combo text:** "Perfect" (±40 ms, purple tint), "Good" (±120 ms, white), "Miss" (>120 ms, red). Floats upward from hit zone, fades over 0.5 seconds.

**Streak glow:** at 5+ streak, subtle full-canvas tint pulses at ~4 Hz.

### Background Waves

Three wave layers rendered behind the notes:

**1. Lane breathing:** Each lane's edges undulate with Gaussian pulse shapes at beat positions. The lane walls expand/contract with the rhythm. Uses `exp(-sharpness * d²)` envelope where `d` is distance from beat position in time. Ghost at top of canvas, stronger near hit zone (same fade gradient as notes).

**2. Interference wave:** Subtle combined waveform in the center gap between the two lanes. Width = average of both layers' pulse values. Where beats align, it widens. Where they diverge, it narrows. This visualizes the polyrhythm as wave interference. Very subtle (max alpha ~0.04).

**3. Radial bloom:** On hit, soft radial gradient expands from receptor (radius ~80px, fades over ~200 ms). Colored to match lane.

### Convergence Lines

When both layers have beats at the same time position (bar downbeat, etc.), a faint dashed horizontal line connects the two lanes at that y-position. Fades in with proximity like everything else.

### HUD

Overlay at top of canvas:
- Phase indicator: step progress showing `Listen → Layer A → Layer B → Both → ✓`. Active phase highlighted, completed phases filled.
- Current BPM → Goal BPM with visual progress bar between them
- Layer A accuracy (percentage)
- Streak count
- Layer B accuracy (percentage)

### Drum Pads

Two large pad elements rendered as **HTML elements below the canvas** (not drawn on canvas). These are the primary tap targets.

```
┌─────────────────┐  ┌─────────────────┐
│                 │  │                 │
│    ●  Layer A   │  │    ●  Layer B   │
│       [ F ]     │  │       [ J ]     │
│                 │  │                 │
└─────────────────┘  └─────────────────┘
     purple              gold
```

**Behavior:**
- Click/tap on pad = same as pressing the mapped key
- On hit: pad flashes bright (matching lane color bloom), subtle scale animation (0.97 → 1.0)
- On miss: brief red tint or horizontal shake
- Key label (F / J) always visible so players learn the keyboard shortcut
- In single-layer phases: the inactive layer's pad dims to ~30% opacity
- In Both phase: both pads full brightness
- Pad styling: dark background matching stage (#222), colored border matching lane, rounded corners (border-radius-lg), min-height ~80px for comfortable touch targets

**Why HTML not canvas:** proper touch event handling (multi-touch for two-thumb Phase 4 on mobile), accessibility, no interference with canvas rendering. Canvas is the visual display; pads are the input surface.

### Scrolling Grid

Faint horizontal lines scroll downward at tempo speed (~0.03 alpha). Gives sense of motion and speed.

---

## Game Modes

### Setup Screen

| Field | Control | Default | Notes |
|---|---|---|---|
| Mode | Toggle: Practice / Challenge | Practice | Practice = structured ramp; Challenge = arcade |
| Polyrhythm | Dropdown: 3:2, 2:3, 4:3, 3:4, 5:4 | 3:2 | Manual selection (not adaptive) |
| Goal BPM | Slider 60–200 | 150 | Practice mode only |
| Start BPM | Slider 40–goal | 60 | Practice mode only |
| BPM increment | Pills: 5 / 10 / 15 / 20 | 10 | How much to speed up on promotion |

**Preset buttons** for common targets (fill polyrhythm + goal BPM automatically):
- "Linus and Lucy" → 3:2 @ 150
- "Oye Como Va" → 3:4 @ 120
- "Mission Impossible" → 5:4 @ 100

---

### Practice Mode — Structured Training Ramp

The core pedagogical tool. Walks the player through mastering one polyrhythm from slow to performance tempo in five phases.

**Phase flow:**

```
Phase 1: LISTEN (4 bars at start BPM)
  → auto-advances (or press Space / click "Ready" to skip ahead)

Phase 2: LAYER A (4 bars per tempo step, ramp from start → goal BPM)
  → accuracy ≥ 80% for 4 bars → BPM += increment
  → accuracy < 50% for 4 bars → BPM -= increment (floor: start BPM)
  → BPM reaches goal → advance to Phase 3

Phase 3: LAYER B (same ramp structure)
  → BPM resets to start, ramps to goal
  → advance to Phase 4

Phase 4: BOTH LAYERS (same ramp structure)
  → requires two inputs (F+J, two pads, two MIDI pads)
  → BPM resets to start, ramps to goal
  → advance to Phase 5

Phase 5: VICTORY / RESULTS
```

#### Phase 1 — Listen

No scoring. Both layers auto-play. All visual elements active (falling notes, waves, convergence lines). Purpose: build the mental model of what the polyrhythm sounds like.

Duration: 4 bars, then auto-advances. Player can press Space or click "I'm ready" to skip ahead early. Message: "Listen — hear how the two patterns interlock."

Both drum pads dimmed to ~30%.

#### Phase 2 — Layer A

Layer A: player taps (F key, left pad, or mic onset). Layer B: auto-plays. Scoring on Layer A only.

Layer B's pad dimmed to ~30%. Layer B's falling notes slightly desaturated.

BPM ramp logic (per 4-bar window):
- Accuracy ≥ 80% → BPM += increment. Toast: "80 → 90 bpm"
- Accuracy < 50% → BPM -= increment (floor: start BPM). Toast: "Slowing down..."
- 50–80% → hold current BPM. No toast.
- BPM reaches goal → brief celebration, advance to Phase 3

Message: "Tap the purple rhythm"

#### Phase 3 — Layer B

Mirror of Phase 2. Layer B: player taps (J key, right pad, or mic onset). Layer A: auto-plays.

BPM resets to start BPM for a fresh ramp. Layer A's pad dimmed.

Message: "Now tap the gold rhythm"

#### Phase 4 — Both

Both layers player-driven. Requires two separate inputs:
- Two keyboard keys: F (Layer A) and J (Layer B)
- Two drum pads (click/touch)
- Two MIDI pads

**Mic onset cannot drive Phase 4** — a single onset stream can't distinguish which layer the tap belongs to. If mic is the active modality, show message: "Both layers needs two inputs — use the pads, F/J keys, or MIDI pads." Mic stays available but routes to whichever single layer the player used in Phase 2/3.

Both pads full brightness. BPM resets to start BPM for a fresh ramp.

Message: "Both hands — one rhythm each"

#### Phase 5 — Victory / Results

```
3:2 Polyrhythm — Practice Complete!

Phase        Final BPM    Accuracy
Layer A      150 bpm      92%
Layer B      150 bpm      87%
Both         130 bpm      74%   ← didn't reach goal

Total time: 3m 42s

[Hear it in a song: Linus and Lucy — Vince Guaraldi]

[Try again at 130]  [New goal: 160]  [New polyrhythm]
```

"Try again at 130" sets start BPM to where the player stalled — skip the easy part.

**Phase transitions:** smooth, not jarring. Between phases, a 2-bar transition where the message changes and the next layer's receptor ring / drum pad pulses to draw attention. Music keeps going — no loading screen, no modal.

**Skip controls:** "Skip to Both" button jumps to Phase 4 at start BPM. For experienced players who don't need single-layer practice.

---

### Challenge Mode — Arcade

Separate mode toggle. This is the adaptive arcade experience.

```
- Starts at user-selected polyrhythm, 80 bpm
- Both layers always active
- Three adaptive axes (Pattern B):
  1. Tempo: +10 BPM after 3 bars at >80% accuracy
  2. Polyrhythm complexity: switches after 16 bars at >80%
     Progression: 2:3 → 3:2 → 3:4 → 4:3 → 5:4
  3. Timing tolerance: ±120ms → ±90ms → ±60ms
     after 8 bars at >80%
- Score accumulates endlessly (Perfect*300 + Good*100)
- Session ends when player quits or accuracy drops below 30% for 4 bars
- Leaderboard (localStorage)
- "How far can you get?"
```

---

## Polyrhythm Library

| Polyrhythm | Difficulty | BPM range | Song connection |
|---|---|---|---|
| 2:3 | Starter | 60–120 | "Foundation of waltz-against-duple feel" |
| 3:2 | Starter | 60–150 | Linus and Lucy (Vince Guaraldi, ~150 bpm) |
| 3:4 | Intermediate | 60–120 | Afro-Cuban clave, "Oye Como Va" |
| 4:3 | Intermediate | 60–120 | Reverse of 3:4 — tests flexibility |
| 5:4 | Advanced | 50–100 | Mission Impossible theme |
| 7:4 | Advanced | 50–80 | Progressive rock, "Money" (Pink Floyd) |

---

## Sounds

Two distinct timbres so the player can hear layers separately:

- **Layer A (purple):** High percussive — woodblock, clave, or rimshot. Sine wave at 880 Hz with fast exponential decay as placeholder; replace with sampled sound.
- **Layer B (gold):** Low percussive — kick-adjacent, tom, or low woodblock. Sine wave at 260 Hz with slightly longer decay as placeholder.

**Metronome click:** optional faint click on the downbeat (bar start) for orientation. Off by default, toggle in settings.

**Solo/mute:** each layer has a mute toggle. Muting a layer silences its auto-play but still shows the falling notes — visual-only practice.

---

## Scoring

### Timing Windows

| Rating | Window | Points |
|---|---|---|
| Perfect | ±40 ms | 300 |
| Good | ±120 ms | 100 |
| Miss | >120 ms | 0, breaks streak |

Fixed windows — no adaptive tolerance in Practice Mode. Tolerance axis only active in Challenge Mode.

Each layer scored independently. Total accuracy = (good + perfect) / total taps per layer.

### ResultDetail Schema

**Practice Mode:**
```json
{
  "gameId": "polyrhythm",
  "timestamp": "ISO",
  "mode": "practice",
  "difficulty": { "polyrhythm": "3:2", "goalBpm": 150, "startBpm": 60, "increment": 10 },
  "duration": 222,
  "correct": true,
  "detail": {
    "polyrhythm": "3:2",
    "phases": {
      "layerA": { "finalBpm": 150, "accuracy": 92, "reachedGoal": true },
      "layerB": { "finalBpm": 150, "accuracy": 87, "reachedGoal": true },
      "both":   { "finalBpm": 130, "accuracy": 74, "reachedGoal": false }
    },
    "perTap": {
      "layer1": [ { "expected": 0.0, "actual": 0.018, "deltaMs": 18, "rating": "perfect", "phase": "layerA", "bpm": 90 } ],
      "layer2": [ { "expected": 0.0, "actual": 0.025, "deltaMs": 25, "rating": "perfect", "phase": "layerB", "bpm": 80 } ]
    },
    "streak": 14
  }
}
```

**Challenge Mode:**
```json
{
  "gameId": "polyrhythm",
  "timestamp": "ISO",
  "mode": "challenge",
  "difficulty": { "polyrhythm": "4:3", "bpm": 130, "tolerance": 90 },
  "duration": 180,
  "correct": true,
  "detail": {
    "finalPolyrhythm": "4:3",
    "finalBpm": 130,
    "finalTolerance": 90,
    "score": 12400,
    "streak": 22,
    "polyrhythmProgression": ["2:3", "3:2", "3:4", "4:3"]
  }
}
```

---

## Input Integration

### Input Provider Config

```js
createInputProvider({
  gameId: 'polyrhythm-trainer',
  supported: {
    click: true,
    midi: true,
    onset: { mic: true, interface: true },
  },
  containerEl: document.getElementById('input-picker'),
  analyser: toneAnalyser,
});
```

### Input Mapping

| Source | Layer A | Layer B | Phase 4 (Both) capable? |
|---|---|---|---|
| Drum pads (HTML) | Left pad click/touch | Right pad click/touch | Yes (multi-touch) |
| Keyboard | F key | J key | Yes |
| MIDI pads | Pad 1 (configurable) | Pad 2 (configurable) | Yes |
| Mic onset | Single stream — routes to active layer | — | No (single stream) |

### Mic Onset Routing Per Phase

| Phase | Mic behavior |
|---|---|
| Listen | Disabled (no input accepted) |
| Layer A | Onset routes to Layer A |
| Layer B | Onset routes to Layer B |
| Both | Routes to last single-layer phase used; message suggests switching to pads/keys |

### Onset Detection Wiring

When mic_onset is active:
1. `onset-detection.js` fires `{ timestamp, strength }` events
2. Game routes onset based on current phase:
   - Phase 2 (Layer A): onset → Layer A tap
   - Phase 3 (Layer B): onset → Layer B tap
   - Phase 4 (Both): onset → last single-layer used; message suggests pads/keys
3. Strength threshold filters weak onsets (ambient noise)
4. In Phase 4, show hint: "Mic supports one layer. Use pads or F/J for both."

---

## Audio Architecture

Uses raw Web Audio API (not Tone.js sampler) for the game sounds — minimal latency, no sample loading. The `Tone.Analyser` is needed only if onset detection (mic input) is active.

**Audio chain:** `oscillator → layerGain (A or B) → masterGain → destination`. Layer gains handle per-layer muting instantly. Master gain is torn down and rebuilt on tempo/polyrhythm changes to silence pre-scheduled oscillators in the lookahead buffer.

**Audio scheduling:** Web Audio API scheduler pattern (lookahead + setTimeout at 20–25 ms intervals) for sample-accurate beat timing.

**Future:** replace sine-wave placeholders with sampled percussion sounds (woodblock, clave, kick). Load via `fetch` + `AudioContext.decodeAudioData`.

---

## Template Structure

```
templates/games/polyrhythm.html
├── extends base.html (dark theme variant)
├── game-shell.css (shared game chrome)
├── Setup screen
│   ├── Mode toggle (Practice / Challenge)
│   ├── Polyrhythm selector (dropdown)
│   ├── Preset buttons (Linus and Lucy, Oye Como Va, etc.)
│   ├── Goal BPM slider (Practice only)
│   ├── Start BPM slider (Practice only)
│   ├── BPM increment pills (5/10/15/20)
│   ├── Input picker (from input-provider.js)
│   └── Start button
├── Game stage (canvas)
│   ├── Phase indicator (Listen → A → B → Both → ✓)
│   ├── BPM progress (current → goal)
│   ├── HUD overlay (accuracy, streak)
│   └── Message bar (phase instructions)
├── Drum pads (HTML, below canvas)
│   ├── Left pad (Layer A, purple, [F])
│   └── Right pad (Layer B, gold, [J])
├── Results screen
│   ├── Per-phase accuracy breakdown
│   ├── Best streak
│   ├── Song connection card
│   └── Action buttons (Try again / New goal / New polyrhythm)
└── Mute toggles (Layer A / Layer B)
```

### Dark Theme

The game uses the dark DAW theme. Template should set `data-theme="dark"` on body or use the Explorer's dark token set. Key tokens:
- Background: #111 (canvas), #1a1a1a (chrome)
- Text: #e0ddd4 (primary), rgba(255,255,255,0.4) (secondary)
- Borders: rgba(255,255,255,0.06–0.12)
- Accent: #7F77DD (purple), #EF9F27 (gold)

### Note on Consistency

This is the first game using the dark DAW theme. All other games currently use the warm light theme. Whether other Performance games adopt dark theme is a future design decision. The game should use design tokens so the theme is swappable. Add a note in `docs/design-system-reference.md` about the dark game variant.

---

## Song Connections

From `song-examples.js`:
- "That's the Linus and Lucy feel — Vince Guaraldi's dotted quarter against straight eighths."
- "Oye Como Va uses a 3:4 clave pattern."
- "Mission Impossible theme is built on 5:4."

Game surfaces "Hear it in a song" callouts linking to Explorer walkthroughs where relevant entries exist. Uses `CONCEPT_GAME_MAP` for deep-linking.

---

## File Inventory

| File | Purpose |
|---|---|
| `templates/games/polyrhythm.html` | Jinja2 template extending base.html |
| `static/games/polyrhythm.js` | Game logic, canvas renderer, audio scheduler |
| `static/games/polyrhythm.css` | Game-specific styles (dark theme overrides, canvas layout) |
| `docs/polyrhythm-trainer-spec.md` | This spec |

---

## Open Questions

1. **~~Level 0 as intro vs first-4-bars~~** — Resolved: Practice Mode Phase 1 (Listen) auto-plays 4 bars, player can skip with Space or "I'm ready" click.

2. **MIDI pad mapping:** which pads on the Launchkey 49 map to Layer A and Layer B? Pads are on channel 10. Need to test with actual hardware. Default: first two pads in the bottom row.

3. **Sampled sounds:** woodblock/clave samples vs synthesized. Samples sound better but add loading time and file size. Start with synthesized, upgrade to samples when the SkratchLab instrument selection system is built.

4. **Dark theme for all Performance games:** this game establishes a precedent. Should Rhythm Lab, Strum Patterns, Swing Trainer also get the dark treatment? Deferred — note in design-system-reference.md.

5. **Mobile drum pads:** two-thumb tap on the HTML drum pads should work via multi-touch. Needs testing on real devices. The pads should be large enough for comfortable thumb targets (~80px min-height).

6. **Phase transition smoothness:** the 2-bar transition between phases where the message changes and the next layer's pad pulses — how exactly should this feel? Should the music stop momentarily, or should it crossfade seamlessly? Start with seamless (music keeps going) and iterate.

7. **"Skip to Both" button:** should this be visible during single-layer phases (as an escape hatch for experienced players), or only on the setup screen? Leaning toward always visible during play — small "Skip →" link near the phase indicator.
