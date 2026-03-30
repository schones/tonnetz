/**
 * tonnetz-neighborhood.js
 * =======================
 * SVG renderer for a focused Tonnetz neighborhood.
 * Subscribes to HarmonyState and re-renders on state changes.
 *
 * Pure rendering module — game logic lives elsewhere.
 *
 * Consumed by:
 *   - relative_key_trainer  → main Tonnetz visualization
 *   - harmony_trainer       → optional Tonnetz panel
 *   - integration test page → linked component demo
 *
 * Depends on:
 *   - transforms.js   → noteToPC, pcToNote, triadPCs, getNeighbors,
 *                        analyzeTransform, TRANSFORMS
 *   - harmony-state.js → HarmonyState
 *
 * Exposes: window.TonnetzNeighborhood
 */

import {
  noteToPC,
  pcToNote,
  triadPCs,
  getNeighbors,
  analyzeTransform,
  TRANSFORMS,
} from './transforms.js';

import { HarmonyState } from './harmony-state.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const H = 100;            // horizontal spacing (M3 axis), px
const V = 87;             // vertical spacing (≈ H × sin 60°), px
const NODE_R = 20;        // node circle radius
const FONT_SIZE = 12;     // note-name font size
const PAD = 80;           // viewBox padding around outermost nodes
const SVG_NS = 'http://www.w3.org/2000/svg';
const RECENTER_MS = 400;  // slide animation duration

// ════════════════════════════════════════════════════════════════════
// CSS
// ════════════════════════════════════════════════════════════════════
//
// Tonnetz-specific custom properties (set on a parent element or :root):
//   --tonnetz-node-fill, --tonnetz-node-stroke,
//   --tonnetz-edge-stroke, --tonnetz-triangle-primary,
//   --tonnetz-triangle-secondary, --tonnetz-triangle-ghost,
//   --tonnetz-label-color, --tonnetz-accent
//
// Falls back to the platform's existing CSS vars where possible.

const TONNETZ_CSS = /* css */ `

/* ── SVG container ────────────────────────────────────────── */

.tonnetz-svg {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
  font-family: system-ui, -apple-system, sans-serif;
}

/* ── Edges ────────────────────────────────────────────────── */

.tn-edge {
  stroke: var(--tonnetz-edge-stroke, var(--border, #bbb));
  stroke-width: 1.5;
  opacity: 0.3;
}

/* ── Triangle fills ───────────────────────────────────────── */

.tn-tri {
  opacity: 0;
  fill: transparent;
  transition: opacity 0.3s, fill 0.3s;
  pointer-events: all;
  cursor: default;
}
.tn-tri--primary {
  fill: var(--tonnetz-triangle-primary, var(--tonnetz-accent, var(--accent, #6c63ff)));
  opacity: 0.35;
}
.tn-tri--secondary {
  fill: var(--tonnetz-triangle-secondary, #a29bfe);
  opacity: 0.22;
}
.tn-tri--ghost {
  fill: none;
  stroke: var(--tonnetz-triangle-ghost, rgba(162, 155, 254, 0.5));
  stroke-width: 2;
  stroke-dasharray: 8 5;
  opacity: 0.5;
}
.tn-tri--target {
  fill: none;
  stroke: var(--tonnetz-accent, var(--accent, #6c63ff));
  stroke-width: 2.5;
  opacity: 0.7;
  animation: tn-pulse 1.2s ease-in-out infinite;
}
.tn-tri--correct {
  fill: #22c55e;
  opacity: 0.5;
  animation: tn-flash 0.5s ease-out forwards;
}
.tn-tri--incorrect {
  fill: #ef4444;
  opacity: 0.5;
  animation: tn-flash 0.5s ease-out forwards;
}
.tn-tri--interactive {
  cursor: pointer;
}
.tn-tri--interactive:hover {
  opacity: 0.18;
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
}

/* ── Nodes ────────────────────────────────────────────────── */

.tn-node circle {
  fill: var(--tonnetz-node-fill, var(--bg-card, #e0e0e0));
  stroke: var(--tonnetz-node-stroke, var(--border, #999));
  stroke-width: 1.5;
  transition: fill 0.25s, stroke 0.25s;
}
.tn-node--active circle {
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
  stroke: var(--tonnetz-accent, var(--accent, #6c63ff));
}
.tn-node--ghost circle {
  stroke-dasharray: 3 2;
  opacity: 0.5;
}
.tn-node--interval circle {
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
  stroke: var(--tonnetz-accent, var(--accent, #6c63ff));
}
.tn-node-label {
  fill: var(--tonnetz-label-color, var(--text-primary, #333));
  font-size: ${FONT_SIZE}px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.tn-node--active .tn-node-label,
.tn-node--interval .tn-node-label {
  fill: #fff;
}

/* ── Transform arrows ─────────────────────────────────────── */

.tn-arrow {
  fill: none;
  stroke: var(--tonnetz-accent, var(--accent, #6c63ff));
  stroke-width: 2;
  opacity: 0.55;
}
.tn-arrow--active {
  opacity: 1;
  stroke-width: 2.5;
}
.tn-arrow-label {
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
  font-size: 11px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  cursor: default;
}

/* ── Interval edges ───────────────────────────────────────── */

.tn-interval-edge {
  stroke: var(--tonnetz-accent, var(--accent, #6c63ff));
  stroke-width: 4;
  opacity: 0.7;
  stroke-linecap: round;
}
.tn-interval-label {
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
  font-size: 11px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}

/* ── Common-tone / moving-tone markers ────────────────────── */

.tn-common-dot {
  fill: #4A90D9;
  stroke: #fff;
  stroke-width: 1.5;
}
.tn-moving-arrow {
  stroke: #E8913A;
  stroke-width: 2.5;
  fill: none;
}
.tn-node--moving-tone circle {
  fill: #E8913A;
  stroke: #E8913A;
  animation: tn-mt-pulse 1s ease-in-out infinite;
}
.tn-node--moving-tone .tn-node-label {
  fill: #fff;
}
.tn-moving-label {
  fill: #E8913A;
  font-size: 10px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}

/* ── Chord labels ─────────────────────────────────────────── */

.tn-chord-label {
  fill: var(--tonnetz-label-color, var(--text-primary, #333));
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.tn-chord-label--primary {
  font-size: 15px;
  font-weight: 800;
}
.tn-chord-label--ghost {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.5;
  font-style: italic;
}
.tn-chord-label-bg {
  rx: 4;
  ry: 4;
  opacity: 0.75;
  fill: var(--tonnetz-node-fill, var(--bg-card, #fff));
  pointer-events: none;
}

/* ── Marker defs ──────────────────────────────────────────── */

#tn-arrowhead polygon {
  fill: var(--tonnetz-accent, var(--accent, #6c63ff));
}
#tn-moving-arrowhead polygon {
  fill: #E8913A;
}

/* ── Animations ───────────────────────────────────────────── */

@keyframes tn-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.85; }
}
@keyframes tn-flash {
  0%   { opacity: 0.6; }
  100% { opacity: 0; }
}

@keyframes tn-mt-pulse {
  0%, 100% { opacity: 0.75; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .tn-tri--target,
  .tn-tri--correct,
  .tn-tri--incorrect,
  .tn-node--moving-tone circle { animation: none; }
}

/* ── Chord quality coloring ───────────────────────────────────────
 * Applied alongside role classes.  Quality classes set fill color;
 * role classes control opacity.  The combined-selector rules below
 * override both fill and opacity for the active (primary) chord.
 * Ghost/target/correct/incorrect roles override quality fill to
 * preserve their existing visual semantics.
 * ──────────────────────────────────────────────────────────────── */

/* Inactive neighborhood triads: subtle quality tint */
.tn-tri--quality-major { fill: var(--tn-major-fill, #2563eb); opacity: 0.10; }
.tn-tri--quality-minor { fill: var(--tn-minor-fill, #e64a19); opacity: 0.10; }

/* Active (primary) chord: stronger fill + light stroke accent */
.tn-tri--primary.tn-tri--quality-major {
  fill: var(--tn-major-fill, #2563eb);
  opacity: 0.45;
  stroke: var(--tn-major-fill, #2563eb);
  stroke-width: 2;
}
.tn-tri--primary.tn-tri--quality-minor {
  fill: var(--tn-minor-fill, #e64a19);
  opacity: 0.45;
  stroke: var(--tn-minor-fill, #e64a19);
  stroke-width: 2;
}

/* Ghost: keep dashed-stroke appearance, suppress quality fill + restore opacity */
.tn-tri--ghost.tn-tri--quality-major,
.tn-tri--ghost.tn-tri--quality-minor { fill: none; opacity: 0.5; }

/* Target pulse: keep transparent fill + restore opacity for animation */
.tn-tri--target.tn-tri--quality-major,
.tn-tri--target.tn-tri--quality-minor { fill: none; opacity: 0.7; }

/* Feedback flash: restore game colors + opacity */
.tn-tri--correct.tn-tri--quality-major,
.tn-tri--correct.tn-tri--quality-minor  { fill: #22c55e; opacity: 0.5; }
.tn-tri--incorrect.tn-tri--quality-major,
.tn-tri--incorrect.tn-tri--quality-minor { fill: #ef4444; opacity: 0.5; }
`;

