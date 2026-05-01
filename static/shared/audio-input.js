/**
 * audio-input.js
 * ==============
 * Singleton audio input manager for SongLab.
 *
 * Manages audio input device selection (built-in mic, USB interface)
 * and feeds a shared Tone.Analyser so that Spectrum panel, pitch
 * detection, onset detection, and chord detection all read from
 * the same source.
 *
 * Auto-detects known audio interfaces by label matching and persists
 * the user's device preference across sessions via localStorage.
 *
 * Consumed by:
 *   - keyboard-view.js  → connects external audio to shared analyser
 *   - spectrum-view.js  → Harmonic Resonance visualizes live input
 *   - (future) pitch-detection.js, onset-detection.js, chord-detection.js
 *
 * Depends on:
 *   - Web Audio API (navigator.mediaDevices)
 *   - localStorage (device preference persistence)
 *   - Tone.js Analyser node passed in from the outside (not imported)
 *
 * Exposes: window.AudioInput  (also ES-module default + named export)
 */

const STORAGE_KEY = 'songlab-audio-device';

/**
 * Known audio interface brand/model substrings.
 * If a device label contains any of these (case-insensitive),
 * it is classified as an audio interface rather than a built-in mic.
 */
const KNOWN_INTERFACES = [
  'scarlett',
  'focusrite',
  'audient',
  'motu',
  'presonus',
  'universal audio',
  'steinberg',
  'behringer umc',
];

// ════════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ════════════════════════════════════════════════════════════════════

let _analyser = null;
let _stream = null;
let _sourceNode = null;
let _audioContext = null;
let _devices = [];
let _selectedDeviceId = null;
let _deviceChangeCallback = null;

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Check whether a device label matches a known audio interface.
 *
 * @param {string} label - Device label from enumerateDevices
 * @returns {boolean}
 */
function _isInterface(label) {
  const lower = label.toLowerCase();
  return KNOWN_INTERFACES.some((name) => lower.includes(name));
}

/**
 * Build a friendly display label for a device.
 * Handles iOS Safari where labels are empty before first getUserMedia.
 *
 * @param {MediaDeviceInfo} device - Raw device info
 * @param {number} index - Zero-based index in the device list
 * @returns {string}
 */
function _displayLabel(device, index) {
  if (device.label) return device.label;
  return `Microphone ${index + 1}`;
}

/**
 * Enumerate audio input devices and return a clean list.
 *
 * @returns {Promise<Array<{deviceId: string, label: string, isInterface: boolean}>>}
 */
async function _enumerate() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: _displayLabel(d, i),
      isInterface: _isInterface(d.label || ''),
    }));
}

/**
 * Read the saved device preference from localStorage.
 *
 * @returns {string|null}
 */
function _readPreferred() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Save the selected device ID to localStorage.
 *
 * @param {string} deviceId
 */
function _savePreferred(deviceId) {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch (e) {
    // localStorage may be unavailable (private mode, etc.)
  }
}

/**
 * Connect a native AudioNode source to a Tone.Analyser (or Tone node).
 * Uses Tone.connect() when available — it handles the native-to-Tone
 * mapping. Falls back to the analyser's internal native node otherwise.
 *
 * @param {AudioNode} source - Native Web Audio node
 * @param {object} analyser - Tone.Analyser (or any Tone node)
 */
function _connectToAnalyser(source, analyser) {
  if (typeof window !== 'undefined' && window.Tone && typeof window.Tone.connect === 'function') {
    window.Tone.connect(source, analyser);
    return;
  }
  const native = analyser._analyser || (analyser.input && (analyser.input._analyser || analyser.input)) || analyser;
  source.connect(native);
}

/**
 * Disconnect the current source node and stop the media stream.
 */
function _disconnectCurrent() {
  if (_sourceNode) {
    try { _sourceNode.disconnect(); } catch (e) { /* already disconnected */ }
    _sourceNode = null;
  }
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
    _stream = null;
  }
}

// ════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════

