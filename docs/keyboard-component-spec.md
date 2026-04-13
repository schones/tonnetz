# Tonnetz Neighborhood + Keyboard: Linked Component Architecture

**Version:** 0.1 (Initial design)  
**Date:** 2026-03-14  
**Purpose:** Define the architecture for a linked Tonnetz neighborhood view and piano keyboard component, initially built for the Relative Major/Minor game but designed for extraction and reuse across the platform.  
**Context:** This doc sits alongside `content-architecture.md` and `tonnetz-next-build-plan.md`. It defines a new reusable component layer that will be consumed by games and visualizations.

> **⚠️ Partially superseded (2026-03-30):** Architecture sections (§1–8) remain the reference for HarmonyState API, animation queue, and component patterns. Implementation sequence (§10) is superseded by `tonnetz-next-build-plan.md` v3 and `game-flow-pattern.md`. Orientation in §3.1 has been corrected below to match the canonical orientation defined in `explorer-spec.md`. The Explorer now has three panels (Tonnetz, Chord Wheel, Keyboard), not four — the Note Wheel was consolidated into the Chord Wheel.

---

## 1. Design Goals

1. **Shared state, independent renderers.** The keyboard and Tonnetz neighborhood both read from the same `HarmonyState` object. Neither knows about the other. Game logic writes to the state; both views react.
2. **Two known consumers, designed for more.** The first consumer is the Relative Key Trainer (new game, triad-focused). The second is the Harmony Trainer (existing game, interval-focused enhancement). The components handle both triads and intervals without overabstraction — `activeTriads` and `activeInterval` coexist as parallel fields, not a polymorphic union.
3. **Layered complexity.** Beginners see "major → relative minor" with no jargon. Intermediate users see the R transform labeled. Advanced users get the full PLR toolkit. The components don't change — the game controls what labels and annotations are visible.
4. **Keyboard is familiar, Tonnetz is the unlock.** The keyboard grounds the experience in something everyone recognizes. The Tonnetz neighborhood reveals the *relational structure* that the keyboard layout hides. Together they create "aha" moments.

---

## 2. HarmonyState — The Shared Data Model

This is the central contract. Both renderers subscribe to it. Game logic is the only writer.

```javascript
// HarmonyState — shared state object
// Lives in static/shared/harmony-state.js
// Uses an event-emitter or pub/sub pattern for reactivity

{
  // --- Current harmonic focus ---
  activeTriads: [
    {
      root: "C",              // note name (pitch class)
      quality: "major",       // "major" | "minor" | "diminished" | "augmented"
      notes: ["C", "E", "G"],
      role: "primary",        // "primary" | "secondary" | "ghost"
      color: null              // override color, or null for default from quality
    }
  ],

  // --- Active interval (for Harmony Trainer and interval-focused contexts) ---
  activeInterval: null,
  // When set:
  // {
  //   notes: ["C", "E"],         // the two pitch classes
  //   semitones: 4,              // distance in semitones
  //   quality: "M3",             // short label (m2, M2, m3, M3, P4, TT, P5, m6, M6, m7, M7, P8)
  //   label: "Major 3rd",        // human-friendly label (difficulty-dependent)
  //   role: "primary",           // "primary" | "secondary" | "ghost"
  //   direction: "ascending"     // "ascending" | "descending" | "harmonic"
  // }

  // --- Active notes (superset — union of triad notes, interval notes, scale tones, etc.) ---
  // This is what the keyboard reads. Game logic populates it from activeTriads,
  // activeInterval, or both. Source field lets the keyboard style notes differently.
  activeNotes: [
    { note: "C", octave: 4, source: "triad", color: null },
    { note: "E", octave: 4, source: "triad", color: null },
    { note: "G", octave: 4, source: "triad", color: null }
    // For intervals: source: "interval" instead of "triad"
  ],

  // --- Transform state (for Tonnetz arrows/animations) ---
  activeTransform: null,
  // When set:
  // {
  //   type: "R",                  // "P" | "L" | "R" | "chain"
  //   from: { root: "C", quality: "major" },
  //   to: { root: "A", quality: "minor" },
  //   label: "Relative minor",    // human-friendly label (difficulty-dependent)
  //   commonTones: ["C", "E"],    // notes shared between both triads
  //   movingTone: { from: "G", to: "A" }  // the one note that moves
  // }

  // --- Tonnetz neighborhood config ---
  tonnetzCenter: { root: "C", quality: "major" },  // center node of the neighborhood
  tonnetzDepth: 1,           // 1 = PLR neighbors only; 2 = neighbors-of-neighbors

  // --- Keyboard config ---
  keyboardRange: { low: "C3", high: "B5" },  // which octaves to show
  keyboardMode: "display",   // "display" (highlight only) | "input" (clickable/playable)
                             // | "both" (playable + highlights)

  // --- Annotation layer (difficulty-dependent, set by game logic) ---
  annotations: {
    // Triad-focused (Relative Key Trainer)
    showTransformLabels: false,    // "R", "P", "L" on Tonnetz edges
    showCommonTones: true,         // highlight shared notes between triads
    showMovingTone: true,          // highlight the note that changes
    showChordLabel: true,          // "C major", "A minor" near triads
    // Interval-focused (Harmony Trainer)
    showIntervalEdge: false,       // highlight the Tonnetz edge connecting two notes
    showIntervalLabel: false,      // "M3", "P5" label on the highlighted edge
    showIntervalDistance: false,   // semitone count annotation
    // Shared
    showNoteNames: true,           // note names on Tonnetz nodes and keys
  },

  // --- Animation queue ---
  animationQueue: [],
  // Items:
  // {
  //   type: "transform",          // "transform" | "highlight" | "playback"
  //   data: { ... },              // type-specific payload
  //   duration_ms: 600,
  //   delay_ms: 0
  // }
}
```

