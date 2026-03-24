/**
 * ch2-scales.js — Chapter 2: Intervals & Scales
 * ================================================
 * Three interactive sections exploring intervals, the major scale
 * (with root picker), and the major/minor contrast.
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
} from '/static/intro/intro-audio.js';

// ════════════════════════════════════════════════════════════════════
// MUSIC THEORY
// ════════════════════════════════════════════════════════════════════

const MAJOR_PATTERN = [2, 2, 1, 2, 2, 2, 1];
const MINOR_PATTERN = [2, 1, 2, 2, 1, 2, 2];

const INTERVAL_NAMES = {
  0: 'Unison', 1: 'Minor 2nd (half step)', 2: 'Major 2nd (whole step)',
  3: 'Minor 3rd', 4: 'Major 3rd', 5: 'Perfect 4th',
  6: 'Tritone', 7: 'Perfect 5th', 8: 'Minor 6th',
  9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave',
};

// Enharmonic flat names for display (CHROMATIC uses sharps)
const FLAT_NAMES = { 'C♯': 'D♭', 'D♯': 'E♭', 'F♯': 'G♭', 'G♯': 'A♭', 'A♯': 'B♭' };

/**
 * Returns an array of 7 pitch classes for the given root and interval pattern.
 * buildScale(0, [2,2,1,2,2,2,1]) → [0, 2, 4, 5, 7, 9, 11]
 */
function buildScale(rootPc, pattern) {
  const pcs = [];
  let current = rootPc % 12;
  pcs.push(current);
  for (let i = 0; i < pattern.length - 1; i++) {
    current = (current + pattern[i]) % 12;
    pcs.push(current);
  }
  return pcs;
}

/** Display name for a pitch class; optionally prefer flats for black keys. */
function getNoteName(pc, preferFlats = false) {
  const note = CHROMATIC.find(n => n.pc === pc);
  if (!note) return '';
  if (preferFlats && note.isBlack) return FLAT_NAMES[note.name] || note.name;
  return note.name;
}

// Pre-computed C major / C minor for section 4
const C_MAJOR_PCS = buildScale(0, MAJOR_PATTERN); // [0,2,4,5,7,9,11]
const C_MINOR_PCS = buildScale(0, MINOR_PATTERN); // [0,2,3,5,7,8,10]

/**
 * Collect noteIds from a keyboard in ascending pitch order that belong to
 * scalePcs, starting from the first occurrence of rootPc. Returns up to 8
 * (root + 6 scale degrees + octave above root).
 */
