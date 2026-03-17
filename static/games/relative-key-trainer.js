/**
 * relative-key-trainer.js
 * =======================
 * Relative Major & Minor recognition game — Levels 1–2.
 *
 * Level 1: "Major or Minor?" — hear a progression, identify quality.
 * Level 2: "Find the Relative" — hear major, pick the relative minor.
 *
 * Depends on:
 *   - transforms.js   → TRANSFORMS, triadNotes, spellingForKey, noteToPC
 *   - harmony-state.js → HarmonyState
 *   - tonnetz-neighborhood.js → TonnetzNeighborhood
 *   - keyboard-view.js → KeyboardView
 *   - Tone.js (CDN)
 */

import { HarmonyState } from '../shared/harmony-state.js';
import { TonnetzNeighborhood } from '../shared/tonnetz-neighborhood.js';
import { KeyboardView } from '../shared/keyboard-view.js';
import {
  TRANSFORMS,
  triadNotes,
  spellingForKey,
  noteToPC,
  pcToNote,
} from '../shared/transforms.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const ROUNDS_PER_SESSION = 10;
const BPM = 100;
const FEEDBACK_DELAY_L1 = 2000;
const FEEDBACK_DELAY_L2 = 2500;
const LS_KEY = 'rkt_highest_level';

/** Key pools for easy play */
const MAJOR_KEYS = ['C', 'G', 'D', 'F', 'Bb'];
const MINOR_KEYS = ['A', 'E', 'B', 'D', 'G'];

/** Diatonic minor triads per major key (for Level 2 distractors) */
const DIATONIC_MINORS = {
  C:  ['D', 'E', 'A'],
  G:  ['A', 'B', 'E'],
  D:  ['E', 'F#', 'B'],
  F:  ['D', 'G', 'A'],
  Bb: ['C', 'D', 'G'],
};

const ENCOURAGEMENTS = ['Nice!', 'Correct!', 'You got it!', 'Well done!', 'Great ear!'];

// ════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════

let currentLevel = 1;
let highestUnlocked = 1;
let round = 0;
let score = 0;
let currentKey = null;       // { root, quality }
let isPlaying = false;
let awaitingAnswer = false;
let sampler = null;
let samplerReady = false;
let polysynth = null;
let audioStarted = false;

// ════════════════════════════════════════════════════════════════════
// DOM REFERENCES (set in init)
// ════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════════════════════════

function ensureAudio() {
  if (sampler) return;

  const vol = new Tone.Volume(-6).toDestination();

  sampler = new Tone.Sampler({
    urls: {
      A0: 'A0v1.mp3', C1: 'C1v1.mp3', 'D#1': 'Ds1v1.mp3', 'F#1': 'Fs1v1.mp3',
      A1: 'A1v1.mp3', C2: 'C2v1.mp3', 'D#2': 'Ds2v1.mp3', 'F#2': 'Fs2v1.mp3',
      A2: 'A2v1.mp3', C3: 'C3v1.mp3', 'D#3': 'Ds3v1.mp3', 'F#3': 'Fs3v1.mp3',
      A3: 'A3v1.mp3', C4: 'C4v1.mp3', 'D#4': 'Ds4v1.mp3', 'F#4': 'Fs4v1.mp3',
      A4: 'A4v1.mp3', C5: 'C5v1.mp3', 'D#5': 'Ds5v1.mp3', 'F#5': 'Fs5v1.mp3',
      A5: 'A5v1.mp3', C6: 'C6v1.mp3', 'D#6': 'Ds6v1.mp3', 'F#6': 'Fs6v1.mp3',
      A6: 'A6v1.mp3', C7: 'C7v1.mp3', 'D#7': 'Ds7v1.mp3',
    },
    baseUrl: 'https://tonejs.github.io/audio/salamander/',
    onload: () => { samplerReady = true; },
  }).connect(vol);

  polysynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
  }).toDestination();
  polysynth.volume.value = -10;
}

/**
 * Get chord voicing notes in octave 4 for a triad.
 * Returns array of note strings like ["C4", "E4", "G4"].
 */
function chordVoicing(root, quality) {
  const notes = triadNotes(root, quality);
  if (!notes) return [];
  // Build voicing in octave 4
  return notes.map(n => {
    const ascii = n.replace(/♯/g, '#').replace(/♭/g, 'b');
    return `${ascii}4`;
  });
}