### State Management Pattern

The platform's existing JS is vanilla (no React/Vue), so `HarmonyState` uses a lightweight pub/sub:

```javascript
// harmony-state.js — public API sketch

const HarmonyState = {
  _state: { /* defaults above */ },
  _listeners: [],

  // Read
  get()            { return this._state; },

  // Write (merges partial updates)
  update(partial)  { Object.assign(this._state, partial); this._notify(); },

  // Batch write (suppresses notifications until done)
  batch(fn)        { this._batching = true; fn(this._state); this._batching = false; this._notify(); },

  // Subscribe
  on(fn)           { this._listeners.push(fn); return () => this._listeners = this._listeners.filter(l => l !== fn); },

  _notify()        { if (!this._batching) this._listeners.forEach(fn => fn(this._state)); }
};
```

Games and components call `HarmonyState.on(state => this.render(state))` on init. Game logic calls `HarmonyState.update(...)` to drive changes.

---

## 3. Tonnetz Neighborhood View

A focused, zoomable subgraph of the full Tonnetz grid. Shows a center triad and its PLR neighbors (at depth 1) or a wider region (depth 2+).

### 3.1 Layout Geometry

The Tonnetz is a triangular lattice where:
- **Horizontal axis** = perfect fifths (e.g., C → G → D) *(corrected 2026-03-30)*
- **Diagonal up-right** = major thirds (e.g., C → E → G♯) *(corrected 2026-03-30)*
- **Diagonal down-right** = minor thirds (e.g., C → E♭ → G♭) *(corrected 2026-03-30)*

Each **triangle** (3 adjacent nodes) forms a triad:
- Upward-pointing triangle = major triad
- Downward-pointing triangle = minor triad

For the neighborhood view, we render this as an SVG with:
- **Nodes** = pitch classes (circles with note names)
- **Edges** = intervals connecting them
- **Triangles** = filled/highlighted to indicate triads
- **Transform arrows** = curved arrows between adjacent triangles labeled P, L, or R

### 3.2 Depth Levels

| Depth | What's visible | Triad count | Use case |
|-------|---------------|-------------|----------|
| 1 | Center triad + its 3 PLR neighbors | 4 | Relative Major/Minor game (beginner/intermediate) |
| 2 | Depth 1 + neighbors of neighbors | ~10-12 | Advanced relative key game, modulation paths |
| 3+ | Wider region | Many | Future Tonnetz explorer (Phase 6) |

At depth 1 centered on C major, the visible triads are:
- **C major** (center) — notes: C, E, G
- **C minor** (P transform) — notes: C, E♭, G
- **E minor** (L transform) — notes: E, G, B
- **A minor** (R transform) — notes: A, C, E

### 3.3 Rendering API

