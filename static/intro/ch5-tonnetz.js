/**
 * ch5-tonnetz.js — Chapter 5: Meet the Tonnetz
 * ==============================================
 * Rebuilt on shared Explorer components (TonnetzNeighborhood, KeyboardView,
 * ChordWheel) driven by HarmonyState.  Uses the acts/scrollytelling format:
 * one act with a sticky interactive area that progressively reveals panels,
 * and scroll-driven step cards that guide the user.
 *
 * Progressive panel reveal:
 *   Steps 1-2 → Tonnetz only
 *   Step  3   → + Keyboard
 *   Step  4   → + Chord Wheel
 *
 * Each panel is initialized when its step scrolls into view and subscribes
 * to HarmonyState independently (composable panel principle).
 */

import {
  ensureTone,
  ensureSampler,
  playSamplerNote,
  injectSharedCSS,
  registerCleanup,
  toAscii,
} from '/static/intro/intro-audio.js';

import { HarmonyState }
  from '/static/shared/harmony-state.js';
import { TonnetzNeighborhood }
  from '/static/shared/tonnetz-neighborhood.js';
import { KeyboardView }
  from '/static/shared/keyboard-view.js';
import { ChordWheel }
  from '/static/js/chord-wheel.js';
import { noteToPC }
  from '/static/shared/transforms.js';

