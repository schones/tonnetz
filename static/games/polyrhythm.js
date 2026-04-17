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
const HIT_Y          = 370;          // y of hit zone in 420px canvas
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

/* ── Adaptive engine ─────────────────────────────────────── */
const POLY_PROGRESSION = ['2:3', '3:2', '3:4', '4:3', '5:4'];
const TOLERANCE_LEVELS = [
  { name: 'wide',   goodMs: 120 },
  { name: 'medium', goodMs: 90  },
  { name: 'tight',  goodMs: 60  },
];
const BPM_FLOOR   = 50;
const BPM_CEILING = 200;
const COMPLEXITY_PROMOTE_STREAK = 5;   // consec good-or-better on BOTH layers
const COMPLEXITY_DEMOTE_STREAK  = 5;   // consec miss on EITHER layer
const TEMPO_PROMOTE_BARS        = 3;   // bars with both layers >80%
const TEMPO_DEMOTE_BARS         = 2;   // bars with either layer <50%
const TOLERANCE_PROMOTE_BARS    = 8;
const TOLERANCE_DEMOTE_BARS     = 4;
const SESSION_DURATION_S        = 60;
const SESSION_MAX_BARS          = 16;
const RESULT_STORAGE_KEY        = 'songlab_results_polyrhythm';

/* ── Song connections ────────────────────────────────────── */
// Map polyrhythm ratio → song-examples.js entry + optional walkthroughs.js id
const POLY_SONG_MAP = {
  '3:2': { songId: 'triplet_swing_guaraldi', walkthroughId: null },
};

/* ── DOM ────────────────────────────────────────────────── */
const canvas       = document.getElementById('pr-canvas');
const ctx          = canvas.getContext('2d');
const polyEl       = document.getElementById('pr-polyrhythm');
const levelsEl     = document.getElementById('pr-levels');
const bpmEl        = document.getElementById('pr-bpm');
const bpmValueEl   = document.getElementById('pr-bpm-value');
const startBtn     = document.getElementById('pr-start');
const muteAEl      = document.getElementById('pr-mute-a');
const muteBEl      = document.getElementById('pr-mute-b');
const accAEl       = document.getElementById('pr-acc-a');
const accBEl       = document.getElementById('pr-acc-b');
const streakEl     = document.getElementById('pr-streak');
const messageEl    = document.getElementById('pr-message');

// Adaptive toast + results overlay (created/wired lazily in init)
const adaptToastEl = document.getElementById('pr-adapt-toast');
const resultsEl    = document.getElementById('pr-results');
const resultAccAEl = document.getElementById('pr-result-acc-a');
const resultAccBEl = document.getElementById('pr-result-acc-b');
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
const quitBtn    = document.getElementById('pr-quit');

/* ── State ──────────────────────────────────────────────── */
const state = {
  // config
  polyrhythm: '3:2',
  nA: 3,
  nB: 2,
  bpm: 80,
  barDuration: 3.0,    // (60/bpm) * 4
  beatTimesA: [],
  beatTimesB: [],
  level: 0,
  muteA: false,
  muteB: false,

  // runtime
  running: false,
  audioCtx: null,
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

  // Adaptive engine state
  adaptive: {
    polyIndex: 1,            // index into POLY_PROGRESSION — synced on start()
    toleranceIdx: 0,         // index into TOLERANCE_LEVELS — starts 'wide'

    // Axis 1 — complexity (consecutive tap ratings)
    consecGoodA: 0, consecGoodB: 0,
    consecMissA: 0, consecMissB: 0,

    // Axis 2 — tempo (consecutive bar accuracy)
    barsBothAbove80: 0,
    barsEitherBelow50: 0,

    // Axis 3 — tolerance (consecutive bar accuracy, both layers)
    barsSustained80: 0,
    barsSustained50Below: 0,
  },

  // input-provider integration
  provider: null,           // createInputProvider instance
  analyser: null,           // Tone.Analyser for onset detection
  mic: null,                // Tone.UserMedia bridging mic → analyser
  micWiringPromise: null,   // pending mic-open call (gated on user gesture)
  onsetLayer: 'A',          // which layer mic-onset taps drive (Level 1)
};

