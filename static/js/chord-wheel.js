/**
 * chord-wheel.js
 * ==============
 * Dual-ring circle of fifths with diatonic arc highlighting.
 * Outer ring = 12 major keys. Inner ring = 12 relative minor keys.
 * Selecting a key highlights the contiguous diatonic arc (I IV V + ii iii vi)
 * and visually teaches that diatonic harmony is a sliding window on the CoF.
 *
 * Pure rendering module — game logic lives elsewhere.
 *
 * Consumed by:
 *   - chord-wheel-test  → standalone isolation test
 *   - tonnetz-explorer  → synchronized Explorer panel (future)
 *
 * Depends on:
 *   - harmony-state.js  → HarmonyState (pub/sub)
 *   - transforms.js     → noteToPC
 *
 * Exposes: window.ChordWheel  (also ES-module export)
 */

import { noteToPC } from '../shared/transforms.js';
import { HarmonyState } from '../shared/harmony-state.js';

// ════════════════════════════════════════════════════════════════════
// CIRCLE OF FIFTHS DATA
// ════════════════════════════════════════════════════════════════════

/** Major key names in circle-of-fifths order. Index 0 = C at 12 o'clock. */
const COF_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];

/**
 * Relative minor root names, same CoF position as their relative major.
 * COF_MINOR[i] is the vi chord of COF_MAJOR[i].
 */
const COF_MINOR = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'B♭', 'F', 'C', 'G', 'D'];

/** Pitch classes for major keys in CoF order. */
const COF_MAJOR_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

/** Pitch classes for relative minor roots in CoF order. */
const COF_MINOR_PC = [9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2];

// ════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ════════════════════════════════════════════════════════════════════

const SVG_SIZE = 440;
const CX       = SVG_SIZE / 2;   // 220
const CY       = SVG_SIZE / 2;   // 220
const OUTER_R  = 175;            // outer ring radius
const INNER_R  = 110;            // inner ring radius
const NODE_R   = 20;             // node circle radius
const ARC_PAD  = NODE_R + 6;     // half-width of annular arc shading

/** Angular step per CoF position (30° in radians). */
const STEP  = (2 * Math.PI) / 12;
/** Starting angle: 0 maps to C at 12 o'clock (−90° from east). */
const START = -Math.PI / 2;

/**
 * Radii for Roman numeral labels.
 * Outer Romans appear just outside the outer ring.
 * Inner Romans appear just inside the inner ring (toward center).
 */
const ROMAN_OUTER_R = OUTER_R + NODE_R + 12;  // 207
const ROMAN_INNER_R = INNER_R - NODE_R - 12;  // 78

