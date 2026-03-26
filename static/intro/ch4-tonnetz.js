/**
 * ch4-tonnetz.js — Chapter 4: The Tonnetz
 * =========================================
 * Standalone SVG Tonnetz visualization for the intro module.
 * Four sections: note neighbors, triangles-as-chords, shared notes, progressions on the map.
 *
 * Lattice coordinate system — matches tonnetz-neighborhood.js exactly:
 *   PC(q, r) = (7q + 4r) mod 12
 *   q = steps along the Perfect-Fifth axis  (q+1 → +7 semitones)
 *   r = steps along the Major-Third axis    (r+1 → +4 semitones)
 *
 * SVG mapping (y increases downward):
 *   x = padX + r × colW + (q − Q_MIN) × (colW / 2)
 *   y = padY + (Q_MAX − q) × rowH
 *   → M3 = horizontal right, P5 = up-right diagonal at ~60°
 *
 * Display grid (4 rows, q = −1 … 2, r = 0 … 6):
 *   q=2 (top):    D  F♯ B♭  D  F♯ B♭  D
 *   q=1:          G  B  E♭  G  B  E♭  G
 *   q=0:          C  E  A♭  C  E  A♭  C
 *   q=−1 (bot):   F  A  C♯  F  A  C♯  F
 *
 * Triangle types (matching the reference):
 *   Upward  △ (major): nodes (q,r),(q,r+1),(q+1,r)     root = PC(q,r)
 *   Downward ▽ (minor): nodes (q,r+1),(q+1,r),(q+1,r+1) root = PC(q,r+1)
 */

import {
  CHROMATIC,
  ensureTone,
  ensureSampler,
  playSamplerNote,
  injectSharedCSS,
  registerCleanup,
  toAscii,
  buildScale,
  buildTriad,
  chordQuality,
  MAJOR_PATTERN,
} from '/static/intro/intro-audio.js';

// ════════════════════════════════════════════════════════════════════
// METADATA
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 4,
  title: 'The Tonnetz',
  tone: 'playful',
  description: 'A map that shows how every chord connects to every other through shared notes.',
};

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const PROGRESSIONS = [
  { label: 'I – IV – V – I',  subtitle: 'The backbone of rock & blues',    degrees: [0, 3, 4, 0] },
  { label: 'I – V – vi – IV', subtitle: 'The most popular pop progression', degrees: [0, 4, 5, 3] },
  { label: 'I – vi – IV – V', subtitle: '50s doo-wop',                      degrees: [0, 5, 3, 4] },
];

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/** Pitch class at lattice (q, r).  Handles negative q. */
function _pcAt(q, r) {
  return ((7 * q + 4 * r) % 12 + 12) % 12;
}

function _pcToName(pc) {
  return CHROMATIC.find(n => n.pc === pc)?.name ?? '?';
}

function _playPcs(pcs) {
  pcs.forEach(pc => playSamplerNote(`${toAscii(_pcToName(pc))}4`, '2n'));
}

function _cancelTimers(arr) {
  arr.forEach(id => clearTimeout(id));
  arr.length = 0;
}

function _chordLabel(pcs) {
  const q = chordQuality(pcs);
  const root = _pcToName(pcs[0]);
  return q === 'major' ? `${root} Major` : `${root} Minor`;
}

/** Find the first triangle whose pitch-class set matches pcs. */
function _findTri(triangles, pcs) {
  const s = new Set(pcs);
  return triangles.find(t => t.pcs.length === 3 && t.pcs.every(p => s.has(p))) ?? null;
}

/** Triangles sharing exactly 2 nodes with tri. */
function _adjTris(tri, triangles) {
  return triangles.filter(other => {
    if (other === tri) return false;
    const shared = tri.nodes.filter(n1 =>
      other.nodes.some(n2 => n1.q === n2.q && n1.r === n2.r)
    );
    return shared.length >= 2;
  });
}

/** Shared pitch classes between two triangles. */
function _sharedPcs(t1, t2) {
  return t1.pcs.filter(pc => t2.pcs.includes(pc));
}

// ════════════════════════════════════════════════════════════════════
// SVG TONNETZ BUILDER
// ════════════════════════════════════════════════════════════════════

