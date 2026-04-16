/**
 * input-provider.js — Unified input abstraction for SongLab games
 *
 * Thin layer that games consume to receive a uniform event stream from
 * any supported input modality (click, MIDI, mic pitch, mic chord, mic onset).
 * Renders a picker UI into a container element so the player can switch
 * modalities at runtime.
 *
 * Usage:
 *   import { createInputProvider } from '/static/shared/input-provider.js';
 *
 *   const provider = createInputProvider({
 *     gameId: 'harmony-trainer',
 *     supported: { click: true, midi: true, pitch: { mic: true } },
 *     containerEl: document.getElementById('input-picker'),
 *   });
 *
 *   provider.on('noteOn', ({ note, octave, velocity, source }) => { ... });
 *   provider.on('chord',  ({ root, quality, symbol, confidence, source }) => { ... });
 *   provider.destroy();
 *
 * @module input-provider
 */

import MIDIInput from './midi-input.js';
import AudioInput from './audio-input.js';
import { create as createOnsetDetector } from './onset-detection.js';
import { createPitchDetector } from './pitch-detection.js';
import { create as createChordDetector } from './chord-detection.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Modality definitions — order determines pill display order.
 * @type {Array<{id: string, label: string, icon: string, supportKey: string}>}
 */
const MODALITIES = [
  { id: 'click',     label: 'Click',  icon: '\u{1F5B1}', supportKey: 'click' },
  { id: 'midi',      label: 'MIDI',   icon: '\u{1F3B9}', supportKey: 'midi' },
  { id: 'mic_pitch', label: 'Voice',  icon: '\u{1F3A4}', supportKey: 'pitch' },
  { id: 'mic_chord', label: 'Strum',  icon: '\u{1F3B8}', supportKey: 'chord' },
  { id: 'mic_onset', label: 'Tap',    icon: '\u{1F44F}', supportKey: 'onset' },
];

/** Event types consumers can subscribe to */
const EVENT_TYPES = ['noteOn', 'noteOff', 'onset', 'chord'];

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Convert a MIDI note number (0–127) to { note, octave }.
 * @param {number} midiNote
 * @returns {{ note: string, octave: number }}
 */
function midiNoteToInfo(midiNote) {
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave };
}

/**
 * Check whether a game declares support for a given modality.
 * Returns false, true, or a source-quality descriptor object.
 *
 * @param {object} supported - Game's supported declaration
 * @param {string} supportKey - Key in the supported object ('click', 'midi', 'onset', 'pitch', 'chord')
 * @returns {boolean|object}
 */
function isSupported(supported, supportKey) {
  if (!supported) return false;
  const val = supported[supportKey];
  if (val === undefined || val === false || val === null) return false;
  return val; // true or { mic: ..., interface: ... }
}

/**
 * Check whether the hardware required for a modality is available.
 *
 * @param {string} modalityId - 'click' | 'midi' | 'mic_pitch' | 'mic_chord' | 'mic_onset'
 * @returns {boolean}
 */
