// audio-bridge.js — Connects Tone.js and mic pitch detection to the Skratch Studio sandbox
//
// Piano: uses Tone.Sampler loaded from the Salamander Grand Piano sample library
//        (https://tonejs.github.io/audio/salamander/). Samples begin loading as soon
//        as this class is constructed — natural decay is built into the samples.
//
// Organ / Synth: unchanged — per-note Tone.Synth voices via the output bus.
//
// Sustain pedal: works for all instruments. For the piano sampler, notes held via
// sustain simply defer triggerRelease() until the pedal is lifted.

import { startPitchDetection, stopPitchDetection } from '../shared/audio.js';

// ── Salamander Grand Piano sample map ────────────────────────────────────────
const SALAMANDER_BASE_URL = 'https://tonejs.github.io/audio/salamander/';
const SALAMANDER_URLS = {
  A0: 'A0.mp3',  C1: 'C1.mp3',  'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',  C2: 'C2.mp3',  'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',  C3: 'C3.mp3',  'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',  C4: 'C4.mp3',  'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',  C5: 'C5.mp3',  'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',  C6: 'C6.mp3',  'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',  C7: 'C7.mp3',  'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
};

// ── Non-piano presets (unchanged) ────────────────────────────────────────────
// 'piano' key kept only for setSoundType() validation.
const SOUND_PRESETS = {
  piano: {},   // handled by Sampler — options not used
  organ: {
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.95, release: 0.3 },
    },
    buildEffects() {
      const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
      const dist = new Tone.Distortion(0.15);
      const trem = new Tone.Tremolo(5.5, 0.35).start();
      return [chorus, dist, trem];
    },
  },
  synth: {
    options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
    },
    buildEffects() {
      const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
      const filt = new Tone.Filter(2500, 'lowpass');
      return [chorus, filt];
    },
  },
};

export class AudioBridge {
  constructor() {
    this._outputBus = null;
    this._effects = [];
    this._voiceMap = new Map();   // noteName → Tone.Synth (organ/synth only)
    this._voiceOptions = {};
    this._toneStarted = false;
    this._micActive = false;
    this._rafId = null;
    this._onNoteCallbacks = [];
    this._lastDetectedNote = '--';
    this._soundType = 'piano';

    // Sustain pedal state
    this._sustain = false;
    this._activeNotes = new Set();
    this._sustainedNotes = new Set();

    // Shared audio state — read by the sandbox each frame
    this.state = {
      currentPitch: 0,
      currentNoteName: '--',
      currentVolume: 0,
      noteIsPlaying: false,
      lastNotePlayed: '--',
    };

    // ── Salamander piano sampler ─────────────────────────────────
    // Created immediately so loading starts before first user interaction.
    this._pianoSampler = null;
    this._pianoVolume  = null;
    this._pianoSamplerReady = false;
    this._samplerLoadCallbacks = [];
    this._initSampler();
  }

  // ── Piano sampler init ────────────────────────────────────────────────────

  _initSampler() {
    // Volume node dedicated to the piano sampler (persists across instrument switches)
    this._pianoVolume = new Tone.Volume(-6).toDestination();

    this._pianoSampler = new Tone.Sampler({
      urls:    SALAMANDER_URLS,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1,          // natural damper-pedal release tail
      onload: () => {
        this._pianoSamplerReady = true;
        const cbs = this._samplerLoadCallbacks.slice();
        this._samplerLoadCallbacks = [];
        for (const cb of cbs) { try { cb(); } catch (_) {} }
      },
      onerror: (err) => {
        console.warn('[AudioBridge] Salamander sample load error:', err);
      },
    }).connect(this._pianoVolume);
  }

  /** Register a callback for when piano samples finish loading.
   *  If already loaded, callback fires synchronously. */
  onSamplerLoad(cb) {
    if (this._pianoSamplerReady) {
      try { cb(); } catch (_) {}
    } else {
      this._samplerLoadCallbacks.push(cb);
    }
  }

  // ── Tone.js init ─────────────────────────────────────────────────────────

  async ensureTone() {
    if (this._toneStarted) return;
    if (typeof Tone === 'undefined') {
      throw new Error('Tone.js not loaded');
    }
    await Tone.start();
    // Piano uses the sampler (already created) — only build synth for other types
    if (this._soundType !== 'piano') {
      this._buildSynth();
    }
    this._toneStarted = true;
  }