/* ── Level instructions ─────────────────────────────────── */
const LEVEL_COPY = [
  'Listen. Let the two rhythms sit in your ears — watch how they align and diverge.',
  'Feel it. Tap along with one layer (F for purple, J for gold). The other keeps playing.',
  'Split it. Tap both: F for purple, J for gold. Both layers keep ringing as a reference.',
];

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

function scheduleClick(layer, contextTime) {
  const ac = state.audioCtx;
  if (!ac) return;
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain).connect(ac.destination);

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
    // Schedule every beat in this bar
    if (!state.muteA) {
      for (const t of state.beatTimesA) scheduleClick('A', barStart + t);
    }
    if (!state.muteB) {
      for (const t of state.beatTimesB) scheduleClick('B', barStart + t);
    }
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
  if (state.level === 0) return; // Listen mode: no input
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

  // Axis 1 — Rhythmic complexity: track consecutive good-or-better / miss per layer
  const a = state.adaptive;
  if (layer === 'A') {
    if (rating === 'miss') { a.consecGoodA = 0; a.consecMissA += 1; }
    else                   { a.consecMissA = 0; a.consecGoodA += 1; }
  } else {
    if (rating === 'miss') { a.consecGoodB = 0; a.consecMissB += 1; }
    else                   { a.consecMissB = 0; a.consecGoodB += 1; }
  }
  evalComplexityAxis();

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
  state.combos.push({ x: laneX, y: HIT_Y - 22, text: comboText, color: comboColor, life: 1.0 });

  updateHud();
}

function spawnParticles(x, y, rgb, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 3.4;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      life: 0.95 + Math.random() * 0.15,
      rgb,
      size: 2 + Math.random() * 3,
    });
  }
}

/* Sweep past bars for missed beats (no tap logged), then evaluate per-bar
   accuracy for the tempo + tolerance adaptive axes. */
