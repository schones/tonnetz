/**
 * harmony-state.js
 * ================
 * Shared state object with pub/sub for the linked Tonnetz
 * neighborhood view and keyboard components.
 *
 * Pure state management — zero rendering logic.
 * Games and components subscribe via HarmonyState.on().
 * Game logic is the only writer.
 *
 * Consumed by:
 *   - tonnetz-neighborhood.js  → Tonnetz SVG renderer
 *   - keyboard-view.js         → keyboard highlight layer
 *   - relative_key_trainer     → game logic (writer)
 *   - harmony_trainer          → game logic (writer)
 *
 * Depends on:
 *   - transforms.js            → triadNotes, analyzeTransform, intervalBetween, TRANSFORMS
 *
 * Exposes: window.HarmonyState  (also ES-module exports)
 */

import {
  triadNotes,
  TRANSFORMS,
  analyzeTransform,
  intervalBetween,
  noteToPC,
} from './transforms.js';

// ════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ════════════════════════════════════════════════════════════════════

function _defaultState() {
  return {
    activeTriads: [],
    activeInterval: null,
    activeNotes: [],
    activeTransform: null,
    tonnetzCenter: null,
    tonnetzDepth: 1,
    keyboardRange: { low: "C3", high: "B5" },
    keyboardMode: "display",
    annotations: {
      showTransformLabels: false,
      showCommonTones: true,
      showMovingTone: true,
      showChordLabel: true,
      showIntervalEdge: false,
      showIntervalLabel: false,
      showIntervalDistance: false,
      showNoteNames: true,
    },
    animationQueue: [],
    progressionState: {
      chords: [],         // Array of { root, quality, notes, romanNumeral }
      currentIndex: -1,   // Which chord is active (-1 = none)
      key: null,          // Key context (e.g. 'C')
      isPlaying: false,   // Transport state
      tempo: 100,         // BPM for auto-advance
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// HARMONY STATE
// ════════════════════════════════════════════════════════════════════

const HarmonyState = {
  _state: _defaultState(),
  _listeners: [],
  _batching: false,

  // ── Read ────────────────────────────────────────────────────────

  /** Return a shallow copy of the current state. */
  get() {
    return Object.assign({}, this._state);
  },

  // ── Write ───────────────────────────────────────────────────────

  /**
   * Shallow-merge partial into state, then notify listeners.
   * Top-level keys only — nested objects are replaced, not deep-merged.
   */
  update(partial) {
    Object.assign(this._state, partial);
    this._notify();
  },

  /**
   * Shallow-merge partial into state WITHOUT notifying listeners.
   * Use only for internal bookkeeping that other subscribers should
   * not react to (e.g. visual-layer writing computed colors back into
   * activeNotes so the SVG renderer can read them on its NEXT render).
   */
  updateSilent(partial) {
    Object.assign(this._state, partial);
  },

  /**
   * Batch multiple mutations into a single notification.
   * fn receives the live state object for direct mutation.
   */
  batch(fn) {
    this._batching = true;
    fn(this._state);
    this._batching = false;
    this._notify();
  },

  // ── Subscribe ───────────────────────────────────────────────────

  /**
   * Subscribe to state changes. fn receives the full state on every update.
   * Returns an unsubscribe function.
   */
  on(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  },

  // ── Reset ───────────────────────────────────────────────────────

  /** Restore to default empty state and notify. */
  reset() {
    // Stop any active playback before resetting
    if (this._playbackTimer) {
      clearInterval(this._playbackTimer);
      this._playbackTimer = null;
    }
    this._state = _defaultState();
    this._notify();
  },

  // ── Internal ────────────────────────────────────────────────────

  _notify() {
    if (this._batching) return;
    const state = this._state;
    for (const fn of this._listeners) {
      fn(state);
    }
  },

  // ════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * Set a single active triad (clears existing).
   * Computes notes via Transforms, populates activeNotes, sets tonnetzCenter.
   */
  setTriad(root, quality, role) {
    role = role || "primary";
    const notes = triadNotes(root, quality);
    const triad = { root, quality, notes, role, color: null };

    const activeNotes = _notesFromTriad(notes, role);

    this.update({
      activeTriads: [triad],
      activeNotes,
      tonnetzCenter: { root, quality },
      activeTransform: null,
    });
  },

  /**
   * Add a triad without clearing existing ones. Appends to activeNotes.
   */
  addTriad(root, quality, role) {
    role = role || "secondary";
    const notes = triadNotes(root, quality);
    const triad = { root, quality, notes, role, color: null };

    const newNotes = _notesFromTriad(notes, role);

    this.update({
      activeTriads: [...this._state.activeTriads, triad],
      activeNotes: [...this._state.activeNotes, ...newNotes],
    });
  },

  /**
   * Apply a named PLR transform from a source triad.
   * Sets the "from" triad as ghost and the "to" triad as primary.
   * Populates activeTransform with commonTones and movingTone.
   */
  setTransform(type, fromRoot, fromQuality) {
    const transform = TRANSFORMS[type];
    if (!transform) return;

    const to = transform.apply(fromRoot, fromQuality);
    const analysis = analyzeTransform(fromRoot, fromQuality, to.root, to.quality);

    const fromNotes = triadNotes(fromRoot, fromQuality);
    const toNotes   = triadNotes(to.root, to.quality);

    const fromTriad = { root: fromRoot, quality: fromQuality, notes: fromNotes, role: "ghost", color: null };
    const toTriad   = { root: to.root,  quality: to.quality,  notes: toNotes,  role: "primary", color: null };

    const activeNotes = [
      ..._notesFromTriad(fromNotes, "ghost"),
      ..._notesFromTriad(toNotes, "primary"),
    ];

    this.update({
      activeTriads: [fromTriad, toTriad],
      activeNotes,
      activeTransform: {
        type,
        from: { root: fromRoot, quality: fromQuality },
        to:   { root: to.root,  quality: to.quality },
        label: transform.humanLabel.intermediate,
        commonTones: analysis.commonTones,
        movingTone: analysis.movingTone,
      },
      tonnetzCenter: { root: to.root, quality: to.quality },
    });
  },

  /**
   * Set an active interval. Clears activeTriads (interval and triad modes are separate).
   * Populates activeNotes with source "interval".
   */
  setInterval(noteA, octaveA, noteB, octaveB, direction) {
    direction = direction || "ascending";
    const interval = intervalBetween(noteA, noteB);

    this.update({
      activeInterval: {
        notes: [noteA, noteB],
        semitones: interval.semitones,
        quality: interval.short,
        label: interval.name,
        role: "primary",
        direction,
      },
      activeNotes: [
        { note: noteA, octave: octaveA, source: "interval", color: null },
        { note: noteB, octave: octaveB, source: "interval", color: null },
      ],
      activeTriads: [],
      activeTransform: null,
    });
  },

  /**
   * Toggle a single note in/out of activeNotes by pitch class AND octave.
   * Clears activeTriads and activeTransform (note mode is exclusive with triad mode).
   * Enharmonic-safe: C♯ and D♭ are treated as the same pitch class.
   * Each unique (pitchClass, octave) pair is independently toggle-able,
   * so C4 and C5 can coexist as separate entries.
   *
   * @param {string} noteName  – e.g. "C", "F♯"
   * @param {number} [octave]  – specific octave; defaults to 4
   */
  toggleNote(noteName, octave) {
    octave = (octave != null) ? octave : 4;
    // Note mode is mutually exclusive with progression mode
    if (this._state.progressionState.chords.length > 0) {
      this.clearProgression();
    }
    const targetPC = noteToPC(noteName);
    const notes = this._state.activeNotes || [];
    const hasNote = notes.some(n => noteToPC(n.note) === targetPC && n.octave === octave);

    if (hasNote) {
      this.update({
        activeNotes: notes.filter(n => !(noteToPC(n.note) === targetPC && n.octave === octave)),
        activeTriads: [],
        activeTransform: null,
        tonnetzCenter: this._state.tonnetzCenter,  // preserve center so Tonnetz doesn't jump
      });
    } else {
      this.update({
        activeNotes: [...notes, { note: noteName, octave, source: 'user', color: null }],
        activeTriads: [],
        activeTransform: null,
        tonnetzCenter: this._state.tonnetzCenter,
      });
    }
  },

  /** Alias for reset(). */
  clearAll() {
    this.reset();
  },

  // ════════════════════════════════════════════════════════════════
  // PROGRESSION METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * Load a chord progression. Clears Note Mode state.
   * @param {Array<{root, quality, notes, romanNumeral}>} chords
   * @param {string} key — key context (e.g. 'C')
   */
  setProgression(chords, key) {
    this.batch(state => {
      // Save pre-progression depth so we can restore it on clear
      state._preProgressionDepth = state.tonnetzDepth;
      state.progressionState = {
        chords: chords || [],
        currentIndex: -1,
        key: key || null,
        isPlaying: false,
        tempo: state.progressionState.tempo || 100,
      };
      // Lock the Tonnetz center on the key's tonic chord for the duration
      // of the progression — stepping between chords should NOT re-center.
      const tonic = key || (chords && chords.length ? chords[0].root : null);
      if (tonic) {
        state.tonnetzCenter = { root: tonic, quality: 'major' };
      }
      // Increase depth so all diatonic chords are visible simultaneously
      state.tonnetzDepth = 3;
      // Clear note-mode state (progression and note mode are mutually exclusive)
      state.activeTriads = [];
      state.activeNotes = [];
      state.activeTransform = null;
      state.activeInterval = null;
    });
  },

  /**
   * Jump to a specific chord index in the progression.
   * Updates activeTriads/activeNotes so all existing subscribers
   * (keyboard, chord wheel, audio) react normally.
   * tonnetzCenter is NOT updated — the grid stays locked on the key tonic.
   * @param {number} index
   */
  setProgressionIndex(index) {
    const prog = this._state.progressionState;
    if (!prog.chords.length) return;
    const i = Math.max(0, Math.min(index, prog.chords.length - 1));
    const chord = prog.chords[i];

    // Compute common tones with previous chord for transition highlight
    const prevChord = i > 0 ? prog.chords[i - 1] : null;
    let commonTones = [];
    if (prevChord) {
      const prevPCs = new Set((prevChord.notes || []).map(n => noteToPC(n)));
      commonTones = (chord.notes || []).filter(n => prevPCs.has(noteToPC(n)));
    }

    const notes = triadNotes(chord.root, chord.quality);
    const activeNotes = _notesFromTriad(notes, 'primary');

    this.batch(state => {
      state.progressionState.currentIndex = i;
      state.activeTriads = [{ root: chord.root, quality: chord.quality, notes, role: 'primary', color: null }];
      state.activeNotes = activeNotes;
      state.activeTransform = null;
      state.activeInterval = null;
      // Do NOT update tonnetzCenter — the grid stays locked on the key tonic
      // so the glow worm moves across a stable grid.
      // Stash common tones for the renderer to pick up
      state._progressionCommonTones = commonTones;
      state._progressionEvent = true;
    });
  },

  /**
   * Step forward or backward through the progression.
   * @param {number} direction — +1 or -1
   */
  stepProgression(direction) {
    const prog = this._state.progressionState;
    if (!prog.chords.length) return;
    const next = prog.currentIndex + (direction || 1);
    if (next < 0 || next >= prog.chords.length) return;
    this.setProgressionIndex(next);
  },

  /** Clear progression and return to normal Explorer mode. */
  clearProgression() {
    this.stopPlayback();
    this.batch(state => {
      // Restore pre-progression depth
      if (state._preProgressionDepth != null) {
        state.tonnetzDepth = state._preProgressionDepth;
        delete state._preProgressionDepth;
      }
      state.progressionState = {
        chords: [],
        currentIndex: -1,
        key: null,
        isPlaying: false,
        tempo: 100,
      };
      state._progressionCommonTones = [];
      state._progressionEvent = false;
      state.activeTriads = [];
      state.activeNotes = [];
      state.activeTransform = null;
      state.tonnetzCenter = null;
    });
  },

  // ════════════════════════════════════════════════════════════════
  // TRANSPORT (auto-play)
  // ════════════════════════════════════════════════════════════════

  _playbackTimer: null,

  /** Begin auto-advancing through the progression at the set tempo. */
  startPlayback() {
    const prog = this._state.progressionState;
    if (!prog.chords.length) return;
    if (prog.isPlaying) return;

    // Start from 0 if not yet started
    if (prog.currentIndex < 0) this.setProgressionIndex(0);

    prog.isPlaying = true;
    this._notify();

    const msPerBeat = 60000 / (prog.tempo || 100);
    this._playbackTimer = setInterval(() => {
      const p = this._state.progressionState;
      const next = p.currentIndex + 1;
      if (next >= p.chords.length) {
        this.stopPlayback();
        return;
      }
      this.setProgressionIndex(next);
    }, msPerBeat);
  },

  /** Pause playback at current position. */
  stopPlayback() {
    if (this._playbackTimer) {
      clearInterval(this._playbackTimer);
      this._playbackTimer = null;
    }
    if (this._state.progressionState.isPlaying) {
      this._state.progressionState.isPlaying = false;
      this._notify();
    }
  },

  /** Reset playback to the beginning. */
  resetPlayback() {
    this.stopPlayback();
    if (this._state.progressionState.chords.length) {
      this.setProgressionIndex(0);
    }
  },
};

// ── Helper ────────────────────────────────────────────────────────

/** Build activeNotes entries from a triad's note names. Default octave 4. */
function _notesFromTriad(notes, role) {
  const source = role === "ghost" ? "triad" : "triad";
  return notes.map(note => ({
    note,
    octave: 4,
    source,
    color: null,
  }));
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { HarmonyState };

if (typeof window !== "undefined") {
  window.HarmonyState = HarmonyState;
}

// ════════════════════════════════════════════════════════════════════
// SELF-TEST (manual — run: node --input-type=module static/shared/harmony-state.js)
// ════════════════════════════════════════════════════════════════════

/* --- Self-test: uncomment this block to run ---

(function selfTest() {
  const results = [];
  function assert(label, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ label, pass });
    console.log(pass ? `  ✓ ${label}` : `  ✗ ${label}\n      got:      ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`);
  }

  console.log("\n─── harmony-state.js self-test ───\n");

  // 1. get() returns default state with empty arrays
  HarmonyState.reset();
  const def = HarmonyState.get();
  assert("get() default activeTriads = []",
    def.activeTriads, []);
  assert("get() default activeInterval = null",
    def.activeInterval, null);
  assert("get() default activeNotes = []",
    def.activeNotes, []);
  assert("get() default tonnetzDepth = 1",
    def.tonnetzDepth, 1);

  // 2. update() merges correctly and notifies listener
  let notified = false;
  const unsub = HarmonyState.on(() => { notified = true; });
  HarmonyState.update({ tonnetzDepth: 2 });
  assert("update() merges tonnetzDepth",
    HarmonyState.get().tonnetzDepth, 2);
  assert("update() notifies listener",
    notified, true);

  // 3. on() returns a working unsubscribe function
  notified = false;
  unsub();
  HarmonyState.update({ tonnetzDepth: 3 });
  assert("unsubscribe stops notifications",
    notified, false);

  // 4. batch() suppresses intermediate notifications
  HarmonyState.reset();
  let batchCallCount = 0;
  const unsub2 = HarmonyState.on(() => { batchCallCount++; });
  HarmonyState.batch(state => {
    state.tonnetzDepth = 5;
    state.keyboardMode = "input";
  });
  assert("batch() fires exactly 1 notification",
    batchCallCount, 1);
  assert("batch() applied tonnetzDepth",
    HarmonyState.get().tonnetzDepth, 5);
  assert("batch() applied keyboardMode",
    HarmonyState.get().keyboardMode, "input");
  unsub2();

  // 5. setTriad("C", "major") populates correctly
  HarmonyState.reset();
  HarmonyState.setTriad("C", "major");
  const s5 = HarmonyState.get();
  assert("setTriad activeTriads length = 1",
    s5.activeTriads.length, 1);
  assert("setTriad root = C",
    s5.activeTriads[0].root, "C");
  assert("setTriad quality = major",
    s5.activeTriads[0].quality, "major");
  assert("setTriad notes = [C, E, G]",
    s5.activeTriads[0].notes, ["C", "E", "G"]);
  assert("setTriad role = primary",
    s5.activeTriads[0].role, "primary");
  assert("setTriad activeNotes length = 3",
    s5.activeNotes.length, 3);
  assert("setTriad activeNotes[0].note = C",
    s5.activeNotes[0].note, "C");
  assert("setTriad tonnetzCenter = {C, major}",
    s5.tonnetzCenter, { root: "C", quality: "major" });

  // 6. addTriad("A", "minor", "secondary") adds without clearing
  HarmonyState.addTriad("A", "minor", "secondary");
  const s6 = HarmonyState.get();
  assert("addTriad activeTriads length = 2",
    s6.activeTriads.length, 2);
  assert("addTriad second triad root = A",
    s6.activeTriads[1].root, "A");
  assert("addTriad second triad role = secondary",
    s6.activeTriads[1].role, "secondary");
  assert("addTriad activeNotes length = 6",
    s6.activeNotes.length, 6);

  // 7. setTransform("R", "C", "major") → A minor
  HarmonyState.reset();
  HarmonyState.setTransform("R", "C", "major");
  const s7 = HarmonyState.get();
  assert("setTransform type = R",
    s7.activeTransform.type, "R");
  assert("setTransform from = {C, major}",
    s7.activeTransform.from, { root: "C", quality: "major" });
  assert("setTransform to = {A, minor}",
    s7.activeTransform.to, { root: "A", quality: "minor" });
  assert("setTransform commonTones = [C, E]",
    s7.activeTransform.commonTones, ["C", "E"]);
  assert("setTransform movingTone = {G → A}",
    s7.activeTransform.movingTone, { from: "G", to: "A" });
  assert("setTransform ghost triad = C major",
    s7.activeTriads[0].role, "ghost");
  assert("setTransform primary triad = A minor",
    s7.activeTriads[1].role, "primary");

  // 8. setInterval("C", 4, "E", 4) → M3, clears triads
  HarmonyState.setTriad("C", "major"); // set a triad first
  HarmonyState.setInterval("C", 4, "E", 4);
  const s8 = HarmonyState.get();
  assert("setInterval quality = M3",
    s8.activeInterval.quality, "M3");
  assert("setInterval semitones = 4",
    s8.activeInterval.semitones, 4);
  assert("setInterval label = Major 3rd",
    s8.activeInterval.label, "Major 3rd");
  assert("setInterval notes = [C, E]",
    s8.activeInterval.notes, ["C", "E"]);
  assert("setInterval clears activeTriads",
    s8.activeTriads, []);
  assert("setInterval activeNotes source = interval",
    s8.activeNotes[0].source, "interval");

  // 9. reset() restores default and notifies
  let resetNotified = false;
  const unsub3 = HarmonyState.on(() => { resetNotified = true; });
  HarmonyState.reset();
  const s9 = HarmonyState.get();
  assert("reset() clears activeTriads",
    s9.activeTriads, []);
  assert("reset() clears activeInterval",
    s9.activeInterval, null);
  assert("reset() clears activeNotes",
    s9.activeNotes, []);
  assert("reset() notifies",
    resetNotified, true);
  unsub3();

  // Summary
  const passed = results.filter(r => r.pass).length;
  console.log(`\n─── ${passed}/${results.length} passed ───\n`);
})();

--- End self-test --- */
