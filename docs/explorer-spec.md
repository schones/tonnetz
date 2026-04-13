# Tonnetz Explorer — Specification

## Overview

The Tonnetz Explorer is a standalone interactive tool that synchronizes three music theory visualizations into a single unified view. Users can interact with any panel — click a note, select a chord, apply a transform — and all panels update in concert.

*Note: The original spec described four panels including a separate Note Wheel. The chord wheel's dual-ring design inherently shows all 12 pitch classes in circle-of-fifths order, making the Note Wheel redundant. The Explorer ships with three panels: Tonnetz Neighborhood, Chord Wheel, and Keyboard.*

### Strategic Role

The Explorer serves three purposes:

1. **Standalone tool** — A "Tonnetz Playground" where users freely explore notes, chords, and harmonic relationships across multiple visual representations simultaneously.
2. **Component showcase / ground truth** — The canonical reference implementation of all shared visualization components. If the Explorer looks right, every game that draws from the same components inherits correctness.
3. **Foundation for the intro module** — The intro module can be structured as a guided tour that progressively reveals each Explorer panel chapter by chapter, culminating in the full Explorer as the "graduation" tool.

---

## Panels

### 1. Tonnetz Neighborhood

The primary visualization. A hexagonal lattice showing the local region around the current chord.

- **Depth selector** — Default: 2. Range: 1–4. Controls how many hops from the current chord are visible.
  - Depth 1: Current triad + 6 immediate neighbors
  - Depth 2: Two hops out — enough to see PLR chains and relative/parallel relationships
  - Depth 3+: For advanced users exploring longer transform chains
- **Chord coloring** — Major triads and minor triads rendered in distinct colors (e.g., warm for major, cool for minor — exact palette TBD, should match platform accent color system).
- **PRL arrows** — Transform arrows displayed on the lattice edges showing available P, R, and L operations from the current chord. These are a distinctive feature of our platform and should be present uniformly.
- **Node interaction** — Clicking a node selects that note. Clicking a triangle selects that chord.
- **Orientation (CANONICAL — applies platform-wide):**
  - Horizontal axis: **Perfect Fifths** (7 semitones, increasing to the right)
  - Diagonal up-right: **Major Thirds** (4 semitones)
  - Diagonal down-right: **Minor Thirds** (3 semitones)
  - Major triads form upward-pointing triangles (△)
  - Minor triads form downward-pointing triangles (▽)
  - This orientation is the platform standard. All games, tools, and the intro module must match it.

**Existing component:** `tonnetz-neighborhood.js` — may need enhancement for chord-quality coloring and click-to-select interactions.

### 2. Keyboard

A piano keyboard view synchronized with the current harmonic state.

- **Highlighted chord tones** — Active chord tones highlighted in the chord's color.
- **Clickable** — Clicking a key adds/removes a note from the selection, triggering chord detection across all panels.
- **Range** — 2 octaves centered on the current chord's register (scrollable or transposable).
- **Note labels** — Optional toggle for note names on keys.

**Existing component:** `keyboard-view.js` — already functional in Chord Walks. May need click-to-select enhancement.

### ~~3. Note Wheel (Circle of Fifths)~~ — DEFERRED

*The chord wheel's dual-ring design inherently shows all 12 pitch classes in circle-of-fifths order, making a separate Note Wheel redundant. The Explorer ships with three panels. If a standalone pitch-class display is needed later, it can be added as a composable panel.*

### 3. Chord Wheel (Dual-ring diatonic arc)

A dual-ring circle-of-fifths display that highlights the diatonic "window" for the selected key. Chosen design: **Approach 3 (Highlighted Arc)** from prototyping.

**Design concept:** Both rings are always the full circle of fifths. Selecting a key highlights the contiguous arc of 7 diatonic chords — visually teaching that diatonic harmony is a *sliding window* on the circle of fifths.

- **Outer ring** — All 12 major keys arranged in circle-of-fifths order. Diatonic major chords (I, IV, V) are highlighted in blue; non-diatonic keys are dimmed. The selected key is accented in purple.
- **Inner ring** — All 12 relative minor keys in circle-of-fifths order. Diatonic minor chords (ii, iii, vi) are highlighted in coral/warm; non-diatonic minors are dimmed.
- **Diatonic arc shading** — A subtle background arc highlights the contiguous diatonic region on each ring, reinforcing the "window" concept.
- **Roman numeral labels** — Diatonic chords display their function (I, ii, iii, IV, V, vi) adjacent to the node.
- **Relative key connections** — Lines between outer and inner rings connect relative major/minor pairs when both are diatonic.
- **Clickable key selection** — Clicking any key on either ring re-centers the diatonic window on that key, updating all panels.
- **Current chord highlight** — When a chord is selected on any panel, the chord wheel highlights it in its diatonic context.
- **Functional context** — When a chord is selected, the wheel can show where it functions across multiple keys (e.g., "Am is vi in C, ii in G, iii in F").