```javascript
// tonnetz-neighborhood.js — public API sketch
// Renders into a target SVG container

const TonnetzNeighborhood = {
  init(svgContainerId, options = {}) {
    // options: { width, height, interactive, onTriadClick, onTransformClick }
    // Subscribes to HarmonyState automatically
  },

  // Re-center the view on a different triad (animates the transition)
  recenter(root, quality) { },

  // Set depth (re-renders the visible region)
  setDepth(depth) { },

  // Manual render (usually called via HarmonyState subscription)
  render(state) { },

  // Cleanup
  destroy() { }
};
```

### 3.4 Interaction Modes

- **Passive (display only):** Triads highlight and transforms animate based on game state. Used during listening exercises.
- **Exploratory (clickable):** Player clicks a triad → it plays and becomes the new `activeTriad`. Player clicks a transform arrow → the transform animates and plays. Used in explore/sandbox mode.
- **Quiz target:** Player clicks a triad to answer a question (e.g., "which triad is the relative minor?"). Correct/incorrect feedback on the Tonnetz itself.

The mode is controlled by the game, not the component. The component just exposes `onTriadClick` and `onTransformClick` callbacks.

### 3.5 Visual States for Triads

| State | Appearance | When |
|-------|-----------|------|
| `inactive` | Nodes visible but triangle not filled | Visible in neighborhood but not part of current focus |
| `active-primary` | Triangle filled with accent color, nodes prominent | Current tonal center |
| `active-secondary` | Triangle filled with softer color | The "other" triad in a comparison (e.g., the relative minor while major is primary) |
| `ghost` | Triangle outlined/dashed, semi-transparent | "Where you came from" after a transform |
| `target` | Pulsing outline | Clickable answer option in quiz mode |
| `correct` | Brief green flash | Correct answer feedback |
| `incorrect` | Brief red flash | Incorrect answer feedback |

### 3.6 Interval Rendering (Harmony Trainer Use Case)

When `HarmonyState.activeInterval` is set (and `activeTriads` is empty or irrelevant), the Tonnetz renderer switches from triangle mode to edge mode:

- **Two nodes** are highlighted for the interval's two pitch classes
- **The connecting edge** is highlighted with a color and optional label (e.g., "M3", "P5")
- **The edge direction** encodes the interval type — horizontal = perfect 5th, diagonal up-right = major 3rd, diagonal down-right = minor 3rd. Compound intervals (e.g., minor 6th = inverted major 3rd) follow the same axis but traverse multiple edges
- **No triangles are filled.** The Tonnetz shows the *linear* relationship, not the triadic one

This is where the Tonnetz adds something the keyboard can't: a player sees that every perfect 5th is a horizontal move, every major 3rd is the same diagonal. The spatial pattern is the lesson — intervals aren't just numbers, they're directions on a map.

The renderer determines mode automatically: if `activeInterval` is set and `activeTriads` is empty, render edges. If `activeTriads` is set, render triangles. If both are set (possible in a future "interval within a chord" context), render both.

**Neighborhood centering for intervals:** When showing an interval, the neighborhood centers on the lower note and shows enough depth to include the upper note. For intervals up to a perfect 5th, depth 1 is sufficient. For wider intervals, depth 2 may be needed.

---

## 4. Keyboard View

Extends the existing Skratch Studio piano keyboard with a passive highlight layer.

### 4.1 Additions to Existing Keyboard

The Skratch Studio keyboard is currently an **input device** — the player presses keys to make sound. For the linked component, we add:

1. **Highlight layer:** An overlay that colors keys based on `HarmonyState.activeNotes`. Each note can have an independent color (to distinguish triad tones, common tones, moving tones, etc.).
2. **Chord label:** A small label below/above the keyboard showing the current chord name (e.g., "C major" or "Am").
3. **Common tone indicators:** When a transform is active, common tones get a "stayed" indicator and the moving tone gets a "moved from → to" indicator.
4. **Display mode:** Keys highlight but don't respond to clicks. Used during listening phases.
5. **Input mode:** Keys are playable (existing behavior). Highlights still appear.
6. **Both mode:** Keys are playable AND highlights appear. Used in explore mode.

### 4.2 Rendering API

```javascript
// keyboard-view.js — public API sketch
// Wraps/extends the existing keyboard component

const KeyboardView = {
  init(containerId, options = {}) {
    // options: { range, mode, showLabels, onNotePlay, onChordDetect }
    // Subscribes to HarmonyState automatically
  },

  // Override range (e.g., zoom to 1 octave for beginners)
  setRange(low, high) { },

  // Manual render
  render(state) { },

  // Cleanup
  destroy() { }
};
```