const AudioInput = {
  /** @type {boolean} Whether a device is currently streaming */
  isActive: false,

  /** @type {{deviceId: string, label: string, isInterface: boolean}|null} */
  activeDevice: null,

  /**
   * Initialize the audio input system.
   * Enumerates available audio input devices and auto-detects
   * known interfaces by label matching. Optionally accepts a
   * Tone.Analyser node to route audio into.
   *
   * On iOS Safari, enumerateDevices returns empty labels before
   * the first getUserMedia call. Devices will show as
   * "Microphone 1", "Microphone 2", etc. until permission is granted.
   *
   * @param {object} [options]
   * @param {object} [options.analyser] - Tone.Analyser node to connect input to
   * @returns {Promise<{devices: Array, detected: object|null}>}
   */
  async init(options = {}) {
    if (options.analyser) {
      _analyser = options.analyser;
    }

    _devices = await _enumerate();

    // Auto-detect: find the first known interface
    const detected = _devices.find((d) => d.isInterface) || null;

    // Attempt to restore previously selected device
    await this.restoreDevice();

    return { devices: _devices, detected };
  },

  /**
   * Set or replace the Tone.Analyser node that audio input feeds.
   * If a stream is already active, it is reconnected to the new analyser.
   *
   * @param {object} analyser - Tone.Analyser node
   */
  setAnalyser(analyser) {
    _analyser = analyser;
    // Reconnect active source to the new analyser
    if (_sourceNode && _analyser) {
      try { _sourceNode.disconnect(); } catch (e) { /* ok */ }
      _connectToAnalyser(_sourceNode, _analyser);
    }
  },

  /**
   * Select an audio input device and start streaming.
   * Creates a MediaStream via getUserMedia with the specified
   * deviceId constraint, connects it to the shared Tone.Analyser,
   * and saves the preference to localStorage.
   *
   * @param {string} deviceId - The deviceId from enumerateDevices
   * @returns {Promise<boolean>} true if successful
   */
  async selectDevice(deviceId) {
    _disconnectCurrent();

    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      console.warn('[AudioInput] getUserMedia failed:', err);
      this.isActive = false;
      this.activeDevice = null;
      return false;
    }

    // Re-enumerate to pick up real labels (iOS Safari workaround)
    _devices = await _enumerate();

    // Resolve the device info for the selected device
    const deviceInfo = _devices.find((d) => d.deviceId === deviceId) || null;

    _selectedDeviceId = deviceId;
    _savePreferred(deviceId);

    // Create source node and connect to analyser.
    // The MediaStreamSource MUST live in the same AudioContext as the
    // Tone.Analyser we're connecting to — Web Audio forbids cross-context
    // node wiring. Prefer Tone's context; fall back to a standalone context
    // only if Tone isn't loaded/started (in which case the _analyser will
    // not receive audio).
    if (_stream.getAudioTracks()[0]) {
      const toneCtx = (typeof window !== 'undefined' && window.Tone && window.Tone.getContext)
        ? window.Tone.getContext().rawContext
        : null;

      if (toneCtx && toneCtx.state === 'running') {
        _audioContext = toneCtx;
      } else {
        console.warn(
          '[AudioInput] Tone.js context not available/running — using standalone AudioContext fallback. '
          + 'Call AudioInput.rewireForTone() after first user gesture (Tone.start) to route mic input to '
          + 'Tone-based analysers.'
        );
        _audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    } else {
      _audioContext = null;
    }

    if (_audioContext && _stream) {
      _sourceNode = _audioContext.createMediaStreamSource(_stream);

      if (_analyser) {
        _connectToAnalyser(_sourceNode, _analyser);
      }
    }

    this.isActive = true;
    this.activeDevice = deviceInfo;
    return true;
  },

  /**
   * Get the quality classification of the currently selected device.
   *
   * @returns {'interface'|'mic'|null} 'interface' if the device label
   *   matches a known audio interface, 'mic' otherwise, null if no device
   */
  getSourceQuality() {
    if (!this.activeDevice) return null;
    return this.activeDevice.isInterface ? 'interface' : 'mic';
  },

  /**
   * Get the current MediaStream.
   * Useful for modules that need raw stream access (e.g. pitch detection
   * via AudioWorklet or ScriptProcessorNode).
   *
   * @returns {MediaStream|null}
   */
  getStream() {
    return _stream;
  },

  /**
   * Get the list of available audio input devices.
   * Call init() first to populate the list.
   *
   * @returns {Array<{deviceId: string, label: string, isInterface: boolean}>}
   */
  getDevices() {
    return _devices;
  },

  /**
   * Register a callback for device connect/disconnect events.
   * When a USB device is plugged or unplugged, the callback fires
   * with the updated device list.
   *
   * @param {function} callback - Receives updated device list array
   * @returns {function} Unsubscribe function
   */
  onDeviceChange(callback) {
    _deviceChangeCallback = callback;

    const handler = async () => {
      _devices = await _enumerate();
      if (_deviceChangeCallback) {
        try { _deviceChangeCallback(_devices); } catch (e) { console.error(e); }
      }
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = handler;
    }

    return () => {
      _deviceChangeCallback = null;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.ondevicechange = null;
      }
    };
  },

  /**
   * Restore the previously selected device from localStorage.
   * If the saved device is still available, selects it automatically.
   * Called internally by init().
   *
   * @returns {Promise<boolean>} true if a device was restored
   */
  async restoreDevice() {
    const preferred = _readPreferred();
    if (!preferred) return false;

    const match = _devices.find((d) => d.deviceId === preferred);
    if (!match) return false;

    return this.selectDevice(preferred);
  },

  /**
   * Stop the current stream and disconnect from the analyser.
   */
  disconnect() {
    _disconnectCurrent();
    _selectedDeviceId = null;
    this.isActive = false;
    this.activeDevice = null;
  },

  /**
   * Rewire the active mic input into Tone's AudioContext after a user
   * gesture has started Tone.
   *
   * Mic input is initialized in two phases across the user-gesture
   * boundary required by browser autoplay policies:
   *   - Phase 1 — selectDevice() runs (often pre-gesture, e.g. saved-
   *     device auto-restore at page load). If Tone's rawContext isn't
   *     running yet, the documented fallback creates the
   *     MediaStreamSource in a standalone AudioContext. That fallback
   *     is intentional, not a bug — it lets selectDevice succeed and
   *     keeps activeDevice/isActive consistent before any gesture.
   *   - Phase 2 — rewireForTone() runs after Tone.start() resolves.
   *     It tears down the standalone-context source and re-runs
   *     selectDevice, which now lands on Tone's rawContext and
   *     reconnects to the existing analyser.
   *
   * Call this from any code path that runs after Tone.start() resolves
   * (e.g. the first user gesture that starts Tone). The method is
   * self-gating: it no-ops when no device is active and when the
   * source is already in Tone's rawContext, so callers don't need to
   * track whether a rewire is needed.
   *
   * @returns {Promise<void>}
   */
  async rewireForTone() {
    if (!this.activeDevice || !_selectedDeviceId) return;

    const toneCtx = (typeof window !== 'undefined' && window.Tone && window.Tone.getContext)
      ? window.Tone.getContext().rawContext
      : null;
    if (toneCtx && _audioContext === toneCtx) return;

    const savedId = _selectedDeviceId;
    _disconnectCurrent();
    await this.selectDevice(savedId);
  },
};

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  window.AudioInput = AudioInput;
}

export { AudioInput };
export default AudioInput;
