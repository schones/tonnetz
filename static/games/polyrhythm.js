/* ============================================================
   Polyrhythm Trainer (B8)
   ============================================================
   Guitar Hero-style two-lane falling-note game. Teaches rhythmic
   independence by showing two independent beat streams in parallel
   with distinct timbres and visuals.

   Wires: Web Audio API scheduler, canvas renderer, keyboard +
   click input, scoring, plus shared input-provider.js for unified
   modality switching (click / MIDI / mic onset). Mic onset routes
   to a single layer at a time — see audio-architecture.md for the
   single-stream constraint that limits mic to Level 1.
   ============================================================ */

import { createInputProvider } from '/static/shared/input-provider.js';
import SONG_EXAMPLES from '/static/shared/song-examples.js';

/* ── Constants ──────────────────────────────────────────── */
const HIT_Y          = 280;          // y of hit zone in 420px canvas; ~140px below is the post-hit effects area
const LANE_X_A_FRAC  = 0.33;
const LANE_X_B_FRAC  = 0.67;
const LANE_COLOR_A   = '#7F77DD';    // purple
const LANE_COLOR_B   = '#EF9F27';    // gold
const LANE_COLOR_A_RGB = '127, 119, 221';
const LANE_COLOR_B_RGB = '239, 159, 39';
const BASE_LANE_W    = 78;
const LANE_EXPAND    = 22;
const NOTE_COLORS = { A: LANE_COLOR_A, B: LANE_COLOR_B };
const NOTE_COLORS_RGB = { A: LANE_COLOR_A_RGB, B: LANE_COLOR_B_RGB };
const PERFECT_MS     = 40;            // Perfect window — fixed across tolerance levels

/* ── Practice-mode phase engine ──────────────────────────── */
const LISTEN_BARS       = 4;     // bars of reference playback before Phase 2 begins
const PHASE_EVAL_BARS   = 4;     // BPM promote/demote window inside a phase
const PHASE_PROMOTE_ACC = 0.80;  // window accuracy to step BPM up (or advance at goal)
const PHASE_DEMOTE_ACC  = 0.50;  // window accuracy to step BPM down

const PHASES_ORDER = ['listen', 'layerA', 'layerB', 'both'];
const PHASE_LABELS = { listen: 'Listen', layerA: 'Layer A', layerB: 'Layer B', both: 'Both' };
const PHASE_MESSAGES = {
  listen: 'Listen — hear how the two patterns interlock.',
  layerA: 'Tap the <strong>purple</strong> rhythm (F / left pad).',
  layerB: 'Now tap the <strong>gold</strong> rhythm (J / right pad).',
  both:   '<strong>Both hands</strong> — one rhythm each (F + J, or both pads).',
};

/* ── Challenge-mode adaptive engine (Pattern B, three independent axes) ── */
const POLY_PROGRESSION = ['2:3', '3:2', '3:4', '4:3', '5:4'];
const TOLERANCE_LEVELS = [
  { name: 'wide',   goodMs: 120 },
  { name: 'medium', goodMs: 90  },
  { name: 'tight',  goodMs: 60  },
];
const BPM_FLOOR   = 50;
const BPM_CEILING = 200;
const TEMPO_PROMOTE_BARS        = 3;   // +10 BPM after 3 bars >80% both layers
const TEMPO_DEMOTE_BARS         = 2;   // −10 BPM after 2 bars <50% either layer
const COMPLEXITY_PROMOTE_BARS   = 16;  // next polyrhythm after 16 bars >80% both layers
const TOLERANCE_PROMOTE_BARS    = 8;   // tighter window after 8 bars >80% avg
const SESSION_FAIL_BARS         = 4;   // end session after 4 bars <30% avg
const SESSION_FAIL_THRESHOLD    = 0.30;
const RESULT_STORAGE_KEY        = 'songlab_results_polyrhythm';
const CHALLENGE_LEADERBOARD_KEY = 'songlab_challenge_polyrhythm';
const LEADERBOARD_SIZE          = 5;

/* ── Song connections ────────────────────────────────────── */
// Map polyrhythm ratio → song-examples.js entry + optional walkthroughs.js id
const POLY_SONG_MAP = {
  '3:2': { songId: 'triplet_swing_guaraldi', walkthroughId: null },
};

/* ── DOM ────────────────────────────────────────────────── */
const canvas       = document.getElementById('pr-canvas');
const ctx          = canvas.getContext('2d');
const polyEl       = document.getElementById('pr-polyrhythm');
const modesEl      = document.getElementById('pr-modes');
const presetsEl    = document.getElementById('pr-presets');
const goalBpmEl    = document.getElementById('pr-goal-bpm');
const goalBpmValueEl = document.getElementById('pr-goal-bpm-value');
const startBpmEl   = document.getElementById('pr-start-bpm');
const startBpmValueEl = document.getElementById('pr-start-bpm-value');
const incrementsEl = document.getElementById('pr-increments');
const bpmEl        = document.getElementById('pr-bpm');
const bpmValueEl   = document.getElementById('pr-bpm-value');
const startBtn     = document.getElementById('pr-start');
const muteAEl      = document.getElementById('pr-mute-a');
const muteBEl      = document.getElementById('pr-mute-b');
const padAEl       = document.getElementById('pr-pad-a');
const padBEl       = document.getElementById('pr-pad-b');
const accAEl       = document.getElementById('pr-acc-a');
const accBEl       = document.getElementById('pr-acc-b');
const streakEl     = document.getElementById('pr-streak');
const messageEl    = document.getElementById('pr-message');
const modeOnlyEls  = document.querySelectorAll('.pr-mode-only');

// Adaptive toast + results overlay (created/wired lazily in init)
const adaptToastEl = document.getElementById('pr-adapt-toast');
const resultsEl    = document.getElementById('pr-results');
const resultStreakEl = document.getElementById('pr-result-streak');
const resultScoreEl  = document.getElementById('pr-result-score');
const resultPolyEl   = document.getElementById('pr-result-poly');
const resultBpmEl    = document.getElementById('pr-result-bpm');
const resultToleranceEl = document.getElementById('pr-result-tolerance');
const resultSongCard   = document.getElementById('pr-result-song');
const resultSongTitle  = document.getElementById('pr-result-song-title');
const resultSongArtist = document.getElementById('pr-result-song-artist');
const resultSongInsight = document.getElementById('pr-result-song-insight');
const resultSongLink   = document.getElementById('pr-result-song-link');
const replayBtn  = document.getElementById('pr-replay');

// Practice-mode overlay + controls (created in the template for Prompt 2)
const skipBothEl        = document.getElementById('pr-skip-both');
const practiceResultsEl = document.getElementById('pr-practice-results');
const challengeResultsEl = document.getElementById('pr-challenge-results');
const practiceTimeEl    = document.getElementById('pr-practice-time');
const practiceActionsEl = document.getElementById('pr-practice-actions');
const challengeActionsEl = document.getElementById('pr-challenge-actions');
const practiceRetryBtn  = document.getElementById('pr-practice-retry');
const practiceNewGoalBtn= document.getElementById('pr-practice-new-goal');
const practiceNewPolyBtn= document.getElementById('pr-practice-new-poly');
// phase result cells
const phaseRowEls = {
  layerA: {
    row:  document.getElementById('pr-phase-row-a'),
    bpm:  document.getElementById('pr-phase-bpm-a'),
    acc:  document.getElementById('pr-phase-acc-a'),
    mark: document.getElementById('pr-phase-mark-a'),
  },
  layerB: {
    row:  document.getElementById('pr-phase-row-b'),
    bpm:  document.getElementById('pr-phase-bpm-b'),
    acc:  document.getElementById('pr-phase-acc-b'),
    mark: document.getElementById('pr-phase-mark-b'),
  },
  both: {
    row:  document.getElementById('pr-phase-row-both'),
    bpm:  document.getElementById('pr-phase-bpm-both'),
    acc:  document.getElementById('pr-phase-acc-both'),
    mark: document.getElementById('pr-phase-mark-both'),
  },
};

