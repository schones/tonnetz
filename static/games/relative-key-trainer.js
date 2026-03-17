/**
 * relative-key-trainer.js
 * =======================
 * Relative Major & Minor recognition game.
 * Three phases: Learn → Practice → Test.
 *
 * Tier 1: "Major or Minor?"
 *   Learn   — 5-step guided walkthrough (watch & listen)
 *   Practice — guided ear-training with scaffolded visuals
 *   Test     — 10-round ear-training quiz (existing Level 1 gameplay)
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
const FEEDBACK_DELAY = 2000;

const MAJOR_KEYS = ['C', 'G', 'D', 'F', 'Bb'];
const MINOR_KEYS = ['A', 'E', 'B', 'D', 'G'];

const ENCOURAGEMENTS = ['Nice!', 'Correct!', 'You got it!', 'Well done!', 'Great ear!'];

/** Annotation preset: everything off */
const ANN_OFF = {
  showChordLabel: false,
  showNoteNames: false,
  showTransformLabels: false,
  showCommonTones: false,
  showMovingTone: false,
  showIntervalEdge: false,
  showIntervalLabel: false,
  showIntervalDistance: false,
};

/** Annotation preset: show triad info */
const ANN_TRIAD = {
  ...ANN_OFF,
  showChordLabel: true,
  showNoteNames: true,
  showCommonTones: true,
};

/** Annotation preset: show transform info */
const ANN_TRANSFORM = {
  ...ANN_TRIAD,
  showTransformLabels: true,
  showMovingTone: true,
};

// ════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════

let currentPhase = 'learn';   // 'learn' | 'practice' | 'test'

// Learn state
let learnStep = 1;
let learnAudioPlayed = false;
let learnPlaybackId = 0;      // incremented on step change to cancel stale audio
let learnSubStep = 0;         // sub-step within multi-part Learn steps

// Test state
let round = 0;
let score = 0;
let currentKey = null;         // { root, quality }
let awaitingAnswer = false;

// Practice state
let practiceKey = null;        // { root, quality }
let practiceAwaitingAnswer = false;
let practiceStreak = 0;
let practiceCorrectTotal = 0;
let practiceRoundTotal = 0;
let practiceLastKey = null;    // avoid repeating same key

// Audio state
let isPlaying = false;
let sampler = null;   // shared Tone.Sampler from KeyboardView
let audioStarted = false;

// ════════════════════════════════════════════════════════════════════
// DOM
// ════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════════════════════════
// UTILITIES
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

