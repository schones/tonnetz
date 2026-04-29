/**
 * audio-interpreter.js — Audio → MusicalEventStream interpreter
 *
 * Translates the three primitive audio detectors (onset, pitch, chord)
 * into discrete musical events on `MusicalEventStream`. Audio-side
 * counterpart to `MIDIInput`: where MIDIInput publishes `noteAttack` /
 * `noteRelease` from MIDI, AudioInterpreter publishes the same event
 * vocabulary derived from audio.
 *
 * Spec: docs/audio-interpreter-design.md (sections referenced inline).
 *
 * Three concurrent subsystems share the same primitive callbacks:
 *
 *   pitched-note tracker (Section 5)  →  noteAttack, noteRelease
 *   chord tracker        (Section 7)  →  chordChange (onset-gated)
 *   percussive-strike publisher (§6)  →  percussiveStrike (stateless)
 *
 * Lifecycle:
 *
 *   const interpreter = createAudioInterpreter({ analyser, sourceQuality });
 *   interpreter.start();                    // begins all three subsystems
 *   interpreter.stop();                     // stops all three subsystems
 *   interpreter.setAnalyser(newAnalyser);   // hot-swap (rare)
 *   interpreter.isRunning();                // boolean
 *
 * Inspection (debug):
 *
 *   window.__audioInterpreter.setDebug(true);   // log significant transitions
 *   window.__audioInterpreter.getState();       // current locked pitch, etc.
 *
 * @module audio-interpreter
 */

import { create as createOnsetDetector } from './onset-detection.js';
import { create as createChordDetector } from './chord-detection.js';
import { createPitchDetector } from './pitch-detection.js';

/* ────────────────────────────────────────────────────────────────── */
/*  Configuration — calibration-driven values, named per design doc §9 */
/* ────────────────────────────────────────────────────────────────── */

/** Pitched-note tracker (design doc §5, §9). */
const SAME_NOTE_THRESHOLD_CENTS = 100;       // ≥1 semitone counts as a different note
const DEFERRED_CLASSIFICATION_MS = 40;       // wait for pitch to catch up to onset
const PITCH_PROXIMITY_MS = 80;               // accept a confident reading this old at classification
const RELEASE_DEBOUNCE_MS = 150;             // sustained loss of confidence ⇒ release

/** Chord tracker (design doc §7, §9). */
const ONSET_GATE_MS = 200;                   // recent-onset window for permitting publish
const SUSTAINED_DRIFT_SUPPRESS_MS = 500;     // last onset older than this ⇒ suppress drift
const SILENCE_POLL_MS = 100;                 // matches cantor.html:543-563
const SILENCE_QUIET_SAMPLES = 5;             // 5 × 100 ms = 500 ms quiet ⇒ "no harmony"
const SILENCE_DB_FLOOR = -60;                // matches cantor.html:551
const SILENCE_LINEAR_THRESHOLD = 0.02;       // matches cantor.html:553

/** Percussive-strike strength weights (design doc §6).
 *  Composite: 0.4·(1-pitchConfidence) + 0.4·spectralFlatness + 0.2·transientSharpness.
 *  Calibration target during build phase; left as named constants for tuning. */
const STRENGTH_WEIGHT_PITCHEDNESS = 0.4;
const STRENGTH_WEIGHT_FLATNESS    = 0.4;
const STRENGTH_WEIGHT_TRANSIENT   = 0.2;

/** Pitched-ness window: pitch-detection reading is "recent" if within this. */
const PITCH_RECENCY_FOR_STRENGTH_MS = 100;

/** Band-classification thresholds (design doc §6, §9). */
const BAND_LOW_HZ  = 200;
const BAND_HIGH_HZ = 2000;

/** Pitch-detection sub-config (matches harmonograph.html:939). */
const PITCH_CONFIDENCE_THRESHOLD = 0.85;

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                            */
/* ────────────────────────────────────────────────────────────────── */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAME_TO_PC = (() => {
  const m = {};
  NOTE_NAMES.forEach((n, i) => { m[n] = i; });
  // Flat aliases — chord-detection emits sharps but resolveChord may yield flats.
  m['Db'] = 1; m['Eb'] = 3; m['Gb'] = 6; m['Ab'] = 8; m['Bb'] = 10;
  return m;
})();