// ════════════════════════════════════════════════════════════════════
// LATTICE GEOMETRY
// ════════════════════════════════════════════════════════════════════
//
// Coordinate system  (q, r)  where
//   q = steps along the Perfect-Fifth axis
//   r = steps along the Major-Third axis
//   PC(q, r) = (7q + 4r) mod 12
//
// SVG mapping:
//   x = r × H  +  q × H/2      (M3 = horizontal, P5 = ~60° up-right)
//   y = −q × V                   (positive q = upward in SVG)
//
// Triangle types:
//   Upward  triangle at (tq, tr): nodes  (tq,tr) (tq,tr+1) (tq+1,tr)
//       → major triad:  root  M3  P5
//   Downward triangle at (tq, tr): nodes  (tq,tr+1) (tq+1,tr) (tq+1,tr+1)
//       → minor triad:  root  m3  P5

/** Convert lattice (q, r) → SVG pixel (x, y). */
function toSVG(q, r) {
  return {
    x: r * H + q * (H / 2),
    y: -q * V,
  };
}

/**
 * Node lattice positions for a triangle.
 * Returns 3 positions in triad order:
 *   upward  → [root, M3, P5]
 *   downward → [root, m3, P5]
 */
function triNodePos(isUp, tq, tr) {
  if (isUp) {
    return [
      { q: tq,     r: tr     },   // root
      { q: tq,     r: tr + 1 },   // major 3rd
      { q: tq + 1, r: tr     },   // perfect 5th
    ];
  }
  return [
    { q: tq,     r: tr + 1 },   // root
    { q: tq + 1, r: tr     },   // minor 3rd
    { q: tq + 1, r: tr + 1 },   // perfect 5th
  ];
}

/**
 * PLR-neighbor triangle positions.
 *
 * From major (upward) at (tq, tr):
 *   P → downward at (tq, tr−1)     shares root + P5
 *   L → downward at (tq, tr)       shares M3 + P5
 *   R → downward at (tq−1, tr)     shares root + M3
 *
 * From minor (downward) at (tq, tr):
 *   P → upward at (tq, tr+1)       shares root + P5
 *   L → upward at (tq, tr)         shares m3 + P5
 *   R → upward at (tq+1, tr)       shares root + m3
 */