function sweepMisses() {
  if (state.level === 0) return;
  const { bar } = currentBarAndPhase();
  // Sweep any bar that's now fully past (bar-1) — beats in it can't still be tapped
  // because currentTime - beatAbsTime > the Good window.
  const sweepTargetBar = bar - 1;
  if (sweepTargetBar <= state.missedMarkedBar) return;
  for (let b = state.missedMarkedBar + 1; b <= sweepTargetBar; b++) {
    for (const [beats, results] of [
      [state.beatTimesA, state.hitResultsA],
      [state.beatTimesB, state.hitResultsB],
    ]) {
      for (let i = 0; i < beats.length; i++) {
        const key = `${b}:${i}`;
        if (!results.has(key)) {
          results.set(key, 'untapped');
          // Untapped beats don't count as taps in the HUD accuracy; they
          // only feed per-bar accuracy via barAccuracy().
        }
      }
    }
    // Per-bar evaluation for tempo + tolerance axes
    if (state.level > 0) {
      state.totalBarsPlayed += 1;
      const acc = barAccuracy(b);
      evalTempoAxis(acc);
      evalToleranceAxis(acc);
    }
  }
  state.missedMarkedBar = sweepTargetBar;
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

/* Axis 1 — Rhythmic complexity.
   Promote after 5 consec good-or-better on BOTH layers.
   Demote after 5 consec miss on EITHER layer. */
function evalComplexityAxis() {
  const a = state.adaptive;
  if (a.consecGoodA >= COMPLEXITY_PROMOTE_STREAK && a.consecGoodB >= COMPLEXITY_PROMOTE_STREAK) {
    a.consecGoodA = 0; a.consecGoodB = 0;
    if (a.polyIndex < POLY_PROGRESSION.length - 1) {
      a.polyIndex += 1;
      const next = POLY_PROGRESSION[a.polyIndex];
      applyAudioConfig({ polyrhythm: next });
      showAdaptToast(`Polyrhythm up — ${next}`);
    }
    return;
  }
  if (a.consecMissA >= COMPLEXITY_DEMOTE_STREAK || a.consecMissB >= COMPLEXITY_DEMOTE_STREAK) {
    a.consecMissA = 0; a.consecMissB = 0;
    if (a.polyIndex > 0) {
      a.polyIndex -= 1;
      const prev = POLY_PROGRESSION[a.polyIndex];
      applyAudioConfig({ polyrhythm: prev });
      showAdaptToast(`Easing off — ${prev}`);
    }
  }
}

/* Axis 2 — Tempo.
   Promote +10 BPM after 3 consec bars with BOTH layers >80%.
   Demote -10 BPM after 2 consec bars with EITHER layer <50%.
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

/* Axis 3 — Timing tolerance (Good window).
   Promote after 8 sustained bars >80% accuracy (both layers average).
   Demote after 4 sustained bars <50% accuracy. */
function evalToleranceAxis(acc) {
  const a = state.adaptive;
  const avg = (acc.a + acc.b) / 2;
  if (avg > 0.8) a.barsSustained80 += 1;      else a.barsSustained80 = 0;
  if (avg < 0.5) a.barsSustained50Below += 1; else a.barsSustained50Below = 0;

  if (a.barsSustained80 >= TOLERANCE_PROMOTE_BARS) {
    a.barsSustained80 = 0;
    if (a.toleranceIdx < TOLERANCE_LEVELS.length - 1) {
      a.toleranceIdx += 1;
      showAdaptToast(`Nice — tightening timing window (±${currentGoodWindow()}ms)`);
    }
    return;
  }
  if (a.barsSustained50Below >= TOLERANCE_DEMOTE_BARS) {
    a.barsSustained50Below = 0;
    if (a.toleranceIdx > 0) {
      a.toleranceIdx -= 1;
      showAdaptToast(`Widening timing window — focus on the feel (±${currentGoodWindow()}ms)`);
    }
  }
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
  if (state.ended) return false;
  if (state.level === 0) return false;   // Listen mode has no session
  const elapsed = getElapsed();
  if (elapsed >= SESSION_DURATION_S || state.totalBarsPlayed >= SESSION_MAX_BARS) {
    endSession();
    return true;
  }
  return false;
}

function computeResults() {
  const totalA = state.perfectA + state.goodA + state.missA;
  const totalB = state.perfectB + state.goodB + state.missB;
  const accA = totalA ? Math.round(((state.perfectA + state.goodA) / totalA) * 100) : 0;
  const accB = totalB ? Math.round(((state.perfectB + state.goodB) / totalB) * 100) : 0;
  const score = (state.perfectA + state.perfectB) * 300 +
                (state.goodA    + state.goodB)    * 100;
  return {
    accA, accB,
    bestStreak: state.bestStreak,
    score,
    polyrhythm: state.polyrhythm,
    bpm: state.bpm,
    tolerance: currentGoodWindow(),
    toleranceName: currentToleranceName(),
    duration: Math.max(0, Math.round(getElapsed())),
  };
}

function persistResult(results) {
  const detail = {
    gameId: 'polyrhythm',
    timestamp: new Date().toISOString(),
    mode: 'practice',
    difficulty: {
      polyrhythm: results.polyrhythm,
      bpm: results.bpm,
      tolerance: results.tolerance,
    },
    duration: results.duration,
    correct: ((results.accA + results.accB) / 2) > 70,
    detail: {
      polyrhythm: results.polyrhythm,
      bpm: results.bpm,
      layer1: state.logA.slice(),
      layer2: state.logB.slice(),
      perLayerAccuracy: { a: results.accA, b: results.accB },
      streak: results.bestStreak,
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

  const results = computeResults();
  persistResult(results);
  showResults(results);

  startBtn.textContent = 'Start';
  startBtn.classList.remove('stopping');
}

function showResults(results) {
  if (!resultsEl) return;
  if (resultAccAEl)    resultAccAEl.textContent    = `${results.accA}%`;
  if (resultAccBEl)    resultAccBEl.textContent    = `${results.accB}%`;
  if (resultStreakEl)  resultStreakEl.textContent  = String(results.bestStreak);
  if (resultScoreEl)   resultScoreEl.textContent   = String(results.score);
  if (resultPolyEl)    resultPolyEl.textContent    = results.polyrhythm;
  if (resultBpmEl)     resultBpmEl.textContent     = `${results.bpm} BPM`;
  if (resultToleranceEl) resultToleranceEl.textContent = `±${results.tolerance}ms`;
  renderSongConnection(results.polyrhythm);
  resultsEl.hidden = false;
  resultsEl.classList.add('pr-results--show');
}

function hideResults() {
  if (!resultsEl) return;
  resultsEl.classList.remove('pr-results--show');
  resultsEl.hidden = true;
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
  drawLaneBreathing(laneXA, state.beatTimesA, state.nA, elapsed, pxPerSec, LANE_COLOR_A_RGB);
  drawLaneBreathing(laneXB, state.beatTimesB, state.nB, elapsed, pxPerSec, LANE_COLOR_B_RGB);
  drawInterferenceWave(laneXA, laneXB, elapsed, pxPerSec);

  // --- Convergence lines (dashed, where beats align) ---
  drawConvergenceLines(laneXA, laneXB, elapsed, pxPerSec);

  // --- Falling notes ---
  drawFallingNotes('A', laneXA, state.beatTimesA, state.hitResultsA, elapsed, pxPerSec);
  drawFallingNotes('B', laneXB, state.beatTimesB, state.hitResultsB, elapsed, pxPerSec);

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

  sweepMisses();
  if (checkSessionEnd()) return;
  state.rafId = requestAnimationFrame(render);
}

/* ─── Background waves ──────────────────────────────────── */
function drawLaneBreathing(laneX, beats, nBeats, elapsed, pxPerSec, rgb) {
  const step = 4;
  // Build left/right edges
  const points = [];
  for (let y = 0; y <= HIT_Y; y += step) {
    const env = laneEnvelopeAt(y, beats, nBeats, elapsed, pxPerSec);
    const width = BASE_LANE_W + env * LANE_EXPAND * 2;
    points.push({ y, left: laneX - width / 2, right: laneX + width / 2, env });
  }

  // --- Fill (vertical gradient: 0.01 top → 0.10 bottom) ---
  const grad = ctx.createLinearGradient(0, 0, 0, HIT_Y);
  grad.addColorStop(0, `rgba(${rgb}, 0.01)`);
  grad.addColorStop(1, `rgba(${rgb}, 0.10)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].left, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].left, points[i].y);
  for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].right, points[i].y);
  ctx.closePath();
  ctx.fill();

  // --- Stroke edges (gradient 0.02 top → 0.18 bottom) ---
  const gradS = ctx.createLinearGradient(0, 0, 0, HIT_Y);
  gradS.addColorStop(0, `rgba(${rgb}, 0.02)`);
  gradS.addColorStop(1, `rgba(${rgb}, 0.18)`);
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

function drawInterferenceWave(laneXA, laneXB, elapsed, pxPerSec) {
  const step = 5;
  const centerX = (laneXA + laneXB) / 2;
  const maxAmp = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  const leftPts = [];
  const rightPts = [];
  for (let y = 0; y <= HIT_Y; y += step) {
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
function drawFallingNotes(layer, laneX, beats, results, elapsed, pxPerSec) {
  const travel = state.barDuration * 0.8;
  const bar = Math.floor(elapsed / state.barDuration);
  const color = NOTE_COLORS[layer];
  const rgb = NOTE_COLORS_RGB[layer];

  for (let b = bar - 1; b <= bar + 2; b++) {
    const barStart = b * state.barDuration;
    for (let i = 0; i < beats.length; i++) {
      const abs = barStart + beats[i];
      const remaining = abs - elapsed;
      if (remaining < -0.18 || remaining > travel) continue;

      const key = `${b}:${i}`;
      const res = results.get(key);
      if (res === 'perfect' || res === 'good') continue; // popped

      const y = HIT_Y - (remaining / travel) * HIT_Y;
      const progress = Math.max(0, Math.min(1, y / HIT_Y));
      const alpha = 0.08 + progress * 0.92;
      const radius = 4 + progress * 8;
      const strokeWidth = 1 + progress * 1.5;

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

      // Pulse halo when close to hit zone
      const proximity = Math.abs(y - HIT_Y) / HIT_Y;
      if (proximity < 0.12) {
        const t = performance.now() / 1000;
        const pulseR = radius + 6 + 4 * Math.sin(t * 14 * Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb}, ${0.45 * (1 - proximity / 0.12)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(laneX, y, pulseR, 0, Math.PI * 2);
        ctx.stroke();
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
  // session but level persists unless the user goes back to Quit).
  const a = state.adaptive;
  a.consecGoodA = 0; a.consecGoodB = 0;
  a.consecMissA = 0; a.consecMissB = 0;
  a.barsBothAbove80 = 0; a.barsEitherBelow50 = 0;
  a.barsSustained80 = 0; a.barsSustained50Below = 0;

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

function levelMessage() {
  let msg = LEVEL_COPY[state.level];
  const modality = state.provider ? state.provider.getActiveModality() : 'click';
  if (modality === 'mic_onset') {
    if (state.level === 2) {
      msg += ' <strong>Mic input supports one layer at a time. Use F/J keys for both layers.</strong>';
    } else if (state.level === 1) {
      msg += ` Mic taps drive Layer ${state.onsetLayer}.`;
    }
  }
  return msg;
}

function refreshLevelMessage() {
  messageEl.innerHTML = levelMessage();
}

function handleProviderOnset(_event) {
  if (!state.running) return;
  if (state.level === 0) return;     // Listen mode: no input
  // Single mic stream → one layer at a time. In Level 2 the player needs
  // F/J for the other layer; mic still drives `onsetLayer` here.
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
    // Update the message in case mic_onset + level 2 needs the constraint hint
    setTimeout(refreshLevelMessage, 0);
  }, true);
}

/* ══════════════════════════════════════════════════════════
   START / STOP
   ══════════════════════════════════════════════════════════ */
function start() {
  if (state.running) return;
  ensureAudioCtx();
  updateConfig();
  resetScoring();
  syncPolyIndex();
  hideResults();
  resizeCanvas();

  state.running = true;
  // Delay first bar start slightly so scheduler has lead time
  state.playStartTime = state.audioCtx.currentTime + 0.12;
  state.nextBarContextTime = state.playStartTime;

  schedulerTick();
  state.rafId = requestAnimationFrame(render);

  startBtn.textContent = 'Stop';
  startBtn.classList.add('stopping');
  refreshLevelMessage();
}

function stop() {
  if (!state.running) return;
  state.running = false;
  if (state.schedulerTimer) clearTimeout(state.schedulerTimer);
  state.schedulerTimer = null;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  hideAdaptToast();

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

levelsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.pr-level-pill');
  if (!btn) return;
  levelsEl.querySelectorAll('.pr-level-pill').forEach(b => b.classList.remove('pr-level-pill--on'));
  btn.classList.add('pr-level-pill--on');
  state.level = Number(btn.dataset.level);
  if (state.running) resetScoring();
  refreshLevelMessage();
});

bpmEl.addEventListener('input', () => {
  state.bpm = Number(bpmEl.value);
  bpmValueEl.textContent = state.bpm;
  if (state.running) restart();
});

muteAEl.addEventListener('click', () => {
  state.muteA = !state.muteA;
  muteAEl.classList.toggle('off', state.muteA);
});
muteBEl.addEventListener('click', () => {
  state.muteB = !state.muteB;
  muteBEl.classList.toggle('off', state.muteB);
});

startBtn.addEventListener('click', () => {
  if (state.running) stop(); else start();
});

/* Results screen actions */
if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    hideResults();
    // Play Again keeps current poly/bpm/tolerance (player earned them) and
    // restarts a fresh session.
    start();
  });
}
if (quitBtn) {
  quitBtn.addEventListener('click', () => {
    hideResults();
    // Quit reverts the adaptive level to whatever the dropdown/slider say —
    // the user's explicit setup choice.
    state.polyrhythm = polyEl.value;
    state.bpm = Number(bpmEl.value);
    bpmValueEl.textContent = state.bpm;
    state.adaptive.toleranceIdx = 0;
    syncPolyIndex();
    updateConfig();
    messageEl.textContent = 'Session ended. Press Start to go again.';
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

/* Pointer — left half → A, right half → B */
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
  state.bpm = Number(bpmEl.value);
  bpmValueEl.textContent = state.bpm;
  updateConfig();
  resizeCanvas();

  initInputProvider();
  refreshLevelMessage();

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
