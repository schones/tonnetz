/**
 * ch1-sound.js — Chapter 1: Sound & Notes
 * =========================================
 * Four interactive sections introducing sound, pitch, the 12 notes,
 * concert pitch, and the keyboard pattern.
 *
 * Audio:
 *   - Section 1 uses a Tone.Oscillator (sine wave)
 *   - Sections 2–4 use a Salamander piano sampler (lazy-loaded)
 *
 * All interactive components are mounted lazily via onActivate when
 * the section scrolls into view. Tone.start() is called once on the
 * first user gesture.
 */

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

let _toneStarted = false;
let _oscillator = null;
let _oscillatorGain = null;
let _sampler = null;
let _samplerLoading = false;
let _samplerReady = false;
let _oboeSampler = null;
let _oboeSamplerLoading = false;
let _oboeSamplerReady = false;

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';
const SAMPLER_URLS = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3',
};

/** Note definitions for one octave, C through B. */
const CHROMATIC = [
  { name: 'C',  pc: 0,  isBlack: false },
  { name: 'C♯', pc: 1,  isBlack: true  },
  { name: 'D',  pc: 2,  isBlack: false },
  { name: 'D♯', pc: 3,  isBlack: true  },
  { name: 'E',  pc: 4,  isBlack: false },
  { name: 'F',  pc: 5,  isBlack: false },
  { name: 'F♯', pc: 6,  isBlack: true  },
  { name: 'G',  pc: 7,  isBlack: false },
  { name: 'G♯', pc: 8,  isBlack: true  },
  { name: 'A',  pc: 9,  isBlack: false },
  { name: 'A♯', pc: 10, isBlack: true  },
  { name: 'B',  pc: 11, isBlack: false },
];

/** Frequency of every note for display: A4=440, equal temperament. */
function noteFreq(noteName, octave) {
  const pc = CHROMATIC.find(n => n.name === noteName)?.pc ?? 0;
  // MIDI: C4=60, A4=69
  const midi = (octave + 1) * 12 + pc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Convert sharp unicode to ASCII for Tone.js (C♯ → C#). */
function toAscii(name) {
  return name.replace(/♯/g, '#').replace(/♭/g, 'b');
}

// ════════════════════════════════════════════════════════════════════
// AUDIO HELPERS
// ════════════════════════════════════════════════════════════════════

/** Cached promise so the Tone.js <script> is only injected once. */
let _toneLoadPromise = null;

/**
 * Ensures Tone.js is available globally. If window.Tone already exists,
 * resolves immediately. Otherwise injects a <script> tag and waits for it.
 */
function _ensureToneLoaded() {
  if (window.Tone) return Promise.resolve();
  if (_toneLoadPromise) return _toneLoadPromise;
  _toneLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('[ch1] Failed to load Tone.js'));
    document.head.appendChild(script);
  });
  return _toneLoadPromise;
}

async function _ensureTone() {
  if (_toneStarted) return;
  await _ensureToneLoaded();
  await Tone.start();
  _toneStarted = true;
}

async function _ensureSampler() {
  if (_sampler || _samplerLoading) return;
  _samplerLoading = true;
  await _ensureToneLoaded();
  const vol = new Tone.Volume(-6).toDestination();
  _sampler = new Tone.Sampler({
    urls: SAMPLER_URLS,
    baseUrl: SALAMANDER_BASE,
    release: 1.5,
    onload: () => { _samplerReady = true; },
    onerror: (err) => console.warn('[ch1] Sampler load error:', err),
  }).connect(vol);
}

async function _loadOboeSampler() {
  if (_oboeSampler || _oboeSamplerLoading) return;
  _oboeSamplerLoading = true;
  await _ensureToneLoaded();
  try {
    const resp = await fetch('https://gleitz.github.io/midi-js-soundfonts/MusyngKite/oboe-mp3.js');
    const text = await resp.text();
    // Evaluate the soundfont JS in a controlled scope — sets MIDI.Soundfont.oboe
    const container = {};
    const MIDI = { Soundfont: container };
    // eslint-disable-next-line no-new-func
    new Function('MIDI', text)(MIDI);
    const data = container.oboe || {};
    // Sparse subset — we only play A notes in this module
    const sparseKeys = ['A2', 'A3', 'A4', 'A5', 'A6'];
    const urls = {};
    sparseKeys.forEach(k => { if (data[k]) urls[k] = data[k]; });
    const vol = new Tone.Volume(-6).toDestination();
    _oboeSampler = new Tone.Sampler({
      urls,
      onload: () => { _oboeSamplerReady = true; },
      onerror: (err) => console.warn('[ch1] Oboe sampler error:', err),
    }).connect(vol);
  } catch (err) {
    console.warn('[ch1] Failed to load oboe sampler:', err);
    _oboeSamplerLoading = false;
  }
}

function _playSamplerNote(noteWithOctave, duration) {
  if (!_samplerReady || !_sampler) return;
  _sampler.triggerAttackRelease(noteWithOctave, duration || '4n', Tone.now());
}