function neighborTriPos(isUp, tq, tr) {
  if (isUp) {
    return {
      P: { isUp: false, tq,      tr: tr - 1 },
      L: { isUp: false, tq,      tr          },
      R: { isUp: false, tq: tq - 1, tr       },
    };
  }
  return {
    P: { isUp: true, tq,       tr: tr + 1 },
    L: { isUp: true, tq,       tr          },
    R: { isUp: true, tq: tq + 1, tr        },
  };
}

/** Centroid of a triangle in SVG coords. */
function triCentroid(isUp, tq, tr) {
  const ns = triNodePos(isUp, tq, tr);
  const ps = ns.map(n => toSVG(n.q, n.r));
  return {
    x: (ps[0].x + ps[1].x + ps[2].x) / 3,
    y: (ps[0].y + ps[1].y + ps[2].y) / 3,
  };
}

// ════════════════════════════════════════════════════════════════════
// COMPACT CLUSTER (Note Mode)
// ════════════════════════════════════════════════════════════════════

/**
 * For Note Mode, find the most spatially compact set of nodes — one per active
 * pitch class — so the Tonnetz shows one meaningful geometric shape instead of
 * scattering highlights across the whole grid.
 *
 * Algorithm (greedy nearest-neighbour):
 *   1. Compute the SVG centroid of all visible nodes (the "grid centre").
 *   2. For the first active PC, pick the node closest to the grid centre.
 *   3. For each subsequent PC, pick the node closest to the running centroid
 *      of already-selected nodes.
 *
 * @param {Set<number>}                              activePCs
 * @param {Map<string, {q:number, r:number, pc:number, note:string}>} nodes
 * @returns {Set<string>}  Set of "q,r" node keys forming the compact cluster.
 */
function _findCompactCluster(activePCs, nodes) {
  if (activePCs.size === 0) return new Set();

  // Index nodes by PC
  const byPC = new Map();
  for (const [key, node] of nodes) {
    if (!byPC.has(node.pc)) byPC.set(node.pc, []);
    byPC.get(node.pc).push({ key, q: node.q, r: node.r });
  }

  // Grid centroid in SVG coords
  let sumX = 0, sumY = 0, n = 0;
  for (const [, node] of nodes) {
    const p = toSVG(node.q, node.r);
    sumX += p.x; sumY += p.y; n++;
  }
  const gridCX = n > 0 ? sumX / n : 0;
  const gridCY = n > 0 ? sumY / n : 0;

  const selectedKeys = new Set();
  let selSumX = 0, selSumY = 0, selCount = 0;

  for (const pc of activePCs) {
    const candidates = byPC.get(pc);
    if (!candidates || candidates.length === 0) continue;

    const refX = selCount > 0 ? selSumX / selCount : gridCX;
    const refY = selCount > 0 ? selSumY / selCount : gridCY;

    let bestKey = null, bestX = 0, bestY = 0, bestDist = Infinity;
    for (const c of candidates) {
      const p = toSVG(c.q, c.r);
      const d = Math.hypot(p.x - refX, p.y - refY);
      if (d < bestDist) {
        bestDist = d; bestKey = c.key; bestX = p.x; bestY = p.y;
      }
    }

    if (bestKey !== null) {
      selectedKeys.add(bestKey);
      selSumX += bestX; selSumY += bestY; selCount++;
    }
  }

  return selectedKeys;
}

// ════════════════════════════════════════════════════════════════════
// NEIGHBORHOOD BUILDER
// ════════════════════════════════════════════════════════════════════

function _triKey(isUp, tq, tr) {
  return `${isUp ? 'u' : 'd'}_${tq}_${tr}`;
}

function _nodeKey(q, r) {
  return `${q},${r}`;
}

/**
 * Build the full neighborhood graph for a center triad and depth.
 *
 * @param {string} centerRoot   – note name (e.g. "C")
 * @param {string} centerQuality – "major" | "minor"
 * @param {number} depth         – 0 = center only, 1 = PLR neighbors, 2 = neighbors-of-neighbors
 * @returns {{ triads: Map, nodes: Map, edges: Set }}
 */
function buildNeighborhood(centerRoot, centerQuality, depth) {
  const triads = new Map();   // triKey → { root, quality, isUp, tq, tr, depth, nodes }
  const nodes  = new Map();   // "q,r"  → { q, r, pc, note }
  const edges  = new Set();   // "q1,r1|q2,r2" (sorted so each edge stored once)

  const isUp = centerQuality === 'major';
  const queue = [{ root: centerRoot, quality: centerQuality, isUp, tq: 0, tr: 0, d: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const item = queue.shift();
    const key = _triKey(item.isUp, item.tq, item.tr);
    if (visited.has(key)) continue;
    visited.add(key);

    // Pitch classes for this triad (from transforms.js)
    const pcs = triadPCs(item.root, item.quality);
    const positions = triNodePos(item.isUp, item.tq, item.tr);

    // Register nodes
    const triadNodes = positions.map((pos, i) => {
      const nk = _nodeKey(pos.q, pos.r);
      const pc = pcs[i];
      const note = pcToNote(pc);
      if (!nodes.has(nk)) {
        nodes.set(nk, { q: pos.q, r: pos.r, pc, note });
      }
      return { q: pos.q, r: pos.r, pc, note };
    });

    // Register edges (deduplicated)
    for (let i = 0; i < 3; i++) {
      const a = positions[i];
      const b = positions[(i + 1) % 3];
      const ek = [_nodeKey(a.q, a.r), _nodeKey(b.q, b.r)].sort().join('|');
      edges.add(ek);
    }

    triads.set(key, {
      root: item.root,
      quality: item.quality,
      isUp: item.isUp,
      tq: item.tq,
      tr: item.tr,
      depth: item.d,
      nodes: triadNodes,
    });

    // Expand PLR neighbors if within depth
    if (item.d < depth) {
      const nbrs    = getNeighbors(item.root, item.quality);
      const nbrPos  = neighborTriPos(item.isUp, item.tq, item.tr);
      for (const t of ['P', 'L', 'R']) {
        const nbr = nbrs[t];
        const pos = nbrPos[t];
        const nk  = _triKey(pos.isUp, pos.tq, pos.tr);
        if (!visited.has(nk)) {
          queue.push({
            root: nbr.root,
            quality: nbr.quality,
            isUp: pos.isUp,
            tq: pos.tq,
            tr: pos.tr,
            d: item.d + 1,
          });
        }
      }
    }
  }

  return { triads, nodes, edges };
}

// ════════════════════════════════════════════════════════════════════
// SVG HELPERS
// ════════════════════════════════════════════════════════════════════

function _svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
  }
  return el;
}

