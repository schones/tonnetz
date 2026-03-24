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
let _toneLoadPromise = null;
let _oscillator = null;
let _oscillatorGain = null;
let _sampler = null;
let _samplerLoading = false;
let _samplerReady = false;
let _oboeSampler = null;
let _oboeSamplerLoading = false;
let _oboeSamplerReady = false;

/** Set of section IDs whose interactive has already been mounted. */
const _mounted = new Set();

// Shared keyboard state (sections 2–4)
let _sharedKb = null;         // current keyboard instance { el, keys, cleanup }
let _sharedKbScrollEl = null; // the .ch1-kb-scroll wrapper (moves between sections)
let _sharedKbInfo = null;     // the .ch1-kb-info note-display line
let _sharedKbHostEl = null;   // which widget element currently owns the keyboard
let _s2Widget = null;         // section 2's .ch1-widget container
let _s3Widget = null;         // section 3's .ch1-widget container
let _s4Widget = null;         // section 4's .ch1-widget container
let _a440Widget = null;       // section 3's A440 buttons div (built once, show/hide)
let _findWidget = null;       // section 4's find buttons div (built once, show/hide)

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

/** Ensure Tone.js is available, loading it from CDN if needed. */
function _ensureToneLoaded() {
  if (window.Tone) return Promise.resolve();
  if (_toneLoadPromise) return _toneLoadPromise;
  _toneLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Tone.js'));
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
  await _ensureToneLoaded();
  _samplerLoading = true;
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
    if (!resp.ok) throw new Error(`Soundfont fetch failed (${resp.status})`);
    const text = await resp.text();
    const sfMatch = /MIDI\.Soundfont\.\w+\s*=\s*(\{[\s\S]+\})\s*;?\s*$/.exec(text);
    if (!sfMatch) throw new Error('Unexpected soundfont format');
    // eslint-disable-next-line no-new-func
    const allNotes = new Function('return ' + sfMatch[1])();
    const sparseKeys = ['A2', 'A3', 'A4', 'A5', 'A6'];
    const urls = {};
    sparseKeys.forEach(k => { if (allNotes[k]) urls[k] = allNotes[k]; });
    const vol = new Tone.Volume(0).toDestination();
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

/* Drag-to-play cursor */
.ch1-kb-key {
  cursor: grab;
}
.ch1-kb--dragging .ch1-kb-key {
  cursor: grabbing;
}

/* QWERTY hint label */
.ch1-kb-hint {
  font-size: 0.75rem;
  color: var(--text-muted, #b2bec3);
  text-align: center;
  margin-top: 2px;
  letter-spacing: 0.02em;
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
  flex-direction: column;
  align-items: center;
  padding: 28px 4px 4px;
}

/* ── A4 pulse animation ─────────────────────────────────── */

@keyframes ch1-a4-pulse {
  0%, 100% { background: var(--keyboard-white-key-bg, #e8e8f0); box-shadow: none; }
  50% {
    background: color-mix(in srgb, var(--color-primary, #6c5ce7) 25%, var(--keyboard-white-key-bg, #e8e8f0));
    box-shadow: 0 0 10px rgba(108, 92, 231, 0.4);
  }
}

.ch1-kb-key--a4-pulse.ch1-kb-key--white {
  animation: ch1-a4-pulse 1.8s ease-in-out infinite;
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
// SHARED KEYBOARD MANAGER
// ════════════════════════════════════════════════════════════════════

/**
 * Rebuild the shared keyboard inside hostEl (a .ch1-widget div).
 * Cleans up the previous instance, builds the new keyboard, fades it in.
 * The keyboard is inserted at the front of hostEl; the info line follows it.
 * Supplementary widgets already in hostEl remain after the info line.
 * @param {HTMLElement} hostEl       — the .ch1-widget to build into
 * @param {number}      startOctave
 * @param {number}      numOctaves
 * @param {Object}      [opts]       — passed through to _buildKeyboard
 * @param {string}      [opts.containerStyle]  — inline style for the scroll wrapper
 */
function _rebuildKeyboard(hostEl, startOctave, numOctaves, opts = {}) {
  // Clean up previous keyboard
  if (_sharedKb) {
    _sharedKb.cleanup();
    _sharedKb = null;
  }
  if (_sharedKbScrollEl) {
    _sharedKbScrollEl.remove();
    _sharedKbScrollEl = null;
  }

  // Ensure persistent info line exists
  if (!_sharedKbInfo) {
    _sharedKbInfo = document.createElement('div');
    _sharedKbInfo.className = 'ch1-kb-info';
    _sharedKbInfo.innerHTML = '&nbsp;';
  }

  // Build new scroll wrapper
  const scroll = document.createElement('div');
  scroll.className = 'ch1-kb-scroll';
  if (opts.containerStyle) {
    scroll.setAttribute('style', opts.containerStyle);
  }
  scroll.style.opacity = '0';
  scroll.style.transition = 'opacity 0.15s ease';
  _sharedKbScrollEl = scroll;

  const kb = _buildKeyboard(scroll, startOctave, numOctaves, opts);
  _sharedKb = kb;
  _sharedKbHostEl = hostEl;

  // Insert scroll at the front; info line immediately after it
  hostEl.insertBefore(scroll, hostEl.firstChild);
  scroll.insertAdjacentElement('afterend', _sharedKbInfo);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scroll.style.opacity = '1';
    });
  });
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

  // ── Drag-to-play state ──────────────────────────────────────────
  let _dragging = false;
  let _dragNote = null; // noteId currently held by drag

  function _dragPress(noteId, noteName, oct, el) {
    if (_dragNote === noteId) return;
    if (_dragNote) {
      const prevEl = keys.get(_dragNote);
      if (prevEl) prevEl.classList.remove('ch1-kb-key--pressed');
      _releaseSamplerNote(_dragNote);
      if (opts.onNoteUp) {
        const prev = CHROMATIC.find(n => toAscii(n.name) === _dragNote.slice(0, -1));
        if (prev) opts.onNoteUp(prev.name, parseInt(_dragNote.slice(-1)), prevEl);
      }
    }
    _dragNote = noteId;
    el.classList.add('ch1-kb-key--pressed');
    _playSamplerAttack(noteId);
    if (opts.onNoteDown) opts.onNoteDown(noteName, oct, el);
  }

  function _dragRelease() {
    if (_dragNote) {
      const el = keys.get(_dragNote);
      if (el) el.classList.remove('ch1-kb-key--pressed');
      _releaseSamplerNote(_dragNote);
      if (opts.onNoteUp) {
        const noteStr = _dragNote;
        const el2 = keys.get(noteStr);
        const oct = parseInt(noteStr.slice(-1));
        const name = noteStr.slice(0, -1);
        const chromNote = CHROMATIC.find(n => toAscii(n.name) === name);
        if (chromNote && opts.onNoteUp) opts.onNoteUp(chromNote.name, oct, el2);
      }
    }
    _dragging = false;
    _dragNote = null;
    wrap.classList.remove('ch1-kb--dragging');
  }

  // Mouse drag handlers on the container
  const onMouseOver = (e) => {
    if (!_dragging) return;
    const keyEl = e.target.closest('.ch1-kb-key');
    if (!keyEl) return;
    const noteId = keyEl.dataset.note;
    const noteName = keyEl.dataset.noteName;
    const oct = parseInt(keyEl.dataset.octave);
    _dragPress(noteId, noteName, oct, keyEl);
  };
  wrap.addEventListener('mouseover', onMouseOver);

  // Touch drag: use document-level touchmove + elementFromPoint
  const onTouchMove = (e) => {
    if (!_dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const keyEl = el.closest('.ch1-kb-key');
    if (!keyEl || !keys.has(keyEl.dataset.note)) return;
    const noteId = keyEl.dataset.note;
    const noteName = keyEl.dataset.noteName;
    const oct = parseInt(keyEl.dataset.octave);
    _dragPress(noteId, noteName, oct, keyEl);
  };
  document.addEventListener('touchmove', onTouchMove, { passive: false });

  // Global mouseup/touchend to end drag even outside the keyboard
  const onWindowMouseUp = () => {
    if (_dragging) _dragRelease();
  };
  const onWindowTouchEnd = () => {
    if (_dragging) _dragRelease();
  };
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener('touchend', onWindowTouchEnd);

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

      // Pointer events (click + drag start)
      const down = (e) => {
        e.preventDefault();
        _ensureTone();
        _ensureSampler();
        // Start drag
        _dragging = true;
        _dragNote = null;
        wrap.classList.add('ch1-kb--dragging');
        _dragPress(noteId, note.name, oct, el);
        pressedKey = noteId;
      };
      const up = () => {
        if (pressedKey !== noteId) return;
        pressedKey = null;
        // drag release handles the actual note-off via window handler
      };

      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); up(); });

      keys.set(noteId, el);
      wrap.appendChild(el);
    }
  }

  // ── QWERTY keyboard mapping (octave 4) ─────────────────────────
  const QWERTY_MAP = {
    a: `C4`, w: `C#4`, s: `D4`, e: `D#4`, d: `E4`,
    f: `F4`, t: `F#4`, g: `G4`, y: `G#4`, h: `A4`,
    u: `A#4`, j: `B4`,
  };
  // Track which QWERTY-held notes are currently pressed
  const _qwertyHeld = new Set();

  const onKeyDown = (e) => {
    if (e.repeat) return;
    // Only activate if this keyboard's section is active
    const section = container.closest('.intro-section');
    if (section && !section.classList.contains('intro-section--active')) return;
    const noteId = QWERTY_MAP[e.key.toLowerCase()];
    if (!noteId) return;
    if (_qwertyHeld.has(noteId)) return;
    const el = keys.get(noteId);
    if (!el) return; // this keyboard may not cover octave 4
    _qwertyHeld.add(noteId);
    _ensureTone();
    _ensureSampler();
    el.classList.add('ch1-kb-key--pressed');
    _playSamplerAttack(noteId);
    const noteName = el.dataset.noteName;
    const oct = parseInt(el.dataset.octave);
    if (opts.onNoteDown) opts.onNoteDown(noteName, oct, el);
  };

  const onKeyUp = (e) => {
    const noteId = QWERTY_MAP[e.key.toLowerCase()];
    if (!noteId) return;
    if (!_qwertyHeld.has(noteId)) return;
    _qwertyHeld.delete(noteId);
    const el = keys.get(noteId);
    if (!el) return;
    el.classList.remove('ch1-kb-key--pressed');
    _releaseSamplerNote(noteId);
    const noteName = el.dataset.noteName;
    const oct = parseInt(el.dataset.octave);
    if (opts.onNoteUp) opts.onNoteUp(noteName, oct, el);
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // ── Hint label ──────────────────────────────────────────────────
  const hint = document.createElement('div');
  hint.className = 'ch1-kb-hint ch1-widget__label';
  hint.textContent = 'drag across keys or use A S D F G H J to play';
  container.appendChild(wrap);
  container.appendChild(hint);

  return {
    el: wrap,
    keys,
    cleanup: () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchend', onWindowTouchEnd);
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// SECTION 1: OSCILLATOR WIDGET
// ════════════════════════════════════════════════════════════════════

function _mountOscillator(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'ch1-widget';

  // Frequency display
  const freqDisplay = document.createElement('div');
  freqDisplay.className = 'ch1-freq-display';
  freqDisplay.textContent = '440 Hz';

  // Canvas for waveform
  const canvas = document.createElement('canvas');
  canvas.className = 'ch1-osc-canvas';
  canvas.width = 500;
  canvas.height = 120;

  // Slider row
  const sliderRow = document.createElement('div');
  sliderRow.className = 'ch1-slider-row';

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

  // Play button
  const playBtn = document.createElement('button');
  playBtn.className = 'ch1-play-btn';
  playBtn.textContent = '▶ Play tone';

  widget.append(freqDisplay, canvas, sliderRow, playBtn);
  host.appendChild(widget);

  // State
  let isPlaying = false;
  let animId = null;
  let currentFreq = 440;

  // Drawing
  const ctx = canvas.getContext('2d');
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary').trim() || '#6c5ce7';

  // Logical (CSS) dimensions — updated by resizeCanvas
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

    if (isPlaying) {
      animId = requestAnimationFrame(drawWave);
    }
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

  function startOsc() {
    _ensureTone().then(() => {
      if (!_oscillator) {
        _oscillatorGain = new Tone.Gain(0.25).toDestination();
        _oscillator = new Tone.Oscillator({
          frequency: currentFreq,
          type: 'sine',
        }).connect(_oscillatorGain);
      }
      _oscillator.frequency.value = currentFreq;
      _oscillator.start();
      isPlaying = true;
      playBtn.textContent = '■ Stop';
      playBtn.classList.add('ch1-play-btn--active');
      drawWave();
    });
  }

  function stopOsc() {
    if (_oscillator) {
      try { _oscillator.stop(); } catch (_) {}
    }
    isPlaying = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    playBtn.textContent = '▶ Play tone';
    playBtn.classList.remove('ch1-play-btn--active');
    drawStatic();
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) stopOsc();
    else startOsc();
  });

  slider.addEventListener('input', () => {
    currentFreq = parseInt(slider.value, 10);
    freqDisplay.textContent = `${currentFreq} Hz`;
    if (_oscillator && isPlaying) {
      _oscillator.frequency.value = currentFreq;
    }
    if (!isPlaying) drawStatic();
  });

  // Resize canvas for retina/HiDPI
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

  // Initial draw
  requestAnimationFrame(() => {
    resizeCanvas();
    drawStatic();
  });

  const resizeObs = new ResizeObserver(() => resizeCanvas());
  resizeObs.observe(canvas);
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: A440 WIDGET BUILDER
// ════════════════════════════════════════════════════════════════════

/** Build the A440 oboe-demo widget. Returns a div; caller mounts and shows/hides it. */
function _buildA440Widget() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; padding-top:4px;';

  const explain = document.createElement('div');
  explain.className = 'ch1-a440-explain';
  explain.innerHTML = '&nbsp;';

  const notes = [
    { note: 'A3', freq: 220, label: 'A3' },
    { note: 'A4', freq: 440, label: 'A4' },
    { note: 'A5', freq: 880, label: 'A5' },
  ];

  const btnRow = document.createElement('div');
  btnRow.className = 'ch1-a440-row';

  let activeBtn = null;
  let activeTimeout = null;

  notes.forEach(({ note, freq, label }) => {
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
      _ensureSampler();

      if (activeBtn) activeBtn.classList.remove('ch1-a440-btn--playing');
      if (activeTimeout) clearTimeout(activeTimeout);
      btn.classList.add('ch1-a440-btn--playing');
      activeBtn = btn;
      activeTimeout = setTimeout(() => {
        btn.classList.remove('ch1-a440-btn--playing');
        activeBtn = null;
      }, 1800);

      if (_oboeSamplerReady && _oboeSampler) {
        _oboeSampler.triggerAttackRelease(note, '2n', Tone.now());
      } else {
        _playSamplerNote(note, '2n');
      }

      if (note === 'A3') {
        explain.textContent = 'A3 = 220 Hz — half the frequency of A4';
      } else if (note === 'A4') {
        explain.textContent = 'A4 = 440 Hz — the universal tuning reference';
      } else {
        explain.textContent = 'A5 = 880 Hz — double the frequency of A4';
      }
    });

    btnRow.appendChild(btn);
  });

  const doublingLine = document.createElement('div');
  doublingLine.className = 'ch1-widget__label';
  doublingLine.textContent = 'Each octave doubles the frequency: 220 → 440 → 880';
  doublingLine.style.marginTop = '8px';

  wrap.append(btnRow, explain, doublingLine);
  return wrap;
}

