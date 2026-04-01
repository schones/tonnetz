/**
 * scale-builder.js
 * ================
 * Scale Builder — build major and minor scales note by note.
 * 4 stages, each with Intro → Practice → Test.
 *
 * Stage 1: The Major Scale Pattern (keyboard only)
 * Stage 2: Tetrachords & Fourths (keyboard only)
 * Stage 3: Keys Are Connected (Tonnetz + keyboard)
 * Stage 4: Major and Minor Are Relatives (Tonnetz + keyboard)
 *
 * Depends on:
 *   - transforms.js        → noteToPC, pcToNote, spellingForKey, NOTE_NAMES
 *   - harmony-state.js     → HarmonyState
 *   - tonnetz-neighborhood.js → TonnetzNeighborhood
 *   - keyboard-view.js     → KeyboardView
 *   - Tone.js (CDN)
 */

import { HarmonyState } from '../shared/harmony-state.js';
import { TonnetzNeighborhood } from '../shared/tonnetz-neighborhood.js';
import { KeyboardView } from '../shared/keyboard-view.js';
import {
  noteToPC,
  pcToNote,
  spellingForKey,
} from '../shared/transforms.js';
import { createMascot } from '../shared/mascot.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const MAJOR_PATTERN = [0, 2, 4, 5, 7, 9, 11]; // W-W-H-W-W-W-H
const MINOR_PATTERN = [0, 2, 3, 5, 7, 8, 10]; // W-H-W-W-H-W-W
const ROUNDS_PER_TEST = 10;
const NOTE_DELAY = 180; // ms between notes in scale playback

// Root pools (as pitch classes)
const EASY_ROOTS = [0, 7, 2, 5, 10]; // C, G, D, F, Bb

// Circle of fifths chain (sharps then flats)
const FIFTHS_SHARPS = [0, 7, 2, 9, 4]; // C, G, D, A, E
const FIFTHS_FLATS  = [5, 10, 3];       // F, Bb, Eb
const FIFTHS_CHAIN  = [...FIFTHS_SHARPS, ...FIFTHS_FLATS];

const ENCOURAGEMENTS = [
  'Nice!', 'Correct!', 'You got it!', 'Well done!',
  'Great work!', 'Perfect!', 'Nailed it!',
];

const REFRESHER_TEXT = {
  1: 'Major scales follow W \u2013 W \u2013 H \u2013 W \u2013 W \u2013 W \u2013 H from any starting note.',
  2: 'A major scale is two identical tetrachords (W\u2013W\u2013H), connected by a whole step.',
  3: 'The top tetrachord of one key becomes the bottom tetrachord of the next.',
  4: 'Every major key has a relative minor starting on its 6th note \u2014 same notes, different root.',
};

const INTRO_STEP_COUNTS = { 1: 5, 2: 6, 3: 5, 4: 4 };

// Mascot expression per stage + step (0-indexed arrays, step 1 → index 0)
const MASCOT_INTRO_EXPR = {
  1: ['neutral', 'encouraging', 'encouraging', 'encouraging', 'excited'],
  2: ['neutral', 'thinking', 'aha', 'thinking', 'encouraging', 'excited'],
  3: ['neutral', 'thinking', 'aha', 'excited', 'aha'],
  4: ['neutral', 'listening', 'aha', 'encouraging'],
};

const STAGE_NAMES = {
  1: 'The Major Scale Pattern',
  2: 'Tetrachords & Fourths',
  3: 'Keys Are Connected',
  4: 'Major and Minor Are Relatives',
};

// Colors
const CLR_ROOT       = '#f59e0b';
const CLR_CORRECT    = '#10b981';
const CLR_TETRA_BOT  = '#38bdf8';
const CLR_TETRA_TOP  = '#a78bfa';
const CLR_DIMMED     = 'rgba(108, 99, 255, 0.25)';

// Interval labels for major scale steps (index = step number)
const MAJOR_INTERVALS = ['', 'W', 'W', 'H', 'W', 'W', 'W', 'H'];

// Which stages show the Tonnetz
const TONNETZ_STAGES = new Set([3, 4]);

// ════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════

let currentStage = 1;
let currentMode  = 'intro'; // 'intro' | 'practice' | 'test'

// Intro state
let introStepIdx   = { 1: 1, 2: 1, 3: 1, 4: 1 };
let introSeen      = { 1: false, 2: false, 3: false, 4: false };
let introAnimating = false;
let introPlaybackId = 0; // cancel stale animations

// Selection / round state
let selectedPCs    = new Set();
let targetPCs      = []; // pitch classes the player needs to select
let rootPC         = 0;
let wrongClicks    = 0;
let roundComplete  = false;

// Stage 2 state
let s2Phase     = 'bottom'; // 'bottom' | 'top'
let s2BottomPCs = [];
let s2TopPCs    = [];

// Stage 3 state
let s3ChainIdx  = 0;
let s3PrevPCs   = []; // previous key's scale PCs (dimmed)
let s3PrevRoot  = -1;

// Stage 4 state
let s4MajorRoot   = 0;
let s4MinorRoot   = 0;

// Practice stats (per stage)
let practiceStats = {
  1: { streak: 0, rounds: 0 },
  2: { streak: 0, rounds: 0 },
  3: { streak: 0, rounds: 0 },
  4: { streak: 0, rounds: 0 },
};

// Test state
let testRound = 0;
let testScore = 0;
let testRoots = []; // pre-generated root list for current test

// Audio
let sampler      = null;
let audioStarted = false;
let isPlaying    = false;
let playbackGen  = 0; // incremented to cancel in-flight sequences

// Refresher
let refresherDismissed = { 1: false, 2: false, 3: false, 4: false };

// Mascot state
let introCompleted = { 1: false, 2: false, 3: false, 4: false };
let mascotPopupTimer = null;

// Tonnetz init flag
let tonnetzInited = false;

// ════════════════════════════════════════════════════════════════════
// DOM
// ════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Compute scale pitch classes from root + interval pattern. */
function computeScale(root, pattern) {
  return pattern.map(i => (root + i) % 12);
}

/** Get a display-friendly note name for a PC in a key context. */
function spellPC(pc, keyRoot) {
  const rootName = pcToNote(keyRoot);
  const spell = spellingForKey(rootName, 'major');
  return spell(pc);
}

/** Display-friendly note name (ASCII sharps/flats). */
function displayNote(pc, keyRoot) {
  return spellPC(pc, keyRoot != null ? keyRoot : pc)
    .replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
}

// ════════════════════════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════════════════════════

async function ensureAudio() {
  if (sampler) return;
  sampler = await KeyboardView.getSampler();
}

/** Play a single note by pitch class. */
async function playNotePC(pc, octave) {
  octave = octave || 4;
  await ensureAudio();
  const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
  try {
    sampler.triggerAttackRelease(`${name}${octave}`, '4n', Tone.now());
  } catch (_) { /* ignore */ }
}

/** Play two notes together (interval). */
async function playIntervalPC(pc1, pc2, octave) {
  octave = octave || 4;
  await ensureAudio();
  const n1 = pcToNote(pc1).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
  const n2 = pcToNote(pc2).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
  const oct2 = pc2 <= pc1 ? octave + 1 : octave;
  try {
    const now = Tone.now();
    sampler.triggerAttackRelease(`${n1}${octave}`, '4n', now);
    sampler.triggerAttackRelease(`${n2}${oct2}`, '4n', now);
  } catch (_) { /* ignore */ }
}