function _playSamplerAttack(noteWithOctave) {
  if (!_samplerReady || !_sampler) return;
  _sampler.triggerAttack(noteWithOctave, Tone.now());
}

function _releaseSamplerNote(noteWithOctave) {
  if (!_samplerReady || !_sampler) return;
  _sampler.triggerRelease(noteWithOctave, Tone.now() + 0.3);
}

// ════════════════════════════════════════════════════════════════════
// CSS (injected once)
// ════════════════════════════════════════════════════════════════════

const CH1_CSS = /* css */ `

/* ── Shared interactive styling ────────────────────────────── */

/* Override the dashed placeholder border once real content is mounted */
.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
  border-style: solid;
}

.ch1-widget {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}

.ch1-widget__label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
  letter-spacing: 0.04em;
}

.ch1-freq-display {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #2d3436);
  min-width: 7ch;
  text-align: center;
}

/* ── Section 1: Oscillator ─────────────────────────────────── */

.ch1-osc-canvas {
  width: 100%;
  max-width: 500px;
  height: 120px;
  border-radius: 10px;
  background: var(--bg-primary, #1a1a2e);
  display: block;
}

.ch1-slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 500px;
}

.ch1-slider-row label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted, #b2bec3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.ch1-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--border, #dfe6e9);
  outline: none;
  cursor: pointer;
}

.ch1-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary, #6c5ce7);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
  cursor: grab;
}

.ch1-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary, #6c5ce7);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
  cursor: grab;
}

.ch1-play-btn {
  padding: 8px 20px;
  border: 2px solid var(--color-primary, #6c5ce7);
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary, #6c5ce7);
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}

.ch1-play-btn:hover {
  background: var(--color-primary, #6c5ce7);
  color: #fff;
}

.ch1-play-btn--active {
  background: var(--color-primary, #6c5ce7);
  color: #fff;
}

/* ── Standalone mini-keyboard ──────────────────────────────── */

.ch1-kb {
  position: relative;
  display: inline-flex;
  height: var(--ch1-kb-h, 130px);
  user-select: none;
  -webkit-user-select: none;
}

.ch1-kb-key {
  position: relative;
  border-radius: 0 0 5px 5px;
  box-sizing: border-box;
  transition: background 0.08s, box-shadow 0.08s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.ch1-kb-key--white {
  background: var(--keyboard-white-key-bg, #e8e8f0);
  border: 1px solid var(--color-border, #ccc);
  width: var(--ch1-kb-ww, 38px);
  height: var(--ch1-kb-h, 130px);
  z-index: 1;
}

.ch1-kb-key--black {
  background: var(--keyboard-black-key-bg, #1a1a2e);
  border: 1px solid #000;
  width: var(--ch1-kb-bw, 24px);
  height: calc(var(--ch1-kb-h, 130px) * 0.65);
  margin-left: calc(var(--ch1-kb-bw, 24px) / -2);
  margin-right: calc(var(--ch1-kb-bw, 24px) / -2);
  z-index: 2;
}

.ch1-kb-key--pressed.ch1-kb-key--white,
.ch1-kb-key--active.ch1-kb-key--white {
  background: var(--color-primary, #6c5ce7);
  box-shadow: 0 0 12px rgba(108, 92, 231, 0.5);
}

.ch1-kb-key--pressed.ch1-kb-key--black,
.ch1-kb-key--active.ch1-kb-key--black {
  background: var(--color-primary-light, #a29bfe);
  box-shadow: 0 0 12px rgba(108, 92, 231, 0.5);
}

/* Octave highlight (same-note color) */
.ch1-kb-key--octave-hl.ch1-kb-key--white {
  background: var(--color-secondary, #00cec9);
  box-shadow: inset 0 0 0 2px var(--color-secondary, #00cec9);
}

.ch1-kb-key--octave-hl.ch1-kb-key--black {
  background: var(--color-secondary-light, #81ecec);
  box-shadow: inset 0 0 0 2px var(--color-secondary-light, #81ecec);
}

/* Pattern highlight (keyboard pattern section) */
.ch1-kb-key--pattern-hl.ch1-kb-key--white {
  background: var(--color-accent, #fdcb6e);
  box-shadow: inset 0 0 0 2px var(--color-accent-dark, #f39c12);
}

.ch1-kb-key--group-2.ch1-kb-key--black {
  box-shadow: 0 0 10px rgba(108, 92, 231, 0.6);
}

.ch1-kb-key--group-3.ch1-kb-key--black {
  box-shadow: 0 0 10px rgba(0, 206, 201, 0.6);
}

.ch1-kb-label {
  font-size: 9px;
  font-weight: 700;
  pointer-events: none;
  line-height: 1;
  padding-bottom: 5px;
  opacity: 0;
  transition: opacity 0.12s;
}

.ch1-kb-key--white .ch1-kb-label {
  color: #555;
}

.ch1-kb-key--black .ch1-kb-label {
  color: rgba(220, 220, 230, 0.85);
  padding-bottom: 3px;
}

.ch1-kb-key--show-label .ch1-kb-label,
.ch1-kb-key--active .ch1-kb-label,
.ch1-kb-key--pressed .ch1-kb-label,
.ch1-kb-key--octave-hl .ch1-kb-label,
.ch1-kb-key--pattern-hl .ch1-kb-label {
  opacity: 1;
}

.ch1-kb-key--active .ch1-kb-label,
.ch1-kb-key--pressed .ch1-kb-label {
  color: #fff;
}

.ch1-kb-info {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary, #2d3436);
  text-align: center;
  min-height: 1.5em;
}

/* ── Section 3: A440 buttons ───────────────────────────────── */

.ch1-a440-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.ch1-a440-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 22px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 12px;
  background: var(--bg-secondary, #f0f0f5);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  user-select: none;
}

.ch1-a440-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
  transform: translateY(-2px);
}

.ch1-a440-btn--playing {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
}

.ch1-a440-btn--playing .ch1-a440-note,
.ch1-a440-btn--playing .ch1-a440-freq {
  color: #fff;
}

.ch1-a440-note {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
}

.ch1-a440-freq {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted, #b2bec3);
  font-variant-numeric: tabular-nums;
}

.ch1-a440-explain {
  font-size: 0.82rem;
  color: var(--text-secondary, #636e72);
  text-align: center;
  max-width: 420px;
  line-height: 1.55;
  min-height: 1.5em;
}

/* ── Section 4: Find buttons ───────────────────────────────── */

.ch1-find-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.ch1-find-btn {
  padding: 6px 16px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}

.ch1-find-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
}

.ch1-find-btn--active {
  background: var(--color-accent, #fdcb6e);
  border-color: var(--color-accent-dark, #f39c12);
  color: #2d3436;
}

/* Group brackets above black keys */
.ch1-group-label {
  position: absolute;
  top: -22px;
  font-size: 0.7rem;
  font-weight: 800;
  text-align: center;
  pointer-events: none;
  z-index: 3;
  color: var(--text-muted, #b2bec3);
}

/* ── Keyboard scroll wrapper ──────────────────────────────── */
.ch1-kb-scroll {
  width: 100%;
  max-width: 540px;
  overflow-x: auto;
  display: flex;
  justify-content: center;
  padding: 28px 4px 4px;
}

/* ── A4 concert-pitch pulse animation ──────────────────────── */

@keyframes ch1-a4-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0); }
  50%       { box-shadow: 0 0 0 8px rgba(255, 165, 0, 0.5); }
}

.ch1-kb-key--a4-pulse.ch1-kb-key--white {
  background: #ffeaa7;
  animation: ch1-a4-pulse 1.4s ease-in-out infinite;
}

/* ── Responsive ────────────────────────────────────────────── */

@media (max-width: 480px) {
  .ch1-kb-key--white { width: 30px !important; }
  .ch1-kb-key--black { width: 20px !important; margin-left: -10px; margin-right: -10px; }
  .ch1-kb { height: 110px; }
  .ch1-osc-canvas { height: 90px; }
  .ch1-a440-btn { padding: 10px 16px; }
}
`;