### 4.3 Reuse Considerations

The keyboard is useful beyond this game:
- **Harmony Trainer:** highlight the two notes of an interval after the player guesses
- **Chord Spotter:** highlight chord tones
- **Melody Match:** highlight the target melody notes
- **Skratch Studio:** already has its own keyboard; eventual convergence target

To avoid forking, the keyboard highlight system should be a **layer that can wrap any keyboard instance**, not a separate keyboard. Implementation options:
- A CSS overlay approach (position highlight divs over existing keys)
- A callback hook in the existing keyboard that accepts highlight state

The choice depends on how the Skratch Studio keyboard is currently structured. The architectural contract is: `KeyboardView.init()` needs a reference to either an existing keyboard DOM element or a container to create one in.

---

## 5. PLR Transform Definitions

Hard reference data used by both the Tonnetz view and game logic. This is music theory, not configuration — it doesn't change.

```javascript
// transforms.js — pure data + utility functions

const TRANSFORMS = {
  P: {
    name: "Parallel",
    description: "Same root, flip quality (major ↔ minor)",
    humanLabel: { beginner: "Parallel", intermediate: "P (Parallel)", advanced: "P" },
    commonToneCount: 2,
    // Given a triad, return the P-transform result
    apply(root, quality) {
      // C major → C minor: keep root and fifth, move the third
      // Implementation: if major, lower 3rd by semitone; if minor, raise 3rd by semitone
    }
  },
  L: {
    name: "Leading-Tone Exchange",
    description: "Move the root (in major) or the fifth (in minor) by a semitone",
    humanLabel: { beginner: "Leading tone", intermediate: "L (Leading tone)", advanced: "L" },
    commonToneCount: 2,
    apply(root, quality) {
      // C major → E minor: keep E and G, move C → B
    }
  },
  R: {
    name: "Relative",
    description: "Move to the relative major or minor",
    humanLabel: { beginner: "Relative", intermediate: "R (Relative)", advanced: "R" },
    commonToneCount: 2,
    apply(root, quality) {
      // C major → A minor: keep C and E, move G → A
    }
  }
};

// Utility: compute common tones and moving tone for any transform
function analyzeTransform(fromRoot, fromQuality, toRoot, toQuality) {
  // Returns { commonTones: [...], movingTone: { from, to }, transformType: "P"|"L"|"R"|null }
}

// Utility: given a triad, return all PLR neighbors
function getNeighbors(root, quality) {
  // Returns { P: { root, quality }, L: { root, quality }, R: { root, quality } }
}

// Utility: pitch class math (all mod 12 arithmetic)
// noteToPC("C") → 0, noteToPC("C#") → 1, etc.
// pcToNote(0) → "C", pcToNote(1) → "C♯", etc.
// triadNotes("C", "major") → ["C", "E", "G"]
// triadNotes("C", "minor") → ["C", "E♭", "G"]
```

---

## 6. Relative Major/Minor Game — First Consumer

### 6.1 Game Identity

| Field | Value |
|-------|-------|
| `id` | `relative_key_trainer` |
| `title` | "Relative Major & Minor" |
| `type` | `recognition` |
| `core_topics` | `["relative_minor_major"]` |
| `supporting_topics` | `["triads", "minor_scale", "major_scale", "tonnetz_transforms"]` |

Note: The build plan references a game called `relative_pitch` — that trains interval recognition (relative pitch as a perceptual skill). This game, `relative_key_trainer`, trains recognition of relative major/minor key relationships. They're complementary but distinct.

### 6.2 Difficulty Tiers

| Level | Name | Listening task | Tonnetz depth | Annotations | PLR vocabulary |
|-------|------|---------------|---------------|-------------|----------------|
| 1 | "Major or Minor?" | Hear a progression, identify if it's major or minor | 1 (but only 2 triads shown: the pair) | Note names, chord labels, common tone highlights | None — just "major" and "minor" |
| 2 | "Find the Relative" | Hear a major progression, pick its relative minor (or vice versa) from 2-3 options on the Tonnetz | 1 | + transform arrow between the pair, labeled "Relative" | "Relative" only |
| 3 | "Hear the Pivot" | Hear a longer passage that modulates from major to relative minor (or vice versa). Identify *when* the shift happens (early / middle / late) | 1 | + moving tone highlighted on keyboard | "R transform" introduced |
| 4 | "PLR Explorer" | All three transforms. Hear a transform, identify which one (P, L, or R). Tonnetz shows the full depth-1 neighborhood | 1 | All transform arrows labeled | Full P, L, R |
| 5 | "Chain Transforms" | Hear a sequence of 2-3 transforms. Trace the path on the Tonnetz | 2 | Full labels, path trail | P, L, R + chaining |