function isHardwareAvailable(modalityId) {
  if (modalityId === 'click') return true;
  if (modalityId === 'midi') return MIDIInput.isConnected;
  // Mic modalities — check if getUserMedia is available
  if (modalityId === 'mic_pitch' || modalityId === 'mic_chord' || modalityId === 'mic_onset') {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  return false;
}

/**
 * Determine whether chord detection for a given source quality is experimental.
 *
 * @param {object} supported - Game's supported declaration
 * @returns {boolean}
 */
function isChordExperimental(supported) {
  const chord = supported.chord;
  if (!chord || typeof chord !== 'object') return false;
  return chord.mic === 'experimental';
}

// ════════════════════════════════════════════════════════════════════
// PICKER UI
// ════════════════════════════════════════════════════════════════════

/**
 * Render the modality picker pills into a container element.
 *
 * @param {object} params
 * @param {HTMLElement} params.containerEl
 * @param {object} params.supported - Game's supported modality declaration
 * @param {string} params.activeModality - Currently active modality id
 * @param {(modalityId: string) => void} params.onSelect - Selection callback
 * @returns {{ update: (activeModality: string) => void, destroy: () => void }}
 */
function renderPicker({ containerEl, supported, activeModality, onSelect }) {
  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'input-picker';

  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  for (const mod of MODALITIES) {
    const sup = isSupported(supported, mod.supportKey);
    if (!sup) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'input-picker__pill game-pill';
    btn.dataset.modality = mod.id;

    // Icon + label
    const iconSpan = document.createElement('span');
    iconSpan.className = 'input-picker__icon';
    iconSpan.textContent = mod.icon;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'input-picker__label';
    labelSpan.textContent = mod.label;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);

    // Experimental badge for mic chord detection
    if (mod.id === 'mic_chord' && isChordExperimental(supported)) {
      const badge = document.createElement('span');
      badge.className = 'input-picker__badge';
      badge.textContent = '(experimental)';
      btn.appendChild(badge);
    }

    // Hardware availability
    const available = isHardwareAvailable(mod.id);
    if (!available) {
      btn.disabled = true;
    }

    // Active state
    if (mod.id === activeModality) {
      btn.classList.add('game-pill--active');
    }

    btn.addEventListener('click', () => {
      if (!btn.disabled) {
        onSelect(mod.id);
      }
    });

    buttons.set(mod.id, btn);
    wrapper.appendChild(btn);
  }

  containerEl.appendChild(wrapper);

  return {
    /** Update active state and hardware availability on all pills */
    update(newActiveModality) {
      for (const [id, btn] of buttons) {
        // Refresh hardware availability
        const available = isHardwareAvailable(id);
        btn.disabled = !available;
        // Update active class
        btn.classList.toggle('game-pill--active', id === newActiveModality);
      }
    },

    /** Remove picker DOM from the container */
    destroy() {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// STYLE INJECTION
// ════════════════════════════════════════════════════════════════════

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .input-picker {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs, 4px);
      align-items: center;
    }

    .input-picker__pill {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs, 4px);
      padding: 6px 14px;
      border-radius: var(--radius-md, 6px);
      border: 1.5px solid var(--border-color, #D9D2C0);
      background: var(--bg-surface, #FFFFFF);
      color: var(--text-tertiary, #6B6457);
      font-family: var(--font-family-base, system-ui, sans-serif);
      font-size: var(--font-size-xs, 0.75rem);
      font-weight: var(--font-weight-medium, 500);
      cursor: pointer;
      user-select: none;
      transition: all var(--transition-fast, 120ms ease);
      white-space: nowrap;
    }

    .input-picker__pill:hover:not(.game-pill--active):not(:disabled) {
      border-color: var(--text-secondary, #4A4339);
      color: var(--text-secondary, #4A4339);
    }

    .input-picker__pill.game-pill--active {
      background: var(--accent-gold, #D4A03C);
      border-color: var(--accent-gold, #D4A03C);
      color: #FFFFFF;
    }

    .input-picker__pill:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .input-picker__icon {
      font-size: 1em;
      line-height: 1;
    }

    .input-picker__badge {
      font-size: var(--font-size-2xs, 0.65rem);
      font-weight: var(--font-weight-regular, 400);
      opacity: 0.7;
      margin-left: 2px;
    }
  `;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════════════════════
// INPUT PROVIDER FACTORY
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} NoteOnEvent
 * @property {string} note     - Note name ('C', 'F#', etc.)
 * @property {number} octave   - Octave number
 * @property {number} velocity - 0–127 (MIDI) or 100 (mic default)
 * @property {string} source   - 'click' | 'midi' | 'mic_pitch' | 'mic_chord' | 'mic_onset'
 */

/**
 * @typedef {Object} NoteOffEvent
 * @property {string} note   - Note name
 * @property {number} octave - Octave number
 * @property {string} source - Source modality
 */

/**
 * @typedef {Object} OnsetEvent
 * @property {number} timestamp - performance.now() of detected onset
 * @property {number} strength  - 0–1 normalized energy spike
 * @property {string} source    - 'mic_onset'
 */

/**
 * @typedef {Object} ChordEvent
 * @property {string} root       - Note name ('C', 'F#', etc.)
 * @property {string} quality    - 'major', 'minor', etc.
 * @property {string} symbol     - Formatted display string ('Cmaj7', 'F#m')
 * @property {number} confidence - 0–1
 * @property {string} source     - 'midi' | 'mic_chord'
 */

/**
 * @typedef {Object} InputProviderConfig
 * @property {string} gameId          - Identifier for the game
 * @property {object} supported       - Declares which modalities the game supports
 * @property {HTMLElement} [containerEl] - DOM element to mount picker UI into
 * @property {object} [analyser]      - Tone.Analyser instance for mic modalities
 */

/**
 * Create a unified input provider for a game.
 *
 * @param {InputProviderConfig} config
 * @returns {{
 *   on: (eventType: string, callback: function) => void,
 *   off: (eventType: string, callback: function) => void,
 *   getActiveModality: () => string,
 *   setModality: (modality: string) => void,
 *   destroy: () => void,
 * }}
 */
export function createInputProvider(config) {
  const { gameId, supported, containerEl, analyser } = config;

  if (!gameId) throw new Error('input-provider: gameId is required');
  if (!supported) throw new Error('input-provider: supported is required');

  // ── Event system ────────────────────────────────────────────────
  /** @type {Map<string, Set<function>>} */
  const listeners = new Map();
  for (const type of EVENT_TYPES) {
    listeners.set(type, new Set());
  }

  function emit(eventType, data) {
    const set = listeners.get(eventType);
    if (!set) return;
    for (const cb of set) {
      try { cb(data); } catch (e) { console.error(`[input-provider] listener error:`, e); }
    }
  }

  // ── State ───────────────────────────────────────────────────────
  let activeModality = 'click'; // safe default — always supported
  let destroyed = false;

  // Active detection module instances
  let midiUnsubNoteOn = null;
  let midiUnsubNoteOff = null;
  let pitchDetector = null;
  let chordDetector = null;
  let onsetDetector = null;

  // Track the last pitch note for noteOff generation
  let lastPitchNote = null;

  // ── MIDI event handlers ─────────────────────────────────────────

  function handleMidiNoteOn(midiNote, velocity, _channel) {
    const { note, octave } = midiNoteToInfo(midiNote);
    emit('noteOn', { note, octave, velocity, source: 'midi' });
  }

  function handleMidiNoteOff(midiNote, _channel) {
    const { note, octave } = midiNoteToInfo(midiNote);
    emit('noteOff', { note, octave, source: 'midi' });
  }

  // ── Modality activation / deactivation ──────────────────────────

  /**
   * Stop whatever detection module is currently active.
   */
  function stopCurrentModality() {
    // MIDI unsubscribe
    if (midiUnsubNoteOn) {
      midiUnsubNoteOn();
      midiUnsubNoteOn = null;
    }
    if (midiUnsubNoteOff) {
      midiUnsubNoteOff();
      midiUnsubNoteOff = null;
    }

    // Pitch detector
    if (pitchDetector) {
      pitchDetector.stop();
      pitchDetector = null;
      // Emit a final noteOff if we had a note active
      if (lastPitchNote) {
        emit('noteOff', { note: lastPitchNote.note, octave: lastPitchNote.octave, source: 'mic_pitch' });
        lastPitchNote = null;
      }
    }

    // Chord detector
    if (chordDetector) {
      chordDetector.stop();
      chordDetector = null;
    }

    // Onset detector
    if (onsetDetector) {
      onsetDetector.stop();
      onsetDetector = null;
    }
  }

  /**
   * Start the detection module for the given modality.
   * @param {string} modalityId
   */
  async function startModality(modalityId) {
    if (destroyed) return;

    switch (modalityId) {
      case 'click':
        // Click modality — game handles its own click events.
        // Provider just tracks the state.
        break;

      case 'midi':
        // Ensure MIDIInput is initialized
        if (!MIDIInput.isConnected) {
          await MIDIInput.init();
        }
        midiUnsubNoteOn = MIDIInput.onNoteOn(handleMidiNoteOn);
        midiUnsubNoteOff = MIDIInput.onNoteOff(handleMidiNoteOff);
        break;

      case 'mic_pitch': {
        const stream = AudioInput.getStream();
        pitchDetector = createPitchDetector({
          engine: 'yin',
          stream: stream || undefined,
        });
        await pitchDetector.start((result) => {
          if (destroyed) return;
          if (result.frequency > 0 && result.note) {
            // If the note changed, emit noteOff for old + noteOn for new
            if (lastPitchNote &&
                (lastPitchNote.note !== result.note || lastPitchNote.octave !== result.octave)) {
              emit('noteOff', { note: lastPitchNote.note, octave: lastPitchNote.octave, source: 'mic_pitch' });
            }
            lastPitchNote = { note: result.note, octave: result.octave };
            emit('noteOn', {
              note: result.note,
              octave: result.octave,
              velocity: Math.round(result.confidence * 127),
              source: 'mic_pitch',
            });
          } else if (lastPitchNote) {
            // No pitch detected — release the previous note
            emit('noteOff', { note: lastPitchNote.note, octave: lastPitchNote.octave, source: 'mic_pitch' });
            lastPitchNote = null;
          }
        });
        break;
      }

      case 'mic_chord': {
        if (!analyser) {
          console.warn('[input-provider] mic_chord requires an analyser in config');
          break;
        }
        const sourceQuality = AudioInput.getSourceQuality() || 'mic';
        chordDetector = createChordDetector({ analyser, sourceQuality });
        chordDetector.start((result) => {
          if (destroyed) return;
          emit('chord', {
            root: result.root,
            quality: result.quality,
            symbol: result.symbol,
            confidence: result.confidence,
            source: 'mic_chord',
          });
        });
        break;
      }

      case 'mic_onset': {
        if (!analyser) {
          console.warn('[input-provider] mic_onset requires an analyser in config');
          break;
        }
        onsetDetector = createOnsetDetector({ analyser });
        const sourceQuality = AudioInput.getSourceQuality();
        if (sourceQuality) {
          onsetDetector.setSensitivity(sourceQuality);
        }
        onsetDetector.start((event) => {
          if (destroyed) return;
          emit('onset', {
            timestamp: event.timestamp,
            strength: event.strength,
            source: 'mic_onset',
          });
        });
        break;
      }

      default:
        console.warn(`[input-provider] Unknown modality: ${modalityId}`);
    }
  }

  // ── Picker UI ───────────────────────────────────────────────────
  let picker = null;

  if (containerEl) {
    injectStyles();

    // Determine initial modality — first supported one
    const firstSupported = MODALITIES.find((m) => isSupported(supported, m.supportKey));
    if (firstSupported) {
      activeModality = firstSupported.id;
    }

    picker = renderPicker({
      containerEl,
      supported,
      activeModality,
      onSelect(modalityId) {
        if (modalityId === activeModality) return;
        setModality(modalityId);
      },
    });
  }

  // Start the initial modality
  startModality(activeModality);

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Subscribe to an event type.
   *
   * @param {string} eventType - 'noteOn' | 'noteOff' | 'onset' | 'chord'
   * @param {function} callback
   */
  function on(eventType, callback) {
    const set = listeners.get(eventType);
    if (!set) {
      console.warn(`[input-provider] Unknown event type: ${eventType}`);
      return;
    }
    set.add(callback);
  }

  /**
   * Unsubscribe from an event type.
   *
   * @param {string} eventType
   * @param {function} callback
   */
  function off(eventType, callback) {
    const set = listeners.get(eventType);
    if (set) {
      set.delete(callback);
    }
  }

  /**
   * Get the currently active modality.
   *
   * @returns {string} 'click' | 'midi' | 'mic_pitch' | 'mic_chord' | 'mic_onset'
   */
  function getActiveModality() {
    return activeModality;
  }

  /**
   * Programmatically switch to a different modality.
   * Stops the current detection module and starts the new one.
   *
   * @param {string} modality - Target modality id
   */
  function setModality(modality) {
    if (modality === activeModality) return;
    if (destroyed) return;

    // Validate that this modality is supported by the game
    const modDef = MODALITIES.find((m) => m.id === modality);
    if (!modDef) {
      console.warn(`[input-provider] Unknown modality: ${modality}`);
      return;
    }
    if (!isSupported(supported, modDef.supportKey)) {
      console.warn(`[input-provider] Modality "${modality}" not supported by game "${gameId}"`);
      return;
    }

    stopCurrentModality();
    activeModality = modality;
    startModality(modality);

    if (picker) {
      picker.update(modality);
    }
  }

  /**
   * Tear down the provider — stop all detection, remove picker UI,
   * and clear all event subscriptions.
   */
  function destroy() {
    if (destroyed) return;
    destroyed = true;

    stopCurrentModality();

    if (picker) {
      picker.destroy();
      picker = null;
    }

    // Clear all listeners
    for (const set of listeners.values()) {
      set.clear();
    }
  }

  return { on, off, getActiveModality, setModality, destroy };
}