// ════════════════════════════════════════════════════════════════════
// SECTION 4: FIND WIDGET BUILDER
// ════════════════════════════════════════════════════════════════════

/** Build the "Find every ___" buttons widget. Returns a div; caller mounts and shows/hides it. */
function _buildFindWidget() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; padding-top:4px;';

  const findRow = document.createElement('div');
  findRow.className = 'ch1-find-row';

  const findNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let activeFind = null;

  findNotes.forEach(noteName => {
    const btn = document.createElement('button');
    btn.className = 'ch1-find-btn';
    btn.textContent = noteName;

    btn.addEventListener('click', async () => {
      await _ensureTone();
      _ensureSampler();
      if (!_sharedKb) return;

      if (activeFind === noteName) {
        _clearHighlights(_sharedKb);
        activeFind = null;
        btn.classList.remove('ch1-find-btn--active');
        if (_sharedKbInfo) _sharedKbInfo.innerHTML = '&nbsp;';
        return;
      }

      findRow.querySelectorAll('.ch1-find-btn--active').forEach(b => b.classList.remove('ch1-find-btn--active'));
      _clearHighlights(_sharedKb);

      activeFind = noteName;
      btn.classList.add('ch1-find-btn--active');

      const matchingKeys = [];
      _sharedKb.keys.forEach((el, noteId) => {
        if (el.dataset.noteName === noteName) {
          el.classList.add('ch1-kb-key--pattern-hl');
          el.classList.add('ch1-kb-key--show-label');
          matchingKeys.push(noteId);
        }
      });

      matchingKeys.forEach((noteId, i) => {
        setTimeout(() => _playSamplerNote(noteId, '8n'), i * 250);
      });

      if (_sharedKbInfo) _sharedKbInfo.textContent = `Every ${noteName} across 3 octaves`;
    });

    findRow.appendChild(btn);
  });

  const hint = document.createElement('div');
  hint.className = 'ch1-widget__label';
  hint.textContent = 'Click a key to hear it, or use the buttons to find every instance of a note';

  wrap.append(findRow, hint);
  return wrap;
}