**Existing component:** `chord-wheel.js` — built and functional.

---

## Interaction Model

### HarmonyState as Central Hub

All three panels communicate through the existing `HarmonyState` pub/sub system. The flow:

```
User clicks anywhere (keyboard, Tonnetz node, wheel)
  → Event dispatched to HarmonyState
    → HarmonyState updates current state (active notes, detected chord, current key)
      → All subscribed panels re-render
```

### State Properties

HarmonyState should track (extending current implementation as needed):

- `activeNotes` — Set of currently active pitch classes
- `currentChord` — Detected chord object: `{ root, quality, name, notes }`
- `currentKey` — Currently selected key context (for chord wheel functional analysis)
- `previousChord` — For displaying the most recent transform (PRL arrow context)
- `transform` — The PLR operation that moved from `previousChord` to `currentChord` (if applicable)

### Interaction Modes

1. **Note mode** — User clicks individual notes. Chord detection runs automatically. If 3+ notes form a recognized chord, all panels highlight accordingly.
2. **Chord mode** — User clicks a chord directly (triangle on Tonnetz, chord on wheel). All notes populate automatically.
3. **Transform mode** — User clicks a PRL button or arrow. The current chord transforms, and the new chord propagates to all panels. The Tonnetz neighborhood animates/transitions to re-center on the new chord.

---

## Audio Integration

- **Chord playback** — Selecting a chord triggers audio playback via the existing `music-engine.js` / Tone.js / Salamander sampler stack.
- **Arpeggiate option** — Toggle to arpeggiate chord tones on selection (hear the notes individually, then together).
- **Sustained mode** — Notes hold until explicitly released, allowing exploration of extensions (add a 7th, etc.).
- **Mute toggle** — For silent exploration.

---

## Layout

### Desktop (primary)

```
┌─────────────────────────────────────────────────┐
│                 Tonnetz Explorer                  │
├──────────────────────┬──────────────────────────┤
│                      │                           │
│   Tonnetz            │    Chord Wheel            │
│   Neighborhood       │    ○                      │
│                      │                           │
├──────────────────────┴──────────────────────────┤
│              Keyboard                            │
├──────────────────────────────────────────────────┤
│  [P] [R] [L]    Depth: [2 ▾]    Key: [C ▾]     │
│  ♪ Sound [on]   Arpeggiate [off]                │
└─────────────────────────────────────────────────┘
```

- Tonnetz neighborhood gets the largest area (left/top).
- Chord wheel sits to the right of the Tonnetz.
- Keyboard spans the full width below.
- Controls bar at the bottom: PRL buttons, depth selector, key selector, audio toggles.

### Mobile

Stack vertically: Tonnetz → Chord Wheel → Keyboard → Controls. Consider a tab/swipe interface for panels if screen real estate is too tight.

---

## Component Reuse Plan

| Component | Status | Notes |
|---|---|---|
| `tonnetz-neighborhood.js` | ✅ Built | Chord-quality coloring, click-to-select, canonical orientation, glow worm path overlay |
| `keyboard-view.js` | ✅ Built | Highlight layer, click-to-select, octave-specific note input |
| `harmony-state.js` | ✅ Built | Pub/sub with `activeNotes`, `currentChord`, `currentKey`, Note Mode + Chord Mode |
| `chord-wheel.js` | ✅ Built | Dual-ring circle of fifths, diatonic arc, re-centers on assembled chord's key |
| `chord-bubble-renderer.js` | ✅ Built | Glow worm path visualization (replaced convex hull bubble) |
| `chord-resolver.js` | ✅ Built | Chord name identification with interval-content fallback |
| `fretboard-view.js` | **Planned** | Guitar fretboard as composable Explorer panel (pre-MVP) |
| `music-engine.js` | ✅ Built | Salamander sampler, chord playback |
| `transforms.js` | ✅ Built | PLR math, pitch utilities, interval utilities |

---

## Relationship to Other Games

Once the Explorer and its components are solid, other games become thin wrappers:

| Game | Explorer Panels Used | Additional Game Logic |
|---|---|---|
| Chord Walks | Tonnetz + Keyboard + PRL | Tier system, scoring, learn/practice/test flow |
| Harmony Trainer | Tonnetz + Keyboard | Chord progression exercises, functional analysis |
| Relative Key Trainer | Tonnetz + Keyboard | Relative key identification challenges |
| Intro Module | All — revealed progressively | Chapter-based guided narrative |
| Voicing Explorer (Phase A5) | All — chord shapes, projections | Glow worm paths, ChordResolver, interval projection, drag-to-transpose |
| Puzzle Paths (Phase F1) | Tonnetz + PRL | Pathfinding game, progression library |
| Fretboard (pre-MVP) | Fretboard + any combination | Composable panel for guitarists |

