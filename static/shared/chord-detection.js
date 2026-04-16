/**
 * chord-detection.js — Polyphonic chord detector
 *
 * Detects chords from polyphonic audio using chroma-vector template matching.
 * Client-side port of chord_detector.py. Reads FFT data from an existing
 * Tone.Analyser instance, builds a 12-bin chroma vector, and correlates
 * against chord templates to identify the best-fit chord.
 *
 * @module chord-detection
 */

import { resolveChord } from './chord-resolver.js';

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChordEvent
 * @property {string}   root         - Note name ('C', 'F#', etc.)
 * @property {string}   quality      - 'major'|'minor'|'dom7'|'maj7'|'min7'|'dim'|'aug'|'sus2'|'sus4'|'m7b5'
 * @property {string}   symbol       - Formatted display string ('Cmaj7', 'F#m', 'Bdim')
 * @property {string}   bass         - Detected bass note name
 * @property {number}   confidence   - 0–1 template correlation strength
 * @property {number[]} pitchClasses - Detected chroma peaks as pitch class integers 0–11
 */

/**
 * @typedef {Object} ChordDetector
 * @property {(onChord: (event: ChordEvent) => void) => void} start
 * @property {() => void} stop
 * @property {(key: string|null) => void} setKeyContext
 */

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Key name → pitch class index */
const KEY_TO_PC = {};
NOTE_NAMES.forEach((n, i) => { KEY_TO_PC[n] = i; });
// Flat aliases
KEY_TO_PC['Db'] = 1;  KEY_TO_PC['Eb'] = 3;  KEY_TO_PC['Gb'] = 6;
KEY_TO_PC['Ab'] = 8;  KEY_TO_PC['Bb'] = 10;

/**
 * Chord templates as 12-element binary vectors.
 * Index 0 = root. Rotate to test each of the 12 possible roots.
 */
const CHORD_TEMPLATES = {
  major: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  minor: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  dim:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  aug:   [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  dom7:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  maj7:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  min7:  [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  sus2:  [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  sus4:  [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
  m7b5:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
};

/** Quality key → display suffix */
const QUALITY_SYMBOLS = {
  major: '',
  minor: 'm',
  dim:   'dim',
  aug:   'aug',
  dom7:  '7',
  maj7:  'maj7',
  min7:  'm7',
  sus2:  'sus2',
  sus4:  'sus4',
  m7b5:  'm7b5',
};

/** Source quality presets */
const SOURCE_PRESETS = {
  interface: { minConfidence: 0.6, sustainFrames: 2 },
  mic:       { minConfidence: 0.4, sustainFrames: 4 },
};

/** Debounce window — suppress duplicate emissions within this period */
const DEBOUNCE_MS = 100;

/** Minimum total chroma energy to consider the frame worth analyzing */
const ENERGY_FLOOR = 0.01;

/** A4 reference frequency for MIDI/pitch-class calculations */
const A4_FREQ = 440;

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Convert a dB value to linear magnitude.
 * @param {number} db
 * @returns {number}
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Map a frequency (Hz) to a pitch class 0–11.
 * Returns -1 for frequencies below ~16 Hz (not musically meaningful).
 * @param {number} freq
 * @returns {number}
 */
function freqToPitchClass(freq) {
  if (freq <= 0) return -1;
  const midi = 12 * Math.log2(freq / A4_FREQ) + 69;
  return ((Math.round(midi) % 12) + 12) % 12;
}

/**
 * Build a 12-bin chroma vector from FFT magnitude data.
 * @param {Float32Array} magnitudes - Linear magnitude per FFT bin
 * @param {number} sampleRate
 * @param {number} fftSize
 * @returns {Float32Array} 12-bin chroma vector
 */
function buildChromaVector(magnitudes, sampleRate, fftSize) {
  const chroma = new Float32Array(12);
  const binFreqStep = sampleRate / fftSize;

  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binFreqStep;
    if (freq < 60 || freq > 5000) continue;  // musical range
    const pc = freqToPitchClass(freq);
    if (pc >= 0) {
      chroma[pc] += magnitudes[i];
    }
  }

  return chroma;
}

/**
 * Normalize a chroma vector by its maximum value.
 * @param {Float32Array} chroma
 * @returns {Float32Array} Normalized copy
 */
function normalizeChroma(chroma) {
  const out = new Float32Array(chroma);
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (out[i] > max) max = out[i];
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) {
      out[i] /= max;
    }
  }
  return out;
}

/**
 * Rotate a 12-element template array by `shift` positions.
 * @param {number[]} template
 * @param {number} shift
 * @returns {number[]}
 */
function rotateTemplate(template, shift) {
  const len = template.length;
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = template[((i - shift) % len + len) % len];
  }
  return out;
}