/** Clear all custom highlights from a keyboard */
function _clearHighlights(kb) {
  kb.keys.forEach(el => {
    el.classList.remove(
      'ch1-kb-key--pattern-hl',
      'ch1-kb-key--octave-hl',
      'ch1-kb-key--show-label',
    );
  });
}

/** Add subtle group indicators above the black keys */
function _addGroupBrackets(kb) {
  // Find pairs/triples of consecutive black keys
  const blackKeys = [];
  kb.keys.forEach((el, noteId) => {
    if (el.classList.contains('ch1-kb-key--black')) {
      blackKeys.push({ el, noteId, pc: parseInt(el.dataset.pc, 10) });
    }
  });

  // Group: pc 1,3 = group of 2; pc 6,8,10 = group of 3
  blackKeys.forEach(({ el, pc }) => {
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
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', _cleanup);
  // Also handle SPA-style navigation if present
  window.addEventListener('pagehide', _cleanup);
}

// ════════════════════════════════════════════════════════════════════
// SECTION DEFINITIONS (exported for intro-core.js)
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 1,
  title: 'Sound & Notes',
  tone: 'playful',
  description: 'What is sound? Meet the 12 notes and the spaces between them.',
};

export const sections = [
  {
    id: 'ch1-what-is-sound',
    title: 'What is Sound?',
    narration:
      'Tap your desk. Hum. Clap your hands. ' +
      'That\'s sound — something vibrating, pushing air into your ears. ' +
      'The faster it vibrates, the higher it sounds. ' +
      'That speed has a name: frequency. ' +
      'And frequency is what gives every sound its pitch.',
    interactive: 'oscillator',
    tryIt: 'Drag the slider. Hear how the pitch rises?',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-what-is-sound')) return;
      _mounted.add('ch1-what-is-sound');
      _mountOscillator(sectionEl);
    },
  },
  {
    id: 'ch1-meet-the-notes',
    title: 'Meet the Notes',
    narration:
      'You could slide through every possible pitch forever. But musicians carved out ' +
      '12 specific pitches that sound good together. They repeat over and over, higher and higher. ' +
      'Each repetition is called an octave — the same note, just higher.',
    interactive: 'keyboard-12',
    tryIt: 'Click any key. These 12 notes are all of music.',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-meet-the-notes')) return;
      _mounted.add('ch1-meet-the-notes');
      _injectCSS();
      _ensureSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s2Widget = document.createElement('div');
      _s2Widget.className = 'ch1-widget';
      host.appendChild(_s2Widget);
      // _sharedKbInfo created lazily in _rebuildKeyboard; keyboard built in onEnter
    },
    onEnter(sectionEl) {
      if (!_s2Widget) return;
      if (_sharedKbHostEl === _s2Widget) return; // already here, skip rebuild
      _rebuildKeyboard(_s2Widget, 4, 1, {
        showLabels: true,
        onNoteDown(name, oct) {
          if (_sharedKbInfo) {
            const freq = noteFreq(name, oct).toFixed(1);
            _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
          }
        },
      });
      if (_a440Widget) _a440Widget.style.display = 'none';
      if (_findWidget) _findWidget.style.display = 'none';
    },
  },
  {
    id: 'ch1-concert-pitch',
    title: 'A = 440',
    narration:
      'Of all the notes, one has a special job. A4 — the A above middle C — vibrates at exactly ' +
      '440 times per second. This is the universal tuning reference. Every instrument in every ' +
      'orchestra in the world tunes to this note. When you hear an orchestra warming up, that\'s the ' +
      'oboe playing A440 and everyone matching it.',
    interactive: 'a440-demo',
    tryIt: 'This is the note the whole world agrees on.',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-concert-pitch')) return;
      _mounted.add('ch1-concert-pitch');
      _loadOboeSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s3Widget = document.createElement('div');
      _s3Widget.className = 'ch1-widget';
      host.appendChild(_s3Widget);
      _a440Widget = _buildA440Widget();
      _a440Widget.style.display = 'none';
      _s3Widget.appendChild(_a440Widget);
      // Keyboard built in onEnter
    },
    onEnter(sectionEl) {
      if (!_s3Widget) return;
      if (_sharedKbHostEl !== _s3Widget) {
        _rebuildKeyboard(_s3Widget, 3, 2, {
          showLabels: true,
          onNoteDown(name, oct) {
            if (_sharedKbInfo) {
              const freq = noteFreq(name, oct).toFixed(1);
              _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
            }
          },
        });
      }
      const a4Key = _sharedKb?.keys.get('A4');
      if (a4Key) a4Key.classList.add('ch1-kb-key--a4-pulse');
      if (_a440Widget) _a440Widget.style.display = '';
      if (_findWidget) _findWidget.style.display = 'none';
    },
    onLeave(sectionEl) {
      if (_sharedKb) {
        const a4Key = _sharedKb.keys.get('A4');
        if (a4Key) a4Key.classList.remove('ch1-kb-key--a4-pulse');
      }
      if (_a440Widget) _a440Widget.style.display = 'none';
    },
  },
  {
    id: 'ch1-keyboard-pattern',
    title: 'The Keyboard Pattern',
    narration:
      'Look at the keyboard. See the pattern? Two black keys, then three black keys, ' +
      'repeating forever. That pattern is how you find any note instantly. ' +
      'C is always just left of the two black keys. F is always just left of the three. ' +
      'Once you see it, you can never unsee it.',
    interactive: 'keyboard-pattern',
    tryIt: 'Can you find all the C notes? How about F?',
    gameLink: {
      game: 'harmony-trainer',
      label: 'Ready to train your ear?',
      url: '/harmony',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch1-keyboard-pattern')) return;
      _mounted.add('ch1-keyboard-pattern');
      _injectCSS();
      _ensureSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s4Widget = document.createElement('div');
      _s4Widget.className = 'ch1-widget';
      host.appendChild(_s4Widget);
      _findWidget = _buildFindWidget();
      _findWidget.style.display = 'none';
      _s4Widget.appendChild(_findWidget);
      // Keyboard built in onEnter
    },
    onEnter(sectionEl) {
      if (!_s4Widget) return;
      if (_sharedKbHostEl !== _s4Widget) {
        _rebuildKeyboard(_s4Widget, 3, 3, {
          showLabels: false,
          containerStyle: 'position:relative; overflow-x:visible; --ch1-kb-ww:28px; --ch1-kb-bw:18px; --ch1-kb-h:110px;',
          onNoteDown(name, oct, el) {
            el.classList.add('ch1-kb-key--show-label');
            if (_sharedKbInfo) {
              const freq = noteFreq(name, oct).toFixed(1);
              _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
            }
          },
          onNoteUp(_name, _oct, el) {
            setTimeout(() => {
              if (!el.classList.contains('ch1-kb-key--pressed')) {
                el.classList.remove('ch1-kb-key--show-label');
              }
            }, 1200);
          },
        });
        _addGroupBrackets(_sharedKb);
      }
      if (_a440Widget) _a440Widget.style.display = 'none';
      if (_findWidget) _findWidget.style.display = '';
    },
    onLeave(sectionEl) {
      if (_sharedKb) _clearHighlights(_sharedKb);
      if (_findWidget) {
        _findWidget.querySelectorAll('.ch1-find-btn--active').forEach(b => b.classList.remove('ch1-find-btn--active'));
        _findWidget.style.display = 'none';
      }
    },
  },
];
