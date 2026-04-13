/**
 * ch4-beyond-triads.js — Chapter 4: Beyond Triads
 * =================================================
 * Sections on sevenths, the tritone, and more (3–5 added in follow-ups).
 *
 * All keyboards use shared utilities from intro-audio.js.
 */

import {
  CHROMATIC,
  ensureTone,
  ensureSampler,
  playSamplerNote,
  buildKeyboard,
  injectSharedCSS,
  registerCleanup,
  toAscii,
} from '/static/intro/intro-audio.js';

import {
  CHORD_TYPES,
  chordPCs,
  chordNotes,
  chordSymbol,
  noteToPC,
  pcToNote,
} from '/static/shared/transforms.js';

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function _pcToNoteId(pc, octave) {
  const note = CHROMATIC.find(n => n.pc === pc);
  return note ? `${toAscii(note.name)}${octave}` : null;
}

/** Root in octave 4; other chord tones in octave 4 if pc > root pc, else octave 5. */
function _chordNoteIds(pcs) {
  const rootPc = pcs[0];
  return pcs.map((pc, i) => {
    if (i === 0) return _pcToNoteId(pc, 4);
    return _pcToNoteId(pc, pc > rootPc ? 4 : 5);
  });
}

function _cancelTimers(arr) {
  arr.forEach(id => clearTimeout(id));
  arr.length = 0;
}

const _HL_CLASSES = [
  'intro-kb-key--chord-major',
  'intro-kb-key--chord-minor',
  'intro-kb-key--chord-dim',
  'ch4-key--extension',
  'ch4-key--tritone',
  'ch4-key--minor',
  'ch4-key--dim',
  'ch4-key--aug',
  'ch4-key--sus',
  'ch4-key--faded',
];

function _clearAllHL(keys) {
  keys.forEach(el => el.classList.remove(..._HL_CLASSES));
}

function _highlightKey(keys, noteId, className) {
  const el = keys.get(noteId);
  if (el) el.classList.add(className);
}

function _fadeKey(keys, noteId) {
  const el = keys.get(noteId);
  if (el) el.classList.add('ch4-key--faded');
}

