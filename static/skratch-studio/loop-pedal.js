// loop-pedal.js — Phase 1 Loop Pedal: records keyboard notes in 2 layers,
// plays them back via Tone.Part (Tone.Transport-based, sample-accurate).
//
// Data model: layers[n] = [{note, startTime, duration, instrument}]
//   startTime, duration: seconds relative to loop start.
//   instrument: 'piano' | 'organ' | 'synth' (selected at time of recording).
//
// State machine: idle → recording1 → playing ↔ overdubbing / paused

const LAYER_COLORS = ['#a29bfe', '#fd79a8']; // L1 purple, L2 pink

// Synth options mirror AudioBridge SOUND_PRESETS (no complex effects — loop
// playback synths are independent of the live keyboard synths).
const SYNTH_OPTIONS = {
  piano: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.6 },
  },
  organ: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.95, release: 0.3 },
  },
  synth: {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
  },
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
   * @param {() => number}    opts.getBpm
   * @param {HTMLCanvasElement} opts.pianoRollCanvas
   * @param {HTMLCanvasElement} opts.barVizCanvas
   * @param {HTMLElement}       opts.statusEl
   * @param {HTMLElement}       opts.lengthEl
   * @param {HTMLInputElement}  opts.quantizeCheckbox
   * @param {object}            opts.buttons  { record, stopRec, overdub, play, clearL1, clearL2, clearAll }
   * @param {() => void}        [opts.onTakeoverTransport]  called when loop pedal takes the Transport
   */
  constructor({ getBpm, pianoRollCanvas, barVizCanvas, statusEl, lengthEl,
                quantizeCheckbox, buttons, onTakeoverTransport }) {
    this.getBpm = getBpm;
    this._pianoRollCanvas = pianoRollCanvas;
    this._barVizCanvas    = barVizCanvas;
    this._statusEl        = statusEl;
    this._lengthEl        = lengthEl;
    this._quantizeCheckbox = quantizeCheckbox;
    this._buttons         = buttons;
    this._onTakeoverTransport = onTakeoverTransport || null;

    // Public loop data (for future "Save as Block" integration)
    this.layers     = [[], []]; // each: [{note, startTime, duration, instrument}]
    this.loopLength = null;     // seconds

    // State machine
    this.state = 'idle'; // idle | recording1 | playing | overdubbing | paused

    // Recording internals
    this._recordStart      = null;  // Tone.now() when layer-1 recording started
    this._overdubAudioStart = null; // Tone.now() when overdub started
    this._overdubOffset    = 0;     // loop-phase (sec) when overdub started
    this._activeNotes      = new Map(); // noteName -> { startTime, instrument, _audioNoteOn }

    // Playback internals
    this._synths    = {};
    this._toneReady = false;
    this._loopPart  = null;
    this._playheadRaf = null;

    // Keyboard shortcuts
    this._keyListener = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._keyListener);

    this._redraw();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.repeat) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === '1') this.startRecording();
    else if (e.key === '2') this.startOverdub();
    else if (e.key === '3') this.togglePlayback();
  }

  // ── Tone.js init ─────────────────────────────────────────────────────────

  async _ensureTone() {
    if (this._toneReady) return;
    await Tone.start();
    for (const [name, opts] of Object.entries(SYNTH_OPTIONS)) {
      this._synths[name] = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        volume: -8,
        ...opts,
      }).toDestination();
    }
    this._toneReady = true;
  }

  // ── Piano event hooks (called from studio.js) ─────────────────────────────

  onNoteOn(noteName, instrumentType) {
    if (this.state === 'recording1') {
      const startTime = Tone.now() - this._recordStart;
      this._activeNotes.set(noteName, { startTime, instrument: instrumentType, _audioNoteOn: Tone.now() });
    } else if (this.state === 'overdubbing') {
      const elapsed  = Tone.now() - this._overdubAudioStart;
      const startTime = (this._overdubOffset + elapsed) % this.loopLength;
      this._activeNotes.set(noteName, { startTime, instrument: instrumentType, _audioNoteOn: Tone.now() });
    }
  }

  onNoteOff(noteName) {
    if (this.state !== 'recording1' && this.state !== 'overdubbing') return;
    const rec = this._activeNotes.get(noteName);
    if (!rec) return;
    this._activeNotes.delete(noteName);

    const duration = Tone.now() - rec._audioNoteOn;
    if (duration < 0.02) return; // filter accidental taps

    const layerIdx = this.state === 'recording1' ? 0 : 1;
    const maxDur   = this.loopLength ? this.loopLength - rec.startTime : Infinity;
    this.layers[layerIdx].push({
      note:      noteName,
      startTime: rec.startTime,
      duration:  Math.min(duration, maxDur > 0 ? maxDur : duration),
      instrument: rec.instrument,
    });
    this._redraw();
  }

  // ── Transport controls ────────────────────────────────────────────────────

  async startRecording() {
    if (this.state !== 'idle') return;
    await this._ensureTone();
    this.layers    = [[], []];
    this.loopLength = null;
    this._activeNotes.clear();
    this._recordStart = Tone.now();
    this.state = 'recording1';
    this._updateUI();
    this._redraw();
  }

  stopRecording() {
    if (this.state === 'recording1') {
      this._finalizeLayer(0);
      const raw = Tone.now() - this._recordStart;
      this.loopLength = this._quantize(Math.max(raw, 0.1));
      this.state = 'playing';
      this._startPlayback();
    } else if (this.state === 'overdubbing') {
      this._finalizeOverdub();
      this.state = 'playing';
      // Rebuild the Part to include newly finished layer-2 events
      this._rebuildPart();
    }
    this._updateUI();
    this._redraw();
  }

  async startOverdub() {
    if (this.state !== 'playing') return;
    this.layers[1] = [];
    this._overdubAudioStart = Tone.now();
    const rawPos = Tone.Transport.seconds % this.loopLength;
    this._overdubOffset = rawPos < 0 ? 0 : rawPos;
    this._activeNotes.clear();
    this.state = 'overdubbing';
    this._updateUI();
  }

  togglePlayback() {
    if (this.state === 'playing' || this.state === 'overdubbing') {
      if (this.state === 'overdubbing') {
        this._finalizeOverdub();
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
      if (this.state === 'overdubbing') this._finalizeOverdub();
      this._clearPart(); // relinquish part without stopping Transport
      this.state = 'paused';
      this._updateUI();
      this._redraw();
    }
  }

  clearLayer(idx) {
    this.layers[idx] = [];
    if (this.state === 'playing') this._rebuildPart();
    this._redraw();
    this._updateUI();
  }

  clearAll() {
    this._stopPlayback();
    this.layers    = [[], []];
    this.loopLength = null;
    this._activeNotes.clear();
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

  _finalizeOverdub() {
    for (const [noteName, rec] of this._activeNotes) {
      const duration = Tone.now() - rec._audioNoteOn;
      if (duration >= 0.02) {
        const maxDur = this.loopLength - rec.startTime;
        this.layers[1].push({
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

    this._buildAndStartPart();
    Tone.Transport.start();
    this._animatePlayhead();
  }

  _buildAndStartPart() {
    const events = [];
    for (let li = 0; li < 2; li++) {
      for (const ev of this.layers[li]) {
        events.push([ev.startTime, ev]);
      }
    }
    if (events.length === 0) return;

    this._loopPart = new Tone.Part((time, ev) => {
      const synth = this._synths[ev.instrument] || this._synths.piano;
      synth.triggerAttackRelease(ev.note, ev.duration, time);
    }, events);

    this._loopPart.loop    = true;
    this._loopPart.loopEnd = this.loopLength;
    this._loopPart.start(0);
  }

  /** Rebuild Part mid-playback (after overdub finalize or clear layer). */
  _rebuildPart() {
    const pos = Tone.Transport.seconds; // current position in transport
    this._clearPart();
    this._buildAndStartPart();
    // Transport keeps running; Part picks up on next iteration from pos
    // (Tone.Part.start(0) replays from next loop start — acceptable for Phase 1)
  }

  _clearPart() {
    if (this._loopPart) {
      try { this._loopPart.stop(); this._loopPart.dispose(); } catch (_) {}
      this._loopPart = null;
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

    const all = [...this.layers[0], ...this.layers[1]];
    if (all.length === 0) return;

    const midis = all.map(e => noteToMidi(e.note));
    const lo    = Math.min(...midis) - 1;
    const hi    = Math.max(...midis) + 1;
    const span  = Math.max(hi - lo, 8);
    const rowH  = Math.max(2, Math.floor(H / span) - 1);

    for (let li = 0; li < 2; li++) {
      ctx.fillStyle  = LAYER_COLORS[li];
      ctx.globalAlpha = 0.85;
      for (const ev of this.layers[li]) {
        const x = Math.floor((ev.startTime / totalLen) * W);
        const w = Math.max(2, Math.floor((ev.duration / totalLen) * W));
        const yFrac = (noteToMidi(ev.note) - lo) / span;
        const y = H - Math.round(yFrac * H) - rowH;
        ctx.fillRect(x, Math.max(0, y), w, rowH);
      }
    }
    ctx.globalAlpha = 1;

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

    const LABEL_W = 24;
    const trackW  = W - LABEL_W;
    const totalLen = this.loopLength || 4;
    const lh = Math.floor((H - 6) / 2);

    for (let li = 0; li < 2; li++) {
      const y = 3 + li * (lh + 3);

      // Track background
      ctx.fillStyle = '#2a2a3e';
      ctx.fillRect(LABEL_W, y, trackW, lh);

      // Layer label
      ctx.fillStyle    = LAYER_COLORS[li];
      ctx.font         = 'bold 9px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`L${li + 1}`, 4, y + lh / 2);

      // Note bars
      ctx.globalAlpha = 0.75;
      for (const ev of this.layers[li]) {
        const x = LABEL_W + Math.floor((ev.startTime / totalLen) * trackW);
        const w = Math.max(2, Math.floor((ev.duration / totalLen) * trackW));
        ctx.fillStyle = LAYER_COLORS[li];
        ctx.fillRect(x, y + 2, w, lh - 4);
      }
      ctx.globalAlpha = 1;
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

    b.record.disabled  = s !== 'idle';
    b.stopRec.disabled = s !== 'recording1' && s !== 'overdubbing';
    b.overdub.disabled = s !== 'playing';
    b.play.disabled    = s === 'idle' || s === 'recording1';
    b.clearL1.disabled = s === 'idle' || s === 'recording1';
    b.clearL2.disabled = s === 'idle' || s === 'recording1';
    b.clearAll.disabled = s === 'idle';

    // Play/Stop button text toggles
    b.play.textContent = (s === 'paused') ? '▶ Play [3]' : '■ Stop [3]';

    // Active class for recording state (blinking animation)
    b.record.classList.toggle('active', s === 'recording1');
    b.overdub.classList.toggle('active', s === 'overdubbing');

    // Status label
    const STATUS = {
      idle:       'Ready — press Record [1] to start',
      recording1: '⏺ Recording L1...',
      playing:    '▶ Playing',
      overdubbing:'⏺ Overdubbing L2...',
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
    this._stopPlayback();
    for (const synth of Object.values(this._synths)) {
      try { synth.dispose(); } catch (_) {}
    }
    this._synths = {};
  }
}
