/**
 * transforms.js
 * =============
 * Pitch class math, PLR transform definitions, and interval utilities
 * for the Tonnetz education layer.
 *
 * Pure data + pure functions — zero rendering logic.
 *
 * Consumed by:
 *   - tonnetz-neighborhood.js  → PLR graph layout & transforms
 *   - harmony-state.js         → triad/interval state management
 *   - keyboard-view.js         → note highlighting & common-tone analysis
 *   - relative_key_trainer     → game logic
 *
 * Exposes: window.Transforms  (also ES-module exports)
 */

// ════════════════════════════════════════════════════════════════════
// PITCH CLASS UTILITIES
// ════════════════════════════════════════════════════════════════════

const NOTE_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"
];

const NOTE_NAMES_FLAT = [
  "C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"
];

// Lookup table for note name → pitch class (built once)
const _pcLookup = (() => {
  const map = {};
  const sharpNames  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const flatNames   = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const uniSharp    = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const uniFlat     = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];
  [sharpNames, flatNames, uniSharp, uniFlat].forEach(arr => {
    arr.forEach((name, i) => { map[name.toUpperCase()] = i; });
  });
  return map;
})();

/**
 * Convert a note name to pitch class integer 0–11.
 * Handles sharps/flats in ASCII (#/b) or Unicode (♯/♭), case-insensitive.
 */
function noteToPC(noteName) {
  if (typeof noteName !== "string" || noteName.length === 0) return NaN;
  const key = noteName.trim().toUpperCase()
    .replace(/♯/g, "#")
    .replace(/♭/g, "B");
  // Handle edge case: "Bb" uppercased is "BB" — need special handling
  // Re-parse: letter + optional accidental
  const letter = key[0];
  const acc = noteName.trim().slice(1).toLowerCase()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b");

  const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = baseMap[letter];
  if (base === undefined) return NaN;

  let offset = 0;
  for (const ch of acc) {
    if (ch === "#") offset++;
    else if (ch === "b") offset--;
  }
  return ((base + offset) % 12 + 12) % 12;
}

/**
 * Convert pitch class integer to note name.
 * @param {number} pc - pitch class 0–11
 * @param {boolean} [preferFlats=false] - use flat spellings
 */
function pcToNote(pc, preferFlats) {
  const idx = ((pc % 12) + 12) % 12;
  return preferFlats ? NOTE_NAMES_FLAT[idx] : NOTE_NAMES[idx];
}

// ── Key-signature spelling ──────────────────────────────────────────

// Keys that conventionally use flats
const _flatKeys = new Set([
  "F", "Bb", "B♭", "Eb", "E♭", "Ab", "A♭", "Db", "D♭", "Gb", "G♭", "Cb", "C♭",
  // relative minors of flat-key majors
  "D", "G", "C", "F"  // Dm, Gm, Cm, Fm — handled via quality check below
]);

/**
 * Returns a mapping function (pc → note name) for a given key context.
 * Keys with flats in the signature use flat spellings; others use sharps.
 */
function spellingForKey(keyRoot, keyQuality) {
  const useFlats = _shouldUseFlats(keyRoot, keyQuality);
  return (pc) => pcToNote(pc, useFlats);
}

function _shouldUseFlats(keyRoot, keyQuality) {
  // Normalize root
  const rootPC = noteToPC(keyRoot);
  if (isNaN(rootPC)) return false;

  // Major keys with flats: F, Bb, Eb, Ab, Db, Gb, Cb
  const majorFlatRoots = new Set([5, 10, 3, 8, 1, 6, 11]); // F, Bb, Eb, Ab, Db, Gb, Cb
  // Minor keys with flats: D, G, C, F, Bb, Eb, Ab
  const minorFlatRoots = new Set([2, 7, 0, 5, 10, 3, 8]);  // Dm, Gm, Cm, Fm, Bbm, Ebm, Abm

  if (keyQuality === "minor") return minorFlatRoots.has(rootPC);
  return majorFlatRoots.has(rootPC);
}