### 6.3 Game Modes

**Listen Mode (structured rounds)**
- Game plays audio → player answers → feedback → next round
- Tonnetz and keyboard update *after* the player answers (on easy) or stay blank during the question (on hard)
- Visual scaffolding decreases with difficulty: Level 1 shows both triads highlighted before the question. Level 3+ shows nothing until after the answer.

**Explore Mode (sandbox)**
- Player clicks triads on the Tonnetz → hears them, keyboard highlights
- Player clicks transform arrows → animation plays, both views update
- Player plays notes on keyboard → nearest triad highlights on Tonnetz (optional, depends on implementation complexity)
- No scoring. Available at all difficulty levels as a "playground" toggle
- This mode is the most reusable component — it's essentially a mini Tonnetz explorer

### 6.4 Audio Design

Uses Tone.js (already in the project). Each triad plays as:
- **Broken chord** (arpeggiated) for melodic context — helps beginners hear individual notes
- **Block chord** for harmonic context — tests whether the player hears the gestalt quality
- **Progression** (I-IV-V-I or similar) for key establishment — needed for pivot recognition in Level 3+

The game should use the Salamander Grand Piano samples already loaded for Skratch Studio where possible, falling back to Tone.js synth for performance.

### 6.5 Page Layout

```
┌─────────────────────────────────────────────────┐
│  Relative Major & Minor          Level: ●●○○○   │
│                                   [Explore] [?]  │
├─────────────────────────────────────────────────┤
│                                                  │
│              ┌──────────────────┐                │
│              │                  │                │
│              │    TONNETZ       │                │
│              │  NEIGHBORHOOD    │                │
│              │    (SVG)         │                │
│              │                  │                │
│              └──────────────────┘                │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           KEYBOARD (2 octaves)           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Question area / feedback / controls      │   │
│  │  [Play Again]    [A]  [B]  [C]           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Tips pill (?): "Major and minor keys that       │
│  share the same notes are called relatives..."   │
└─────────────────────────────────────────────────┘
```

The Tonnetz sits above the keyboard so the spatial → concrete relationship reads top-to-bottom: abstract structure → physical keys. The question area is at the bottom, closest to the player's interaction point.

---

## 7. Harmony Trainer Integration — Second Consumer

The Harmony Trainer is the platform's existing interval recognition game. Adding the linked components here is a lighter lift than the Relative Key Trainer because the Harmony Trainer already works — we're enhancing it with visual feedback, not building a new game.

### 7.1 What Changes

**Currently:** Player hears two notes, identifies the interval from a set of buttons. Feedback is text-based ("Correct! That was a Major 3rd").

**With linked components:** After the player answers (or in real-time on easier difficulties), the keyboard highlights both notes and the Tonnetz shows the interval as a highlighted edge. The player sees that a major 3rd is always horizontal on the Tonnetz, a perfect 5th is always the same diagonal — building spatial intuition alongside ear training.

### 7.2 Integration Approach

The Harmony Trainer uses **`activeInterval` + `activeNotes`** — it doesn't touch `activeTriads` or `activeTransform` at all. This keeps the two game integrations cleanly separated in the state.

```javascript
// After player answers (or during playback on easy mode):
HarmonyState.update({
  activeInterval: {
    notes: ["C", "E"],
    semitones: 4,
    quality: "M3",
    label: "Major 3rd",
    role: "primary",
    direction: "ascending"
  },
  activeNotes: [
    { note: "C", octave: 4, source: "interval", color: null },
    { note: "E", octave: 4, source: "interval", color: null }
  ],
  annotations: {
    showIntervalEdge: true,
    showIntervalLabel: true,   // after answer reveal
    showNoteNames: true,
    // all triad-specific annotations off
    showTransformLabels: false,
    showCommonTones: false,
    showMovingTone: false,
    showChordLabel: false
  }
});
```

### 7.3 Tonnetz as Optional Enhancement

