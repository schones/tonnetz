// loop-pedal.js — Loop Pedal: records keyboard notes or microphone audio in 3 layers,
// plays them back via Tone.Part / Tone.Player (Tone.Transport-based, sample-accurate).
//
// Keyboard data model: layers[n] = [{note, startTime, duration, instrument}]
//   startTime, duration: seconds relative to loop start.
//   instrument: 'piano' | 'organ' | 'synth'
//
// Mic data model: _layerAudio[n] = AudioBuffer (null for keyboard layers)
//
// State machine: idle → recording1 → playing ↔ overdubbing / paused

const LAYER_COLORS = ['#a29bfe', '#fd79a8', '#74b9ff']; // L1 purple, L2 pink, L3 blue
const NUM_LAYERS   = 3;

// Synth options for organ/synth. Piano is handled by Tone.Sampler below.
const SYNTH_OPTIONS = {
  organ: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.95, release: 0.3 },
  },
  synth: {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
  },
};

// Salamander Grand Piano — same sample set as AudioBridge (served from browser cache).
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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(noteName) {
  const m = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!m) return 60;
  const pc = NOTE_NAMES.indexOf(m[1]);
  return pc + (parseInt(m[2], 10) + 1) * 12;
}

export class LoopPedal {
  /**
   * @param {object} opts
   * @param {() => number}      opts.getBpm
   * @param {HTMLCanvasElement} opts.pianoRollCanvas
   * @param {HTMLCanvasElement} opts.barVizCanvas
   * @param {HTMLElement}       opts.statusEl
   * @param {HTMLElement}       opts.lengthEl
   * @param {HTMLInputElement}  opts.quantizeCheckbox
   * @param {HTMLSelectElement} [opts.inputSourceEl]  keyboard | microphone
   * @param {object}            opts.buttons  { record, stopRec, overdub, play,
   *                                            clearL1, clearL2, clearL3, clearAll, saveAsBlock }
   * @param {() => void}        [opts.onTakeoverTransport]
   */
  constructor({ getBpm, pianoRollCanvas, barVizCanvas, statusEl, lengthEl,
                quantizeCheckbox, inputSourceEl, buttons, onTakeoverTransport }) {
    this.getBpm = getBpm;
    this._pianoRollCanvas  = pianoRollCanvas;
    this._barVizCanvas     = barVizCanvas;
    this._statusEl         = statusEl;
    this._lengthEl         = lengthEl;
    this._quantizeCheckbox = quantizeCheckbox;
    this._inputSourceEl    = inputSourceEl || null;
    this._buttons          = buttons;
    this._onTakeoverTransport = onTakeoverTransport || null;

    // Public loop data (keyboard notes + audio buffers for mic layers)
    this.layers      = [[], [], []];      // each: [{note, startTime, duration, instrument}]
    this._layerAudio = [null, null, null]; // AudioBuffer | null per layer
    this.loopLength  = null;               // seconds

    // State machine
    this.state = 'idle'; // idle | recording1 | playing | overdubbing | paused

    // Recording internals
    this._recordStart       = null;
    this._overdubAudioStart = null;
    this._overdubOffset     = 0;
    this._overdubLayerIdx   = 1;   // which layer index overdub currently targets
    this._activeNotes       = new Map();

    // Mic recording
    this._micStream     = null;
    this._mediaRecorder = null;
    this._micChunks     = [];

    // Playback internals
    this._synths      = {};
    this._toneReady   = false;
    this._loopPart    = null;
    this._players     = [];  // [{ layerIdx, player }] for Tone.Player mic layers
    this._playheadRaf = null;

    // Keyboard shortcuts
    this._shortcutsEnabled = true;
    this._keyListener = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._keyListener);

