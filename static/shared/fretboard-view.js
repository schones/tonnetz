/**
 * fretboard-view.js
 * =================
 * SVG-based guitar fretboard as a composable Explorer panel.
 * Subscribes to HarmonyState and highlights active notes across all
 * fret positions, with practical-voicing emphasis.
 *
 * Pure rendering module — game logic lives elsewhere.
 *
 * Consumed by:
 *   - explorer.html           → optional fourth panel
 *   - test-fretboard.html     → standalone test page
 *
 * Depends on:
 *   - transforms.js   → noteToPC, pcToNote
 *   - harmony-state.js → HarmonyState
 *
 * Exposes: window.FretboardView  (also ES-module export)
 */

import { noteToPC, pcToNote } from './transforms.js';
import { HarmonyState } from './harmony-state.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Standard tuning: low E to high E (bottom string to top string visually). */
const DEFAULT_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const DEFAULT_FRETS = 15;

// Layout dimensions
const STRING_SPACING = 30;
const NUT_X = 60;                // x-offset for the nut (fret 0)
const FRET_SPACING = 50;        // horizontal spacing between frets
const TOP_PAD = 40;             // space above top string for markers/labels
const BOTTOM_PAD = 20;
const LEFT_PAD = 20;

// Dot markers at standard fret positions
const SINGLE_DOTS = [3, 5, 7, 9, 15];
const DOUBLE_DOTS = [12];

// String thicknesses (low E = thickest, high E = thinnest)
const STRING_WIDTHS = [3, 2.5, 2, 1.5, 1.2, 1];

// Highlight dot sizes
const PRIMARY_DOT_R = 10;
const SECONDARY_DOT_R = 7;
const NOTE_LABEL_SIZE = 9;

// Colors (matching platform palette)
const QUALITY_COLORS = {
  major: '#2563eb',
  minor: '#e64a19',
  dim:   '#7c3aed',
  aug:   '#d97706',
};
const DEFAULT_COLOR = '#6c63ff';
const SECONDARY_OPACITY = 0.3;

// ════════════════════════════════════════════════════════════════════
// NOTE HELPERS
// ════════════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];