/**
 * Build an interactive SVG Tonnetz and mount it in container.
 *
 * @param {HTMLElement} container
 * @param {Object} [opts]
 * @param {number}   [opts.rows=4]         Number of q-rows  (q_min … q_min+rows−1)
 * @param {number}   [opts.cols=7]         Number of r-columns
 * @param {number}   [opts.qMin=-1]        Lowest q value shown (bottom row)
 * @param {number}   [opts.width=540]
 * @param {boolean}  [opts.showTriangles=true]
 * @param {Function} [opts.onNodeClick(name, pc, q, r)]
 * @param {Function} [opts.onTriadHover(chordName, pcs, quality, tri)]  null args = clear
 * @param {Function} [opts.onTriadClick(pcs, quality, rootPc, tri)]
 * @returns {{ svg, Q_MIN, nodeEl, nodePosAt, triangles, edges, clearHighlights }}
 */
function _buildTonnetz(container, opts = {}) {
  const rows = opts.rows ?? 4;
  const cols = opts.cols ?? 7;
  const W    = opts.width ?? 540;
  const nodeR = 18;
  const showTriangles = opts.showTriangles !== false;
  const padX = nodeR + 8;
  const padY = nodeR + 10;

  const Q_MIN = opts.qMin ?? -1;
  const Q_MAX = Q_MIN + rows - 1;

  // Grid geometry — same span formula as before, but the top rows lean RIGHT
  // (upper rows have higher x offset, matching reference: x increases with q)
  const colW = (W - 2 * padX) / (cols - 1 + (rows - 1) * 0.5);
  const rowH = colW * 0.866;
  const H = Math.ceil((rows - 1) * rowH + 2 * padY);

  function _x(q, r) { return padX + r * colW + (q - Q_MIN) * (colW / 2); }
  function _y(q)    { return padY + (Q_MAX - q) * rowH; }

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'tz-svg');
  svg.style.width = '100%';
  svg.style.maxWidth = `${W}px`;

  // Precompute node data: nodePos[qi][r]  where qi = q − Q_MIN
  const nodePos = [];
  for (let qi = 0; qi < rows; qi++) {
    nodePos[qi] = [];
    const q = Q_MIN + qi;
    for (let r = 0; r < cols; r++) {
      const pc = _pcAt(q, r);
      nodePos[qi][r] = { x: _x(q, r), y: _y(q), pc, name: _pcToName(pc), q, r };
    }
  }

  // SVG layer groups (edges → triangles → nodes)
  const gEdges = document.createElementNS(ns, 'g');
  gEdges.setAttribute('class', 'tz-edges');
  const gTris = document.createElementNS(ns, 'g');
  gTris.setAttribute('class', 'tz-tris');
  const gNodes = document.createElementNS(ns, 'g');
  gNodes.setAttribute('class', 'tz-nodes');

  if (!showTriangles) gTris.style.display = 'none';

  svg.appendChild(gEdges);
  svg.appendChild(gTris);
  svg.appendChild(gNodes);

  // ── Edges ──────────────────────────────────────────────────────────
  // 'h'  = horizontal  = M3 (+4)   → right
  // 'dr' = diagonal    = P5 (+7)   → up-right
  // 'dl' = cross-diag  = m3 (+3)   → up-left
  const edges = [];

  function _addEdge(q1, r1, q2, r2, type) {
    const p1 = nodePos[q1 - Q_MIN][r1];
    const p2 = nodePos[q2 - Q_MIN][r2];
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
    line.setAttribute('class', `tz-edge tz-edge--${type}`);
    gEdges.appendChild(line);
    edges.push({ q1, r1, q2, r2, type, el: line });
  }

  for (let qi = 0; qi < rows; qi++) {
    const q = Q_MIN + qi;
    for (let r = 0; r < cols; r++) {
      if (r + 1 < cols)                  _addEdge(q, r,     q,     r + 1, 'h');
      if (qi + 1 < rows)                 _addEdge(q, r,     q + 1, r,     'dr');
      if (qi + 1 < rows && r + 1 < cols) _addEdge(q, r + 1, q + 1, r,     'dl');
    }
  }

  // ── Triangles ──────────────────────────────────────────────────────
  // Upward  △ (major): (q,r),(q,r+1),(q+1,r)       root = PC(q,r)
  // Downward ▽ (minor): (q,r+1),(q+1,r),(q+1,r+1)  root = PC(q,r+1)
  const triangles = [];

  for (let qi = 0; qi < rows - 1; qi++) {
    const q = Q_MIN + qi;
    for (let r = 0; r < cols - 1; r++) {
      // Upward △ — major
      {
        const ns_ = [{ q, r }, { q, r: r + 1 }, { q: q + 1, r }];
        const pcs = ns_.map(n => _pcAt(n.q, n.r));
        const pts = ns_.map(n => `${nodePos[n.q - Q_MIN][n.r].x},${nodePos[n.q - Q_MIN][n.r].y}`).join(' ');
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'tz-tri tz-tri--major');
        gTris.appendChild(poly);
        // pcs[0]=root, pcs[1]=M3, pcs[2]=P5
        triangles.push({ q, r, type: 'up', pcs, nodes: ns_, el: poly, rootPc: pcs[0], quality: 'major' });
      }
      // Downward ▽ — minor
      {
        const ns_ = [{ q, r: r + 1 }, { q: q + 1, r }, { q: q + 1, r: r + 1 }];
        const pcs = ns_.map(n => _pcAt(n.q, n.r));
        const pts = ns_.map(n => `${nodePos[n.q - Q_MIN][n.r].x},${nodePos[n.q - Q_MIN][n.r].y}`).join(' ');
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'tz-tri tz-tri--minor');
        gTris.appendChild(poly);
        // pcs[0]=root (m3 above that is pcs[1]), pcs[2]=P5
        triangles.push({ q, r, type: 'dn', pcs, nodes: ns_, el: poly, rootPc: pcs[0], quality: 'minor' });
      }
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────
  // nodeEls[qi][r]  where qi = q − Q_MIN
  const nodeEls = [];
  for (let qi = 0; qi < rows; qi++) {
    nodeEls[qi] = [];
    const q = Q_MIN + qi;
    for (let r = 0; r < cols; r++) {
      const { x, y, pc, name } = nodePos[qi][r];

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'tz-node');
      g.style.cursor = 'pointer';

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', x); circle.setAttribute('cy', y);
      circle.setAttribute('r', nodeR);
      circle.setAttribute('class', 'tz-node__circle');

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', x); txt.setAttribute('y', y);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('class', 'tz-node__label');
      txt.textContent = name;

      g.appendChild(circle);
      g.appendChild(txt);
      gNodes.appendChild(g);
      nodeEls[qi][r] = { g, circle, txt, pc, name, q, r };

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        ensureTone(); ensureSampler();
        playSamplerNote(`${toAscii(name)}4`, '4n');
        if (opts.onNodeClick) opts.onNodeClick(name, pc, q, r);
      });
      g.addEventListener('mouseenter', () => g.classList.add('tz-node--hover'));
      g.addEventListener('mouseleave', () => g.classList.remove('tz-node--hover'));
    }
  }

  // ── Triangle interactions ───────────────────────────────────────────
  if (showTriangles) {
    triangles.forEach(tri => {
      const { quality, rootPc, pcs } = tri;
      const cName = `${_pcToName(rootPc)} ${quality === 'major' ? 'Major' : 'Minor'}`;
      tri.el.style.cursor = 'pointer';

      tri.el.addEventListener('mouseenter', () => {
        tri.el.classList.add('tz-tri--hover');
        tri.nodes.forEach(({ q, r }) => nodeEls[q - Q_MIN][r].g.classList.add('tz-node--tri-hover'));
        if (opts.onTriadHover) opts.onTriadHover(cName, pcs, quality, tri);
      });
      tri.el.addEventListener('mouseleave', () => {
        tri.el.classList.remove('tz-tri--hover');
        tri.nodes.forEach(({ q, r }) => nodeEls[q - Q_MIN][r].g.classList.remove('tz-node--tri-hover'));
        if (opts.onTriadHover) opts.onTriadHover(null, null, null, null);
      });
      tri.el.addEventListener('click', (e) => {
        e.stopPropagation();
        ensureTone(); ensureSampler();
        _playPcs(pcs);
        if (opts.onTriadClick) opts.onTriadClick(pcs, quality, rootPc, tri);
      });
    });
  }

  container.appendChild(svg);

  function clearHighlights() {
    [
      'tz-node--active', 'tz-node--minor-hl', 'tz-node--neighbor',
      'tz-node--shared', 'tz-node--path', 'tz-node--path-dim', 'tz-node--tri-hover',
    ].forEach(cls => svg.querySelectorAll('.' + cls).forEach(el => el.classList.remove(cls)));
    [
      'tz-tri--active', 'tz-tri--hover', 'tz-tri--neighbor', 'tz-tri--path', 'tz-tri--trail',
    ].forEach(cls => svg.querySelectorAll('.' + cls).forEach(el => el.classList.remove(cls)));
    svg.querySelectorAll('.tz-edge--active').forEach(el => el.classList.remove('tz-edge--active'));
  }

  return {
    svg,
    Q_MIN,
    /** Get a node element by lattice (q, r). */
    nodeEl: (q, r) => nodeEls[q - Q_MIN][r],
    /** Get node position data by lattice (q, r). */
    nodePosAt: (q, r) => nodePos[q - Q_MIN][r],
    triangles,
    edges,
    clearHighlights,
  };
}

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════

