# Extended Chord Support — Design Spec

**Date:** 2026-04-13
**Status:** Draft — in progress
**Goal:** Support 7ths, sus, dim, aug, and extended chords across the entire
platform while keeping the triad-based Tonnetz architecture intact.

---

## Design Principle

The Tonnetz is a geometric space where **triads are triangles**. Seventh chords,
sus chords, and extensions don't form natural geometric shapes on this grid.
Rather than fighting the geometry, we treat the triad as the harmonic core and
show extensions as **additive notes layered on top**.

This means:
- The Tonnetz triangle stays as-is (3 nodes, 3 edges)
- The 7th (or other extension) appears as an **additional highlighted node**
  connected to the triad with a distinct visual treatment (dotted line, glow, etc.)
- The keyboard highlights all notes (triad + extensions) with the extensions
  visually distinguished (lighter shade, ring instead of fill, etc.)
- The chord label displays the full name: "B7", "Cmaj7", "Fsus4", etc.

---

## 1. Chord Type Vocabulary

```
CHORD_TYPES = {
  // Triads (existing)
  'major':      { intervals: [0, 4, 7],     symbol: '',     name: 'Major' },
  'minor':      { intervals: [0, 3, 7],     symbol: 'm',    name: 'Minor' },
  'diminished': { intervals: [0, 3, 6],     symbol: '°',    name: 'Diminished' },
  'augmented':  { intervals: [0, 4, 8],     symbol: '+',    name: 'Augmented' },

  // Seventh chords
  'dom7':       { intervals: [0, 4, 7, 10], symbol: '7',    name: 'Dominant 7th' },
  'maj7':       { intervals: [0, 4, 7, 11], symbol: 'maj7', name: 'Major 7th' },
  'min7':       { intervals: [0, 3, 7, 10], symbol: 'm7',   name: 'Minor 7th' },
  'dim7':       { intervals: [0, 3, 6, 9],  symbol: '°7',   name: 'Diminished 7th' },
  'half-dim7':  { intervals: [0, 3, 6, 10], symbol: 'ø7',   name: 'Half-diminished 7th' },
  'minmaj7':    { intervals: [0, 3, 7, 11], symbol: 'mΔ7',  name: 'Minor-major 7th' },

  // Suspended
  'sus4':       { intervals: [0, 5, 7],     symbol: 'sus4', name: 'Suspended 4th' },
  'sus2':       { intervals: [0, 2, 7],     symbol: 'sus2', name: 'Suspended 2nd' },
  '7sus4':      { intervals: [0, 5, 7, 10], symbol: '7sus4',name: 'Dominant 7th sus4' },

  // Extended (future — not in initial build)
  'add9':       { intervals: [0, 4, 7, 14], symbol: 'add9', name: 'Add 9' },
  'dom9':       { intervals: [0, 4, 7, 10, 14], symbol: '9', name: 'Dominant 9th' },
  'maj9':       { intervals: [0, 4, 7, 11, 14], symbol: 'maj9', name: 'Major 9th' },
  'min9':       { intervals: [0, 3, 7, 10, 14], symbol: 'm9', name: 'Minor 9th' },
}
```

Each type knows:
- `intervals` — semitones from root (0-indexed)
- `symbol` — suffix for chord label (e.g., "B" + "7" = "B7")
- `name` — human-readable name for education/tooltips

**Triad extraction:** Every chord type has a "base triad" — the first 3 notes
that map to the Tonnetz triangle. For 7ths, it's the root triad. For sus chords,
the triad concept doesn't apply the same way (no third), so the Tonnetz shows
the root + 4th/5th or root + 2nd/5th as a special shape (line + node, not triangle).

---

## 2. transforms.js Changes

### New exports:

```js
const CHORD_TYPES = { ... };  // see above

/**
 * Return all pitch classes for any chord type.
 * @param {string|number} root
 * @param {string} type — key from CHORD_TYPES (e.g. 'dom7', 'sus4')
 * @returns {number[]} array of pitch classes
 */
function chordPCs(root, type) { ... }

/**
 * Return all note names for any chord type.
 * @returns {string[]} array of note names
 */
function chordNotes(root, type, keyContext?) { ... }

/**
 * Extract the base triad from any chord type.
 * Returns { root, quality, notes } for the 3-note core.
 * Used by Tonnetz renderer to draw the triangle.
 */
function baseTriad(root, type) { ... }

/**
 * Return the extension notes (everything beyond the triad).
 * @returns {string[]} note names of extension notes only
 */
function extensionNotes(root, type) { ... }
```

### Existing functions — unchanged:
- `triadNotes()`, `triadPCs()` — still work, still used by Tonnetz renderer
- `TRANSFORMS` (P/L/R) — operate on triads only (correct by design)
- `analyzeTransform()` — still compares triads

---

## 3. harmony-state.js Changes

### New state fields:

```js
function _defaultState() {
  return {
    activeTriads: [],         // UNCHANGED — Tonnetz still reads this
    activeNotes: [],          // UNCHANGED — keyboard still reads this
    activeChord: null,        // NEW — full chord info for label/display
    // activeChord shape:
    // {
    //   root: 'B',
    //   type: 'dom7',          // key from CHORD_TYPES
    //   quality: 'major',      // base triad quality (for Tonnetz)
    //   triadNotes: ['B','D♯','F♯'],
    //   extensionNotes: ['A'], // notes beyond the triad
    //   allNotes: ['B','D♯','F♯','A'],
    //   symbol: 'B7',          // display string
    //   role: 'primary',
    // }
    ...existing fields...
  };
}
```

### New method:

```js
/**
 * Set a chord with full type info. The triad core goes to activeTriads
 * (for Tonnetz), all notes go to activeNotes (for keyboard), and the
 * full chord info goes to activeChord (for labels and education).
 */
setChord(root, type, role) {
  const chordType = CHORD_TYPES[type];
  const triad = baseTriad(root, type);
  const allNotes = chordNotes(root, type);
  const extNotes = extensionNotes(root, type);

  const activeTriad = {
    root: triad.root,
    quality: triad.quality,
    notes: triad.notes,
    role: role || 'primary',
    color: null,
  };

  // Triad notes get normal highlighting
  const activeNotes = [
    ...triad.notes.map(n => ({ note: n, octave: 4, source: 'chord', color: null })),
    // Extension notes get distinct source so keyboard can style them differently
    ...extNotes.map(n => ({ note: n, octave: 4, source: 'extension', color: null })),
  ];

  this.update({
    activeTriads: [activeTriad],
    activeChord: {
      root,
      type,
      quality: triad.quality,
      triadNotes: triad.notes,
      extensionNotes: extNotes,
      allNotes,
      symbol: root + chordType.symbol,
      role: role || 'primary',
    },
    activeNotes,
    tonnetzCenter: { root: triad.root, quality: triad.quality },
    activeTransform: null,
  });
}
```

### Backward compatibility:
- `setTriad(root, quality)` — still works, sets `activeChord` to null
- `setChord(root, 'major')` — equivalent to `setTriad(root, 'major')`
- Tonnetz renderer reads `activeTriads` — unchanged
- Keyboard renderer reads `activeNotes` — gets more notes, distinguishes
  by `source: 'chord'` vs `source: 'extension'`

---

## 4. Walkthrough Data Changes

### Before:
```js
{ chord: "B", function: "dominant (V)", body: "..." }
```

### After:
```js
{ chord: "B", chordType: "dom7", function: "dominant (V7)", body: "..." }
```

If `chordType` is omitted, defaults to "major" (backward compatible).
If chord name ends with "m" (e.g. "Am"), quality is inferred as minor.

### Folsom Prison example updated:
```js
steps: [
  { chord: "E",  chordType: "dom7", function: "tonic (I7)", ... },
  { chord: "A",  chordType: "dom7", function: "subdominant (IV7)", ... },
  { chord: "E",  chordType: "dom7", function: "back to I7", ... },
  { chord: "B",  chordType: "dom7", function: "dominant (V7)", ... },
  { chord: "E",  chordType: "dom7", function: "resolution (I7)", ... },
]
```

