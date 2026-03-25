/**
 * ch3-chords.js — Chapter 3: Chords & Progressions
 * ==================================================
 * Four interactive sections: stacking thirds, major/minor chords,
 * seven diatonic chords, and chord progressions.
 *
 * All keyboards use shared utilities from intro-audio.js.
 * Each section has its own dedicated keyboard instance.
 */

import {
  CHROMATIC,
  ensureTone,
  ensureSampler,
  playSamplerNote,
  buildKeyboard,
  injectSharedCSS,
  registerCleanup,
  MAJOR_PATTERN,
  buildScale,
  buildTriad,
  chordQuality,
  ROMAN,
} from '/static/intro/intro-audio.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const C_MAJOR = buildScale(0, MAJOR_PATTERN); // [0,2,4,5,7,9,11]
const C_DIATONIC = Array.from({ length: 7 }, (_, i) => buildTriad(C_MAJOR, i));

const PROGRESSIONS = [
  { label: 'I – IV – V – I',  subtitle: 'The backbone of rock & blues',    degrees: [0, 3, 4, 0] },
  { label: 'I – V – vi – IV', subtitle: 'The most popular pop progression', degrees: [0, 4, 5, 3] },
  { label: 'I – vi – IV – V', subtitle: '50s doo-wop',                      degrees: [0, 5, 3, 4] },
];

// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ════════════════════════════════════════════════════════════════════

function _pcToNoteId(pc, octave) {
  const note = CHROMATIC.find(n => n.pc === pc);
  return note ? `${note.name.replace(/♯/g, '#')}${octave}` : null;
}

/** Root in octave 4; third/fifth in octave 4 if PC > root, else octave 5. */
function _triadNoteIds([r, t, f]) {
  return [_pcToNoteId(r, 4), _pcToNoteId(t, t > r ? 4 : 5), _pcToNoteId(f, f > r ? 4 : 5)];
}

function _noteName(pc) {
  return CHROMATIC.find(n => n.pc === pc)?.name ?? '?';
}

function _getChordName(pcs) {
  const quality = chordQuality(pcs);
  const root = _noteName(pcs[0]);
  if (quality === 'major') return `${root} Major`;
  if (quality === 'minor') return `${root} Minor`;
  return `${root}°`;
}

function _chordShortName(pcs) {
  const quality = chordQuality(pcs);
  const root = _noteName(pcs[0]);
  if (quality === 'major') return root;
  if (quality === 'minor') return `${root}m`;
  return `${root}°`;
}

function _cancelTimers(arr) {
  arr.forEach(id => clearTimeout(id));
  arr.length = 0;
}

/** Highlight scale PCs dimly; fully dim non-scale. */
function _applyScaleDim(keys, scalePCs) {
  const set = new Set(scalePCs);
  keys.forEach(el => {
    const pc = parseInt(el.dataset.pc);
    el.classList.remove(
      'intro-kb-key--scale-dim', 'intro-kb-key--non-scale',
      'intro-kb-key--chord-major', 'intro-kb-key--chord-minor', 'intro-kb-key--chord-dim',
    );
    el.classList.add(set.has(pc) ? 'intro-kb-key--scale-dim' : 'intro-kb-key--non-scale');
  });
}

/** Chord tones: quality color; scale non-chord: dim; rest: fully dim. */
function _applyChordHL(keys, scalePCs, chordPCs, quality) {
  const scaleSet = new Set(scalePCs);
  const chordSet = new Set(chordPCs);
  keys.forEach(el => {
    const pc = parseInt(el.dataset.pc);
    el.classList.remove(
      'intro-kb-key--scale-dim', 'intro-kb-key--non-scale',
      'intro-kb-key--chord-major', 'intro-kb-key--chord-minor', 'intro-kb-key--chord-dim',
    );
    if (chordSet.has(pc)) el.classList.add(`intro-kb-key--chord-${quality}`);
    else if (scaleSet.has(pc)) el.classList.add('intro-kb-key--scale-dim');
    else el.classList.add('intro-kb-key--non-scale');
  });
}