const SVG_NS = 'http://www.w3.org/2000/svg';

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CW_CSS = /* css */ `

/* ── Chord Wheel ─────────────────────────────────────────── */

.cw-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  user-select: none;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Subtle background arc behind the diatonic window */
.cw-arc {
  fill: var(--cw-arc-fill, rgba(108, 99, 255, 0.10));
  stroke: var(--cw-arc-stroke, rgba(108, 99, 255, 0.28));
  stroke-width: 1;
  pointer-events: none;
}

[data-theme="dark"] .cw-arc {
  fill: rgba(124, 117, 255, 0.18);
  stroke: rgba(124, 117, 255, 0.42);
}

/* Dashed lines connecting relative major/minor pairs */
.cw-connector {
  stroke: var(--cw-connector-stroke, rgba(108, 99, 255, 0.38));
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  pointer-events: none;
}

[data-theme="dark"] .cw-connector {
  stroke: rgba(124, 117, 255, 0.55);
}

/* ── Node circles ──────────────────────────────────────── */

.cw-node {
  cursor: pointer;
  transition: filter 0.15s;
}

.cw-node:hover {
  filter: brightness(1.2);
}

/* Non-diatonic nodes: dimmed */
.cw-node--outer {
  fill: var(--bg-card, #f0eeff);
  stroke: var(--border, #e8e6f0);
  stroke-width: 1.5;
  opacity: 0.35;
}

.cw-node--inner {
  fill: var(--bg-card, #f0eeff);
  stroke: var(--border, #e8e6f0);
  stroke-width: 1.5;
  opacity: 0.35;
}

/* Diatonic major IV and V: blue */
.cw-node--outer-major {
  fill: var(--cw-major-fill, #2563eb);
  stroke: var(--cw-major-stroke, #1d4ed8);
  stroke-width: 2;
  opacity: 1;
}

/* Selected tonic I: platform accent (purple) */
.cw-node--outer-tonic {
  fill: var(--accent, #6c63ff);
  stroke: var(--cw-tonic-stroke, #5147d6);
  stroke-width: 2.5;
  opacity: 1;
}

/* Diatonic minor ii, vi, iii: coral/warm */
.cw-node--inner-minor {
  fill: var(--cw-minor-fill, #e64a19);
  stroke: var(--cw-minor-stroke, #bf360c);
  stroke-width: 2;
  opacity: 1;
}

/* Active chord highlight ring (from HarmonyState) */
.cw-active-ring {
  fill: none;
  stroke: var(--cw-active-stroke, #fbbf24);
  stroke-width: 3;
  pointer-events: none;
}

/* ── Labels ──────────────────────────────────────────── */

.cw-label {
  pointer-events: none;
  font-size: 10px;
  font-weight: 700;
  fill: var(--text-primary, #1a1a2e);
  text-anchor: middle;
  dominant-baseline: central;
}

/* Labels on colored (diatonic) nodes */
.cw-label--light {
  fill: #ffffff;
}

/* Labels on dimmed (non-diatonic) nodes */
.cw-label--dim {
  fill: var(--text-secondary, #6b7280);
  opacity: 0.5;
}

/* Roman numeral function labels */
.cw-roman {
  pointer-events: none;
  font-size: 8px;
  font-weight: 800;
  fill: var(--text-secondary, #6b7280);
  text-anchor: middle;
  dominant-baseline: central;
  letter-spacing: 0.3px;
}

[data-theme="dark"] .cw-roman {
  fill: var(--text-muted, #aaaaaa);
}

/* ── vii° diminished marker ─────────────────────────────── */

.cw-dim-node {
  fill: var(--cw-dim-fill, rgba(180, 148, 0, 0.10));
  stroke: var(--cw-dim-stroke, #a07800);
  stroke-width: 1.5;
  stroke-dasharray: 3 2;
  pointer-events: none;
}

[data-theme="dark"] .cw-dim-node {
  fill: rgba(200, 165, 0, 0.14);
  stroke: #c9a227;
}

.cw-dim-label {
  pointer-events: none;
  font-size: 7px;
  font-weight: 800;
  fill: var(--cw-dim-text, #7a5c00);
  text-anchor: middle;
  dominant-baseline: central;
}

[data-theme="dark"] .cw-dim-label {
  fill: #c9a227;
}
`;

// ════════════════════════════════════════════════════════════════════
// CHORD WHEEL CLASS
// ════════════════════════════════════════════════════════════════════

class ChordWheel {
  /**
   * @param {Element|string} container  - DOM element or CSS selector to render into
   * @param {object}         [options]
   * @param {number}         [options.initialKey=0]  - Initial CoF index (0–11), C=0
   */
  constructor(container, options = {}) {
    this._container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this._selectedKey = options.initialKey ?? 0;  // CoF index 0–11
    this._activeOuter = -1;   // CoF index of highlighted outer (major) chord, -1 = none
    this._activeInner = -1;   // CoF index of highlighted inner (minor) chord, -1 = none
    this._svg   = null;
    this._unsub = null;
    this._el    = {};   // element cache: 'outer-N', 'outer-label-N', 'inner-N', etc.

    this._injectCSS();
    this._build();
    this._subscribeToState();
  }

  // ── CSS injection ──────────────────────────────────────────────

  _injectCSS() {
    if (document.getElementById('cw-styles')) return;
    const style = document.createElement('style');
    style.id = 'cw-styles';
    style.textContent = CW_CSS;
    document.head.appendChild(style);
  }

  // ── Build ──────────────────────────────────────────────────────

  _build() {
    const svg = _svgEl('svg', {
      class: 'cw-svg',
      viewBox: `0 0 ${SVG_SIZE} ${SVG_SIZE}`,
      role: 'img',
      'aria-label': 'Circle of fifths — chord wheel',
    });
    this._svg = svg;
    this._container.appendChild(svg);

    // Layer groups — drawn back to front
    this._gArc    = _svgEl('g'); svg.appendChild(this._gArc);
    this._gConn   = _svgEl('g'); svg.appendChild(this._gConn);
    this._gDim    = _svgEl('g'); svg.appendChild(this._gDim);
    this._gNodes  = _svgEl('g'); svg.appendChild(this._gNodes);
    this._gLabels = _svgEl('g'); svg.appendChild(this._gLabels);
    this._gRomans = _svgEl('g'); svg.appendChild(this._gRomans);
    this._gActive = _svgEl('g'); svg.appendChild(this._gActive);

    this._buildNodes();
    this._render();
  }