function _injectCSS() {
  if (document.getElementById('ch1-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch1-styles';
  el.textContent = CH1_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// KEYBOARD BUILDER (standalone, no HarmonyState dependency)
// ════════════════════════════════════════════════════════════════════

/**
 * Build a playable mini-keyboard.
 * @param {HTMLElement} container
 * @param {number} startOctave  e.g. 4
 * @param {number} numOctaves   e.g. 1
 * @param {Object} [opts]
 * @param {Function} [opts.onNoteDown]  (noteName, octave, keyEl) => {}
 * @param {Function} [opts.onNoteUp]    (noteName, octave, keyEl) => {}
 * @param {boolean}  [opts.showLabels]  show note names on all keys
 * @returns {{ el: HTMLElement, keys: Map<string, HTMLElement>, cleanup: Function }}
 */
function _buildKeyboard(container, startOctave, numOctaves, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'ch1-kb';

  const keys = new Map(); // "C4" → el
  let pressedKey = null;

  for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
    for (const note of CHROMATIC) {
      const el = document.createElement('div');
      const noteId = `${toAscii(note.name)}${oct}`;
      el.className = `ch1-kb-key ch1-kb-key--${note.isBlack ? 'black' : 'white'}`;
      if (opts.showLabels) el.classList.add('ch1-kb-key--show-label');
      el.dataset.note = noteId;
      el.dataset.noteName = note.name;
      el.dataset.octave = oct;
      el.dataset.pc = note.pc;

      const label = document.createElement('span');
      label.className = 'ch1-kb-label';
      label.textContent = note.name;
      el.appendChild(label);

      // Pointer events
      const down = (e) => {
        e.preventDefault();
        _ensureTone();
        _ensureSampler();
        pressedKey = noteId;
        el.classList.add('ch1-kb-key--pressed');
        _playSamplerAttack(noteId);
        if (opts.onNoteDown) opts.onNoteDown(note.name, oct, el);
      };
      const up = () => {
        if (pressedKey !== noteId) return;
        pressedKey = null;
        el.classList.remove('ch1-kb-key--pressed');
        _releaseSamplerNote(noteId);
        if (opts.onNoteUp) opts.onNoteUp(note.name, oct, el);
      };

      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); up(); });

      keys.set(noteId, el);
      wrap.appendChild(el);
    }
  }

  container.appendChild(wrap);

  return {
    el: wrap,
    keys,
    cleanup: () => { /* no external resources to dispose */ },
  };
}

