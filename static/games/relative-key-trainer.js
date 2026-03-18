/**
 * relative-key-trainer.js
 * =======================
 * Relative Major & Minor recognition game.
 * Three phases: Learn → Practice → Test.
 *
 * Tier 1: "Major or Minor?"
 *   Learn   — 5-step guided walkthrough (watch & listen)
 *   Practice — guided ear-training with scaffolded visuals
 *   Test     — 10-round ear-training quiz
 *
 * Tier 2: "Find the Relative"
 *   Learn   — 5-step R-transform walkthrough
 *   Practice — given a key, find its relative major/minor (4 options)
 *   Test     — 10-round relative key quiz (no scaffolding)
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

// Tier 1 key pools
const T1_MAJOR_KEYS = ['C', 'G', 'D', 'F', 'Bb'];
const T1_MINOR_KEYS = ['A', 'E', 'B', 'D', 'G'];

// Tier 2 key pools (broader)
const T2_MAJOR_KEYS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'];
const T2_MINOR_KEYS = ['A', 'E', 'B', 'F#', 'D', 'G', 'C'];

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

let currentTier = 1;          // 1 or 2
let currentPhase = 'learn';   // 'learn' | 'practice' | 'test'

// Learn state (per-tier step positions preserved when switching tiers)
let learnSteps = { 1: 1, 2: 1 };
let learnAudioPlayed = false;
let learnPlaybackId = 0;      // incremented on step change to cancel stale audio
let learnSubStep = 0;         // sub-step within multi-part Learn steps

// Test state
let round = 0;
let score = 0;
let currentKey = null;         // { root, quality }
let testCorrectAnswer = null;  // for Tier 2: { root, quality } of correct answer
let awaitingAnswer = false;

// Practice state
let practiceKey = null;        // { root, quality } — the given key
let practiceCorrectAnswer = null; // for Tier 2: { root, quality }
let practiceAwaitingAnswer = false;
let practiceLastKey = null;    // avoid repeating same key

// Per-tier practice stats
let practiceStats = {
  1: { streak: 0, correctTotal: 0, roundTotal: 0 },
  2: { streak: 0, correctTotal: 0, roundTotal: 0 },
};

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

/** Get the current tier's learn step. */
function getLearnStep() {
  return learnSteps[currentTier];
}