const A4_FREQ = 440;
const A4_MIDI = 69;

/**
 * Convert frequency in Hz to a rounded MIDI note number.
 * Matches pitch-detection.js:242's `computeCents` formula.
 * @param {number} frequency
 * @returns {number} MIDI note number (rounded)
 */
function frequencyToMidi(frequency) {
  if (!(frequency > 0)) return -1;
  const midiFloat = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
  return Math.round(midiFloat);
}

/**
 * Cents distance between two MIDI note numbers (always non-negative).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function midiCentsApart(a, b) {
  return Math.abs(a - b) * 100;
}

/**
 * Convert a chord-detection root name ('C', 'F#', 'Bb', …) to a pitch class 0–11.
 * Returns -1 for unknown names.
 * @param {string} rootName
 * @returns {number}
 */
function rootNameToPC(rootName) {
  if (typeof rootName !== 'string') return -1;
  return NOTE_NAME_TO_PC[rootName] ?? NOTE_NAME_TO_PC[rootName.replace('♯', '#')] ?? -1;
}

/**
 * Convert dB to linear magnitude.
 * @param {number} db
 * @returns {number}
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Spectral flatness — geometric / arithmetic mean of linear FFT magnitudes.
 * 0.0 ≈ pure tone, 1.0 ≈ white noise.
 * Mirrors pitch-detection.js:88-100 so subsystems agree on the metric.
 * @param {Float32Array} magnitudes
 * @returns {number}
 */
function spectralFlatness(magnitudes) {
  const eps = 1e-10;
  let logSum = 0;
  let arithSum = 0;
  let n = 0;
  for (let i = 1; i < magnitudes.length; i++) {  // skip DC bin
    const m = magnitudes[i] + eps;
    logSum += Math.log(m);
    arithSum += m;
    n++;
  }
  if (n === 0 || arithSum <= 0) return 0;
  const geoMean = Math.exp(logSum / n);
  const arithMean = arithSum / n;
  return geoMean / arithMean;
}

/**
 * Find the dominant frequency (Hz) of an FFT magnitude buffer.
 * @param {Float32Array} magnitudes
 * @param {number} sampleRate
 * @param {number} fftSize
 * @returns {number} dominant frequency in Hz, or 0 if buffer is empty
 */
function dominantFrequency(magnitudes, sampleRate, fftSize) {
  let peakIdx = 0;
  let peakMag = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > peakMag) {
      peakMag = magnitudes[i];
      peakIdx = i;
    }
  }
  const binFreqStep = sampleRate / fftSize;
  return peakIdx * binFreqStep;
}

/**
 * Classify a frequency into low/mid/high bands.
 * @param {number} freqHz
 * @returns {'low'|'mid'|'high'}
 */
function classifyBand(freqHz) {
  if (freqHz < BAND_LOW_HZ) return 'low';
  if (freqHz < BAND_HIGH_HZ) return 'mid';
  return 'high';
}

/**
 * Frame RMS (root-mean-square) of linear FFT magnitudes.
 * Used as a transient-sharpness proxy via current/previous ratio.
 * @param {Float32Array} magnitudes
 * @returns {number}
 */
function frameRms(magnitudes) {
  let sumSq = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    sumSq += magnitudes[i] * magnitudes[i];
  }
  return Math.sqrt(sumSq / Math.max(1, magnitudes.length));
}

/**
 * Clamp x into [lo, hi].
 * @param {number} x
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

/* ────────────────────────────────────────────────────────────────── */
/*  Factory                                                            */
/* ────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} AudioInterpreterOptions
 * @property {import('tone').Analyser} analyser - Shared FFT analyser (e.g. KeyboardView.getAnalyser()).
 * @property {'interface'|'mic'} [sourceQuality='mic'] - Forwarded to onset / chord detectors.
 */

/**
 * @typedef {Object} AudioInterpreter
 * @property {() => void} start
 * @property {() => void} stop
 * @property {(analyser: import('tone').Analyser) => void} setAnalyser
 * @property {() => boolean} isRunning
 * @property {(on: boolean) => void} setDebug
 * @property {() => boolean} isDebug
 * @property {() => object} getState
 */