  /** Create and cache all 24 node circles and their labels. */
  _buildNodes() {
    for (let i = 0; i < 12; i++) {
      const angle = START + i * STEP;
      const ox = CX + OUTER_R * Math.cos(angle);
      const oy = CY + OUTER_R * Math.sin(angle);
      const ix = CX + INNER_R * Math.cos(angle);
      const iy = CY + INNER_R * Math.sin(angle);

      // ── Outer ring ────────────────────────────────────────────
      const oNode = _svgEl('circle', { cx: ox, cy: oy, r: NODE_R, class: 'cw-node' });
      oNode.addEventListener('click', () => this._onNodeClick('outer', i));
      this._gNodes.appendChild(oNode);
      this._el[`outer-${i}`] = oNode;

      const oLbl = _svgEl('text', { x: ox, y: oy, class: 'cw-label' });
      oLbl.textContent = COF_MAJOR[i];
      this._gLabels.appendChild(oLbl);
      this._el[`outer-label-${i}`] = oLbl;

      // ── Inner ring ────────────────────────────────────────────
      const iNode = _svgEl('circle', { cx: ix, cy: iy, r: NODE_R, class: 'cw-node' });
      iNode.addEventListener('click', () => this._onNodeClick('inner', i));
      this._gNodes.appendChild(iNode);
      this._el[`inner-${i}`] = iNode;

      const iLbl = _svgEl('text', { x: ix, y: iy, class: 'cw-label' });
      iLbl.textContent = COF_MINOR[i];
      this._gLabels.appendChild(iLbl);
      this._el[`inner-label-${i}`] = iLbl;
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  _render() {
    const p    = this._selectedKey;
    const prev = _mod(p - 1);
    const next = _mod(p + 1);

    this._renderArc(p);
    this._renderConnectors(prev, p, next);
    this._renderDimMarker(p);
    this._renderNodes(p, prev, next);
    this._renderRomans(p, prev, next);
    this._renderActiveRing();
  }

  /**
   * Draw the annular arc shading behind the 3-position diatonic window.
   * Uses continuous angle arithmetic (no mod) so the arc is always 90°
   * regardless of wrap-around near index 0 or 11.
   */
  _renderArc(p) {
    _clear(this._gArc);

    // θ1 and θ2 span (p-1.5) to (p+1.5) positions = 90° arc
    const θ1 = START + (p - 1.5) * STEP;
    const θ2 = START + (p + 1.5) * STEP;

    this._gArc.appendChild(_svgEl('path', {
      d: _annularArc(CX, CY, OUTER_R - ARC_PAD, OUTER_R + ARC_PAD, θ1, θ2),
      class: 'cw-arc',
    }));
    this._gArc.appendChild(_svgEl('path', {
      d: _annularArc(CX, CY, INNER_R - ARC_PAD, INNER_R + ARC_PAD, θ1, θ2),
      class: 'cw-arc',
    }));
  }

  /** Draw dashed lines between each diatonic outer/inner pair. */
  _renderConnectors(prev, p, next) {
    _clear(this._gConn);

    for (const i of [prev, p, next]) {
      const angle = START + i * STEP;
      const ox = CX + OUTER_R * Math.cos(angle);
      const oy = CY + OUTER_R * Math.sin(angle);
      const ix = CX + INNER_R * Math.cos(angle);
      const iy = CY + INNER_R * Math.sin(angle);

      // Shorten each end by NODE_R so the line starts/ends at node edges
      const dx = ix - ox, dy = iy - oy;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;

      this._gConn.appendChild(_svgEl('line', {
        x1: ox + ux * NODE_R, y1: oy + uy * NODE_R,
        x2: ix - ux * NODE_R, y2: iy - uy * NODE_R,
        class: 'cw-connector',
      }));
    }
  }

  /**
   * Draw the vii° diminished chord marker between the rings.
   * The vii° root sits 5 positions clockwise of the tonic on the CoF:
   * e.g. C major (p=0) → vii° = B = index 5; G major (p=1) → F♯ = index 6.
   * Placed at the midpoint radius between the outer and inner rings.
   */
  _renderDimMarker(p) {
    _clear(this._gDim);

    const dimIdx    = _mod(p + 5);
    const angle     = START + dimIdx * STEP;
    const MID_R     = (OUTER_R + INNER_R) / 2;          // 142.5 — between the rings
    const DIM_R     = Math.round(NODE_R * 0.55);         // 11 — fits in gap between rings
    const mx = CX + MID_R * Math.cos(angle);
    const my = CY + MID_R * Math.sin(angle);

    this._gDim.appendChild(_svgEl('circle', {
      cx: mx, cy: my, r: DIM_R,
      class: 'cw-dim-node',
    }));

    const lbl = _svgEl('text', { x: mx, y: my, class: 'cw-dim-label' });
    lbl.textContent = 'vii°';
    this._gDim.appendChild(lbl);
  }

  /** Apply color classes to all 24 nodes based on current key selection. */
  _renderNodes(p, prev, next) {
    for (let i = 0; i < 12; i++) {
      const oNode = this._el[`outer-${i}`];
      const oLbl  = this._el[`outer-label-${i}`];
      const iNode = this._el[`inner-${i}`];
      const iLbl  = this._el[`inner-label-${i}`];

      // Outer ring: tonic (I) = purple, IV/V = blue, rest = dimmed
      if (i === p) {
        oNode.setAttribute('class', 'cw-node cw-node--outer-tonic');
        oLbl.setAttribute('class', 'cw-label cw-label--light');
      } else if (i === prev || i === next) {
        oNode.setAttribute('class', 'cw-node cw-node--outer-major');
        oLbl.setAttribute('class', 'cw-label cw-label--light');
      } else {
        oNode.setAttribute('class', 'cw-node cw-node--outer');
        oLbl.setAttribute('class', 'cw-label cw-label--dim');
      }

      // Inner ring: diatonic (vi, ii, iii) = coral, rest = dimmed
      if (i === p || i === prev || i === next) {
        iNode.setAttribute('class', 'cw-node cw-node--inner-minor');
        iLbl.setAttribute('class', 'cw-label cw-label--light');
      } else {
        iNode.setAttribute('class', 'cw-node cw-node--inner');
        iLbl.setAttribute('class', 'cw-label cw-label--dim');
      }
    }
  }

  /**
   * Draw Roman numeral function labels for the 3 diatonic positions.
   * Outer labels (IV, I, V) appear outside the outer ring.
   * Inner labels (ii, vi, iii) appear inside the inner ring, toward center.
   */
  _renderRomans(p, prev, next) {
    _clear(this._gRomans);

    const positions = [
      { i: prev, outer: 'IV', inner: 'ii'  },
      { i: p,    outer: 'I',  inner: 'vi'  },
      { i: next, outer: 'V',  inner: 'iii' },
    ];

    for (const { i, outer, inner } of positions) {
      const angle = START + i * STEP;

      // Outer Roman label
      const orEl = _svgEl('text', {
        x: CX + ROMAN_OUTER_R * Math.cos(angle),
        y: CY + ROMAN_OUTER_R * Math.sin(angle),
        class: 'cw-roman',
      });
      orEl.textContent = outer;
      this._gRomans.appendChild(orEl);

      // Inner Roman label
      const irEl = _svgEl('text', {
        x: CX + ROMAN_INNER_R * Math.cos(angle),
        y: CY + ROMAN_INNER_R * Math.sin(angle),
        class: 'cw-roman',
      });
      irEl.textContent = inner;
      this._gRomans.appendChild(irEl);
    }
  }

  /** Draw a highlight ring around the currently active chord (from HarmonyState). */
  _renderActiveRing() {
    _clear(this._gActive);

    if (this._activeOuter >= 0) {
      const a = START + this._activeOuter * STEP;
      this._gActive.appendChild(_svgEl('circle', {
        cx: CX + OUTER_R * Math.cos(a),
        cy: CY + OUTER_R * Math.sin(a),
        r: NODE_R + 4,
        class: 'cw-active-ring',
      }));
    }

    if (this._activeInner >= 0) {
      const a = START + this._activeInner * STEP;
      this._gActive.appendChild(_svgEl('circle', {
        cx: CX + INNER_R * Math.cos(a),
        cy: CY + INNER_R * Math.sin(a),
        r: NODE_R + 4,
        class: 'cw-active-ring',
      }));
    }
  }

  // ── HarmonyState subscription ──────────────────────────────────

  _subscribeToState() {
    this._unsub = HarmonyState.on(state => {
      let changed = false;

      // Sync selected key from state.currentKey (CoF index or note name)
      if (state.currentKey !== undefined && state.currentKey !== null) {
        const idx = _resolveKey(state.currentKey);
        if (idx >= 0 && idx !== this._selectedKey) {
          this._selectedKey = idx;
          changed = true;
        }
      }

      // Sync active chord highlight from primary triad
      const primary = Array.isArray(state.activeTriads)
        ? state.activeTriads.find(t => t.role === 'primary')
        : null;

      let newOuter = -1;
      let newInner = -1;

      if (primary) {
        const pc = noteToPC(primary.root);
        if (primary.quality === 'major') {
          newOuter = COF_MAJOR_PC.indexOf(pc);
        } else if (primary.quality === 'minor') {
          newInner = COF_MINOR_PC.indexOf(pc);
        }
      }

      if (newOuter !== this._activeOuter || newInner !== this._activeInner) {
        this._activeOuter = newOuter;
        this._activeInner = newInner;
        changed = true;
      }

      if (changed) this._render();
    });
  }

  // ── Click handler ──────────────────────────────────────────────

  _onNodeClick(ring, index) {
    this._selectedKey = index;

    // Publish key context to HarmonyState so other components can sync
    HarmonyState.update({ currentKey: index });

    if (ring === 'outer') {
      // Clicking a major key node: set it as the active tonic triad
      HarmonyState.setTriad(COF_MAJOR[index], 'major');
    } else {
      // Clicking a minor key node: set the relative minor as the active chord.
      // Key context stays at same index (relative major = same CoF position).
      HarmonyState.setTriad(COF_MINOR[index], 'minor');
    }

    this._render();
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Programmatically select a key by CoF index (0–11).
   * Does not publish to HarmonyState; use HarmonyState.update({ currentKey }) for that.
   * @param {number} index  CoF index 0–11 (C=0, G=1, … F=11)
   */
  setKey(index) {
    this._selectedKey = _mod(index);
    this._render();
  }

  /** Remove the SVG from the DOM and unsubscribe from HarmonyState. */
  destroy() {
    if (this._unsub) this._unsub();
    if (this._svg) this._svg.remove();
  }
}

// ════════════════════════════════════════════════════════════════════
// SVG / MATH HELPERS
// ════════════════════════════════════════════════════════════════════

/** Create an SVG element in the SVG namespace with given attributes. */
function _svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Build an SVG path string for an annular (donut) sector.
 * Sweeps clockwise from θ1 to θ2 at outer radius r2, then
 * counter-clockwise back at inner radius r1.
 *
 * @param {number} cx   Center x
 * @param {number} cy   Center y
 * @param {number} r1   Inner radius
 * @param {number} r2   Outer radius
 * @param {number} θ1   Start angle (radians, measured from positive-x axis)
 * @param {number} θ2   End angle (radians)
 */
function _annularArc(cx, cy, r1, r2, θ1, θ2) {
  const cos1 = Math.cos(θ1), sin1 = Math.sin(θ1);
  const cos2 = Math.cos(θ2), sin2 = Math.sin(θ2);
  const large = θ2 - θ1 > Math.PI ? 1 : 0;

  const x1o = cx + r2 * cos1, y1o = cy + r2 * sin1;  // outer start
  const x2o = cx + r2 * cos2, y2o = cy + r2 * sin2;  // outer end
  const x1i = cx + r1 * cos2, y1i = cy + r1 * sin2;  // inner start (reversed)
  const x2i = cx + r1 * cos1, y2i = cy + r1 * sin1;  // inner end

  return [
    `M ${x1o} ${y1o}`,
    `A ${r2} ${r2} 0 ${large} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${r1} ${r1} 0 ${large} 0 ${x2i} ${y2i}`,
    `Z`,
  ].join(' ');
}

/** Modular arithmetic that always returns 0–11. */
function _mod(n) {
  return ((n % 12) + 12) % 12;
}

/** Remove all child nodes from an SVG group element. */
function _clear(g) {
  while (g.firstChild) g.removeChild(g.firstChild);
}

/**
 * Resolve a key value to a CoF index (0–11).
 * Accepts an integer CoF index or a note name string (e.g. "C", "F♯", "Bb").
 * Returns -1 if unrecognized.
 */
function _resolveKey(key) {
  if (typeof key === 'number') return _mod(key);
  if (typeof key === 'string') {
    const pc = noteToPC(key);
    return COF_MAJOR_PC.indexOf(pc);
  }
  return -1;
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { ChordWheel };
export { COF_MAJOR, COF_MINOR, COF_MAJOR_PC, COF_MINOR_PC };

if (typeof window !== 'undefined') {
  window.ChordWheel = ChordWheel;
}