// ════════════════════════════════════════════════════════════════════
// ACT 1: OSCILLATOR WIDGET STATE + BUILDER
// ════════════════════════════════════════════════════════════════════

let _act1SliderRow = null;
let _act1PlayBtn = null;
let _act1StopOsc = null;

/**
 * Build the oscillator widget into containerEl.
 * Called once by act-sound's mountInteractive.
 */
function _buildOscWidget(containerEl) {
  _injectCSS();
  _ensureToneLoaded(); // preload Tone.js in background

  const widget = document.createElement('div');
  widget.className = 'ch1-widget';
  widget.style.pointerEvents = 'auto';

  // Canvas for waveform (always visible from step 1)
  const canvas = document.createElement('canvas');
  canvas.className = 'ch1-osc-canvas';
  canvas.width = 500;
  canvas.height = 120;

  // Frequency display (shown alongside slider)
  const freqDisplay = document.createElement('div');
  freqDisplay.className = 'ch1-freq-display';
  freqDisplay.textContent = '440 Hz';

  // Slider row — hidden initially, revealed by step 2
  const sliderRow = document.createElement('div');
  sliderRow.className = 'ch1-slider-row';
  sliderRow.style.cssText = 'opacity:0; pointer-events:none; transition:opacity 0.4s ease;';

  const lowLabel = document.createElement('label');
  lowLabel.textContent = '100 Hz';
  const highLabel = document.createElement('label');
  highLabel.textContent = '1000 Hz';

  const slider = document.createElement('input');
  slider.className = 'ch1-slider';
  slider.type = 'range';
  slider.min = '100';
  slider.max = '1000';
  slider.value = '440';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Frequency');

  sliderRow.append(lowLabel, slider, highLabel);
  _act1SliderRow = sliderRow;

  // Play button — hidden initially, revealed by step 2
  const playBtn = document.createElement('button');
  playBtn.className = 'ch1-play-btn';
  playBtn.textContent = '▶ Play tone';
  playBtn.style.cssText = 'opacity:0; pointer-events:none; transition:opacity 0.4s ease;';
  _act1PlayBtn = playBtn;

  widget.append(canvas, freqDisplay, sliderRow, playBtn);
  containerEl.appendChild(widget);

  // ── Audio / animation state ───────────────────────────────────────

  let isPlaying = false;
  let animId = null;
  let currentFreq = 440;

  const ctx = canvas.getContext('2d');
  const accentColor =
    getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() ||
    '#6c5ce7';

  let logW = 500;
  let logH = 120;

  function drawWave() {
    ctx.clearRect(0, 0, logW, logH);
    const cycles = 2 + (currentFreq - 100) / 900 * 8;
    const amplitude = logH * 0.38;
    const midY = logH / 2;
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    for (let x = 0; x <= logW; x++) {
      const t = x / logW;
      const y = midY + Math.sin(t * cycles * Math.PI * 2 + performance.now() * 0.003) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (isPlaying) animId = requestAnimationFrame(drawWave);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, logW, logH);
    const cycles = 2 + (currentFreq - 100) / 900 * 8;
    const amplitude = logH * 0.38;
    const midY = logH / 2;
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.4;
    for (let x = 0; x <= logW; x++) {
      const t = x / logW;
      const y = midY + Math.sin(t * cycles * Math.PI * 2) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  function stopOsc() {
    if (_oscillator) { try { _oscillator.stop(); } catch (_) {} }
    isPlaying = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    playBtn.textContent = '▶ Play tone';
    playBtn.classList.remove('ch1-play-btn--active');
    drawStatic();
  }
  _act1StopOsc = stopOsc;

  function startOsc() {
    _ensureTone().then(() => {
      if (!_oscillator) {
        _oscillatorGain = new Tone.Gain(0.25).toDestination();
        _oscillator = new Tone.Oscillator({ frequency: currentFreq, type: 'sine' })
          .connect(_oscillatorGain);
      }
      _oscillator.frequency.value = currentFreq;
      _oscillator.start();
      isPlaying = true;
      playBtn.textContent = '■ Stop';
      playBtn.classList.add('ch1-play-btn--active');
      drawWave();
    });
  }

  playBtn.addEventListener('click', () => { if (isPlaying) stopOsc(); else startOsc(); });

  slider.addEventListener('input', () => {
    currentFreq = parseInt(slider.value, 10);
    freqDisplay.textContent = `${currentFreq} Hz`;
    if (_oscillator && isPlaying) _oscillator.frequency.value = currentFreq;
    if (!isPlaying) drawStatic();
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    logW = rect.width;
    logH = rect.height;
    if (!isPlaying) drawStatic();
  }

  requestAnimationFrame(() => { resizeCanvas(); drawStatic(); });
  const resizeObs = new ResizeObserver(() => resizeCanvas());
  resizeObs.observe(canvas);
}

// ════════════════════════════════════════════════════════════════════
// ACT 2: NOTES KEYBOARD STATE + BUILDER
// ════════════════════════════════════════════════════════════════════

let _act2KbScrollEl = null;
let _act2KbEl = null;
let _act2Keys = null;
let _act2Info = null;
let _act2OboeRow = null;
let _act2FindRow = null;
let _act2ActiveFind = null;
let _act2KbConfig = null;   // "startOctave-numOctaves" — skip rebuild when same
let _act2ResizePending = false;

function _showAct2Row(rowEl, show) {
  if (!rowEl) return;
  rowEl.style.opacity = show ? '1' : '0';
  rowEl.style.pointerEvents = show ? 'auto' : 'none';
}

function _clearAct2Highlights() {
  if (!_act2Keys) return;
  _act2Keys.forEach(el => {
    el.classList.remove(
      'ch1-kb-key--pattern-hl',
      'ch1-kb-key--octave-hl',
      'ch1-kb-key--show-label',
      'ch1-kb-key--a4-pulse',
    );
  });
}

/**
 * Rebuild the Act 2 keyboard with a 150 ms fade transition.
 * No-ops if the same startOctave/numOctaves config is already built.
 */
async function _resizeAct2Keyboard(startOctave, numOctaves, opts) {
  const configKey = `${startOctave}-${numOctaves}`;
  if (_act2KbConfig === configKey && _act2KbEl) return;
  if (_act2ResizePending) return;

  _act2ResizePending = true;
  _act2KbConfig = configKey;

  try {
    if (_act2KbEl) {
      _act2KbEl.style.transition = 'opacity 0.15s ease';
      _act2KbEl.style.opacity = '0';
      await new Promise(r => setTimeout(r, 160));
      _act2KbEl.remove();
      _act2KbEl = null;
      _act2Keys = null;
    }

    if (_act2KbScrollEl) {
      const result = _buildKeyboard(_act2KbScrollEl, startOctave, numOctaves, opts);
      _act2KbEl = result.el;
      _act2Keys = result.keys;
      _act2KbEl.style.opacity = '0';
      _act2KbEl.style.transition = 'opacity 0.15s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (_act2KbEl) _act2KbEl.style.opacity = '1';
        });
      });
    }
  } finally {
    _act2ResizePending = false;
  }
}