/**
 * Build a 4-chord progression for a key.
 * Major: I - IV - V - I
 * Minor: i - iv - V - i
 */
function buildProgression(root, quality) {
  const rootPC = noteToPC(root);
  const spell = spellingForKey(root, quality);

  if (quality === 'major') {
    const IV_root = spell((rootPC + 5) % 12);
    const V_root  = spell((rootPC + 7) % 12);
    return [
      { notes: chordVoicing(root, 'major'),    label: root },
      { notes: chordVoicing(IV_root, 'major'), label: IV_root },
      { notes: chordVoicing(V_root, 'major'),  label: V_root },
      { notes: chordVoicing(root, 'major'),    label: root },
    ];
  } else {
    const iv_root = spell((rootPC + 5) % 12);
    const V_root  = spell((rootPC + 7) % 12);
    return [
      { notes: chordVoicing(root, 'minor'),    label: root },
      { notes: chordVoicing(iv_root, 'minor'), label: iv_root },
      { notes: chordVoicing(V_root, 'major'),  label: V_root },
      { notes: chordVoicing(root, 'minor'),    label: root },
    ];
  }
}

/**
 * Play a chord progression using Tone.js.
 * Returns a promise that resolves when the progression finishes.
 */
function playProgression(chords, bpm, callback) {
  return new Promise(resolve => {
    if (isPlaying) { resolve(); return; }
    isPlaying = true;

    const beatDur = 60 / bpm;
    const inst = samplerReady ? sampler : polysynth;
    const now = Tone.now();

    chords.forEach((chord, i) => {
      const time = now + i * beatDur;
      const dur = beatDur * 0.9; // slight gap between chords
      inst.triggerAttackRelease(chord.notes, dur, time);
    });

    const totalDur = chords.length * beatDur;
    setTimeout(() => {
      isPlaying = false;
      if (callback) callback();
      resolve();
    }, totalDur * 1000 + 100);
  });
}

// ════════════════════════════════════════════════════════════════════
// GAME LOGIC
// ════════════════════════════════════════════════════════════════════

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Display-friendly note name (replace unicode with ASCII-friendly) */
function displayNote(name) {
  return name.replace(/♯/g, '#').replace(/♭/g, 'b');
}

// ── Level 1 ─────────────────────────────────────────────────────

function generateL1Round() {
  // Pick random major or minor key
  const isMajor = Math.random() < 0.5;
  const root = isMajor ? pickRandom(MAJOR_KEYS) : pickRandom(MINOR_KEYS);
  const quality = isMajor ? 'major' : 'minor';
  return { root, quality };
}

function showL1Question() {
  $('question-text').textContent = 'Is this major or minor?';
  const btnArea = $('answer-buttons');
  btnArea.innerHTML = '';

  ['Major', 'Minor'].forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'rkt-answer-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => handleL1Answer(label.toLowerCase()));
    btnArea.appendChild(btn);
  });
}

async function handleL1Answer(answer) {
  if (!awaitingAnswer) return;
  awaitingAnswer = false;

  const correct = currentKey.quality === answer;
  if (correct) score++;

  // Reveal the triad on Tonnetz + keyboard now that the player answered
  HarmonyState.update({
    annotations: {
      showChordLabel: true,
      showNoteNames: true,
      showTransformLabels: false,
      showCommonTones: false,
      showMovingTone: false,
      showIntervalEdge: false,
      showIntervalLabel: false,
      showIntervalDistance: false,
    },
  });
  HarmonyState.setTriad(currentKey.root, currentKey.quality);

  showFeedback(correct, `It was ${displayNote(currentKey.root)} ${currentKey.quality}.`);
  disableAnswerButtons();

  setTimeout(() => {
    round++;
    if (round >= ROUNDS_PER_SESSION) {
      showResults();
    } else {
      startRound();
    }
  }, FEEDBACK_DELAY_L1);
}

// ── Level 2 ─────────────────────────────────────────────────────

function generateL2Round() {
  const root = pickRandom(MAJOR_KEYS);
  return { root, quality: 'major' };
}