/**
 * Compute dot-product correlation between a chroma vector and a template.
 * @param {Float32Array} chroma
 * @param {number[]} template - Rotated 12-bin template
 * @returns {number}
 */
function correlate(chroma, template) {
  let dot = 0;
  let normC = 0;
  let normT = 0;
  for (let i = 0; i < 12; i++) {
    dot += chroma[i] * template[i];
    normC += chroma[i] * chroma[i];
    normT += template[i] * template[i];
  }
  const denom = Math.sqrt(normC) * Math.sqrt(normT);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Detect the bass note from the low-frequency band (60–270 Hz).
 * @param {Float32Array} magnitudes - Linear magnitude per FFT bin
 * @param {number} sampleRate
 * @param {number} fftSize
 * @returns {{ pc: number, strength: number } | null}
 */
function detectBass(magnitudes, sampleRate, fftSize) {
  const binFreqStep = sampleRate / fftSize;
  const loIdx = Math.ceil(60 / binFreqStep);
  const hiIdx = Math.floor(270 / binFreqStep);

  if (loIdx >= hiIdx || hiIdx >= magnitudes.length) return null;

  let peakMag = 0;
  let peakIdx = loIdx;
  let globalMax = 0;

  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > globalMax) globalMax = magnitudes[i];
  }

  for (let i = loIdx; i <= hiIdx; i++) {
    if (magnitudes[i] > peakMag) {
      peakMag = magnitudes[i];
      peakIdx = i;
    }
  }

  // Bass must be at least 5% of global peak to matter
  if (globalMax <= 0 || peakMag < globalMax * 0.05) return null;

  const freq = peakIdx * binFreqStep;
  const pc = freqToPitchClass(freq);
  return { pc, strength: peakMag / globalMax };
}

/**
 * Extract pitch classes with significant energy from a chroma vector.
 * Returns sorted array of pitch class integers where chroma exceeds threshold.
 * @param {Float32Array} chroma - Normalized chroma vector
 * @param {number} [threshold=0.3]
 * @returns {number[]}
 */
function extractPitchClasses(chroma, threshold = 0.3) {
  const pcs = [];
  for (let i = 0; i < 12; i++) {
    if (chroma[i] >= threshold) pcs.push(i);
  }
  return pcs.sort((a, b) => a - b);
}

/**
 * Get diatonic pitch classes for a major key.
 * @param {number} rootPC - Pitch class of the key root
 * @returns {Set<number>}
 */
function diatonicPCs(rootPC) {
  const intervals = [0, 2, 4, 5, 7, 9, 11];
  return new Set(intervals.map(i => (rootPC + i) % 12));
}

// ════════════════════════════════════════════════════════════════════
// DETECTOR
// ════════════════════════════════════════════════════════════════════

/**
 * Create a polyphonic chord detector.
 *
 * @param {Object} options
 * @param {import('tone').Analyser} options.analyser - Tone.Analyser instance (FFT mode, dB values)
 * @param {'interface'|'mic'} [options.sourceQuality='mic'] - Source quality tier
 * @param {string|null} [options.keyContext=null] - Key name for diatonic preference (e.g. 'C', 'Bb')
 * @param {number} [options.minConfidence=0.6] - Override minimum confidence threshold
 * @returns {ChordDetector}
 */