/**
 * Build the full notes widget into containerEl.
 * Called once by act-notes' mountInteractive.
 */
function _buildNotesWidget(containerEl) {
  _injectCSS();
  _ensureSampler();
  _loadOboeSampler();

  const widget = document.createElement('div');
  widget.className = 'ch1-widget';
  widget.style.pointerEvents = 'auto';

  // Info line — stable across keyboard rebuilds
  const info = document.createElement('div');
  info.className = 'ch1-kb-info';
  info.innerHTML = '&nbsp;';
  _act2Info = info;

  // Scroll wrapper for the keyboard (rebuilt per step via _resizeAct2Keyboard)
  const kbScrollEl = document.createElement('div');
  kbScrollEl.className = 'ch1-kb-scroll';
  _act2KbScrollEl = kbScrollEl;

  // ── Oboe A440 row (hidden initially, shown in ch1-concert-pitch) ──

  const oboeRow = document.createElement('div');
  oboeRow.className = 'ch1-widget';
  oboeRow.style.cssText = 'opacity:0; pointer-events:none; transition:opacity 0.4s ease; padding:0; gap:8px;';
  _act2OboeRow = oboeRow;

  const oboeBtnRow = document.createElement('div');
  oboeBtnRow.className = 'ch1-a440-row';

  const oboeExplain = document.createElement('div');
  oboeExplain.className = 'ch1-a440-explain';
  oboeExplain.innerHTML = '&nbsp;';

  let activeOboeBtn = null;
  let activeOboeTimeout = null;

  [
    { note: 'A3', freq: 220, label: 'A3' },
    { note: 'A4', freq: 440, label: 'A4' },
    { note: 'A5', freq: 880, label: 'A5' },
  ].forEach(({ note, freq, label }) => {
    const btn = document.createElement('button');
    btn.className = 'ch1-a440-btn';
    const nameEl = document.createElement('span');
    nameEl.className = 'ch1-a440-note';
    nameEl.textContent = label;
    const freqEl = document.createElement('span');
    freqEl.className = 'ch1-a440-freq';
    freqEl.textContent = `${freq} Hz`;
    btn.append(nameEl, freqEl);
    btn.addEventListener('click', async () => {
      await _ensureTone();
      if (activeOboeBtn) activeOboeBtn.classList.remove('ch1-a440-btn--playing');
      if (activeOboeTimeout) clearTimeout(activeOboeTimeout);
      btn.classList.add('ch1-a440-btn--playing');
      activeOboeBtn = btn;
      activeOboeTimeout = setTimeout(() => {
        btn.classList.remove('ch1-a440-btn--playing');
        activeOboeBtn = null;
      }, 1800);
      if (_oboeSamplerReady && _oboeSampler) {
        _oboeSampler.triggerAttackRelease(note, '2n', Tone.now());
      } else {
        _playSamplerNote(note, '2n');
      }
      if (note === 'A3')      oboeExplain.textContent = 'A3 = 220 Hz — half the frequency of A4';
      else if (note === 'A4') oboeExplain.textContent = 'A4 = 440 Hz — the universal tuning reference';
      else                    oboeExplain.textContent = 'A5 = 880 Hz — double the frequency of A4';
    });
    oboeBtnRow.appendChild(btn);
  });

  const doublingLine = document.createElement('div');
  doublingLine.className = 'ch1-widget__label';
  doublingLine.textContent = 'Each octave doubles the frequency: 220 → 440 → 880';

  oboeRow.append(oboeBtnRow, oboeExplain, doublingLine);

  // ── Find buttons row (hidden initially, shown in ch1-keyboard-pattern) ──

  const findRow = document.createElement('div');
  findRow.className = 'ch1-find-row';
  findRow.style.cssText = 'opacity:0; pointer-events:none; transition:opacity 0.4s ease;';
  _act2FindRow = findRow;

  ['C', 'D', 'E', 'F', 'G', 'A', 'B'].forEach(noteName => {
    const btn = document.createElement('button');
    btn.className = 'ch1-find-btn';
    btn.textContent = noteName;
    btn.addEventListener('click', async () => {
      await _ensureTone();
      if (_act2ActiveFind === noteName) {
        _clearAct2Highlights();
        _act2ActiveFind = null;
        btn.classList.remove('ch1-find-btn--active');
        info.innerHTML = '&nbsp;';
        return;
      }
      findRow.querySelectorAll('.ch1-find-btn--active').forEach(b => b.classList.remove('ch1-find-btn--active'));
      _clearAct2Highlights();
      _act2ActiveFind = noteName;
      btn.classList.add('ch1-find-btn--active');
      const matchingKeys = [];
      if (_act2Keys) {
        _act2Keys.forEach((el, noteId) => {
          if (el.dataset.noteName === noteName) {
            el.classList.add('ch1-kb-key--pattern-hl', 'ch1-kb-key--show-label');
            matchingKeys.push(noteId);
          }
        });
      }
      matchingKeys.forEach((noteId, i) => {
        setTimeout(() => _playSamplerNote(noteId, '8n'), i * 250);
      });
      info.textContent = `Every ${noteName} across 3 octaves`;
    });
    findRow.appendChild(btn);
  });

  widget.append(kbScrollEl, info, oboeRow, findRow);
  containerEl.appendChild(widget);

  // Build initial 1-octave keyboard for step 1
  const result = _buildKeyboard(kbScrollEl, 4, 1, {
    showLabels: true,
    onNoteDown(name, oct) {
      const freq = noteFreq(name, oct).toFixed(1);
      if (_act2Info) _act2Info.textContent = `${name}${oct} = ${freq} Hz`;
    },
  });
  _act2KbEl = result.el;
  _act2Keys = result.keys;
  _act2KbConfig = '4-1';
}