/** Parse "E2" → { pc: 4, octave: 2, midi: 40 } */
function _parseNote(noteStr) {
  const m = noteStr.match(/^([A-Ga-g][#♯b♭]?)(\d)$/);
  if (!m) return null;
  const pc = noteToPC(m[1]);
  const octave = parseInt(m[2], 10);
  return { pc, octave, midi: octave * 12 + pc + 12 };
}

/** MIDI → pitch class */
function _midiToPC(midi) {
  return ((midi - 12) % 12 + 12) % 12;
}

/** MIDI → note name (sharp spelling) */
function _midiToName(midi) {
  return NOTE_NAMES[_midiToPC(midi)];
}

// ════════════════════════════════════════════════════════════════════
// CSS (injected once)
// ════════════════════════════════════════════════════════════════════

const FB_CSS = /* css */ `
.fb-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  user-select: none;
  -webkit-user-select: none;
}
.fb-svg {
  display: block;
  width: 100%;
  height: 100%;
}
`;

// ════════════════════════════════════════════════════════════════════
// VOICING ALGORITHM
// ════════════════════════════════════════════════════════════════════

/**
 * Find the most practical voicing cluster for a set of pitch classes
 * on the fretboard. Returns an array of { string, fret } positions
 * that cover all chord tones within a 4-5 fret span.
 *
 * Strategy: scan each possible fret window (width = 5 frets including
 * open strings), find the one closest to the nut that covers all PCs.
 *
 * @param {Set<number>} activePCs - pitch classes to voice
 * @param {number[]} openMidis - MIDI note of each open string
 * @param {number} numFrets - total frets available
 * @returns {Set<string>} set of "string:fret" keys for primary positions
 */
function _findPracticalVoicing(activePCs, openMidis, numFrets) {
  const WINDOW = 5;
  const result = new Set();

  // Try windows starting from fret 0 (open position)
  for (let startFret = 0; startFret <= numFrets - WINDOW + 1; startFret++) {
    const covered = new Set();
    const positions = [];

    for (let s = 0; s < openMidis.length; s++) {
      // Check open string (always available regardless of window)
      const openPC = _midiToPC(openMidis[s]);
      if (startFret === 0 && activePCs.has(openPC)) {
        covered.add(openPC);
        positions.push({ s, fret: 0 });
        continue;
      }

      // Check frets within window
      for (let f = Math.max(1, startFret); f < startFret + WINDOW && f <= numFrets; f++) {
        const midi = openMidis[s] + f;
        const pc = _midiToPC(midi);
        if (activePCs.has(pc)) {
          covered.add(pc);
          positions.push({ s, fret: f });
          break; // one note per string
        }
      }
    }

    if (covered.size === activePCs.size) {
      // Found a complete voicing — pick one position per string
      // preferring positions that are closer to the nut
      const byString = new Map();
      for (const p of positions) {
        if (!byString.has(p.s) || p.fret < byString.get(p.s).fret) {
          byString.set(p.s, p);
        }
      }
      for (const p of byString.values()) {
        result.add(`${p.s}:${p.fret}`);
      }
      return result;
    }
  }

  // Fallback: no single window covers all PCs — return empty
  return result;
}

// ════════════════════════════════════════════════════════════════════
// FRETBOARD VIEW
// ════════════════════════════════════════════════════════════════════

class FretboardView {
  /**
   * @param {string|Element} container - ID string or DOM element
   * @param {Object} [options]
   * @param {number} [options.frets=15] - number of frets to display
   * @param {string[]} [options.tuning] - array of note+octave strings (low to high)
   * @param {boolean} [options.showNoteNames=true]
   * @param {boolean} [options.interactive=true] - click-to-select
   */
  constructor(container, options = {}) {
    this._opts = {
      frets: options.frets ?? DEFAULT_FRETS,
      tuning: options.tuning ?? [...DEFAULT_TUNING],
      showNoteNames: options.showNoteNames ?? true,
      interactive: options.interactive ?? true,
    };

    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this._container = el || null;
    this._svgEl = null;
    this._wrapEl = null;
    this._unsub = null;

    // Parse tuning to MIDI values (index 0 = low E = bottom string)
    this._openMidis = this._opts.tuning.map(n => {
      const parsed = _parseNote(n);
      return parsed ? parsed.midi : 40;
    });

    // Inject CSS
    if (!document.getElementById('fb-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'fb-styles';
      styleEl.textContent = FB_CSS;
      document.head.appendChild(styleEl);
    }

    this._buildSVG();

    // Subscribe to HarmonyState
    this._unsub = HarmonyState.on(state => this._render(state));
    this._render(HarmonyState.get());
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  destroy() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (this._wrapEl?.parentNode) this._wrapEl.parentNode.removeChild(this._wrapEl);
    this._wrapEl = null;
    this._svgEl = null;
    this._container = null;
  }

  // ── SVG Construction ───────────────────────────────────────────

  _buildSVG() {
    if (!this._container) return;

    const numStrings = this._openMidis.length;
    const numFrets = this._opts.frets;

    const width = NUT_X + LEFT_PAD + numFrets * FRET_SPACING + 20;
    const height = TOP_PAD + (numStrings - 1) * STRING_SPACING + BOTTOM_PAD;

    // Wrapper
    const wrap = document.createElement('div');
    wrap.className = 'fb-wrap';

    // SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'fb-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // ── Fret lines ────────────────────────────────────────────
    const fretGroup = this._createEl('g', { class: 'fb-frets' });

    // Nut (fret 0) — thicker line
    const nutX = LEFT_PAD + NUT_X;
    fretGroup.appendChild(this._createEl('line', {
      x1: nutX, y1: TOP_PAD - 5,
      x2: nutX, y2: TOP_PAD + (numStrings - 1) * STRING_SPACING + 5,
      stroke: '#888', 'stroke-width': 4, 'stroke-linecap': 'round',
    }));

    // Regular fret lines
    for (let f = 1; f <= numFrets; f++) {
      const x = nutX + f * FRET_SPACING;
      fretGroup.appendChild(this._createEl('line', {
        x1: x, y1: TOP_PAD - 3,
        x2: x, y2: TOP_PAD + (numStrings - 1) * STRING_SPACING + 3,
        stroke: '#555', 'stroke-width': 1.5,
      }));
    }
    svg.appendChild(fretGroup);

    // ── Fret markers (dots) ───────────────────────────────────
    const markerGroup = this._createEl('g', { class: 'fb-markers' });
    const markerY = TOP_PAD + (numStrings - 1) * STRING_SPACING / 2;

    for (const f of SINGLE_DOTS) {
      if (f > numFrets) continue;
      const cx = nutX + (f - 0.5) * FRET_SPACING;
      markerGroup.appendChild(this._createEl('circle', {
        cx, cy: markerY, r: 4,
        fill: '#444', opacity: 0.5,
      }));
    }
    for (const f of DOUBLE_DOTS) {
      if (f > numFrets) continue;
      const cx = nutX + (f - 0.5) * FRET_SPACING;
      const offset = STRING_SPACING * 1.2;
      markerGroup.appendChild(this._createEl('circle', {
        cx, cy: markerY - offset, r: 4, fill: '#444', opacity: 0.5,
      }));
      markerGroup.appendChild(this._createEl('circle', {
        cx, cy: markerY + offset, r: 4, fill: '#444', opacity: 0.5,
      }));
    }
    svg.appendChild(markerGroup);

    // ── Strings ───────────────────────────────────────────────
    const stringGroup = this._createEl('g', { class: 'fb-strings' });
    for (let s = 0; s < numStrings; s++) {
      // Strings are drawn top-to-bottom: index 0 = high E (top), index 5 = low E (bottom)
      // But our _openMidis is low-to-high, so reverse the y mapping
      const yIdx = numStrings - 1 - s; // string index in visual order (0=top=highE)
      const y = TOP_PAD + yIdx * STRING_SPACING;
      const sw = STRING_WIDTHS[yIdx] || 1;

      stringGroup.appendChild(this._createEl('line', {
        x1: nutX, y1: y,
        x2: nutX + numFrets * FRET_SPACING, y2: y,
        stroke: '#999', 'stroke-width': sw,
      }));

      // String tuning label (left of nut)
      const label = this._createEl('text', {
        x: nutX - 12, y: y,
        'text-anchor': 'end', 'dominant-baseline': 'central',
        'font-size': 11, 'font-weight': 600,
        fill: '#aaa',
      });
      label.textContent = _midiToName(this._openMidis[s]);
      stringGroup.appendChild(label);
    }
    svg.appendChild(stringGroup);

    // ── Fret number labels ────────────────────────────────────
    const numLabelGroup = this._createEl('g', { class: 'fb-fret-numbers' });
    for (let f = 1; f <= numFrets; f++) {
      if (f % 2 === 0 && f !== 12) continue; // show odd frets + 12
      const x = nutX + (f - 0.5) * FRET_SPACING;
      const lbl = this._createEl('text', {
        x, y: TOP_PAD + (numStrings - 1) * STRING_SPACING + BOTTOM_PAD - 2,
        'text-anchor': 'middle', 'font-size': 9, fill: '#666',
      });
      lbl.textContent = f;
      numLabelGroup.appendChild(lbl);
    }
    svg.appendChild(numLabelGroup);

    // ── Highlight layer (populated by _render) ────────────────
    const hlGroup = this._createEl('g', { class: 'fb-highlights' });
    svg.appendChild(hlGroup);
    this._hlGroup = hlGroup;

    // ── Open/muted string indicators layer ────────────────────
    const statusGroup = this._createEl('g', { class: 'fb-string-status' });
    svg.appendChild(statusGroup);
    this._statusGroup = statusGroup;

    // ── Click interaction layer ───────────────────────────────
    if (this._opts.interactive) {
      const clickGroup = this._createEl('g', { class: 'fb-click-targets' });
      for (let s = 0; s < numStrings; s++) {
        const yIdx = numStrings - 1 - s;
        const y = TOP_PAD + yIdx * STRING_SPACING;

        for (let f = 0; f <= numFrets; f++) {
          const cx = f === 0
            ? nutX - 2
            : nutX + (f - 0.5) * FRET_SPACING;

          const target = this._createEl('circle', {
            cx, cy: y, r: PRIMARY_DOT_R + 2,
            fill: 'transparent', cursor: 'pointer',
            'data-string': s, 'data-fret': f,
          });

          target.addEventListener('click', () => this._handleClick(s, f));
          clickGroup.appendChild(target);
        }
      }
      svg.appendChild(clickGroup);
    }

    wrap.appendChild(svg);
    this._container.appendChild(wrap);
    this._wrapEl = wrap;
    this._svgEl = svg;
  }

  // ── Render (HarmonyState subscriber) ───────────────────────────

  _render(state) {
    if (!this._hlGroup || !this._statusGroup) return;
    this._hlGroup.textContent = '';
    this._statusGroup.textContent = '';

    const numStrings = this._openMidis.length;
    const numFrets = this._opts.frets;
    const nutX = LEFT_PAD + NUT_X;

    // ── Determine active pitch classes ────────────────────────
    const activePCs = new Set();
    const triads = state.activeTriads || [];
    const primary = triads.find(t => t.role === 'primary');
    let quality = null;

    if (primary) {
      quality = primary.quality;
      for (const n of (primary.notes || [])) {
        const pc = noteToPC(n);
        if (!isNaN(pc)) activePCs.add(pc);
      }
    } else {
      // Note mode or no triads — use activeNotes
      for (const an of (state.activeNotes || [])) {
        const pc = noteToPC(an.note);
        if (!isNaN(pc)) activePCs.add(pc);
      }
    }

    if (activePCs.size === 0) return;

    // ── Determine highlight color ─────────────────────────────
    const color = (quality && QUALITY_COLORS[quality]) || DEFAULT_COLOR;

    // ── Find practical voicing cluster ────────────────────────
    const practicalKeys = _findPracticalVoicing(activePCs, this._openMidis, numFrets);

    // ── Track which strings have a practical voicing note ──────
    const practicalStrings = new Set();
    for (const key of practicalKeys) {
      const s = parseInt(key.split(':')[0], 10);
      practicalStrings.add(s);
    }

    // ── Draw highlights ───────────────────────────────────────
    for (let s = 0; s < numStrings; s++) {
      const yIdx = numStrings - 1 - s;
      const y = TOP_PAD + yIdx * STRING_SPACING;
      let hasNote = false;

      for (let f = 0; f <= numFrets; f++) {
        const midi = this._openMidis[s] + f;
        const pc = _midiToPC(midi);

        if (!activePCs.has(pc)) continue;
        hasNote = true;

        const key = `${s}:${f}`;
        const isPrimary = practicalKeys.has(key);
        const cx = f === 0
          ? nutX - 2
          : nutX + (f - 0.5) * FRET_SPACING;

        if (isPrimary) {
          // Primary: full opacity filled circle
          this._hlGroup.appendChild(this._createEl('circle', {
            cx, cy: y, r: PRIMARY_DOT_R,
            fill: color, opacity: 0.9,
            class: 'fb-dot fb-dot--primary',
          }));

          // Note name label
          if (this._opts.showNoteNames) {
            const lbl = this._createEl('text', {
              x: cx, y: y,
              'text-anchor': 'middle', 'dominant-baseline': 'central',
              'font-size': NOTE_LABEL_SIZE, 'font-weight': 700,
              fill: '#fff', 'pointer-events': 'none',
              class: 'fb-note-label',
            });
            lbl.textContent = _midiToName(midi);
            this._hlGroup.appendChild(lbl);
          }
        } else {
          // Secondary: reduced opacity, outline-only
          this._hlGroup.appendChild(this._createEl('circle', {
            cx, cy: y, r: SECONDARY_DOT_R,
            fill: 'none', stroke: color, 'stroke-width': 1.5,
            opacity: SECONDARY_OPACITY,
            class: 'fb-dot fb-dot--secondary',
          }));
        }
      }

      // ── Open/muted string indicator ─────────────────────────
      if (practicalKeys.size > 0) {
        const indicatorX = nutX - 18;
        const indicatorY = y;

        if (practicalKeys.has(`${s}:0`)) {
          // Open string: O
          this._statusGroup.appendChild(this._createEl('circle', {
            cx: indicatorX, cy: indicatorY, r: 5,
            fill: 'none', stroke: color, 'stroke-width': 1.5,
            class: 'fb-open',
          }));
        } else if (!practicalStrings.has(s)) {
          // Muted: X
          const xSize = 4;
          this._statusGroup.appendChild(this._createEl('line', {
            x1: indicatorX - xSize, y1: indicatorY - xSize,
            x2: indicatorX + xSize, y2: indicatorY + xSize,
            stroke: '#888', 'stroke-width': 1.5,
            class: 'fb-muted',
          }));
          this._statusGroup.appendChild(this._createEl('line', {
            x1: indicatorX + xSize, y1: indicatorY - xSize,
            x2: indicatorX - xSize, y2: indicatorY + xSize,
            stroke: '#888', 'stroke-width': 1.5,
            class: 'fb-muted',
          }));
        }
      }
    }
  }

  // ── Click handler ──────────────────────────────────────────────

  _handleClick(stringIdx, fret) {
    const midi = this._openMidis[stringIdx] + fret;
    const pc = _midiToPC(midi);
    const noteName = pcToNote(pc);
    const octave = Math.floor((midi - 12) / 12);

    const state = HarmonyState.get();
    const prog = state.progressionState;

    // In progression mode, don't allow note toggling
    if (prog && prog.chords.length > 0) return;

    // Check current mode from activeTriads
    const triads = state.activeTriads || [];
    if (triads.length > 0 && triads.some(t => t.role === 'primary')) {
      // Chord mode: select chord containing this note
      // Match keyboard behavior — defer to toggleNote which clears triads
      HarmonyState.toggleNote(noteName, octave);
    } else {
      // Note mode: toggle individual notes
      HarmonyState.toggleNote(noteName, octave);
    }
  }

  // ── SVG helper ─────────────────────────────────────────────────

  _createEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') {
        el.setAttribute('class', String(v));
      } else {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { FretboardView };

if (typeof window !== 'undefined') {
  window.FretboardView = FretboardView;
}