// ════════════════════════════════════════════════════════════════════
// TRIAD UTILITIES
// ════════════════════════════════════════════════════════════════════

const _triadIntervals = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  diminished: [0, 3, 6],
  augmented:  [0, 4, 8],
};

/**
 * Return array of 3 pitch class integers for a triad.
 * @param {string|number} root - note name or pitch class
 * @param {string} quality - "major"|"minor"|"diminished"|"augmented"
 */
function triadPCs(root, quality) {
  const rootPC = typeof root === "number" ? ((root % 12) + 12) % 12 : noteToPC(root);
  const intervals = _triadIntervals[quality];
  if (!intervals) return null;
  return intervals.map(iv => (rootPC + iv) % 12);
}

/**
 * Return array of 3 pitch class names for a triad.
 * Uses context-appropriate spelling (minor triads prefer flats for the ♭3).
 */
function triadNotes(root, quality) {
  const pcs = triadPCs(root, quality);
  if (!pcs) return null;
  const useFlats = quality === "minor" || quality === "diminished";
  return pcs.map(pc => pcToNote(pc, useFlats));
}

// ════════════════════════════════════════════════════════════════════
// EXTENDED CHORD TYPES
// ════════════════════════════════════════════════════════════════════
//
// The Tonnetz geometry fundamentally represents triads. Seventh chords,
// sus chords, and extensions don't form triangles, so we treat the base
// triad as the harmonic core and layer additional "extension" notes on
// top. Every chord type records:
//   - intervals: semitones from root (all notes including extensions)
//   - symbol:    display suffix ('', 'm', '7', 'maj7', 'sus4', ...)
//   - name:      human-readable name
//   - base:      base triad quality for Tonnetz rendering. null for sus
//                chords, which have no third and therefore no major/minor
//                base; the Tonnetz represents them as the first 3 notes.

const CHORD_TYPES = {
  // Triads — mirror _triadIntervals
  major:       { intervals: [0, 4, 7],         symbol: "",      name: "Major",              base: "major" },
  minor:       { intervals: [0, 3, 7],         symbol: "m",     name: "Minor",              base: "minor" },
  diminished:  { intervals: [0, 3, 6],         symbol: "°",     name: "Diminished",         base: "diminished" },
  augmented:   { intervals: [0, 4, 8],         symbol: "+",     name: "Augmented",          base: "augmented" },

  // Seventh chords
  dom7:        { intervals: [0, 4, 7, 10],     symbol: "7",     name: "Dominant 7th",       base: "major" },
  maj7:        { intervals: [0, 4, 7, 11],     symbol: "maj7",  name: "Major 7th",          base: "major" },
  min7:        { intervals: [0, 3, 7, 10],     symbol: "m7",    name: "Minor 7th",          base: "minor" },
  dim7:        { intervals: [0, 3, 6, 9],      symbol: "°7",    name: "Diminished 7th",     base: "diminished" },
  "half-dim7": { intervals: [0, 3, 6, 10],     symbol: "ø7",    name: "Half-diminished 7th",base: "diminished" },
  minmaj7:     { intervals: [0, 3, 7, 11],     symbol: "mΔ7",   name: "Minor-major 7th",    base: "minor" },

  // Suspended (no third — no major/minor base)
  sus4:        { intervals: [0, 5, 7],         symbol: "sus4",  name: "Suspended 4th",      base: null },
  sus2:        { intervals: [0, 2, 7],         symbol: "sus2",  name: "Suspended 2nd",      base: null },
  "7sus4":     { intervals: [0, 5, 7, 10],     symbol: "7sus4", name: "Dominant 7th sus4",  base: null },

  // Extended (future — defined here so consumers can already reference them)
  add9:        { intervals: [0, 4, 7, 14],     symbol: "add9",  name: "Add 9",              base: "major" },
  dom9:        { intervals: [0, 4, 7, 10, 14], symbol: "9",     name: "Dominant 9th",       base: "major" },
  maj9:        { intervals: [0, 4, 7, 11, 14], symbol: "maj9",  name: "Major 9th",          base: "major" },
  min9:        { intervals: [0, 3, 7, 10, 14], symbol: "m9",    name: "Minor 9th",          base: "minor" },
};