/** Play a sequence of pitch classes ascending, assigning octaves automatically. */
async function playScaleAsc(pcs, startOctave, pauseAfterIndices) {
  startOctave = startOctave || 4;
  await ensureAudio();
  const myGen = ++playbackGen;
  isPlaying = true;

  let oct = startOctave;
  let prevPC = -1;
  for (let i = 0; i < pcs.length; i++) {
    const pc = pcs[i];
    if (playbackGen !== myGen) { isPlaying = false; return; }
    if (prevPC >= 0 && pc <= prevPC) oct++;
    prevPC = pc;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    try {
      sampler.triggerAttackRelease(`${name}${oct}`, '8n', Tone.now());
    } catch (_) { /* ignore */ }
    // Pause longer at seams if specified
    if (pauseAfterIndices && pauseAfterIndices.includes(i)) {
      await delay(NOTE_DELAY * 2.5);
    } else {
      await delay(NOTE_DELAY);
    }
  }
  isPlaying = false;
}

function stopAudio() {
  isPlaying = false;
  playbackGen++;
  try { if (sampler) sampler.releaseAll(); } catch (_) { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════════════════════════════

function setNarration(text) { $('narration-text').textContent = text; }
function setSubtext(text) { $('narration-subtext').textContent = text; }
function setPrompt(text) { $('prompt-text').textContent = text; }
function setCallout(text) { $('callout-text').textContent = text; }

function setFeedback(text, type) {
  const el = $('feedback-area');
  el.textContent = text;
  el.className = 'sb-feedback' + (type ? ` sb-feedback--${type}` : '');
}

function clearFeedback() {
  const el = $('feedback-area');
  el.textContent = '';
  el.className = 'sb-feedback';
}

function enableNext() { $('btn-next').disabled = false; }
function disableNext() { $('btn-next').disabled = true; }

function showSection(id) { $(id).style.display = ''; }
function hideSection(id) { $(id).style.display = 'none'; }

// ════════════════════════════════════════════════════════════════════
// HIGHLIGHT MANAGEMENT
// ════════════════════════════════════════════════════════════════════

const HL_CLASSES = [
  'sb-hl-root', 'sb-hl-correct', 'sb-hl-tetra-bottom', 'sb-hl-tetra-top',
  'sb-hl-dimmed', 'sb-hl-ref', 'sb-hl-wrong', 'sb-hl-hint', 'sb-hl-skipped',
  'sb-hl-pulse',
];

function clearKeyboardHL() {
  document.querySelectorAll('#keyboard-container .kv-key').forEach(el => {
    HL_CLASSES.forEach(c => el.classList.remove(c));
  });
}

/** Apply a CSS class to all keyboard keys with the given pitch class. */
function addKeyHL(pc, cls) {
  document.querySelectorAll(`#keyboard-container .kv-key[data-pc="${pc}"]`)
    .forEach(el => el.classList.add(cls));
}

/** Apply a CSS class to a specific key by note+octave (e.g. "C4"). */
function addKeyHLByNote(noteOctave, cls) {
  const el = document.querySelector(`#keyboard-container .kv-key[data-note="${noteOctave}"]`);
  if (el) el.classList.add(cls);
}

/** Flash wrong on a pitch class. */
function flashWrong(pc) {
  document.querySelectorAll(`#keyboard-container .kv-key[data-pc="${pc}"]`)
    .forEach(el => {
      el.classList.add('sb-hl-wrong');
      el.addEventListener('animationend', () => el.classList.remove('sb-hl-wrong'), { once: true });
    });
}

/**
 * Update both Tonnetz and keyboard highlights.
 * @param {number[]} pcs - pitch classes to highlight
 * @param {Object} opts
 * @param {number} opts.rootPC - root pitch class (gold)
 * @param {Set<number>} [opts.tetraBottom] - bottom tetrachord PCs (blue)
 * @param {Set<number>} [opts.tetraTop] - top tetrachord PCs (purple)
 * @param {Set<number>} [opts.dimmedPCs] - dimmed PCs (previous key)
 * @param {Set<number>} [opts.refPCs] - reference PCs (stage 4 major scale)
 */
function updateVisuals(pcs, opts) {
  opts = opts || {};
  const rpc = opts.rootPC != null ? opts.rootPC : rootPC;

  // Build color map for Tonnetz
  const colorMap = new Map();
  const allPCs = [...pcs];
  if (opts.dimmedPCs) opts.dimmedPCs.forEach(pc => { if (!allPCs.includes(pc)) allPCs.push(pc); });
  if (opts.refPCs) opts.refPCs.forEach(pc => { if (!allPCs.includes(pc)) allPCs.push(pc); });

  allPCs.forEach(pc => {
    if (opts.dimmedPCs && opts.dimmedPCs.has(pc) && !pcs.includes(pc)) {
      colorMap.set(pc, CLR_DIMMED);
    } else if (opts.refPCs && opts.refPCs.has(pc) && !pcs.includes(pc)) {
      colorMap.set(pc, 'rgba(108, 99, 255, 0.15)');
    } else if (pc === rpc) {
      colorMap.set(pc, CLR_ROOT);
    } else if (opts.tetraBottom && opts.tetraBottom.has(pc)) {
      colorMap.set(pc, CLR_TETRA_BOT);
    } else if (opts.tetraTop && opts.tetraTop.has(pc)) {
      colorMap.set(pc, CLR_TETRA_TOP);
    } else {
      colorMap.set(pc, CLR_CORRECT);
    }
  });

  // Update HarmonyState for Tonnetz (only if Tonnetz is visible)
  if (TONNETZ_STAGES.has(currentStage)) {
    const activeNotes = allPCs.map(pc => ({
      note: pcToNote(pc),
      octave: 4,
      source: 'user',
      color: colorMap.get(pc) || null,
    }));

    HarmonyState.update({
      activeNotes,
      activeTriads: [],
      activeTransform: null,
      activeInterval: null,
      tonnetzCenter: { root: pcToNote(rpc), quality: 'major' },
      tonnetzDepth: 2,
    });
  }

  // Update keyboard
  clearKeyboardHL();
  allPCs.forEach(pc => {
    let cls;
    if (opts.dimmedPCs && opts.dimmedPCs.has(pc) && !pcs.includes(pc)) cls = 'sb-hl-dimmed';
    else if (opts.refPCs && opts.refPCs.has(pc) && !pcs.includes(pc)) cls = 'sb-hl-ref';
    else if (pc === rpc) cls = 'sb-hl-root';
    else if (opts.tetraBottom && opts.tetraBottom.has(pc)) cls = 'sb-hl-tetra-bottom';
    else if (opts.tetraTop && opts.tetraTop.has(pc)) cls = 'sb-hl-tetra-top';
    else cls = 'sb-hl-correct';
    addKeyHL(pc, cls);
  });
}

/** Clear all visuals (Tonnetz + keyboard + interval labels). */
function clearVisuals() {
  if (TONNETZ_STAGES.has(currentStage)) {
    HarmonyState.update({
      activeNotes: [],
      activeTriads: [],
      activeTransform: null,
      activeInterval: null,
    });
  }
  clearKeyboardHL();
  clearIntervalLabels();
}

// ════════════════════════════════════════════════════════════════════
// INTERVAL LABEL SYSTEM (W/H markers between keys)
// ════════════════════════════════════════════════════════════════════

let intervalLabelContainer = null;

function ensureIntervalLabelContainer() {
  if (intervalLabelContainer) return intervalLabelContainer;
  const kbContainer = $('keyboard-container');
  let el = kbContainer.querySelector('.sb-interval-labels');
  if (!el) {
    el = document.createElement('div');
    el.className = 'sb-interval-labels';
    kbContainer.appendChild(el);
  }
  intervalLabelContainer = el;
  return el;
}

function clearIntervalLabels() {
  if (intervalLabelContainer) {
    intervalLabelContainer.innerHTML = '';
  }
}

/**
 * Get the center X position of a key by its note+octave string (e.g. "C4").
 * Returns pixel offset relative to #keyboard-container.
 */
function getKeyCenter(noteOctave) {
  const keyEl = document.querySelector(`#keyboard-container .kv-key[data-note="${noteOctave}"]`);
  if (!keyEl) return null;
  const container = $('keyboard-container');
  const cRect = container.getBoundingClientRect();
  const kRect = keyEl.getBoundingClientRect();
  return {
    x: kRect.left - cRect.left + kRect.width / 2,
    y: kRect.top - cRect.top,
    width: kRect.width,
    height: kRect.height,
    isBlack: keyEl.classList.contains('kv-key--black'),
  };
}

/**
 * Place a W or H label between two keys.
 * @param {string} fromNote - e.g. "C4"
 * @param {string} toNote - e.g. "D4"
 * @param {string} label - "W" or "H"
 */
function addIntervalLabel(fromNote, toNote, label) {
  const container = ensureIntervalLabelContainer();
  const from = getKeyCenter(fromNote);
  const to = getKeyCenter(toNote);
  if (!from || !to) return;

  const el = document.createElement('div');
  el.className = `sb-interval-label sb-interval-label--${label}`;
  el.textContent = label;

  // Position between the two keys, above them
  const midX = (from.x + to.x) / 2;
  el.style.left = `${midX}px`;
  el.style.top = `-2px`;

  container.appendChild(el);
  return el;
}

/**
 * Place a gap label (e.g. "W" for whole-step gap between tetrachords).
 */
function addGapLabel(fromNote, toNote, label) {
  const container = ensureIntervalLabelContainer();
  const from = getKeyCenter(fromNote);
  const to = getKeyCenter(toNote);
  if (!from || !to) return;

  const el = document.createElement('div');
  el.className = 'sb-interval-label sb-interval-label--gap';
  el.textContent = label;

  const midX = (from.x + to.x) / 2;
  el.style.left = `${midX}px`;
  el.style.top = `-2px`;

  container.appendChild(el);
  return el;
}

/**
 * Build note+octave string for a pitch class in octave 4
 * (or 5 if the note wraps past B).
 */
function pcToNoteOctave(pc, startOctave, prevPC) {
  const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
  let oct = startOctave || 4;
  if (prevPC != null && pc <= prevPC) oct++;
  return { noteOctave: `${name}${oct}`, octave: oct };
}

/**
 * Show interval labels for a sequence of scale notes.
 * @param {number[]} pcs - ordered pitch classes
 * @param {string[]} labels - interval labels between each pair (length = pcs.length - 1)
 * @param {number} [startOctave=4]
 */
function showIntervalLabelsForScale(pcs, labels, startOctave) {
  clearIntervalLabels();
  startOctave = startOctave || 4;
  let oct = startOctave;
  let prevPC = -1;

  const noteOctaves = [];
  for (const pc of pcs) {
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    noteOctaves.push(`${name}${oct}`);
    prevPC = pc;
  }

  for (let i = 0; i < labels.length; i++) {
    if (labels[i]) {
      addIntervalLabel(noteOctaves[i], noteOctaves[i + 1], labels[i]);
    }
  }
}

/**
 * Show interval labels incrementally up to a given step index.
 * Used during intro walkthroughs to accumulate labels.
 */
function showIntervalLabelsUpTo(pcs, allLabels, upToIndex, startOctave) {
  clearIntervalLabels();
  startOctave = startOctave || 4;
  let oct = startOctave;
  let prevPC = -1;

  const noteOctaves = [];
  for (const pc of pcs) {
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    noteOctaves.push(`${name}${oct}`);
    prevPC = pc;
  }

  for (let i = 0; i < Math.min(upToIndex, allLabels.length); i++) {
    if (allLabels[i]) {
      addIntervalLabel(noteOctaves[i], noteOctaves[i + 1], allLabels[i]);
    }
  }
}

/**
 * Show tetrachord labels with a gap marker between them.
 * @param {number[]} bottomPCs - bottom tetrachord PCs
 * @param {number[]} topPCs - top tetrachord PCs
 * @param {number} startOctave
 */
function showTetrachordLabels(bottomPCs, topPCs, startOctave) {
  clearIntervalLabels();
  startOctave = startOctave || 4;

  // Bottom tetrachord: W-W-H
  const bottomLabels = ['W', 'W', 'H'];
  let oct = startOctave;
  let prevPC = -1;
  const bottomNotes = [];
  for (const pc of bottomPCs) {
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    bottomNotes.push(`${name}${oct}`);
    prevPC = pc;
  }
  for (let i = 0; i < bottomLabels.length; i++) {
    addIntervalLabel(bottomNotes[i], bottomNotes[i + 1], bottomLabels[i]);
  }

  // Gap between tetrachords
  const topNotes = [];
  for (const pc of topPCs) {
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    topNotes.push(`${name}${oct}`);
    prevPC = pc;
  }

  addGapLabel(bottomNotes[bottomNotes.length - 1], topNotes[0], 'W');

  // Top tetrachord: W-W-H
  const topLabels = ['W', 'W', 'H'];
  for (let i = 0; i < topLabels.length; i++) {
    addIntervalLabel(topNotes[i], topNotes[i + 1], topLabels[i]);
  }
}

// ════════════════════════════════════════════════════════════════════
// TONNETZ VISIBILITY & LAYOUT
// ════════════════════════════════════════════════════════════════════

function updateLayoutForStage(stage) {
  const page = document.querySelector('.sb-page');
  const tonnetzEl = $('tonnetz-container');

  if (TONNETZ_STAGES.has(stage)) {
    // Show Tonnetz
    tonnetzEl.classList.remove('sb-hidden');
    tonnetzEl.style.display = '';
    page.classList.remove('sb-page--keyboard-only');
    // Initialize Tonnetz on first use
    if (!tonnetzInited) {
      TonnetzNeighborhood.init('tonnetz-container', { interactive: false });
      tonnetzInited = true;
    }
  } else {
    // Hide Tonnetz, enlarge keyboard
    tonnetzEl.classList.add('sb-hidden');
    tonnetzEl.style.display = 'none';
    page.classList.add('sb-page--keyboard-only');
  }
}

// ════════════════════════════════════════════════════════════════════
// REFRESHER BANNER
// ════════════════════════════════════════════════════════════════════

function showRefresher() {
  if (refresherDismissed[currentStage]) {
    $('refresher-banner').classList.add('sb-refresher--hidden');
    return;
  }
  $('refresher-text').textContent = REFRESHER_TEXT[currentStage];
  $('refresher-banner').classList.remove('sb-refresher--hidden');
}

function dismissRefresher() {
  refresherDismissed[currentStage] = true;
  $('refresher-banner').classList.add('sb-refresher--hidden');
}

// ════════════════════════════════════════════════════════════════════
// STAGE & MODE SWITCHING
// ════════════════════════════════════════════════════════════════════

function switchStage(stage) {
  if (stage === currentStage && audioStarted) return;
  stopAudio();
  currentStage = stage;

  // Update tab active state
  document.querySelectorAll('.sb-stage-tab').forEach(tab => {
    tab.classList.toggle('sb-stage-tab--active', Number(tab.dataset.stage) === stage);
  });

  // Update layout (Tonnetz visibility, keyboard size)
  updateLayoutForStage(stage);

  // Reset refresher for this stage
  refresherDismissed[stage] = false;
  showRefresher();

  switchMode('intro');
}

function switchMode(mode) {
  stopAudio();
  hideMascotPopup();
  currentMode = mode;
  roundComplete = false;
  clearIntervalLabels();

  // Update mode tab active state
  document.querySelectorAll('.sb-mode-tab').forEach(tab => {
    tab.classList.toggle('sb-mode-tab--active', tab.dataset.mode === mode);
  });

  // Hide all content sections
  hideSection('intro-content');
  hideSection('prompt-area');
  hideSection('intro-nav');
  hideSection('practice-nav');
  hideSection('replay-nav');
  hideSection('practice-stats');
  hideSection('results-area');
  $('pattern-ref').style.display = 'none';
  $('round-info').style.display = 'none';
  $('btn-next-round').style.display = 'none';
  clearFeedback();
  setCallout('');

  switch (mode) {
    case 'intro':
      showSection('intro-content');
      showSection('intro-nav');
      if (introStepIdx[currentStage] === 0) introStepIdx[currentStage] = 1;
      runIntroStep();
      break;

    case 'practice':
      showSection('prompt-area');
      showSection('practice-nav');
      showSection('practice-stats');
      if (introSeen[currentStage]) showSection('replay-nav');
      // Show pattern reference for stages 1-2
      if (currentStage <= 2) $('pattern-ref').style.display = '';
      // Reset chain for stage 3
      if (currentStage === 3) s3ChainIdx = 0;
      startPracticeRound();
      break;

    case 'test':
      showSection('prompt-area');
      $('round-info').style.display = '';
      if (introSeen[currentStage]) showSection('replay-nav');
      startTest();
      break;
  }
}

// ════════════════════════════════════════════════════════════════════
// INTRO LOGIC
// ════════════════════════════════════════════════════════════════════

async function runIntroStep() {
  const step = introStepIdx[currentStage];
  const total = INTRO_STEP_COUNTS[currentStage];

  $('step-indicator').textContent = `Step ${step} of ${total}`;
  setSubtext('');
  disableNext();
  $('btn-back').disabled = step <= 1;
  updateIntroMascot(step);

  introAnimating = true;
  const myId = ++introPlaybackId;

  try {
    switch (currentStage) {
      case 1: await introS1(step, myId); break;
      case 2: await introS2(step, myId); break;
      case 3: await introS3(step, myId); break;
      case 4: await introS4(step, myId); break;
    }
  } catch (err) {
    console.warn('[ScaleBuilder] intro step error:', err);
  }

  if (introPlaybackId !== myId) return; // cancelled
  introAnimating = false;
  enableNext();

  // Mark as seen when reaching last step
  if (step >= total) {
    introSeen[currentStage] = true;
    introCompleted[currentStage] = true;
  }
}

function cancelled(myId) { return introPlaybackId !== myId; }

// ── Mascot helpers ──────────────────────────────────────────────

function updateIntroMascot(step) {
  const container = $('mascot-container');
  if (!container) return;
  container.innerHTML = '';
  const exprs = MASCOT_INTRO_EXPR[currentStage];
  const expr = exprs ? exprs[step - 1] || 'neutral' : 'neutral';
  container.appendChild(createMascot(expr, 60));
}

function showMascotPopup(expression, text, duration) {
  duration = duration || 2000;
  if (!introCompleted[currentStage]) return;
  const popup = $('mascot-popup');
  if (!popup) return;
  clearTimeout(mascotPopupTimer);
  popup.innerHTML = '';
  popup.appendChild(createMascot(expression, 48));
  const span = document.createElement('span');
  span.className = 'sb-mascot-popup-text';
  span.textContent = text;
  popup.appendChild(span);
  popup.style.display = 'flex';
  void popup.offsetHeight; // force reflow for transition
  popup.style.opacity = '1';
  mascotPopupTimer = setTimeout(() => {
    popup.style.opacity = '0';
    setTimeout(() => { popup.style.display = 'none'; popup.innerHTML = ''; }, 300);
  }, duration);
}

function hideMascotPopup() {
  clearTimeout(mascotPopupTimer);
  const popup = $('mascot-popup');
  if (popup) {
    popup.style.opacity = '0';
    popup.style.display = 'none';
    popup.innerHTML = '';
  }
}

// ── Stage 1 Intro: The Major Scale Pattern (keyboard only) ───

async function introS1(step, myId) {
  const rpc = 0; // C
  const scale = computeScale(rpc, MAJOR_PATTERN); // [0,2,4,5,7,9,11]
  rootPC = rpc;

  switch (step) {
    case 1: {
      // "Let's build a C major scale." C highlights. Play C.
      setNarration("Let\u2019s build a C major scale.");
      clearIntervalLabels();
      updateVisuals([rpc], { rootPC: rpc });
      await playNotePC(rpc);
      break;
    }

    case 2: {
      // "The first step is a whole step — skip one key."
      // C → (C# dimmed/skipped) → D highlights. Label "W". Play D.
      setNarration("The first step is a whole step \u2014 skip one key.");
      clearIntervalLabels();
      updateVisuals([scale[0], scale[1]], { rootPC: rpc });
      // Dim C# to show it's skipped
      addKeyHL(1, 'sb-hl-skipped');
      // Show W label between C and D
      showIntervalLabelsUpTo(scale, MAJOR_INTERVALS.slice(1), 1);
      await playNotePC(scale[1]);
      break;
    }

    case 3: {
      // "Another whole step." D→E, "W". Play E.
      // "Now a half step — the very next key." E→F, "H". Play F.
      // Show the visual difference.
      setNarration("Another whole step to E. Then a half step \u2014 the very next key \u2014 to F.");
      clearIntervalLabels();
      updateVisuals([scale[0], scale[1], scale[2], scale[3]], { rootPC: rpc });
      addKeyHL(1, 'sb-hl-skipped'); // C# still dimmed
      addKeyHL(3, 'sb-hl-skipped'); // D# skipped
      showIntervalLabelsUpTo(scale, MAJOR_INTERVALS.slice(1), 3);
      setSubtext("W \u2013 W \u2013 H");

      await playNotePC(scale[2]); // E
      if (cancelled(myId)) return;
      await delay(500);
      if (cancelled(myId)) return;
      await playNotePC(scale[3]); // F
      break;
    }

    case 4: {
      // Continue: F→G (W), G→A (W), A→B (W), B→C (H).
      // Each step adds the note, labels accumulate. Play each note.
      setNarration("Continue the pattern: W\u2013W\u2013W\u2013H to complete the scale.");
      const scaleOct4 = [...scale, scale[0]]; // include octave C for full label set

      let shown = scaleOct4.slice(0, 4); // C D E F already visible
      updateVisuals(shown, { rootPC: rpc });
      showIntervalLabelsUpTo(scaleOct4, MAJOR_INTERVALS.slice(1), 3);

      for (let i = 4; i < scaleOct4.length; i++) {
        if (cancelled(myId)) return;
        await delay(500);
        if (cancelled(myId)) return;
        shown = [...shown, scaleOct4[i]];
        updateVisuals(shown, { rootPC: rpc });
        showIntervalLabelsUpTo(scaleOct4, MAJOR_INTERVALS.slice(1), i);
        const oct = scaleOct4[i] <= scaleOct4[i - 1] ? 5 : 4;
        await playNotePC(scaleOct4[i], oct);
      }

      if (cancelled(myId)) return;
      await delay(300);
      showIntervalLabelsForScale(scaleOct4, MAJOR_INTERVALS.slice(1));
      setSubtext("W \u2013 W \u2013 H \u2013 W \u2013 W \u2013 W \u2013 H");
      break;
    }

    case 5: {
      // All notes highlighted + octave. Play full ascending scale. Summary.
      const scaleOct5 = [...scale, scale[0]]; // include octave C
      setNarration("That\u2019s C major. This pattern \u2014 W\u2013W\u2013H\u2013W\u2013W\u2013W\u2013H \u2014 builds a major scale from any starting note.");
      setSubtext("W \u2013 W \u2013 H \u2013 W \u2013 W \u2013 W \u2013 H");
      updateVisuals(scaleOct5, { rootPC: rpc });
      showIntervalLabelsForScale(scaleOct5, MAJOR_INTERVALS.slice(1));
      await playScaleAsc(scaleOct5);
      break;
    }
  }
}

// ── Stage 2 Intro: Tetrachords & Fourths (keyboard only) ─────

async function introS2(step, myId) {
  const rpc = 0; // C
  const scale = computeScale(rpc, MAJOR_PATTERN);
  const bottom = scale.slice(0, 4); // C D E F — PCs [0,2,4,5]
  const topTetra = [7, 9, 11, 0]; // G A B C
  rootPC = rpc;

  switch (step) {
    case 1: {
      // "You built C major. Let's look at the first half: C–D–E–F."
      // Highlight just these 4 keys. Play ascending. "That's a tetrachord: W–W–H."
      setNarration("You built C major. Let\u2019s look at the first half: C\u2013D\u2013E\u2013F.");
      setSubtext("That\u2019s a tetrachord: W\u2013W\u2013H");
      clearIntervalLabels();
      updateVisuals(bottom, { rootPC: rpc, tetraBottom: new Set(bottom) });
      // Show W-W-H labels on the bottom tetrachord
      showIntervalLabelsForScale(bottom, ['W', 'W', 'H']);
      await playScaleAsc(bottom);
      break;
    }

    case 2: {
      // "Now look at the distance from C to F."
      // Dim D and E, highlight only C and F. Play together.
      // "Count the half steps: C → C# → D → D# → E → F." Animate chromatic steps.
      // "That's 5 half steps."
      setNarration("Now look at the distance from C to F.");
      clearIntervalLabels();

      // Show just C and F highlighted
      clearKeyboardHL();
      addKeyHL(0, 'sb-hl-root');     // C
      addKeyHL(5, 'sb-hl-correct');  // F
      addKeyHL(2, 'sb-hl-skipped');  // D dimmed
      addKeyHL(4, 'sb-hl-skipped');  // E dimmed

      await playIntervalPC(0, 5);
      if (cancelled(myId)) return;
      await delay(800);
      if (cancelled(myId)) return;

      // Animate chromatic counting: C→C#→D→D#→E→F
      setSubtext("Count: C \u2192 C# \u2192 D \u2192 D# \u2192 E \u2192 F = 5 half steps");
      const chromatic = [0, 1, 2, 3, 4, 5]; // C, C#, D, D#, E, F
      for (let i = 1; i < chromatic.length; i++) {
        if (cancelled(myId)) return;
        // Briefly highlight each chromatic step
        addKeyHL(chromatic[i], 'sb-hl-hint');
        await playNotePC(chromatic[i]);
        await delay(300);
        if (cancelled(myId)) return;
      }
      break;
    }

    case 3: {
      // "5 half steps is called a perfect fourth."
      // Play the fourth. "Every tetrachord spans a perfect fourth."
      setNarration("5 half steps is called a perfect fourth \u2014 an interval with a name. Every tetrachord spans a perfect fourth.");
      clearIntervalLabels();
      clearKeyboardHL();
      addKeyHL(0, 'sb-hl-root');
      addKeyHL(5, 'sb-hl-correct');
      await playIntervalPC(0, 5);
      break;
    }

    case 4: {
      // "Now the second half: G–A–B–C." Different color. Play ascending.
      // "Same pattern: W–W–H. Same distance: G to C is also a perfect fourth."
      setNarration("Now the second half: G\u2013A\u2013B\u2013C. Same pattern: W\u2013W\u2013H. G to C is also a perfect fourth.");
      setSubtext("W \u2013 W \u2013 H");
      clearIntervalLabels();
      updateVisuals(topTetra, { rootPC: 7, tetraTop: new Set(topTetra) });
      showIntervalLabelsForScale(topTetra, ['W', 'W', 'H'], 4);
      await playScaleAsc(topTetra, 4);
      break;
    }

    case 5: {
      // "And the gap between the two tetrachords? F to G. That's one whole step."
      // Show full scale with two-color tetrachords and gap label.
      setNarration("The gap between tetrachords? F to G \u2014 one whole step. A major scale is: a fourth, a whole step, another fourth.");
      clearIntervalLabels();
      updateVisuals([...bottom, ...topTetra.filter(pc => !bottom.includes(pc))], {
        rootPC: rpc,
        tetraBottom: new Set(bottom),
        tetraTop: new Set(topTetra),
      });
      showTetrachordLabels(bottom, topTetra);
      // Play full scale with brief pauses at seams (after F=index 3, after G=index 4)
      const fullScale = [...scale]; // [0,2,4,5,7,9,11]
      await playScaleAsc(fullScale, 4, [3, 4]);
      break;
    }

    case 6: {
      // "Now you know three intervals: half steps, whole steps, and fourths."
      // "Fourths are going to matter a lot — they're how keys connect."
      setNarration("Now you know three intervals: half steps, whole steps, and fourths. Fourths are going to matter a lot \u2014 they\u2019re how keys connect to each other.");
      clearIntervalLabels();
      updateVisuals([...bottom, ...topTetra.filter(pc => !bottom.includes(pc))], {
        rootPC: rpc,
        tetraBottom: new Set(bottom),
        tetraTop: new Set(topTetra),
      });
      showTetrachordLabels(bottom, topTetra);
      await playIntervalPC(0, 5); // Play a perfect fourth one more time
      break;
    }
  }
}

// ── Stage 3 Intro: Keys Are Connected (Tonnetz appears!) ─────

async function introS3(step, myId) {
  const cScale = computeScale(0, MAJOR_PATTERN);
  const cBottom = cScale.slice(0, 4);
  const cTop = [7, 9, 11, 0]; // G A B C

  switch (step) {
    case 1: {
      // "You built C major with two tetrachords." Show on keyboard + Tonnetz (first time!)
      setNarration("You built C major with two tetrachords: C\u2013D\u2013E\u2013F and G\u2013A\u2013B\u2013C. Here\u2019s what those notes look like on the Tonnetz \u2014 a map of musical relationships.");
      rootPC = 0;
      updateVisuals(cScale, {
        rootPC: 0,
        tetraBottom: new Set(cBottom),
        tetraTop: new Set(cTop),
      });
      showTetrachordLabels(cBottom, cTop);
      break;
    }

    case 2: {
      // "Watch the top tetrachord." It pulses. "What if this becomes the bottom of a new key?"
      // Animate: top tetrachord shifts to bottom color.
      setNarration("Watch the top tetrachord. What if it becomes the bottom of a new key?");
      rootPC = 7; // G
      // Show top tetrachord pulsing, then recolor as bottom
      updateVisuals(cTop, { rootPC: 7, tetraTop: new Set(cTop) });
      cTop.forEach(pc => addKeyHL(pc, 'sb-hl-pulse'));
      if (cancelled(myId)) return;
      await delay(1600);
      if (cancelled(myId)) return;
      // Recolor as bottom tetrachord
      updateVisuals(cTop, { rootPC: 7, tetraBottom: new Set(cTop) });
      showIntervalLabelsForScale(cTop, ['W', 'W', 'H'], 4);
      await playScaleAsc(cTop, 4);
      break;
    }

    case 3: {
      // "Now build a new top tetrachord from D." D-E-F#-G appears.
      // "That F# isn't random — it keeps the W–W–H pattern."
      setNarration("Now build a new top tetrachord from D. That F# isn\u2019t random \u2014 it\u2019s the only note that keeps the W\u2013W\u2013H pattern.");
      rootPC = 7;
      const gTopTetra = [2, 4, 6, 7]; // D E F# G
      updateVisuals([...cTop, ...gTopTetra], {
        rootPC: 7,
        tetraBottom: new Set(cTop),
        tetraTop: new Set(gTopTetra),
      });
      setCallout('New note: F#');
      // Show W-W-H labels on the new top tetrachord
      clearIntervalLabels();
      showIntervalLabelsForScale(gTopTetra, ['W', 'W', 'H'], 5);
      if (cancelled(myId)) return;
      await delay(400);
      if (cancelled(myId)) return;
      await playScaleAsc(gTopTetra, 5);
      break;
    }

    case 4: {
      // "You just built G major. One sharp: F#."
      // "The new key is a perfect fifth above C. C to G — that's the horizontal axis on the Tonnetz."
      setNarration("You just built G major. One sharp: F#. The new key is a perfect fifth above C \u2014 that\u2019s the horizontal axis on the Tonnetz.");
      rootPC = 7;
      const gScale = computeScale(7, MAJOR_PATTERN);
      updateVisuals(gScale, { rootPC: 7 });
      setCallout('Fourths build tetrachords. Fifths connect keys.');
      clearIntervalLabels();
      await playScaleAsc(gScale);
      break;
    }

    case 5: {
      // Quick animation: G's top → D major's bottom. C# appears.
      // "Every major key grows from the one before it. This chain is the circle of fifths."
      setNarration("Every major key grows from the one before it. This chain is the circle of fifths.");
      rootPC = 7;
      const gScale = computeScale(7, MAJOR_PATTERN);
      updateVisuals(gScale, { rootPC: 7 });
      clearIntervalLabels();
      if (cancelled(myId)) return;
      await delay(800);
      if (cancelled(myId)) return;
      rootPC = 2;
      const dScale = computeScale(2, MAJOR_PATTERN);
      updateVisuals(dScale, { rootPC: 2, dimmedPCs: new Set(gScale) });
      setCallout('G major \u2192 D major: new note C#');
      if (cancelled(myId)) return;
      await playScaleAsc(dScale);
      break;
    }
  }
}

// ── Stage 4 Intro: Major and Minor Are Relatives (Tonnetz + keyboard) ──

async function introS4(step, myId) {
  const cScale = computeScale(0, MAJOR_PATTERN);

  switch (step) {
    case 1:
      setNarration("You built C major: C\u2013D\u2013E\u2013F\u2013G\u2013A\u2013B.");
      rootPC = 0;
      updateVisuals(cScale, { rootPC: 0 });
      clearIntervalLabels();
      await playScaleAsc(cScale);
      break;

    case 2: {
      setNarration("Now play the same notes, but start on A. Hear the difference? That\u2019s A minor.");
      rootPC = 9; // A
      const aMinorOrder = [9, 11, 0, 2, 4, 5, 7];
      updateVisuals(cScale, { rootPC: 9 });
      clearIntervalLabels();
      if (cancelled(myId)) return;
      await playScaleAsc(aMinorOrder, 3);
      break;
    }

    case 3:
      setNarration("Same 7 notes. Different starting point. Different sound.");
      rootPC = 9;
      updateVisuals(cScale, { rootPC: 9 });
      clearIntervalLabels();
      break;

    case 4:
      setNarration("Every major key has a relative minor. It starts on the 6th note. Let\u2019s find more relatives.");
      rootPC = 0;
      updateVisuals(cScale, { rootPC: 0 });
      clearIntervalLabels();
      // Pulse the 6th degree
      addKeyHL(9, 'sb-hl-hint');
      break;
  }
}

// ════════════════════════════════════════════════════════════════════
// PRACTICE LOGIC
// ════════════════════════════════════════════════════════════════════

let practiceLastRoot = -1;

function startPracticeRound() {
  roundComplete = false;
  wrongClicks = 0;
  selectedPCs = new Set();
  clearFeedback();
  hideMascotPopup();
  setCallout('');
  clearIntervalLabels();
  $('btn-next-round').style.display = 'none';
  $('btn-hint').disabled = false;

  switch (currentStage) {
    case 1: startS1Practice(); break;
    case 2: startS2Practice(); break;
    case 3: startS3Practice(); break;
    case 4: startS4Practice(); break;
  }

  updatePracticeStats();
}

function startS1Practice() {
  // Pick root, avoid repeat
  let rpc;
  do { rpc = pickRandom(EASY_ROOTS); } while (rpc === practiceLastRoot && EASY_ROOTS.length > 1);
  practiceLastRoot = rpc;
  rootPC = rpc;

  targetPCs = computeScale(rpc, MAJOR_PATTERN);
  selectedPCs.add(rpc); // root pre-selected
  setPrompt(`Build ${displayNote(rpc, rpc)} major`);
  updateGameVisuals();
}

function startS2Practice() {
  let rpc;
  do { rpc = pickRandom(EASY_ROOTS); } while (rpc === practiceLastRoot && EASY_ROOTS.length > 1);
  practiceLastRoot = rpc;
  rootPC = rpc;

  const scale = computeScale(rpc, MAJOR_PATTERN);
  s2BottomPCs = scale.slice(0, 4);
  s2TopPCs = [scale[4], scale[5], scale[6], scale[0]];
  targetPCs = [...new Set([...s2BottomPCs, ...s2TopPCs])];

  s2Phase = 'bottom';
  selectedPCs.add(rpc); // root pre-selected

  setPrompt(`Build ${displayNote(rpc, rpc)} major \u2014 bottom tetrachord first`);
  updateGameVisuals();
}

function startS3Practice() {
  rootPC = FIFTHS_CHAIN[s3ChainIdx];
  const scale = computeScale(rootPC, MAJOR_PATTERN);
  targetPCs = scale;

  if (s3ChainIdx > 0) {
    const prevRoot = FIFTHS_CHAIN[s3ChainIdx - 1];
    s3PrevPCs = computeScale(prevRoot, MAJOR_PATTERN);
    s3PrevRoot = prevRoot;
    const bottom = scale.slice(0, 4);
    bottom.forEach(pc => selectedPCs.add(pc));
    setPrompt(`Your top tetrachord becomes the bottom. Build the new top.`);
    const prevScale = new Set(s3PrevPCs);
    const newNote = scale.find(pc => !prevScale.has(pc));
    if (newNote != null) {
      setCallout(`New note: ${displayNote(newNote, rootPC)}`);
    }
  } else {
    s3PrevPCs = [];
    s3PrevRoot = -1;
    selectedPCs.add(rootPC);
    setPrompt(`Build ${displayNote(rootPC, rootPC)} major`);
  }

  updateGameVisuals();
}

function startS4Practice() {
  let rpc;
  do { rpc = pickRandom(EASY_ROOTS); } while (rpc === practiceLastRoot && EASY_ROOTS.length > 1);
  practiceLastRoot = rpc;

  s4MajorRoot = rpc;
  const majorScale = computeScale(rpc, MAJOR_PATTERN);
  s4MinorRoot = majorScale[5]; // 6th degree
  rootPC = s4MinorRoot;

  targetPCs = majorScale;

  const noteNames = majorScale.map(pc => displayNote(pc, rpc)).join(' ');
  setPrompt(`${displayNote(rpc, rpc)} major uses: ${noteNames}. Build its relative minor.`);

  updateVisuals([], {
    rootPC: s4MinorRoot,
    refPCs: new Set(majorScale),
  });
  clearKeyboardHL();
  majorScale.forEach(pc => addKeyHL(pc, 'sb-hl-ref'));
}

/** Update visuals based on current game state (selected PCs + targets). */
function updateGameVisuals() {
  const opts = { rootPC };

  if (currentStage === 2 && s2Phase === 'bottom') {
    opts.tetraBottom = new Set(s2BottomPCs.filter(pc => selectedPCs.has(pc)));
  } else if (currentStage === 2 && s2Phase === 'top') {
    opts.tetraBottom = new Set(s2BottomPCs);
    opts.tetraTop = new Set(s2TopPCs.filter(pc => selectedPCs.has(pc)));
  }

  if (currentStage === 3 && s3PrevPCs.length > 0) {
    opts.dimmedPCs = new Set(s3PrevPCs);
  }

  if (currentStage === 4) {
    opts.refPCs = new Set(targetPCs);
  }

  updateVisuals([...selectedPCs], opts);

  // Show interval labels during Practice (stages 1 & 2)
  if (currentMode === 'practice' && currentStage <= 2) {
    showPracticeIntervalLabels();
  }
}

/**
 * Show W/H labels between root and each selected note during Practice.
 * Labels accumulate as the user picks notes.
 */
function showPracticeIntervalLabels() {
  clearIntervalLabels();
  const scale = computeScale(rootPC, MAJOR_PATTERN);
  const labels = MAJOR_INTERVALS.slice(1); // ['W','W','H','W','W','W','H']

  // Build ordered list of selected notes in scale order
  const orderedSelected = scale.filter(pc => selectedPCs.has(pc));
  if (orderedSelected.length < 2) return;

  // Find indices in scale for each selected note to get labels
  let oct = 4;
  let prevPC = -1;
  const noteOctaves = [];
  const labelsBetween = [];

  for (let i = 0; i < scale.length; i++) {
    const pc = scale[i];
    if (!selectedPCs.has(pc)) continue;
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    noteOctaves.push(`${name}${oct}`);
    if (noteOctaves.length > 1) {
      labelsBetween.push(labels[i - 1] || 'W');
    }
    prevPC = pc;
  }

  // Actually, we need labels between consecutive SCALE notes (not just selected ones).
  // Let's do it properly: for each consecutive pair of selected notes,
  // show the interval label if they are adjacent in the scale.
  clearIntervalLabels();
  oct = 4;
  prevPC = -1;
  const allNoteOctaves = [];
  for (const pc of scale) {
    if (prevPC >= 0 && pc <= prevPC) oct++;
    const name = pcToNote(pc).replace(/\u266f/g, '#').replace(/\u266d/g, 'b');
    allNoteOctaves.push(`${name}${oct}`);
    prevPC = pc;
  }

  // Show labels only between consecutive selected notes that are scale-adjacent
  let prevSelectedIdx = -1;
  for (let i = 0; i < scale.length; i++) {
    if (!selectedPCs.has(scale[i])) continue;
    if (prevSelectedIdx >= 0 && i === prevSelectedIdx + 1) {
      // In Stage 2, show the gap label (W) between index 3→4 (F→G)
      if (currentStage === 2 && prevSelectedIdx === 3 && i === 4) {
        addGapLabel(allNoteOctaves[prevSelectedIdx], allNoteOctaves[i], 'W');
      } else {
        addIntervalLabel(allNoteOctaves[prevSelectedIdx], allNoteOctaves[i], labels[i - 1]);
      }
    }
    prevSelectedIdx = i;
  }
}

function updatePracticeStats() {
  const stats = practiceStats[currentStage];
  $('practice-streak').textContent = `Streak: ${stats.streak}`;
  $('practice-rounds').textContent = `Rounds: ${stats.rounds}`;
}

// ════════════════════════════════════════════════════════════════════
// TEST LOGIC
// ════════════════════════════════════════════════════════════════════

function startTest() {
  testRound = 0;
  testScore = 0;
  clearIntervalLabels();

  if (currentStage === 3) {
    testRoots = FIFTHS_CHAIN.slice(0, ROUNDS_PER_TEST);
    s3ChainIdx = 0;
    s3PrevPCs = [];
    s3PrevRoot = -1;
  } else {
    testRoots = [];
    for (let i = 0; i < ROUNDS_PER_TEST; i++) {
      testRoots.push(pickRandom(EASY_ROOTS));
    }
  }

  nextTestRound();
}

function nextTestRound() {
  testRound++;
  if (testRound > ROUNDS_PER_TEST) {
    endTest();
    return;
  }

  roundComplete = false;
  wrongClicks = 0;
  selectedPCs = new Set();
  clearFeedback();
  hideMascotPopup();
  setCallout('');
  clearIntervalLabels(); // No interval labels in Test

  $('round-indicator').textContent = `Round ${testRound} / ${ROUNDS_PER_TEST}`;
  $('score-display').textContent = `Score: ${testScore}`;
  $('pattern-ref').style.display = 'none';

  const rpc = testRoots[testRound - 1];
  rootPC = rpc;

  switch (currentStage) {
    case 1: {
      targetPCs = computeScale(rpc, MAJOR_PATTERN);
      selectedPCs.add(rpc);
      setPrompt(`Build ${displayNote(rpc, rpc)} major`);
      updateGameVisuals();
      break;
    }
    case 2: {
      const scale = computeScale(rpc, MAJOR_PATTERN);
      s2BottomPCs = scale.slice(0, 4);
      s2TopPCs = [scale[4], scale[5], scale[6], scale[0]];
      targetPCs = [...new Set([...s2BottomPCs, ...s2TopPCs])];
      s2Phase = 'bottom';
      selectedPCs.add(rpc);
      setPrompt(`Build ${displayNote(rpc, rpc)} major \u2014 bottom tetrachord first`);
      updateGameVisuals();
      break;
    }
    case 3: {
      s3ChainIdx = testRound - 1;
      const scale = computeScale(rpc, MAJOR_PATTERN);
      targetPCs = scale;

      if (testRound > 1) {
        const prevRoot = testRoots[testRound - 2];
        s3PrevPCs = computeScale(prevRoot, MAJOR_PATTERN);
        s3PrevRoot = prevRoot;
      } else {
        s3PrevPCs = [];
        s3PrevRoot = -1;
      }

      selectedPCs.add(rpc);
      setPrompt(`Build ${displayNote(rpc, rpc)} major`);
      updateGameVisuals();
      break;
    }
    case 4: {
      s4MajorRoot = rpc;
      const majorScale = computeScale(rpc, MAJOR_PATTERN);
      s4MinorRoot = majorScale[5];
      rootPC = s4MinorRoot;
      targetPCs = majorScale;
      setPrompt(`Build the relative minor of ${displayNote(rpc, rpc)} major`);
      updateVisuals([], { rootPC: s4MinorRoot });
      clearKeyboardHL();
      break;
    }
  }
}

function endTest() {
  hideSection('prompt-area');
  hideSection('practice-nav');
  hideSection('replay-nav');
  hideSection('practice-stats');
  $('round-info').style.display = 'none';
  clearFeedback();
  setCallout('');
  clearVisuals();

  const pct = Math.round((testScore / ROUNDS_PER_TEST) * 100);
  $('results-score').textContent = `${testScore} / ${ROUNDS_PER_TEST}`;

  let msg;
  if (pct === 100) msg = 'Perfect score! You\u2019ve mastered this stage.';
  else if (pct >= 80) msg = 'Great work! Almost perfect.';
  else if (pct >= 60) msg = 'Good effort! Keep practicing.';
  else msg = 'Keep at it \u2014 practice makes perfect.';
  $('results-msg').textContent = msg;

  $('btn-next-stage').style.display = currentStage < 4 ? '' : 'none';

  showSection('results-area');
}

// ════════════════════════════════════════════════════════════════════
// NOTE CLICK HANDLER
// ════════════════════════════════════════════════════════════════════

function handleNoteClick(noteName, octave) {
  if (currentMode === 'intro') return;
  if (introAnimating) return;
  if (roundComplete) return;
  if (isPlaying) return;

  const pc = noteToPC(noteName);

  if (selectedPCs.has(pc)) return;

  if (targetPCs.includes(pc)) {
    selectedPCs.add(pc);
    updateGameVisuals();
    checkCompletion();
  } else {
    wrongClicks++;
    flashWrong(pc);
    showMascotPopup('wrongNote', 'Almost \u2014 try again!', 2000);
  }
}

function checkCompletion() {
  const allSelected = targetPCs.every(pc => selectedPCs.has(pc));

  // Stage 2: check tetrachord phases
  if (currentStage === 2 && s2Phase === 'bottom') {
    const bottomDone = s2BottomPCs.every(pc => selectedPCs.has(pc));
    if (bottomDone) {
      s2Phase = 'top';
      setPrompt(currentMode === 'test'
        ? `Now build the top tetrachord`
        : `Now build the top tetrachord`);
      setFeedback('Bottom tetrachord complete!', 'correct');
      updateGameVisuals();
      return;
    }
    return;
  }

  if (!allSelected) return;

  roundComplete = true;
  onRoundComplete();
}

async function onRoundComplete() {
  if (currentMode === 'practice') {
    const stats = practiceStats[currentStage];
    stats.rounds++;
    if (wrongClicks === 0) {
      stats.streak++;
    } else {
      stats.streak = 0;
    }
    updatePracticeStats();

    const encourageMsg = pickRandom(ENCOURAGEMENTS);
    setFeedback(encourageMsg, 'correct');
    showMascotPopup('excited', encourageMsg, 2500);

    if (currentStage === 4) {
      const minorOrder = reorderFromRoot(targetPCs, s4MinorRoot);
      await playScaleAsc(minorOrder, 3);
    } else {
      await playScaleAsc(targetPCs);
    }

    $('btn-next-round').style.display = '';

    if (currentStage === 3) {
      s3ChainIdx++;
      if (s3ChainIdx >= FIFTHS_CHAIN.length) s3ChainIdx = 0;
    }

  } else if (currentMode === 'test') {
    if (wrongClicks === 0) testScore++;
    $('score-display').textContent = `Score: ${testScore}`;
    setFeedback(wrongClicks === 0 ? pickRandom(ENCOURAGEMENTS) : 'Complete', wrongClicks === 0 ? 'correct' : 'info');
    if (wrongClicks === 0) showMascotPopup('excited', 'Perfect!', 2000);

    if (currentStage === 4) {
      const minorOrder = reorderFromRoot(targetPCs, s4MinorRoot);
      await playScaleAsc(minorOrder, 3);
    } else {
      await playScaleAsc(targetPCs);
    }

    if (testRound >= ROUNDS_PER_TEST) {
      await delay(1000);
      endTest();
    } else {
      await delay(1200);
      nextTestRound();
    }
  }
}

/** Reorder scale PCs to start from a given root. */
function reorderFromRoot(pcs, root) {
  const idx = pcs.indexOf(root);
  if (idx < 0) return pcs;
  return [...pcs.slice(idx), ...pcs.slice(0, idx)];
}

// ════════════════════════════════════════════════════════════════════
// HINT
// ════════════════════════════════════════════════════════════════════

function showHint() {
  if (currentMode !== 'practice') return;
  if (roundComplete) return;

  let hintPC = null;

  if (currentStage === 2 && s2Phase === 'bottom') {
    hintPC = s2BottomPCs.find(pc => !selectedPCs.has(pc));
  } else if (currentStage === 2 && s2Phase === 'top') {
    hintPC = s2TopPCs.find(pc => !selectedPCs.has(pc));
  } else if (currentStage === 4) {
    hintPC = s4MinorRoot;
    if (selectedPCs.has(hintPC)) {
      hintPC = targetPCs.find(pc => !selectedPCs.has(pc));
    }
  } else {
    hintPC = targetPCs.find(pc => !selectedPCs.has(pc));
  }

  if (hintPC == null) return;

  document.querySelectorAll(`#keyboard-container .kv-key[data-pc="${hintPC}"]`)
    .forEach(el => {
      el.classList.add('sb-hl-hint');
      el.addEventListener('animationend', () => el.classList.remove('sb-hl-hint'), { once: true });
    });

  showMascotPopup('wink', 'Psst \u2014 check this note', 2000);
}

// ════════════════════════════════════════════════════════════════════
// PLAY SCALE BUTTON
// ════════════════════════════════════════════════════════════════════

async function playCurrentScale() {
  if (isPlaying) return;
  if (targetPCs.length === 0) return;

  if (currentStage === 4 && roundComplete) {
    const minorOrder = reorderFromRoot(targetPCs, s4MinorRoot);
    await playScaleAsc(minorOrder, 3);
  } else {
    await playScaleAsc(targetPCs);
  }
}

// ════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════

export function init() {
  // Initialize keyboard (always visible)
  KeyboardView.init('keyboard-container', {
    range: { low: 'C3', high: 'B5' },
    mode: 'input',
    onNotePlay: handleNoteClick,
  });

  // Tonnetz is NOT initialized here — it's initialized lazily when
  // Stage 3 or 4 is first selected (see updateLayoutForStage)

  // Stage tabs
  document.querySelectorAll('.sb-stage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!audioStarted) return;
      switchStage(Number(tab.dataset.stage));
    });
  });

  // Mode tabs
  document.querySelectorAll('.sb-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!audioStarted) return;
      if (tab.dataset.mode === currentMode) return;
      switchMode(tab.dataset.mode);
    });
  });

  // Refresher dismiss
  $('refresher-dismiss').addEventListener('click', dismissRefresher);

  // Intro nav
  $('btn-back').addEventListener('click', () => {
    if (introAnimating) return;
    const step = introStepIdx[currentStage];
    if (step > 1) {
      introStepIdx[currentStage] = step - 1;
      stopAudio();
      runIntroStep();
    }
  });

  $('btn-next').addEventListener('click', () => {
    if (introAnimating) return;
    const step = introStepIdx[currentStage];
    const total = INTRO_STEP_COUNTS[currentStage];
    if (step < total) {
      introStepIdx[currentStage] = step + 1;
      stopAudio();
      runIntroStep();
    } else {
      introSeen[currentStage] = true;
      introCompleted[currentStage] = true;
      switchMode('practice');
    }
  });

  $('btn-skip').addEventListener('click', () => {
    introSeen[currentStage] = true;
    stopAudio();
    switchMode('practice');
  });

  // Practice nav
  $('btn-hint').addEventListener('click', showHint);
  $('btn-play-scale').addEventListener('click', playCurrentScale);
  $('btn-next-round').addEventListener('click', () => startPracticeRound());

  // Replay intro
  $('btn-replay-intro').addEventListener('click', () => {
    introStepIdx[currentStage] = 1;
    switchMode('intro');
  });

  // Results buttons
  $('btn-retry').addEventListener('click', () => switchMode('test'));
  $('btn-next-stage').addEventListener('click', () => {
    if (currentStage < 4) switchStage(currentStage + 1);
  });

  // Start overlay (audio gate)
  $('start-overlay').addEventListener('click', async () => {
    await Tone.start();
    audioStarted = true;
    await ensureAudio();

    $('start-overlay').style.display = 'none';
    $('main-content').style.display = 'block';

    currentStage = 0; // ensure switchStage(1) doesn't early-return on first load
    switchStage(1);
  });
}
