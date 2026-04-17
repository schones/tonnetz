# Polyrhythm Trainer — Game Spec (B8)

**Created:** 2026-04-16
**Status:** Spec — ready for implementation
**Type:** Performance game
**Theme:** Dark DAW (matches Explorer/SkratchLab)
**Route:** `/games/polyrhythm`
**Template:** `templates/games/polyrhythm.html`
**JS:** `static/games/polyrhythm.js`
**Depends on:** `onset-detection.js`, `input-provider.js`, `audio-input.js`, `game-shell.css`, `design-tokens.css`

---

## Overview

Guitar Hero-style falling-note game that teaches rhythmic independence — the ability to hear and play two independent rhythm layers simultaneously. Two vertical lanes (purple and gold), notes fall toward receptor rings at the bottom, player taps in time. Visual design emphasizes the relationship between the two layers through wave interference patterns.

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

Horizontal band at y = ~88% of canvas height. Subtle white gradient glow across full width.

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

Overlay at top of canvas, not inside the dark stage area:
- Layer A accuracy (percentage)
- Streak count
- Layer B accuracy (percentage)

### Scrolling Grid

Faint horizontal lines scroll downward at tempo speed (~0.03 alpha). Gives sense of motion and speed.

---

## Game Levels

| Level | Name | Player action | Layer A audio | Layer B audio | Input modes |
|---|---|---|---|---|---|
| 0 | Listen | None — watch and listen | Auto-plays | Auto-plays | None |
| 1 | Feel it | Tap along with ONE layer (player chooses which) | Auto or player | Auto or player | onset (mic/key), midi pad, click |
| 2 | Split it | Tap BOTH layers simultaneously | Player-driven | Player-driven | Two keys (F/J), two MIDI pads, click left/right |
| 3 | Real songs | Play polyrhythms from song examples at tempo | Player-driven | Player-driven | Same as Level 2 |

### Level 0 — Listen

No scoring. Both layers play automatically. All visual elements active (falling notes, waves, convergence lines). Purpose: build the mental model of what the polyrhythm looks and sounds like before attempting it.

Design question (deferred): should this be a separate intro screen or the first 4 bars of every attempt? Start with "first 4 bars auto-play, then scoring begins" — smoother UX.

### Level 1 — Feel it

Player picks one layer to tap. The other plays automatically. Scoring applies only to the tapped layer. This is where `onset-detection.js` shines — player can clap, tap a desk, say "ta", or press a key.

**Constraint:** single mic = single onset stream. Player can only tap one layer via mic. The other layer must auto-play. Two keyboard keys or two MIDI pads allow tapping both even at Level 1, but the game doesn't require it.

### Level 2 — Split it

Both layers are player-driven. Requires two separate input channels:
- Two keyboard keys: F (Layer A) and J (Layer B)
- Two MIDI pads (configurable)
- Click/tap left half vs right half of canvas

**Mic input cannot drive Level 2** — a single onset stream can't distinguish which layer the tap belongs to. The input picker should gray out mic-onset for Level 2 or auto-switch to keyboard.

### Level 3 — Real songs

Polyrhythm patterns sourced from `song-examples.js` entries with rhythm data. Song context card displayed above the stage. Tempo locked to the song's BPM. Links back to Explorer walkthrough for the song.

---

## Polyrhythm Progression

| Polyrhythm | Difficulty | BPM range | Song connection |
|---|---|---|---|
| 2:3 | Starter | 60–120 | "Foundation of waltz-against-duple feel" |
| 3:2 | Starter | 60–150 | Linus and Lucy (Vince Guaraldi, ~150 bpm) |
| 3:4 | Intermediate | 60–120 | Afro-Cuban clave, "Oye Como Va" |
| 4:3 | Intermediate | 60–120 | Reverse of 3:4 — tests flexibility |
| Dotted quarter vs straight eighth | Intermediate | 80–150 | Linus and Lucy (implied polyrhythm) |
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

Each layer scored independently. Total accuracy = (good + perfect) / total taps per layer.

### Adaptive Engine (Pattern B)

Three independent axes:

**1. Rhythmic complexity**
- Promote: 2:3 → 3:2 → 3:4 → 4:3 → 5:4
- Threshold: 5 consecutive Good-or-better on both layers