The Tonnetz view is genuinely useful for interval training but it's not essential the way it is for the Relative Key Trainer. Two options for the Harmony Trainer page layout:

**Option A — Always visible:** Tonnetz + keyboard both show at all times. The page is a richer experience but more visually busy.

**Option B — Progressive reveal:** Keyboard highlights are on by default (low visual cost, immediate value). The Tonnetz is available via a toggle ("Show on Tonnetz") that defaults to off for beginners and on for intermediate+ players. This avoids overwhelming new users who just want to train their ear.

**Leaning toward Option B.** The Harmony Trainer's existing UX works well — the Tonnetz should enhance without disrupting. Let the player opt in.

### 7.4 Difficulty-Dependent Behavior

| Harmony Trainer Level | Keyboard | Tonnetz | When visuals appear |
|----------------------|----------|---------|-------------------|
| 1 (easy) | Highlights both notes during playback | Hidden by default | Real-time (scaffolding) |
| 2-3 (medium) | Highlights after answer | Available via toggle | After answer reveal |
| 4-5 (hard) | Highlights after answer | Available via toggle | After answer reveal, minimal annotations |

### 7.5 Page Layout Adjustment

The existing Harmony Trainer layout gets two additions:

```
┌─────────────────────────────────────────────────┐
│  Harmony Trainer                 Level: ●●○○○   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           KEYBOARD (highlight layer)     │   │  ← NEW: added below
│  └──────────────────────────────────────────┘   │     existing game UI
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Existing question / answer / feedback    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │  TONNETZ (collapsible, off by default)   │   │  ← NEW: opt-in panel
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   │
│                                                  │
│  Tips pill                                       │
└─────────────────────────────────────────────────┘
```

Note the inverted order vs. the Relative Key Trainer — here the keyboard is above the question area because the keyboard is the immediate visual aid, while the Tonnetz is secondary. In the Relative Key Trainer, the Tonnetz is primary.

---

## 8. Integration Points with Existing Architecture

### 8.1 Files Created

| File | Purpose | Location |
|------|---------|----------|
| `harmony-state.js` | Shared state + pub/sub | `static/shared/` |
| `transforms.js` | PLR definitions + pitch class math | `static/shared/` |
| `tonnetz-neighborhood.js` | Tonnetz SVG renderer | `static/shared/` |
| `keyboard-view.js` | Keyboard highlight layer | `static/shared/` |
| `relative-key-trainer.js` | Game logic for Relative Major/Minor | `static/games/` (or wherever game JS lives) |
| `relative-key-trainer.html` | Game page (Jinja2 template) | `templates/` |

### 8.2 Content Architecture Hooks

New entries needed in `theory-content.js`:

```javascript
// Topic: already exists as "relative_minor_major" (framework)
// Just needs related_games updated to include:
{ game_id: "relative_key_trainer", relevance: "primary" }

// Topic: "tonnetz_transforms" (framework)
// Add:
{ game_id: "relative_key_trainer", relevance: "supporting" }

// Topic: "intervals" (building_block)
// related_games already includes harmony_trainer — no change needed,
// but harmony_trainer gains Tonnetz/keyboard visuals via this component layer
```

### 8.3 Education Layer Integration

- **Tips pill:** Wired to `relative_minor_major` topic's `quick_summary` (already in schema)
- **Tooltips:** PLR terms link to `tonnetz_transforms` topic. On hover/tap, show the quick_summary. On beginner difficulty, these tooltips don't appear (annotations are off).
- **Game intro screen** (Phase 5): Uses existing intro screen pattern. Prerequisites: `triads`, `major_scale`, `minor_scale`. Supporting context: `relative_minor_major` Theory Hub entry.

### 8.4 Reuse Roadmap

| Consumer | What it uses | Status |
|----------|-------------|--------|
| Relative Key Trainer | Full stack: `HarmonyState`, `TonnetzNeighborhood`, `KeyboardView`, `transforms.js` | First consumer — built together |
| Harmony Trainer | `HarmonyState` (activeInterval + activeNotes), `KeyboardView`, `TonnetzNeighborhood` (opt-in) | Second consumer — see §7 |
| Chord Spotter | `HarmonyState` (activeTriads + activeNotes), `KeyboardView` | Future — highlight chord tones after guess |
| Phase 6 Tonnetz Grid | `TonnetzNeighborhood` at depth 3+, `HarmonyState` | Future — progress map is a superset of this component |
| Standalone Harmony Explorer | Both components + explore mode | Future — essentially the game's explore mode extracted |
| Modulation Game | Both components at depth 2, chained transforms | Future — natural extension of Relative Key Trainer Level 5 |