function _computeViewBox(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes.values()) {
    const { x, y } = toSVG(node.q, node.r);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return `${minX - PAD} ${minY - PAD} ${maxX - minX + 2 * PAD} ${maxY - minY + 2 * PAD}`;
}

// ════════════════════════════════════════════════════════════════════
// RENDERER
// ════════════════════════════════════════════════════════════════════

/**
 * Full render: wipe SVG children (except <defs>/<style>) and rebuild.
 */
function _renderAll(svg, neighborhood, state, opts) {
  if (!svg || !neighborhood) return;

  // Preserve <defs>, <style>, and external overlay groups (e.g. chord bubble)
  const defs     = svg.querySelector('defs');
  const style    = svg.querySelector('style');
  const overlays = Array.from(svg.querySelectorAll('.tn-chord-bubble-layer'));
  svg.textContent = '';               // clear children
  if (style) svg.appendChild(style);
  if (defs)  svg.appendChild(defs);

  const { triads, nodes, edges } = neighborhood;
  const ann = state.annotations || {};

  // ── Update viewBox ─────────────────────────────────────────────
  svg.setAttribute('viewBox', _computeViewBox(nodes));

  // ── Scene wrapper group ───────────────────────────────────────
  const gScene = _svgEl('g', { class: 'tn-scene' });

  // ── Classify active PCs ────────────────────────────────────────
  const activePCs   = new Set();
  const ghostPCs    = new Set();
  const intervalPCs = new Set();

  for (const t of (state.activeTriads || [])) {
    const pcs = triadPCs(t.root, t.quality);
    const set = t.role === 'ghost' ? ghostPCs : activePCs;
    pcs.forEach(pc => set.add(pc));
  }
  if (state.activeInterval) {
    state.activeInterval.notes.forEach(n => intervalPCs.add(noteToPC(n)));
  }
  // Note Mode: no triads, no interval — highlight individual toggled notes.
  // (activeNotes is also populated by setTriad/addTriad/setInterval, so only
  // use it as the primary source when those other modes are not active.)
  const isNoteMode = (state.activeTriads || []).length === 0 && !state.activeInterval;
  if (isNoteMode) {
    for (const an of (state.activeNotes || [])) {
      const pc = noteToPC(an.note);
      if (!isNaN(pc)) activePCs.add(pc);
    }
  }

  // In Note Mode, find the most compact cluster (one node per active PC) so the
  // Tonnetz shows a single tight geometric shape rather than all instances.
  const compactKeys = (isNoteMode && activePCs.size > 0)
    ? _findCompactCluster(activePCs, nodes)
    : null;

  // Role lookup: "pc_quality" → role
  const roleMap = new Map();
  for (const t of (state.activeTriads || [])) {
    roleMap.set(`${noteToPC(t.root)}_${t.quality}`, t.role);
  }

  // Rendering mode
  const hasTriads   = (state.activeTriads || []).length > 0;
  const hasInterval = state.activeInterval != null;
  const edgeMode    = hasInterval && !hasTriads;

  // ═══════════════════════════════════════════════════════════════
  // 1. EDGES
  // ═══════════════════════════════════════════════════════════════
  const gEdges = _svgEl('g', { class: 'tonnetz-edges' });
  for (const ek of edges) {
    const [nk1, nk2] = ek.split('|');
    const n1 = nodes.get(nk1);
    const n2 = nodes.get(nk2);
    const p1 = toSVG(n1.q, n1.r);
    const p2 = toSVG(n2.q, n2.r);
    gEdges.appendChild(_svgEl('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      class: 'tn-edge',
    }));
  }
  gScene.appendChild(gEdges);

  // ═══════════════════════════════════════════════════════════════
  // 2. TRIANGLE FILLS
  // ═══════════════════════════════════════════════════════════════
  const gTris = _svgEl('g', { class: 'tonnetz-triangles' });
  for (const [, triad] of triads) {
    const ps   = triad.nodes.map(n => toSVG(n.q, n.r));
    const pts  = ps.map(p => `${p.x},${p.y}`).join(' ');
    const role = roleMap.get(`${noteToPC(triad.root)}_${triad.quality}`);

    let cls = 'tn-tri';
    if      (role === 'primary')   cls += ' tn-tri--primary';
    else if (role === 'secondary') cls += ' tn-tri--secondary';
    else if (role === 'ghost')     cls += ' tn-tri--ghost';
    else if (role === 'target')    cls += ' tn-tri--target';
    else if (role === 'correct')   cls += ' tn-tri--correct';
    else if (role === 'incorrect') cls += ' tn-tri--incorrect';
    // Quality-based fill color (applied to all triads; CSS overrides per role above)
    if      (triad.quality === 'major') cls += ' tn-tri--quality-major';
    else if (triad.quality === 'minor') cls += ' tn-tri--quality-minor';
    if (opts.interactive) cls += ' tn-tri--interactive';

    const poly = _svgEl('polygon', { points: pts, class: cls });
    poly.dataset.root    = triad.root;
    poly.dataset.quality = triad.quality;

    if (opts.interactive && opts.onTriadClick) {
      poly.addEventListener('click', () => {
        opts.onTriadClick({ root: triad.root, quality: triad.quality });
      });
    }
    gTris.appendChild(poly);
  }
  gScene.appendChild(gTris);

  // ═══════════════════════════════════════════════════════════════
  // 3. TRANSFORM ARROWS
  // ═══════════════════════════════════════════════════════════════
  const showArrows = ann.showTransformLabels || state.activeTransform;
  if (showArrows && hasTriads) {
    const gArr = _svgEl('g', { class: 'tonnetz-transform-arrows' });

    // Find the depth-0 center triad
    let center = null;
    for (const [, t] of triads) {
      if (t.depth === 0) { center = t; break; }
    }

    if (center) {
      const cc   = triCentroid(center.isUp, center.tq, center.tr);
      const nPos = neighborTriPos(center.isUp, center.tq, center.tr);

      for (const t of ['P', 'L', 'R']) {
        const pos  = nPos[t];
        const nk   = _triKey(pos.isUp, pos.tq, pos.tr);
        if (!triads.has(nk)) continue;

        const isActive = state.activeTransform && state.activeTransform.type === t;
        if (!ann.showTransformLabels && !isActive) continue;

        const nc = triCentroid(pos.isUp, pos.tq, pos.tr);

        // Curved arrow (quadratic bezier) between centroids
        const mx  = (cc.x + nc.x) / 2;
        const my  = (cc.y + nc.y) / 2;
        const dx  = nc.x - cc.x;
        const dy  = nc.y - cc.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = 15;                    // perpendicular bow offset
        const cpx = mx + (-dy / len) * off;
        const cpy = my + ( dx / len) * off;

        const path = _svgEl('path', {
          d: `M${cc.x},${cc.y} Q${cpx},${cpy} ${nc.x},${nc.y}`,
          class: `tn-arrow${isActive ? ' tn-arrow--active' : ''}`,
          'marker-end': 'url(#tn-arrowhead)',
        });
        gArr.appendChild(path);

        // Label near the control point
        const lbl = _svgEl('text', {
          x: cpx, y: cpy - 8,
          class: 'tn-arrow-label',
        });
        lbl.textContent = t;

        if (opts.interactive && opts.onTransformClick) {
          lbl.style.cursor = 'pointer';
          path.style.cursor = 'pointer';
          const handler = () => {
            const nbr = getNeighbors(center.root, center.quality)[t];
            opts.onTransformClick({
              type: t,
              from: { root: center.root, quality: center.quality },
              to: nbr,
            });
          };
          lbl.addEventListener('click', handler);
          path.addEventListener('click', handler);
        }
        gArr.appendChild(lbl);
      }
    }
    gScene.appendChild(gArr);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. INTERVAL EDGES
  // ═══════════════════════════════════════════════════════════════
  if (hasInterval && state.activeInterval) {
    const gInt = _svgEl('g', { class: 'tonnetz-interval-edges' });
    const [noteA, noteB] = state.activeInterval.notes;
    const pcA = noteToPC(noteA);
    const pcB = noteToPC(noteB);

    for (const ek of edges) {
      const [nk1, nk2] = ek.split('|');
      const n1 = nodes.get(nk1);
      const n2 = nodes.get(nk2);
      if ((n1.pc === pcA && n2.pc === pcB) || (n1.pc === pcB && n2.pc === pcA)) {
        const p1 = toSVG(n1.q, n1.r);
        const p2 = toSVG(n2.q, n2.r);
        gInt.appendChild(_svgEl('line', {
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          class: 'tn-interval-edge',
        }));
        if (ann.showIntervalLabel) {
          const il = _svgEl('text', {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2 - 14,
            class: 'tn-interval-label',
          });
          il.textContent = state.activeInterval.quality;
          gInt.appendChild(il);
        }
      }
    }
    gScene.appendChild(gInt);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. NODES
  // ═══════════════════════════════════════════════════════════════
  // Moving tone PCs for enhanced transform display
  let _movingToPC = -1;
  if (state.activeTransform && state.activeTransform.movingTone) {
    const mt = state.activeTransform.movingTone;
    if (mt.to) _movingToPC = noteToPC(mt.to);
  }

  // Build a color map from activeNotes written by VisualLayer.
  // noteColorMap is empty when VisualLayer is not active — no visual change.
  const noteColorMap = new Map();
  for (const an of (state.activeNotes || [])) {
    if (an.color) noteColorMap.set(an.note, an.color);
  }

  const gNodes = _svgEl('g', { class: 'tonnetz-nodes' });
  for (const [, node] of nodes) {
    const pos        = toSVG(node.q, node.r);
    const nk         = _nodeKey(node.q, node.r);
    // In Note Mode use the compact cluster; in other modes use any matching PC.
    const isActive   = compactKeys ? compactKeys.has(nk) : activePCs.has(node.pc);
    const isGhost    = ghostPCs.has(node.pc) && !isActive;
    const isInterval = intervalPCs.has(node.pc) && edgeMode;
    const isMovingTo = isActive && _movingToPC >= 0 && node.pc === _movingToPC;

    let cls = 'tn-node';
    if      (isActive)   cls += ' tn-node--active';
    else if (isGhost)    cls += ' tn-node--ghost';
    else if (isInterval) cls += ' tn-node--interval';
    if (isMovingTo) cls += ' tn-node--moving-tone';

    const r = isMovingTo ? NODE_R + 5 : NODE_R;
    const attrs = { class: cls, 'data-pc': node.pc, 'data-note': node.note };
    // Mark compact-cluster nodes so ChordBubbleRenderer can query them.
    if (compactKeys && isActive) attrs['data-compact'] = '1';
    const g = _svgEl('g', attrs);
    const circleEl = _svgEl('circle', { cx: pos.x, cy: pos.y, r });

    // Apply VisualLayer color if present (purely additive — no-op when map is empty)
    const nodeColor = noteColorMap.get(node.note);
    if (nodeColor) {
      circleEl.style.fill   = nodeColor;
      circleEl.style.stroke = nodeColor;
    }

    g.appendChild(circleEl);

    if (ann.showNoteNames !== false) {
      const txt = _svgEl('text', { x: pos.x, y: pos.y, class: 'tn-node-label' });
      txt.textContent = node.note;
      g.appendChild(txt);
    }

    if (opts.interactive && opts.onNodeClick) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => opts.onNodeClick({ pc: node.pc, note: node.note }));
    }
    gNodes.appendChild(g);
  }
  // Chord bubble overlays sit between the base grid and the node layer so
  // that node circles + labels always render on top of the glow worm blur.
  for (const overlay of overlays) {
    gScene.appendChild(overlay);
  }

  gScene.appendChild(gNodes);

  // ═══════════════════════════════════════════════════════════════
  // 6. COMMON-TONE / MOVING-TONE MARKERS
  // ═══════════════════════════════════════════════════════════════
  if (state.activeTransform && (ann.showCommonTones || ann.showMovingTone)) {
    const gMark = _svgEl('g', { class: 'tonnetz-markers' });
    const at = state.activeTransform;

    // Common tones — small green dot below node
    if (ann.showCommonTones && at.commonTones) {
      for (const noteName of at.commonTones) {
        const pc = noteToPC(noteName);
        for (const [, nd] of nodes) {
          if (nd.pc === pc && activePCs.has(pc)) {
            const p = toSVG(nd.q, nd.r);
            gMark.appendChild(_svgEl('circle', {
              cx: p.x, cy: p.y + NODE_R + 7, r: 4,
              class: 'tn-common-dot',
            }));
          }
        }
      }
    }

    // Moving tone — arrow from old position to new position
    if (ann.showMovingTone && at.movingTone && at.movingTone.from && at.movingTone.to) {
      const fromPC = noteToPC(at.movingTone.from);
      const toPC   = noteToPC(at.movingTone.to);

      // Find the closest pair of from/to nodes by SVG distance
      let bestDist = Infinity, bestFrom = null, bestTo = null;
      for (const [, fn] of nodes) {
        if (fn.pc !== fromPC) continue;
        const fp = toSVG(fn.q, fn.r);
        for (const [, tn] of nodes) {
          if (tn.pc !== toPC) continue;
          const tp = toSVG(tn.q, tn.r);
          const dist = Math.hypot(fp.x - tp.x, fp.y - tp.y);
          if (dist < bestDist) { bestDist = dist; bestFrom = fp; bestTo = tp; }
        }
      }
      if (bestFrom && bestTo && bestDist > 0) {
        const dx  = bestTo.x - bestFrom.x;
        const dy  = bestTo.y - bestFrom.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux  = dx / len, uy = dy / len;
        gMark.appendChild(_svgEl('line', {
          x1: bestFrom.x + ux * (NODE_R + 4),
          y1: bestFrom.y + uy * (NODE_R + 4),
          x2: bestTo.x   - ux * (NODE_R + 4),
          y2: bestTo.y   - uy * (NODE_R + 4),
          class: 'tn-moving-arrow',
          'marker-end': 'url(#tn-moving-arrowhead)',
        }));

        // Note change label (e.g. "C → C♯") near midpoint of arrow
        const mx = (bestFrom.x + bestTo.x) / 2;
        const my = (bestFrom.y + bestTo.y) / 2;
        // Offset perpendicular to the arrow direction
        const perpX = -uy * 16;
        const perpY =  ux * 16;
        const mtLabel = _svgEl('text', {
          x: mx + perpX, y: my + perpY,
          class: 'tn-moving-label',
        });
        mtLabel.textContent = `${at.movingTone.from} \u2192 ${at.movingTone.to}`;
        gMark.appendChild(mtLabel);
      }
    }
    gScene.appendChild(gMark);
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. CHORD LABELS
  // ═══════════════════════════════════════════════════════════════
  if (ann.showChordLabel && hasTriads) {
    const gLbl = _svgEl('g', { class: 'tonnetz-labels' });

    // Collect label data first, then render (allows collision avoidance)
    const labelInfos = [];

    for (const t of state.activeTriads) {
      if (t.role === 'ghost' && !state.activeTransform) continue;
      const rpc = noteToPC(t.root);
      for (const [, nt] of triads) {
        if (noteToPC(nt.root) === rpc && nt.quality === t.quality) {
          // Use actual node positions to place label outside the cluster
          const nodePositions = nt.nodes.map(n => toSVG(n.q, n.r));
          const cx = (nodePositions[0].x + nodePositions[1].x + nodePositions[2].x) / 3;

          let ly;
          if (t.role === 'primary') {
            // Primary: below the lowest (max-y) node of this triangle
            const maxY = Math.max(...nodePositions.map(p => p.y));
            ly = maxY + NODE_R + 20;
          } else {
            // Ghost/secondary: above the highest (min-y) node
            const minY = Math.min(...nodePositions.map(p => p.y));
            ly = minY - NODE_R - 16;
          }

          const text = t.role === 'ghost'
            ? `${t.root} ${t.quality} (from)`
            : `${t.root} ${t.quality}`;
          labelInfos.push({ x: cx, y: ly, text, role: t.role });
          break;
        }
      }
    }

    // Render labels with background rects
    for (const info of labelInfos) {
      const roleClass = info.role === 'primary' ? ' tn-chord-label--primary'
                      : info.role === 'ghost'   ? ' tn-chord-label--ghost'
                      : '';
      // Approximate text width for background rect
      const estW = info.text.length * 7.5 + 12;
      const estH = 20;
      gLbl.appendChild(_svgEl('rect', {
        x: info.x - estW / 2, y: info.y - estH / 2,
        width: estW, height: estH,
        class: 'tn-chord-label-bg',
      }));
      const lbl = _svgEl('text', { x: info.x, y: info.y, class: 'tn-chord-label' + roleClass });
      lbl.textContent = info.text;
      gLbl.appendChild(lbl);
    }

    gScene.appendChild(gLbl);
  }

  // ── Attach scene to SVG ───────────────────────────────────────
  svg.appendChild(gScene);
}