  _buildSynth() {
    // Dispose all existing voices, effects, and output bus (leaves piano sampler untouched)
    this._disposeAll();

    const preset = SOUND_PRESETS[this._soundType];
    if (!preset || !preset.options) return; // piano — nothing to build
    this._voiceOptions = preset.options;

    // Shared output bus — all per-note voices connect here
    this._outputBus = new Tone.Volume(-6);

    if (preset.buildEffects) {
      this._effects = preset.buildEffects();
      this._outputBus.chain(...this._effects, Tone.Destination);
    } else {
      this._outputBus.toDestination();
    }
  }

  /** Create an individual Tone.Synth voice connected to the output bus. */
  _createVoice() {
    const synth = new Tone.Synth(this._voiceOptions);
    synth.connect(this._outputBus);
    return synth;
  }

  /** Release a voice by note name and schedule its disposal after the release phase. */
  _releaseVoice(noteName) {
    const voice = this._voiceMap.get(noteName);
    if (!voice) return;
    this._voiceMap.delete(noteName);
    try { voice.triggerRelease(); } catch (_) { }
    const releaseMs = ((this._voiceOptions.envelope && this._voiceOptions.envelope.release) || 1) * 1000 + 500;
    setTimeout(() => {
      try { voice.disconnect(); voice.dispose(); } catch (_) { }
    }, releaseMs);
  }

  /** Dispose organ/synth voices, effects, and output bus. Does NOT touch piano sampler. */
  _disposeAll() {
    if (this._voiceMap) {
      for (const [, voice] of this._voiceMap) {
        try { voice.disconnect(); voice.dispose(); } catch (_) { }
      }
      this._voiceMap.clear();
    }
    for (const fx of this._effects) {
      try { fx.dispose(); } catch (_) { }
    }
    this._effects = [];
    if (this._outputBus) {
      try { this._outputBus.dispose(); } catch (_) { }
      this._outputBus = null;
    }
  }

  setSoundType(type) {
    if (!SOUND_PRESETS[type] || type === this._soundType) return;
    if (this._toneStarted) {
      // Release notes in the CURRENT instrument before switching
      this._releaseCurrentInstrument();
      this._activeNotes.clear();
      this._sustainedNotes.clear();
      this._sustain = false;

      this._soundType = type;
      if (type !== 'piano') {
        this._buildSynth();
      } else {
        // Switching to piano: dispose the organ/synth output bus/effects
        this._disposeAll();
      }
    } else {
      this._soundType = type;
    }
  }

  /** Release all currently ringing notes in the current instrument (used during setSoundType). */
  _releaseCurrentInstrument() {
    if (this._soundType === 'piano') {
      if (this._pianoSamplerReady) {
        const all = [...this._activeNotes, ...this._sustainedNotes];
        for (const note of all) {
          try { this._pianoSampler.triggerRelease(note); } catch (_) {}
        }
      }
    } else {
      const notes = [...this._voiceMap.keys()];
      for (const note of notes) { this._releaseVoice(note); }
    }
  }

  // ── Note playback ─────────────────────────────────────────────────────────

  async playNote(noteName) {
    await this.ensureTone();

    if (this._soundType === 'piano') {
      if (this._pianoSamplerReady) {
        this._pianoSampler.triggerAttackRelease(noteName, '8n');
      }
    } else {
      const voice = this._createVoice();
      voice.triggerAttackRelease(noteName, '8n');
      setTimeout(() => {
        try { voice.disconnect(); voice.dispose(); } catch (_) { }
      }, 2000);
    }

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;
    this._fireNoteCallbacks();

    clearTimeout(this._noteTimeout);
    this._noteTimeout = setTimeout(() => {
      this.state.noteIsPlaying = false;
    }, 300);
  }

  async noteOn(noteName) {
    await this.ensureTone();
    if (this._activeNotes.has(noteName)) return;

    this._activeNotes.add(noteName);
    this._sustainedNotes.delete(noteName);

    if (this._soundType === 'piano') {
      // Sampler handles polyphony internally; re-attack if already ringing
      if (this._pianoSamplerReady) {
        this._pianoSampler.triggerAttack(noteName, Tone.now());
      }
    } else {
      // If a voice already exists (e.g., sustained), release it first
      if (this._voiceMap.has(noteName)) {
        const old = this._voiceMap.get(noteName);
        this._voiceMap.delete(noteName);
        try { old.triggerRelease(); } catch (_) { }
        setTimeout(() => { try { old.disconnect(); old.dispose(); } catch (_) { } }, 1000);
      }
      const voice = this._createVoice();
      this._voiceMap.set(noteName, voice);
      voice.triggerAttack(noteName);
    }

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;
    this._fireNoteCallbacks();
  }

