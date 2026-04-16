/**
 * onset-detection.js — Spectral flux onset detector
 *
 * Detects audio onsets (taps, claps, plucks, vocal attacks) by comparing
 * consecutive FFT magnitude frames from an existing Tone.Analyser instance.
 *
 * @module onset-detection
 */

/**
 * @typedef {Object} OnsetEvent
 * @property {number} timestamp - performance.now() of detected onset
 * @property {number} strength  - 0–1 normalized energy spike
 */

/**
 * @typedef {Object} OnsetDetector
 * @property {(onOnset: (event: OnsetEvent) => void) => void} start
 * @property {() => void} stop
 * @property {(value: number) => void} setThreshold
 * @property {(sourceQuality: 'interface' | 'mic') => void} setSensitivity
 */

/** Number of recent flux values to keep for adaptive mean */
const FLUX_HISTORY_LENGTH = 10;

/** Threshold multiplier presets per source quality */
const SENSITIVITY_MULTIPLIERS = {
  interface: 1.0,
  mic: 0.7,
};

/**
 * Convert a dB value to linear magnitude.
 * @param {number} db - Decibel value (negative)
 * @returns {number} Linear magnitude (>= 0)
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Create a spectral flux onset detector.
 *
 * @param {Object} options
 * @param {import('tone').Analyser} options.analyser - Tone.Analyser instance (FFT mode)
 * @param {number} [options.threshold=0.3] - Onset sensitivity (multiplier above adaptive mean)
 * @param {number} [options.cooldownMs=50] - Minimum ms between onsets
 * @returns {OnsetDetector}
 */
export function create(options) {
  const { analyser } = options;
  if (!analyser) {
    throw new Error('onset-detection: analyser is required');
  }

  let threshold = options.threshold ?? 0.3;
  let cooldownMs = options.cooldownMs ?? 50;
  let sensitivityMultiplier = 1.0;

  /** @type {Float32Array|null} Previous frame's linear magnitudes */
  let prevMagnitudes = null;

  /** @type {number[]} Recent flux values for adaptive mean */
  let fluxHistory = [];

  /** @type {number|null} requestAnimationFrame ID */
  let rafId = null;

  /** @type {number} Timestamp of last fired onset */
  let lastOnsetTime = 0;

  /** @type {((event: OnsetEvent) => void)|null} */
  let onOnsetCallback = null;

  /**
   * Compute spectral flux between current and previous magnitude frames.
   * @param {Float32Array} currentMag - Current frame linear magnitudes
   * @param {Float32Array} prevMag - Previous frame linear magnitudes
   * @returns {number} Sum of positive magnitude differences
   */
  function computeFlux(currentMag, prevMag) {
    let flux = 0;
    const len = Math.min(currentMag.length, prevMag.length);
    for (let i = 0; i < len; i++) {
      const diff = currentMag[i] - prevMag[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    return flux;
  }

  /**
   * Compute the mean of the flux history buffer.
   * @returns {number}
   */
  function fluxMean() {
    if (fluxHistory.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < fluxHistory.length; i++) {
      sum += fluxHistory[i];
    }
    return sum / fluxHistory.length;
  }

  /**
   * Main analysis loop — runs on each animation frame.
   */
  function tick() {
    rafId = requestAnimationFrame(tick);

    // Get FFT data from the Tone.Analyser (Float32Array of dB values)
    const fftData = analyser.getValue();

    // Convert dB → linear magnitudes
    const currentMag = new Float32Array(fftData.length);
    for (let i = 0; i < fftData.length; i++) {
      currentMag[i] = dbToLinear(fftData[i]);
    }

    // First frame — store and return, no comparison possible
    if (prevMagnitudes === null) {
      prevMagnitudes = currentMag;
      return;
    }

    // Compute spectral flux
    const flux = computeFlux(currentMag, prevMagnitudes);

    // Update history
    fluxHistory.push(flux);
    if (fluxHistory.length > FLUX_HISTORY_LENGTH) {
      fluxHistory.shift();
    }

    // Store current frame for next comparison
    prevMagnitudes = currentMag;

    // Adaptive threshold: current flux must exceed mean * multiplier
    const mean = fluxMean();
    const adaptiveThreshold = mean * (1 + threshold / sensitivityMultiplier);

    // Check for onset
    const now = performance.now();
    if (flux > adaptiveThreshold && mean > 0 && (now - lastOnsetTime) >= cooldownMs) {
      lastOnsetTime = now;

      // Normalize strength to 0–1 range relative to the adaptive threshold
      // strength = how far above the threshold, clamped to [0, 1]
      const strength = Math.min(1, (flux - adaptiveThreshold) / (adaptiveThreshold || 1));

      if (onOnsetCallback) {
        onOnsetCallback({ timestamp: now, strength });
      }
    }
  }

  return {
    /**
     * Begin monitoring for onsets.
     * @param {(event: OnsetEvent) => void} onOnset - Callback fired on each detected onset
     */
    start(onOnset) {
      if (rafId !== null) return; // already running
      onOnsetCallback = onOnset;
      prevMagnitudes = null;
      fluxHistory = [];
      lastOnsetTime = 0;
      rafId = requestAnimationFrame(tick);
    },

    /**
     * Stop monitoring and clean up.
     */
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      onOnsetCallback = null;
      prevMagnitudes = null;
      fluxHistory = [];
    },

    /**
     * Adjust the onset threshold during gameplay.
     * Higher values = less sensitive (fewer onsets). Lower values = more sensitive.
     * @param {number} value - Threshold multiplier (e.g. 0.1–1.0)
     */
    setThreshold(value) {
      threshold = value;
    },

    /**
     * Adjust sensitivity based on input source quality.
     * Audio interfaces have cleaner signals, so a tighter threshold is appropriate.
     * Mic input is noisier, so a looser threshold (lower multiplier) avoids missed onsets.
     * @param {'interface' | 'mic'} sourceQuality
     */
    setSensitivity(sourceQuality) {
      sensitivityMultiplier = SENSITIVITY_MULTIPLIERS[sourceQuality] ?? 1.0;
    },
  };
}