---

## 9. Open Questions

1. **Keyboard component reuse vs. fork.** Need to inspect the Skratch Studio keyboard code to determine whether the highlight layer can wrap it cleanly or if a purpose-built keyboard is simpler. The Skratch keyboard has the Salamander samples, BroadcastChannel pop-out, sustain pedal — the game keyboard needs none of that, just display + optional click-to-play. **Leaning toward:** a lightweight game keyboard that shares the sample loading code but not the Skratch UI.

2. **Tonnetz node labels: sharps vs. flats.** The Tonnetz traditionally uses enharmonic-neutral pitch classes, but for display we have to pick a spelling. Options: always use sharps, always use flats, context-dependent (use the spelling appropriate to the current key). **Leaning toward:** context-dependent, with a utility function in `transforms.js` that takes a key context and returns preferred spellings.

3. **Bidirectional keyboard → Tonnetz interaction.** In explore mode, when a player plays notes on the keyboard, should the Tonnetz try to identify and highlight the nearest matching triad? This is cool but adds complexity (chord detection from arbitrary note sets). **Leaning toward:** defer this to a future iteration. For now, keyboard → audio only; Tonnetz → audio + keyboard highlights.

4. **Mobile layout.** The stacked layout (Tonnetz above keyboard above controls) works on desktop but may need to collapse or tab on mobile. **Leaning toward:** defer mobile optimization per the build plan's "post-MVP" notes, but keep the components self-contained so they can be re-laid-out without code changes.

5. **Harmony Trainer Tonnetz centering.** When showing intervals wider than a perfect 5th, the depth-1 neighborhood may not contain both notes. Need to determine whether to auto-increase depth, pan the view, or show a "zoomed out" mode. **Leaning toward:** auto-increase to depth 2 when the interval exceeds the depth-1 radius, which covers everything up to an octave.

---

## 10. Implementation Sequence

This work is independent of the Phase 4 tasks in the build plan and can be built in parallel or after Phase 4.

### Shared Components (required by both games)

| Task | Session(s) | Dependencies |
|------|-----------|-------------|
| 10.1 — `transforms.js` (PLR math + pitch class utilities + interval utilities) | 1 | None |
| 10.2 — `harmony-state.js` (state + pub/sub, with both activeTriads and activeInterval) | 1 | None (can parallel with 10.1) |
| 10.3 — `tonnetz-neighborhood.js` (SVG renderer: triangle mode + edge mode) | 1-2 | 10.1, 10.2 |
| 10.4 — `keyboard-view.js` (highlight layer) | 1 | 10.2; inspect Skratch keyboard first |
| 10.5 — Integration test page (both views linked to HarmonyState) | 1 | 10.2, 10.3, 10.4 |

### Relative Key Trainer (first game)

| Task | Session(s) | Dependencies |
|------|-----------|-------------|
| 10.6 — `relative-key-trainer.js` Level 1-2 (listen mode, basic) | 1-2 | 10.5 |
| 10.7 — Level 3 (pivot recognition) | 1 | 10.6 |
| 10.8 — Explore mode | 1 | 10.5 (can parallel with 10.6) |
| 10.9 — Levels 4-5 (PLR + chaining) | 1-2 | 10.6, 10.7 |
| 10.10 — Education layer wiring (tips, tooltips, intro screen) | 1 | 10.6; Phase 5 (intro screens) |

### Harmony Trainer Enhancement (second game)

| Task | Session(s) | Dependencies |
|------|-----------|-------------|
| 10.11 — Add keyboard highlight layer to Harmony Trainer | 1 | 10.5 |
| 10.12 — Add collapsible Tonnetz panel to Harmony Trainer | 1 | 10.11 |
| 10.13 — Wire difficulty-dependent visual behavior | 1 | 10.12 |

**Estimated total: 13-17 Claude Code sessions.**

Task 10.5 is the key milestone — once the two views are linked and rendering from shared state on a test page, all game-specific work is orchestration. Tasks 10.6-10.10 (Relative Key Trainer) and 10.11-10.13 (Harmony Trainer) are independent of each other and can be built in either order.