export function create(options) {
  const { analyser } = options;
  if (!analyser) {
    throw new Error('chord-detection: analyser is required');
  }

  const sourceQuality = options.sourceQuality ?? 'mic';
  const preset = SOURCE_PRESETS[sourceQuality] ?? SOURCE_PRESETS.mic;
  let minConfidence = options.minConfidence ?? preset.minConfidence;
  let sustainRequired = preset.sustainFrames;
  let keyContext = options.keyContext ?? null;
  let keyPC = keyContext != null ? (KEY_TO_PC[keyContext] ?? null) : null;

  let rafId = null;
  let callback = null;
  let lastChordKey = null;
  let lastEmitTime = 0;
  let sustainCount = 0;
  let pendingChordKey = null;

  /**
   * Analyse one frame: extract chroma, match templates, emit if changed.
   */
  function analyseFrame() {
    rafId = requestAnimationFrame(analyseFrame);

    const dbValues = analyser.getValue();
    if (!dbValues || dbValues.length === 0) return;

    // Tone.Analyser can return nested arrays; handle both shapes
    const fftData = dbValues[0] instanceof Float32Array ? dbValues[0] : dbValues;
    const fftSize = fftData.length * 2;  // Tone.Analyser returns fftSize/2 bins
    const sampleRate = 44100;  // Tone.js default context sample rate

    // ── Step 1: Convert dB → linear magnitude ───────────────────
    const magnitudes = new Float32Array(fftData.length);
    for (let i = 0; i < fftData.length; i++) {
      magnitudes[i] = dbToLinear(fftData[i]);
    }

    // ── Step 2: Build & normalize chroma vector ─────────────────
    const rawChroma = buildChromaVector(magnitudes, sampleRate, fftSize);

    // Check minimum energy — skip silent/noise frames
    let totalEnergy = 0;
    for (let i = 0; i < 12; i++) totalEnergy += rawChroma[i];
    if (totalEnergy < ENERGY_FLOOR) return;

    // ── Step 3: Bass detection & emphasis ────────────────────────
    const bass = detectBass(magnitudes, sampleRate, fftSize);
    if (bass) {
      rawChroma[bass.pc] += 0.3 * bass.strength * (totalEnergy / 12);
    }

    const chroma = normalizeChroma(rawChroma);

    // ── Step 4: Template matching — 12 roots × 10 qualities ─────
    let bestScore = -Infinity;
    let bestRoot = 0;
    let bestQuality = 'major';

    const qualityNames = Object.keys(CHORD_TEMPLATES);

    for (let rootIdx = 0; rootIdx < 12; rootIdx++) {
      for (const quality of qualityNames) {
        const rotated = rotateTemplate(CHORD_TEMPLATES[quality], rootIdx);
        const score = correlate(chroma, rotated);

        if (score > bestScore) {
          bestScore = score;
          bestRoot = rootIdx;
          bestQuality = quality;
        }
      }
    }

    // ── Step 5: Key-context disambiguation ───────────────────────
    if (keyPC != null && (bestQuality === 'aug' || bestQuality === 'dim')) {
      const diatonic = diatonicPCs(keyPC);
      // Re-scan for the best diatonic interpretation
      let bestDiaScore = -Infinity;
      let bestDiaRoot = bestRoot;
      let bestDiaQuality = bestQuality;

      for (let rootIdx = 0; rootIdx < 12; rootIdx++) {
        if (!diatonic.has(rootIdx)) continue;
        for (const quality of qualityNames) {
          const rotated = rotateTemplate(CHORD_TEMPLATES[quality], rootIdx);
          const score = correlate(chroma, rotated);
          if (score > bestDiaScore) {
            bestDiaScore = score;
            bestDiaRoot = rootIdx;
            bestDiaQuality = quality;
          }
        }
      }

      // Use diatonic interpretation if it's within 10% of the absolute best
      if (bestDiaScore >= bestScore * 0.90) {
        bestRoot = bestDiaRoot;
        bestQuality = bestDiaQuality;
        bestScore = bestDiaScore;
      }
    }

    // ── Step 6: Confidence gate ──────────────────────────────────
    if (bestScore < minConfidence) return;

    // ── Step 7: Extract pitch classes for callback ───────────────
    const pitchClasses = extractPitchClasses(chroma);

    // Use chord-resolver for key-aware symbol resolution if available
    let rootName = NOTE_NAMES[bestRoot];
    let symbol = rootName + QUALITY_SYMBOLS[bestQuality];

    if (keyPC != null && pitchClasses.length >= 2) {
      const resolved = resolveChord(pitchClasses, keyPC);
      if (resolved && resolved.recognized) {
        rootName = resolved.root;
        bestQuality = resolved.quality;
        symbol = resolved.name;
      }
    }

    const bassName = bass ? NOTE_NAMES[bass.pc] : rootName;

    // ── Step 8: Debounce & sustain gate ──────────────────────────
    const chordKey = `${rootName}-${bestQuality}`;
    const now = performance.now();

    if (chordKey === pendingChordKey) {
      sustainCount++;
    } else {
      pendingChordKey = chordKey;
      sustainCount = 1;
    }

    if (sustainCount < sustainRequired) return;

    if (chordKey === lastChordKey && (now - lastEmitTime) < DEBOUNCE_MS) return;

    // Only emit on chord change
    if (chordKey === lastChordKey) return;

    lastChordKey = chordKey;
    lastEmitTime = now;

    if (callback) {
      callback({
        root: rootName,
        quality: bestQuality,
        symbol,
        bass: bassName,
        confidence: Math.min(bestScore, 1),
        pitchClasses,
      });
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    /**
     * Begin monitoring audio for chords.
     * @param {(event: ChordEvent) => void} onChord
     */
    start(onChord) {
      if (rafId != null) this.stop();
      callback = onChord;
      lastChordKey = null;
      lastEmitTime = 0;
      sustainCount = 0;
      pendingChordKey = null;
      rafId = requestAnimationFrame(analyseFrame);
    },

    /** Stop monitoring. */
    stop() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      callback = null;
    },

    /**
     * Update key context for diatonic preference in ambiguous resolution.
     * @param {string|null} key - Key name ('C', 'Bb', etc.) or null to clear
     */
    setKeyContext(key) {
      keyContext = key;
      keyPC = key != null ? (KEY_TO_PC[key] ?? null) : null;
    },
  };
}