function getScaleAscendingIds(rootPc, scalePcs, kb) {
  const pcsSet = new Set(scalePcs);
  const allIds = [];
  kb.keys.forEach((el, noteId) => {
    if (pcsSet.has(parseInt(el.dataset.pc))) allIds.push(noteId);
  });
  const startIdx = allIds.findIndex(id =>
    parseInt(kb.keys.get(id).dataset.pc) === rootPc
  );
  const from = startIdx === -1 ? 0 : startIdx;
  return allIds.slice(from, from + 8);
}

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CH2_CSS = /* css */ `

/* ── Shared button style ──────────────────────────────────── */

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

.intro-find-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
}

.intro-find-btn--active {
  background: var(--color-accent, #fdcb6e);
  border-color: var(--color-accent-dark, #f39c12);
  color: #2d3436;
}

.intro-find-btn--selected {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}

.intro-find-btn--large {
  padding: 10px 24px;
  font-size: 1rem;
  border-radius: 10px;
}

.intro-find-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.intro-find-btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ── Scale / dimmed / changed key states ──────────────────── */

.intro-kb-key--dimmed {
  opacity: 0.35 !important;
  filter: saturate(0.3);
}

.intro-kb-key--scale.intro-kb-key--white {
  background: var(--color-primary, #6c5ce7);
  box-shadow: inset 0 0 0 2px var(--color-primary, #6c5ce7);
}

.intro-kb-key--scale.intro-kb-key--black {
  background: var(--color-primary-light, #a29bfe);
  box-shadow: inset 0 0 0 2px var(--color-primary-light, #a29bfe);
}

.intro-kb-key--scale .intro-kb-label {
  opacity: 1;
  color: #fff;
}

.intro-kb-key--changed.intro-kb-key--white {
  background: var(--color-secondary, #00cec9);
  box-shadow: inset 0 0 0 2px var(--color-secondary, #00cec9);
}

.intro-kb-key--changed.intro-kb-key--black {
  background: var(--color-secondary-light, #81ecec);
  box-shadow: inset 0 0 0 2px var(--color-secondary-light, #81ecec);
}

.intro-kb-key--changed .intro-kb-label {
  opacity: 1;
  color: #fff;
}

/* ── Step pattern display ─────────────────────────────────── */

.ch2-step-pattern {
  display: flex;
  gap: 6px;
  justify-content: center;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
  min-height: 1.5em;
}

.ch2-step-pattern__step {
  opacity: 0;
  transition: opacity 0.3s ease;
  min-width: 1.5ch;
  text-align: center;
}

.ch2-step-pattern__step--visible {
  opacity: 1;
}

.ch2-step-pattern__step--half {
  color: var(--color-accent-dark, #f39c12);
}

/* ── Scale label + notes display ─────────────────────────── */

.ch2-scale-label {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
  letter-spacing: 0.04em;
  min-height: 1.5em;
}

.ch2-scale-notes {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
  text-align: center;
  letter-spacing: 0.15em;
  min-height: 1.4em;
}

/* ── Root picker buttons ──────────────────────────────────── */

.ch2-root-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
}

.ch2-root-btn {
  padding: 5px 10px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 6px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
  min-width: 2.8ch;
  text-align: center;
}

.ch2-root-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
}

.ch2-root-btn--active {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
  color: #fff;
}

/* ── Interval display (section 1) ─────────────────────────── */

.ch2-interval-display {
  text-align: center;
  min-height: 3.5em;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.ch2-interval-name {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
}

.ch2-interval-semitones {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted, #b2bec3);
}

.ch2-interval-prompt {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary, #636e72);
  font-style: italic;
}

/* ── Root section fade-in (section 2 phase 2) ─────────────── */

.ch2-root-section {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.4s ease, opacity 0.4s ease;
}

.ch2-root-section--visible {
  max-height: 200px;
  opacity: 1;
}

.ch2-root-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
  text-align: center;
  margin-bottom: 6px;
  letter-spacing: 0.03em;
}

/* ── Interactive placeholder border ───────────────────────── */

.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
  border-style: solid;
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch2-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch2-styles';
  el.textContent = CH2_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

const _mounted = new Set();

// Section 1 — interval explorer
let _s1Widget = null;
let _s1Kb = null;
let _s1Note1 = null;          // first selected noteId ("C4")
let _s1Note2 = null;          // second selected noteId
let _s1IntervalDisplay = null;

// Section 2 — scale builder + root picker (two phases)
let _s2Widget = null;
let _s2Kb = null;
let _s2Anims = [];            // pending setTimeout IDs
let _s2Phase = 1;             // 1 = initial build, 2 = root picker active
let _s2StepEls = [];          // the 7 step <span> elements
let _s2ScaleLabelEl = null;
let _s2ScaleNotesEl = null;
let _s2BuildBtn = null;
let _s2RootSection = null;    // container that fades in during phase 2
let _s2ActiveRootBtn = null;
let _s2CBtn = null;           // reference to C root button

// Section 3 (was 4) — major/minor toggle
let _s4Widget = null;
let _s4Kb = null;
let _s4Anims = [];
let _s4Mode = 'major';
let _s4PatternEl = null;
let _s4ScaleNotesEl = null;
let _s4MajorBtn = null;
let _s4MinorBtn = null;

// ════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ════════════════════════════════════════════════════════════════════

function _cancelAnims(arr) {
  arr.forEach(id => clearTimeout(id));
  arr.length = 0;
}

function _clearScaleHighlights(kb) {
  kb.keys.forEach(el => {
    el.classList.remove(
      'intro-kb-key--scale', 'intro-kb-key--changed',
      'intro-kb-key--dimmed', 'intro-kb-key--show-label',
    );
  });
}

/**
 * Like _scheduleAscending but also animates key highlights one at a time.
 * At startMs: clears all highlights and dims non-scale notes.
 * At startMs + (i+1)*delayMs: plays note[i] and adds the scale highlight class.
 * Highlights accumulate — when the sequence ends, all scale notes are lit.
 */
function _scheduleAscendingWithHighlights(anims, kb, scalePcs, noteIds, delayMs, startMs = 0) {
  const scaleSet = new Set(scalePcs);
  // Clear all highlights; dim non-scale keys immediately at startMs
  anims.push(setTimeout(() => {
    kb.keys.forEach(el => {
      const pc = parseInt(el.dataset.pc);
      el.classList.remove(
        'intro-kb-key--scale', 'intro-kb-key--changed',
        'intro-kb-key--dimmed', 'intro-kb-key--show-label',
      );
      if (!scaleSet.has(pc)) el.classList.add('intro-kb-key--dimmed');
    });
  }, startMs));

  // Highlight + play each note, staggered by delayMs (first note at startMs + delayMs)
  noteIds.forEach((id, i) => {
    anims.push(setTimeout(() => {
      ensureTone();
      ensureSampler();
      playSamplerNote(id, '8n');
      const el = kb.keys.get(id);
      if (el) el.classList.add('intro-kb-key--scale', 'intro-kb-key--show-label');
    }, startMs + (i + 1) * delayMs));
  });
}

// ════════════════════════════════════════════════════════════════════
// SECTION 1: THE SPACE BETWEEN — Interval Explorer
// ════════════════════════════════════════════════════════════════════

function _mountS1(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  _s1Widget = document.createElement('div');
  _s1Widget.className = 'intro-widget';
  host.appendChild(_s1Widget);

  // Interval display (above keyboard)
  _s1IntervalDisplay = document.createElement('div');
  _s1IntervalDisplay.className = 'ch2-interval-display';
  _s1IntervalDisplay.innerHTML = '&nbsp;';
  _s1Widget.appendChild(_s1IntervalDisplay);

  // Keyboard: C3–B4 (2 octaves)
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  _s1Widget.appendChild(scroll);

  ensureSampler();
  _s1Kb = buildKeyboard(scroll, 3, 2, {
    showLabels: false,
    onNoteDown(_name, oct, keyEl) {
      _handleS1NoteDown(oct, keyEl);
    },
  });

  // Preset + Clear buttons (below keyboard)
  const presetRow = document.createElement('div');
  presetRow.className = 'intro-find-btn-row';

  // Octave preset: C3+C4 (both in range; same 12-semitone interval as C4+C5)
  const presets = [
    { label: 'Half step',   n1: 'C4', n2: 'C#4' },
    { label: 'Whole step',  n1: 'C4', n2: 'D4'  },
    { label: 'Perfect 5th', n1: 'C4', n2: 'G4'  },
    { label: 'Octave',      n1: 'C3', n2: 'C4'  },
  ];

  presets.forEach(({ label, n1, n2 }) => {
    const btn = document.createElement('button');
    btn.className = 'intro-find-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      ensureTone();
      _playS1Preset(n1, n2);
    });
    presetRow.appendChild(btn);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'intro-find-btn';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    _clearS1Selection();
    _s1IntervalDisplay.innerHTML = '&nbsp;';
  });
  presetRow.appendChild(clearBtn);

  _s1Widget.appendChild(presetRow);
}

function _handleS1NoteDown(oct, keyEl) {
  const noteId = keyEl.dataset.note;

  if (_s1Note2 !== null) {
    // Already have two notes — reset and treat this as the new first note
    _clearS1Selection();
    _s1Note1 = noteId;
    keyEl.classList.add('intro-kb-key--active');
    _s1IntervalDisplay.innerHTML = '<span class="ch2-interval-prompt">Now pick a second note</span>';
    return;
  }

  if (_s1Note1 === null) {
    // First note
    _s1Note1 = noteId;
    keyEl.classList.add('intro-kb-key--active');
    _s1IntervalDisplay.innerHTML = '<span class="ch2-interval-prompt">Now pick a second note</span>';
    return;
  }

  if (noteId === _s1Note1) {
    // Same key tapped again — clear
    _clearS1Selection();
    _s1IntervalDisplay.innerHTML = '&nbsp;';
    return;
  }

  // Second note — compute and display the interval
  _s1Note2 = noteId;
  keyEl.classList.add('intro-kb-key--active');

  const el1 = _s1Kb.keys.get(_s1Note1);
  const pc1 = parseInt(el1.dataset.pc);
  const oct1 = parseInt(el1.dataset.octave);
  const pc2 = parseInt(keyEl.dataset.pc);
  const midi1 = (oct1 + 1) * 12 + pc1;
  const midi2 = (oct + 1) * 12 + pc2;
  const semitones = Math.abs(midi2 - midi1);

  // Replay note1 so both ring together (note2 already triggered by buildKeyboard)
  playSamplerNote(_s1Note1, '2n');
  _showS1IntervalInfo(semitones);
}

function _showS1IntervalInfo(semitones) {
  const name = INTERVAL_NAMES[semitones] ?? `${semitones} semitones`;
  _s1IntervalDisplay.innerHTML =
    `<div class="ch2-interval-name">${name}</div>` +
    `<div class="ch2-interval-semitones">${semitones} semitone${semitones === 1 ? '' : 's'}</div>`;
}

function _clearS1Selection() {
  if (_s1Kb) {
    if (_s1Note1) _s1Kb.keys.get(_s1Note1)?.classList.remove('intro-kb-key--active');
    if (_s1Note2) _s1Kb.keys.get(_s1Note2)?.classList.remove('intro-kb-key--active');
  }
  _s1Note1 = null;
  _s1Note2 = null;
}

function _playS1Preset(n1Id, n2Id) {
  _clearS1Selection();
  _s1Note1 = n1Id;
  _s1Note2 = n2Id;
  _s1Kb.keys.get(n1Id)?.classList.add('intro-kb-key--active');
  _s1Kb.keys.get(n2Id)?.classList.add('intro-kb-key--active');

  playSamplerNote(n1Id, '2n');
  playSamplerNote(n2Id, '2n');

  const el1 = _s1Kb.keys.get(n1Id);
  const el2 = _s1Kb.keys.get(n2Id);
  const midi1 = (parseInt(el1.dataset.octave) + 1) * 12 + parseInt(el1.dataset.pc);
  const midi2 = (parseInt(el2.dataset.octave) + 1) * 12 + parseInt(el2.dataset.pc);
  _showS1IntervalInfo(Math.abs(midi2 - midi1));
}

// ════════════════════════════════════════════════════════════════════
// SECTION 2: PICKING SEVEN — Scale Builder
// ════════════════════════════════════════════════════════════════════

function _mountS2(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  _s2Widget = document.createElement('div');
  _s2Widget.className = 'intro-widget';
  host.appendChild(_s2Widget);

  // Step pattern — 7 spans, initially invisible
  const patternDiv = document.createElement('div');
  patternDiv.className = 'ch2-step-pattern';
  _s2StepEls = [];
  MAJOR_PATTERN.forEach(step => {
    const span = document.createElement('span');
    span.className = 'ch2-step-pattern__step' + (step === 1 ? ' ch2-step-pattern__step--half' : '');
    span.textContent = step === 2 ? 'W' : 'H';
    patternDiv.appendChild(span);
    _s2StepEls.push(span);
  });
  _s2Widget.appendChild(patternDiv);

  // Scale label + notes (hidden until build completes)
  _s2ScaleLabelEl = document.createElement('div');
  _s2ScaleLabelEl.className = 'ch2-scale-label';
  _s2ScaleLabelEl.style.visibility = 'hidden';
  _s2Widget.appendChild(_s2ScaleLabelEl);

  _s2ScaleNotesEl = document.createElement('div');
  _s2ScaleNotesEl.className = 'ch2-scale-notes';
  _s2ScaleNotesEl.style.visibility = 'hidden';
  _s2Widget.appendChild(_s2ScaleNotesEl);

  // Keyboard: C3–B4
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  _s2Widget.appendChild(scroll);

  ensureSampler();
  _s2Kb = buildKeyboard(scroll, 3, 2, { showLabels: false });

  // Build It button (phase 1 only)
  const btnRow = document.createElement('div');
  btnRow.className = 'intro-find-btn-row';

  _s2BuildBtn = document.createElement('button');
  _s2BuildBtn.className = 'intro-find-btn';
  _s2BuildBtn.textContent = 'Build It';
  _s2BuildBtn.addEventListener('click', () => {
    if (_s2Phase === 1 && !_s2BuildBtn.disabled) _startS2Build(0, null);
  });
  btnRow.appendChild(_s2BuildBtn);
  _s2Widget.appendChild(btnRow);

  // Root picker section — hidden until phase 2
  _s2RootSection = document.createElement('div');
  _s2RootSection.className = 'ch2-root-section';

  const rootLabel = document.createElement('div');
  rootLabel.className = 'ch2-root-label';
  rootLabel.textContent = 'Try it from a different root';
  _s2RootSection.appendChild(rootLabel);

  const rootRow = document.createElement('div');
  rootRow.className = 'ch2-root-row';
  _s2CBtn = null;

  CHROMATIC.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'ch2-root-btn';
    btn.textContent = note.name;
    btn.dataset.pc = note.pc;
    btn.addEventListener('click', () => {
      if (_s2Phase === 2) _startS2Build(note.pc, btn);
    });
    rootRow.appendChild(btn);
    if (note.pc === 0) _s2CBtn = btn;
  });
  _s2RootSection.appendChild(rootRow);
  _s2Widget.appendChild(_s2RootSection);
}

/**
 * Run the step-by-step build animation for the given rootPc.
 * Phase 1: rootPc=0, btn=null (initial C major build).
 * Phase 2: any rootPc, btn = the clicked root button.
 */
function _startS2Build(rootPc, btn) {
  _cancelAnims(_s2Anims);
  _resetS2Visual();

  if (_s2Phase === 1) _s2BuildBtn.disabled = true;

  // Update active root button (phase 2 only)
  if (btn) {
    if (_s2ActiveRootBtn) _s2ActiveRootBtn.classList.remove('ch2-root-btn--active');
    btn.classList.add('ch2-root-btn--active');
    _s2ActiveRootBtn = btn;
  }

  const scalePcs = buildScale(rootPc, MAJOR_PATTERN);
  const scalePcsSet = new Set(scalePcs);
  const noteIds = getScaleAscendingIds(rootPc, scalePcs, _s2Kb);

  // Step-by-step: highlight + play each note, reveal step[i-1] when note i plays
  noteIds.forEach((noteId, i) => {
    _s2Anims.push(setTimeout(() => {
      ensureTone();
      ensureSampler();
      const el = _s2Kb.keys.get(noteId);
      if (el) el.classList.add('intro-kb-key--active', 'intro-kb-key--show-label');
      playSamplerNote(noteId, '4n');
      if (i > 0 && _s2StepEls[i - 1]) {
        _s2StepEls[i - 1].classList.add('ch2-step-pattern__step--visible');
      }
    }, i * 600));
  });

  // Quick ascending run after the build
  const quickStart = (noteIds.length - 1) * 600 + 400;
  noteIds.forEach((noteId, i) => {
    _s2Anims.push(setTimeout(() => playSamplerNote(noteId, '8n'), quickStart + i * 200));
  });

  // Finalize: scale/dimmed highlights, show label + notes
  const finalize = quickStart + noteIds.length * 200 + 300;
  _s2Anims.push(setTimeout(() => {
    _s2Kb.keys.forEach(el => {
      const pc = parseInt(el.dataset.pc);
      el.classList.remove('intro-kb-key--active', 'intro-kb-key--show-label');
      if (scalePcsSet.has(pc)) {
        el.classList.add('intro-kb-key--scale', 'intro-kb-key--show-label');
      } else {
        el.classList.add('intro-kb-key--dimmed');
      }
    });
    _s2ScaleLabelEl.textContent = `${getNoteName(rootPc)} Major Scale`;
    _s2ScaleLabelEl.style.visibility = 'visible';
    _s2ScaleNotesEl.textContent = scalePcs.map(pc => getNoteName(pc)).join('  ');
    _s2ScaleNotesEl.style.visibility = 'visible';

    if (_s2Phase === 1) {
      // Transition to phase 2: hide build button, fade in root picker
      _s2Phase = 2;
      _s2BuildBtn.style.display = 'none';
      if (_s2CBtn) {
        _s2CBtn.classList.add('ch2-root-btn--active');
        _s2ActiveRootBtn = _s2CBtn;
      }
      _s2RootSection.classList.add('ch2-root-section--visible');
    }
  }, finalize));
}

function _resetS2Visual() {
  _s2Kb.keys.forEach(el => {
    el.classList.remove(
      'intro-kb-key--active', 'intro-kb-key--scale',
      'intro-kb-key--dimmed', 'intro-kb-key--show-label',
    );
  });
  _s2StepEls.forEach(s => s.classList.remove('ch2-step-pattern__step--visible'));
  _s2ScaleLabelEl.style.visibility = 'hidden';
  _s2ScaleNotesEl.style.visibility = 'hidden';
}

function _resetS2() {
  _cancelAnims(_s2Anims);
  _resetS2Visual();
  _s2Phase = 1;
  _s2BuildBtn.style.display = '';
  _s2BuildBtn.disabled = false;
  _s2BuildBtn.textContent = 'Build It';
  _s2RootSection.classList.remove('ch2-root-section--visible');
  if (_s2ActiveRootBtn) {
    _s2ActiveRootBtn.classList.remove('ch2-root-btn--active');
    _s2ActiveRootBtn = null;
  }
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: THE MINOR TURN — Major/Minor Toggle
// ════════════════════════════════════════════════════════════════════

function _mountS4(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  _s4Widget = document.createElement('div');
  _s4Widget.className = 'intro-widget';
  host.appendChild(_s4Widget);

  // Toggle buttons
  const toggleRow = document.createElement('div');
  toggleRow.className = 'intro-find-btn-row';

  _s4MajorBtn = document.createElement('button');
  _s4MajorBtn.className = 'intro-find-btn intro-find-btn--large';
  _s4MajorBtn.textContent = 'C Major';
  _s4MajorBtn.addEventListener('click', () => _selectS4Mode('major'));

  _s4MinorBtn = document.createElement('button');
  _s4MinorBtn.className = 'intro-find-btn intro-find-btn--large';
  _s4MinorBtn.textContent = 'C Minor';
  _s4MinorBtn.addEventListener('click', () => _selectS4Mode('minor'));

  toggleRow.append(_s4MajorBtn, _s4MinorBtn);
  _s4Widget.appendChild(toggleRow);

  // Step pattern display
  _s4PatternEl = document.createElement('div');
  _s4PatternEl.className = 'ch2-step-pattern';
  _s4Widget.appendChild(_s4PatternEl);

  // Scale notes display
  _s4ScaleNotesEl = document.createElement('div');
  _s4ScaleNotesEl.className = 'ch2-scale-notes';
  _s4ScaleNotesEl.innerHTML = '&nbsp;';
  _s4Widget.appendChild(_s4ScaleNotesEl);

  // Keyboard: C3–B4
  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  _s4Widget.appendChild(scroll);

  ensureSampler();
  _s4Kb = buildKeyboard(scroll, 3, 2, { showLabels: false });

  // "Play both" button below the keyboard
  const playBothBtn = document.createElement('button');
  playBothBtn.className = 'intro-find-btn';
  playBothBtn.textContent = 'Play both';
  playBothBtn.addEventListener('click', _playBothS4);
  _s4Widget.appendChild(playBothBtn);
}

function _selectS4Mode(mode) {
  _s4Mode = mode;
  _cancelAnims(_s4Anims);
  ensureTone();
  ensureSampler();

  const isMajor = mode === 'major';
  const scalePcs = isMajor ? C_MAJOR_PCS : C_MINOR_PCS;
  const pattern = isMajor ? MAJOR_PATTERN : MINOR_PATTERN;

  _s4MajorBtn.classList.toggle('intro-find-btn--selected', isMajor);
  _s4MinorBtn.classList.toggle('intro-find-btn--selected', !isMajor);

  // Step pattern (all visible immediately on toggle)
  _s4PatternEl.innerHTML = '';
  pattern.forEach(step => {
    const span = document.createElement('span');
    span.className = 'ch2-step-pattern__step ch2-step-pattern__step--visible' +
      (step === 1 ? ' ch2-step-pattern__step--half' : '');
    span.textContent = step === 2 ? 'W' : 'H';
    _s4PatternEl.appendChild(span);
  });

  // Scale notes (prefer flats for minor: E♭, A♭, B♭)
  _s4ScaleNotesEl.textContent = scalePcs.map(pc => getNoteName(pc, !isMajor)).join('  ');

  const noteIds = getScaleAscendingIds(0, scalePcs, _s4Kb);
  _scheduleAscendingWithHighlights(_s4Anims, _s4Kb, scalePcs, noteIds, 250);
}

function _applyS4Display(isMajor) {
  const scalePcs = isMajor ? C_MAJOR_PCS : C_MINOR_PCS;
  const pattern = isMajor ? MAJOR_PATTERN : MINOR_PATTERN;

  _s4MajorBtn.classList.toggle('intro-find-btn--selected', isMajor);
  _s4MinorBtn.classList.toggle('intro-find-btn--selected', !isMajor);

  _s4PatternEl.innerHTML = '';
  pattern.forEach(step => {
    const span = document.createElement('span');
    span.className = 'ch2-step-pattern__step ch2-step-pattern__step--visible' +
      (step === 1 ? ' ch2-step-pattern__step--half' : '');
    span.textContent = step === 2 ? 'W' : 'H';
    _s4PatternEl.appendChild(span);
  });

  _s4ScaleNotesEl.textContent = scalePcs.map(pc => getNoteName(pc, !isMajor)).join('  ');
}

function _playBothS4() {
  _cancelAnims(_s4Anims);
  ensureTone();
  ensureSampler();

  // — C Major first —
  _applyS4Display(true);
  const majorIds = getScaleAscendingIds(0, C_MAJOR_PCS, _s4Kb);
  _scheduleAscendingWithHighlights(_s4Anims, _s4Kb, C_MAJOR_PCS, majorIds, 200, 0);

  // — Pause, then C Minor —
  // Last major note fires at majorIds.length * 200ms; add 800ms pause
  const pauseStart = majorIds.length * 200 + 800;
  _s4Anims.push(setTimeout(() => {
    _s4Mode = 'minor';
    _applyS4Display(false);
  }, pauseStart));

  const minorIds = getScaleAscendingIds(0, C_MINOR_PCS, _s4Kb);
  _scheduleAscendingWithHighlights(_s4Anims, _s4Kb, C_MINOR_PCS, minorIds, 200, pauseStart);
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════

registerCleanup(function _ch2Cleanup() {
  if (_s1Kb) { _s1Kb.cleanup(); _s1Kb = null; }
  if (_s2Kb) { _s2Kb.cleanup(); _s2Kb = null; }
  if (_s4Kb) { _s4Kb.cleanup(); _s4Kb = null; }
  _cancelAnims(_s2Anims);
  _cancelAnims(_s4Anims);
});

// ════════════════════════════════════════════════════════════════════
// CHAPTER EXPORTS
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 2,
  title: 'Intervals & Scales',
  tone: 'playful',
  description: 'Why do some notes sound good together? Meet intervals, the major scale, and its darker twin.',
};

export const sections = [
  {
    id: 'ch2-the-space-between',
    title: 'The Space Between',
    narration:
      'Play two notes at the same time. Some combinations sound smooth and stable. ' +
      'Others sound tense, like they want to move somewhere. ' +
      'The distance between any two notes is called an interval — ' +
      'and intervals are the building blocks of everything in music.',
    interactive: 'interval-explorer',
    tryIt: 'Try the presets first, then pick your own pairs. Which intervals sound smooth? Which ones clash?',
    onActivate(sectionEl) {
      if (_mounted.has('ch2-the-space-between')) return;
      _mounted.add('ch2-the-space-between');
      _mountS1(sectionEl);
    },
    onEnter(_sectionEl) {
      _clearS1Selection();
      if (_s1IntervalDisplay) _s1IntervalDisplay.innerHTML = '&nbsp;';
    },
    onLeave(_sectionEl) {
      _clearS1Selection();
      if (_s1IntervalDisplay) _s1IntervalDisplay.innerHTML = '&nbsp;';
    },
  },
  {
    id: 'ch2-picking-seven',
    title: 'Picking Seven',
    narration:
      'Of the 12 notes in an octave, most songs only use 7 at a time. ' +
      'The most common set is called the major scale — it\'s the "do re mi" you already know. ' +
      'The secret is the pattern of steps between the notes: whole, whole, half, whole, whole, whole, half. ' +
      'Start on any note, follow that pattern, and you\'ve built a major scale. ' +
      'That starting note is called the root — it\'s home base, and it gives the scale its name.',
    interactive: 'scale-builder',
    tryIt: 'Hit Build and watch the pattern unfold. Then pick a different root — the pattern is always the same.',
    onActivate(sectionEl) {
      if (_mounted.has('ch2-picking-seven')) return;
      _mounted.add('ch2-picking-seven');
      _mountS2(sectionEl);
    },
    onEnter(_sectionEl) {
      if (_s2Kb) _resetS2();
    },
    onLeave(_sectionEl) {
      if (_s2Kb) _resetS2();
    },
  },
  {
    id: 'ch2-the-minor-turn',
    title: 'The Minor Turn',
    narration:
      'Same 12 notes, different recipe. The minor scale follows a different step pattern: ' +
      'whole, half, whole, whole, half, whole, whole. ' +
      'It sounds darker, more serious, sometimes sad. ' +
      'Major and minor are two sides of the same coin — and how they connect is one of the ' +
      'deepest ideas in music. But that\'s the next chapter.',
    interactive: 'major-minor-toggle',
    tryIt: 'Toggle between major and minor. Three notes change — can you hear which ones?',
    gameLink: {
      game: 'harmony-trainer',
      label: 'Train your ear to hear intervals →',
      url: '/harmony',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch2-the-minor-turn')) return;
      _mounted.add('ch2-the-minor-turn');
      _mountS4(sectionEl);
    },
    onEnter(_sectionEl) {
      // Default to C Major on every entry
      if (_s4Kb) _selectS4Mode('major');
    },
    onLeave(_sectionEl) {
      _cancelAnims(_s4Anims);
      if (_s4Kb) _clearScaleHighlights(_s4Kb);
    },
  },
];