const CH4_CSS = /* css */ `

/* ── Tonnetz wrapper ────────────────────────────────────── */

.ch4-tz-wrap {
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 4px 0;
}

/* ── Edges ──────────────────────────────────────────────── */

.tz-edge {
  stroke: var(--color-border, #dfe6e9);
  stroke-width: 1.5;
  opacity: 0.35;
  pointer-events: none;
  transition: stroke 0.15s, opacity 0.15s, stroke-width 0.15s;
}
.tz-edge--active {
  stroke: var(--color-primary, #6c5ce7);
  opacity: 0.85;
  stroke-width: 2.5;
}

/* ── Triangles ──────────────────────────────────────────── */

.tz-tri {
  opacity: 0.08;
  transition: opacity 0.15s;
  pointer-events: all;
}
.tz-tri--major    { fill: var(--color-primary, #6c5ce7); }
.tz-tri--minor    { fill: var(--color-secondary, #00cec9); }
.tz-tri--hover    { opacity: 0.28; }
.tz-tri--active   { opacity: 0.38; }
.tz-tri--neighbor { opacity: 0.18; }
.tz-tri--path     { opacity: 0.48; }
.tz-tri--trail    { opacity: 0.2; }

/* ── Nodes ──────────────────────────────────────────────── */

.tz-node__circle {
  fill: var(--bg-secondary, #f0f0f5);
  stroke: var(--color-border, #dfe6e9);
  stroke-width: 1.5;
  transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;
}
.tz-node__label {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-primary, #2d3436);
  pointer-events: none;
  transition: fill 0.15s;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}
.tz-node--hover .tz-node__circle {
  stroke: var(--color-primary, #6c5ce7);
  stroke-width: 2.5;
}
.tz-node--tri-hover .tz-node__circle {
  stroke: var(--color-primary, #6c5ce7);
  stroke-width: 2;
}
.tz-node--active .tz-node__circle {
  fill: var(--color-primary, #6c5ce7);
  stroke: var(--color-primary, #6c5ce7);
}
.tz-node--active .tz-node__label { fill: #fff; }
.tz-node--minor-hl .tz-node__circle {
  fill: var(--color-secondary, #00cec9);
  stroke: var(--color-secondary, #00cec9);
}
.tz-node--minor-hl .tz-node__label { fill: #fff; }
.tz-node--neighbor .tz-node__circle {
  fill: color-mix(in srgb, var(--color-primary, #6c5ce7) 16%, var(--bg-secondary, #f0f0f5));
  stroke: var(--color-primary, #6c5ce7);
  stroke-width: 2;
}
.tz-node--shared .tz-node__circle {
  fill: var(--color-accent, #fdcb6e);
  stroke: var(--color-accent-dark, #f39c12);
  stroke-width: 2.5;
}
.tz-node--path .tz-node__circle {
  fill: var(--color-primary, #6c5ce7);
  stroke: var(--color-primary, #6c5ce7);
}
.tz-node--path .tz-node__label { fill: #fff; }
.tz-node--path-dim .tz-node__circle {
  fill: color-mix(in srgb, var(--color-primary, #6c5ce7) 30%, var(--bg-secondary, #f0f0f5));
  stroke: var(--color-primary, #6c5ce7);
}

/* ── Info display ───────────────────────────────────────── */

.ch4-info {
  min-height: 2.4em;
  text-align: center;
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text-primary, #2d3436);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
}

/* ── Legend ─────────────────────────────────────────────── */

.ch4-legend {
  font-size: 0.78rem;
  color: var(--text-secondary, #636e72);
  font-weight: 600;
  text-align: center;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}

/* ── Progression cards ──────────────────────────────────── */

.ch4-prog-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}
.ch4-prog-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 20px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 12px;
  background: var(--bg-secondary, #f0f0f5);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  user-select: none;
  min-width: 160px;
}
.ch4-prog-card:hover {
  border-color: var(--color-primary, #6c5ce7);
  transform: translateY(-2px);
}
.ch4-prog-card--active {
  border-color: var(--color-primary, #6c5ce7);
  background: color-mix(in srgb, var(--color-primary, #6c5ce7) 8%, var(--bg-secondary, #f0f0f5));
  box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
}
.ch4-prog-card__label {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
  letter-spacing: 0.04em;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}
.ch4-prog-card--active .ch4-prog-card__label { color: var(--color-primary, #6c5ce7); }
.ch4-prog-card__subtitle {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted, #b2bec3);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}

/* ── Controls row ───────────────────────────────────────── */

.ch4-ctrl-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.ch4-key-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary, #636e72);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
}
.ch4-key-label select {
  padding: 5px 10px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 6px;
  background: var(--bg-secondary, #f0f0f5);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  color: var(--text-primary, #2d3436);
}
.ch4-replay-btn {
  padding: 7px 18px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-family: var(--font-main, 'Nunito', system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  color: var(--text-primary, #2d3436);
}
.ch4-replay-btn:hover:not(:disabled) { border-color: var(--color-primary, #6c5ce7); }
.ch4-replay-btn:disabled { opacity: 0.38; cursor: default; }

/* ── Interactive border ─────────────────────────────────── */

.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch4-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch4-styles';
  el.textContent = CH4_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

const _mounted = new Set();

// Section 1
let _s1Tz = null;

// Section 2
let _s2Tz = null;
let _s2ClickCount = 0;

// Section 3
let _s3Tz = null;
let _s3ActiveTri = null;

// Section 4
let _s4Tz = null;
let _s4Timers = [];
let _s4ActiveProgIdx = -1;
let _s4RootPc = 0;
let _s4ProgCards = [];
let _s4InfoEl = null;
let _s4KeySelect = null;
let _s4ReplayBtn = null;

// ════════════════════════════════════════════════════════════════════
// SECTION 1: NOTES HAVE NEIGHBORS
// ════════════════════════════════════════════════════════════════════

function _mountS1(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  const info = document.createElement('div');
  info.className = 'ch4-info';
  info.textContent = 'Click any note to hear it and see its connections';
  widget.appendChild(info);

  const tzWrap = document.createElement('div');
  tzWrap.className = 'ch4-tz-wrap';
  widget.appendChild(tzWrap);

  ensureSampler();
  // 3 rows (q = −1..1), 5 cols — small grid for exploring note neighbors
  _s1Tz = _buildTonnetz(tzWrap, {
    rows: 3,
    cols: 5,
    qMin: -1,
    width: 460,
    showTriangles: false,
    onNodeClick(name, _pc, q, r) {
      _s1Tz.clearHighlights();
      _s1Tz.nodeEl(q, r).g.classList.add('tz-node--active');

      const parts = [];
      _s1Tz.edges.forEach(edge => {
        const isN1 = edge.q1 === q && edge.r1 === r;
        const isN2 = edge.q2 === q && edge.r2 === r;
        if (!isN1 && !isN2) return;
        edge.el.classList.add('tz-edge--active');
        const nq = isN1 ? edge.q2 : edge.q1;
        const nr = isN1 ? edge.r2 : edge.r1;
        _s1Tz.nodeEl(nq, nr).g.classList.add('tz-node--neighbor');
        // In the correct orientation: 'h'=M3, 'dr'=P5, 'dl'=m3
        const intv = edge.type === 'h' ? 'M3' : edge.type === 'dr' ? 'P5' : 'm3';
        parts.push(`${_s1Tz.nodePosAt(nq, nr).name} (${intv})`);
      });

      info.textContent = parts.length
        ? `${name} → ${parts.join(', ')}`
        : name;
    },
  });

  const legend = document.createElement('div');
  legend.className = 'ch4-legend';
  // Horizontal = M3, up-right diagonal = P5, up-left diagonal = m3
  legend.innerHTML = '→ major third &nbsp;&nbsp;&nbsp; ↗ perfect fifth &nbsp;&nbsp;&nbsp; ↖ minor third';
  widget.appendChild(legend);
}

// ════════════════════════════════════════════════════════════════════
// SECTION 2: TRIANGLES ARE CHORDS
// ════════════════════════════════════════════════════════════════════

function _mountS2(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  const info = document.createElement('div');
  info.className = 'ch4-info';
  info.textContent = 'Hover a triangle to preview a chord · Click to play it';
  widget.appendChild(info);

  const tzWrap = document.createElement('div');
  tzWrap.className = 'ch4-tz-wrap';
  widget.appendChild(tzWrap);

  ensureSampler();
  _s2ClickCount = 0;
  // 4 rows (q = −1..2), 7 cols — full grid
  _s2Tz = _buildTonnetz(tzWrap, {
    rows: 4,
    cols: 7,
    qMin: -1,
    width: 540,
    showTriangles: true,
    onTriadHover(chordName) {
      if (chordName) {
        info.textContent = `${chordName} — click to play`;
      } else if (_s2ClickCount === 0) {
        info.textContent = 'Hover a triangle to preview a chord · Click to play it';
      }
    },
    onTriadClick(pcs, quality, rootPc, tri) {
      _s2Tz.clearHighlights();
      tri.el.classList.add('tz-tri--active');
      tri.nodes.forEach(({ q, r }) => {
        _s2Tz.nodeEl(q, r).g.classList.add(
          quality === 'major' ? 'tz-node--active' : 'tz-node--minor-hl'
        );
      });
      const cName = `${_pcToName(rootPc)} ${quality === 'major' ? 'Major' : 'Minor'}`;
      _s2ClickCount++;
      if (_s2ClickCount >= 3) {
        // After a few clicks, reveal the shape legend
        info.innerHTML = `${cName} &nbsp;&mdash;&nbsp; <span style="opacity:0.55;font-weight:600">△ = major &nbsp;&nbsp; ▽ = minor</span>`;
      } else {
        info.textContent = cName;
      }
    },
  });
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: SHARED NOTES, SMOOTH MOVES
// ════════════════════════════════════════════════════════════════════

function _mountS3(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  const info = document.createElement('div');
  info.className = 'ch4-info';
  info.textContent = 'Click any chord to see which neighbors share its notes';
  widget.appendChild(info);

  const tzWrap = document.createElement('div');
  tzWrap.className = 'ch4-tz-wrap';
  widget.appendChild(tzWrap);

  ensureSampler();
  _s3ActiveTri = null;
  _s3Tz = _buildTonnetz(tzWrap, {
    rows: 4,
    cols: 7,
    qMin: -1,
    width: 540,
    showTriangles: true,
    onTriadHover(chordName, _pcs, _quality, _tri) {
      if (chordName && !_s3ActiveTri) {
        info.textContent = `${chordName} — click to explore neighbors`;
      }
    },
    onTriadClick(pcs, quality, rootPc, tri) {
      _s3Tz.clearHighlights();
      _s3ActiveTri = tri;

      tri.el.classList.add('tz-tri--active');
      tri.nodes.forEach(({ q, r }) => {
        _s3Tz.nodeEl(q, r).g.classList.add(
          quality === 'major' ? 'tz-node--active' : 'tz-node--minor-hl'
        );
      });

      const cName = `${_pcToName(rootPc)} ${quality === 'major' ? 'Major' : 'Minor'}`;
      const neighbors = _adjTris(tri, _s3Tz.triangles);

      let infoText = cName;
      neighbors.forEach((nbr, i) => {
        nbr.el.classList.add('tz-tri--neighbor');
        const shared = _sharedPcs(tri, nbr);
        if (i === 0 && shared.length > 0) {
          const nbrName = `${_pcToName(nbr.rootPc)} ${nbr.quality === 'major' ? 'Major' : 'Minor'}`;
          infoText = `${cName} → ${nbrName}: share ${shared.map(_pcToName).join(', ')}`;
        }
        // Highlight shared nodes (from the active triangle) with a ring
        shared.forEach(shPc => {
          tri.nodes.forEach(({ q, r }) => {
            if (_s3Tz.nodePosAt(q, r).pc === shPc) {
              _s3Tz.nodeEl(q, r).g.classList.add('tz-node--shared');
            }
          });
        });
      });

      info.textContent = infoText;
    },
  });
}

// ════════════════════════════════════════════════════════════════════
// SECTION 4: YOUR PROGRESSIONS ON THE MAP
// ════════════════════════════════════════════════════════════════════

function _mountS4(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';
  host.appendChild(widget);

  _s4InfoEl = document.createElement('div');
  _s4InfoEl.className = 'ch4-info';
  _s4InfoEl.textContent = 'Pick a progression to see it on the map';
  widget.appendChild(_s4InfoEl);

  const tzWrap = document.createElement('div');
  tzWrap.className = 'ch4-tz-wrap';
  widget.appendChild(tzWrap);

  ensureSampler();
  _s4RootPc = 0;
  _s4Tz = _buildTonnetz(tzWrap, {
    rows: 4,
    cols: 7,
    qMin: -1,
    width: 540,
    showTriangles: true,
  });

  // Progression cards
  const progRow = document.createElement('div');
  progRow.className = 'ch4-prog-row';
  widget.appendChild(progRow);

  _s4ProgCards = [];
  PROGRESSIONS.forEach((prog, idx) => {
    const card = document.createElement('div');
    card.className = 'ch4-prog-card';
    const labelEl = document.createElement('div');
    labelEl.className = 'ch4-prog-card__label';
    labelEl.textContent = prog.label;
    const subEl = document.createElement('div');
    subEl.className = 'ch4-prog-card__subtitle';
    subEl.textContent = prog.subtitle;
    card.appendChild(labelEl);
    card.appendChild(subEl);
    card.addEventListener('click', () => {
      ensureTone(); ensureSampler();
      _s4PlayProgression(idx);
    });
    progRow.appendChild(card);
    _s4ProgCards.push(card);
  });

  // Controls: key selector + replay button
  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'ch4-ctrl-row';
  widget.appendChild(ctrlRow);

  const keyLabel = document.createElement('label');
  keyLabel.className = 'ch4-key-label';
  keyLabel.textContent = 'Key: ';
  _s4KeySelect = document.createElement('select');
  CHROMATIC.forEach(note => {
    const opt = document.createElement('option');
    opt.value = note.pc;
    opt.textContent = note.name;
    if (note.pc === 0) opt.selected = true;
    _s4KeySelect.appendChild(opt);
  });
  _s4KeySelect.addEventListener('change', () => {
    _s4RootPc = parseInt(_s4KeySelect.value);
    if (_s4ActiveProgIdx >= 0) {
      _cancelTimers(_s4Timers);
      _s4Tz.clearHighlights();
      _s4PlayProgression(_s4ActiveProgIdx);
    }
  });
  keyLabel.appendChild(_s4KeySelect);
  ctrlRow.appendChild(keyLabel);

  _s4ReplayBtn = document.createElement('button');
  _s4ReplayBtn.className = 'ch4-replay-btn';
  _s4ReplayBtn.textContent = 'Play again';
  _s4ReplayBtn.disabled = true;
  _s4ReplayBtn.addEventListener('click', () => {
    if (_s4ActiveProgIdx >= 0) {
      ensureTone(); ensureSampler();
      _cancelTimers(_s4Timers);
      _s4Tz.clearHighlights();
      _s4PlayProgression(_s4ActiveProgIdx);
    }
  });
  ctrlRow.appendChild(_s4ReplayBtn);
}

function _s4PlayProgression(idx) {
  _cancelTimers(_s4Timers);
  _s4Tz.clearHighlights();

  _s4ActiveProgIdx = idx;
  _s4ProgCards.forEach((card, i) =>
    card.classList.toggle('ch4-prog-card--active', i === idx)
  );
  if (_s4ReplayBtn) _s4ReplayBtn.disabled = true;

  const prog = PROGRESSIONS[idx];
  const scale = buildScale(_s4RootPc, MAJOR_PATTERN);

  const chords = prog.degrees.map(deg => {
    const pcs = buildTriad(scale, deg);
    return { pcs, tri: _findTri(_s4Tz.triangles, pcs), label: _chordLabel(pcs) };
  });

  chords.forEach(({ pcs, tri, label }, step) => {
    _s4Timers.push(setTimeout(() => {
      // Demote previous active highlight to trail
      _s4Tz.svg.querySelectorAll('.tz-tri--path').forEach(el => {
        el.classList.remove('tz-tri--path');
        el.classList.add('tz-tri--trail');
      });
      _s4Tz.svg.querySelectorAll('.tz-node--path').forEach(el => {
        el.classList.remove('tz-node--path');
        el.classList.add('tz-node--path-dim');
      });

      if (tri) {
        tri.el.classList.remove('tz-tri--trail');
        tri.el.classList.add('tz-tri--path');
        tri.nodes.forEach(({ q, r }) => {
          _s4Tz.nodeEl(q, r).g.classList.remove('tz-node--path-dim');
          _s4Tz.nodeEl(q, r).g.classList.add('tz-node--path');
        });
      }

      _playPcs(pcs);
      if (_s4InfoEl) _s4InfoEl.textContent = label;
    }, step * 1200));
  });

  // After sequence: show replay prompt
  _s4Timers.push(setTimeout(() => {
    if (_s4InfoEl) _s4InfoEl.textContent = `${prog.label} — click to replay`;
    if (_s4ReplayBtn) _s4ReplayBtn.disabled = false;
  }, chords.length * 1200 + 400));
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════

registerCleanup(() => {
  _cancelTimers(_s4Timers);
});

// ════════════════════════════════════════════════════════════════════
// SECTIONS EXPORT
// ════════════════════════════════════════════════════════════════════

export const sections = [
  {
    id: 'ch4-notes-have-neighbors',
    title: 'Notes Have Neighbors',
    narration:
      "Every note has neighbors — notes that sound good with it. C and G are a perfect fifth apart. " +
      "C and E are a major third. These aren't random — they're the intervals you already know. " +
      "What if we drew a map that put every note next to its closest harmonic neighbors?",
    interactive: 'tonnetz-neighbors',
    tryIt: "Click any note, then click its neighbor. Every connection is an interval you've already heard.",
    onActivate(sectionEl) {
      if (_mounted.has('ch4-notes-have-neighbors')) return;
      _mounted.add('ch4-notes-have-neighbors');
      _mountS1(sectionEl);
    },
    onEnter(_sectionEl) {
      if (_s1Tz) _s1Tz.clearHighlights();
    },
    onLeave(_sectionEl) {
      if (_s1Tz) _s1Tz.clearHighlights();
    },
  },
  {
    id: 'ch4-triangles-are-chords',
    title: 'Triangles Are Chords',
    narration:
      "Now here's the magic. Pick any three connected notes that form a triangle — they're a chord. " +
      "The entire map is made of chords, tessellated edge to edge. " +
      "You're looking at every triad in music, all at once.",
    interactive: 'tonnetz-triangles',
    tryIt: "Click the triangles. Every one is a chord you already know from Chapter 3.",
    onActivate(sectionEl) {
      if (_mounted.has('ch4-triangles-are-chords')) return;
      _mounted.add('ch4-triangles-are-chords');
      _mountS2(sectionEl);
    },
    onEnter(_sectionEl) {
      if (_s2Tz) { _s2Tz.clearHighlights(); _s2ClickCount = 0; }
    },
    onLeave(_sectionEl) {
      if (_s2Tz) _s2Tz.clearHighlights();
    },
  },
  {
    id: 'ch4-shared-notes',
    title: 'Shared Notes, Smooth Moves',
    narration:
      "Look at any two triangles that share an edge. They have two notes in common. " +
      "C major and A minor share C and E. C major and E minor share E and G. " +
      "When chords share notes, moving between them sounds smooth. " +
      "That's why certain progressions feel natural — the Tonnetz shows you which chords are just one step apart.",
    interactive: 'tonnetz-shared',
    tryIt: "Click a chord, then click a neighbor. Hear how smooth the connection is? Those shared notes are the glue.",
    onActivate(sectionEl) {
      if (_mounted.has('ch4-shared-notes')) return;
      _mounted.add('ch4-shared-notes');
      _mountS3(sectionEl);
    },
    onEnter(_sectionEl) {
      if (_s3Tz) { _s3Tz.clearHighlights(); _s3ActiveTri = null; }
    },
    onLeave(_sectionEl) {
      if (_s3Tz) { _s3Tz.clearHighlights(); _s3ActiveTri = null; }
    },
  },
  {
    id: 'ch4-progressions-on-map',
    title: 'Your Progressions on the Map',
    narration:
      "Remember those chord progressions from Chapter 3? Let's see them on the Tonnetz. " +
      "Watch how each progression traces a path across the map — some stay close, some take wider journeys. " +
      "The Tonnetz makes the hidden logic of music visible.",
    interactive: 'tonnetz-progressions',
    tryIt: "Pick a progression and watch it move across the map. This is the geography of music.",
    gameLink: {
      game: 'harmony-trainer',
      label: 'Explore the Tonnetz yourself →',
      url: '/harmony',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch4-progressions-on-map')) return;
      _mounted.add('ch4-progressions-on-map');
      _mountS4(sectionEl);
    },
    onEnter(_sectionEl) {
      _cancelTimers(_s4Timers);
      if (_s4Tz) _s4Tz.clearHighlights();
      _s4ActiveProgIdx = -1;
      if (_s4ProgCards) _s4ProgCards.forEach(c => c.classList.remove('ch4-prog-card--active'));
      if (_s4InfoEl) _s4InfoEl.textContent = 'Pick a progression to see it on the map';
      if (_s4ReplayBtn) _s4ReplayBtn.disabled = true;
    },
    onLeave(_sectionEl) {
      _cancelTimers(_s4Timers);
      if (_s4Tz) _s4Tz.clearHighlights();
    },
  },
];