function _rootToPC(root) {
  return typeof root === "number" ? ((root % 12) + 12) % 12 : noteToPC(root);
}

/**
 * Return all pitch classes for a chord type.
 * @param {string|number} root
 * @param {string} type — key from CHORD_TYPES
 * @returns {number[]|null}
 */
function chordPCs(root, type) {
  const def = CHORD_TYPES[type];
  if (!def) return null;
  const rootPC = _rootToPC(root);
  if (isNaN(rootPC)) return null;
  return def.intervals.map(iv => (rootPC + iv) % 12);
}

/**
 * Return all note names for a chord type. Uses flat spelling for chords
 * whose base triad is minor or diminished (same policy as triadNotes).
 * Sus chords default to sharp spelling.
 * @param {string|number} root
 * @param {string} type
 * @returns {string[]|null}
 */
function chordNotes(root, type) {
  const def = CHORD_TYPES[type];
  if (!def) return null;
  const pcs = chordPCs(root, type);
  if (!pcs) return null;
  const useFlats = def.base === "minor" || def.base === "diminished";
  return pcs.map(pc => pcToNote(pc, useFlats));
}

/**
 * Extract the base triad from any chord type — the 3-note core that the
 * Tonnetz renderer uses to draw a triangle.
 *
 * For sus chords (base: null), returns quality 'sus' with notes built
 * from the first 3 intervals, since there is no major/minor third.
 *
 * @param {string|number} root
 * @param {string} type
 * @returns {{root, quality, notes}|null}
 */
function baseTriad(root, type) {
  const def = CHORD_TYPES[type];
  if (!def) return null;
  if (def.base === null) {
    const rootPC = _rootToPC(root);
    if (isNaN(rootPC)) return null;
    const core = def.intervals.slice(0, 3);
    const notes = core.map(iv => pcToNote((rootPC + iv) % 12));
    return { root, quality: "sus", notes };
  }
  return { root, quality: def.base, notes: triadNotes(root, def.base) };
}

/**
 * Return the note names of intervals that extend beyond the base triad
 * (e.g. the ♭7 of a dom7). Sus chords treat the first 3 intervals as the
 * core and everything after as extensions.
 * @param {string|number} root
 * @param {string} type
 * @returns {string[]|null}
 */
function extensionNotes(root, type) {
  const def = CHORD_TYPES[type];
  if (!def) return null;
  const rootPC = _rootToPC(root);
  if (isNaN(rootPC)) return null;
  const coreIntervals = def.base === null
    ? def.intervals.slice(0, 3)
    : _triadIntervals[def.base];
  const coreSet = new Set(coreIntervals);
  const extIntervals = def.intervals.filter(iv => !coreSet.has(iv));
  const useFlats = def.base === "minor" || def.base === "diminished";
  return extIntervals.map(iv => pcToNote((rootPC + iv) % 12, useFlats));
}

/**
 * Return the display symbol for a chord (e.g. 'B7', 'Cmaj7', 'Am7').
 * @param {string|number} root
 * @param {string} type
 * @returns {string|null}
 */
function chordSymbol(root, type) {
  const def = CHORD_TYPES[type];
  if (!def) return null;
  return String(root) + def.symbol;
}

// ════════════════════════════════════════════════════════════════════
// PLR TRANSFORMS
// ════════════════════════════════════════════════════════════════════