// ════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════

const TonnetzNeighborhood = {
  _svg: null,
  _container: null,
  _unsub: null,
  _opts: {},
  _centerRoot: null,
  _centerQuality: null,
  _depth: 1,
  _neighborhood: null,
  _hasRendered: false,
  _animationId: 0,

  /**
   * Create the SVG, subscribe to HarmonyState, do initial render.
   *
   * @param {string}   containerId            ID of a <div> to render into
   * @param {Object}   [options]
   * @param {number|string} [options.width]    CSS width (default: container's own width)
   * @param {number|string} [options.height]   CSS height
   * @param {boolean}  [options.interactive]   Enable click handlers on triads/arrows/nodes
   * @param {Function} [options.onTriadClick]  Receives { root, quality }
   * @param {Function} [options.onTransformClick] Receives { type, from, to }
   * @param {Function} [options.onNodeClick]   Receives { pc, note }
   */
  init(containerId, options) {
    options = options || {};

    // Tear down previous instance if re-initialised
    if (this._svg) this.destroy();

    this._opts = options;
    this._container = document.getElementById(containerId);
    if (!this._container) {
      console.error(`[TonnetzNeighborhood] Container #${containerId} not found`);
      return;
    }

    // Inject CSS once
    if (!document.getElementById('tonnetz-nh-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'tonnetz-nh-styles';
      styleEl.textContent = TONNETZ_CSS;
      document.head.appendChild(styleEl);
    }

    // Create SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'tonnetz-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (options.width)  svg.style.width  = typeof options.width  === 'number' ? options.width  + 'px' : options.width;
    if (options.height) svg.style.height = typeof options.height === 'number' ? options.height + 'px' : options.height;

    // <defs> — arrowhead markers
    const defs = _svgEl('defs');

    const ah = _svgEl('marker', {
      id: 'tn-arrowhead', markerWidth: 8, markerHeight: 6,
      refX: 8, refY: 3, orient: 'auto', markerUnits: 'strokeWidth',
    });
    ah.appendChild(_svgEl('polygon', { points: '0 0, 8 3, 0 6' }));
    defs.appendChild(ah);

    const mah = _svgEl('marker', {
      id: 'tn-moving-arrowhead', markerWidth: 8, markerHeight: 6,
      refX: 8, refY: 3, orient: 'auto', markerUnits: 'strokeWidth',
    });
    mah.appendChild(_svgEl('polygon', { points: '0 0, 8 3, 0 6' }));
    defs.appendChild(mah);

    svg.appendChild(defs);
    this._container.appendChild(svg);
    this._svg = svg;
    this._hasRendered = false;
    this._animationId = 0;

    // Subscribe to HarmonyState
    this._unsub = HarmonyState.on((st) => this.render(st));

    // Initial render
    this.render(HarmonyState.get());
  },

  /**
   * Re-center the view on a different triad, with a smooth slide animation.
   */
  recenter(root, quality) {
    const oldNeighborhood = this._neighborhood;
    const shouldAnimate = this._hasRendered && oldNeighborhood && this._centerRoot != null;

    // Find the target triad's lattice position in the OLD neighborhood
    let offsetX = 0, offsetY = 0;
    if (shouldAnimate) {
      const targetPC = noteToPC(root);
      for (const [, tri] of oldNeighborhood.triads) {
        if (noteToPC(tri.root) === targetPC && tri.quality === quality) {
          const pos = toSVG(tri.tq, tri.tr);
          offsetX = pos.x;
          offsetY = pos.y;
          break;
        }
      }
    }

    // Rebuild
    this._centerRoot    = root;
    this._centerQuality = quality;
    this._neighborhood  = buildNeighborhood(root, quality, this._depth);

    // Sync HarmonyState so keyboard and other subscribers update
    const current = HarmonyState.get().tonnetzCenter;
    if (!current || current.root !== root || current.quality !== quality) {
      HarmonyState.setTriad(root, quality);
    }

    _renderAll(this._svg, this._neighborhood, HarmonyState.get(), this._opts);
    this._hasRendered = true;

    // Animate if we have an offset
    if (shouldAnimate && (offsetX !== 0 || offsetY !== 0)) {
      this._animateSlide(offsetX, offsetY);
    }
  },

  /** Animate the scene group from an offset back to (0,0). */
  _animateSlide(fromOffsetX, fromOffsetY) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scene = this._svg && this._svg.querySelector('.tn-scene');
    if (!scene) return;

    // Cancel any in-flight animation
    this._animationId++;
    const myId = this._animationId;

    // Start at the offset (content appears at old position)
    scene.style.transition = 'none';
    scene.setAttribute('transform', `translate(${fromOffsetX}, ${fromOffsetY})`);

    // Next frame: enable transition and animate to (0,0)
    requestAnimationFrame(() => {
      if (this._animationId !== myId) return;
      requestAnimationFrame(() => {
        if (this._animationId !== myId) return;
        scene.style.transition = `transform ${RECENTER_MS}ms ease-out`;
        scene.setAttribute('transform', 'translate(0, 0)');

        // Clean up after animation completes
        const cleanup = () => {
          if (this._animationId !== myId) return;
          scene.style.transition = '';
          scene.removeAttribute('transform');
        };
        scene.addEventListener('transitionend', cleanup, { once: true });
        // Fallback timeout in case transitionend doesn't fire
        setTimeout(cleanup, RECENTER_MS + 50);
      });
    });
  },

  /** Change the visible depth (1, 2, 3…) and re-render. */
  setDepth(depth) {
    this._depth = depth;
    this._neighborhood = buildNeighborhood(
      this._centerRoot  || 'C',
      this._centerQuality || 'major',
      depth,
    );
    _renderAll(this._svg, this._neighborhood, HarmonyState.get(), this._opts);
  },

  /**
   * Full re-render from a HarmonyState snapshot.
   * Usually called automatically via subscription.
   */
  render(state) {
    if (!this._svg) return;

    const center  = state.tonnetzCenter;
    const newRoot = (center && center.root) || this._centerRoot || 'C';
    const newQual = (center && center.quality) || this._centerQuality || 'major';
    const newDep  = state.tonnetzDepth || this._depth;

    const needsRebuild =
      newRoot !== this._centerRoot ||
      newQual !== this._centerQuality ||
      newDep  !== this._depth ||
      !this._neighborhood;

    if (needsRebuild) {
      this._centerRoot    = newRoot;
      this._centerQuality = newQual;
      this._depth         = newDep;
      this._neighborhood  = buildNeighborhood(newRoot, newQual, newDep);
    }

    _renderAll(this._svg, this._neighborhood, state, this._opts);
    this._hasRendered = true;
  },

  /** Unsubscribe from HarmonyState, remove SVG. */
  destroy() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
    this._svg          = null;
    this._container    = null;
    this._neighborhood = null;
    this._centerRoot   = null;
    this._centerQuality = null;
    this._hasRendered   = false;
  },
};

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { TonnetzNeighborhood };