function displayNote(name) {
  return name.replace(/♯/g, '#').replace(/♭/g, 'b');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ════════════════════════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════════════════════════

/** Obtain (or await) the shared Sampler from KeyboardView. */
async function ensureAudio() {
  if (sampler) return;
  sampler = await KeyboardView.getSampler();
}

/**
 * Get chord voicing notes for a triad, voiced ascending from startOctave.
 * Notes that would wrap below are pushed up an octave.
 */
function chordVoicing(root, quality, startOctave) {
  startOctave = startOctave || 4;
  const notes = triadNotes(root, quality);
  if (!notes) return [];
  let oct = startOctave;
  let prevPC = -1;
  return notes.map(n => {
    const ascii = n.replace(/♯/g, '#').replace(/♭/g, 'b');
    const pc = noteToPC(n);
    if (prevPC >= 0 && pc <= prevPC) oct++;
    prevPC = pc;
    return `${ascii}${oct}`;
  });
}

/**
 * Build a 4-chord progression for a key.
 * Major: I - IV - V - I     Minor: i - iv - V - i
 */
function buildProgression(root, quality) {
  const rootPC = noteToPC(root);
  const spell = spellingForKey(root, quality);

  if (quality === 'major') {
    const IV = spell((rootPC + 5) % 12);
    const V  = spell((rootPC + 7) % 12);
    return [
      { notes: chordVoicing(root, 'major') },
      { notes: chordVoicing(IV, 'major') },
      { notes: chordVoicing(V, 'major') },
      { notes: chordVoicing(root, 'major') },
    ];
  } else {
    const iv = spell((rootPC + 5) % 12);
    const V  = spell((rootPC + 7) % 12);
    return [
      { notes: chordVoicing(root, 'minor') },
      { notes: chordVoicing(iv, 'minor') },
      { notes: chordVoicing(V, 'major') },
      { notes: chordVoicing(root, 'minor') },
    ];
  }
}

/**
 * Play a chord progression. Returns a promise that resolves on completion.
 * Uses the shared Salamander piano sampler from KeyboardView.
 */
async function playProgression(chords, bpm) {
  if (isPlaying) return;
  isPlaying = true;

  await ensureAudio();

  const beatDur = 60 / bpm;
  const now = Tone.now();

  chords.forEach((chord, i) => {
    const time = now + i * beatDur;
    sampler.triggerAttackRelease(chord.notes, beatDur * 0.9, time);
  });

  const totalMs = chords.length * beatDur * 1000 + 100;
  await new Promise(r => setTimeout(r, totalMs));
  isPlaying = false;
}

/** Stop any sounding notes and reset playing flag. */
function stopAllAudio() {
  isPlaying = false;
  try {
    if (sampler) sampler.releaseAll();
  } catch (_) { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════
// LEARN PHASE
// ════════════════════════════════════════════════════════════════════

/** C major scale notes (used in Step 4). */
const C_MAJOR_SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const LEARN_SCRIPTS = [
  // ── Step 1: "This Is a Major Chord" ─────────────────────────────
  {
    narration:
      'This is C major — three notes that make a bright, stable sound. Listen.',
    setup() {
      HarmonyState.update({ annotations: { ...ANN_TRIAD, showNoteNames: true } });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      await playProgression(buildProgression('C', 'major'), BPM);
    },
  },

  // ── Step 2: "This Is Its Relative Minor" ────────────────────────
  {
    narration:
      'Watch the Tonnetz — two notes stay the same, and only one moves. That tiny shift changes everything.',
    setup() {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      const id = learnPlaybackId;
      // Brief hold on C major
      await delay(1000);
      if (learnPlaybackId !== id) return;
      // R transform → A minor
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      // Play A minor progression
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },

  // ── Step 3: "The Pattern Is Always the Same" ────────────────────
  {
    narration:
      'Every major chord has a relative minor in the same spot on the Tonnetz — one step along the R arrow. Watch.',
    subSteps: 2,
    subStepLabel: 'Show another →',
    afterText:
      'The R arrow always points to the relative minor — no matter what key you start in.',
    setup(sub) {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad(sub === 0 ? 'G' : 'F', 'major');
    },
    async play(sub) {
      const id = learnPlaybackId;
      const [majRoot, minRoot] = sub === 0 ? ['G', 'E'] : ['F', 'D'];
      // Play major progression
      await playProgression(buildProgression(majRoot, 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      // R transform → relative minor
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', majRoot, 'major');
      await playProgression(buildProgression(minRoot, 'minor'), BPM);
    },
  },

  // ── Step 4: "They Share the Same Notes" ─────────────────────────
  {
    narration:
      'C major and A minor use the exact same notes from the C major scale. They just call a different note "home."',
    subSteps: 2,
    subStepLabel: 'Show A minor →',
    setup(sub) {
      const scaleAN = C_MAJOR_SCALE.map(n => ({
        note: n, octave: 4, source: 'scale', color: null,
      }));
      if (sub === 0) {
        const triadAN = ['C', 'E', 'G'].map(n => ({
          note: n, octave: 4, source: 'triad', color: null,
        }));
        HarmonyState.update({
          annotations: { ...ANN_TRIAD, showNoteNames: true },
          activeTriads: [
            { root: 'C', quality: 'major', notes: ['C', 'E', 'G'], role: 'primary', color: null },
          ],
          activeNotes: [...triadAN, ...scaleAN],
          tonnetzCenter: { root: 'C', quality: 'major' },
          activeTransform: null,
        });
      } else {
        const triadAN = ['A', 'C', 'E'].map(n => ({
          note: n, octave: 4, source: 'triad', color: null,
        }));
        HarmonyState.update({
          annotations: { ...ANN_TRIAD, showNoteNames: true },
          activeTriads: [
            { root: 'C', quality: 'major', notes: ['C', 'E', 'G'], role: 'secondary', color: null },
            { root: 'A', quality: 'minor', notes: ['A', 'C', 'E'], role: 'primary', color: null },
          ],
          activeNotes: [...triadAN, ...scaleAN],
          tonnetzCenter: { root: 'C', quality: 'major' },
          activeTransform: null,
        });
      }
    },
    async play() {
      // Visual-only step — no audio
    },
  },

  // ── Step 5: "Hear the Difference" ───────────────────────────────
  {
    narration:
      'Same family of notes, completely different mood. Major sounds bright and resolved. Minor sounds darker and more wistful.',
    afterText: 'Ready to try it yourself →',
    setup() {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      const id = learnPlaybackId;
      // Play C major progression
      await playProgression(buildProgression('C', 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(2000);
      if (learnPlaybackId !== id) return;
      // R transform → A minor
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },
];

/** Show a sub-step advance button in the extras area. */
function showSubStepButton(label) {
  const extras = $('learn-extras');
  extras.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'rkt-btn rkt-btn--accent';
  btn.textContent = label;
  btn.addEventListener('click', advanceSubStep);
  extras.appendChild(btn);
}

/** Show annotation text in the extras area (appends, does not clear). */
function showAfterText(text) {
  const extras = $('learn-extras');
  const p = document.createElement('p');
  p.className = 'rkt-annotation-text';
  p.textContent = text;
  extras.appendChild(p);
}

/** Advance to the next sub-step within the current Learn step. */
async function advanceSubStep() {
  learnSubStep++;
  learnPlaybackId++;
  const myId = learnPlaybackId;
  const script = LEARN_SCRIPTS[learnStep - 1];
  const totalSubSteps = script.subSteps || 1;

  $('learn-extras').innerHTML = '';
  $('btn-learn-next').disabled = true;

  script.setup(learnSubStep);
  await script.play(learnSubStep);

  if (learnPlaybackId !== myId) return;

  if (learnSubStep < totalSubSteps - 1) {
    showSubStepButton(script.subStepLabel || 'Continue →');
  } else {
    learnAudioPlayed = true;
    $('btn-learn-next').disabled = false;
    if (script.afterText) showAfterText(script.afterText);
  }
}

/** Navigate to a Learn step (1–5). Sets up visuals and plays audio. */
async function showLearnStep(step) {
  learnStep = step;
  learnSubStep = 0;
  learnAudioPlayed = false;
  learnPlaybackId++;
  const myId = learnPlaybackId;

  stopAllAudio();

  const script = LEARN_SCRIPTS[step - 1];
  const totalSubSteps = script.subSteps || 1;

  // Fade narration
  const narEl = $('narration-text');
  narEl.style.opacity = '0';
  await delay(150);
  if (learnPlaybackId !== myId) return;
  narEl.textContent = script.narration;
  narEl.style.opacity = '1';

  // Step indicator
  $('step-indicator').textContent = `Step ${step} of 5`;

  // Clear extras
  $('learn-extras').innerHTML = '';

  // Nav buttons
  $('btn-learn-back').disabled = step === 1;
  $('btn-learn-next').disabled = true;
  $('btn-learn-next').textContent = step === 5 ? 'Start practicing →' : 'Next →';

  // Setup visuals
  script.setup(0);

  // Play audio
  await script.play(0);

  // Post-play: sub-step button or enable Next
  if (learnPlaybackId !== myId) return;

  if (totalSubSteps > 1) {
    showSubStepButton(script.subStepLabel || 'Continue →');
  } else {
    learnAudioPlayed = true;
    $('btn-learn-next').disabled = false;
    if (script.afterText) showAfterText(script.afterText);
  }
}

/** Replay the current Learn step/sub-step's audio. */
async function learnReplay() {
  if (isPlaying) return;

  learnPlaybackId++;
  const myId = learnPlaybackId;
  learnAudioPlayed = false;
  $('btn-learn-next').disabled = true;
  $('learn-extras').innerHTML = '';

  const script = LEARN_SCRIPTS[learnStep - 1];
  const totalSubSteps = script.subSteps || 1;

  script.setup(learnSubStep);
  await script.play(learnSubStep);

  if (learnPlaybackId !== myId) return;

  if (learnSubStep < totalSubSteps - 1) {
    showSubStepButton(script.subStepLabel || 'Continue →');
  } else {
    learnAudioPlayed = true;
    $('btn-learn-next').disabled = false;
    if (script.afterText) showAfterText(script.afterText);
  }
}

// ════════════════════════════════════════════════════════════════════
// TEST PHASE (existing Level 1 quiz gameplay)
// ════════════════════════════════════════════════════════════════════

function generateTestRound() {
  const isMajor = Math.random() < 0.5;
  const root = isMajor ? pickRandom(MAJOR_KEYS) : pickRandom(MINOR_KEYS);
  return { root, quality: isMajor ? 'major' : 'minor' };
}

function showTestQuestion() {
  $('question-text').textContent = 'Is this major or minor?';
  const btnArea = $('answer-buttons');
  btnArea.innerHTML = '';

  ['Major', 'Minor'].forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'rkt-answer-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => handleTestAnswer(label.toLowerCase()));
    btnArea.appendChild(btn);
  });
}

async function handleTestAnswer(answer) {
  if (!awaitingAnswer) return;
  awaitingAnswer = false;

  const correct = currentKey.quality === answer;
  if (correct) score++;

  // Reveal triad
  HarmonyState.update({ annotations: ANN_TRIAD });
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
  }, FEEDBACK_DELAY);
}

async function startRound() {
  $('round-indicator').textContent = `Round ${round + 1} / ${ROUNDS_PER_SESSION}`;
  $('score-display').textContent = `Score: ${score}`;
  $('feedback-area').className = 'rkt-feedback';
  $('feedback-area').textContent = '';

  currentKey = generateTestRound();

  // Hide visuals during question
  HarmonyState.reset();
  HarmonyState.update({
    tonnetzCenter: { root: currentKey.root, quality: currentKey.quality },
    tonnetzDepth: 1,
    annotations: ANN_OFF,
  });

  showTestQuestion();
  $('btn-replay').style.display = 'inline-flex';

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
  $('answer-buttons').querySelectorAll('button').forEach(b => { b.disabled = true; });
}

function showResults() {
  $('test-content').style.display = 'none';
  $('viz-area').style.display = 'none';
  $('results-area').style.display = 'block';

  $('results-score').textContent = `You got ${score} / ${ROUNDS_PER_SESSION}!`;

  const actions = $('results-actions');
  actions.innerHTML = '';

  const btnAgain = document.createElement('button');
  btnAgain.className = 'rkt-btn rkt-btn--primary';
  btnAgain.textContent = 'Play Again';
  btnAgain.addEventListener('click', () => {
    $('results-area').style.display = 'none';
    startSession();
  });
  actions.appendChild(btnAgain);

  const btnLearn = document.createElement('button');
  btnLearn.className = 'rkt-btn rkt-btn--accent';
  btnLearn.textContent = 'Review Learn';
  btnLearn.addEventListener('click', () => {
    $('results-area').style.display = 'none';
    switchPhase('learn');
  });
  actions.appendChild(btnLearn);
}

function startSession() {
  round = 0;
  score = 0;
  $('results-area').style.display = 'none';
  $('test-content').style.display = '';
  $('viz-area').style.display = '';
  startRound();
}

// ════════════════════════════════════════════════════════════════════
// PRACTICE PHASE
// ════════════════════════════════════════════════════════════════════

/** Pick a random key, avoiding the same key twice in a row. */
function generatePracticeRound() {
  let key;
  do {
    const isMajor = Math.random() < 0.5;
    const root = isMajor ? pickRandom(MAJOR_KEYS) : pickRandom(MINOR_KEYS);
    key = { root, quality: isMajor ? 'major' : 'minor' };
  } while (
    practiceLastKey &&
    key.root === practiceLastKey.root &&
    key.quality === practiceLastKey.quality
  );
  return key;
}

/** Start a new Practice round. */
async function startPracticeRound() {
  practiceKey = generatePracticeRound();
  practiceLastKey = practiceKey;
  practiceAwaitingAnswer = true;

  // Reset UI
  $('practice-feedback').className = 'rkt-feedback';
  $('practice-feedback').textContent = '';
  $('practice-next-wrap').style.display = 'none';
  setPracticeButtons(true);

  // Grid centered on the key but no triad highlighted — the player
  // can see the spatial context as scaffolding.
  // Keyboard in "both" mode so clicking keys plays notes.
  HarmonyState.reset();
  HarmonyState.update({
    tonnetzCenter: { root: practiceKey.root, quality: practiceKey.quality },
    tonnetzDepth: 1,
    annotations: ANN_OFF,
    keyboardMode: 'both',
  });

  updatePracticeStats();

  const prog = buildProgression(practiceKey.root, practiceKey.quality);
  await playProgression(prog, BPM);
}

/** Handle a Major/Minor answer in Practice. */
function handlePracticeAnswer(answer) {
  if (!practiceAwaitingAnswer) return;
  practiceAwaitingAnswer = false;
  practiceRoundTotal++;

  const correct = practiceKey.quality === answer;

  // Reveal triad on Tonnetz + keyboard
  HarmonyState.update({ annotations: ANN_TRIAD });
  HarmonyState.setTriad(practiceKey.root, practiceKey.quality);

  if (correct) {
    practiceStreak++;
    practiceCorrectTotal++;
    const msgs = practiceKey.quality === 'major'
      ? ['Yes! Hear that bright, open quality?', "That's right — major sounds open and resolved.", 'Nice ear!']
      : ['Yes! Hear that darker, more serious quality?', "That's right — minor sounds heavier and more wistful.", 'Nice ear!'];
    let msg = pickRandom(msgs);
    if (practiceStreak === 3) msg += " You're getting the hang of it!";
    showPracticeFeedback('correct', msg);
  } else {
    practiceStreak = 0;
    const name = `${displayNote(practiceKey.root)} ${practiceKey.quality}`;
    const tip = practiceKey.quality === 'major'
      ? 'hear how it sounds brighter and more open?'
      : 'hear how it sounds darker and more serious?';
    showPracticeFeedback('incorrect', `This one is actually ${name}. Listen again — ${tip}`);
  }

  setPracticeButtons(false);
  $('practice-next-wrap').style.display = '';
  updatePracticeStats();

  // Auto-replay so they hear it with the visual confirmation
  replayPracticeAudio();
}

/** Handle the "Show me" button — reveal without penalty. */
function handlePracticeShowMe() {
  if (!practiceAwaitingAnswer) return;
  practiceAwaitingAnswer = false;
  practiceRoundTotal++;

  // Reveal
  HarmonyState.update({ annotations: ANN_TRIAD });
  HarmonyState.setTriad(practiceKey.root, practiceKey.quality);

  const name = `${displayNote(practiceKey.root)} ${practiceKey.quality}`;
  showPracticeFeedback('neutral', `This is ${name}. Listen to how it sounds.`);

  setPracticeButtons(false);
  $('practice-next-wrap').style.display = '';
  updatePracticeStats();

  replayPracticeAudio();
}

/** Show feedback in the Practice feedback area. */
function showPracticeFeedback(type, message) {
  const el = $('practice-feedback');
  el.className = 'rkt-feedback';
  if (type === 'correct') el.classList.add('rkt-feedback--correct');
  else if (type === 'incorrect') el.classList.add('rkt-feedback--practice-incorrect');
  else el.classList.add('rkt-feedback--neutral');
  el.textContent = message;
}

/** Enable or disable Practice answer buttons and Show me. */
function setPracticeButtons(enabled) {
  $('practice-answer-buttons').querySelectorAll('button').forEach(b => { b.disabled = !enabled; });
  $('btn-practice-showme').disabled = !enabled;
}

/** Replay the current Practice round's audio. */
async function replayPracticeAudio() {
  if (!practiceKey || isPlaying) return;
  await playProgression(buildProgression(practiceKey.root, practiceKey.quality), BPM);
}

/** Update streak, round count, and test-prompt displays. */
function updatePracticeStats() {
  $('practice-streak').textContent = `Streak: ${practiceStreak}`;
  $('practice-rounds').textContent = `Rounds: ${practiceRoundTotal}`;

  // "Try the Test" prompt
  const prompt = $('practice-test-prompt');
  if (practiceRoundTotal >= 10) {
    $('practice-test-prompt-text').textContent = "You've done 10 rounds! ";
    $('practice-goto-test').textContent = 'Ready for the real test? →';
    prompt.style.display = '';
  } else if (practiceCorrectTotal >= 5) {
    $('practice-test-prompt-text').textContent = '';
    $('practice-goto-test').textContent = 'Feeling confident? Try the Test →';
    prompt.style.display = '';
  } else {
    prompt.style.display = 'none';
  }
}

// ════════════════════════════════════════════════════════════════════
// PHASE SWITCHING
// ════════════════════════════════════════════════════════════════════

const PHASE_HINTS = {
  learn: 'Watch & listen',
  practice: 'Try it yourself',
  test: 'Prove it',
};

function switchPhase(phase) {
  currentPhase = phase;
  stopAllAudio();
  learnPlaybackId++;   // Cancel any in-flight Learn playback
  awaitingAnswer = false; // Cancel any pending Test answer
  practiceAwaitingAnswer = false;

  // Tab UI
  document.querySelectorAll('.rkt-phase-tab').forEach(tab => {
    tab.classList.toggle('rkt-phase-tab--active', tab.dataset.phase === phase);
  });
  $('phase-hint').textContent = PHASE_HINTS[phase];

  // Show/hide areas
  const isLearn    = phase === 'learn';
  const isTest     = phase === 'test';
  const isPractice = phase === 'practice';

  $('learn-header').style.display    = isLearn ? '' : 'none';
  $('learn-footer').style.display    = isLearn ? '' : 'none';
  $('viz-area').style.display        = (isLearn || isTest || isPractice) ? '' : 'none';
  $('test-content').style.display    = isTest ? '' : 'none';
  $('practice-content').style.display = isPractice ? '' : 'none';
  $('results-area').style.display    = 'none';

  // Reset keyboard to display mode (Practice overrides to 'both')
  if (!isPractice) {
    HarmonyState.update({ keyboardMode: 'display' });
  }

  // Initialize phase
  if (isLearn) {
    showLearnStep(learnStep);
  } else if (isPractice) {
    startPracticeRound();
  } else if (isTest) {
    startSession();
  }
}

// ════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════

export function init() {
  // Initialize shared components
  TonnetzNeighborhood.init('tonnetz-container', { interactive: false });
  KeyboardView.init('keyboard-container', {
    range: { low: 'C3', high: 'B5' },
  });

  // Phase tabs
  document.querySelectorAll('.rkt-phase-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!audioStarted) return;
      if (tab.dataset.phase === currentPhase) return;
      switchPhase(tab.dataset.phase);
    });
  });

  // Learn nav
  $('btn-learn-back').addEventListener('click', () => {
    if (learnStep > 1) showLearnStep(learnStep - 1);
  });

  $('btn-learn-next').addEventListener('click', () => {
    if (!learnAudioPlayed) return;
    if (learnStep < 5) {
      showLearnStep(learnStep + 1);
    } else {
      // After step 5 → practice
      switchPhase('practice');
    }
  });

  $('btn-learn-replay').addEventListener('click', learnReplay);

  // Practice buttons
  $('practice-answer-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-answer]');
    if (!btn || btn.disabled) return;
    handlePracticeAnswer(btn.dataset.answer);
  });
  $('btn-practice-replay').addEventListener('click', () => replayPracticeAudio());
  $('btn-practice-showme').addEventListener('click', () => handlePracticeShowMe());
  $('btn-practice-next').addEventListener('click', () => startPracticeRound());
  $('practice-goto-test').addEventListener('click', (e) => {
    e.preventDefault();
    switchPhase('test');
  });

  // Test replay button
  $('btn-replay').addEventListener('click', async () => {
    if (isPlaying || !currentKey) return;
    await playProgression(buildProgression(currentKey.root, currentKey.quality), BPM);
  });

  // Start overlay (audio gate)
  $('start-overlay').addEventListener('click', async () => {
    await Tone.start();
    audioStarted = true;
    await ensureAudio();
    $('start-overlay').style.display = 'none';
    $('main-content').style.display = 'block';
    switchPhase('learn');
  });
}