**2. Tempo**
- Promote: +10 BPM after 3 consecutive bars at >80% accuracy
- Demote: -10 BPM after 2 consecutive bars at <50% accuracy
- Floor: 50 BPM. Ceiling: 200 BPM.

**3. Timing tolerance**
- Promote: Good window narrows from ±120 ms → ±90 ms → ±60 ms
- Threshold: 80%+ accuracy sustained for 8 bars

### ResultDetail Schema

```json
{
  "gameId": "polyrhythm",
  "timestamp": "ISO",
  "mode": "practice",
  "difficulty": { "polyrhythm": "3:2", "bpm": 150, "tolerance": 120 },
  "duration": 45,
  "correct": true,
  "detail": {
    "polyrhythm": "3:2",
    "bpm": 150,
    "layer1": [
      { "expected": 0.0, "actual": 0.018, "deltaMs": 18, "rating": "perfect" },
      { "expected": 0.667, "actual": 0.702, "deltaMs": 35, "rating": "perfect" },
      { "expected": 1.333, "actual": 1.450, "deltaMs": 117, "rating": "good" }
    ],
    "layer2": [
      { "expected": 0.0, "actual": 0.025, "deltaMs": 25, "rating": "perfect" },
      { "expected": 1.0, "actual": 1.155, "deltaMs": 155, "rating": "miss" }
    ],
    "perLayerAccuracy": { "a": 100, "b": 50 },
    "streak": 4
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
  analyser: toneAnalyser,  // for onset detection
});
```

### Input Mapping

| Source | Layer A | Layer B | Level 2 capable? |
|---|---|---|---|
| Keyboard | F key | J key | Yes |
| MIDI pads | Pad 1 (configurable) | Pad 2 (configurable) | Yes |
| Mic onset | Single stream — player picks layer | — | No (one stream) |
| Click/tap | Left half of canvas | Right half of canvas | Yes |

### Onset Detection Wiring

When mic_onset is active:
1. `onset-detection.js` fires `{ timestamp, strength }` events
2. Game routes onset to whichever layer the player selected (Level 1 only)
3. Strength threshold filters weak onsets (ambient noise)
4. Input picker grays out mic_onset option when Level 2 is selected

---

## Audio Architecture

Uses raw Web Audio API (not Tone.js sampler) for the game sounds — minimal latency, no sample loading. The `Tone.Analyser` is needed only if onset detection (mic input) is active.

**Audio scheduling:** use the Web Audio API scheduler pattern (lookahead + setTimeout at 20–25 ms intervals) for sample-accurate beat timing. Same pattern as the prototype.

**Future:** replace sine-wave placeholders with sampled percussion sounds (woodblock, clave, kick). Load via `fetch` + `AudioContext.decodeAudioData`.

---

## Template Structure

```
templates/games/polyrhythm.html
├── extends base.html (dark theme variant)
├── game-shell.css (shared game chrome)
├── Setup screen
│   ├── Polyrhythm selector (dropdown)
│   ├── Level pills (Listen / Feel it / Split it / Real songs)
│   ├── BPM slider (40–200)
│   ├── Input picker (from input-provider.js)
│   └── Start button
├── Game stage (canvas)
│   ├── HUD overlay (accuracy, streak)
│   └── Message bar (level instructions)
├── Results screen
│   ├── Per-layer accuracy
│   ├── Best streak
│   ├── Timing histogram (optional, future)
│   └── Song connection card
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

1. **Level 0 as intro vs first-4-bars:** prototype uses a manual level toggle. Production version should auto-play 4 bars before scoring begins, with a visual countdown ("3... 2... 1... Go!"). The level selector then controls which levels are available, not the intro behavior.

2. **MIDI pad mapping:** which pads on the Launchkey 49 map to Layer A and Layer B? Pads are on channel 10. Need to test with actual hardware. Default: first two pads in the bottom row.

3. **Sampled sounds:** woodblock/clave samples vs synthesized. Samples sound better but add loading time and file size. Start with synthesized, upgrade to samples when the SkratchLab instrument selection system is built.

4. **Dark theme for all Performance games:** this game establishes a precedent. Should Rhythm Lab, Strum Patterns, Swing Trainer also get the dark treatment? Deferred — note in design-system-reference.md.

5. **Mobile touch:** two-thumb tap for Level 2 on mobile — left thumb / right thumb on canvas halves. Needs testing. The `pointerdown` event handler already splits by x-position.