/* ── State ──────────────────────────────────────────────── */
const state = {
  // config
  mode: 'practice',    // 'practice' | 'challenge'
  polyrhythm: '3:2',
  nA: 3,
  nB: 2,
  bpm: 80,             // active tempo; in practice mode mirrors currentBpm, in challenge reflects the single slider
  goalBpm: 150,        // practice mode only
  startBpm: 60,        // practice mode only
  bpmIncrement: 10,    // practice mode only — BPM step per promotion
  currentBpm: 60,      // practice mode — ramps from startBpm → goalBpm within each phase
  barDuration: 3.0,    // (60/bpm) * 4
  beatTimesA: [],
  beatTimesB: [],
  muteA: false,
  muteB: false,

  // Practice-mode phase engine
  phase: 'listen',      // 'listen' | 'layerA' | 'layerB' | 'both' | 'results'
  barsInWindow: 0,      // bars elapsed in the current eval window
  windowHits: 0,        // good+perfect taps counted for the current eval window
  windowTotal: 0,       // expected taps counted for the current eval window
  phaseResults: { layerA: null, layerB: null, both: null },
  phaseTotals: {         // per-phase cumulative hit/total for the overall phase accuracy
    layerA: { hits: 0, total: 0 },
    layerB: { hits: 0, total: 0 },
    both:   { hits: 0, total: 0 },
  },
  practiceStartMs: 0,   // wall-clock start of the practice session (for "Total time")

  // runtime
  running: false,
  audioCtx: null,
  masterGain: null,      // cut on every restart to silence in-flight oscillators
  gainA: null,           // per-layer gain — mute by setting value to 0
  gainB: null,
  playStartTime: 0,      // AudioContext time at which bar 0 begins
  nextBarContextTime: 0, // AudioContext time for next bar to schedule
  schedulerTimer: null,
  rafId: null,

  // visuals / feedback
  particles: [],
  blooms: [],           // { x, y, rgb, life, maxLife }
  rings: [],            // expanding hit rings { x, y, rgb, life }
  combos: [],           // floating text { x, y, text, color, life }
  tapFlashA: 0,
  tapFlashB: 0,

  // scoring (overall session — used for HUD + results)
  totalTapsA: 0,
  goodTapsA: 0,        // good-or-better hits (perfect + good)
  totalTapsB: 0,
  goodTapsB: 0,
  streak: 0,
  bestStreak: 0,

  // per-rating counts (for score = perfect*300 + good*100)
  perfectA: 0, goodA: 0, missA: 0,
  perfectB: 0, goodB: 0, missB: 0,

  // ResultDetail logs — one entry per tap, per layer
  logA: [], logB: [],

  // hit bookkeeping — per bar, per beat: record whether we've already counted a tap
  hitResultsA: new Map(),   // key `${bar}:${i}` -> 'perfect' | 'good' | 'miss' | 'untapped'
  hitResultsB: new Map(),
  missedMarkedBar: -1,      // track which past bars have been swept for misses

  // Session meta
  totalBarsPlayed: 0,
  ended: false,             // true once endSession() has fired (prevents re-entry)

  // Challenge-mode adaptive engine state (Pattern B, three independent axes)
  adaptive: {
    polyIndex: 1,            // index into POLY_PROGRESSION — synced on start()
    toleranceIdx: 0,         // index into TOLERANCE_LEVELS — starts 'wide'

    // Axis 1 — tempo (consecutive bar accuracy)
    barsBothAbove80: 0,
    barsEitherBelow50: 0,

    // Axis 2 — complexity (bars with both layers >80%)
    barsComplexityAbove80: 0,

    // Axis 3 — tolerance (bars with averaged accuracy >80%)
    barsSustained80: 0,

    // Session fail — bars with averaged accuracy <30%
    barsFailing: 0,
  },

  // Challenge-mode: polyrhythms walked during the session (starts with user's pick).
  polyrhythmProgression: [],

  // input-provider integration
  provider: null,           // createInputProvider instance
  analyser: null,           // Tone.Analyser for onset detection
  mic: null,                // Tone.UserMedia bridging mic → analyser
  micWiringPromise: null,   // pending mic-open call (gated on user gesture)
  onsetLayer: 'A',          // which layer mic-onset taps drive (Level 1)
};

/* ── Challenge-mode instructions ────────────────────────── */
const CHALLENGE_COPY = 'Challenge — both layers, both pads. How far can you get?';

/* ══════════════════════════════════════════════════════════
   CONFIG / SETUP
   ══════════════════════════════════════════════════════════ */
function parsePolyrhythm(str) {
  const [a, b] = str.split(':').map(Number);
  return { nA: a, nB: b };
}

function buildBeatTimes() {
  const { nA, nB, barDuration } = state;
  state.beatTimesA = Array.from({ length: nA }, (_, i) => (i / nA) * barDuration);
  state.beatTimesB = Array.from({ length: nB }, (_, i) => (i / nB) * barDuration);
}

function updateConfig() {
  const { nA, nB } = parsePolyrhythm(state.polyrhythm);
  state.nA = nA;
  state.nB = nB;
  state.barDuration = (60 / state.bpm) * 4;
  buildBeatTimes();
}

/* ══════════════════════════════════════════════════════════
   AUDIO — Web Audio API, scheduled lookahead
   ══════════════════════════════════════════════════════════ */
function ensureAudioCtx() {
  if (!state.audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AC();
  }
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  return state.audioCtx;
}

/* Build a fresh master + per-layer gain chain. Any existing chain is cut
   to zero and discarded, so oscillators scheduled against it go silent
   immediately — this is how we prevent audio overlap when the scheduler
   already pre-scheduled beats into the future. */
function setupGainChain() {
  const ac = state.audioCtx;
  if (!ac) return;
  teardownGainChain();

  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);

  const gA = ac.createGain();
  gA.gain.value = state.muteA ? 0 : 1;
  gA.connect(master);

  const gB = ac.createGain();
  gB.gain.value = state.muteB ? 0 : 1;
  gB.connect(master);

  state.masterGain = master;
  state.gainA = gA;
  state.gainB = gB;
}

function teardownGainChain() {
  if (state.masterGain) {
    state.masterGain.gain.value = 0;
    try { state.masterGain.disconnect(); } catch (e) { /* ok */ }
    state.masterGain = null;
  }
  if (state.gainA) {
    try { state.gainA.disconnect(); } catch (e) { /* ok */ }
    state.gainA = null;
  }
  if (state.gainB) {
    try { state.gainB.disconnect(); } catch (e) { /* ok */ }
    state.gainB = null;
  }
}

function scheduleClick(layer, contextTime) {
  const ac = state.audioCtx;
  if (!ac) return;
  const layerGain = layer === 'A' ? state.gainA : state.gainB;
  if (!layerGain) return; // no chain — game isn't running
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain).connect(layerGain);

  if (layer === 'A') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, contextTime);
    gain.gain.setValueAtTime(0.25, contextTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, contextTime + 0.05);
    osc.start(contextTime);
    osc.stop(contextTime + 0.06);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, contextTime);
    gain.gain.setValueAtTime(0.30, contextTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, contextTime + 0.09);
    osc.start(contextTime);
    osc.stop(contextTime + 0.10);
  }
}

function playClickNow(layer) {
  const ac = ensureAudioCtx();
  scheduleClick(layer, ac.currentTime);
}

/* Scheduler: look ahead 0.15s, schedule all beats whose context time
   falls within that window. Fires every 20ms. */
const SCHED_LOOKAHEAD = 0.15;
const SCHED_INTERVAL_MS = 20;

function schedulerTick() {
  if (!state.running) return;
  const ac = state.audioCtx;
  if (!ac) return;
  const horizon = ac.currentTime + SCHED_LOOKAHEAD;

  while (state.nextBarContextTime < horizon) {
    const barStart = state.nextBarContextTime;
    // Schedule every beat in this bar — muting is handled by layer gain.
    for (const t of state.beatTimesA) scheduleClick('A', barStart + t);
    for (const t of state.beatTimesB) scheduleClick('B', barStart + t);
    state.nextBarContextTime += state.barDuration;
  }

  state.schedulerTimer = setTimeout(schedulerTick, SCHED_INTERVAL_MS);
}

/* ══════════════════════════════════════════════════════════
   TIMING HELPERS (game clock)
   ══════════════════════════════════════════════════════════ */
function getElapsed() {
  if (!state.audioCtx) return 0;
  return state.audioCtx.currentTime - state.playStartTime;
}

function currentBarAndPhase() {
  const elapsed = getElapsed();
  const bar = Math.floor(elapsed / state.barDuration);
  const phase = elapsed - bar * state.barDuration;
  return { elapsed, bar, phase };
}

/* ══════════════════════════════════════════════════════════
   INPUT / TAP HANDLING
   ══════════════════════════════════════════════════════════ */
function handleTap(layer) {
  if (!state.running) return;
  if (state.mode === 'practice') {
    if (state.phase === 'listen' || state.phase === 'results') return;
    if (state.phase === 'layerA' && layer !== 'A') return;
    if (state.phase === 'layerB' && layer !== 'B') return;
  }
  // Challenge mode: both layers always active — no phase gating.
  const elapsed = getElapsed();
  if (elapsed < 0) return;

  const tapTime = elapsed;
  const beats = layer === 'A' ? state.beatTimesA : state.beatTimesB;
  const nBeats = beats.length;
  const results = layer === 'A' ? state.hitResultsA : state.hitResultsB;

  // Find the nearest beat across [currentBar-1, currentBar, currentBar+1]
  const bar = Math.floor(tapTime / state.barDuration);
  let best = { delta: Infinity, absDelta: Infinity, bar: 0, i: 0, expected: 0 };
  for (let b = bar - 1; b <= bar + 1; b++) {
    for (let i = 0; i < nBeats; i++) {
      const beatAbs = b * state.barDuration + beats[i];
      const delta = tapTime - beatAbs;       // positive = late
      const abs = Math.abs(delta);
      if (abs < best.absDelta) {
        best = { delta, absDelta: abs, bar: b, i, expected: beatAbs };
      }
    }
  }

  const deltaMs = best.delta * 1000;
  const absMs = Math.abs(deltaMs);
  const goodWindow = currentGoodWindow();
  let rating;
  if (absMs <= PERFECT_MS)      rating = 'perfect';
  else if (absMs <= goodWindow) rating = 'good';
  else                          rating = 'miss';

  const key = `${best.bar}:${best.i}`;
  // Don't double-count: if this beat already has a perfect/good, keep the best
  const prior = results.get(key);
  if (prior === 'perfect') return;
  if (prior === 'good' && rating !== 'perfect') return;
  results.set(key, rating);

  // Log the tap for ResultDetail (per-tap schema)
  const logEntry = {
    expected: Number(best.expected.toFixed(4)),
    actual:   Number(tapTime.toFixed(4)),
    deltaMs:  Math.round(deltaMs),
    rating,
  };
  if (layer === 'A') state.logA.push(logEntry); else state.logB.push(logEntry);

  // scoring + per-rating counts
  if (layer === 'A') {
    state.totalTapsA += 1;
    if (rating === 'perfect') { state.perfectA += 1; state.goodTapsA += 1; }
    else if (rating === 'good') { state.goodA += 1; state.goodTapsA += 1; }
    else { state.missA += 1; }
  } else {
    state.totalTapsB += 1;
    if (rating === 'perfect') { state.perfectB += 1; state.goodTapsB += 1; }
    else if (rating === 'good') { state.goodB += 1; state.goodTapsB += 1; }
    else { state.missB += 1; }
  }
  if (rating === 'miss') {
    state.streak = 0;
  } else {
    state.streak += 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  }

  // Visual feedback
  const laneX = layer === 'A' ? canvas.clientWidth * LANE_X_A_FRAC : canvas.clientWidth * LANE_X_B_FRAC;
  const rgb = NOTE_COLORS_RGB[layer];
  if (layer === 'A') state.tapFlashA = 1.0; else state.tapFlashB = 1.0;

  state.blooms.push({ x: laneX, y: HIT_Y, rgb, life: 1.0 });
  state.rings.push({ x: laneX, y: HIT_Y, rgb, life: 1.0 });

  if (rating !== 'miss') {
    spawnParticles(laneX, HIT_Y, rgb, rating === 'perfect' ? 14 : 12);
  }

  const comboText = rating === 'perfect' ? 'Perfect' : rating === 'good' ? 'Good' : 'Miss';
  const comboColor = rating === 'perfect' ? LANE_COLOR_A
                   : rating === 'good'    ? '#e0ddd4'
                   : '#e85b5b';
  state.combos.push({ x: laneX, y: HIT_Y + 22, text: comboText, color: comboColor, life: 1.0 });

  flashPad(layer, rating === 'miss' ? 'miss' : 'hit');

  updateHud();
}