---

## Relationship to Intro Module

The intro module can be restructured as a progressive reveal of the Explorer:

- **Chapter 1–3** (existing): Musical foundations, intervals, chords — no Explorer panels yet.
- **Chapter 4**: "Meet the Tonnetz" — introduces the Tonnetz neighborhood panel alone.
- **Chapter 5**: "The Keyboard Connection" — adds the keyboard panel, shows how Tonnetz and keyboard are synchronized.
- **Chapter 6**: "The Circle of Fifths" — introduces the note wheel. Shows how the same notes appear in different visual contexts.
- **Chapter 7**: "Chords in Context" — introduces the chord wheel. Shows functional harmony (I, IV, V, vi).
- **Chapter 8**: "Transforms" — introduces PRL with arrows on the Tonnetz. All four panels now active.
- **Graduation**: Full Explorer unlocked as a standalone tool.

*Note: Chapter structure is illustrative — actual intro module chapters may differ. The key idea is progressive panel reveal.*

---

## Design Principles

1. **Internal consistency above all** — The Tonnetz orientation, coloring scheme, and PRL arrow style must be identical everywhere. The Explorer is the ground truth.
2. **Depth as progressive disclosure** — Default to simplicity (depth 2, basic chord detection). Advanced features (key analysis, extensions, arpeggiation) available but not in your face.
3. **Every click makes a sound** — Unless muted, interactions produce audio feedback. The tool should feel like an instrument.
4. **Lens system compatibility** — Content and labeling should respect the user's chosen lens (playful/musician/theorist/math) from the existing profile system. The chord wheel might show "happy chord" vs "I" vs "tonic triad" depending on lens.
5. **Composable panel architecture** — The three panels are not just "three views" — they are three cognitive entry points into the same musical concept. Each panel must be loadable individually or in any combination. No panel should assume the others exist; all communication goes through HarmonyState pub/sub, never directly between panels. This composability enables flexible layouts for lessons, games, embedded widgets, and standalone uses (e.g., a Tonnetz embedded in a blog post, keyboard-only ear training). The panel a user gravitates toward is also a signal for their learning persona (pianist → keyboard, theory-oriented → Tonnetz, beginner → chord wheel).

---

## Decisions (Resolved)

1. **Tonnetz orientation** — Settled. See "Orientation (CANONICAL)" in the Tonnetz Neighborhood panel spec above. Horizontal = P5, up-right = M3, down-right = m3, major = △, minor = ▽.
2. **Chord wheel design** — Settled. **Approach 3: Dual-ring with diatonic arc.** Both rings show the full circle of fifths (outer = major, inner = relative minor). Selecting a key highlights the diatonic arc — the 7 contiguous chords belonging to that key's scale. This visually teaches that diatonic harmony is a sliding window on the circle of fifths.
3. **Seventh chords** — Punted. The Explorer will be triadic for now. Seventh chord support can be revisited as a future enhancement once the core triadic tool is solid.
4. **Key detection** — Manual key selection for now. Auto-detection deferred until MIDI input implementation (Phase F3 `NoteInputProvider`), at which point real-time key detection becomes more natural and useful.
5. **Navigation placement** — Top-level tool, alongside Harmony Trainer, Chord Walks, etc. Can consolidate/reorganize the nav later.
6. **Build priority** — The Explorer establishes the canonical components and visual ground truth. The intro module should be built on top of these finalized components, not the other way around.
7. **Note Wheel** — Deferred. The chord wheel subsumes its functionality (all 12 pitch classes visible in fifths order on both rings).
8. **Panel count** — Three panels (Tonnetz, Chord Wheel, Keyboard). Originally four with a separate Note Wheel; consolidated after prototyping.

---

## Technical Notes

- All components follow the established pattern: ES6 modules, SVG-based rendering, event-driven via HarmonyState pub/sub.
- Audio uses the Salamander piano sampler via `music-engine.js` — no additional audio dependencies.
- The Voicing Explorer (Phase A5) adds `chord-bubble-renderer.js` (glow worm paths) and `chord-resolver.js` (chord identification with interval-content fallback) as new shared modules. See `voicing-explorer-spec.md`.
- The fretboard panel (`fretboard-view.js`) will follow the same composable pattern — subscribe to HarmonyState, render independently, no assumptions about other panels.