---

## 5. Visual Changes

### Tonnetz Renderer (tonnetz-neighborhood.js)
- Triangle drawn from `activeTriads` — **unchanged**
- NEW: If `activeChord` has extension notes, draw each extension as a
  **highlighted node** connected to the triad with a **dashed line**
- Extension node styling: same color family as triad but lighter/translucent,
  pulsing glow, smaller radius
- The 7th of a dom7 chord appears on the Tonnetz grid at its pitch class
  position — e.g., for B7, the note A appears as an extra glowing node

### Keyboard View (keyboard-view.js)
- Triad notes (`source: 'chord'`) — existing solid highlight
- Extension notes (`source: 'extension'`) — **ring highlight** (outline only)
  or **lighter shade** of the chord color family
- Tooltip on hover shows note's role: "root", "3rd", "5th", "♭7th", etc.

### Chord Label
- Currently shows "B major" — needs to show "B7"
- Read from `activeChord.symbol` if present, fall back to triad label
- Larger label area in Explorer to accommodate longer names like "Fmaj7sus4"

### Chord Wheel
- The circle of fifths shows root positions — chord type could be shown as
  a badge or color modifier on the highlighted segment

---

## 6. Progression Engine Changes

### Progression chord objects gain `chordType`:
```js
progressionState: {
  chords: [
    { root: 'E', quality: 'major', chordType: 'dom7', notes: ['E','G♯','B'], romanNumeral: 'I7' },
    ...
  ],
}
```

### setProgressionIndex():
- If chord has `chordType`, call `setChord()` path instead of `setTriad()` path
- Common-tone analysis still operates on triads (correct — voice leading
  is fundamentally about triad movement; the 7th resolves predictably)

---

## 7. Implementation Order

1. **transforms.js** — add CHORD_TYPES, chordPCs, chordNotes, baseTriad, extensionNotes
2. **harmony-state.js** — add activeChord, setChord(), update setProgressionIndex()
3. **Walkthrough data** — add chordType to Folsom Prison as proof of concept
4. **Keyboard view** — render extension notes with distinct styling
5. **Chord label** — display activeChord.symbol
6. **Tonnetz renderer** — draw extension nodes
7. **Remaining walkthroughs** — audit and add chordType where needed
8. **Chord wheel** — optional, show chord type indicator

---

## 8. Fundamentals Chapter Notes (for "Beyond Triads" chapter)

### Concepts to teach (mapped to implementation):
- **What is a 7th chord?** → Interactive: toggle 7th on/off on keyboard,
  hear the difference. Show the extra node appear on the Tonnetz.
- **Types of 7th chords** → dom7 vs maj7 vs min7. The *quality* of the 7th
  matters. dom7 = tension/blues. maj7 = dreamy. min7 = mellow.
- **The tritone in dom7** → The interval between the 3rd and ♭7th of a dom7
  is a tritone. This is WHY it wants to resolve. Interactive: play B7, hear
  the D♯-A tritone, then resolve to E.
- **Sus chords** → Remove the third. No major/minor = no mood. Pure tension.
  Interactive: toggle between Csus4, C, Csus2.
- **Where you hear them** → Link to walkthroughs. "In Folsom Prison Blues,
  every chord is a dominant 7th — that's what makes it blues, not pop."
- **Extensions** → Brief mention of 9ths, 11ths, 13ths as "keep stacking
  thirds." Save deep dive for advanced content.

### Game links from this chapter:
- Chord Spotter (already tests extended chord types)
- Harmony Trainer (could add 7th chord mode)

---

## 9. Migration & Backward Compatibility

- All existing walkthroughs work unchanged (missing chordType = triad)
- All existing game code works unchanged (games use setTriad)
- All existing progression code works unchanged (setProgressionIndex
  falls back to setTriad if no chordType)
- New chordType field is strictly additive
- No database migration needed (no persistence layer yet)