function _playStaggered(noteIds, timers, duration = '1.4', stagger = 80) {
  noteIds.forEach((id, i) => {
    if (!id) return;
    timers.push(setTimeout(() => playSamplerNote(id, duration), i * stagger));
  });
}

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CH4_CSS = /* css */ `

/* ── Generic button (mirrors ch3 style) ──────────────────── */

.ch4-btn {
  padding: 6px 16px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}
.ch4-btn:hover:not(:disabled) { border-color: var(--color-primary, #6c5ce7); }
.ch4-btn:disabled { opacity: 0.35; cursor: default; }
.ch4-btn--active {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}
.ch4-btn-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

/* ── Root picker (mirrors ch3) ────────────────────────────── */

.ch4-root-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
}
.ch4-root-btn {
  padding: 4px 9px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 6px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}
.ch4-root-btn:hover { border-color: var(--color-primary, #6c5ce7); }
.ch4-root-btn--active {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}

/* ── Type buttons row ─────────────────────────────────────── */

.ch4-type-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ch4-type-btn {
  padding: 6px 20px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}
.ch4-type-btn:hover { border-color: #D4A03C; }
.ch4-type-btn--active {
  background: #D4A03C;
  border-color: #D4A03C;
  color: #fff;
}

/* ── Chord info display ───────────────────────────────────── */

.ch4-chord-info {
  text-align: center;
  min-height: 3.5rem;
  margin-bottom: 0.75rem;
}
.ch4-chord-info__name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #2A2520);
}
.ch4-chord-info__notes {
  font-size: 0.95rem;
  color: var(--text-secondary, #6B6560);
  margin-top: 2px;
  letter-spacing: 0.08em;
}
.ch4-chord-info__desc {
  font-size: 0.85rem;
  color: var(--text-secondary, #6B6560);
  font-style: italic;
  margin-top: 4px;
}

/* ── Keyboard: base triad highlight (blue, reused from ch3) ── */

.intro-kb-key--chord-major.intro-kb-key--white {
  background: var(--color-primary, #6c5ce7);
  box-shadow: inset 0 0 0 2px var(--color-primary, #6c5ce7);
}
.intro-kb-key--chord-major.intro-kb-key--black {
  background: var(--color-primary-light, #a29bfe);
  box-shadow: inset 0 0 0 2px var(--color-primary-light, #a29bfe);
}
.intro-kb-key--chord-major .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: extension (gold ring) ─────────────────────── */

.ch4-key--extension.intro-kb-key--white {
  background: rgba(212, 160, 60, 0.20);
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--extension.intro-kb-key--black {
  background: #D4A03C;
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--extension .intro-kb-label { opacity: 1; color: #D4A03C; }
.ch4-key--extension.intro-kb-key--black .intro-kb-label { color: #fff; }

/* ── Keyboard: tritone (coral) ────────────────────────────── */

.ch4-key--tritone.intro-kb-key--white {
  background: rgba(232, 116, 97, 0.75);
  box-shadow: inset 0 0 0 3px #E87461;
}
.ch4-key--tritone.intro-kb-key--black {
  background: #E87461;
  box-shadow: inset 0 0 0 3px #E87461;
}
.ch4-key--tritone .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: minor (green) ─────────────────────────────── */

.ch4-key--minor.intro-kb-key--white {
  background: rgba(76, 175, 80, 0.75);
  box-shadow: inset 0 0 0 3px #4CAF50;
}
.ch4-key--minor.intro-kb-key--black {
  background: #4CAF50;
  box-shadow: inset 0 0 0 3px #4CAF50;
}
.ch4-key--minor .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: diminished (coral) ────────────────────────── */

.ch4-key--dim.intro-kb-key--white {
  background: rgba(232, 116, 97, 0.75);
  box-shadow: inset 0 0 0 3px #E87461;
}
.ch4-key--dim.intro-kb-key--black {
  background: #E87461;
  box-shadow: inset 0 0 0 3px #E87461;
}
.ch4-key--dim .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: augmented (gold) ──────────────────────────── */

.ch4-key--aug.intro-kb-key--white {
  background: rgba(212, 160, 60, 0.75);
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--aug.intro-kb-key--black {
  background: #D4A03C;
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--aug .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: suspended (gold) ──────────────────────────── */

.ch4-key--sus.intro-kb-key--white {
  background: rgba(212, 160, 60, 0.75);
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--sus.intro-kb-key--black {
  background: #D4A03C;
  box-shadow: inset 0 0 0 3px #D4A03C;
}
.ch4-key--sus .intro-kb-label { opacity: 1; color: #fff; }

/* ── Keyboard: faded (dim to show context) ────────────────── */

.ch4-key--faded { opacity: 0.2 !important; }

/* ── Song card (used in later sections) ──────────────────── */

.ch4-song-card {
  display: inline-flex;
  flex-direction: column;
  padding: 12px 16px;
  border: 1px solid var(--border, #D5CDBD);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
  background: var(--bg-card, #FDFBF7);
  min-width: 140px;
  text-align: center;
}
.ch4-song-card:hover {
  border-color: #D4A03C;
  transform: translateY(-2px);
}
.ch4-song-card--active {
  border-color: #D4A03C;
  box-shadow: 0 0 0 2px rgba(212,160,60,0.3);
}
.ch4-song-card__title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary, #2A2520);
}
.ch4-song-card__subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary, #6B6560);
  font-style: italic;
  margin-top: 2px;
}
.ch4-song-card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-bottom: 0.75rem;
}

/* ── Interactive placeholder border ───────────────────────── */

.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
}

/* ── Keyboard wrapper (no scrolling, wider than intro-kb-scroll) ── */

.ch4-kb-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 4px 4px;
  overflow: visible;
}

/* Ch4 keyboards — fill the 900px interactive container */
.ch4-kb-wrap .intro-kb {
  --intro-kb-ww: 40px;
  --intro-kb-bw: 24px;
  --intro-kb-h: 130px;
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch4-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch4-styles';
  el.textContent = CH4_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

const _mounted = new Set();

// Section 1 — Adding the Seventh
let _s1Kb = null;
let _s1Timers = [];
let _s1InfoEl = null;
let _s1RootPc = 0;
let _s1Type = 'Triad'; // 'Triad' | 'maj7' | '7' | 'm7'
let _s1RootBtns = [];
let _s1TypeBtns = {};

// Section 2 — The Tritone
let _s2Kb = null;
let _s2Timers = [];
let _s2InfoEl = null;
let _s2PlayBtn = null;
let _s2ShowBtn = null;
let _s2ResolveBtn = null;
let _s2ResetBtn = null;
let _s2StepRow = null;
let _s2Stage = 0; // 0 idle, 1 dom7, 2 tritone, 3 resolved
let _s2RootPc = 0;
let _s2RootBtns = [];

// Section 3 — Diminished and Augmented
let _s3Kb = null;
let _s3Timers = [];
let _s3InfoEl = null;
let _s3RootPc = 0;
let _s3Type = 'Major'; // 'Major' | 'Minor' | 'Dim' | 'Aug'
let _s3RootBtns = [];
let _s3TypeBtns = {};

// Section 4 — Suspended Chords
let _s4Kb = null;
let _s4Timers = [];
let _s4InfoEl = null;
let _s4RootPc = 2; // D
let _s4RootBtns = [];
let _s4PlaySus4Btn = null;
let _s4ResolveSus4Btn = null;
let _s4PlaySus2Btn = null;
let _s4ResolveSus2Btn = null;

// Section 5 — Hearing Them in Songs
let _s5Kb = null;
let _s5Timers = [];
let _s5InfoEl = null;
let _s5CardEls = [];
let _s5Playing = false;

// ════════════════════════════════════════════════════════════════════
// SECTION 1: ADDING THE SEVENTH
// ════════════════════════════════════════════════════════════════════

const _S1_TYPE_TO_CHORD = {
  'Triad': 'major',
  'maj7':  'maj7',
  '7':     'dom7',
  'm7':    'min7',
};

const _S1_DESCRIPTIONS = {
  'maj7': 'major 3rd + major 7th — dreamy, floating',
  'dom7': 'major 3rd + minor 7th — bluesy, tense',
  'min7': 'minor 3rd + minor 7th — mellow, warm',
  'major': 'major 3rd + minor 3rd — bright, stable',
};

function _mountS1(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Root label + picker
  const rootLabel = document.createElement('div');
  rootLabel.className = 'intro-widget__label';
  rootLabel.textContent = 'Root note';
  widget.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch4-root-row';
  _s1RootBtns = [];
  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch4-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s1RootPc = note.pc;
      _s1RootBtns.forEach(b => b.classList.remove('ch4-root-btn--active'));
      btn.classList.add('ch4-root-btn--active');
      _playS1Chord();
    });
    if (note.pc === 0) btn.classList.add('ch4-root-btn--active');
    _s1RootBtns.push(btn);
    rootRow.appendChild(btn);
  });
  widget.appendChild(rootRow);

  // Type buttons row
  const typeRow = document.createElement('div');
  typeRow.className = 'ch4-type-row';
  _s1TypeBtns = {};
  ['Triad', 'maj7', '7', 'm7'].forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'ch4-type-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s1Type = label;
      Object.values(_s1TypeBtns).forEach(b => b.classList.remove('ch4-type-btn--active'));
      btn.classList.add('ch4-type-btn--active');
      _playS1Chord();
    });
    if (label === 'Triad') btn.classList.add('ch4-type-btn--active');
    _s1TypeBtns[label] = btn;
    typeRow.appendChild(btn);
  });
  widget.appendChild(typeRow);

  // Info display
  _s1InfoEl = document.createElement('div');
  _s1InfoEl.className = 'ch4-chord-info';
  widget.appendChild(_s1InfoEl);

  // Keyboard
  const scroll = document.createElement('div');
  scroll.className = 'ch4-kb-wrap';
  widget.appendChild(scroll);
  ensureSampler();
  _s1Kb = buildKeyboard(scroll, 3, 3, {});
}

function _playS1Chord() {
  _cancelTimers(_s1Timers);
  if (!_s1Kb) return;

  const chordType = _S1_TYPE_TO_CHORD[_s1Type];
  const pcs = chordPCs(_s1RootPc, chordType);
  const noteIds = _chordNoteIds(pcs);

  _clearAllHL(_s1Kb.keys);

  // First 3 notes: blue triad highlight
  noteIds.slice(0, 3).forEach(id => _highlightKey(_s1Kb.keys, id, 'intro-kb-key--chord-major'));
  // 4th note (if present): gold extension
  if (noteIds[3]) _highlightKey(_s1Kb.keys, noteIds[3], 'ch4-key--extension');

  _playStaggered(noteIds, _s1Timers);

  const rootName = CHROMATIC.find(n => n.pc === _s1RootPc)?.name ?? '?';
  const symbol = chordSymbol(rootName, chordType);
  const notes = chordNotes(rootName, chordType).join(' · ');
  const desc = _S1_DESCRIPTIONS[chordType];

  _s1InfoEl.innerHTML =
    `<div class="ch4-chord-info__name">${symbol}</div>` +
    `<div class="ch4-chord-info__notes">${notes}</div>` +
    `<div class="ch4-chord-info__desc">${desc}</div>`;
}

function _resetS1() {
  _cancelTimers(_s1Timers);
  if (!_s1Kb) return;
  _clearAllHL(_s1Kb.keys);
  _s1RootPc = 0;
  _s1Type = 'Triad';
  _s1RootBtns.forEach(b => b.classList.toggle('ch4-root-btn--active', parseInt(b.dataset.pc) === 0));
  Object.entries(_s1TypeBtns).forEach(([label, b]) => {
    b.classList.toggle('ch4-type-btn--active', label === 'Triad');
  });
  if (_s1InfoEl) _s1InfoEl.innerHTML = '';
}

// ════════════════════════════════════════════════════════════════════
// SECTION 2: THE TRITONE
// ════════════════════════════════════════════════════════════════════

function _mountS2(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Root label + picker
  const rootLabel = document.createElement('div');
  rootLabel.className = 'intro-widget__label';
  rootLabel.textContent = 'Root note';
  widget.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch4-root-row';
  _s2RootBtns = [];
  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch4-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s2RootPc = note.pc;
      _s2RootBtns.forEach(b => b.classList.remove('ch4-root-btn--active'));
      btn.classList.add('ch4-root-btn--active');
      _s2UpdateButtonLabels();
      _s2ResetStages();
    });
    if (note.pc === 0) btn.classList.add('ch4-root-btn--active');
    _s2RootBtns.push(btn);
    rootRow.appendChild(btn);
  });
  widget.appendChild(rootRow);

  // Info display
  _s2InfoEl = document.createElement('div');
  _s2InfoEl.className = 'ch4-chord-info';
  widget.appendChild(_s2InfoEl);

  // Keyboard
  const scroll = document.createElement('div');
  scroll.className = 'ch4-kb-wrap';
  widget.appendChild(scroll);
  ensureSampler();
  _s2Kb = buildKeyboard(scroll, 3, 3, {});

  // Step buttons row
  _s2StepRow = document.createElement('div');
  _s2StepRow.className = 'ch4-btn-row';

  _s2PlayBtn = document.createElement('button');
  _s2PlayBtn.className = 'ch4-btn';
  _s2PlayBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s2PlayDom7();
  });
  _s2StepRow.appendChild(_s2PlayBtn);

  _s2ShowBtn = document.createElement('button');
  _s2ShowBtn.className = 'ch4-btn';
  _s2ShowBtn.textContent = 'Show the tritone';
  _s2ShowBtn.disabled = true;
  _s2ShowBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s2ShowTritone();
  });
  _s2StepRow.appendChild(_s2ShowBtn);

  _s2ResolveBtn = document.createElement('button');
  _s2ResolveBtn.className = 'ch4-btn';
  _s2ResolveBtn.disabled = true;
  _s2ResolveBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s2Resolve();
  });
  _s2StepRow.appendChild(_s2ResolveBtn);

  _s2UpdateButtonLabels();

  widget.appendChild(_s2StepRow);

  // Reset button (hidden until resolved)
  _s2ResetBtn = document.createElement('button');
  _s2ResetBtn.className = 'ch4-btn';
  _s2ResetBtn.textContent = 'Reset';
  _s2ResetBtn.style.display = 'none';
  _s2ResetBtn.addEventListener('click', () => _resetS2());
  widget.appendChild(_s2ResetBtn);
}

function _s2TargetRootPc() { return (_s2RootPc + 5) % 12; }

function _s2UpdateButtonLabels() {
  const rootName = CHROMATIC.find(n => n.pc === _s2RootPc)?.name ?? '?';
  const targetName = CHROMATIC.find(n => n.pc === _s2TargetRootPc())?.name ?? '?';
  if (_s2PlayBtn) _s2PlayBtn.textContent = `Play ${rootName}7`;
  if (_s2ResolveBtn) _s2ResolveBtn.textContent = `Resolve to ${targetName}`;
}

function _s2PlayDom7() {
  _cancelTimers(_s2Timers);
  _clearAllHL(_s2Kb.keys);

  const rootName = CHROMATIC.find(n => n.pc === _s2RootPc)?.name ?? '?';
  const pcs = chordPCs(_s2RootPc, 'dom7');
  const noteIds = _chordNoteIds(pcs);

  noteIds.forEach(id => _highlightKey(_s2Kb.keys, id, 'intro-kb-key--chord-major'));
  _playStaggered(noteIds, _s2Timers);

  const symbol = chordSymbol(rootName, 'dom7');
  const notes = chordNotes(rootName, 'dom7').join(' · ');
  _s2InfoEl.innerHTML =
    `<div class="ch4-chord-info__name">${symbol}</div>` +
    `<div class="ch4-chord-info__notes">${notes}</div>`;

  _s2ShowBtn.disabled = false;
  _s2Stage = 1;
}

function _s2ShowTritone() {
  _cancelTimers(_s2Timers);

  const pcs = chordPCs(_s2RootPc, 'dom7'); // [root, 3rd, 5th, ♭7]
  const noteIds = _chordNoteIds(pcs);

  // Fade root and 5th; highlight 3rd and ♭7 as tritone
  _fadeKey(_s2Kb.keys, noteIds[0]);
  _fadeKey(_s2Kb.keys, noteIds[2]);

  const thirdEl = _s2Kb.keys.get(noteIds[1]);
  const b7El = _s2Kb.keys.get(noteIds[3]);
  if (thirdEl) {
    thirdEl.classList.remove('intro-kb-key--chord-major');
    thirdEl.classList.add('ch4-key--tritone');
  }
  if (b7El) {
    b7El.classList.remove('intro-kb-key--chord-major');
    b7El.classList.add('ch4-key--tritone');
  }

  playSamplerNote(noteIds[1], '1.4');
  playSamplerNote(noteIds[3], '1.4');

  const rootName = CHROMATIC.find(n => n.pc === _s2RootPc)?.name ?? '?';
  const names = chordNotes(rootName, 'dom7');
  _s2InfoEl.innerHTML =
    `<div class="ch4-chord-info__name">${names[1]} ← 6 semitones → ${names[3]}</div>` +
    `<div class="ch4-chord-info__desc">the tritone</div>`;

  _s2ResolveBtn.disabled = false;
  _s2Stage = 2;
}

function _s2Resolve() {
  _cancelTimers(_s2Timers);
  _clearAllHL(_s2Kb.keys);

  const rootName = CHROMATIC.find(n => n.pc === _s2RootPc)?.name ?? '?';
  const targetPc = _s2TargetRootPc();
  const targetName = CHROMATIC.find(n => n.pc === targetPc)?.name ?? '?';
  const targetIds = _chordNoteIds(chordPCs(targetPc, 'major'));
  const dom7Names = chordNotes(rootName, 'dom7');
  const majorNames = chordNotes(targetName, 'major');

  _s2Timers.push(setTimeout(() => {
    targetIds.forEach(id =>
      _highlightKey(_s2Kb.keys, id, 'intro-kb-key--chord-major')
    );
    _playStaggered(targetIds, _s2Timers);

    _s2InfoEl.innerHTML =
      `<div class="ch4-chord-info__name">${targetName} major</div>` +
      `<div class="ch4-chord-info__desc">${dom7Names[1]} → ${majorNames[0]}, ${dom7Names[3]} → ${majorNames[1]}. Resolution.</div>`;

    _s2StepRow.style.display = 'none';
    _s2ResetBtn.style.display = '';
    _s2Stage = 3;
  }, 200));
}

function _s2ResetStages() {
  _cancelTimers(_s2Timers);
  if (!_s2Kb) return;
  _clearAllHL(_s2Kb.keys);
  if (_s2InfoEl) _s2InfoEl.innerHTML = '';
  if (_s2StepRow) _s2StepRow.style.display = '';
  if (_s2ResetBtn) _s2ResetBtn.style.display = 'none';
  if (_s2PlayBtn) _s2PlayBtn.disabled = false;
  if (_s2ShowBtn) _s2ShowBtn.disabled = true;
  if (_s2ResolveBtn) _s2ResolveBtn.disabled = true;
  _s2Stage = 0;
}

function _resetS2() {
  _s2RootPc = 0;
  _s2RootBtns.forEach(b => b.classList.toggle('ch4-root-btn--active', parseInt(b.dataset.pc) === 0));
  _s2UpdateButtonLabels();
  _s2ResetStages();
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: DIMINISHED AND AUGMENTED
// ════════════════════════════════════════════════════════════════════

const _S3_TYPE_TO_CHORD = {
  'Major': 'major',
  'Minor': 'minor',
  'Dim':   'diminished',
  'Aug':   'augmented',
};

const _S3_DESCRIPTIONS = {
  'major':      'major 3rd + minor 3rd — bright, stable',
  'minor':      'minor 3rd + major 3rd — dark, stable',
  'diminished': 'minor 3rd + minor 3rd — tense, wants to move',
  'augmented':  'major 3rd + major 3rd — eerie, unresolved',
};

const _S3_TYPE_TO_HL_CLASS = {
  'major':      'intro-kb-key--chord-major',
  'minor':      'ch4-key--minor',
  'diminished': 'ch4-key--dim',
  'augmented':  'ch4-key--aug',
};

function _mountS3(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  const rootLabel = document.createElement('div');
  rootLabel.className = 'intro-widget__label';
  rootLabel.textContent = 'Root note';
  widget.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch4-root-row';
  _s3RootBtns = [];
  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch4-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s3RootPc = note.pc;
      _s3RootBtns.forEach(b => b.classList.remove('ch4-root-btn--active'));
      btn.classList.add('ch4-root-btn--active');
      _playS3Chord();
    });
    if (note.pc === 0) btn.classList.add('ch4-root-btn--active');
    _s3RootBtns.push(btn);
    rootRow.appendChild(btn);
  });
  widget.appendChild(rootRow);

  const typeRow = document.createElement('div');
  typeRow.className = 'ch4-type-row';
  _s3TypeBtns = {};
  ['Major', 'Minor', 'Dim', 'Aug'].forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'ch4-type-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s3Type = label;
      Object.values(_s3TypeBtns).forEach(b => b.classList.remove('ch4-type-btn--active'));
      btn.classList.add('ch4-type-btn--active');
      _playS3Chord();
    });
    if (label === 'Major') btn.classList.add('ch4-type-btn--active');
    _s3TypeBtns[label] = btn;
    typeRow.appendChild(btn);
  });
  widget.appendChild(typeRow);

  _s3InfoEl = document.createElement('div');
  _s3InfoEl.className = 'ch4-chord-info';
  widget.appendChild(_s3InfoEl);

  const scroll = document.createElement('div');
  scroll.className = 'ch4-kb-wrap';
  widget.appendChild(scroll);
  ensureSampler();
  _s3Kb = buildKeyboard(scroll, 3, 3, {});
}

function _playS3Chord() {
  _cancelTimers(_s3Timers);
  if (!_s3Kb) return;

  const chordType = _S3_TYPE_TO_CHORD[_s3Type];
  const pcs = chordPCs(_s3RootPc, chordType);
  const noteIds = _chordNoteIds(pcs);
  const hlClass = _S3_TYPE_TO_HL_CLASS[chordType];

  _clearAllHL(_s3Kb.keys);
  noteIds.forEach(id => _highlightKey(_s3Kb.keys, id, hlClass));
  _playStaggered(noteIds, _s3Timers);

  const rootName = CHROMATIC.find(n => n.pc === _s3RootPc)?.name ?? '?';
  const symbol = chordSymbol(rootName, chordType);
  const notes = chordNotes(rootName, chordType).join(' · ');
  const desc = _S3_DESCRIPTIONS[chordType];

  _s3InfoEl.innerHTML =
    `<div class="ch4-chord-info__name">${symbol}</div>` +
    `<div class="ch4-chord-info__notes">${notes}</div>` +
    `<div class="ch4-chord-info__desc">${desc}</div>`;
}

function _resetS3() {
  _cancelTimers(_s3Timers);
  if (!_s3Kb) return;
  _clearAllHL(_s3Kb.keys);
  _s3RootPc = 0;
  _s3Type = 'Major';
  _s3RootBtns.forEach(b => b.classList.toggle('ch4-root-btn--active', parseInt(b.dataset.pc) === 0));
  Object.entries(_s3TypeBtns).forEach(([label, b]) => {
    b.classList.toggle('ch4-type-btn--active', label === 'Major');
  });
  if (_s3InfoEl) _s3InfoEl.innerHTML = '';
}

// ════════════════════════════════════════════════════════════════════
// SECTION 4: SUSPENDED CHORDS
// ════════════════════════════════════════════════════════════════════

function _mountS4(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  const rootLabel = document.createElement('div');
  rootLabel.className = 'intro-widget__label';
  rootLabel.textContent = 'Root note';
  widget.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch4-root-row';
  _s4RootBtns = [];
  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch4-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s4RootPc = note.pc;
      _s4RootBtns.forEach(b => b.classList.remove('ch4-root-btn--active'));
      btn.classList.add('ch4-root-btn--active');
      _s4ClearKeyboardAndButtons();
    });
    if (note.pc === 2) btn.classList.add('ch4-root-btn--active');
    _s4RootBtns.push(btn);
    rootRow.appendChild(btn);
  });
  widget.appendChild(rootRow);

  _s4InfoEl = document.createElement('div');
  _s4InfoEl.className = 'ch4-chord-info';
  widget.appendChild(_s4InfoEl);

  const scroll = document.createElement('div');
  scroll.className = 'ch4-kb-wrap';
  widget.appendChild(scroll);
  ensureSampler();
  _s4Kb = buildKeyboard(scroll, 3, 3, {});

  // sus4 row
  const sus4Row = document.createElement('div');
  sus4Row.className = 'ch4-btn-row';

  _s4PlaySus4Btn = document.createElement('button');
  _s4PlaySus4Btn.className = 'ch4-btn';
  _s4PlaySus4Btn.textContent = 'Play sus4';
  _s4PlaySus4Btn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s4PlaySus('sus4');
  });
  sus4Row.appendChild(_s4PlaySus4Btn);

  _s4ResolveSus4Btn = document.createElement('button');
  _s4ResolveSus4Btn.className = 'ch4-btn';
  _s4ResolveSus4Btn.textContent = 'Resolve ↓';
  _s4ResolveSus4Btn.disabled = true;
  _s4ResolveSus4Btn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s4Resolve();
  });
  sus4Row.appendChild(_s4ResolveSus4Btn);

  widget.appendChild(sus4Row);

  // sus2 row
  const sus2Row = document.createElement('div');
  sus2Row.className = 'ch4-btn-row';

  _s4PlaySus2Btn = document.createElement('button');
  _s4PlaySus2Btn.className = 'ch4-btn';
  _s4PlaySus2Btn.textContent = 'Play sus2';
  _s4PlaySus2Btn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s4PlaySus('sus2');
  });
  sus2Row.appendChild(_s4PlaySus2Btn);

  _s4ResolveSus2Btn = document.createElement('button');
  _s4ResolveSus2Btn.className = 'ch4-btn';
  _s4ResolveSus2Btn.textContent = 'Resolve ↑';
  _s4ResolveSus2Btn.disabled = true;
  _s4ResolveSus2Btn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s4Resolve();
  });
  sus2Row.appendChild(_s4ResolveSus2Btn);

  widget.appendChild(sus2Row);
}

function _s4PlaySus(susType) {
  _cancelTimers(_s4Timers);
  if (!_s4Kb) return;

  const pcs = chordPCs(_s4RootPc, susType);
  const noteIds = _chordNoteIds(pcs);

  _clearAllHL(_s4Kb.keys);
  noteIds.forEach(id => _highlightKey(_s4Kb.keys, id, 'ch4-key--sus'));
  _playStaggered(noteIds, _s4Timers);

  const rootName = CHROMATIC.find(n => n.pc === _s4RootPc)?.name ?? '?';
  const symbol = chordSymbol(rootName, susType);
  const notes = chordNotes(rootName, susType).join(' · ');
  const desc = susType === 'sus4'
    ? 'the 4th wants to fall to the 3rd...'
    : 'the 2nd wants to rise to the 3rd...';

  _s4InfoEl.innerHTML =
    `<div class="ch4-chord-info__name">${symbol}</div>` +
    `<div class="ch4-chord-info__notes">${notes}</div>` +
    `<div class="ch4-chord-info__desc">${desc}</div>`;

  if (susType === 'sus4') {
    _s4ResolveSus4Btn.disabled = false;
    _s4ResolveSus2Btn.disabled = true;
  } else {
    _s4ResolveSus2Btn.disabled = false;
    _s4ResolveSus4Btn.disabled = true;
  }
}

function _s4Resolve() {
  _cancelTimers(_s4Timers);
  if (!_s4Kb) return;

  _clearAllHL(_s4Kb.keys);

  _s4Timers.push(setTimeout(() => {
    const pcs = chordPCs(_s4RootPc, 'major');
    const noteIds = _chordNoteIds(pcs);
    noteIds.forEach(id => _highlightKey(_s4Kb.keys, id, 'intro-kb-key--chord-major'));
    _playStaggered(noteIds, _s4Timers);

    const rootName = CHROMATIC.find(n => n.pc === _s4RootPc)?.name ?? '?';
    _s4InfoEl.innerHTML =
      `<div class="ch4-chord-info__name">→ ${rootName} major</div>` +
      `<div class="ch4-chord-info__desc">The suspension resolved.</div>`;

    _s4ResolveSus4Btn.disabled = true;
    _s4ResolveSus2Btn.disabled = true;
  }, 200));
}

function _s4ClearKeyboardAndButtons() {
  _cancelTimers(_s4Timers);
  if (_s4Kb) _clearAllHL(_s4Kb.keys);
  if (_s4InfoEl) _s4InfoEl.innerHTML = '';
  if (_s4ResolveSus4Btn) _s4ResolveSus4Btn.disabled = true;
  if (_s4ResolveSus2Btn) _s4ResolveSus2Btn.disabled = true;
}

function _resetS4() {
  _cancelTimers(_s4Timers);
  if (!_s4Kb) return;
  _clearAllHL(_s4Kb.keys);
  _s4RootPc = 2;
  _s4RootBtns.forEach(b => b.classList.toggle('ch4-root-btn--active', parseInt(b.dataset.pc) === 2));
  if (_s4InfoEl) _s4InfoEl.innerHTML = '';
  if (_s4ResolveSus4Btn) _s4ResolveSus4Btn.disabled = true;
  if (_s4ResolveSus2Btn) _s4ResolveSus2Btn.disabled = true;
}

// ════════════════════════════════════════════════════════════════════
// SECTION 5: HEARING THEM IN SONGS
// ════════════════════════════════════════════════════════════════════

const _S5_CARDS = [
  {
    title: 'Blues: E7 → A7 → B7',
    subtitle: 'Folsom Prison Blues',
    chords: [
      { root: 'E', pc: 4,  type: 'dom7' },
      { root: 'A', pc: 9,  type: 'dom7' },
      { root: 'B', pc: 11, type: 'dom7' },
    ],
  },
  {
    title: 'Dim: F → F♯° → C',
    subtitle: 'Bridge Over Troubled Water',
    chords: [
      { root: 'F',  pc: 5, type: 'major' },
      { root: 'F♯', pc: 6, type: 'diminished' },
      { root: 'C',  pc: 0, type: 'major' },
    ],
  },
  {
    title: 'Aug: E → E+ → A',
    subtitle: 'Oh! Darling',
    chords: [
      { root: 'E', pc: 4, type: 'major' },
      { root: 'E', pc: 4, type: 'augmented' },
      { root: 'A', pc: 9, type: 'major' },
    ],
  },
  {
    title: 'Sus4: Dsus4 → D',
    subtitle: 'Classic resolution',
    chords: [
      { root: 'D', pc: 2, type: 'sus4' },
      { root: 'D', pc: 2, type: 'major' },
    ],
  },
];

const _S5_SEVENTH_TYPES = new Set(['dom7', 'maj7', 'min7', 'dim7', 'half-dim7', 'minmaj7']);

function _s5BaseClassFor(type) {
  if (type === 'diminished') return 'ch4-key--dim';
  if (type === 'augmented') return 'ch4-key--aug';
  if (type === 'sus4' || type === 'sus2') return 'ch4-key--sus';
  return 'intro-kb-key--chord-major';
}

function _mountS5(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Info display
  _s5InfoEl = document.createElement('div');
  _s5InfoEl.className = 'ch4-chord-info';
  widget.appendChild(_s5InfoEl);

  // Keyboard (C3–B5)
  const scroll = document.createElement('div');
  scroll.className = 'ch4-kb-wrap';
  widget.appendChild(scroll);
  ensureSampler();
  _s5Kb = buildKeyboard(scroll, 3, 3, {});

  // Song cards row
  const cardRow = document.createElement('div');
  cardRow.className = 'ch4-song-card-row';
  _s5CardEls = [];
  _S5_CARDS.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'ch4-song-card';
    el.innerHTML =
      `<div class="ch4-song-card__title">${card.title}</div>` +
      `<div class="ch4-song-card__subtitle">${card.subtitle}</div>`;
    el.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _playS5Sequence(i);
    });
    _s5CardEls.push(el);
    cardRow.appendChild(el);
  });
  widget.appendChild(cardRow);
}

function _playS5Sequence(cardIdx) {
  _cancelTimers(_s5Timers);
  if (!_s5Kb) return;

  _s5CardEls.forEach((el, i) => {
    el.classList.toggle('ch4-song-card--active', i === cardIdx);
  });

  _clearAllHL(_s5Kb.keys);
  _s5Playing = true;

  const card = _S5_CARDS[cardIdx];
  const chordGap = 800;

  card.chords.forEach((chord, i) => {
    _s5Timers.push(setTimeout(() => {
      if (!_s5Kb) return;
      _clearAllHL(_s5Kb.keys);

      const pcs = chordPCs(chord.pc, chord.type);
      const noteIds = _chordNoteIds(pcs);

      if (_S5_SEVENTH_TYPES.has(chord.type)) {
        noteIds.slice(0, 3).forEach(id =>
          _highlightKey(_s5Kb.keys, id, 'intro-kb-key--chord-major')
        );
        if (noteIds[3]) _highlightKey(_s5Kb.keys, noteIds[3], 'ch4-key--extension');
      } else {
        const cls = _s5BaseClassFor(chord.type);
        noteIds.forEach(id => _highlightKey(_s5Kb.keys, id, cls));
      }

      _playStaggered(noteIds, _s5Timers);

      const symbol = chordSymbol(chord.root, chord.type);
      const notes = chordNotes(chord.root, chord.type).join(' · ');
      _s5InfoEl.innerHTML =
        `<div class="ch4-chord-info__name">${symbol}</div>` +
        `<div class="ch4-chord-info__notes">${notes}</div>`;
    }, i * chordGap));
  });

  // Hold final highlights 1000ms, then clear
  const holdUntil = card.chords.length * chordGap + 1000;
  _s5Timers.push(setTimeout(() => {
    if (_s5Kb) _clearAllHL(_s5Kb.keys);
    _s5Playing = false;
  }, holdUntil));
}

function _resetS5() {
  _cancelTimers(_s5Timers);
  if (!_s5Kb) return;
  _clearAllHL(_s5Kb.keys);
  _s5CardEls.forEach(el => el.classList.remove('ch4-song-card--active'));
  if (_s5InfoEl) _s5InfoEl.innerHTML = '';
  _s5Playing = false;
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════

registerCleanup(() => {
  _cancelTimers(_s1Timers);
  _cancelTimers(_s2Timers);
  _cancelTimers(_s3Timers);
  _cancelTimers(_s4Timers);
  _cancelTimers(_s5Timers);
  [_s1Kb, _s2Kb, _s3Kb, _s4Kb, _s5Kb].forEach(kb => { if (kb?.cleanup) kb.cleanup(); });
});

// ════════════════════════════════════════════════════════════════════
// CHAPTER EXPORTS
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 4,
  title: 'Beyond Triads',
  tone: 'moderate',
  description: 'Add sevenths, remove thirds, and discover the chords that give songs their real flavor.',
};

export const sections = [
  {
    id: 'ch4-adding-the-seventh',
    title: 'Adding the Seventh',
    narration:
      "You've been building chords with three notes — root, third, fifth. What happens when you " +
      'stack one more third on top? You get a seventh chord — four notes instead of three. That ' +
      'extra note changes everything. There are three seventh chords you\'ll hear constantly. ' +
      'Cmaj7 — a major triad plus a major seventh. It sounds dreamy, sophisticated. ' +
      'C7 — a major triad plus a minor seventh. This is the dominant seventh — bluesy, tense, ' +
      'wants to move. Cm7 — a minor triad plus a minor seventh. Mellow, warm, the workhorse of ' +
      'jazz. The naming trips everyone up at first: C7 is not short for Cmaj7. C7 means dominant ' +
      'seventh — major triad, minor seventh. It\'s the most common seventh chord in music and it ' +
      'gets the simplest name.',
    interactive: 'seventh-explorer',
    tryIt:
      'Start with C. Toggle between the triad and each seventh type — hear how one note changes ' +
      'the whole character. Then try it from different roots.',
    onActivate(sectionEl) {
      if (_mounted.has('ch4-adding-the-seventh')) return;
      _mounted.add('ch4-adding-the-seventh');
      _mountS1(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS1();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s1Timers);
      if (_s1Kb) _clearAllHL(_s1Kb.keys);
    },
  },
  {
    id: 'ch4-the-tritone',
    title: 'The Tritone',
    narration:
      'The dominant 7th chord has a secret weapon: a tritone. In C7, the third (E) and the flat ' +
      'seventh (B♭) are exactly 6 semitones apart — the most unstable interval in music. Your ear ' +
      'wants those two notes to move: E up to F, B♭ down to A. That pulls the whole chord toward ' +
      'F major. This is why the V7 chord is the strongest force in all of harmony — the tritone ' +
      'inside it creates tension that demands resolution. Every blues song, every jazz turnaround, ' +
      'every classical cadence is built on this engine.',
    interactive: 'tritone-demo',
    tryIt:
      'Play the tritone by itself — hear how unfinished it sounds. Then hit Resolve and feel the ' +
      'relief. This tension-and-release is the heartbeat of Western harmony.',
    walkthroughLink: {
      label: 'Hear it in Folsom Prison Blues →',
      url: '/explorer?walkthrough=folsom_train_beat',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch4-the-tritone')) return;
      _mounted.add('ch4-the-tritone');
      _mountS2(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS2();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s2Timers);
      if (_s2Kb) _clearAllHL(_s2Kb.keys);
    },
  },
  {
    id: 'ch4-dim-and-aug',
    title: 'Diminished and Augmented',
    narration:
      'Not all triads are major or minor. Stack two minor thirds and you get a diminished chord — ' +
      'tight, tense, unstable. Stack two major thirds and you get an augmented chord — eerie, ' +
      'floating, unresolved. These aren\'t just exotic sounds — they\'re chromatic connectors. A ' +
      'diminished chord sneaks between two major chords by moving the bass up a half step. An ' +
      'augmented chord pushes upward the same way. Once you hear them, you\'ll find them everywhere.',
    interactive: 'dim-aug-explorer',
    tryIt:
      'Play all four triad types from the same root. Major is bright, minor is dark, diminished ' +
      'is anxious, augmented is otherworldly. Four moods from the same starting note.',
    walkthroughLinks: [
      {
        label: 'Diminished in Bridge Over Troubled Water →',
        url: '/explorer?walkthrough=bridge_over_troubled_water',
      },
      {
        label: 'Augmented in Oh! Darling →',
        url: '/explorer?walkthrough=oh_darling_augmented',
      },
    ],
    onActivate(sectionEl) {
      if (_mounted.has('ch4-dim-and-aug')) return;
      _mounted.add('ch4-dim-and-aug');
      _mountS3(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS3();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s3Timers);
      if (_s3Kb) _clearAllHL(_s3Kb.keys);
    },
  },
  {
    id: 'ch4-suspended',
    title: 'Suspended Chords',
    narration:
      'Every chord you\'ve heard so far has a third — that\'s the note that makes it major or ' +
      'minor. What if you take it out? Replace the third with a fourth and you get a sus4. ' +
      'Replace it with a second and you get a sus2. Neither major nor minor — suspended chords ' +
      'hang in the air, waiting to resolve. When a sus4 drops back to a major chord, the relief ' +
      'is palpable.',
    interactive: 'suspended-explorer',
    tryIt:
      'Play sus4, then resolve to major. Now try sus2 and resolve. Both land on the same chord, ' +
      'but sus4 falls down while sus2 pushes up.',
    onActivate(sectionEl) {
      if (_mounted.has('ch4-suspended')) return;
      _mounted.add('ch4-suspended');
      _mountS4(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS4();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s4Timers);
      if (_s4Kb) _clearAllHL(_s4Kb.keys);
    },
  },
  {
    id: 'ch4-in-songs',
    title: 'Hearing Them in Songs',
    narration:
      "These chords aren't textbook abstractions — they're the sounds you already know. Every " +
      "blues song is built on dominant 7ths. The diminished chord in Bridge Over Troubled Water " +
      "makes the words 'over troubled water' feel inevitable. The augmented chord in Oh! Darling " +
      "is McCartney reaching for something just out of grasp. Once you can name these sounds, " +
      "you'll hear them everywhere.",
    interactive: 'song-examples',
    tryIt:
      'Listen to each example. Can you hear the seventh in the blues chords? The half-step ' +
      'movement in the diminished passing chord? The reaching quality of the augmented?',
    gameLink: {
      game: 'chord-spotter',
      label: 'Test your ear with Chord Spotter →',
      url: '/games/chord-spotter',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch4-in-songs')) return;
      _mounted.add('ch4-in-songs');
      _mountS5(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS5();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s5Timers);
      if (_s5Kb) _clearAllHL(_s5Kb.keys);
    },
  },
];