/** Chord tones: quality color; everything else: fully dim. No scale context. */
function _applyChordOnlyHL(keys, chordPCs, quality) {
  const chordSet = new Set(chordPCs);
  keys.forEach(el => {
    const pc = parseInt(el.dataset.pc);
    el.classList.remove(
      'intro-kb-key--scale-dim', 'intro-kb-key--non-scale',
      'intro-kb-key--chord-major', 'intro-kb-key--chord-minor', 'intro-kb-key--chord-dim',
    );
    if (chordSet.has(pc)) el.classList.add(`intro-kb-key--chord-${quality}`);
    else el.classList.add('intro-kb-key--non-scale');
  });
}

function _clearAllHL(keys) {
  keys.forEach(el => el.classList.remove(
    'intro-kb-key--scale-dim', 'intro-kb-key--non-scale',
    'intro-kb-key--chord-major', 'intro-kb-key--chord-minor', 'intro-kb-key--chord-dim',
  ));
}

/**
 * Step-by-step triad animation: root → third → fifth → all together.
 * @param {Map}          keys      keyboard keys map
 * @param {number[]|null} scalePCs  null = no scale context (section 2)
 * @param {number[]}     triadPCs
 * @param {number[]}     timers    accumulator for timeout IDs
 * @param {Function}     onComplete  called with (quality) after chord plays
 */