/**
 * Create an AudioInterpreter.
 *
 * Throws if `options.analyser` is missing — same convention as
 * onset-detection.js and chord-detection.js.
 *
 * @param {AudioInterpreterOptions} options
 * @returns {AudioInterpreter}
 */
export function createAudioInterpreter(options) {
  if (!options || !options.analyser) {
    throw new Error('audio-interpreter: analyser is required');
  }

  let analyser = options.analyser;
  const sourceQuality = options.sourceQuality ?? 'mic';

  /** @type {import('./onset-detection.js').OnsetDetector|null} */
  let onsetDetector = null;
  /** @type {import('./chord-detection.js').ChordDetector|null} */
  let chordDetector = null;
  /** Pitch detector instance from createPitchDetector(). @type {?{start, stop, setEngine}} */
  let pitchDetector = null;

  let running = false;
  let debugEnabled = false;

  /* ── Pitched-note tracker state (design doc §5) ───────────────── */
  // States: 'Silent' | 'Sustaining'.
  let pitchedState = 'Silent';
  let lockedPitch = null;        // MIDI int while Sustaining
  let lockedNoteId = null;       // string while Sustaining
  /** Pending onset awaiting deferred classification. */
  let pendingOnset = null;       // { timestamp, strength } | null
  /** Last confident pitch reading (for deferred classification + strength scoring). */
  let lastConfidentPitch = null; // { midi, confidence, timestamp } | null
  /** True when the most recent pitch-detection callback was confident. */
  let pitchCurrentlyConfident = false;
  /** setTimeout id for the release-debounce timer. */
  let releaseTimerId = null;
  /** setTimeout id for the deferred-classification timer. */
  let deferredClassifyTimerId = null;
  /** Monotonic counter for noteId. (Open Question 5 — simple integer counter.) */
  let nextNoteIdCounter = 1;

  /* ── Chord tracker state (design doc §7) ──────────────────────── */
  /** Ring buffer of recent onset timestamps (only what's needed for the gate). */
  let recentOnsetTimestamps = [];
  /** Last published chord, as `${root}-${quality}` for change-detect; null = "no harmony". */
  let lastPublishedChordKey = null;
  let silenceCounter = 0;
  let silenceWatcherId = null;

  /* ── Frame-level cached features (for percussive-strike scoring) ─ */
  let prevFrameRms = 0;

  /* ── Helpers ──────────────────────────────────────────────────── */

  function debugLog(...args) {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.log('[AudioInterpreter]', ...args);
    }
  }

  function nowMs() {
    return performance.now();
  }

  function nextNoteId() {
    return `audio-${nextNoteIdCounter++}`;
  }

  function publish(event) {
    const stream = (typeof window !== 'undefined') ? window.MusicalEventStream : null;
    if (!stream || typeof stream.publish !== 'function') return;
    try {
      stream.publish(event);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AudioInterpreter] publish failed:', e);
    }
  }

  /**
   * Read the analyser, return { dbValues, magnitudes, sampleRate, fftSize }.
   * Returns null when the analyser yields no data this frame.
   */
  function readAnalyserFrame() {
    const dbValues = analyser.getValue();
    if (!dbValues || dbValues.length === 0) return null;
    const fftData = dbValues[0] instanceof Float32Array ? dbValues[0] : dbValues;
    const magnitudes = new Float32Array(fftData.length);
    for (let i = 0; i < fftData.length; i++) {
      magnitudes[i] = dbToLinear(fftData[i]);
    }
    const sampleRate = analyser.context?.sampleRate ?? 48000;
    const fftSize = fftData.length * 2;
    return { fftData, magnitudes, sampleRate, fftSize };
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Pitched-note tracker (design doc §5)                          */
  /* ────────────────────────────────────────────────────────────── */

  /**
   * Publish a noteAttack for the current `pendingOnset` and `lastConfidentPitch`.
   * Caller has already checked that classification should proceed.
   * @param {number} pitchMidi
   * @param {{timestamp:number, strength:number}} onset
   * @param {number} confidence
   */
  function publishNoteAttack(pitchMidi, onset, confidence) {
    const noteId = nextNoteId();
    lockedPitch = pitchMidi;
    lockedNoteId = noteId;
    pitchedState = 'Sustaining';

    // v0 limitation (design doc §10): attackType is always 'transient' —
    // the emergent pathway (Silent→Sustaining without an onset) is
    // structurally reserved but not implemented.
    const event = {
      type: 'noteAttack',
      pitch: pitchMidi,
      velocity: clamp(onset.strength, 0, 1),
      timestamp: onset.timestamp,
      source: 'audio',
      noteId,
      attackType: 'transient',
      timbralClass: 'pitched',     // v0: always 'pitched' for noteAttack
      confidence,
    };
    debugLog('noteAttack', { pitch: pitchMidi, noteId, velocity: event.velocity.toFixed(3) });
    publish(event);
  }

  /**
   * Publish a noteRelease for the currently locked note, then transition to Silent.
   * Audio-derived noteRelease is v0 only via this state-machine path
   * (not Section 4's reserved future audio noteRelease detection — see §10).
   * @param {number} timestamp - performance.now() at release moment
   */
  function publishNoteReleaseAndGoSilent(timestamp) {
    if (pitchedState !== 'Sustaining') return;
    const event = {
      type: 'noteRelease',
      noteId: lockedNoteId,
      pitch: lockedPitch,
      timestamp,
      source: 'audio',
    };
    debugLog('noteRelease', { pitch: lockedPitch, noteId: lockedNoteId });
    publish(event);
    pitchedState = 'Silent';
    lockedPitch = null;
    lockedNoteId = null;
  }

  /**
   * Try to classify a pending onset using the most recent confident pitch reading.
   * Called from the deferred-classification timer (~40 ms after the onset)
   * and immediately on confident pitch updates (in case the reading lands first).
   *
   * Implements:
   *   • Silent → Sustaining (transient)         — design doc §5
   *   • Sustaining → Sustaining (note change)   — design doc §5
   *
   * NOT implemented in v0 (documented as v0 limitation):
   *   • Silent → Sustaining (emergent)          — design doc §5, §10
   *   • Sustaining → Sustaining (no onset)      — design doc §5, §10
   */
  function tryClassifyPendingOnset() {
    if (!pendingOnset) return;

    // Need a recent confident pitch within the proximity window.
    // The reading can be slightly older than the onset (pitch lock often
    // precedes attack) or slightly newer (attack precedes pitch settle).
    const now = nowMs();
    if (
      !lastConfidentPitch ||
      Math.abs(now - lastConfidentPitch.timestamp) > (DEFERRED_CLASSIFICATION_MS + PITCH_PROXIMITY_MS)
    ) {
      return; // not yet — let the timer fire again, or wait for a new pitch update
    }

    const newPitch = lastConfidentPitch.midi;
    const onset = pendingOnset;
    pendingOnset = null;
    if (deferredClassifyTimerId !== null) {
      clearTimeout(deferredClassifyTimerId);
      deferredClassifyTimerId = null;
    }

    if (pitchedState === 'Silent') {
      publishNoteAttack(newPitch, onset, lastConfidentPitch.confidence);
      return;
    }

    // Sustaining — decide whether this is a re-attack of the same note
    // or a transient note change.
    const cents = midiCentsApart(newPitch, lockedPitch);
    if (cents >= SAME_NOTE_THRESHOLD_CENTS) {
      // Note change with onset (atomic release+attack at the same frame).
      publishNoteReleaseAndGoSilent(onset.timestamp);
      publishNoteAttack(newPitch, onset, lastConfidentPitch.confidence);
    }
    // Else: same-note re-attack — already in Sustaining; pitched-note
    // tracker has nothing to publish. The percussive-strike publisher
    // will still emit for this onset, so consumers that want "every
    // attack" (Beat Field) are unaffected.
  }

  /**
   * Handle an incoming pitch-detection reading. Updates state and may
   * trigger immediate classification of a pending onset.
   * @param {{frequency:number, confidence:number}} reading
   */
  function onPitchReading(reading) {
    const t = nowMs();
    const confident = reading.frequency > 0 && reading.confidence >= PITCH_CONFIDENCE_THRESHOLD;
    pitchCurrentlyConfident = confident;

    if (confident) {
      const midi = frequencyToMidi(reading.frequency);
      lastConfidentPitch = { midi, confidence: reading.confidence, timestamp: t };

      // A confident reading cancels any pending release (debounce flicker).
      if (releaseTimerId !== null) {
        clearTimeout(releaseTimerId);
        releaseTimerId = null;
      }

      // If we have a pending onset, attempt classification right now —
      // the pitch reading may have arrived during the deferred window.
      if (pendingOnset) tryClassifyPendingOnset();
      return;
    }

    // Not confident (frequency=0 or below threshold).
    // v0 limitation (design doc §5, §10): if confidence drops while a note
    // is locked AND pitch-detection's reading drifts ≥ same-note threshold
    // *without* an onset, we keep the old note locked until release-debounce
    // fires (no emergent re-attack pathway in v0). In practice, the pitch
    // reading is just `frequency=0` once confidence drops, so there is
    // nothing meaningful to compare against.

    if (pitchedState === 'Sustaining' && releaseTimerId === null) {
      // Schedule release; sustained loss of confidence ⇒ note has ended.
      releaseTimerId = setTimeout(() => {
        releaseTimerId = null;
        // Re-check: the confidence may have come back in the meantime.
        if (pitchedState !== 'Sustaining') return;
        if (pitchCurrentlyConfident) return;
        publishNoteReleaseAndGoSilent(nowMs());
      }, RELEASE_DEBOUNCE_MS);
    }
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Chord tracker (design doc §7)                                 */
  /* ────────────────────────────────────────────────────────────── */

  /**
   * Returns true if any onset occurred within the last `windowMs`.
   * Side-effect: prunes the ring buffer.
   */
  function hasRecentOnset(windowMs) {
    const cutoff = nowMs() - windowMs;
    recentOnsetTimestamps = recentOnsetTimestamps.filter((t) => t >= cutoff);
    return recentOnsetTimestamps.length > 0;
  }

  /**
   * Time since the most recent onset, or +Infinity if none recorded.
   */
  function msSinceLastOnset() {
    if (recentOnsetTimestamps.length === 0) return Infinity;
    return nowMs() - recentOnsetTimestamps[recentOnsetTimestamps.length - 1];
  }

  /**
   * Handle a chord-detection callback. chord-detection.js emits ONLY on
   * chord change (chord-detection.js:412-413 — confirmed in audit), so
   * we don't need to dedupe; we apply the onset gate from §7.
   * @param {{root:string, quality:string, symbol:string, bass:string, confidence:number, pitchClasses:number[]}} chordEvent
   */
  function onChordDetected(chordEvent) {
    if (!chordEvent || typeof chordEvent.root !== 'string') return;

    // Onset gate: only publish if there's been an onset in the recent window
    // OR if the audio has been quiet (silence-watcher publishes its own
    // null-root chord change; we let that path run).
    if (!hasRecentOnset(ONSET_GATE_MS)) {
      // No onset gate satisfied. If it's been longer than the suppression
      // window since the last onset, treat as overtone drift and suppress.
      if (msSinceLastOnset() >= SUSTAINED_DRIFT_SUPPRESS_MS) {
        debugLog('chord suppressed (no recent onset, drift)', chordEvent.root, chordEvent.quality);
        return;
      }
      // Else (in the gap between gate and suppression): suppress anyway.
      // The next onset will republish via chord-detection's own change emit.
      debugLog('chord suppressed (gate window closed)', chordEvent.root, chordEvent.quality);
      return;
    }

    const rootPc = rootNameToPC(chordEvent.root);
    if (rootPc < 0) return;

    const chordKey = `${chordEvent.root}-${chordEvent.quality}`;
    if (chordKey === lastPublishedChordKey) return; // defensive — chord-detection should have already deduped
    lastPublishedChordKey = chordKey;
    silenceCounter = 0; // a publish counts as "audio is happening"

    const bassPc = chordEvent.bass ? rootNameToPC(chordEvent.bass) : null;

    // Velocity at change moment: most-recent onset strength is the best
    // available signal. Default to chord confidence if no onset is in
    // the buffer (defensive — gate already required one).
    const recentOnset = recentOnsetTimestamps.length > 0
      ? lastOnsetStrengthAt(recentOnsetTimestamps[recentOnsetTimestamps.length - 1])
      : null;
    const velocity = recentOnset != null ? recentOnset : chordEvent.confidence;

    const event = {
      type: 'chordChange',
      root: rootPc,
      quality: chordEvent.quality,
      pitchClasses: Array.isArray(chordEvent.pitchClasses) ? chordEvent.pitchClasses.slice() : [],
      bass: bassPc !== null && bassPc >= 0 ? bassPc : null,
      confidence: clamp(chordEvent.confidence, 0, 1),
      // v0: chord-detection emits a single best-fit; alternatives is
      // schema-reserved but always [] until chord-detection is enriched.
      alternatives: [],
      velocity: clamp(velocity, 0, 1),
      timestamp: nowMs(),
      source: 'audio',
    };
    debugLog('chordChange publish', chordEvent.root, chordEvent.quality);
    publish(event);
  }

  /** Onset-strength lookup for a recorded timestamp. We keep a side map. */
  const onsetStrengthByTimestamp = new Map();
  function lastOnsetStrengthAt(t) {
    return onsetStrengthByTimestamp.get(t) ?? null;
  }

  /**
   * Silence watcher (design doc §7; replicates cantor.html:543-563).
   * Polls the analyser every 100 ms; after 5 quiet samples (~500 ms),
   * publishes `chordChange { root: null }` so consumers can release
   * stuck highlights.
   */
  function startSilenceWatcher() {
    if (silenceWatcherId !== null) return;
    silenceCounter = 0;
    silenceWatcherId = setInterval(() => {
      const data = analyser.getValue();
      if (!data) return;
      const arr = data[0] instanceof Float32Array ? data[0] : data;
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > SILENCE_DB_FLOOR) sum += dbToLinear(arr[i]);
      }
      if (sum < SILENCE_LINEAR_THRESHOLD) silenceCounter++;
      else silenceCounter = 0;

      if (silenceCounter >= SILENCE_QUIET_SAMPLES && lastPublishedChordKey !== null) {
        lastPublishedChordKey = null;
        const event = {
          type: 'chordChange',
          root: null,
          quality: null,
          pitchClasses: [],
          bass: null,
          confidence: 0,
          alternatives: [],
          velocity: 0,
          timestamp: nowMs(),
          source: 'audio',
        };
        debugLog('chordChange publish (silence — no harmony)');
        publish(event);
      }
    }, SILENCE_POLL_MS);
  }

  function stopSilenceWatcher() {
    if (silenceWatcherId !== null) {
      clearInterval(silenceWatcherId);
      silenceWatcherId = null;
    }
    silenceCounter = 0;
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Percussive-strike publisher (design doc §6)                   */
  /* ────────────────────────────────────────────────────────────── */

  /**
   * Compute a 0–1 strength score from current spectral features.
   * Design doc §6 calls this calibration-driven; weights are named at
   * the top of this module so they're easy to tune.
   *
   *   strength = clamp(
   *     0.4 · (1 − pitchConfidence)
   *   + 0.4 · spectralFlatness
   *   + 0.2 · transientSharpness, 0, 1)
   *
   * @param {Float32Array} magnitudes - linear FFT magnitudes
   * @returns {{strength:number, flatness:number, pitchedness:number, transientSharpness:number, currentRms:number}}
   */
  function computeStrengthFeatures(magnitudes) {
    const flatness = clamp(spectralFlatness(magnitudes), 0, 1);

    // Pitched-ness: 1 − recent pitch confidence. If pitch-detection has
    // not produced a recent confident reading, treat as fully unpitched.
    let pitchConfidence = 0;
    if (lastConfidentPitch &&
        (nowMs() - lastConfidentPitch.timestamp) <= PITCH_RECENCY_FOR_STRENGTH_MS) {
      pitchConfidence = lastConfidentPitch.confidence;
    }
    const pitchedness = clamp(1 - pitchConfidence, 0, 1);

    // Transient sharpness: current/previous frame RMS ratio, clamped.
    // Design doc §6 calls this a "starting" proxy; expected to iterate.
    const currentRms = frameRms(magnitudes);
    const ratio = prevFrameRms > 1e-6 ? currentRms / prevFrameRms : 1;
    // Map ratio ∈ [1, 4]+ to a 0–1 sharpness; ratio ≤ 1 ⇒ no transient.
    const transientSharpness = clamp((ratio - 1) / 3, 0, 1);

    const strength = clamp(
      STRENGTH_WEIGHT_PITCHEDNESS * pitchedness
      + STRENGTH_WEIGHT_FLATNESS    * flatness
      + STRENGTH_WEIGHT_TRANSIENT   * transientSharpness,
      0, 1,
    );

    return { strength, flatness, pitchedness, transientSharpness, currentRms };
  }

  /**
   * Handle every onset: feed all three subsystems.
   * @param {{timestamp:number, strength:number}} onsetEvent
   */
  function onOnset(onsetEvent) {
    // 1. Record for chord tracker's gate.
    recentOnsetTimestamps.push(onsetEvent.timestamp);
    onsetStrengthByTimestamp.set(onsetEvent.timestamp, onsetEvent.strength);
    // Prune everything older than the suppression window — keeps both
    // the timestamps array and the side map bounded.
    {
      const cutoff = nowMs() - SUSTAINED_DRIFT_SUPPRESS_MS;
      while (recentOnsetTimestamps.length > 0 && recentOnsetTimestamps[0] < cutoff) {
        const dropped = recentOnsetTimestamps.shift();
        onsetStrengthByTimestamp.delete(dropped);
      }
    }

    // 2. Pitched-note tracker — start the deferred classification dance.
    pendingOnset = onsetEvent;
    if (deferredClassifyTimerId !== null) clearTimeout(deferredClassifyTimerId);
    deferredClassifyTimerId = setTimeout(() => {
      deferredClassifyTimerId = null;
      tryClassifyPendingOnset();
      // If still pending after the timer (no confident pitch arrived), drop it.
      pendingOnset = null;
    }, DEFERRED_CLASSIFICATION_MS);
    // Fast-path: if pitch is already confident, classify immediately.
    if (lastConfidentPitch &&
        (nowMs() - lastConfidentPitch.timestamp) <= PITCH_PROXIMITY_MS) {
      tryClassifyPendingOnset();
    }

    // 3. Percussive-strike publisher — stateless, fires every onset.
    const frame = readAnalyserFrame();
    if (frame) {
      const feats = computeStrengthFeatures(frame.magnitudes);
      const domHz = dominantFrequency(frame.magnitudes, frame.sampleRate, frame.fftSize);
      const band = classifyBand(domHz);

      // Concurrent pitch (if a confident reading is recent enough).
      let pitchMidi = null;
      if (lastConfidentPitch &&
          (nowMs() - lastConfidentPitch.timestamp) <= PITCH_RECENCY_FOR_STRENGTH_MS) {
        pitchMidi = lastConfidentPitch.midi;
      }

      const event = {
        type: 'percussiveStrike',
        strength: feats.strength,
        band,
        pitch: pitchMidi,
        spectralFeatures: {
          flatness: feats.flatness,
          pitchedness: feats.pitchedness,
          transientSharpness: feats.transientSharpness,
          dominantHz: domHz,
          rms: feats.currentRms,
        },
        timestamp: onsetEvent.timestamp,
        source: 'audio',
      };
      publish(event);

      prevFrameRms = feats.currentRms;
    }
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Lifecycle                                                     */
  /* ────────────────────────────────────────────────────────────── */

  function startSubsystems() {
    // Onset detector — feeds all three subsystems.
    onsetDetector = createOnsetDetector({ analyser });
    if (typeof onsetDetector.setSensitivity === 'function') {
      onsetDetector.setSensitivity(sourceQuality);
    }
    onsetDetector.start(onOnset);

    // Chord detector — emits only on chord change; chord tracker applies
    // the onset gate before publishing.
    chordDetector = createChordDetector({ analyser, sourceQuality });
    chordDetector.start(onChordDetected);

    // Pitch detector — uses AudioInput's existing MediaStream when one is
    // available so we don't double-acquire the mic. Falls back to its own
    // getUserMedia if no stream is published (e.g. analyser-only flow).
    const stream = (typeof window !== 'undefined' &&
                    window.AudioInput && typeof window.AudioInput.getStream === 'function')
      ? window.AudioInput.getStream()
      : null;

    try {
      pitchDetector = createPitchDetector({
        engine: 'yin',
        confidenceThreshold: PITCH_CONFIDENCE_THRESHOLD,
        ...(stream ? { stream } : {}),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AudioInterpreter] pitch-detection create failed:', e);
      pitchDetector = null;
    }

    if (pitchDetector) {
      // start() is async — fire-and-forget, mirroring harmonograph's pattern.
      pitchDetector.start(onPitchReading).catch?.((e) => {
        // eslint-disable-next-line no-console
        console.warn('[AudioInterpreter] pitch-detection start failed:', e);
        pitchDetector = null;
      });
    }

    startSilenceWatcher();
    debugLog('started');
  }

  function stopSubsystems() {
    if (onsetDetector) {
      try { onsetDetector.stop(); } catch (_) { /* ok */ }
      onsetDetector = null;
    }
    if (chordDetector) {
      try { chordDetector.stop(); } catch (_) { /* ok */ }
      chordDetector = null;
    }
    if (pitchDetector) {
      try { pitchDetector.stop(); } catch (_) { /* ok */ }
      pitchDetector = null;
    }

    stopSilenceWatcher();

    // Reset transient state — leaves no in-flight timers / pending events.
    if (releaseTimerId !== null) { clearTimeout(releaseTimerId); releaseTimerId = null; }
    if (deferredClassifyTimerId !== null) { clearTimeout(deferredClassifyTimerId); deferredClassifyTimerId = null; }

    pitchedState = 'Silent';
    lockedPitch = null;
    lockedNoteId = null;
    pendingOnset = null;
    lastConfidentPitch = null;
    pitchCurrentlyConfident = false;
    recentOnsetTimestamps = [];
    onsetStrengthByTimestamp.clear();
    lastPublishedChordKey = null;
    silenceCounter = 0;
    prevFrameRms = 0;

    debugLog('stopped');
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Public API                                                    */
  /* ────────────────────────────────────────────────────────────── */

  const api = {
    /** Start all three subsystems. Idempotent on a running interpreter. */
    start() {
      if (running) return;
      running = true;
      startSubsystems();
    },

    /** Stop all three subsystems. Idempotent on a stopped interpreter. */
    stop() {
      if (!running) return;
      running = false;
      stopSubsystems();
    },

    /**
     * Hot-swap the analyser. Implementation choice: stop & restart
     * internally so detectors are rebuilt against the new analyser.
     * Cleaner than requiring callers to stop() first and serialises
     * teardown/setup in one call.
     */
    setAnalyser(newAnalyser) {
      if (!newAnalyser) {
        throw new Error('audio-interpreter: setAnalyser requires an analyser');
      }
      const wasRunning = running;
      if (wasRunning) stopSubsystems();
      analyser = newAnalyser;
      if (wasRunning) startSubsystems();
    },

    isRunning() {
      return running;
    },

    setDebug(on) {
      debugEnabled = !!on;
    },

    isDebug() {
      return debugEnabled;
    },

    /**
     * Inspection snapshot for debugging consoles (Open Question 4).
     * Not part of any consumer contract — fields may change.
     */
    getState() {
      return {
        running,
        pitchedState,
        lockedPitch,
        lockedNoteId,
        pendingOnset: pendingOnset ? { ...pendingOnset } : null,
        lastConfidentPitch: lastConfidentPitch ? { ...lastConfidentPitch } : null,
        pitchCurrentlyConfident,
        recentOnsetCount: recentOnsetTimestamps.length,
        lastPublishedChordKey,
        silenceCounter,
      };
    },
  };

  // Expose the latest constructed interpreter on window for console
  // inspection. Multiple instances overwrite — there's no known use
  // case for two AudioInterpreters on the same page in v0.
  if (typeof window !== 'undefined') {
    window.__audioInterpreter = api;
  }

  return api;
}

export default createAudioInterpreter;
