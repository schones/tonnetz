/**
 * pitch-detection.js
 * ==================
 * Client-side monophonic pitch detector using YIN algorithm.
 * Strategy pattern supports future CREPE upgrade (Pro tier).
 *
 * Usage:
 *   import { createPitchDetector } from '/static/shared/pitch-detection.js';
 *
 *   const detector = createPitchDetector({
 *     engine: 'yin',             // 'yin' (default/free) | 'crepe' (future pro)
 *     sampleRate: 44100,
 *     bufferSize: 2048,          // samples per analysis frame
 *     graceWindow: 15,           // cents — pedagogical "close enough" threshold
 *     confidenceThreshold: 0.8,  // below this → frequency: 0
 *   });
 *
 *   detector.start(({ frequency, note, octave, cents, confidence, fullName }) => {
 *     // frequency: Hz (0 if silence/no pitch)
 *     // note: 'C', 'F#', etc.
 *     // octave: integer
 *     // cents: deviation from nearest ET pitch (snapped to 0 within graceWindow)
 *     // confidence: 0–1
 *     // fullName: 'C4', 'F#3', etc.
 *   });
 *
 *   detector.stop();
 *
 * Works standalone (creates own AudioContext + getUserMedia stream) OR
 * accepts an external MediaStream via options.stream (for when audio-input.js
 * is managing the device).
 *
 * @module pitch-detection
 */

import { frequencyToNote } from './audio.js';

/* ────────────────────────────────────────────────────────────────── */
/*  Constants                                                        */
/* ────────────────────────────────────────────────────────────────── */

const A4_FREQ = 440;
const A4_MIDI = 69;

/** Lowest detectable pitch — ~B1 */
const MIN_FREQUENCY = 60;
/** Highest detectable pitch — ~C#6 */
const MAX_FREQUENCY = 1100;

/** YIN cumulative mean normalized difference threshold (standard: 0.1) */
const YIN_THRESHOLD = 0.1;

/* ────────────────────────────────────────────────────────────────── */
/*  YIN Algorithm                                                    */
/* ────────────────────────────────────────────────────────────────── */

/**
 * YIN pitch detection algorithm (de Cheveigné & Kawahara, 2002).
 *
 * Steps:
 *   1. Compute difference function d(tau) for each lag tau
 *   2. Compute cumulative mean normalized difference d'(tau)
 *   3. Find first tau where d'(tau) < threshold (absolute threshold)
 *   4. Parabolic interpolation around the minimum for sub-sample accuracy
 *   5. Convert lag to frequency: sampleRate / tau
 *   6. Confidence = 1 - d'(tau_best)
 *
 * @param {Float32Array} buffer - Audio samples
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {{ frequency: number, confidence: number }}
 */