function getRelativeMinor(root) {
  const result = TRANSFORMS.R.apply(root, 'major');
  return result; // { root, quality: "minor" }
}

function generateL2Distractors(majorRoot, correctMinorRoot) {
  const pool = DIATONIC_MINORS[majorRoot] || ['A', 'D', 'E'];
  // Filter out the correct answer
  const filtered = pool.filter(r => noteToPC(r) !== noteToPC(correctMinorRoot));
  // Pick 2 distractors
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, 2);
}

function showL2Question() {
  const relative = getRelativeMinor(currentKey.root);
  const correctRoot = relative.root;
  const distractors = generateL2Distractors(currentKey.root, correctRoot);

  $('question-text').textContent = 'Which is the relative minor?';
  const btnArea = $('answer-buttons');
  btnArea.innerHTML = '';

  const options = shuffleArray([
    { root: correctRoot, correct: true },
    { root: distractors[0], correct: false },
    { root: distractors[1], correct: false },
  ]);

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'rkt-answer-btn';
    btn.textContent = `${displayNote(opt.root)} minor`;
    btn.addEventListener('click', () => handleL2Answer(opt.root, opt.correct, correctRoot));
    btnArea.appendChild(btn);
  });
}

async function handleL2Answer(chosenRoot, correct, correctRoot) {
  if (!awaitingAnswer) return;
  awaitingAnswer = false;

  if (correct) score++;

  const relative = getRelativeMinor(currentKey.root);
  showFeedback(
    correct,
    `The relative minor of ${displayNote(currentKey.root)} major is ${displayNote(correctRoot)} minor.`
  );
  disableAnswerButtons();

  // Show the R transform animation on Tonnetz
  HarmonyState.setTransform('R', currentKey.root, 'major');
  HarmonyState.update({
    annotations: {
      ...HarmonyState.get().annotations,
      showTransformLabels: true,
      showCommonTones: true,
      showMovingTone: true,
    },
  });

  // Play the relative minor progression
  const minorProg = buildProgression(relative.root, 'minor');
  await playProgression(minorProg, BPM);

  setTimeout(() => {
    round++;
    if (round >= ROUNDS_PER_SESSION) {
      showResults();
    } else {
      startRound();
    }
  }, FEEDBACK_DELAY_L2);
}

// ── Shared gameplay ─────────────────────────────────────────────

async function startRound() {
  // Update round indicator
  $('round-indicator').textContent = `Round ${round + 1} / ${ROUNDS_PER_SESSION}`;
  $('score-display').textContent = `Score: ${score}`;

  // Reset feedback
  $('feedback-area').className = 'rkt-feedback';
  $('feedback-area').textContent = '';

  // Generate the round
  if (currentLevel === 1) {
    currentKey = generateL1Round();
  } else {
    currentKey = generateL2Round();
  }

  // Set up visuals per level
  if (currentLevel === 1) {
    // L1: hide triad visuals — player must identify by ear only.
    // Clear highlights but keep the grid centered on the key.
    HarmonyState.reset();
    HarmonyState.update({
      tonnetzCenter: { root: currentKey.root, quality: currentKey.quality },
      tonnetzDepth: 1,
      annotations: {
        showChordLabel: false,
        showNoteNames: false,
        showTransformLabels: false,
        showCommonTones: false,
        showMovingTone: false,
        showIntervalEdge: false,
        showIntervalLabel: false,
        showIntervalDistance: false,
      },
    });
  } else {
    // L2: show the major triad (given info), but not the answer.
    HarmonyState.update({
      annotations: {
        showChordLabel: true,
        showNoteNames: true,
        showTransformLabels: false,
        showCommonTones: false,
        showMovingTone: false,
        showIntervalEdge: false,
        showIntervalLabel: false,
        showIntervalDistance: false,
      },
    });
    HarmonyState.setTriad(currentKey.root, currentKey.quality);
  }

  // Show question
  if (currentLevel === 1) {
    showL1Question();
  } else {
    showL2Question();
  }

  // Show replay button
  $('btn-replay').style.display = 'inline-flex';

  // Play progression
  const prog = buildProgression(currentKey.root, currentKey.quality);
  await playProgression(prog, BPM);

  awaitingAnswer = true;
}