    this._redraw();
  }

  // ── Input source ──────────────────────────────────────────────────────────

  _isMicMode() {
    return this._inputSourceEl && this._inputSourceEl.value === 'microphone';
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  /** Disable (false) or re-enable (true) keyboard shortcuts 1/2/3.
   *  Called by studio.js to suppress shortcuts while a modal is open. */
  setShortcutsEnabled(v) { this._shortcutsEnabled = v; }

  _onKeyDown(e) {
    if (e.repeat) return;
    if (!this._shortcutsEnabled) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (e.key === '1') this.startRecording();
    else if (e.key === '2') this.startOverdub();
    else if (e.key === '3') this.togglePlayback();
  }

  // ── Tone.js init ─────────────────────────────────────────────────────────

  async _ensureTone() {
    if (this._toneReady) return;
    await Tone.start();

    // Piano: Salamander Grand Piano sampler. Files are already cached by AudioBridge.
    this._synths.piano = new Tone.Sampler({
      urls:    SALAMANDER_URLS,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1,
      volume:  -8,
    }).toDestination();

    // Organ and Synth: PolySynth (unchanged)
    for (const [name, opts] of Object.entries(SYNTH_OPTIONS)) {
      this._synths[name] = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        volume: -8,
        ...opts,
      }).toDestination();
    }
    this._toneReady = true;
  }

  // ── Mic recording ─────────────────────────────────────────────────────────

  /** Request mic access and start MediaRecorder. Returns true on success. */
  async _startMicRecording() {
    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone access in your browser settings and try again.'
        : `Could not access microphone: ${err.message}`;
      alert(msg);
      return false;
    }

    this._micChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';
    this._mediaRecorder = new MediaRecorder(this._micStream, mimeType ? { mimeType } : {});
    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this._micChunks.push(e.data);
    };
    this._mediaRecorder.start();
    return true;
  }

  /** Stop MediaRecorder and decode recorded audio. Returns AudioBuffer or null. */
  _stopMicRecording() {
    return new Promise((resolve) => {
      if (!this._mediaRecorder || this._mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      const mimeType = this._mediaRecorder.mimeType || 'audio/webm';

      this._mediaRecorder.onstop = async () => {
        let audioBuffer = null;
        try {
          if (this._micChunks.length > 0) {
            const blob        = new Blob(this._micChunks, { type: mimeType });
            const arrayBuffer = await blob.arrayBuffer();
            // Use Tone.js's underlying AudioContext for decoding
            const audioCtx = Tone.context.rawContext || Tone.context;
            audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          }
        } catch (err) {
          console.warn('[LoopPedal] Failed to decode mic audio:', err);
        }
        if (this._micStream) {
          this._micStream.getTracks().forEach(t => t.stop());
          this._micStream = null;
        }
        this._mediaRecorder = null;
        this._micChunks     = [];
        resolve(audioBuffer);
      };

      try { this._mediaRecorder.stop(); } catch (_) { resolve(null); }
    });
  }

  /** Cancel an in-progress mic recording without keeping the data. */
  _cancelMicRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.onstop = null; // discard
      try { this._mediaRecorder.stop(); } catch (_) {}
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
    this._mediaRecorder = null;
    this._micChunks     = [];
  }

  // ── Piano event hooks (called from studio.js) ─────────────────────────────

  onNoteOn(noteName, instrumentType) {
    if (this._isMicMode()) return; // keyboard notes ignored in mic mode
    if (this.state === 'recording1') {
      const startTime = Tone.now() - this._recordStart;
      this._activeNotes.set(noteName, { startTime, instrument: instrumentType, _audioNoteOn: Tone.now() });
    } else if (this.state === 'overdubbing') {
      const elapsed   = Tone.now() - this._overdubAudioStart;
      const startTime = (this._overdubOffset + elapsed) % this.loopLength;
      this._activeNotes.set(noteName, { startTime, instrument: instrumentType, _audioNoteOn: Tone.now() });
    }
  }

  onNoteOff(noteName) {
    if (this.state !== 'recording1' && this.state !== 'overdubbing') return;
    if (this._isMicMode()) return;
    const rec = this._activeNotes.get(noteName);
    if (!rec) return;
    this._activeNotes.delete(noteName);

    const duration = Tone.now() - rec._audioNoteOn;
    if (duration < 0.02) return; // filter accidental taps

    const layerIdx = this.state === 'recording1' ? 0 : this._overdubLayerIdx;
    const maxDur   = this.loopLength ? this.loopLength - rec.startTime : Infinity;
    this.layers[layerIdx].push({
      note:       noteName,
      startTime:  rec.startTime,
      duration:   Math.min(duration, maxDur > 0 ? maxDur : duration),
      instrument: rec.instrument,
    });
    this._redraw();
  }

  // ── Transport controls ────────────────────────────────────────────────────

  async startRecording() {
    if (this.state !== 'idle') return;
    await this._ensureTone();

    this.layers      = [[], [], []];
    this._layerAudio = [null, null, null];
    this.loopLength  = null;
    this._activeNotes.clear();
    this._overdubLayerIdx = 1;

    if (this._isMicMode()) {
      const ok = await this._startMicRecording();
      if (!ok) return;
    }

    this._recordStart = Tone.now();
    this.state = 'recording1';
    this._updateUI();
    this._redraw();
  }

  async stopRecording() {
    if (this.state === 'recording1') {
      const raw = Tone.now() - this._recordStart; // measure BEFORE async decode
      if (this._isMicMode()) {
        const audioBuffer = await this._stopMicRecording();
        if (audioBuffer) this._layerAudio[0] = audioBuffer;
      } else {
        this._finalizeLayer(0);
      }
      this.loopLength = this._quantize(Math.max(raw, 0.1));
      this.state = 'playing';
      this._startPlayback();
    } else if (this.state === 'overdubbing') {
      const li = this._overdubLayerIdx;
      if (this._isMicMode()) {
        const audioBuffer = await this._stopMicRecording();
        if (audioBuffer) this._layerAudio[li] = audioBuffer;
      } else {
        this._finalizeOverdub(li);
      }
      this.state = 'playing';
      this._rebuildPart();
    }
    this._updateUI();
    this._redraw();
  }

  async startOverdub() {
    if (this.state !== 'playing') return;
    // Target L2 if empty, otherwise always target L3 (overwrite)
    const targetIdx = (this.layers[1].length === 0 && !this._layerAudio[1]) ? 1 : 2;
    this._overdubLayerIdx = targetIdx;
    this.layers[targetIdx]      = [];
    this._layerAudio[targetIdx] = null;
    // Stop any existing player for that layer so old audio doesn't overlap
    this._disposeLayerPlayer(targetIdx);

    if (this._isMicMode()) {
      const ok = await this._startMicRecording();
      if (!ok) return;
    }

    this._overdubAudioStart = Tone.now();
    const rawPos = Tone.Transport.seconds % this.loopLength;
    this._overdubOffset = rawPos < 0 ? 0 : rawPos;
    this._activeNotes.clear();
    this.state = 'overdubbing';
    this._updateUI();
  }

  async togglePlayback() {
    if (this.state === 'playing' || this.state === 'overdubbing') {
      if (this.state === 'overdubbing') {
        const li = this._overdubLayerIdx;
        if (this._mediaRecorder) {
          // Finalize mic overdub asynchronously
          const audioBuffer = await this._stopMicRecording();
          if (audioBuffer) this._layerAudio[li] = audioBuffer;
        } else {
          this._finalizeOverdub(li);
        }
        this._rebuildPart();
      }
      this._stopPlayback();
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this._startPlayback();
    }
    this._updateUI();
  }

  /** Called by studio.js when Blockly music takes the Transport. */
  notifyTransportTakeover() {
    if (this.state === 'playing' || this.state === 'overdubbing') {
      if (this.state === 'overdubbing') {
        this._cancelMicRecording();
        this._finalizeOverdub(this._overdubLayerIdx);
      }
      this._clearPart(); // relinquish part without stopping Transport
      this.state = 'paused';
      this._updateUI();
      this._redraw();
    }
  }

  clearLayer(idx) {
    this.layers[idx]      = [];
    this._layerAudio[idx] = null;
    if (this.state === 'playing') this._rebuildPart(); // _clearPart inside disposes player
    this._redraw();
    this._updateUI();
  }

  clearAll() {
    this._cancelMicRecording();
    this._stopPlayback();
    this.layers      = [[], [], []];
    this._layerAudio = [null, null, null];
    this.loopLength  = null;
    this._activeNotes.clear();
    this._overdubLayerIdx = 1;
    this.state = 'idle';
    this._updateUI();
    this._redraw();
  }

  // ── Recording helpers ─────────────────────────────────────────────────────

  _finalizeLayer(idx) {
    for (const [noteName, rec] of this._activeNotes) {
      const duration = Tone.now() - rec._audioNoteOn;
      if (duration >= 0.02) {
        this.layers[idx].push({ note: noteName, startTime: rec.startTime, duration, instrument: rec.instrument });
      }
    }
    this._activeNotes.clear();
  }

  _finalizeOverdub(layerIdx) {
    for (const [noteName, rec] of this._activeNotes) {
      const duration = Tone.now() - rec._audioNoteOn;
      if (duration >= 0.02) {
        const maxDur = this.loopLength - rec.startTime;
        this.layers[layerIdx].push({
          note: noteName, startTime: rec.startTime,
          duration: Math.min(duration, maxDur > 0 ? maxDur : duration),
          instrument: rec.instrument,
        });
      }
    }
    this._activeNotes.clear();
  }

  _quantize(rawLen) {
    if (!this._quantizeCheckbox || !this._quantizeCheckbox.checked) return rawLen;
    const barLen = (60 / this.getBpm()) * 4;
    return Math.max(barLen, Math.ceil(rawLen / barLen) * barLen);
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  _startPlayback() {
    this._clearPart();

    // Notify studio.js so it can pause any running Blockly music
    if (this._onTakeoverTransport) this._onTakeoverTransport();

    // Take ownership of the Transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.loop     = false;
    Tone.Transport.position = 0;

    const startAt = Tone.now() + 0.05;
    this._buildAndStartPart(startAt, 0);
    Tone.Transport.start(startAt);
    this._animatePlayhead();
  }

  _buildAndStartPart(micStartAt, micBufferOffset) {
    // Keyboard layers → Tone.Part
    const events = [];
    for (let li = 0; li < NUM_LAYERS; li++) {
      for (const ev of this.layers[li]) {
        events.push([ev.startTime, ev]);
      }
    }
    if (events.length > 0) {
      this._loopPart = new Tone.Part((time, ev) => {
        const synth = this._synths[ev.instrument] || this._synths.piano;
        synth.triggerAttackRelease(ev.note, ev.duration, time);
      }, events);
      this._loopPart.loop    = true;
      this._loopPart.loopEnd = this.loopLength;
      this._loopPart.start(0);
    }

    // Mic layers → Tone.Player synced to Transport
    for (let li = 0; li < NUM_LAYERS; li++) {
      if (!this._layerAudio[li]) continue;
      try {
        const player = new Tone.Player(this._layerAudio[li]).toDestination();
        player.loop    = true;
        player.loopEnd = Math.min(this.loopLength, player.buffer.duration);
        player.start(micStartAt, micBufferOffset);
        this._players.push({ layerIdx: li, player });
      } catch (err) {
        console.warn('[LoopPedal] Failed to create player for layer', li, err);
      }
    }
  }

  /** Dispose the Tone.Player associated with a specific layer index, if any. */
  _disposeLayerPlayer(layerIdx) {
    const idx = this._players.findIndex(p => p.layerIdx === layerIdx);
    if (idx !== -1) {
      const { player } = this._players[idx];
      try { player.stop(); player.unsync(); player.dispose(); } catch (_) {}
      this._players.splice(idx, 1);
    }
  }

  /** Rebuild Part mid-playback (after overdub finalize or clear layer). */
  _rebuildPart() {
    const offset = Math.max(0, Tone.Transport.seconds % this.loopLength);
    this._clearPart();
    this._buildAndStartPart(Tone.now() + 0.01, offset);
    this._animatePlayhead();
  }

  _clearPart() {
    if (this._loopPart) {
      try { this._loopPart.stop(); this._loopPart.dispose(); } catch (_) {}
      this._loopPart = null;
    }
    for (const { player } of this._players) {
      try { player.stop(); player.unsync(); player.dispose(); } catch (_) {}
    }
    this._players = [];
    // Release any notes still sounding in the PolySynths whose scheduled
    // release callbacks were cancelled along with the Part.
    for (const synth of Object.values(this._synths)) {
      try { synth.releaseAll(); } catch (_) {}
    }
    if (this._playheadRaf !== null) {
      cancelAnimationFrame(this._playheadRaf);
      this._playheadRaf = null;
    }
  }

  _stopPlayback() {
    this._clearPart();
    for (const synth of Object.values(this._synths)) {
      try { synth.releaseAll(); } catch (_) {}
    }
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}
    this._redraw();
  }

  _animatePlayhead() {
    const tick = () => {
      if (this.state !== 'playing' && this.state !== 'overdubbing') return;
      this._redraw();
      this._playheadRaf = requestAnimationFrame(tick);
    };
    this._playheadRaf = requestAnimationFrame(tick);
  }

  /** Returns 0–1 fraction of current playhead position in the loop. */
  _playheadFrac() {
    if (!this.loopLength || Tone.Transport.state !== 'started') return null;
    const pos = Tone.Transport.seconds % this.loopLength;
    return Math.max(0, pos) / this.loopLength;
  }

  // ── Visualization ─────────────────────────────────────────────────────────

  _redraw() {
    this._drawPianoRoll();
    this._drawBarViz();
  }

  /**
   * Draw a peak waveform for an AudioBuffer centered vertically in [x, y, w, h].
   * Each pixel column shows the peak amplitude in the corresponding audio slice.
   */
  _drawWaveform(ctx, audioBuffer, x, y, w, h, color) {
    const channelData  = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    if (totalSamples === 0 || w <= 0) return;

    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.70;

    for (let px = 0; px < w; px++) {
      const s0 = Math.floor((px / w) * totalSamples);
      const s1 = Math.min(totalSamples, Math.floor(((px + 1) / w) * totalSamples));
      let peak = 0;
      for (let i = s0; i < s1; i++) {
        const a = Math.abs(channelData[i]);
        if (a > peak) peak = a;
      }
      const barH = Math.max(1, Math.round(peak * h));
      ctx.fillRect(x + px, y + Math.round((h - barH) / 2), 1, barH);
    }
    ctx.globalAlpha = 1;
  }

  _drawPianoRoll() {
    const canvas = this._pianoRollCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, W, H);

    const totalLen = this.loopLength || 4;

    // Quarter-note grid lines
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth   = 1;
    for (let t = 0.25; t < 1; t += 0.25) {
      const x = Math.round(t * W) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Calculate pitch range across all keyboard layers
    const keyboardNotes = [];
    for (let li = 0; li < NUM_LAYERS; li++) {
      if (!this._layerAudio[li]) keyboardNotes.push(...this.layers[li]);
    }
    let lo = 48, hi = 72, span = 24, rowH = 4; // safe defaults
    if (keyboardNotes.length > 0) {
      const midis = keyboardNotes.map(e => noteToMidi(e.note));
      lo   = Math.min(...midis) - 1;
      hi   = Math.max(...midis) + 1;
      span = Math.max(hi - lo, 8);
      rowH = Math.max(2, Math.floor(H / span) - 1);
    }

    for (let li = 0; li < NUM_LAYERS; li++) {
      if (this._layerAudio[li]) {
        // Mic layer — draw waveform spanning the full canvas height
        this._drawWaveform(ctx, this._layerAudio[li], 0, 0, W, H, LAYER_COLORS[li]);
      } else if (this.layers[li].length > 0) {
        // Keyboard layer — note rectangles
        ctx.fillStyle   = LAYER_COLORS[li];
        ctx.globalAlpha = 0.85;
        for (const ev of this.layers[li]) {
          const x     = Math.floor((ev.startTime / totalLen) * W);
          const w     = Math.max(2, Math.floor((ev.duration / totalLen) * W));
          const yFrac = (noteToMidi(ev.note) - lo) / span;
          const y     = H - Math.round(yFrac * H) - rowH;
          ctx.fillRect(x, Math.max(0, y), w, rowH);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Playhead
    const ph = this._playheadFrac();
    if (ph !== null) {
      const x = Math.round(ph * W) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
  }

  _drawBarViz() {
    const canvas = this._barVizCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = '#181825';
    ctx.fillRect(0, 0, W, H);

    const LABEL_W  = 24;
    const trackW   = W - LABEL_W;
    const totalLen = this.loopLength || 4;
    const gap      = 3;
    const lh       = Math.floor((H - gap * (NUM_LAYERS + 1)) / NUM_LAYERS);

    for (let li = 0; li < NUM_LAYERS; li++) {
      const y = gap + li * (lh + gap);

      // Track background
      ctx.fillStyle = '#2a2a3e';
      ctx.fillRect(LABEL_W, y, trackW, lh);

      // Layer label
      ctx.fillStyle    = LAYER_COLORS[li];
      ctx.font         = 'bold 9px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`L${li + 1}`, 4, y + lh / 2);

      if (this._layerAudio[li]) {
        // Mic layer — waveform in the track band
        this._drawWaveform(ctx, this._layerAudio[li], LABEL_W, y + 2, trackW, lh - 4, LAYER_COLORS[li]);
      } else {
        // Keyboard layer — note bars
        ctx.globalAlpha = 0.75;
        for (const ev of this.layers[li]) {
          const x = LABEL_W + Math.floor((ev.startTime / totalLen) * trackW);
          const w = Math.max(2, Math.floor((ev.duration / totalLen) * trackW));
          ctx.fillStyle = LAYER_COLORS[li];
          ctx.fillRect(x, y + 2, w, lh - 4);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Playhead
    const ph = this._playheadFrac();
    if (ph !== null) {
      const x = Math.round(LABEL_W + ph * trackW) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
  }

  // ── UI state ──────────────────────────────────────────────────────────────

  _updateUI() {
    const s = this.state;
    const b = this._buttons;

    b.record.disabled   = s !== 'idle';
    b.stopRec.disabled  = s !== 'recording1' && s !== 'overdubbing';
    b.overdub.disabled  = s !== 'playing';
    b.play.disabled     = s === 'idle' || s === 'recording1';
    b.clearL1.disabled  = s === 'idle' || s === 'recording1';
    b.clearL2.disabled  = s === 'idle' || s === 'recording1';
    b.clearAll.disabled = s === 'idle';

    if (b.clearL3) b.clearL3.disabled = s === 'idle' || s === 'recording1';

    if (b.saveAsBlock) {
      const hasAnyContent = this.layers.some(l => l.length > 0) || this._layerAudio.some(a => a !== null);
      b.saveAsBlock.disabled = !hasAnyContent || s === 'recording1';
    }

    // Play/Stop button text toggles
    b.play.textContent = (s === 'paused') ? '▶ Play [3]' : '■ Stop [3]';

    // Active class for recording state (blinking animation)
    b.record.classList.toggle('active', s === 'recording1');
    b.overdub.classList.toggle('active', s === 'overdubbing');

    // Overdub button shows which layer it will target
    if (s === 'overdubbing') {
      b.overdub.textContent = `⊕ Overdubbing L${this._overdubLayerIdx + 1}…`;
    } else {
      const nextOverdubLayer = (this.layers[1].length === 0 && !this._layerAudio[1]) ? 2 : 3;
      b.overdub.textContent = `⊕ Overdub L${nextOverdubLayer} [2]`;
    }

    // Status label
    const inputMode = this._isMicMode() ? '🎤 mic' : '⌨️ keys';
    const STATUS = {
      idle:       'Ready — press Record [1] to start',
      recording1: `⏺ Recording L1 (${inputMode})…`,
      playing:    '▶ Playing',
      overdubbing:`⏺ Overdubbing L${this._overdubLayerIdx + 1} (${inputMode})…`,
      paused:     '⏸ Paused',
    };
    if (this._statusEl) this._statusEl.textContent = STATUS[s] || s;

    // Loop length display
    if (this._lengthEl) {
      if (this.loopLength) {
        const bpm  = this.getBpm();
        const bars = this.loopLength / ((60 / bpm) * 4);
        this._lengthEl.textContent = `${this.loopLength.toFixed(2)}s · ${bars.toFixed(1)} bar${bars === 1 ? '' : 's'}`;
      } else {
        this._lengthEl.textContent = '';
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    document.removeEventListener('keydown', this._keyListener);
    this._cancelMicRecording();
    this._stopPlayback();
    for (const synth of Object.values(this._synths)) {
      try { synth.dispose(); } catch (_) {}
    }
    this._synths = {};
  }
}