function yinDetect(buffer, sampleRate) {
  const halfLen = Math.floor(buffer.length / 2);

  // Constrain lag search range by frequency bounds
  const minTau = Math.max(2, Math.ceil(sampleRate / MAX_FREQUENCY));
  const maxTau = Math.min(halfLen - 1, Math.floor(sampleRate / MIN_FREQUENCY));

  // Step 1: Difference function d(tau)
  const d = new Float32Array(halfLen);
  for (let tau = 1; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const diff = buffer[i] - buffer[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference d'(tau)
  const dPrime = new Float32Array(halfLen);
  dPrime[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += d[tau];
    dPrime[tau] = runningSum === 0 ? 1 : (d[tau] * tau) / runningSum;
  }

  // Step 3: Absolute threshold — find first tau below threshold,
  // then walk to the local minimum
  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (dPrime[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= maxTau && dPrime[tau + 1] < dPrime[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    return { frequency: 0, confidence: 0 };
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  let betterTau = tauEstimate;
  if (tauEstimate > 0 && tauEstimate < halfLen - 1) {
    const s0 = dPrime[tauEstimate - 1];
    const s1 = dPrime[tauEstimate];
    const s2 = dPrime[tauEstimate + 1];
    const denom = 2 * s1 - s2 - s0;
    if (denom !== 0) {
      const adjustment = (s2 - s0) / (2 * denom);
      if (isFinite(adjustment)) {
        betterTau = tauEstimate + adjustment;
      }
    }
  }

  // Step 5: Convert lag to frequency
  const frequency = sampleRate / betterTau;

  // Step 6: Confidence = 1 - d'(tau_best)
  const confidence = Math.max(0, Math.min(1, 1 - dPrime[tauEstimate]));

  return { frequency, confidence };
}

/* ────────────────────────────────────────────────────────────────── */
/*  Pitch Detector Factory                                           */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Create a pitch detector instance.
 *
 * @param {object} [options]
 * @param {'yin'|'crepe'} [options.engine='yin'] - Detection engine
 * @param {number} [options.sampleRate=44100] - Sample rate in Hz
 * @param {number} [options.bufferSize=2048] - Samples per analysis frame
 * @param {number} [options.graceWindow=15] - Cents within which to snap to 0
 * @param {number} [options.confidenceThreshold=0.8] - Below this → frequency: 0
 * @param {MediaStream} [options.stream] - External stream (skips getUserMedia)
 * @returns {{ start: function, stop: function, setEngine: function }}
 */
export function createPitchDetector(options = {}) {
  const {
    engine: initialEngine = 'yin',
    sampleRate = 44100,
    bufferSize = 2048,
    graceWindow = 15,
    confidenceThreshold = 0.8,
    stream: externalStream = null,
  } = options;

  let currentEngine = initialEngine;

  if (currentEngine === 'crepe') {
    throw new Error('CREPE engine not yet available — planned for Pro tier.');
  }
  if (currentEngine !== 'yin') {
    throw new Error(`Unknown pitch detection engine: "${currentEngine}"`);
  }

  // Internal state
  let audioContext = null;
  let sourceNode = null;
  let processorNode = null;
  let micStream = null;
  let running = false;
  let ownsStream = false; // true if we called getUserMedia (so we release it on stop)

  /**
   * Compute raw cents deviation from nearest equal-temperament pitch.
   *
   * @param {number} frequency - Frequency in Hz
   * @returns {number} Cents deviation (positive = sharp, negative = flat)
   */
  function computeCents(frequency) {
    const midiFloat = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
    const midi = Math.round(midiFloat);
    return Math.round((midiFloat - midi) * 100);
  }

  /** No-pitch result constant */
  const NO_PITCH = {
    frequency: 0,
    note: '',
    octave: 0,
    cents: 0,
    confidence: 0,
    fullName: '',
  };

  /**
   * Start pitch detection. Requests mic permission (unless an external
   * stream was provided), creates a ScriptProcessorNode, and runs YIN
   * on each audio buffer.
   *
   * @param {function} callback - Receives { frequency, note, octave, cents, confidence, fullName }
   * @returns {Promise<void>}
   */
  async function start(callback) {
    if (running) return;

    // Acquire audio stream
    if (externalStream) {
      micStream = externalStream;
      ownsStream = false;
    } else {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      ownsStream = true;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate,
    });
    sourceNode = audioContext.createMediaStreamSource(micStream);

    // ScriptProcessorNode for per-buffer processing
    // (AudioWorklet upgrade deferred — see audio-architecture.md Open Question 1)
    processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

    processorNode.onaudioprocess = (e) => {
      if (!running) return;

      const buffer = e.inputBuffer.getChannelData(0);

      // Quick silence check — skip YIN on quiet input
      let energy = 0;
      for (let i = 0; i < buffer.length; i++) {
        energy += buffer[i] * buffer[i];
      }
      if (energy / buffer.length < 0.0001) {
        callback(NO_PITCH);
        return;
      }

      // Run YIN
      const result = yinDetect(buffer, audioContext.sampleRate);

      // Below confidence threshold → "didn't hear clearly"
      if (result.confidence < confidenceThreshold || result.frequency <= 0) {
        callback({
          frequency: 0,
          note: '',
          octave: 0,
          cents: 0,
          confidence: result.confidence,
          fullName: '',
        });
        return;
      }

      // Convert frequency to note info via audio.js
      const noteInfo = frequencyToNote(result.frequency);
      if (!noteInfo) {
        callback(NO_PITCH);
        return;
      }

      // Apply detector's grace window to raw cents
      let cents = computeCents(result.frequency);
      if (Math.abs(cents) <= graceWindow) {
        cents = 0;
      }

      callback({
        frequency: result.frequency,
        note: noteInfo.noteName,
        octave: noteInfo.octave,
        cents,
        confidence: result.confidence,
        fullName: noteInfo.fullName,
      });
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);
    running = true;
  }

  /**
   * Stop pitch detection and release resources.
   * Releases the mic stream only if it was acquired internally
   * (not if an external stream was provided via options.stream).
   */
  function stop() {
    running = false;

    if (processorNode) {
      processorNode.onaudioprocess = null;
      try {
        processorNode.disconnect();
      } catch (_) {
        /* already disconnected */
      }
      processorNode = null;
    }

    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (_) {
        /* already disconnected */
      }
      sourceNode = null;
    }

    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }

    // Only release the stream if we own it
    if (ownsStream && micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }
    micStream = null;
  }

  /**
   * Swap the detection engine at runtime.
   * Currently only 'yin' is supported. Selecting 'crepe' throws —
   * this is the upgrade hook for Pro tier (Phase E).
   *
   * @param {string} engineName - 'yin' or 'crepe'
   */
  function setEngine(engineName) {
    if (engineName === 'crepe') {
      throw new Error('CREPE engine not yet available — planned for Pro tier.');
    }
    if (engineName !== 'yin') {
      throw new Error(`Unknown pitch detection engine: "${engineName}"`);
    }
    currentEngine = engineName;
  }

  return { start, stop, setEngine };
}