// ════════════════════════════════════════════════════════════════════
// KEYBOARD HELPERS
// ════════════════════════════════════════════════════════════════════

/** Clear all custom highlight classes from a keyboard returned by _buildKeyboard. */
function _clearHighlights(kb) {
  if (!kb?.keys) return;
  kb.keys.forEach(el => {
    el.classList.remove(
      'ch1-kb-key--pattern-hl',
      'ch1-kb-key--octave-hl',
      'ch1-kb-key--show-label',
    );
  });
}

/** Add group-of-2 / group-of-3 glows to black keys. */
function _addGroupBrackets(kb) {
  if (!kb?.keys) return;
  kb.keys.forEach((el) => {
    if (!el.classList.contains('ch1-kb-key--black')) return;
    const pc = parseInt(el.dataset.pc, 10);
    if (pc === 1 || pc === 3) {
      el.classList.add('ch1-kb-key--group-2');
    } else {
      el.classList.add('ch1-kb-key--group-3');
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP (page unload)
// ════════════════════════════════════════════════════════════════════

function _cleanup() {
  if (_oscillator) {
    try { _oscillator.stop(); _oscillator.dispose(); } catch (_) {}
    _oscillator = null;
  }
  if (_oscillatorGain) {
    try { _oscillatorGain.dispose(); } catch (_) {}
    _oscillatorGain = null;
  }
  if (_sampler) {
    try { _sampler.releaseAll(); _sampler.dispose(); } catch (_) {}
    _sampler = null;
    _samplerReady = false;
    _samplerLoading = false;
  }
  if (_oboeSampler) {
    try { _oboeSampler.releaseAll(); _oboeSampler.dispose(); } catch (_) {}
    _oboeSampler = null;
    _oboeSamplerReady = false;
    _oboeSamplerLoading = false;
  }
  _act1SliderRow = null;
  _act1PlayBtn = null;
  _act1StopOsc = null;
  _act2KbScrollEl = null;
  _act2KbEl = null;
  _act2Keys = null;
  _act2Info = null;
  _act2OboeRow = null;
  _act2FindRow = null;
  _act2KbConfig = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', _cleanup);
  // Also handle SPA-style navigation if present
  window.addEventListener('pagehide', _cleanup);
}

// ════════════════════════════════════════════════════════════════════
// CHAPTER META
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 1,
  title: 'Sound & Notes',
  tone: 'playful',
  description: 'What is sound? Meet the 12 notes and the spaces between them.',
};

// ════════════════════════════════════════════════════════════════════
// ACT DEFINITIONS
// ════════════════════════════════════════════════════════════════════

export const acts = [

  // ── Act 1: Sound (oscillator) ────────────────────────────────────
  {
    id: 'act-sound',

    mountInteractive(containerEl) {
      _buildOscWidget(containerEl);
    },

    unmountInteractive() {
      if (_act1StopOsc) _act1StopOsc();
      _act1SliderRow = null;
      _act1PlayBtn = null;
      _act1StopOsc = null;
    },

    steps: [
      {
        id: 'ch1-what-is-sound',
        narration:
          'Tap your desk. Hum. Clap your hands. ' +
          "That's sound — something vibrating, pushing air into your ears. " +
          'The faster it vibrates, the higher it sounds.',
        onEnter(_el) {
          // Show static waveform only; hide slider + play button
          if (_act1SliderRow) {
            _act1SliderRow.style.opacity = '0';
            _act1SliderRow.style.pointerEvents = 'none';
          }
          if (_act1PlayBtn) {
            _act1PlayBtn.style.opacity = '0';
            _act1PlayBtn.style.pointerEvents = 'none';
          }
          if (_act1StopOsc) _act1StopOsc();
        },
        onLeave(_el) {},
        tryIt: null,
      },
      {
        id: 'ch1-oscillator-play',
        narration:
          "That speed has a name: frequency. " +
          'Slow vibrations are low notes. Fast vibrations are high notes. ' +
          "Every pitch you've ever heard is just air wiggling at a particular speed.",
        onEnter(_el) {
          // Reveal frequency slider and play button
          if (_act1SliderRow) {
            _act1SliderRow.style.opacity = '1';
            _act1SliderRow.style.pointerEvents = 'auto';
          }
          if (_act1PlayBtn) {
            _act1PlayBtn.style.opacity = '1';
            _act1PlayBtn.style.pointerEvents = 'auto';
          }
        },
        onLeave(_el) {
          // Stop oscillator when leaving
          if (_act1StopOsc) _act1StopOsc();
        },
        tryIt: 'Drag the slider. Hear how the pitch rises?',
      },
    ],
  },

  // ── Act 2: Notes (evolving keyboard) ────────────────────────────
  {
    id: 'act-notes',

    mountInteractive(containerEl) {
      _buildNotesWidget(containerEl);
    },

    unmountInteractive() {
      if (_sampler) { try { _sampler.releaseAll(); } catch (_) {} }
      _act2KbScrollEl = null;
      _act2KbEl = null;
      _act2Keys = null;
      _act2Info = null;
      _act2OboeRow = null;
      _act2FindRow = null;
      _act2KbConfig = null;
    },

    steps: [
      {
        id: 'ch1-meet-the-notes',
        narration:
          'You could slide through every possible pitch forever. But musicians carved out ' +
          '12 specific pitches that sound particularly good together. ' +
          'These 12 notes repeat over and over — higher and higher — covering the full range of music.',
        async onEnter(_el) {
          await _resizeAct2Keyboard(4, 1, {
            showLabels: true,
            onNoteDown(name, oct) {
              const freq = noteFreq(name, oct).toFixed(1);
              if (_act2Info) _act2Info.textContent = `${name}${oct} = ${freq} Hz`;
            },
          });
          _clearAct2Highlights();
          _showAct2Row(_act2OboeRow, false);
          _showAct2Row(_act2FindRow, false);
          _act2ActiveFind = null;
        },
        onLeave(_el) {},
        tryIt: 'Click any key. These 12 notes are all of music.',
      },

      {
        id: 'ch1-octaves',
        narration:
          'Each repetition is called an octave — the same note, just higher. ' +
          'C4 and C5 are both called C. They sound like the same note because ' +
          'one vibrates at exactly twice the frequency of the other.',
        async onEnter(_el) {
          await _resizeAct2Keyboard(3, 2, {
            showLabels: true,
            onNoteDown(name, oct) {
              const freq = noteFreq(name, oct).toFixed(1);
              if (_act2Info) _act2Info.textContent = `${name}${oct} = ${freq} Hz`;
            },
          });
          _clearAct2Highlights();
          // Highlight all C keys in teal to show "same note, different octave"
          if (_act2Keys) {
            _act2Keys.forEach(el => {
              if (el.dataset.noteName === 'C') el.classList.add('ch1-kb-key--octave-hl');
            });
          }
          _showAct2Row(_act2OboeRow, false);
          _showAct2Row(_act2FindRow, false);
          _act2ActiveFind = null;
        },
        onLeave(_el) {},
        tryIt: 'Play a note, then find it an octave higher.',
      },

      {
        id: 'ch1-concert-pitch',
        narration:
          'A4 — the A above middle C — vibrates at exactly 440 times per second. ' +
          'This is the universal tuning reference. Every instrument in every orchestra ' +
          "in the world tunes to this note. When you hear an orchestra warming up, " +
          "that's the oboe playing A440 and everyone matching it.",
        async onEnter(_el) {
          // Keep 2-octave keyboard, pulse A4, show oboe buttons
          await _resizeAct2Keyboard(3, 2, {
            showLabels: true,
            onNoteDown(name, oct) {
              const freq = noteFreq(name, oct).toFixed(1);
              if (_act2Info) _act2Info.textContent = `${name}${oct} = ${freq} Hz`;
            },
          });
          _clearAct2Highlights();
          if (_act2Keys) {
            const a4Key = _act2Keys.get('A4');
            if (a4Key) a4Key.classList.add('ch1-kb-key--a4-pulse');
          }
          _showAct2Row(_act2OboeRow, true);
          _showAct2Row(_act2FindRow, false);
          _act2ActiveFind = null;
        },
        onLeave(_el) {
          if (_act2Keys) {
            const a4Key = _act2Keys.get('A4');
            if (a4Key) a4Key.classList.remove('ch1-kb-key--a4-pulse');
          }
          _showAct2Row(_act2OboeRow, false);
        },
        tryIt: 'This is the note the whole world agrees on.',
      },

      {
        id: 'ch1-keyboard-pattern',
        narration:
          'Look at the keyboard. See the pattern? Two black keys, then three black keys, ' +
          'repeating forever. That pattern is how you find any note instantly. ' +
          'C is always just left of the two black keys. F is always just left of the three. ' +
          'Once you see it, you can never unsee it.',
        async onEnter(_el) {
          await _resizeAct2Keyboard(3, 3, {
            showLabels: false,
            onNoteDown(name, oct, keyEl) {
              keyEl.classList.add('ch1-kb-key--show-label');
              const freq = noteFreq(name, oct).toFixed(1);
              if (_act2Info) _act2Info.textContent = `${name}${oct} = ${freq} Hz`;
            },
            onNoteUp(_name, _oct, keyEl) {
              setTimeout(() => {
                if (!keyEl.classList.contains('ch1-kb-key--pressed')) {
                  keyEl.classList.remove('ch1-kb-key--show-label');
                }
              }, 1200);
            },
          });
          _clearAct2Highlights();
          if (_act2Keys) _addGroupBrackets({ keys: _act2Keys });
          _showAct2Row(_act2OboeRow, false);
          _showAct2Row(_act2FindRow, true);
          // Reset any leftover find-button active state
          if (_act2FindRow) {
            _act2FindRow.querySelectorAll('.ch1-find-btn--active')
              .forEach(b => b.classList.remove('ch1-find-btn--active'));
          }
          _act2ActiveFind = null;
        },
        onLeave(_el) {
          _showAct2Row(_act2FindRow, false);
          if (_act2FindRow) {
            _act2FindRow.querySelectorAll('.ch1-find-btn--active')
              .forEach(b => b.classList.remove('ch1-find-btn--active'));
          }
          _act2ActiveFind = null;
        },
        tryIt: 'Can you find all the C notes? How about F?',
        gameLink: {
          game: 'harmony-trainer',
          label: 'Ready to train your ear?',
          url: '/games/harmony-trainer',
        },
      },
    ],
  },
];

// ── Flat sections list for progress-tracking compatibility ──────────

export const sections = acts.flatMap(act =>
  act.steps.map(step => ({
    id: step.id,
    narration: step.narration,
    tryIt: step.tryIt ?? null,
    gameLink: step.gameLink ?? null,
  })),
);