/* Pad flash: 'hit' for 120ms, 'miss' for 200ms. Restarts cleanly on rapid retaps. */
const padFlashTimers = { A: null, B: null };
function flashPad(layer, kind) {
  const pad = layer === 'A' ? padAEl : padBEl;
  if (!pad) return;
  pad.classList.remove('hit', 'miss');
  // Force reflow so the class re-add restarts any running transition.
  void pad.offsetWidth;
  pad.classList.add(kind);
  if (padFlashTimers[layer]) clearTimeout(padFlashTimers[layer]);
  const duration = kind === 'hit' ? 120 : 200;
  padFlashTimers[layer] = setTimeout(() => {
    pad.classList.remove(kind);
    padFlashTimers[layer] = null;
  }, duration);
}

/* Dim/undim the drum pads based on the current training phase.
   'listen' → both dimmed · 'layerA' → B dimmed · 'layerB' → A dimmed · 'both' → neither */
function setActivePads(phase) {
  if (!padAEl || !padBEl) return;
  padAEl.classList.remove('dimmed');
  padBEl.classList.remove('dimmed');
  if (phase === 'listen') {
    padAEl.classList.add('dimmed');
    padBEl.classList.add('dimmed');
  } else if (phase === 'layerA') {
    padBEl.classList.add('dimmed');
  } else if (phase === 'layerB') {
    padAEl.classList.add('dimmed');
  }
}

function spawnParticles(x, y, rgb, count) {
  for (let i = 0; i < count; i++) {
    // Downward hemisphere (0..π) so particles spray into the area below HIT_Y.
    const angle = Math.random() * Math.PI;
    const speed = 2.2 + Math.random() * 3.4;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + 0.6,
      life: 0.95 + Math.random() * 0.15,
      rgb,
      size: 2 + Math.random() * 3,
    });
  }
}

/* Sweep past bars for missed beats (no tap logged), then evaluate per-bar
   accuracy for the practice-phase engine (in practice) or the three adaptive
   axes + session-fail check (in challenge). */