function _animateTriad(keys, scalePCs, triadPCs, timers, onComplete) {
  const [r, t, f] = triadPCs;
  const quality = chordQuality(triadPCs);
  const noteIds = _triadNoteIds(triadPCs);
  const hl = scalePCs
    ? (pcs) => _applyChordHL(keys, scalePCs, pcs, quality)
    : (pcs) => _applyChordOnlyHL(keys, pcs, quality);

  timers.push(setTimeout(() => { hl([r]); if (noteIds[0]) playSamplerNote(noteIds[0], '0.4'); }, 0));
  timers.push(setTimeout(() => { hl([r, t]); if (noteIds[1]) playSamplerNote(noteIds[1], '0.4'); }, 500));
  timers.push(setTimeout(() => { hl([r, t, f]); if (noteIds[2]) playSamplerNote(noteIds[2], '0.4'); }, 1000));
  timers.push(setTimeout(() => {
    noteIds.forEach(id => { if (id) playSamplerNote(id, '1.2'); });
    if (onComplete) onComplete(quality);
  }, 1300));
}

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CH3_CSS = /* css */ `

/* ── Generic button (mirrors ch2 style) ──────────────────── */

.intro-find-btn {
  padding: 6px 16px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}
.intro-find-btn:hover { border-color: var(--color-primary, #6c5ce7); }
.intro-find-btn--large { padding: 10px 24px; font-size: 1rem; border-radius: 10px; }
.intro-find-btn-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

/* ── Scale dim / non-scale states ────────────────────────── */

.intro-kb-key--scale-dim.intro-kb-key--white {
  background: color-mix(in srgb, var(--color-primary, #6c5ce7) 12%, var(--keyboard-white-key-bg, #e8e8f0));
}
.intro-kb-key--scale-dim.intro-kb-key--black {
  background: color-mix(in srgb, var(--color-primary, #6c5ce7) 22%, var(--keyboard-black-key-bg, #1a1a2e));
}
.intro-kb-key--scale-dim .intro-kb-label {
  opacity: 1;
  color: var(--color-primary, #6c5ce7);
}
.intro-kb-key--non-scale {
  opacity: 0.35 !important;
  filter: saturate(0.2);
}

/* ── Root picker ──────────────────────────────────────────── */

.ch3-root-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
}
.ch3-root-btn {
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
.ch3-root-btn:hover { border-color: var(--color-primary, #6c5ce7); }
.ch3-root-btn--active {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}

/* ── Type toggle ──────────────────────────────────────────── */

.ch3-toggle-row { display: flex; gap: 10px; justify-content: center; }
.ch3-type-btn {
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
.ch3-type-btn--major.ch3-type-btn--active {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}
.ch3-type-btn--minor.ch3-type-btn--active {
  background: var(--color-secondary, #00cec9);
  border-color: var(--color-secondary, #00cec9);
  color: #fff;
}

/* ── Chord degree buttons ─────────────────────────────────── */

.ch3-chord-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.1s;
  user-select: none;
}
.ch3-chord-btn:hover { transform: translateY(-2px); }
.ch3-chord-btn--major { border-color: color-mix(in srgb, var(--color-primary, #6c5ce7) 40%, var(--border)); }
.ch3-chord-btn--minor { border-color: color-mix(in srgb, var(--color-secondary, #00cec9) 40%, var(--border)); }
.ch3-chord-btn--dim   { border-color: color-mix(in srgb, var(--color-accent-dark, #f39c12) 40%, var(--border)); }
.ch3-chord-btn--active { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.ch3-chord-btn--active.ch3-chord-btn--major {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}
.ch3-chord-btn--active.ch3-chord-btn--minor {
  background: var(--color-secondary, #00cec9);
  border-color: var(--color-secondary, #00cec9);
  color: #fff;
}
.ch3-chord-btn--active.ch3-chord-btn--dim {
  background: var(--color-accent-dark, #f39c12);
  border-color: var(--color-accent-dark, #f39c12);
  color: #fff;
}
.ch3-chord-btn__roman { font-size: 1rem; font-weight: 800; }
.ch3-chord-btn__name  { font-size: 0.7rem; font-weight: 600; opacity: 0.7; }

/* ── Progression cards ────────────────────────────────────── */

.ch3-prog-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 24px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 12px;
  background: var(--bg-secondary, #f0f0f5);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  user-select: none;
  min-width: 200px;
}
.ch3-prog-card:hover {
  border-color: var(--color-primary, #6c5ce7);
  transform: translateY(-2px);
}
.ch3-prog-card--active {
  border-color: var(--color-primary, #6c5ce7);
  background: color-mix(in srgb, var(--color-primary, #6c5ce7) 8%, var(--bg-secondary));
  box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
}
.ch3-prog-card__numerals {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
  letter-spacing: 0.05em;
}
.ch3-prog-card--active .ch3-prog-card__numerals { color: var(--color-primary, #6c5ce7); }
.ch3-prog-card__subtitle { font-size: 0.78rem; font-weight: 600; color: var(--text-muted, #b2bec3); }
.ch3-prog-chord--playing {
  color: var(--color-primary, #6c5ce7);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ── Chord info display ───────────────────────────────────── */

.ch3-chord-info { text-align: center; min-height: 3em; }
.ch3-chord-info__name      { font-size: 1.15rem; font-weight: 800; color: var(--text-primary, #2d3436); }
.ch3-chord-info__notes     { font-size: 0.88rem; font-weight: 700; color: var(--text-secondary, #636e72); letter-spacing: 0.12em; }
.ch3-chord-info__intervals { font-size: 0.78rem; font-weight: 600; color: var(--text-muted, #b2bec3); }

/* ── Key selector ─────────────────────────────────────────── */

.ch3-key-select {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
}
.ch3-key-select select {
  padding: 4px 8px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 6px;
  background: var(--bg-secondary, #f0f0f5);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

/* ── Layout rows ──────────────────────────────────────────── */

.ch3-prog-row  { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.ch3-chord-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }

/* ── Keyboard chord highlights ───────────────────────────── */

.intro-kb-key--chord-major.intro-kb-key--white {
  background: var(--color-primary, #6c5ce7);
  box-shadow: inset 0 0 0 2px var(--color-primary, #6c5ce7);
}
.intro-kb-key--chord-major.intro-kb-key--black {
  background: var(--color-primary-light, #a29bfe);
  box-shadow: inset 0 0 0 2px var(--color-primary-light, #a29bfe);
}
.intro-kb-key--chord-minor.intro-kb-key--white {
  background: var(--color-secondary, #00cec9);
  box-shadow: inset 0 0 0 2px var(--color-secondary, #00cec9);
}
.intro-kb-key--chord-minor.intro-kb-key--black {
  background: var(--color-secondary-light, #81ecec);
  box-shadow: inset 0 0 0 2px var(--color-secondary-light, #81ecec);
}
.intro-kb-key--chord-dim.intro-kb-key--white {
  background: var(--color-accent-dark, #f39c12);
  box-shadow: inset 0 0 0 2px var(--color-accent-dark, #f39c12);
}
.intro-kb-key--chord-dim.intro-kb-key--black {
  background: var(--color-accent, #fdcb6e);
  box-shadow: inset 0 0 0 2px var(--color-accent, #fdcb6e);
}
.intro-kb-key--chord-major .intro-kb-label,
.intro-kb-key--chord-minor .intro-kb-label,
.intro-kb-key--chord-dim   .intro-kb-label { opacity: 1; color: #fff; }

/* ── Interactive placeholder border ───────────────────────── */

.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch3-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch3-styles';
  el.textContent = CH3_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

const _mounted = new Set();

// Section 1 — Stacking Thirds
let _s1Kb = null;
let _s1Timers = [];
let _s1InfoEl = null;
let _s1BuildBtn = null;
let _s1DegreeRow = null;

// Section 2 — Major and Minor Chords
let _s2Kb = null;
let _s2Timers = [];
let _s2InfoEl = null;
let _s2RootPc = 0;
let _s2Type = 'major';
let _s2ActiveRootBtn = null;
let _s2CBtn = null;
let _s2MajorBtn = null;
let _s2MinorBtn = null;

// Section 3 — Seven Chords
let _s3Kb = null;
let _s3Timers = [];
let _s3InfoEl = null;
let _s3ActiveBtn = null;
let _s3ChordBtns = [];

// Section 4 — Progressions
let _s4Kb = null;
let _s4Timers = [];
let _s4Interval = null;
let _s4Step = 0;
let _s4ActiveProgIndex = -1;
let _s4RootPc = 0;
let _s4ProgCards = [];
let _s4NumSpans = [];   // [progIndex][chordIndex] → <span>
let _s4KeySelect = null;

// ════════════════════════════════════════════════════════════════════
// SECTION 1: STACKING THIRDS
// ════════════════════════════════════════════════════════════════════

function _mountS1(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Chord info above keyboard
  _s1InfoEl = document.createElement('div');
  _s1InfoEl.className = 'ch3-chord-info';
  widget.appendChild(_s1InfoEl);

  // Keyboard: C3–B4 (2 octaves)
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  widget.appendChild(scroll);
  ensureSampler();
  _s1Kb = buildKeyboard(scroll, 3, 2, {});

  // Build button
  _s1BuildBtn = document.createElement('button');
  _s1BuildBtn.className = 'intro-find-btn intro-find-btn--large';
  _s1BuildBtn.textContent = 'Build a chord';
  _s1BuildBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _buildS1Chord(0);
  });
  widget.appendChild(_s1BuildBtn);

  // Degree buttons row (hidden until first build)
  _s1DegreeRow = document.createElement('div');
  _s1DegreeRow.className = 'ch3-chord-row';
  _s1DegreeRow.style.display = 'none';
  C_MAJOR.forEach((pc, i) => {
    const btn = document.createElement('button');
    btn.className = 'intro-find-btn';
    btn.textContent = _noteName(pc);
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _buildS1Chord(i);
    });
    _s1DegreeRow.appendChild(btn);
  });
  widget.appendChild(_s1DegreeRow);
}

function _buildS1Chord(degreeIndex) {
  _cancelTimers(_s1Timers);
  const triadPCs = buildTriad(C_MAJOR, degreeIndex);
  _animateTriad(_s1Kb.keys, C_MAJOR, triadPCs, _s1Timers, () => {
    const name = _getChordName(triadPCs);
    const notes = triadPCs.map(_noteName).join('  ');
    _s1InfoEl.innerHTML =
      `<div class="ch3-chord-info__name">${name}</div>` +
      `<div class="ch3-chord-info__notes">${notes}</div>`;
    // Reveal degree buttons after the first build
    if (_s1DegreeRow.style.display === 'none') {
      _s1BuildBtn.style.display = 'none';
      _s1DegreeRow.style.display = '';
    }
  });
}

function _resetS1() {
  _cancelTimers(_s1Timers);
  if (!_s1Kb) return;
  _applyScaleDim(_s1Kb.keys, C_MAJOR);
  if (_s1InfoEl) _s1InfoEl.innerHTML = '';
  if (_s1BuildBtn) _s1BuildBtn.style.display = '';
  if (_s1DegreeRow) _s1DegreeRow.style.display = 'none';
}

// ════════════════════════════════════════════════════════════════════
// SECTION 2: MAJOR AND MINOR CHORDS
// ════════════════════════════════════════════════════════════════════

function _mountS2(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Root picker
  const rootLabel = document.createElement('div');
  rootLabel.className = 'intro-widget__label';
  rootLabel.textContent = 'Root note';
  widget.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch3-root-row';
  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch3-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s2RootPc = note.pc;
      if (_s2ActiveRootBtn) _s2ActiveRootBtn.classList.remove('ch3-root-btn--active');
      _s2ActiveRootBtn = btn;
      btn.classList.add('ch3-root-btn--active');
      _playS2Chord();
    });
    if (note.pc === 0) {
      _s2CBtn = btn;
      _s2ActiveRootBtn = btn;
      btn.classList.add('ch3-root-btn--active');
    }
    rootRow.appendChild(btn);
  });
  widget.appendChild(rootRow);

  // Type toggle
  const toggleRow = document.createElement('div');
  toggleRow.className = 'ch3-toggle-row';

  _s2MajorBtn = document.createElement('button');
  _s2MajorBtn.className = 'ch3-type-btn ch3-type-btn--major ch3-type-btn--active';
  _s2MajorBtn.textContent = 'Major';
  _s2MajorBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s2Type = 'major';
    _s2MajorBtn.classList.add('ch3-type-btn--active');
    _s2MinorBtn.classList.remove('ch3-type-btn--active');
    _playS2Chord();
  });
  toggleRow.appendChild(_s2MajorBtn);

  _s2MinorBtn = document.createElement('button');
  _s2MinorBtn.className = 'ch3-type-btn ch3-type-btn--minor';
  _s2MinorBtn.textContent = 'Minor';
  _s2MinorBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _s2Type = 'minor';
    _s2MinorBtn.classList.add('ch3-type-btn--active');
    _s2MajorBtn.classList.remove('ch3-type-btn--active');
    _playS2Chord();
  });
  toggleRow.appendChild(_s2MinorBtn);
  widget.appendChild(toggleRow);

  // Keyboard
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  widget.appendChild(scroll);
  ensureSampler();
  _s2Kb = buildKeyboard(scroll, 3, 2, {});

  // Chord info
  _s2InfoEl = document.createElement('div');
  _s2InfoEl.className = 'ch3-chord-info';
  widget.appendChild(_s2InfoEl);
}

function _playS2Chord() {
  _cancelTimers(_s2Timers);
  const triadPCs = _s2Type === 'major'
    ? [_s2RootPc, (_s2RootPc + 4) % 12, (_s2RootPc + 7) % 12]
    : [_s2RootPc, (_s2RootPc + 3) % 12, (_s2RootPc + 7) % 12];

  _animateTriad(_s2Kb.keys, null, triadPCs, _s2Timers, () => {
    const name = _getChordName(triadPCs);
    const notes = triadPCs.map(_noteName).join('  ');
    const intervals = _s2Type === 'major'
      ? 'root — 4 semitones — 3 semitones'
      : 'root — 3 semitones — 4 semitones';
    _s2InfoEl.innerHTML =
      `<div class="ch3-chord-info__name">${name}</div>` +
      `<div class="ch3-chord-info__notes">${notes}</div>` +
      `<div class="ch3-chord-info__intervals">${intervals}</div>`;
  });
}

function _resetS2() {
  _cancelTimers(_s2Timers);
  if (!_s2Kb) return;
  _clearAllHL(_s2Kb.keys);
  _s2RootPc = 0;
  _s2Type = 'major';
  if (_s2ActiveRootBtn) _s2ActiveRootBtn.classList.remove('ch3-root-btn--active');
  _s2ActiveRootBtn = _s2CBtn;
  if (_s2CBtn) _s2CBtn.classList.add('ch3-root-btn--active');
  if (_s2MajorBtn) _s2MajorBtn.classList.add('ch3-type-btn--active');
  if (_s2MinorBtn) _s2MinorBtn.classList.remove('ch3-type-btn--active');
  if (_s2InfoEl) _s2InfoEl.innerHTML = '';
  _playS2Chord();
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: SEVEN CHORDS FROM ONE SCALE
// ════════════════════════════════════════════════════════════════════

function _mountS3(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Keyboard
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  widget.appendChild(scroll);
  ensureSampler();
  _s3Kb = buildKeyboard(scroll, 3, 2, {});

  // 7 chord buttons
  const chordRow = document.createElement('div');
  chordRow.className = 'ch3-chord-row';
  _s3ChordBtns = [];

  C_DIATONIC.forEach((triadPCs, i) => {
    const quality = chordQuality(triadPCs);
    const btn = document.createElement('button');
    btn.className = `ch3-chord-btn ch3-chord-btn--${quality}`;

    const romanEl = document.createElement('span');
    romanEl.className = 'ch3-chord-btn__roman';
    romanEl.textContent = ROMAN[i];
    btn.appendChild(romanEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'ch3-chord-btn__name';
    nameEl.textContent = _chordShortName(triadPCs);
    btn.appendChild(nameEl);

    btn.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _playS3Chord(i);
    });

    _s3ChordBtns.push(btn);
    chordRow.appendChild(btn);
  });
  widget.appendChild(chordRow);

  // "Play all" button
  const playAllBtn = document.createElement('button');
  playAllBtn.className = 'intro-find-btn';
  playAllBtn.textContent = 'Play all';
  playAllBtn.addEventListener('click', () => {
    ensureTone(); ensureSampler();
    _playAllS3();
  });
  widget.appendChild(playAllBtn);

  // Chord info
  _s3InfoEl = document.createElement('div');
  _s3InfoEl.className = 'ch3-chord-info';
  widget.appendChild(_s3InfoEl);
}

function _playS3Chord(degreeIndex) {
  _cancelTimers(_s3Timers);
  if (_s3ActiveBtn) { _s3ActiveBtn.classList.remove('ch3-chord-btn--active'); _s3ActiveBtn = null; }

  const triadPCs = C_DIATONIC[degreeIndex];
  const quality = chordQuality(triadPCs);
  const noteIds = _triadNoteIds(triadPCs);

  _applyChordHL(_s3Kb.keys, C_MAJOR, triadPCs, quality);
  noteIds.forEach(id => { if (id) playSamplerNote(id, '1.2'); });

  _s3InfoEl.innerHTML =
    `<div class="ch3-chord-info__name">${_getChordName(triadPCs)}</div>` +
    `<div class="ch3-chord-info__notes">${triadPCs.map(_noteName).join('  ')}</div>`;

  _s3ActiveBtn = _s3ChordBtns[degreeIndex] || null;
  if (_s3ActiveBtn) _s3ActiveBtn.classList.add('ch3-chord-btn--active');
}

function _playAllS3() {
  _cancelTimers(_s3Timers);
  if (_s3ActiveBtn) { _s3ActiveBtn.classList.remove('ch3-chord-btn--active'); _s3ActiveBtn = null; }

  C_DIATONIC.forEach((triadPCs, i) => {
    _s3Timers.push(setTimeout(() => {
      const quality = chordQuality(triadPCs);
      const noteIds = _triadNoteIds(triadPCs);

      if (_s3ActiveBtn) _s3ActiveBtn.classList.remove('ch3-chord-btn--active');
      _s3ActiveBtn = _s3ChordBtns[i] || null;
      if (_s3ActiveBtn) _s3ActiveBtn.classList.add('ch3-chord-btn--active');

      _applyChordHL(_s3Kb.keys, C_MAJOR, triadPCs, quality);
      noteIds.forEach(id => { if (id) playSamplerNote(id, '0.9'); });

      _s3InfoEl.innerHTML =
        `<div class="ch3-chord-info__name">${_getChordName(triadPCs)}</div>` +
        `<div class="ch3-chord-info__notes">${triadPCs.map(_noteName).join('  ')}</div>`;
    }, i * 1000));
  });

  // After last chord, restore scale dim
  _s3Timers.push(setTimeout(() => {
    if (_s3ActiveBtn) { _s3ActiveBtn.classList.remove('ch3-chord-btn--active'); _s3ActiveBtn = null; }
    _applyScaleDim(_s3Kb.keys, C_MAJOR);
    if (_s3InfoEl) _s3InfoEl.innerHTML = '';
  }, 7 * 1000 + 400));
}

function _resetS3() {
  _cancelTimers(_s3Timers);
  if (!_s3Kb) return;
  if (_s3ActiveBtn) { _s3ActiveBtn.classList.remove('ch3-chord-btn--active'); _s3ActiveBtn = null; }
  _applyScaleDim(_s3Kb.keys, C_MAJOR);
  if (_s3InfoEl) _s3InfoEl.innerHTML = '';
}

// ════════════════════════════════════════════════════════════════════
// SECTION 4: PUTTING THEM TOGETHER (PROGRESSIONS)
// ════════════════════════════════════════════════════════════════════

function _mountS4(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  // Keyboard
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  widget.appendChild(scroll);
  ensureSampler();
  _s4Kb = buildKeyboard(scroll, 3, 2, {});

  // Progression cards
  const progRow = document.createElement('div');
  progRow.className = 'ch3-prog-row';
  _s4ProgCards = [];
  _s4NumSpans = [];

  PROGRESSIONS.forEach((prog, pi) => {
    const card = document.createElement('div');
    card.className = 'ch3-prog-card';

    // Numeral spans for per-chord highlighting
    const numeralsEl = document.createElement('div');
    numeralsEl.className = 'ch3-prog-card__numerals';
    const spans = prog.degrees.map((deg, ci) => {
      const span = document.createElement('span');
      span.textContent = ROMAN[deg];
      numeralsEl.appendChild(span);
      if (ci < prog.degrees.length - 1) numeralsEl.appendChild(document.createTextNode(' – '));
      return span;
    });
    _s4NumSpans.push(spans);
    card.appendChild(numeralsEl);

    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'ch3-prog-card__subtitle';
    subtitleEl.textContent = prog.subtitle;
    card.appendChild(subtitleEl);

    card.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _startS4Prog(pi);
    });

    _s4ProgCards.push(card);
    progRow.appendChild(card);
  });
  widget.appendChild(progRow);

  // Key selector
  const keySel = document.createElement('div');
  keySel.className = 'ch3-key-select';
  const keyLabel = document.createElement('span');
  keyLabel.textContent = 'Key:';
  keySel.appendChild(keyLabel);

  _s4KeySelect = document.createElement('select');
  CHROMATIC.forEach(note => {
    const opt = document.createElement('option');
    opt.value = note.pc;
    opt.textContent = note.name;
    _s4KeySelect.appendChild(opt);
  });
  _s4KeySelect.value = '0';
  _s4KeySelect.addEventListener('change', (e) => {
    _s4RootPc = parseInt(e.target.value);
    // Update scale dim if idle; if playing, next tick picks up the new root
    if (!_s4Interval && _s4Kb) {
      _applyScaleDim(_s4Kb.keys, buildScale(_s4RootPc, MAJOR_PATTERN));
    }
  });
  keySel.appendChild(_s4KeySelect);
  widget.appendChild(keySel);
}

function _s4Tick() {
  if (_s4ActiveProgIndex < 0 || !_s4Kb) return;
  const prog = PROGRESSIONS[_s4ActiveProgIndex];
  const scale = buildScale(_s4RootPc, MAJOR_PATTERN);
  const degreeIdx = prog.degrees[_s4Step];
  const triadPCs = buildTriad(scale, degreeIdx);
  const quality = chordQuality(triadPCs);
  const noteIds = _triadNoteIds(triadPCs);

  // Clear previous numeral highlights for this card
  _s4NumSpans[_s4ActiveProgIndex]?.forEach(s => s.classList.remove('ch3-prog-chord--playing'));

  // Highlight keyboard
  _applyChordHL(_s4Kb.keys, scale, triadPCs, quality);

  // Play chord
  noteIds.forEach(id => { if (id) playSamplerNote(id, '0.9'); });

  // Highlight current step's numeral
  _s4NumSpans[_s4ActiveProgIndex]?.[_s4Step]?.classList.add('ch3-prog-chord--playing');

  // Advance step (wraps)
  _s4Step = (_s4Step + 1) % prog.degrees.length;
}

function _startS4Prog(index) {
  // Stop any current progression
  if (_s4Interval) { clearInterval(_s4Interval); _s4Interval = null; }
  _cancelTimers(_s4Timers);
  _s4NumSpans.forEach(spans => spans.forEach(s => s.classList.remove('ch3-prog-chord--playing')));
  _s4ProgCards.forEach(c => c.classList.remove('ch3-prog-card--active'));

  // Toggle off if same card clicked while playing
  if (index === _s4ActiveProgIndex) {
    _s4ActiveProgIndex = -1;
    if (_s4Kb) _applyScaleDim(_s4Kb.keys, buildScale(_s4RootPc, MAJOR_PATTERN));
    return;
  }

  _s4ActiveProgIndex = index;
  _s4Step = 0;
  _s4ProgCards[index].classList.add('ch3-prog-card--active');

  // Play first chord immediately, then loop
  _s4Tick();
  _s4Interval = setInterval(_s4Tick, 1100);
}

function _resetS4() {
  if (_s4Interval) { clearInterval(_s4Interval); _s4Interval = null; }
  _cancelTimers(_s4Timers);
  _s4Step = 0;
  _s4ActiveProgIndex = -1;
  _s4RootPc = 0;
  _s4ProgCards.forEach(c => c.classList.remove('ch3-prog-card--active'));
  _s4NumSpans.forEach(spans => spans.forEach(s => s.classList.remove('ch3-prog-chord--playing')));
  if (_s4Kb) _applyScaleDim(_s4Kb.keys, C_MAJOR);
  if (_s4KeySelect) _s4KeySelect.value = '0';
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════

registerCleanup(() => {
  _cancelTimers(_s1Timers);
  _cancelTimers(_s2Timers);
  _cancelTimers(_s3Timers);
  _cancelTimers(_s4Timers);
  if (_s4Interval) { clearInterval(_s4Interval); _s4Interval = null; }
  [_s1Kb, _s2Kb, _s3Kb, _s4Kb].forEach(kb => { if (kb?.cleanup) kb.cleanup(); });
});

// ════════════════════════════════════════════════════════════════════
// CHAPTER EXPORTS
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 3,
  title: 'Chords & Progressions',
  tone: 'playful',
  description: 'Stack notes into chords, meet major and minor, and hear how chord progressions make songs.',
};

export const sections = [
  {
    id: 'ch3-stacking-thirds',
    title: 'Stacking Thirds',
    narration:
      "You've been playing one note at a time. What happens when you play three at once? " +
      'Take the C major scale and skip every other note: C, E, G. Play them together. ' +
      "That's a chord — three notes stacked in thirds. It sounds complete, like a whole thing.",
    interactive: 'triad-builder',
    tryIt: 'Build the chord, then try clicking different scale degrees. Some are major, some are minor — can you hear the difference?',
    onActivate(sectionEl) {
      if (_mounted.has('ch3-stacking-thirds')) return;
      _mounted.add('ch3-stacking-thirds');
      _mountS1(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS1();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s1Timers);
      if (_s1Kb) _applyScaleDim(_s1Kb.keys, C_MAJOR);
    },
  },
  {
    id: 'ch3-major-and-minor',
    title: 'Major and Minor Chords',
    narration:
      "That C-E-G chord sounds bright — it's a major chord. " +
      'The distance from C to E is a major third: 4 semitones. ' +
      "Now play A-C-E. It sounds darker — that's a minor chord. " +
      'The distance from A to C is a minor third: 3 semitones. One semitone changes everything.',
    interactive: 'chord-type-explorer',
    tryIt: 'Pick any root. Toggle between major and minor — hear how one semitone transforms the mood.',
    onActivate(sectionEl) {
      if (_mounted.has('ch3-major-and-minor')) return;
      _mounted.add('ch3-major-and-minor');
      _mountS2(sectionEl);
    },
    onEnter(_sectionEl) {
      if (_s2Kb) _resetS2();
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s2Timers);
      if (_s2Kb) _clearAllHL(_s2Kb.keys);
    },
  },
  {
    id: 'ch3-seven-chords',
    title: 'Seven Chords from One Scale',
    narration:
      'Every major scale gives you seven chords. Build a triad from each note of C major ' +
      'and something remarkable happens: three are major, three are minor, and one is diminished. ' +
      'Musicians name them with Roman numerals — uppercase for major, lowercase for minor.',
    interactive: 'diatonic-chord-display',
    tryIt: 'Click each chord. Notice the pattern: major, minor, minor, major, major, minor, diminished. Every major key works this way.',
    onActivate(sectionEl) {
      if (_mounted.has('ch3-seven-chords')) return;
      _mounted.add('ch3-seven-chords');
      _mountS3(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS3();
    },
    onLeave(_sectionEl) {
      _resetS3();
    },
  },
  {
    id: 'ch3-progressions',
    title: 'Putting Them Together',
    narration:
      'A chord progression is a sequence of chords that gives a song its emotional arc. ' +
      'Certain chords want to follow each other — and the same handful of progressions ' +
      'show up in thousands of songs.',
    interactive: 'progression-player',
    tryIt: 'Pick a progression and listen. Change the key — the feeling stays the same even though the notes change.',
    gameLink: {
      game: 'harmony-trainer',
      label: 'Train your ear to hear chords →',
      url: '/harmony',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch3-progressions')) return;
      _mounted.add('ch3-progressions');
      _mountS4(sectionEl);
    },
    onEnter(_sectionEl) {
      _resetS4();
      if (_s4Kb) _applyScaleDim(_s4Kb.keys, C_MAJOR);
    },
    onLeave(_sectionEl) {
      _resetS4();
    },
  },
];