const TRANSFORMS = {
  P: {
    name: "Parallel",
    description: "Same root, flip quality (major ↔ minor).",
    humanLabel: {
      beginner: "Parallel",
      intermediate: "P (Parallel)",
      advanced: "P"
    },
    commonToneCount: 2,
    apply(root, quality) {
      // P: keep root, flip quality
      const newQuality = quality === "major" ? "minor" : "major";
      return { root, quality: newQuality };
    }
  },

  L: {
    name: "Leading-Tone Exchange",
    description: "Move the root (in major) or the fifth (in minor) by one semitone.",
    humanLabel: {
      beginner: "Leading tone",
      intermediate: "L (Leading tone)",
      advanced: "L"
    },
    commonToneCount: 2,
    apply(root, quality) {
      const rootPC = noteToPC(root);
      if (quality === "major") {
        // Major → minor: lower root by 1 → that becomes 5th of new minor triad
        // C major (C,E,G) → E minor (E,G,B): move C→B, new root = E
        const third = (rootPC + 4) % 12; // the major 3rd becomes the new root
        const newRoot = pcToNote(third);
        return { root: newRoot, quality: "minor" };
      } else {
        // Minor → major: raise 5th by 1 → that becomes root of new major triad
        // E minor (E,G,B) → C major (C,E,G): move B→C, new root = C
        const fifth = (rootPC + 7) % 12;
        const newRootPC = (fifth + 1) % 12;
        const newRoot = pcToNote(newRootPC);
        return { root: newRoot, quality: "major" };
      }
    }
  },

  R: {
    name: "Relative",
    description: "Move to the relative major or minor.",
    humanLabel: {
      beginner: "Relative",
      intermediate: "R (Relative)",
      advanced: "R"
    },
    commonToneCount: 2,
    apply(root, quality) {
      const rootPC = noteToPC(root);
      if (quality === "major") {
        // Major → minor: raise 5th by 2 → new root of minor triad
        // C major (C,E,G) → A minor (A,C,E): move G→A, new root = A
        const fifth = (rootPC + 7) % 12;
        const newRootPC = (fifth + 2) % 12;
        const useFlats = _shouldUseFlats(root, quality);
        const newRoot = pcToNote(newRootPC, useFlats);
        return { root: newRoot, quality: "minor" };
      } else {
        // Minor → major: lower root by 2 → that becomes 5th of new major triad
        // A minor (A,C,E) → C major (C,E,G): move A→G, new root = C
        const minorThird = (rootPC + 3) % 12; // minor 3rd = new root of major
        const newRoot = pcToNote(minorThird);
        return { root: newRoot, quality: "major" };
      }
    }
  }
};

/**
 * Analyze the relationship between two triads.
 * Returns common tones, the moving tone, and which PLR transform (if any) connects them.
 */
function analyzeTransform(fromRoot, fromQuality, toRoot, toQuality) {
  const fromPCs = triadPCs(fromRoot, fromQuality);
  const toPCs   = triadPCs(toRoot, toQuality);

  const fromSet = new Set(fromPCs);
  const toSet   = new Set(toPCs);

  const commonTonePCs = fromPCs.filter(pc => toSet.has(pc));
  const movingFromPC  = fromPCs.find(pc => !toSet.has(pc));
  const movingToPC    = toPCs.find(pc => !fromSet.has(pc));

  const commonTones = commonTonePCs.map(pc => pcToNote(pc));
  const movingTone  = {
    from: movingFromPC !== undefined ? pcToNote(movingFromPC) : null,
    to:   movingToPC   !== undefined ? pcToNote(movingToPC)   : null
  };

  // Determine transform type by checking each PLR transform
  let transformType = null;
  for (const key of ["P", "L", "R"]) {
    const result = TRANSFORMS[key].apply(fromRoot, fromQuality);
    const resultPCs = triadPCs(result.root, result.quality);
    if (resultPCs && _sameTriad(resultPCs, toPCs)) {
      transformType = key;
      break;
    }
  }

  return { commonTones, movingTone, transformType };
}

/** Check if two triads (as PC arrays) contain the same pitch classes. */
function _sameTriad(pcsA, pcsB) {
  const a = new Set(pcsA);
  const b = new Set(pcsB);
  if (a.size !== b.size) return false;
  for (const pc of a) { if (!b.has(pc)) return false; }
  return true;
}

/**
 * Return all three PLR neighbors of a triad.
 */