function sweepMisses() {
  const { bar } = currentBarAndPhase();
  const sweepTargetBar = bar - 1;
  if (sweepTargetBar <= state.missedMarkedBar) return;

  for (let b = state.missedMarkedBar + 1; b <= sweepTargetBar; b++) {
    for (const [beats, results] of [
      [state.beatTimesA, state.hitResultsA],
      [state.beatTimesB, state.hitResultsB],
    ]) {
      for (let i = 0; i < beats.length; i++) {
        const key = `${b}:${i}`;
        if (!results.has(key)) results.set(key, 'untapped');
      }
    }
    state.missedMarkedBar = b;
    state.totalBarsPlayed += 1;

    if (state.mode === 'practice') {
      // Practice: listen-phase countdown, then 4-bar eval windows per phase.
      if (state.phase === 'listen') {
        state.barsInWindow += 1;
        if (state.barsInWindow >= LISTEN_BARS) {
          advancePhase();
          return; // applyAudioConfig inside advancePhase reset the bar clock
        }
      } else if (state.phase === 'layerA' || state.phase === 'layerB' || state.phase === 'both') {
        aggregateBarIntoWindow(b);
        state.barsInWindow += 1;
        if (state.barsInWindow >= PHASE_EVAL_BARS) {
          evalPhaseWindow();
          return;
        }
      }
    } else {
      // Challenge: feed per-bar accuracy into each adaptive axis + session-fail.
      const acc = barAccuracy(b);
      // Session-fail check runs first so we can early-exit before wasting
      // cycles on axes that won't matter after endSession() fires.
      if (evalSessionFail(acc)) { endSession(); return; }
      evalTempoAxis(acc);
      evalComplexityAxis(acc);
      evalToleranceAxis(acc);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   PRACTICE MODE — phase engine
   ══════════════════════════════════════════════════════════
   Runs only when state.mode === 'practice'. Walks the player
   through Listen → Layer A → Layer B → Both, ramping BPM
   from startBpm → goalBpm inside each scored phase based on
   4-bar accuracy windows. See docs/polyrhythm-trainer-spec.md
   ("Practice Mode — Structured Training Ramp").
   ══════════════════════════════════════════════════════════ */

function initPracticeSession() {
  state.phase = 'listen';
  state.currentBpm = state.startBpm;
  state.bpm = state.startBpm;
  state.barsInWindow = 0;
  state.windowHits = 0;
  state.windowTotal = 0;
  state.phaseResults = { layerA: null, layerB: null, both: null };
  state.phaseTotals = {
    layerA: { hits: 0, total: 0 },
    layerB: { hits: 0, total: 0 },
    both:   { hits: 0, total: 0 },
  };
  state.practiceStartMs = Date.now();
}

/* Count completed bar `b` into the current window AND the phase's cumulative
   total. Which layers feed the numbers depends on the active phase. */
function aggregateBarIntoWindow(b) {
  const phase = state.phase;
  const phaseKey = phase === 'layerA' ? 'layerA' : phase === 'layerB' ? 'layerB' : 'both';
  const layers = [];
  if (phase === 'layerA' || phase === 'both') layers.push(['A', state.beatTimesA, state.hitResultsA]);
  if (phase === 'layerB' || phase === 'both') layers.push(['B', state.beatTimesB, state.hitResultsB]);

  let hits = 0, total = 0;
  for (const [, beats, results] of layers) {
    for (let i = 0; i < beats.length; i++) {
      total += 1;
      const r = results.get(`${b}:${i}`);
      if (r === 'perfect' || r === 'good') hits += 1;
    }
  }
  state.windowHits  += hits;
  state.windowTotal += total;
  state.phaseTotals[phaseKey].hits  += hits;
  state.phaseTotals[phaseKey].total += total;
}

function evalPhaseWindow() {
  const acc = state.windowTotal > 0 ? state.windowHits / state.windowTotal : 0;
  const atGoal = state.currentBpm >= state.goalBpm;
  let newBpm = null;
  let advanceNow = false;

  if (acc >= PHASE_PROMOTE_ACC && atGoal) {
    advanceNow = true;
  } else if (acc >= PHASE_PROMOTE_ACC && !atGoal) {
    newBpm = Math.min(state.goalBpm, state.currentBpm + state.bpmIncrement);
    showAdaptToast(`${state.currentBpm} → ${newBpm} bpm`);
    state.currentBpm = newBpm;
  } else if (acc < PHASE_DEMOTE_ACC && state.currentBpm > state.startBpm) {
    newBpm = Math.max(state.startBpm, state.currentBpm - state.bpmIncrement);
    showAdaptToast(`Slowing down — ${newBpm} bpm`);
    state.currentBpm = newBpm;
  }

  state.barsInWindow = 0;
  state.windowHits = 0;
  state.windowTotal = 0;

  if (advanceNow) { advancePhase(); return; }
  if (newBpm != null) applyAudioConfig({ bpm: newBpm });
}

function recordPhaseResult(key) {
  const totals = state.phaseTotals[key];
  const accuracy = totals.total > 0 ? Math.round((totals.hits / totals.total) * 100) : 0;
  state.phaseResults[key] = {
    finalBpm: state.currentBpm,
    accuracy,
    reachedGoal: state.currentBpm >= state.goalBpm,
  };
}

function enterPhase(next) {
  state.phase = next;
  state.currentBpm = state.startBpm;
  state.barsInWindow = 0;
  state.windowHits = 0;
  state.windowTotal = 0;
  setActivePads(next);
  refreshPhaseMessage();
  updateSkipLink();
  applyAudioConfig({ bpm: state.startBpm });
}

function advancePhase() {
  if (state.phase === 'listen') {
    enterPhase('layerA');
  } else if (state.phase === 'layerA') {
    recordPhaseResult('layerA');
    enterPhase('layerB');
  } else if (state.phase === 'layerB') {
    recordPhaseResult('layerB');
    enterPhase('both');
  } else if (state.phase === 'both') {
    recordPhaseResult('both');
    state.phase = 'results';
    finishPractice();
  }
}

/* "Skip to Both →" — jumps to Phase 4 immediately, recording the skipped
   single-layer phases with sentinel values so the results screen can mark
   them as skipped rather than "0% fail". */
function skipToBoth() {
  if (state.mode !== 'practice' || !state.running) return;
  if (state.phase !== 'layerA' && state.phase !== 'layerB') return;
  if (!state.phaseResults.layerA) {
    state.phaseResults.layerA = { finalBpm: 'skipped', accuracy: 'skipped', reachedGoal: false };
  }
  if (!state.phaseResults.layerB) {
    state.phaseResults.layerB = { finalBpm: 'skipped', accuracy: 'skipped', reachedGoal: false };
  }
  enterPhase('both');
}

function refreshPhaseMessage() {
  if (state.mode !== 'practice' || !messageEl) return;
  const msg = PHASE_MESSAGES[state.phase] || '';
  messageEl.innerHTML = msg;
}

function updateSkipLink() {
  if (!skipBothEl) return;
  const show = state.mode === 'practice'
    && state.running
    && (state.phase === 'layerA' || state.phase === 'layerB');
  skipBothEl.hidden = !show;
}

/* ══════════════════════════════════════════════════════════
   ADAPTIVE ENGINE — three independent axes (Pattern B)
   ══════════════════════════════════════════════════════════ */
function currentGoodWindow() {
  return TOLERANCE_LEVELS[state.adaptive.toleranceIdx].goodMs;
}

function currentToleranceName() {
  return TOLERANCE_LEVELS[state.adaptive.toleranceIdx].name;
}

/* Compute per-layer accuracy (0..1) for a completed bar. 'perfect' and
   'good' count as hits; 'miss' and 'untapped' do not. */
function barAccuracy(bar) {
  let hitA = 0, totA = state.beatTimesA.length;
  let hitB = 0, totB = state.beatTimesB.length;
  for (let i = 0; i < totA; i++) {
    const r = state.hitResultsA.get(`${bar}:${i}`);
    if (r === 'perfect' || r === 'good') hitA += 1;
  }
  for (let i = 0; i < totB; i++) {
    const r = state.hitResultsB.get(`${bar}:${i}`);
    if (r === 'perfect' || r === 'good') hitB += 1;
  }
  return {
    a: totA ? hitA / totA : 0,
    b: totB ? hitB / totB : 0,
  };
}

/* Axis 1 — Tempo.
   +10 BPM after 3 consec bars with BOTH layers >80%.
   −10 BPM after 2 consec bars with EITHER layer <50%.
   Floor 50, Ceiling 200. */
function evalTempoAxis(acc) {
  const a = state.adaptive;
  if (acc.a > 0.8 && acc.b > 0.8) a.barsBothAbove80 += 1;
  else                             a.barsBothAbove80 = 0;

  if (acc.a < 0.5 || acc.b < 0.5) a.barsEitherBelow50 += 1;
  else                             a.barsEitherBelow50 = 0;

  if (a.barsBothAbove80 >= TEMPO_PROMOTE_BARS && state.bpm < BPM_CEILING) {
    a.barsBothAbove80 = 0;
    const next = Math.min(BPM_CEILING, state.bpm + 10);
    applyAudioConfig({ bpm: next });
    showAdaptToast(`Tempo up! ${next} BPM`);
    return;
  }
  if (a.barsEitherBelow50 >= TEMPO_DEMOTE_BARS && state.bpm > BPM_FLOOR) {
    a.barsEitherBelow50 = 0;
    const next = Math.max(BPM_FLOOR, state.bpm - 10);
    applyAudioConfig({ bpm: next });
    showAdaptToast(`Slowing down — ${next} BPM`);
  }
}

/* Axis 2 — Polyrhythm complexity.
   Switch to next in POLY_PROGRESSION after 16 consec bars at >80% on BOTH layers.
   Promotion-only (no demotion — session-fail handles runaway failure). */
function evalComplexityAxis(acc) {
  const a = state.adaptive;
  if (acc.a > 0.8 && acc.b > 0.8) a.barsComplexityAbove80 += 1;
  else                             a.barsComplexityAbove80 = 0;

  if (a.barsComplexityAbove80 >= COMPLEXITY_PROMOTE_BARS
      && a.polyIndex < POLY_PROGRESSION.length - 1) {
    a.barsComplexityAbove80 = 0;
    a.polyIndex += 1;
    const next = POLY_PROGRESSION[a.polyIndex];
    state.polyrhythmProgression.push(next);
    applyAudioConfig({ polyrhythm: next });
    showAdaptToast(`Level up! ${next}`);
  }
}

/* Axis 3 — Timing tolerance (Good window).
   Tighten after 8 consec bars >80% averaged accuracy.
   Promotion-only in Challenge Mode (±120ms → ±90ms → ±60ms). */
function evalToleranceAxis(acc) {
  const a = state.adaptive;
  const avg = (acc.a + acc.b) / 2;
  if (avg > 0.8) a.barsSustained80 += 1; else a.barsSustained80 = 0;

  if (a.barsSustained80 >= TOLERANCE_PROMOTE_BARS
      && a.toleranceIdx < TOLERANCE_LEVELS.length - 1) {
    a.barsSustained80 = 0;
    a.toleranceIdx += 1;
    showAdaptToast(`Tightening timing — ±${currentGoodWindow()}ms`);
  }
}

/* Session-fail — averaged accuracy <30% for 4 consecutive bars ends the run. */
function evalSessionFail(acc) {
  const a = state.adaptive;
  const avg = (acc.a + acc.b) / 2;
  if (avg < SESSION_FAIL_THRESHOLD) a.barsFailing += 1;
  else                              a.barsFailing = 0;
  return a.barsFailing >= SESSION_FAIL_BARS;
}

/* Apply a polyrhythm or BPM change mid-session. Reschedules the audio
   cleanly from the next lookahead moment; bar indices reset so in-flight
   per-beat hit bookkeeping is cleared. Session-wide counters (scoring,
   best streak, logs) are preserved. */
function applyAudioConfig({ polyrhythm, bpm }) {
  if (!state.running) return;
  if (polyrhythm !== undefined) {
    state.polyrhythm = polyrhythm;
    if (polyEl) polyEl.value = polyrhythm;
  }
  if (bpm !== undefined) {
    state.bpm = bpm;
    if (bpmEl) bpmEl.value = String(bpm);
    if (bpmValueEl) bpmValueEl.textContent = String(bpm);
  }
  updateConfig();

  // Kill any pending scheduler tick, re-base timing to a fresh bar 0.
  if (state.schedulerTimer) { clearTimeout(state.schedulerTimer); state.schedulerTimer = null; }
  const ac = state.audioCtx;
  if (!ac) return;
  // Swap in a fresh gain chain — the old one is cut to 0, silencing any
  // oscillators already scheduled into the lookahead window.
  setupGainChain();
  state.playStartTime = ac.currentTime + 0.12;
  state.nextBarContextTime = state.playStartTime;
  state.hitResultsA.clear();
  state.hitResultsB.clear();
  state.missedMarkedBar = -1;
  schedulerTick();
}

let adaptToastTimer = null;
function showAdaptToast(msg) {
  if (!adaptToastEl) return;
  adaptToastEl.textContent = msg;
  adaptToastEl.hidden = false;
  adaptToastEl.classList.add('pr-adapt-toast--show');
  if (adaptToastTimer) clearTimeout(adaptToastTimer);
  adaptToastTimer = setTimeout(() => {
    adaptToastEl.classList.remove('pr-adapt-toast--show');
    // Keep hidden attr until the CSS transition settles
    setTimeout(() => { if (adaptToastEl) adaptToastEl.hidden = true; }, 350);
  }, 1800);
}

function hideAdaptToast() {
  if (adaptToastTimer) { clearTimeout(adaptToastTimer); adaptToastTimer = null; }
  if (adaptToastEl) {
    adaptToastEl.classList.remove('pr-adapt-toast--show');
    adaptToastEl.hidden = true;
  }
}

/* ══════════════════════════════════════════════════════════
   SESSION / RESULTS
   ══════════════════════════════════════════════════════════ */
function checkSessionEnd() {
  // Practice ends via advancePhase → finishPractice; Challenge ends via
  // endSession() fired from sweepMisses() when evalSessionFail passes
  // (4 bars <30% averaged accuracy) or when the user clicks Stop. Either
  // way there's no timer/bar cap to poll from the render loop.
  return state.ended;
}

function computeResults() {
  const score = (state.perfectA + state.perfectB) * 300 +
                (state.goodA    + state.goodB)    * 100;
  return {
    bestStreak: state.bestStreak,
    score,
    finalPolyrhythm: state.polyrhythm,
    finalBpm: state.bpm,
    finalTolerance: currentGoodWindow(),
    toleranceName: currentToleranceName(),
    polyrhythmProgression: state.polyrhythmProgression.slice(),
    duration: Math.max(0, Math.round(getElapsed())),
    timestamp: new Date().toISOString(),
  };
}

function persistResult(results) {
  // ResultDetail — Challenge schema (see docs/polyrhythm-trainer-spec.md).
  const detail = {
    gameId: 'polyrhythm',
    timestamp: results.timestamp,
    mode: 'challenge',
    difficulty: {
      polyrhythm: results.finalPolyrhythm,
      bpm: results.finalBpm,
      tolerance: results.finalTolerance,
    },
    duration: results.duration,
    // Session that didn't fall off a cliff counts as "correct" for the
    // competency graph — any progression past the starting polyrhythm or a
    // non-trivial score clears the bar.
    correct: results.score >= 2000 || results.polyrhythmProgression.length > 1,
    detail: {
      finalPolyrhythm: results.finalPolyrhythm,
      finalBpm: results.finalBpm,
      finalTolerance: results.finalTolerance,
      score: results.score,
      streak: results.bestStreak,
      polyrhythmProgression: results.polyrhythmProgression.slice(),
    },
  };
  try {
    const existing = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || '[]');
    existing.push(detail);
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('[polyrhythm] Failed to save result:', err);
  }
  return detail;
}

/* ──────────── Challenge-mode leaderboard (localStorage, top 5) ───────── */
function loadLeaderboard() {
  try {
    const list = JSON.parse(localStorage.getItem(CHALLENGE_LEADERBOARD_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/* Insert the fresh result, re-sort descending by score, keep the top
   LEADERBOARD_SIZE. Returns the final list plus the rank (0-indexed) of
   the current entry — -1 if it didn't make the cut. */
function updateLeaderboard(results) {
  const entry = {
    score: results.score,
    polyrhythm: results.finalPolyrhythm,
    bpm: results.finalBpm,
    tolerance: results.finalTolerance,
    streak: results.bestStreak,
    timestamp: results.timestamp,
  };
  const list = loadLeaderboard();
  list.push(entry);
  list.sort((a, b) => (b.score || 0) - (a.score || 0));
  const trimmed = list.slice(0, LEADERBOARD_SIZE);
  try {
    localStorage.setItem(CHALLENGE_LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[polyrhythm] Failed to save leaderboard:', err);
  }
  const rank = trimmed.indexOf(entry);
  return { list: trimmed, rank, entry };
}

function renderSongConnection(polyrhythm) {
  if (!resultSongCard) return;
  const mapping = POLY_SONG_MAP[polyrhythm];
  if (!mapping) { resultSongCard.hidden = true; return; }
  const entry = SONG_EXAMPLES.find(e => e.id === mapping.songId);
  if (!entry) { resultSongCard.hidden = true; return; }

  if (resultSongTitle)  resultSongTitle.textContent  = entry.song || '';
  if (resultSongArtist) resultSongArtist.textContent = entry.artist || '';
  if (resultSongInsight) {
    const insight = (entry.insight && entry.insight.musician) || '';
    resultSongInsight.textContent = insight;
  }
  if (resultSongLink) {
    if (mapping.walkthroughId) {
      resultSongLink.href = `/explorer?walkthrough=${encodeURIComponent(mapping.walkthroughId)}`;
      resultSongLink.hidden = false;
    } else {
      resultSongLink.hidden = true;
      resultSongLink.removeAttribute('href');
    }
  }
  resultSongCard.hidden = false;
}

function endSession() {
  if (state.ended) return;
  state.ended = true;
  hideAdaptToast();

  // Stop audio + RAF but keep state intact for the results screen
  state.running = false;
  if (state.schedulerTimer) { clearTimeout(state.schedulerTimer); state.schedulerTimer = null; }
  if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
  teardownGainChain();

  const results = computeResults();
  persistResult(results);
  showResults(results);

  startBtn.textContent = 'Start';
  startBtn.classList.remove('stopping');
}

function showResults(results) {
  if (!resultsEl) return;
  // Challenge results grid on, practice results off
  if (challengeResultsEl) challengeResultsEl.hidden = false;
  if (practiceResultsEl)  practiceResultsEl.hidden  = true;
  if (challengeActionsEl) challengeActionsEl.hidden = false;
  if (practiceActionsEl)  practiceActionsEl.hidden  = true;

  if (resultStreakEl)    resultStreakEl.textContent    = String(results.bestStreak);
  if (resultScoreEl)     resultScoreEl.textContent     = results.score.toLocaleString();
  if (resultPolyEl)      resultPolyEl.textContent      = results.finalPolyrhythm;
  if (resultBpmEl)       resultBpmEl.textContent       = `${results.finalBpm} BPM`;
  if (resultToleranceEl) resultToleranceEl.textContent = `±${results.finalTolerance}ms`;

  renderChallengeProgression(results.polyrhythmProgression);
  renderLeaderboard(results);
  renderSongConnection(results.finalPolyrhythm);
  resultsEl.hidden = false;
  resultsEl.classList.add('pr-results--show');
}

/* Render the chain of polyrhythms the player walked through this session
   (starting pick → each promotion). Hidden if the session never promoted
   past the starting polyrhythm. */
function renderChallengeProgression(progression) {
  const wrap = document.getElementById('pr-result-progression');
  const path = document.getElementById('pr-result-progression-path');
  if (!wrap || !path) return;
  if (!Array.isArray(progression) || progression.length <= 1) {
    wrap.hidden = true;
    return;
  }
  // Tokens separated by arrows — "2:3 → 3:2 → 3:4"
  path.innerHTML = progression
    .map((p) => `<span class="pr-progression__step">${p}</span>`)
    .join('<span class="pr-progression__sep">→</span>');
  wrap.hidden = false;
}

/* Render the Challenge leaderboard if the current result made the top N.
   Reveals the fresh entry with a highlight row; hidden otherwise. */
function renderLeaderboard(results) {
  const wrap = document.getElementById('pr-result-leaderboard');
  const list = document.getElementById('pr-result-leaderboard-list');
  if (!wrap || !list) return;
  const { list: board, rank } = updateLeaderboard(results);
  if (rank < 0) {
    wrap.hidden = true;
    return;
  }
  list.innerHTML = board.map((entry, i) => {
    const score = (entry.score || 0).toLocaleString();
    const cls = i === rank ? 'pr-leaderboard__row pr-leaderboard__row--current' : 'pr-leaderboard__row';
    return `<li class="${cls}">`
      + `<span class="pr-leaderboard__rank">${i + 1}</span>`
      + `<span class="pr-leaderboard__score">${score}</span>`
      + `<span class="pr-leaderboard__meta">${entry.polyrhythm} · ${entry.bpm} BPM · ±${entry.tolerance}ms</span>`
      + `</li>`;
  }).join('');
  wrap.hidden = false;
}

function hideResults() {
  if (!resultsEl) return;
  resultsEl.classList.remove('pr-results--show');
  resultsEl.hidden = true;
}

/* ──────────── Practice-mode finish + results ──────────── */
function finishPractice() {
  if (state.ended) return;
  state.ended = true;
  hideAdaptToast();
  state.running = false;
  if (state.schedulerTimer) { clearTimeout(state.schedulerTimer); state.schedulerTimer = null; }
  if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
  teardownGainChain();
  updateSkipLink();

  persistPracticeResult();
  showPracticeResults();

  startBtn.textContent = 'Start';
  startBtn.classList.remove('stopping');
}

function persistPracticeResult() {
  const durationS = Math.max(0, Math.round((Date.now() - state.practiceStartMs) / 1000));
  const both = state.phaseResults.both;
  const detail = {
    gameId: 'polyrhythm',
    timestamp: new Date().toISOString(),
    mode: 'practice',
    difficulty: {
      polyrhythm: state.polyrhythm,
      goalBpm: state.goalBpm,
      startBpm: state.startBpm,
      increment: state.bpmIncrement,
    },
    duration: durationS,
    correct: both && both.reachedGoal === true,
    detail: {
      polyrhythm: state.polyrhythm,
      phases: state.phaseResults,
      perTap: { layer1: state.logA.slice(), layer2: state.logB.slice() },
      streak: state.bestStreak,
    },
  };
  try {
    const existing = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || '[]');
    existing.push(detail);
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('[polyrhythm] Failed to save practice result:', err);
  }
}

function formatPhaseCell(result) {
  // sentinel 'skipped' from skip-to-both
  if (!result || result.accuracy === 'skipped') {
    return { bpm: 'skipped', acc: '—', mark: '→', markClass: 'pr-mark--skipped' };
  }
  return {
    bpm: `${result.finalBpm} bpm`,
    acc: `${result.accuracy}%`,
    mark: result.reachedGoal ? '✓' : '✗',
    markClass: result.reachedGoal ? 'pr-mark--pass' : 'pr-mark--fail',
  };
}

function showPracticeResults() {
  if (!resultsEl) return;
  if (challengeResultsEl) challengeResultsEl.hidden = true;
  if (practiceResultsEl)  practiceResultsEl.hidden  = false;
  if (challengeActionsEl) challengeActionsEl.hidden = true;
  if (practiceActionsEl)  practiceActionsEl.hidden  = false;

  for (const key of ['layerA', 'layerB', 'both']) {
    const cells = phaseRowEls[key];
    if (!cells || !cells.bpm) continue;
    const fmt = formatPhaseCell(state.phaseResults[key]);
    cells.bpm.textContent = fmt.bpm;
    cells.acc.textContent = fmt.acc;
    cells.mark.textContent = fmt.mark;
    cells.mark.className = `pr-phase-mark ${fmt.markClass}`;
  }

  if (practiceTimeEl) {
    const secs = Math.max(0, Math.round((Date.now() - state.practiceStartMs) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    practiceTimeEl.textContent = `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  // "Try again at {both.finalBpm}" — relabel the retry button per stall point
  if (practiceRetryBtn) {
    const both = state.phaseResults.both;
    if (both && typeof both.finalBpm === 'number') {
      practiceRetryBtn.textContent = `Try again at ${both.finalBpm}`;
      practiceRetryBtn.dataset.retryBpm = String(both.finalBpm);
    } else {
      practiceRetryBtn.textContent = 'Try again';
      delete practiceRetryBtn.dataset.retryBpm;
    }
  }

  renderSongConnection(state.polyrhythm);
  resultsEl.hidden = false;
  resultsEl.classList.add('pr-results--show');
}

/* ══════════════════════════════════════════════════════════
   CANVAS RENDERER
   ══════════════════════════════════════════════════════════ */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function laneEnvelopeAt(y, beats, nBeats, elapsed, pxPerSec) {
  const remaining = (HIT_Y - y) / pxPerSec;   // seconds until this y-row reaches hit zone
  const timeAtY = elapsed + remaining;
  const phase = ((timeAtY % state.barDuration) + state.barDuration) % state.barDuration;
  const denom = state.barDuration / nBeats;    // beat spacing
  let env = 0;
  for (const bt of beats) {
    let d = Math.abs(phase - bt);
    d = Math.min(d, state.barDuration - d);
    env += Math.exp(-8 * d * d / denom);
  }
  return Math.min(1, env);
}

function render() {
  if (!state.running) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const elapsed = getElapsed();
  const pxPerSec = HIT_Y / (state.barDuration * 0.8);

  // --- Clear ---
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  // --- Scrolling horizontal grid ---
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridStep = 24;
  const gridOffset = (elapsed * pxPerSec) % gridStep;
  for (let y = -gridStep + gridOffset; y < h; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  // Center vertical divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.moveTo(w / 2 + 0.5, 0);
  ctx.lineTo(w / 2 + 0.5, h);
  ctx.stroke();
  ctx.restore();

  // --- Lane x positions ---
  const laneXA = w * LANE_X_A_FRAC;
  const laneXB = w * LANE_X_B_FRAC;

  // --- Background lane breathing + interference ---
  drawLaneBreathing(laneXA, state.beatTimesA, state.nA, elapsed, pxPerSec, LANE_COLOR_A_RGB, h);
  drawLaneBreathing(laneXB, state.beatTimesB, state.nB, elapsed, pxPerSec, LANE_COLOR_B_RGB, h);
  drawInterferenceWave(laneXA, laneXB, elapsed, pxPerSec, h);

  // --- Convergence lines (dashed, where beats align) ---
  drawConvergenceLines(laneXA, laneXB, elapsed, pxPerSec);

  // --- Falling notes ---
  drawFallingNotes('A', laneXA, state.beatTimesA, state.hitResultsA, elapsed, pxPerSec, h);
  drawFallingNotes('B', laneXB, state.beatTimesB, state.hitResultsB, elapsed, pxPerSec, h);

  // --- Hit zone band ---
  drawHitZone(w, laneXA, laneXB);

  // --- Radial blooms + expanding rings ---
  drawBlooms();
  drawRings();

  // --- Receptor rings ---
  drawReceptor(laneXA, LANE_COLOR_A, state.tapFlashA);
  drawReceptor(laneXB, LANE_COLOR_B, state.tapFlashB);
  state.tapFlashA = Math.max(0, state.tapFlashA - 0.04);
  state.tapFlashB = Math.max(0, state.tapFlashB - 0.04);

  // --- Particles ---
  drawParticles();

  // --- Combo text ---
  drawCombos();

  // --- Streak glow ---
  if (state.streak >= 5) {
    const pulse = 0.08 + 0.04 * Math.sin(performance.now() / 1000 * 4 * Math.PI * 2);
    ctx.fillStyle = `rgba(127, 119, 221, ${pulse * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  // --- Mode-specific HUD additions ---
  if (state.mode === 'practice') {
    drawPhaseIndicator(w);
    drawBpmProgress(w);
  } else {
    drawChallengeIndicator(w);
  }

  sweepMisses();
  if (checkSessionEnd()) return;
  state.rafId = requestAnimationFrame(render);
}

/* Challenge-mode indicator — "CHALLENGE" label + live adaptive readout
   (current polyrhythm · BPM · tolerance). Rendered below the HTML HUD so
   it doesn't collide with the Streak column. */
function drawChallengeIndicator(w) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 10px Nunito, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(127, 119, 221, 0.9)';
  ctx.fillText('CHALLENGE', w / 2, 58);

  ctx.font = '600 11px Nunito, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  const line = `${state.polyrhythm} · ${state.bpm} BPM · ±${currentGoodWindow()}ms`;
  ctx.fillText(line, w / 2, 74);
  ctx.restore();
}

/* Phase step indicator — Listen → Layer A → Layer B → Both → ✓ */
function drawPhaseIndicator(w) {
  const y = 15;
  const steps = PHASES_ORDER;
  const gap = 82;
  const totalW = gap * (steps.length - 1);
  const startX = w / 2 - totalW / 2;
  const isDone = state.phase === 'results';
  const curIdx = isDone ? steps.length : steps.indexOf(state.phase);

  ctx.save();
  ctx.font = '500 11px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < steps.length - 1; i++) {
    const x1 = startX + i * gap + 6;
    const x2 = startX + (i + 1) * gap - 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  }

  for (let i = 0; i < steps.length; i++) {
    const x = startX + i * gap;
    const ph = steps[i];
    const active = i === curIdx;
    const completed = i < curIdx;
    let dotRgb = '255, 255, 255';
    let dotAlpha = 0.28;
    if (active) { dotAlpha = 1.0; }
    else if (completed) {
      if (ph === 'layerA') dotRgb = LANE_COLOR_A_RGB;
      else if (ph === 'layerB') dotRgb = LANE_COLOR_B_RGB;
      dotAlpha = 0.85;
    }
    ctx.fillStyle = `rgba(${dotRgb}, ${dotAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, active ? 4.2 : 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = active
      ? 'rgba(255, 255, 255, 0.95)'
      : completed ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(PHASE_LABELS[ph], x, y - 11);
  }

  // Trailing ✓ after Both completes
  const xTail = startX + (steps.length - 1) * gap + 24;
  if (isDone) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('✓', xTail, y);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillText('✓', xTail, y);
  }
  ctx.restore();
}

/* Current BPM → Goal BPM progress bar below the phase indicator. */
function drawBpmProgress(w) {
  const y = 32;
  const barW = 170;
  const centerX = w / 2;
  const x0 = centerX - barW / 2;
  const x1 = centerX + barW / 2;

  const span = Math.max(1, state.goalBpm - state.startBpm);
  const t = Math.max(0, Math.min(1, (state.currentBpm - state.startBpm) / span));

  ctx.save();
  ctx.font = '600 11px Nunito, system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // left label: current
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e0ddd4';
  ctx.fillText(String(state.currentBpm), x0 - 8, y);

  // right label: goal
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillText(`${state.goalBpm} bpm`, x1 + 8, y);

  // track
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y); ctx.lineTo(x1, y);
  ctx.stroke();

  // progress
  ctx.strokeStyle = `rgba(${LANE_COLOR_A_RGB}, 0.85)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y); ctx.lineTo(x0 + barW * t, y);
  ctx.stroke();

  // knob
  ctx.fillStyle = '#e0ddd4';
  ctx.beginPath();
  ctx.arc(x0 + barW * t, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ─── Background waves ──────────────────────────────────── */
function drawLaneBreathing(laneX, beats, nBeats, elapsed, pxPerSec, rgb, h) {
  const step = 4;
  // Build left/right edges for the full canvas height — the wave shape
  // continues past HIT_Y as atmospheric decoration below the hit zone.
  const points = [];
  for (let y = 0; y <= h; y += step) {
    const env = laneEnvelopeAt(y, beats, nBeats, elapsed, pxPerSec);
    const width = BASE_LANE_W + env * LANE_EXPAND * 2;
    points.push({ y, left: laneX - width / 2, right: laneX + width / 2, env });
  }

  // Gradient peaks at HIT_Y and fades at both ends.
  const hitStop = Math.max(0, Math.min(1, HIT_Y / h));

  // --- Fill ---
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,       `rgba(${rgb}, 0.01)`);
  grad.addColorStop(hitStop, `rgba(${rgb}, 0.10)`);
  grad.addColorStop(1,       `rgba(${rgb}, 0.02)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].left, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].left, points[i].y);
  for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].right, points[i].y);
  ctx.closePath();
  ctx.fill();

  // --- Stroke edges ---
  const gradS = ctx.createLinearGradient(0, 0, 0, h);
  gradS.addColorStop(0,       `rgba(${rgb}, 0.02)`);
  gradS.addColorStop(hitStop, `rgba(${rgb}, 0.18)`);
  gradS.addColorStop(1,       `rgba(${rgb}, 0.04)`);
  ctx.strokeStyle = gradS;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(points[0].left, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].left, points[i].y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(points[0].right, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].right, points[i].y);
  ctx.stroke();
}

function drawInterferenceWave(laneXA, laneXB, elapsed, pxPerSec, h) {
  const step = 5;
  const centerX = (laneXA + laneXB) / 2;
  const maxAmp = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  const leftPts = [];
  const rightPts = [];
  for (let y = 0; y <= h; y += step) {
    const envA = laneEnvelopeAt(y, state.beatTimesA, state.nA, elapsed, pxPerSec);
    const envB = laneEnvelopeAt(y, state.beatTimesB, state.nB, elapsed, pxPerSec);
    const avg = (envA + envB) / 2;
    const halfW = avg * maxAmp;
    leftPts.push({ x: centerX - halfW, y });
    rightPts.push({ x: centerX + halfW, y });
  }
  ctx.moveTo(leftPts[0].x, leftPts[0].y);
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
  for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ─── Convergence lines ──────────────────────────────────── */
function drawConvergenceLines(laneXA, laneXB, elapsed, pxPerSec) {
  // Find beats in A and B that coincide within 5ms, across visible bar range
  const travel = state.barDuration * 0.8;
  const bar = Math.floor(elapsed / state.barDuration);
  for (let b = bar - 1; b <= bar + 2; b++) {
    const barStart = b * state.barDuration;
    for (const ta of state.beatTimesA) {
      const absA = barStart + ta;
      for (const tb of state.beatTimesB) {
        const absB = barStart + tb;
        if (Math.abs(absA - absB) > 0.005) continue;
        const remaining = absA - elapsed;
        if (remaining < -0.1 || remaining > travel) continue;
        const y = HIT_Y - (remaining / travel) * HIT_Y;
        const progress = Math.max(0, Math.min(1, y / HIT_Y));
        const alpha = 0.05 + progress * 0.2;
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(laneXA + 18, y);
        ctx.lineTo(laneXB - 18, y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

/* ─── Falling notes ─────────────────────────────────────── */
function drawFallingNotes(layer, laneX, beats, results, elapsed, pxPerSec, h) {
  const travel = state.barDuration * 0.8;
  // Missed notes keep falling past HIT_Y to the canvas bottom, fading out.
  const postHitSpan = Math.max(1, h - HIT_Y);
  const postHitTime = postHitSpan / pxPerSec;
  const bar = Math.floor(elapsed / state.barDuration);
  const color = NOTE_COLORS[layer];
  const rgb = NOTE_COLORS_RGB[layer];

  for (let b = bar - 1; b <= bar + 2; b++) {
    const barStart = b * state.barDuration;
    for (let i = 0; i < beats.length; i++) {
      const abs = barStart + beats[i];
      const remaining = abs - elapsed;
      if (remaining < -postHitTime || remaining > travel) continue;

      const key = `${b}:${i}`;
      const res = results.get(key);
      if (res === 'perfect' || res === 'good') continue; // popped

      const y = HIT_Y - (remaining / travel) * HIT_Y;
      if (y > h) continue;
      const preHit = Math.min(1, y / HIT_Y);
      const postHitFade = y > HIT_Y ? Math.max(0, 1 - (y - HIT_Y) / postHitSpan) : 1;
      const alpha = (0.08 + preHit * 0.92) * postHitFade;
      const radius = 4 + preHit * 8;
      const strokeWidth = 1 + preHit * 1.5;

      // Trail
      ctx.save();
      ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.08})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(laneX, Math.max(0, y - 45));
      ctx.lineTo(laneX, y);
      ctx.stroke();
      ctx.restore();

      // Outer ring
      ctx.save();
      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(laneX, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Fill
      ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.22})`;
      ctx.beginPath();
      ctx.arc(laneX, y, radius - strokeWidth * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(laneX, y, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Pulse halo only for notes still approaching the hit zone
      if (y < HIT_Y) {
        const proximity = (HIT_Y - y) / HIT_Y;
        if (proximity < 0.12) {
          const t = performance.now() / 1000;
          const pulseR = radius + 6 + 4 * Math.sin(t * 14 * Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb}, ${0.45 * (1 - proximity / 0.12)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(laneX, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Miss marker: after 'untapped' sweep, show a faint red X at hit zone briefly
      if (res === 'miss' || res === 'untapped') {
        // note was tapped late/missed — just faintly draw the ghost
        ctx.globalAlpha = 0.3;
      }
      ctx.restore();
    }
  }
}

/* ─── Hit zone ──────────────────────────────────────────── */
function drawHitZone(w, laneXA, laneXB) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, HIT_Y - 30, 0, HIT_Y + 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, HIT_Y - 30, w, 60);
  ctx.restore();
}

function drawReceptor(x, color, flash) {
  ctx.save();
  const baseAlpha = 0.22 + flash * 0.6;
  ctx.strokeStyle = color;
  ctx.globalAlpha = baseAlpha;
  ctx.lineWidth = 2 + flash * 1.4;
  ctx.beginPath();
  ctx.arc(x, HIT_Y, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Inner fade
  ctx.globalAlpha = 0.08 + flash * 0.15;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, HIT_Y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ─── Blooms / rings / particles / combos ───────────────── */
function drawBlooms() {
  for (let i = state.blooms.length - 1; i >= 0; i--) {
    const b = state.blooms[i];
    const radius = 80 * (1 - b.life) + 20;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
    g.addColorStop(0, `rgba(${b.rgb}, ${0.45 * b.life})`);
    g.addColorStop(1, `rgba(${b.rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
    ctx.fill();
    b.life -= 0.08;
    if (b.life <= 0) state.blooms.splice(i, 1);
  }
}

function drawRings() {
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    const radius = 18 + (1 - r.life) * 32;
    ctx.strokeStyle = `rgba(${r.rgb}, ${0.55 * r.life})`;
    ctx.lineWidth = 2 * r.life + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    r.life -= 0.05;
    if (r.life <= 0) state.rings.splice(i, 1);
  }
}

function drawParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.022;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(${p.rgb}, ${p.life * 0.7})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCombos() {
  ctx.save();
  ctx.font = '600 13px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = state.combos.length - 1; i >= 0; i--) {
    const c = state.combos[i];
    ctx.globalAlpha = c.life;
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, c.x, c.y);
    c.y -= 1.2;
    c.life -= 0.025;
    if (c.life <= 0) state.combos.splice(i, 1);
  }
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   HUD
   ══════════════════════════════════════════════════════════ */
function updateHud() {
  const accA = state.totalTapsA ? Math.round((state.goodTapsA / state.totalTapsA) * 100) : null;
  const accB = state.totalTapsB ? Math.round((state.goodTapsB / state.totalTapsB) * 100) : null;
  accAEl.textContent = accA == null ? '—' : `${accA}%`;
  accBEl.textContent = accB == null ? '—' : `${accB}%`;
  streakEl.textContent = state.streak;
}

function resetScoring() {
  state.totalTapsA = 0;
  state.goodTapsA = 0;
  state.totalTapsB = 0;
  state.goodTapsB = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.perfectA = 0; state.goodA = 0; state.missA = 0;
  state.perfectB = 0; state.goodB = 0; state.missB = 0;
  state.logA.length = 0;
  state.logB.length = 0;
  state.totalBarsPlayed = 0;
  state.ended = false;
  state.hitResultsA.clear();
  state.hitResultsB.clear();
  state.missedMarkedBar = -1;
  state.particles.length = 0;
  state.blooms.length = 0;
  state.rings.length = 0;
  state.combos.length = 0;

  // Reset adaptive counters (keep polyIndex + toleranceIdx — those are the
  // "current level" the player has earned; scoring counters reset each
  // session but level persists unless the user quits back to setup).
  const a = state.adaptive;
  a.barsBothAbove80 = 0;
  a.barsEitherBelow50 = 0;
  a.barsComplexityAbove80 = 0;
  a.barsSustained80 = 0;
  a.barsFailing = 0;

  // Challenge progression history: seed with the starting polyrhythm so
  // the results screen can always show at least one entry.
  state.polyrhythmProgression = [state.polyrhythm];

  updateHud();
}

/* Sync adaptive polyIndex when the user picks a polyrhythm from the dropdown
   or when the session starts — so promotion/demotion walks from where they are. */
function syncPolyIndex() {
  const idx = POLY_PROGRESSION.indexOf(state.polyrhythm);
  state.adaptive.polyIndex = idx >= 0 ? idx : 1;  // default to 3:2
}

/* ══════════════════════════════════════════════════════════
   INPUT PROVIDER + ONSET WIRING
   ══════════════════════════════════════════════════════════ */

/**
 * Lazily create a Tone.Analyser. Tone.js (loaded via CDN) is required.
 * Returns null if Tone is missing — onset detection silently no-ops in that case.
 */
function ensureAnalyser() {
  if (state.analyser) return state.analyser;
  if (typeof Tone === 'undefined') {
    console.warn('[polyrhythm] Tone.js not loaded — onset detection disabled');
    return null;
  }
  state.analyser = new Tone.Analyser('fft', 2048);
  return state.analyser;
}

/**
 * Open the mic and route it into the shared analyser via Tone.UserMedia.
 * Must be called from a user gesture (browser permission prompt).
 * Idempotent — repeated calls return the same pending/resolved promise.
 */
function wireMicToAnalyser() {
  if (state.micWiringPromise) return state.micWiringPromise;
  const analyser = ensureAnalyser();
  if (!analyser || typeof Tone === 'undefined' || !Tone.UserMedia) {
    return Promise.resolve(false);
  }
  state.micWiringPromise = (async () => {
    try {
      await Tone.start();
      const mic = new Tone.UserMedia();
      await mic.open();
      mic.connect(analyser);
      state.mic = mic;
      return true;
    } catch (err) {
      console.warn('[polyrhythm] mic open failed:', err);
      state.micWiringPromise = null; // allow retry after permission flow
      return false;
    }
  })();
  return state.micWiringPromise;
}

function challengeMessage() {
  let msg = CHALLENGE_COPY;
  const modality = state.provider ? state.provider.getActiveModality() : 'click';
  if (modality === 'mic_onset') {
    msg += ` <strong>Mic supports one layer — taps route to Layer ${state.onsetLayer}. Use F/J or pads for both.</strong>`;
  }
  return msg;
}

function refreshChallengeMessage() {
  messageEl.innerHTML = challengeMessage();
}

function handleProviderOnset(_event) {
  if (!state.running) return;
  // Single mic stream can only route to one layer; in Challenge's two-layer
  // mode this means mic-onset drives whichever layer `onsetLayer` points at
  // (default 'A'). Players who need two-handed input must use pads/keys.
  handleTap(state.onsetLayer);
  playClickNow(state.onsetLayer);
}

function initInputProvider() {
  const containerEl = document.getElementById('pr-input-picker');
  if (!containerEl) return;

  // Create analyser eagerly so onset detection has an FFT source ready.
  // Construction is gesture-safe; only mic stream open requires a user gesture.
  const analyser = ensureAnalyser();

  state.provider = createInputProvider({
    gameId: 'polyrhythm-trainer',
    supported: {
      click: true,
      midi: true,
      onset: { mic: true, interface: true },
    },
    containerEl,
    analyser,
  });

  state.provider.on('onset', handleProviderOnset);

  // When the user clicks the mic_onset pill (a user gesture), open the mic.
  // The provider creates an onset detector reading from `analyser`; once the
  // mic stream is connected, flux starts flowing and onsets fire.
  // Capture phase ensures we run alongside the provider's bubble-phase handler.
  containerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modality="mic_onset"]');
    if (!btn || btn.disabled) return;
    wireMicToAnalyser();
    // Refresh the status message so challenge mode surfaces the mic-only-one-layer hint.
    setTimeout(() => {
      if (state.mode === 'challenge') refreshChallengeMessage();
    }, 0);
  }, true);
}

/* ══════════════════════════════════════════════════════════
   START / STOP
   ══════════════════════════════════════════════════════════ */
function start() {
  if (state.running) return;
  ensureAudioCtx();
  if (state.mode === 'practice') {
    initPracticeSession();
  }
  updateConfig();
  resetScoring();
  syncPolyIndex();
  hideResults();
  resizeCanvas();

  state.running = true;
  setupGainChain();
  // Delay first bar start slightly so scheduler has lead time
  state.playStartTime = state.audioCtx.currentTime + 0.12;
  state.nextBarContextTime = state.playStartTime;

  schedulerTick();
  state.rafId = requestAnimationFrame(render);

  startBtn.textContent = 'Stop';
  startBtn.classList.add('stopping');

  if (state.mode === 'practice') {
    setActivePads('listen');
    refreshPhaseMessage();
    updateSkipLink();
  } else {
    setActivePads('both');
    updateSkipLink();
    refreshChallengeMessage();
  }
}

function stop() {
  if (!state.running) return;
  state.running = false;
  if (state.schedulerTimer) clearTimeout(state.schedulerTimer);
  state.schedulerTimer = null;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  // Cut the master gain to silence any oscillators still queued in the
  // scheduler's lookahead window, then drop the chain.
  teardownGainChain();
  hideAdaptToast();
  updateSkipLink();
  // Un-dim pads so the setup screen looks correct again.
  if (padAEl) padAEl.classList.remove('dimmed');
  if (padBEl) padBEl.classList.remove('dimmed');

  // Clear canvas
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  startBtn.textContent = 'Start';
  startBtn.classList.remove('stopping');
  messageEl.textContent = 'Stopped. Press Start to try again.';
}

function restart() {
  if (!state.running) return;
  stop();
  start();
}

/* ══════════════════════════════════════════════════════════
   EVENT WIRING
   ══════════════════════════════════════════════════════════ */
polyEl.addEventListener('change', () => {
  state.polyrhythm = polyEl.value;
  syncPolyIndex();
  if (state.running) restart(); else updateConfig();
});

/* Mode toggle — practice vs challenge. Toggling swaps which BPM controls
   are visible and what state.bpm reflects. Game flow logic unchanged for
   now (Prompt 2). */
function applyMode(mode) {
  state.mode = mode;
  modesEl.querySelectorAll('.pr-mode-pill').forEach(b => {
    b.classList.toggle('pr-mode-pill--on', b.dataset.mode === mode);
  });
  modeOnlyEls.forEach((el) => {
    if (el.classList.contains('pr-mode-only--practice')) el.hidden = (mode !== 'practice');
    else if (el.classList.contains('pr-mode-only--challenge')) el.hidden = (mode !== 'challenge');
  });
  const pageEl = document.querySelector('.polyrhythm-page');
  if (pageEl) pageEl.dataset.mode = mode;
  if (mode === 'practice') {
    state.bpm = state.startBpm;
  } else {
    state.bpm = Number(bpmEl.value);
  }
  if (bpmValueEl) bpmValueEl.textContent = String(state.bpm);
  updateSkipLink();
  if (state.running) restart(); else updateConfig();
}

modesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.pr-mode-pill');
  if (!btn) return;
  applyMode(btn.dataset.mode);
});

/* Practice-mode presets — fill polyrhythm dropdown and goal BPM. */
presetsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.pr-preset');
  if (!btn) return;
  const poly = btn.dataset.poly;
  const goal = Number(btn.dataset.goal);

  polyEl.value = poly;
  state.polyrhythm = poly;
  syncPolyIndex();

  goalBpmEl.value = String(goal);
  state.goalBpm = goal;
  goalBpmValueEl.textContent = String(goal);

  // Keep start BPM ≤ goal BPM.
  startBpmEl.max = String(goal);
  if (Number(startBpmEl.value) > goal) {
    startBpmEl.value = String(goal);
    state.startBpm = goal;
    startBpmValueEl.textContent = String(goal);
  }
  if (state.mode === 'practice') {
    state.bpm = state.startBpm;
    if (bpmValueEl) bpmValueEl.textContent = String(state.bpm);
  }
  if (state.running) restart(); else updateConfig();
});

/* Goal BPM slider — clamps start BPM upward if it exceeds the new goal. */
goalBpmEl.addEventListener('input', () => {
  const val = Number(goalBpmEl.value);
  state.goalBpm = val;
  goalBpmValueEl.textContent = String(val);
  startBpmEl.max = String(val);
  if (Number(startBpmEl.value) > val) {
    startBpmEl.value = String(val);
    state.startBpm = val;
    startBpmValueEl.textContent = String(val);
    if (state.mode === 'practice') {
      state.bpm = val;
      if (bpmValueEl) bpmValueEl.textContent = String(val);
      if (state.running) restart();
    }
  }
});

/* Start BPM slider — capped at goal BPM. */
startBpmEl.addEventListener('input', () => {
  let val = Number(startBpmEl.value);
  if (val > state.goalBpm) {
    val = state.goalBpm;
    startBpmEl.value = String(val);
  }
  state.startBpm = val;
  startBpmValueEl.textContent = String(val);
  if (state.mode === 'practice') {
    state.bpm = val;
    if (bpmValueEl) bpmValueEl.textContent = String(val);
    if (state.running) restart();
  }
});

/* BPM increment pills — stored on state; applied by Prompt 2's ramp logic. */
incrementsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.pr-inc-pill');
  if (!btn) return;
  incrementsEl.querySelectorAll('.pr-inc-pill').forEach(b => b.classList.remove('pr-inc-pill--on'));
  btn.classList.add('pr-inc-pill--on');
  state.bpmIncrement = Number(btn.dataset.inc);
});

/* Challenge-mode single BPM slider. */
bpmEl.addEventListener('input', () => {
  state.bpm = Number(bpmEl.value);
  bpmValueEl.textContent = state.bpm;
  if (state.mode === 'challenge' && state.running) restart();
});

muteAEl.addEventListener('click', () => {
  state.muteA = !state.muteA;
  muteAEl.classList.toggle('off', state.muteA);
  if (state.gainA) state.gainA.gain.value = state.muteA ? 0 : 1;
});
muteBEl.addEventListener('click', () => {
  state.muteB = !state.muteB;
  muteBEl.classList.toggle('off', state.muteB);
  if (state.gainB) state.gainB.gain.value = state.muteB ? 0 : 1;
});

startBtn.addEventListener('click', () => {
  if (state.running) stop(); else start();
});

/* Results screen actions */
if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    hideResults();
    // "Play again" revives a Challenge session from the user's setup choices
    // (not the adaptive level they reached), since they just washed out —
    // it would be cruel to drop them back at the failing polyrhythm/BPM.
    state.polyrhythm = polyEl.value;
    state.bpm = state.mode === 'practice' ? state.startBpm : Number(bpmEl.value);
    if (bpmValueEl) bpmValueEl.textContent = String(state.bpm);
    state.adaptive.toleranceIdx = 0;
    syncPolyIndex();
    updateConfig();
    start();
  });
}

/* Practice results — "Try again at {both.finalBpm}" re-enters practice with
   startBpm bumped up to where the player stalled, so they skip the easy ramp. */
if (practiceRetryBtn) {
  practiceRetryBtn.addEventListener('click', () => {
    hideResults();
    const retryBpm = Number(practiceRetryBtn.dataset.retryBpm);
    if (Number.isFinite(retryBpm) && retryBpm > 0) {
      const clamped = Math.min(state.goalBpm, Math.max(40, retryBpm));
      state.startBpm = clamped;
      if (startBpmEl) startBpmEl.value = String(clamped);
      if (startBpmValueEl) startBpmValueEl.textContent = String(clamped);
    }
    start();
  });
}

/* "New goal" — close results, leave the user on the setup screen to change
   goal BPM / increment. Don't auto-restart. */
if (practiceNewGoalBtn) {
  practiceNewGoalBtn.addEventListener('click', () => {
    hideResults();
    if (goalBpmEl && typeof goalBpmEl.focus === 'function') goalBpmEl.focus();
    messageEl.textContent = 'Pick a new goal BPM, then press Start.';
  });
}

/* "New polyrhythm" — close results, focus the polyrhythm dropdown. */
if (practiceNewPolyBtn) {
  practiceNewPolyBtn.addEventListener('click', () => {
    hideResults();
    if (polyEl && typeof polyEl.focus === 'function') polyEl.focus();
    messageEl.textContent = 'Pick a new polyrhythm, then press Start.';
  });
}

/* Skip-to-Both link — jumps past the single-layer phases at startBpm,
   marking them as "skipped" in the results. Only meaningful during layerA
   or layerB; the button itself is hidden otherwise via updateSkipLink(). */
if (skipBothEl) {
  skipBothEl.addEventListener('click', () => {
    skipToBoth();
  });
}

/* Keyboard — F (Layer A), J (Layer B); ignore repeats */
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { handleTap('A'); playClickNow('A'); }
  else if (k === 'j') { handleTap('B'); playClickNow('B'); }
});

/* Drum pads — primary tap targets. */
padAEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap('A');
  playClickNow('A');
});
padBEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap('B');
  playClickNow('B');
});

/* Canvas pointer fallback — left half → A, right half → B. */
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const layer = x < rect.width / 2 ? 'A' : 'B';
  handleTap(layer);
  playClickNow(layer);
});

window.addEventListener('resize', () => {
  if (state.running) resizeCanvas();
});

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
(function init() {
  state.polyrhythm = polyEl.value;
  state.goalBpm = Number(goalBpmEl.value);
  state.startBpm = Number(startBpmEl.value);
  goalBpmValueEl.textContent = String(state.goalBpm);
  startBpmValueEl.textContent = String(state.startBpm);
  startBpmEl.max = String(state.goalBpm);
  const activeInc = incrementsEl.querySelector('.pr-inc-pill--on');
  if (activeInc) state.bpmIncrement = Number(activeInc.dataset.inc);

  // Set initial mode + BPM control visibility; applyMode() sets state.bpm accordingly.
  applyMode(state.mode);
  updateConfig();
  resizeCanvas();

  initInputProvider();
  if (state.mode === 'challenge') refreshChallengeMessage();

  // Paint an idle canvas
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  // faint receptor hint
  ctx.strokeStyle = 'rgba(127, 119, 221, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * LANE_X_A_FRAC, HIT_Y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(239, 159, 39, 0.22)';
  ctx.beginPath();
  ctx.arc(w * LANE_X_B_FRAC, HIT_Y, 18, 0, Math.PI * 2);
  ctx.stroke();
})();

window.addEventListener('beforeunload', () => {
  if (state.provider) {
    state.provider.destroy();
    state.provider = null;
  }
  if (state.mic) {
    try { state.mic.close(); } catch (e) { /* ok */ }
    state.mic = null;
  }
});