function showFeedback(correct, detail) {
  const el = $('feedback-area');
  if (correct) {
    el.className = 'rkt-feedback rkt-feedback--correct';
    el.textContent = pickRandom(ENCOURAGEMENTS) + ' ' + detail;
  } else {
    el.className = 'rkt-feedback rkt-feedback--incorrect';
    el.textContent = 'Not quite. ' + detail;
  }
}

function disableAnswerButtons() {
  const btns = $('answer-buttons').querySelectorAll('button');
  btns.forEach(b => b.disabled = true);
}

function showResults() {
  // Hide game area, show results
  $('game-area').style.display = 'none';
  $('results-area').style.display = 'block';

  $('results-score').textContent = `You got ${score} / ${ROUNDS_PER_SESSION}!`;

  const actions = $('results-actions');
  actions.innerHTML = '';

  // Play Again button
  const btnAgain = document.createElement('button');
  btnAgain.className = 'rkt-btn rkt-btn--primary';
  btnAgain.textContent = 'Play Again';
  btnAgain.addEventListener('click', () => startSession(currentLevel));
  actions.appendChild(btnAgain);

  if (currentLevel === 1 && score >= 7) {
    // Unlock Level 2
    if (highestUnlocked < 2) {
      highestUnlocked = 2;
      localStorage.setItem(LS_KEY, '2');
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'rkt-btn rkt-btn--accent';
    btnNext.textContent = 'Try Level 2';
    btnNext.addEventListener('click', () => {
      switchLevel(2);
      startSession(2);
    });
    actions.appendChild(btnNext);
  } else if (currentLevel === 2) {
    if (score >= 8) {
      const btnReady = document.createElement('button');
      btnReady.className = 'rkt-btn rkt-btn--accent';
      btnReady.textContent = 'Ready for Level 3!';
      btnReady.disabled = true;
      actions.appendChild(btnReady);
    }
  }
}

function startSession(level) {
  currentLevel = level;
  round = 0;
  score = 0;

  $('results-area').style.display = 'none';
  $('game-area').style.display = 'block';

  updateLevelIndicator();
  startRound();
}

// ── Level switching ─────────────────────────────────────────────

function switchLevel(level) {
  if (level > highestUnlocked) return;
  currentLevel = level;
  updateLevelIndicator();
  updateLevelButtons();
}

function updateLevelIndicator() {
  const dots = $('level-dots');
  dots.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement('span');
    dot.className = 'rkt-level-dot' + (i === currentLevel ? ' rkt-level-dot--active' : '');
    dot.textContent = i <= currentLevel ? '\u25CF' : '\u25CB';
    dots.appendChild(dot);
  }
}

function updateLevelButtons() {
  const btns = document.querySelectorAll('.rkt-level-btn');
  btns.forEach(btn => {
    const lvl = parseInt(btn.dataset.level, 10);
    btn.classList.toggle('rkt-level-btn--active', lvl === currentLevel);
    btn.disabled = lvl > highestUnlocked;
  });
}

// ════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════

export function init() {
  // Load persisted level
  const saved = localStorage.getItem(LS_KEY);
  if (saved) highestUnlocked = parseInt(saved, 10) || 1;

  // Set up level buttons
  document.querySelectorAll('.rkt-level-btn').forEach(btn => {
    const lvl = parseInt(btn.dataset.level, 10);
    btn.addEventListener('click', () => {
      if (lvl === currentLevel && audioStarted) return;
      switchLevel(lvl);
      if (audioStarted) startSession(lvl);
    });
  });
  updateLevelButtons();

  // Initialize Tonnetz + Keyboard
  TonnetzNeighborhood.init('tonnetz-container', { interactive: false });
  KeyboardView.init('keyboard-container', {
    range: { low: 'C3', high: 'B4' },
    mode: 'display',
  });

  // Replay button
  $('btn-replay').addEventListener('click', async () => {
    if (isPlaying || !currentKey) return;
    const prog = buildProgression(currentKey.root, currentKey.quality);
    await playProgression(prog, BPM);
  });

  // Start overlay
  $('start-overlay').addEventListener('click', async () => {
    await Tone.start();
    audioStarted = true;
    ensureAudio();
    $('start-overlay').style.display = 'none';
    $('game-area').style.display = 'block';
    startSession(currentLevel);
  });

  updateLevelIndicator();
}