  noteOff(noteName) {
    if (!this._toneStarted) return;
    this._activeNotes.delete(noteName);

    if (this._soundType === 'piano') {
      if (this._sustain) {
        this._sustainedNotes.add(noteName);
      } else {
        if (this._pianoSamplerReady) {
          try { this._pianoSampler.triggerRelease(noteName, Tone.now()); } catch (_) {}
        }
      }
    } else {
      if (!this._outputBus) return;
      if (this._sustain) {
        this._sustainedNotes.add(noteName);
      } else {
        this._releaseVoice(noteName);
      }
    }

    if (this._activeNotes.size === 0 && this._sustainedNotes.size === 0) {
      this.state.noteIsPlaying = false;
    }
  }

  sustainOn() {
    this._sustain = true;
  }

  sustainOff() {
    this._sustain = false;
    if (this._sustainedNotes.size > 0) {
      if (this._soundType === 'piano') {
        if (this._pianoSamplerReady) {
          for (const note of this._sustainedNotes) {
            try { this._pianoSampler.triggerRelease(note, Tone.now()); } catch (_) {}
          }
        }
      } else {
        for (const note of this._sustainedNotes) {
          this._releaseVoice(note);
        }
      }
      this._sustainedNotes.clear();
    }
    if (this._activeNotes.size === 0) {
      this.state.noteIsPlaying = false;
    }
  }

  releaseAll() {
    const allNotes = [...this._activeNotes, ...this._sustainedNotes];
    this._activeNotes.clear();
    this._sustainedNotes.clear();
    this._sustain = false;

    if (this._soundType === 'piano') {
      if (this._pianoSamplerReady) {
        for (const note of allNotes) {
          try { this._pianoSampler.triggerRelease(note); } catch (_) {}
        }
      }
    } else {
      if (this._voiceMap && this._voiceMap.size > 0) {
        const notes = [...this._voiceMap.keys()];
        for (const note of notes) { this._releaseVoice(note); }
      }
    }
    this.state.noteIsPlaying = false;
  }

  // ── Microphone ────────────────────────────────────────────────────────────

  async startMic() {
    if (this._micActive) return;
    await this.ensureTone();
    this._micActive = true;

    await startPitchDetection((freq, noteInfo) => {
      if (!this._micActive) return;

      if (freq > 0 && noteInfo) {
        const noteName = noteInfo.fullName;
        this.state.currentPitch = Math.round(freq);
        this.state.currentNoteName = noteName;
        this.state.noteIsPlaying = true;
        this.state.currentVolume = 70;

        if (noteName !== this._lastDetectedNote) {
          this._lastDetectedNote = noteName;
          this.state.lastNotePlayed = noteName;
          this._fireNoteCallbacks();
        }
      } else {
        this.state.currentPitch = 0;
        this.state.currentNoteName = '--';
        this.state.noteIsPlaying = false;
        this.state.currentVolume = 0;
        this._lastDetectedNote = '--';
      }
    });
  }

  stopMic() {
    this._micActive = false;
    stopPitchDetection();
    this.state.currentPitch = 0;
    this.state.currentNoteName = '--';
    this.state.noteIsPlaying = false;
    this.state.currentVolume = 0;
    this._lastDetectedNote = '--';
  }

  onNotePlayed(callback) {
    this._onNoteCallbacks.push(callback);
  }

  clearNoteCallbacks() {
    this._onNoteCallbacks = [];
  }

  _fireNoteCallbacks() {
    for (const cb of this._onNoteCallbacks) {
      try { cb(); } catch (e) { /* sandbox error — ignore */ }
    }
  }

  destroy() {
    this.stopMic();
    this.clearNoteCallbacks();
    this.releaseAll();
    clearTimeout(this._noteTimeout);
    this._disposeAll();

    if (this._pianoSampler) {
      try { this._pianoSampler.dispose(); } catch (_) {}
      this._pianoSampler = null;
    }
    if (this._pianoVolume) {
      try { this._pianoVolume.dispose(); } catch (_) {}
      this._pianoVolume = null;
    }
    this._pianoSamplerReady = false;
    this._toneStarted = false;
  }
}