/** Set the current tier's learn step. */
function setLearnStep(step) {
  learnSteps[currentTier] = step;
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
// DISTRACTOR GENERATION (Tier 2)
// ════════════════════════════════════════════════════════════════════

/**
 * Generate plausible wrong answers for Tier 2 questions.
 * @param {string} originalRoot - root of the given key
 * @param {string} originalQuality - quality of the given key
 * @param {string} correctRoot - root of the correct answer
 * @param {string} targetQuality - quality the answer must be ("major" or "minor")
 * @param {number} count - number of distractors
 * @returns {Array<{root: string, quality: string}>}
 */
function generateDistractors(originalRoot, originalQuality, correctRoot, targetQuality, count) {
  count = count || 3;
  const correctPC = noteToPC(correctRoot);
  const distractorPCs = new Set([correctPC]);
  const distractors = [];

  // 1. P transform from the original key → parallel (common confusion)
  const pResult = TRANSFORMS.P.apply(originalRoot, originalQuality);
  // If target quality matches, check that it's different from correct
  if (pResult.quality === targetQuality && noteToPC(pResult.root) !== correctPC) {
    if (!distractorPCs.has(noteToPC(pResult.root))) {
      distractors.push({ root: displayNote(pResult.root), quality: targetQuality });
      distractorPCs.add(noteToPC(pResult.root));
    }
  }

  // 2. L transform from the original key → leading-tone relative
  const lResult = TRANSFORMS.L.apply(originalRoot, originalQuality);
  if (lResult.quality === targetQuality && noteToPC(lResult.root) !== correctPC) {
    if (!distractorPCs.has(noteToPC(lResult.root))) {
      distractors.push({ root: displayNote(lResult.root), quality: targetQuality });
      distractorPCs.add(noteToPC(lResult.root));
    }
  }

  // If L result is wrong quality, apply R to get another nearby key of target quality
  if (distractors.length < count && lResult.quality !== targetQuality) {
    const lrResult = TRANSFORMS.R.apply(lResult.root, lResult.quality);
    if (lrResult.quality === targetQuality && !distractorPCs.has(noteToPC(lrResult.root))) {
      distractors.push({ root: displayNote(lrResult.root), quality: targetQuality });
      distractorPCs.add(noteToPC(lrResult.root));
    }
  }

  // If P result is wrong quality, try its R neighbor
  if (distractors.length < count && pResult.quality !== targetQuality) {
    const prResult = TRANSFORMS.R.apply(pResult.root, pResult.quality);
    if (prResult.quality === targetQuality && !distractorPCs.has(noteToPC(prResult.root))) {
      distractors.push({ root: displayNote(prResult.root), quality: targetQuality });
      distractorPCs.add(noteToPC(prResult.root));
    }
  }

  // 3. Fill remaining with random keys of target quality
  const pool = targetQuality === 'minor' ? T2_MINOR_KEYS : T2_MAJOR_KEYS;
  let attempts = 0;
  while (distractors.length < count && attempts < 30) {
    attempts++;
    const r = pickRandom(pool);
    const rPC = noteToPC(r);
    if (!distractorPCs.has(rPC)) {
      distractors.push({ root: displayNote(r), quality: targetQuality });
      distractorPCs.add(rPC);
    }
  }

  return shuffleArray(distractors).slice(0, count);
}

// ════════════════════════════════════════════════════════════════════
// LEARN PHASE
// ════════════════════════════════════════════════════════════════════

/** C major scale notes (used in Tier 1 Step 4). */
const C_MAJOR_SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// ── Tier 1 Learn scripts ────────────────────────────────────────────

const LEARN_SCRIPTS_T1 = [
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
      await delay(1000);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
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
      await playProgression(buildProgression(majRoot, 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
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
      await playProgression(buildProgression('C', 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(2000);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },
];

// ── Tier 2 Learn scripts ────────────────────────────────────────────

const LEARN_SCRIPTS_T2 = [
  // ── Step 1: "Every Major Has a Relative Minor" ──────────────────
  {
    narration:
      'You already know major sounds bright and minor sounds dark. Now here\u2019s the secret \u2014 every major key has a partner minor key that uses the exact same notes.',
    setup() {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      const id = learnPlaybackId;
      await playProgression(buildProgression('C', 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },

  // ── Step 2: "The R Transform" ───────────────────────────────────
  {
    narration:
      'On the Tonnetz, the R arrow always points from a major chord to its relative minor. Two notes stay \u2014 one moves up by a whole step.',
    afterText:
      'R stands for Relative \u2014 the closest minor key to any major key.',
    setup() {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      const id = learnPlaybackId;
      await delay(800);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      await playProgression(buildProgression('C', 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },

  // ── Step 3: "It Works in Every Key" ─────────────────────────────
  {
    narration:
      'The R transform works the same way no matter what key you\u2019re in. Watch.',
    subSteps: 3,
    subStepLabel: 'Another key →',
    afterText:
      'Same pattern every time \u2014 the R arrow always finds the relative minor.',
    setup(sub) {
      const pairs = [['G', 'E'], ['F', 'D'], ['D', 'B']];
      const [majRoot] = pairs[sub];
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad(majRoot, 'major');
    },
    async play(sub) {
      const id = learnPlaybackId;
      const pairs = [['G', 'E'], ['F', 'D'], ['D', 'B']];
      const [majRoot, minRoot] = pairs[sub];
      await playProgression(buildProgression(majRoot, 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', majRoot, 'major');
      await playProgression(buildProgression(minRoot, 'minor'), BPM);
    },
  },

  // ── Step 4: "Going the Other Direction" ─────────────────────────
  {
    narration:
      'It works backwards too. Every minor key has a relative major. The R arrow goes both ways.',
    subSteps: 2,
    subStepLabel: 'Show the reverse →',
    afterText:
      'Minor to major, major to minor \u2014 the R transform always connects them.',
    setup(sub) {
      const pairs = [['A', 'C'], ['E', 'G']];
      const [minRoot] = pairs[sub];
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad(minRoot, 'minor');
    },
    async play(sub) {
      const id = learnPlaybackId;
      const pairs = [['A', 'C'], ['E', 'G']];
      const [minRoot, majRoot] = pairs[sub];
      await playProgression(buildProgression(minRoot, 'minor'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', minRoot, 'minor');
      await playProgression(buildProgression(majRoot, 'major'), BPM);
    },
  },

  // ── Step 5: "Your Turn" ─────────────────────────────────────────
  {
    narration:
      'Now you know the relationship. In Practice mode, you\u2019ll hear a major key and pick its relative minor. Listen for the shared notes \u2014 that\u2019s your clue.',
    afterText: 'Ready to try it yourself →',
    setup() {
      HarmonyState.update({ annotations: ANN_TRIAD });
      HarmonyState.setTriad('C', 'major');
    },
    async play() {
      const id = learnPlaybackId;
      await playProgression(buildProgression('C', 'major'), BPM);
      if (learnPlaybackId !== id) return;
      await delay(1500);
      if (learnPlaybackId !== id) return;
      HarmonyState.update({ annotations: ANN_TRANSFORM });
      HarmonyState.setTransform('R', 'C', 'major');
      await playProgression(buildProgression('A', 'minor'), BPM);
    },
  },
];

/** Get the learn scripts for the current tier. */
function getLearnScripts() {
  return currentTier === 1 ? LEARN_SCRIPTS_T1 : LEARN_SCRIPTS_T2;
}

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
  const scripts = getLearnScripts();
  const script = scripts[getLearnStep() - 1];
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
  setLearnStep(step);
  learnSubStep = 0;
  learnAudioPlayed = false;
  learnPlaybackId++;
  const myId = learnPlaybackId;

  stopAllAudio();

  const scripts = getLearnScripts();
  const script = scripts[step - 1];
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

  const scripts = getLearnScripts();
  const script = scripts[getLearnStep() - 1];
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
// TEST PHASE
// ════════════════════════════════════════════════════════════════════

function generateTestRound() {
  if (currentTier === 1) {
    const isMajor = Math.random() < 0.5;
    const root = isMajor ? pickRandom(T1_MAJOR_KEYS) : pickRandom(T1_MINOR_KEYS);
    return { root, quality: isMajor ? 'major' : 'minor' };
  }

  // Tier 2: ask "find the relative minor" or "find the relative major"
  // After round 5, mix both directions; before that, only major→minor
  const askReverse = round >= 5 && Math.random() < 0.5;
  if (askReverse) {
    // Given minor key, find its relative major
    const root = pickRandom(T2_MINOR_KEYS);
    const answer = TRANSFORMS.R.apply(root, 'minor');
    return {
      root,
      quality: 'minor',
      direction: 'minor-to-major',
      correctAnswer: { root: displayNote(answer.root), quality: answer.quality },
    };
  } else {
    // Given major key, find its relative minor
    const root = pickRandom(T2_MAJOR_KEYS);
    const answer = TRANSFORMS.R.apply(root, 'major');
    return {
      root,
      quality: 'major',
      direction: 'major-to-minor',
      correctAnswer: { root: displayNote(answer.root), quality: answer.quality },
    };
  }
}

function showTestQuestion() {
  if (currentTier === 1) {
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
  } else {
    // Tier 2
    const dir = currentKey.direction;
    if (dir === 'major-to-minor') {
      $('question-text').textContent =
        `What is the relative minor of ${displayNote(currentKey.root)} major?`;
    } else {
      $('question-text').textContent =
        `What is the relative major of ${displayNote(currentKey.root)} minor?`;
    }

    const btnArea = $('answer-buttons');
    btnArea.innerHTML = '';

    const correct = testCorrectAnswer;
    const targetQuality = correct.quality;
    const distractors = generateDistractors(
      currentKey.root, currentKey.quality, correct.root, targetQuality
    );
    const options = shuffleArray([correct, ...distractors]);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'rkt-answer-btn';
      btn.textContent = `${opt.root} ${opt.quality}`;
      btn.addEventListener('click', () => handleTestAnswer(opt.root, opt.quality));
      btnArea.appendChild(btn);
    });
  }
}

async function handleTestAnswer(answerRootOrQuality, answerQuality) {
  if (!awaitingAnswer) return;
  awaitingAnswer = false;

  let correct;
  if (currentTier === 1) {
    correct = currentKey.quality === answerRootOrQuality;
  } else {
    correct =
      noteToPC(answerRootOrQuality) === noteToPC(testCorrectAnswer.root) &&
      answerQuality === testCorrectAnswer.quality;
  }

  if (correct) score++;

  if (currentTier === 1) {
    // Reveal triad
    HarmonyState.update({ annotations: ANN_TRIAD });
    HarmonyState.setTriad(currentKey.root, currentKey.quality);
    showFeedback(correct, `It was ${displayNote(currentKey.root)} ${currentKey.quality}.`);
  } else {
    // Tier 2: reveal R transform
    HarmonyState.update({ annotations: ANN_TRANSFORM });
    HarmonyState.setTransform('R', currentKey.root, currentKey.quality);

    const ca = testCorrectAnswer;
    if (correct) {
      showFeedback(true, `${ca.root} ${ca.quality} is the relative ${ca.quality} of ${displayNote(currentKey.root)} ${currentKey.quality}.`);
    } else {
      showFeedback(false, `The relative ${ca.quality} of ${displayNote(currentKey.root)} ${currentKey.quality} is ${ca.root} ${ca.quality}. Watch the R arrow.`);
    }

    // Play the correct answer's progression
    const correctProg = buildProgression(ca.root, ca.quality);
    playProgression(correctProg, BPM);
  }

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
  testCorrectAnswer = currentKey.correctAnswer || null;

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

/** Pick a random key for Practice, avoiding the same key twice in a row. */
function generatePracticeRound() {
  if (currentTier === 1) {
    let key;
    do {
      const isMajor = Math.random() < 0.5;
      const root = isMajor ? pickRandom(T1_MAJOR_KEYS) : pickRandom(T1_MINOR_KEYS);
      key = { root, quality: isMajor ? 'major' : 'minor' };
    } while (
      practiceLastKey &&
      key.root === practiceLastKey.root &&
      key.quality === practiceLastKey.quality
    );
    return key;
  }

  // Tier 2
  const stats = practiceStats[2];
  const askReverse = stats.roundTotal >= 5 && Math.random() < 0.5;
  let key;
  do {
    if (askReverse) {
      const root = pickRandom(T2_MINOR_KEYS);
      const answer = TRANSFORMS.R.apply(root, 'minor');
      key = {
        root,
        quality: 'minor',
        direction: 'minor-to-major',
        correctAnswer: { root: displayNote(answer.root), quality: answer.quality },
      };
    } else {
      const root = pickRandom(T2_MAJOR_KEYS);
      const answer = TRANSFORMS.R.apply(root, 'major');
      key = {
        root,
        quality: 'major',
        direction: 'major-to-minor',
        correctAnswer: { root: displayNote(answer.root), quality: answer.quality },
      };
    }
  } while (
    practiceLastKey &&
    key.root === practiceLastKey.root &&
    key.quality === practiceLastKey.quality
  );
  return key;
}

/** Render the practice answer buttons for the current round. */
function renderPracticeButtons() {
  const btnArea = $('practice-answer-buttons');
  btnArea.innerHTML = '';

  if (currentTier === 1) {
    $('practice-question-text').textContent = 'Is this major or minor?';
    ['Major', 'Minor'].forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'rkt-answer-btn';
      btn.dataset.answer = label.toLowerCase();
      btn.textContent = label;
      btnArea.appendChild(btn);
    });
  } else {
    // Tier 2: dynamic question and 4 answer buttons
    const dir = practiceKey.direction;
    if (dir === 'major-to-minor') {
      $('practice-question-text').textContent =
        `What is the relative minor of ${displayNote(practiceKey.root)} major?`;
    } else {
      $('practice-question-text').textContent =
        `What is the relative major of ${displayNote(practiceKey.root)} minor?`;
    }

    const correct = practiceCorrectAnswer;
    const targetQuality = correct.quality;
    const distractors = generateDistractors(
      practiceKey.root, practiceKey.quality, correct.root, targetQuality
    );
    const options = shuffleArray([correct, ...distractors]);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'rkt-answer-btn';
      btn.dataset.answer = `${opt.root}|${opt.quality}`;
      btn.textContent = `${opt.root} ${opt.quality}`;
      btnArea.appendChild(btn);
    });
  }
}

/** Start a new Practice round. */
async function startPracticeRound() {
  practiceKey = generatePracticeRound();
  practiceLastKey = practiceKey;
  practiceCorrectAnswer = practiceKey.correctAnswer || null;
  practiceAwaitingAnswer = true;

  // Reset UI
  $('practice-feedback').className = 'rkt-feedback';
  $('practice-feedback').textContent = '';
  $('practice-next-wrap').style.display = 'none';

  // Render answer buttons
  renderPracticeButtons();
  setPracticeButtons(true);

  // Tonnetz + keyboard setup
  HarmonyState.reset();
  if (currentTier === 1) {
    // Grid centered on key, no triad highlighted
    HarmonyState.update({
      tonnetzCenter: { root: practiceKey.root, quality: practiceKey.quality },
      tonnetzDepth: 1,
      annotations: ANN_OFF,
      keyboardMode: 'both',
    });
  } else {
    // Tier 2: show the given key's triad as scaffolding
    HarmonyState.update({
      annotations: ANN_TRIAD,
      keyboardMode: 'both',
    });
    HarmonyState.setTriad(practiceKey.root, practiceKey.quality);
  }

  updatePracticeStats();

  const prog = buildProgression(practiceKey.root, practiceKey.quality);
  await playProgression(prog, BPM);
}

/** Handle a practice answer (delegates to tier-specific logic). */
function handlePracticeAnswer(answer) {
  if (!practiceAwaitingAnswer) return;
  practiceAwaitingAnswer = false;

  const stats = practiceStats[currentTier];
  stats.roundTotal++;

  if (currentTier === 1) {
    handlePracticeAnswerT1(answer, stats);
  } else {
    handlePracticeAnswerT2(answer, stats);
  }

  setPracticeButtons(false);
  $('practice-next-wrap').style.display = '';
  updatePracticeStats();

  // Auto-replay so they hear it with the visual confirmation
  replayPracticeAudio();
}

/** Tier 1 practice answer handler. */
function handlePracticeAnswerT1(answer, stats) {
  const correct = practiceKey.quality === answer;

  // Reveal triad on Tonnetz + keyboard
  HarmonyState.update({ annotations: ANN_TRIAD });
  HarmonyState.setTriad(practiceKey.root, practiceKey.quality);

  if (correct) {
    stats.streak++;
    stats.correctTotal++;
    const msgs = practiceKey.quality === 'major'
      ? ['Yes! Hear that bright, open quality?', "That's right \u2014 major sounds open and resolved.", 'Nice ear!']
      : ['Yes! Hear that darker, more serious quality?', "That's right \u2014 minor sounds heavier and more wistful.", 'Nice ear!'];
    let msg = pickRandom(msgs);
    if (stats.streak === 3) msg += " You're getting the hang of it!";
    showPracticeFeedback('correct', msg);
  } else {
    stats.streak = 0;
    const name = `${displayNote(practiceKey.root)} ${practiceKey.quality}`;
    const tip = practiceKey.quality === 'major'
      ? 'hear how it sounds brighter and more open?'
      : 'hear how it sounds darker and more serious?';
    showPracticeFeedback('incorrect', `This one is actually ${name}. Listen again \u2014 ${tip}`);
  }
}

/** Tier 2 practice answer handler. */
function handlePracticeAnswerT2(answer, stats) {
  // answer is "Root|quality" string
  const [ansRoot, ansQuality] = answer.split('|');
  const ca = practiceCorrectAnswer;
  const correct = noteToPC(ansRoot) === noteToPC(ca.root) && ansQuality === ca.quality;

  if (correct) {
    stats.streak++;
    stats.correctTotal++;

    // Animate R transform
    HarmonyState.update({ annotations: ANN_TRANSFORM });
    HarmonyState.setTransform('R', practiceKey.root, practiceKey.quality);

    showPracticeFeedback('correct',
      `Yes! ${ca.root} ${ca.quality} is the relative ${ca.quality} of ${displayNote(practiceKey.root)} ${practiceKey.quality}. They share all the same notes.`
    );
  } else {
    stats.streak = 0;

    // Still animate R transform to show correct answer
    HarmonyState.update({ annotations: ANN_TRANSFORM });
    HarmonyState.setTransform('R', practiceKey.root, practiceKey.quality);

    showPracticeFeedback('incorrect',
      `The relative ${ca.quality} of ${displayNote(practiceKey.root)} ${practiceKey.quality} is ${ca.root} ${ca.quality}. Watch the R arrow on the Tonnetz.`
    );
  }
}

/** Handle the "Show me" button — reveal without penalty. */
function handlePracticeShowMe() {
  if (!practiceAwaitingAnswer) return;
  practiceAwaitingAnswer = false;

  const stats = practiceStats[currentTier];
  stats.roundTotal++;

  if (currentTier === 1) {
    // Reveal
    HarmonyState.update({ annotations: ANN_TRIAD });
    HarmonyState.setTriad(practiceKey.root, practiceKey.quality);

    const name = `${displayNote(practiceKey.root)} ${practiceKey.quality}`;
    showPracticeFeedback('neutral', `This is ${name}. Listen to how it sounds.`);
  } else {
    // Tier 2: animate R transform
    HarmonyState.update({ annotations: ANN_TRANSFORM });
    HarmonyState.setTransform('R', practiceKey.root, practiceKey.quality);

    const ca = practiceCorrectAnswer;
    showPracticeFeedback('neutral',
      `The relative ${ca.quality} of ${displayNote(practiceKey.root)} ${practiceKey.quality} is ${ca.root} ${ca.quality}. Watch the R arrow.`
    );
  }

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
  const stats = practiceStats[currentTier];
  $('practice-streak').textContent = `Streak: ${stats.streak}`;
  $('practice-rounds').textContent = `Rounds: ${stats.roundTotal}`;

  // "Try the Test" prompt
  const prompt = $('practice-test-prompt');
  if (stats.roundTotal >= 10) {
    $('practice-test-prompt-text').textContent = "You've done 10 rounds! ";
    $('practice-goto-test').textContent = 'Ready for the real test? \u2192';
    prompt.style.display = '';
  } else if (stats.correctTotal >= 5) {
    $('practice-test-prompt-text').textContent = '';
    $('practice-goto-test').textContent = 'Feeling confident? Try the Test \u2192';
    prompt.style.display = '';
  } else {
    prompt.style.display = 'none';
  }
}

// ════════════════════════════════════════════════════════════════════
// TIER SWITCHING
// ════════════════════════════════════════════════════════════════════

function switchTier(tier) {
  if (tier === currentTier) return;
  currentTier = tier;

  // Update tier tab UI
  document.querySelectorAll('.rkt-tier-tab').forEach(tab => {
    tab.classList.toggle('rkt-tier-tab--active', Number(tab.dataset.tier) === tier);
  });

  // Reset to Learn phase for the new tier
  switchPhase('learn');
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
    showLearnStep(getLearnStep());
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

  // Tier tabs
  document.querySelectorAll('.rkt-tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!audioStarted) return;
      switchTier(Number(tab.dataset.tier));
    });
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
    if (getLearnStep() > 1) showLearnStep(getLearnStep() - 1);
  });

  $('btn-learn-next').addEventListener('click', () => {
    if (!learnAudioPlayed) return;
    if (getLearnStep() < 5) {
      showLearnStep(getLearnStep() + 1);
    } else {
      // After step 5 → practice
      switchPhase('practice');
    }
  });

  $('btn-learn-replay').addEventListener('click', learnReplay);

  // Practice buttons (event delegation)
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