function getNeighbors(root, quality) {
  return {
    P: TRANSFORMS.P.apply(root, quality),
    L: TRANSFORMS.L.apply(root, quality),
    R: TRANSFORMS.R.apply(root, quality)
  };
}

// ════════════════════════════════════════════════════════════════════
// INTERVAL UTILITIES
// ════════════════════════════════════════════════════════════════════

const INTERVALS = [
  { semitones: 0,  short: "P1",  name: "Perfect Unison" },
  { semitones: 1,  short: "m2",  name: "Minor 2nd" },
  { semitones: 2,  short: "M2",  name: "Major 2nd" },
  { semitones: 3,  short: "m3",  name: "Minor 3rd" },
  { semitones: 4,  short: "M3",  name: "Major 3rd" },
  { semitones: 5,  short: "P4",  name: "Perfect 4th" },
  { semitones: 6,  short: "TT",  name: "Tritone" },
  { semitones: 7,  short: "P5",  name: "Perfect 5th" },
  { semitones: 8,  short: "m6",  name: "Minor 6th" },
  { semitones: 9,  short: "M6",  name: "Major 6th" },
  { semitones: 10, short: "m7",  name: "Minor 7th" },
  { semitones: 11, short: "M7",  name: "Major 7th" },
  { semitones: 12, short: "P8",  name: "Perfect Octave" },
];

/**
 * Return the interval object for the ascending distance between two pitch classes.
 */
function intervalBetween(noteA, noteB) {
  const pcA = typeof noteA === "number" ? noteA : noteToPC(noteA);
  const pcB = typeof noteB === "number" ? noteB : noteToPC(noteB);
  const semitones = ((pcB - pcA) % 12 + 12) % 12;
  return INTERVALS[semitones]; // index 0–11
}

/**
 * Map a semitone distance to a Tonnetz axis.
 *
 * The three Tonnetz axes:
 *   - "major_third"   → 4 semitones (horizontal)
 *   - "minor_third"   → 3 semitones (diagonal up-right)
 *   - "perfect_fifth" → 7 semitones (diagonal down-right)
 *
 * Inversions return the axis with direction: "negative".
 * Intervals not on a single axis return null.
 */