// ════════════════════════════════════════════════════════════════════
// METADATA
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 5,
  title: 'Meet the Tonnetz',
  tone: 'playful',
  description: 'A visual map that reveals hidden connections between chords.',
};

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CH5_CSS = /* css */ `

/* ── Sticky override — Explorer panels need more vertical room ── */

.intro-act:has(.ch5-panels) .intro-act__sticky {
  max-height: 65vh;
}

/* ── Panel shell (matches explorer.html pattern) ──────────── */

.ch5-panels {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 800px;
}

.ch5-top-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.ch5-panel {
  border: 1px solid var(--border, #dfe6e9);
  border-radius: 12px;
  background: var(--bg-card, #fff);
  overflow: hidden;
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.ch5-panel--hidden {
  display: none;
}

.ch5-panel--entering {
  opacity: 0;
  transform: translateY(12px);
}

.ch5-panel-header {
  padding: 0.3rem 0.8rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--border, #dfe6e9);
}

/* ── Tonnetz panel ───────────────────────────────────────── */

.ch5-panel--tonnetz {
  flex: 1 1 0;
  min-width: 0;
}

.ch5-panel--tonnetz .ch5-panel-body {
  height: 340px;
  padding: 0;
  position: relative;
}

#ch5-tonnetz-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Chord wheel panel ───────────────────────────────────── */

.ch5-panel--wheel {
  flex: 0 0 auto;
  width: 260px;
}

.ch5-panel--wheel .ch5-panel-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  height: 340px;
  box-sizing: border-box;
}

#ch5-wheel-container {
  width: 240px;
  height: 240px;
  overflow: visible;
}

#ch5-wheel-container .cw-label {
  font-size: 11px;
}
#ch5-wheel-container .cw-roman {
  font-size: 8px;
}

/* ── Keyboard panel ──────────────────────────────────────── */

.ch5-panel--keyboard .ch5-panel-body {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0.5rem;
  overflow-x: auto;
}

/* ── Info badge ──────────────────────────────────────────── */

.ch5-info-badge {
  text-align: center;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent, #6c5ce7);
  padding: 0.3rem 0.6rem;
  min-height: 1.6em;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}

/* ── Responsive ──────────────────────────────────────────── */

@media (max-width: 700px) {
  .ch5-top-row {
    flex-direction: column;
  }
  .ch5-panel--wheel {
    width: 100%;
  }
  .ch5-panel--wheel .ch5-panel-body {
    height: 260px;
  }
  #ch5-wheel-container {
    width: 220px;
    height: 220px;
  }
  .ch5-panel--tonnetz .ch5-panel-body {
    height: 280px;
  }
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch5-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch5-styles';
  el.textContent = CH5_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

let _tonnetzInited = false;
let _keyboardInited = false;
let _wheelInited = false;
let _wheel = null;
let _audioReady = false;
let _infoBadge = null;

// Panel DOM elements (set in mountInteractive)
let _tonnetzPanel = null;
let _keyboardPanel = null;
let _wheelPanel = null;

// ════════════════════════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════════════════════════

async function _enableAudio() {
  if (_audioReady) return;
  await ensureTone();
  await ensureSampler();
  _audioReady = true;
}

/** Play the current chord from HarmonyState via the intro sampler. */
function _playCurrentChord() {
  if (!_audioReady) return;
  const state = HarmonyState.get();
  const triads = state.activeTriads || [];
  const primary = triads.find(t => t.role === 'primary');
  if (!primary) return;
  const notes = primary.notes || [];
  let oct = 4, prevPC = -1;
  notes.forEach(n => {
    const ascii = toAscii(n);
    const pc = noteToPC(n);
    if (prevPC >= 0 && pc <= prevPC) oct++;
    prevPC = pc;
    playSamplerNote(`${ascii}${oct}`, '2n');
  });
}

// ════════════════════════════════════════════════════════════════════
// PANEL INITIALIZATION
// ════════════════════════════════════════════════════════════════════

function _initTonnetz() {
  if (_tonnetzInited) return;
  _tonnetzInited = true;

  TonnetzNeighborhood.init('ch5-tonnetz-container', {
    interactive: true,
    async onTriadClick({ root, quality }) {
      await _enableAudio();
      HarmonyState.setTriad(root, quality);
      _playCurrentChord();
    },
    async onNodeClick({ note }) {
      await _enableAudio();
      playSamplerNote(`${toAscii(note)}4`, '4n');
    },
  });

  // Set initial state: centered on C major
  HarmonyState.update({ tonnetzDepth: 2 });
  HarmonyState.setTriad('C', 'major');
}

async function _initKeyboard() {
  if (_keyboardInited) return;
  _keyboardInited = true;

  // KeyboardView._ensurePiano() needs window.Tone — ensure it's loaded first
  await ensureSampler();

  KeyboardView.init('ch5-keyboard-container', {
    showLabels: true,
    mode: 'both',
    noInternalAudio: true,
    async onNotePlay(noteName, _octave) {
      await _enableAudio();
      // Clicking a key selects that chord (chord mode)
      const pc = noteToPC(noteName);
      // Simple heuristic: white keys default major, same as Explorer
      const state = HarmonyState.get();
      const keyIdx = typeof state.currentKey === 'number' ? state.currentKey : 0;
      const quality = _guessQuality(pc, keyIdx);
      HarmonyState.setTriad(noteName, quality);
      _playCurrentChord();
    },
  });
}

function _initWheel() {
  if (_wheelInited) return;
  _wheelInited = true;
  _wheel = new ChordWheel('#ch5-wheel-container', { initialKey: 0 });
}

/** Guess chord quality for a note given current key context. */
const _COF_MAJOR_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const _COF_MINOR_PC = [9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2];

function _guessQuality(pc, keyIdx) {
  const prev = (keyIdx + 11) % 12;
  const next = (keyIdx + 1) % 12;
  if ([_COF_MAJOR_PC[prev], _COF_MAJOR_PC[keyIdx], _COF_MAJOR_PC[next]].includes(pc)) return 'major';
  if ([_COF_MINOR_PC[prev], _COF_MINOR_PC[keyIdx], _COF_MINOR_PC[next]].includes(pc)) return 'minor';
  return 'major';
}

// ════════════════════════════════════════════════════════════════════
// PANEL REVEAL
// ════════════════════════════════════════════════════════════════════

function _revealPanel(panel) {
  if (!panel || !panel.classList.contains('ch5-panel--hidden')) return;
  panel.classList.remove('ch5-panel--hidden');
  panel.classList.add('ch5-panel--entering');
  // Trigger reflow then remove entering class for animation
  panel.offsetHeight; // eslint-disable-line no-unused-expressions
  requestAnimationFrame(() => {
    panel.classList.remove('ch5-panel--entering');
  });
}

function _setInfo(text) {
  if (_infoBadge) _infoBadge.textContent = text;
}

// ════════════════════════════════════════════════════════════════════
// HARMONY STATE SUBSCRIBER — info badge updates
// ════════════════════════════════════════════════════════════════════

let _infoUnsub = null;

function _startInfoListener() {
  if (_infoUnsub) return;
  _infoUnsub = HarmonyState.on(state => {
    const triads = state.activeTriads || [];
    const primary = triads.find(t => t.role === 'primary');
    if (primary) {
      const q = primary.quality === 'major' ? 'Major' : 'Minor';
      _setInfo(`${primary.root} ${q}`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════

registerCleanup(() => {
  if (_infoUnsub) { _infoUnsub(); _infoUnsub = null; }
  if (_tonnetzInited) { TonnetzNeighborhood.destroy(); _tonnetzInited = false; }
  if (_keyboardInited) { KeyboardView.destroy(); _keyboardInited = false; }
  if (_wheelInited && _wheel) { _wheel.destroy(); _wheel = null; _wheelInited = false; }
  HarmonyState.reset();
  _audioReady = false;
});

// ════════════════════════════════════════════════════════════════════
// SECTIONS (for progress tracking — one per step)
// ════════════════════════════════════════════════════════════════════

export const sections = [
  { id: 'ch5-notes-have-neighbors' },
  { id: 'ch5-triangles-are-chords' },
  { id: 'ch5-keyboard-connection' },
  { id: 'ch5-chords-in-context' },
];

// ════════════════════════════════════════════════════════════════════
// ACTS (scrollytelling)
// ════════════════════════════════════════════════════════════════════

export const acts = [
  {
    id: 'act-tonnetz',

    mountInteractive(stickyEl) {
      _injectCSS();

      const panels = document.createElement('div');
      panels.className = 'ch5-panels';

      // Info badge
      _infoBadge = document.createElement('div');
      _infoBadge.className = 'ch5-info-badge';
      _infoBadge.textContent = 'Click notes and chords on the grid';
      panels.appendChild(_infoBadge);

      // Top row: Tonnetz (+ Chord Wheel, initially hidden)
      const topRow = document.createElement('div');
      topRow.className = 'ch5-top-row';

      // Tonnetz panel
      _tonnetzPanel = document.createElement('div');
      _tonnetzPanel.className = 'ch5-panel ch5-panel--tonnetz';
      _tonnetzPanel.innerHTML = `
        <div class="ch5-panel-header">Tonnetz</div>
        <div class="ch5-panel-body">
          <div id="ch5-tonnetz-container"></div>
        </div>
      `;
      topRow.appendChild(_tonnetzPanel);

      // Chord Wheel panel (hidden initially)
      _wheelPanel = document.createElement('div');
      _wheelPanel.className = 'ch5-panel ch5-panel--wheel ch5-panel--hidden';
      _wheelPanel.innerHTML = `
        <div class="ch5-panel-header">Chord Wheel</div>
        <div class="ch5-panel-body">
          <div id="ch5-wheel-container"></div>
        </div>
      `;
      topRow.appendChild(_wheelPanel);

      panels.appendChild(topRow);

      // Keyboard panel (hidden initially)
      _keyboardPanel = document.createElement('div');
      _keyboardPanel.className = 'ch5-panel ch5-panel--keyboard ch5-panel--hidden';
      _keyboardPanel.innerHTML = `
        <div class="ch5-panel-header">Keyboard</div>
        <div class="ch5-panel-body">
          <div id="ch5-keyboard-container"></div>
        </div>
      `;
      panels.appendChild(_keyboardPanel);

      stickyEl.appendChild(panels);

      // Pre-load Tone.js so KeyboardView._ensurePiano() finds window.Tone on step 4.3
      ensureSampler();
    },

    steps: [
      // ── 4.1: Notes Have Neighbors ──────────────────────────────
      {
        id: 'ch5-notes-have-neighbors',
        narration:
          'Every note on this grid is connected to its neighbors by a musical interval. ' +
          'Click C, then click G — that\'s a perfect fifth. See how they\'re connected? ' +
          'Now try C and E — a major third, along the diagonal. ' +
          'The Tonnetz arranges every note so that harmonic neighbors are geometric neighbors.',
        tryIt: 'Click any note to hear it. Its connections are the intervals you learned in Chapter 2.',

        onEnter(_stickyEl) {
          // Init here (not mountInteractive) so actEl is already in the document
          _initTonnetz();
          _startInfoListener();
          HarmonyState.update({ tonnetzDepth: 2 });
          HarmonyState.setTriad('C', 'major');
          _setInfo('Click notes and chords on the grid');
        },
        onLeave() {},
      },

      // ── 4.2: Triangles Are Chords ─────────────────────────────
      {
        id: 'ch5-triangles-are-chords',
        narration:
          'See the triangle formed by C, E, and G? That\'s a C major chord. ' +
          'Every upward triangle is a major chord. Every downward triangle is minor. ' +
          'Click the C major triangle and hear it play — then find A minor (A, C, E) nearby. ' +
          'The entire grid is a tessellation of chords, edge to edge.',
        tryIt: 'Click triangles to hear chords. Blue triangles are major, coral are minor.',

        onEnter(_stickyEl) {
          HarmonyState.setTriad('C', 'major');
          _setInfo('C Major');
        },
        onLeave() {},
      },

      // ── 4.3: The Keyboard Connection ──────────────────────────
      {
        id: 'ch5-keyboard-connection',
        narration:
          'The same notes you see on the grid are also on this keyboard. ' +
          'Click the C major triangle on the Tonnetz — the keyboard highlights C, E, and G. ' +
          'Click notes on the keyboard — watch them light up on the grid too. ' +
          'Both panels show the same musical truth in different shapes.',
        tryIt: 'Play freely on either panel. Everything stays in sync.',

        onEnter(_stickyEl) {
          // Reveal and initialize the keyboard
          _revealPanel(_keyboardPanel);
          _initKeyboard();
          HarmonyState.setTriad('C', 'major');
        },
        onLeave() {},
      },

      // ── 4.4: Chords in Context ────────────────────────────────
      {
        id: 'ch5-chords-in-context',
        narration:
          'This wheel shows how chords relate to a key. ' +
          'You\'re in the key of C — the highlighted chords are the ones that "belong" here. ' +
          'Try clicking I, IV, and V on the wheel — the Tonnetz and keyboard update together. ' +
          'Notice how these chords are neighbors on the grid? That\'s why they sound good together.',
        tryIt: 'Click chords on any panel. All three panels show you the same chord from different angles.',
        gameLink: {
          label: 'Explore freely in the Tonnetz Explorer →',
          url: '/explorer',
        },

        onEnter(_stickyEl) {
          // Reveal and initialize the chord wheel
          _revealPanel(_wheelPanel);
          _initWheel();
          HarmonyState.setTriad('C', 'major');
        },
        onLeave() {},
      },
    ],
  },
];