if (typeof window !== 'undefined') {
  window.TonnetzNeighborhood = TonnetzNeighborhood;
}

// ════════════════════════════════════════════════════════════════════
// SELF-TEST  (manual — run in browser console after importing)
// ════════════════════════════════════════════════════════════════════

/* --- Self-test: uncomment this block to run ---

(function selfTest() {
  const results = [];
  function assert(label, ok) {
    results.push({ label, pass: !!ok });
    console.log(ok ? `  ✓ ${label}` : `  ✗ ${label}`);
  }

  console.log("\n─── tonnetz-neighborhood.js self-test ───\n");

  // Create a test container
  const div = document.createElement('div');
  div.id = 'tn-selftest';
  div.style.cssText = 'width:500px;height:400px;position:fixed;top:10px;left:10px;z-index:99999;background:#fff;border:2px solid #333;';
  document.body.appendChild(div);

  // 1. init
  TonnetzNeighborhood.init('tn-selftest', { width: 500, height: 400 });
  const svg = div.querySelector('svg.tonnetz-svg');
  assert("init() creates an SVG element", svg !== null);

  // 2. setTriad C major → verify nodes for C, E, G + PLR neighbors
  HarmonyState.reset();
  HarmonyState.setTriad("C", "major");
  const circlesAfterTriad = svg.querySelectorAll('.tn-node circle');
  assert("setTriad(C,major) renders 6 nodes (depth 1)", circlesAfterTriad.length === 6);

  const noteLabels = [...svg.querySelectorAll('.tn-node-label')].map(el => el.textContent).sort();
  const expectedNotes = ["A", "B", "C", "D♯", "E", "G"];
  assert("Nodes include C, E, G and PLR neighbor notes",
    expectedNotes.every(n => noteLabels.includes(n)));

  // 3. Check primary triangle exists
  const primaryTri = svg.querySelector('.tn-tri--primary');
  assert("C major triangle has .tn-tri--primary class", primaryTri !== null);

  // 4. setTransform R → check ghost + primary + A minor presence
  HarmonyState.setTransform("R", "C", "major");
  const ghostTri   = svg.querySelector('.tn-tri--ghost');
  const primaryTri2 = svg.querySelector('.tn-tri--primary');
  assert("setTransform(R) produces .tn-tri--ghost", ghostTri !== null);
  assert("setTransform(R) produces .tn-tri--primary (A minor)", primaryTri2 !== null);

  // 5. setInterval C→E (M3) → edge mode
  HarmonyState.setInterval("C", 4, "E", 4);
  const intEdge = svg.querySelector('.tn-interval-edge');
  assert("setInterval(C,E) renders .tn-interval-edge", intEdge !== null);

  // 6. recenter on G major → note labels change
  HarmonyState.reset();
  HarmonyState.setTriad("G", "major");
  TonnetzNeighborhood.recenter("G", "major");
  const labelsAfterRecenter = [...svg.querySelectorAll('.tn-node-label')].map(el => el.textContent);
  assert("recenter(G,major) shows G in node labels", labelsAfterRecenter.includes("G"));
  assert("recenter(G,major) shows B in node labels", labelsAfterRecenter.includes("B"));

  // 7. destroy
  TonnetzNeighborhood.destroy();
  assert("destroy() removes SVG from container", div.querySelector('svg') === null);

  // Cleanup
  div.remove();

  // Summary
  const passed = results.filter(r => r.pass).length;
  console.log(`\n─── ${passed}/${results.length} passed ───\n`);
})();

--- End self-test --- */