function intervalToTonnetzDirection(semitones) {
  const s = ((semitones % 12) + 12) % 12;

  const axisMap = {
    3:  { axis: "minor_third",   direction: "positive" },
    4:  { axis: "major_third",   direction: "positive" },
    7:  { axis: "perfect_fifth", direction: "positive" },
    // Inversions
    9:  { axis: "minor_third",   direction: "negative" },  // 12 - 3
    8:  { axis: "major_third",   direction: "negative" },  // 12 - 4
    5:  { axis: "perfect_fifth", direction: "negative" },  // 12 - 7
  };

  return axisMap[s] || null;
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

// ES module exports
export {
  NOTE_NAMES,
  NOTE_NAMES_FLAT,
  noteToPC,
  pcToNote,
  spellingForKey,
  triadNotes,
  triadPCs,
  CHORD_TYPES,
  chordPCs,
  chordNotes,
  baseTriad,
  extensionNotes,
  chordSymbol,
  TRANSFORMS,
  analyzeTransform,
  getNeighbors,
  INTERVALS,
  intervalBetween,
  intervalToTonnetzDirection,
};

// Global window export for non-module consumers
if (typeof window !== "undefined") {
  window.Transforms = {
    NOTE_NAMES,
    NOTE_NAMES_FLAT,
    noteToPC,
    pcToNote,
    spellingForKey,
    triadNotes,
    triadPCs,
    CHORD_TYPES,
    chordPCs,
    chordNotes,
    baseTriad,
    extensionNotes,
    chordSymbol,
    TRANSFORMS,
    analyzeTransform,
    getNeighbors,
    INTERVALS,
    intervalBetween,
    intervalToTonnetzDirection,
  };
}

// ════════════════════════════════════════════════════════════════════
// SELF-TEST (manual — run: node static/shared/transforms.js)
// ════════════════════════════════════════════════════════════════════

/* --- Self-test: uncomment this block or run with TRANSFORMS_TEST=1 ---

(function selfTest() {
  const results = [];
  function assert(label, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ label, pass, actual, expected });
    console.log(pass ? `  ✓ ${label}` : `  ✗ ${label}\n      got:      ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`);
  }

  console.log("\n─── transforms.js self-test ───\n");

  // 1. triadNotes C major
  assert("triadNotes('C','major') = [C, E, G]",
    triadNotes("C", "major"), ["C", "E", "G"]);

  // 2. triadNotes A minor
  assert("triadNotes('A','minor') = [A, C, E]",
    triadNotes("A", "minor"), ["A", "C", "E"]);

  // 3. P transform: C major → C minor
  const p = TRANSFORMS.P.apply("C", "major");
  assert("P: C major → C minor",
    p, { root: "C", quality: "minor" });

  // 4. L transform: C major → E minor
  const l = TRANSFORMS.L.apply("C", "major");
  assert("L: C major → E minor",
    l, { root: "E", quality: "minor" });

  // 5. R transform: C major → A minor
  const r = TRANSFORMS.R.apply("C", "major");
  assert("R: C major → A minor",
    r, { root: "A", quality: "minor" });

  // 6. Round-trip: P applied twice returns to original
  const pp = TRANSFORMS.P.apply(p.root, p.quality);
  assert("P round-trip: C major → C minor → C major",
    pp, { root: "C", quality: "major" });

  // 7. analyzeTransform C major → A minor = R
  const analysis = analyzeTransform("C", "major", "A", "minor");
  assert("analyzeTransform(C maj, A min).transformType = R",
    analysis.transformType, "R");

  // 8. getNeighbors C major
  const neighbors = getNeighbors("C", "major");
  assert("getNeighbors(C,major).P = C minor",
    neighbors.P, { root: "C", quality: "minor" });
  assert("getNeighbors(C,major).L = E minor",
    neighbors.L, { root: "E", quality: "minor" });
  assert("getNeighbors(C,major).R = A minor",
    neighbors.R, { root: "A", quality: "minor" });

  // 9. intervalBetween C → E = M3
  assert("intervalBetween('C','E').short = M3",
    intervalBetween("C", "E").short, "M3");

  // 10. intervalToTonnetzDirection(4) axis = major_third
  assert("intervalToTonnetzDirection(4).axis = major_third",
    intervalToTonnetzDirection(4).axis, "major_third");

  // 11. chordPCs('B','dom7') = [11, 3, 6, 9]
  assert("chordPCs('B','dom7') = [11,3,6,9]",
    chordPCs("B", "dom7"), [11, 3, 6, 9]);

  // 12. chordNotes('C','maj7') = [C, E, G, B]
  assert("chordNotes('C','maj7') = [C, E, G, B]",
    chordNotes("C", "maj7"), ["C", "E", "G", "B"]);

  // 13. baseTriad('B','dom7') → major with [B, D♯, F♯]
  assert("baseTriad('B','dom7') quality = major",
    baseTriad("B", "dom7").quality, "major");
  assert("baseTriad('B','dom7') notes = [B, D♯, F♯]",
    baseTriad("B", "dom7").notes, ["B", "D♯", "F♯"]);

  // 14. extensionNotes('B','dom7') = [A]
  assert("extensionNotes('B','dom7') = [A]",
    extensionNotes("B", "dom7"), ["A"]);

  // 15. chordSymbol('B','dom7') = 'B7'
  assert("chordSymbol('B','dom7') = 'B7'",
    chordSymbol("B", "dom7"), "B7");

  // 16. chordPCs sus4 returns 3 notes (no third)
  assert("chordPCs('C','sus4').length = 3",
    chordPCs("C", "sus4").length, 3);

  // Summary
  const passed = results.filter(r => r.pass).length;
  console.log(`\n─── ${passed}/${results.length} passed ───\n`);
})();

--- End self-test --- */
