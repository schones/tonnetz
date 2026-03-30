/**
 * chord-bubble-renderer.js — Glow Worm Edition
 * =============================================
 * Draws a luminous "glow worm" path connecting active chord tones along
 * Tonnetz grid edges, tracing from the lowest pitch to the highest.
 *
 * Pure rendering module — subscribes to HarmonyState but never writes to it.
 *
 * Usage:
 *   const bubble = new ChordBubbleRenderer('exp-tonnetz-container');
 *   // ... later:
 *   bubble.destroy();
 *
 * Constraints:
 *   - No panel assumptions: works if Tonnetz is present; silently no-ops if not.
 *   - Survives TonnetzNeighborhood re-renders because _renderAll preserves
 *     elements with class 'tn-chord-bubble-layer'.
 *   - Must be initialised AFTER TonnetzNeighborhood.init() so its HarmonyState
 *     subscriber runs after the Tonnetz re-render.
 *
 * Consumed by:
 *   - explorer.html
 *
 * Depends on:
 *   - harmony-state.js   → HarmonyState pub/sub
 *   - chord-resolver.js  → resolveChord (for quality-based coloring)
 *   - transforms.js      → noteToPC
 */

import { HarmonyState } from './harmony-state.js';
import { noteToPC }     from './transforms.js';
import { resolveChord } from './chord-resolver.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const SVG_NS    = 'http://www.w3.org/2000/svg';
const FILTER_ID = 'tn-glow-filter';

/**
 * Maximum px distance between two SVG node centers that are considered
 * adjacent on the Tonnetz grid (M3 ≈ 100px, m3/P5 ≈ 100px, allow margin).
 */
const ADJACENCY_PX = 115;

const WORM_STROKE_W = 7;   // glow path stroke-width (px)
const GLOW_NODE_R   = 24;  // glowing halo circle radius (px)

/** Quality → path / node color. Matches tonnetz-neighborhood.js quality CSS vars. */
const QUALITY_COLORS = {
  major:   '#2563eb',
  minor:   '#e64a19',
  dim:     '#7c3aed',
  aug:     '#d97706',
  dom7:    '#2563eb',
  maj7:    '#2563eb',
  min7:    '#e64a19',
  dim7:    '#7c3aed',
  hdim7:   '#7c3aed',
  minmaj7: '#e64a19',
  augmaj7: '#d97706',
  aug7:    '#d97706',
  sus2:    '#0891b2',
  sus4:    '#0891b2',
};
const DEFAULT_COLOR = '#6c63ff';

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/** Create an SVG element with the given attributes. */
function _el(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Read the cx/cy of a .tn-node element's child <circle>. Returns {x,y} or null. */
function _pos(el) {
  const c = el.querySelector('circle');
  if (!c) return null;
  const x = parseFloat(c.getAttribute('cx'));
  const y = parseFloat(c.getAttribute('cy'));
  return isNaN(x) || isNaN(y) ? null : { x, y };
}

/** Integer key for deduplication of close positions. */
function _key(p) {
  return `${Math.round(p.x)}:${Math.round(p.y)}`;
}

// ════════════════════════════════════════════════════════════════════
// SVG FILTER
// ════════════════════════════════════════════════════════════════════

/**
 * Ensure the glow SVG filter is defined in the SVG's <defs>.
 * Idempotent — safe to call on every render.
 *
 * Filter: blur the source, then feMerge blur (behind) + sharp (front)
 * for an organic luminous glow.
 */
function _ensureFilter(svg) {
  if (svg.querySelector(`#${FILTER_ID}`)) return;

  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = _el('defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  const f = _el('filter', {
    id:     FILTER_ID,
    x:      '-60%',
    y:      '-60%',
    width:  '220%',
    height: '220%',
    'color-interpolation-filters': 'sRGB',
  });

  const blur = _el('feGaussianBlur', { stdDeviation: '4', result: 'blur' });
  const merge = _el('feMerge');
  merge.appendChild(_el('feMergeNode', { in: 'blur' }));
  merge.appendChild(_el('feMergeNode', { in: 'SourceGraphic' }));

  f.appendChild(blur);
  f.appendChild(merge);
  defs.appendChild(f);
}

// ════════════════════════════════════════════════════════════════════
// NODE POSITION SELECTION
// ════════════════════════════════════════════════════════════════════

/**
 * Given sorted active notes (with .pc attached), return an ordered array of
 * SVG {x,y} positions — one per unique pitch class — matching the note order.
 *
 * In Note Mode: uses data-compact="1" nodes (already one per PC, tightest cluster).
 * In Triad / other mode: greedy-picks the tightest cluster from all matching nodes.
 */
function _orderedPositions(svg, sortedNotes) {
  // Deduplicate by PC, preserving pitch order (lowest pitch for each PC wins)
  const seenPC = new Set();
  const unique = sortedNotes.filter(n => {
    if (seenPC.has(n.pc)) return false;
    seenPC.add(n.pc);
    return true;
  });
  if (unique.length === 0) return [];

  // ── Note Mode: compact cluster nodes (data-compact="1") ──────────
  const compactEls = Array.from(svg.querySelectorAll('.tn-node[data-compact="1"]'));
  if (compactEls.length > 0) {
    const pcMap = new Map();
    for (const el of compactEls) {
      const pc = parseInt(el.getAttribute('data-pc'), 10);
      const pos = _pos(el);
      if (!isNaN(pc) && pos) pcMap.set(pc, pos);
    }
    const result = unique.map(n => pcMap.get(n.pc)).filter(Boolean);
    if (result.length === unique.length) return result;
  }

  // ── Triad / other mode: greedy compact cluster ───────────────────
  // Build per-PC candidate lists from all visible nodes
  const pcCands = new Map();
  for (const el of svg.querySelectorAll('.tn-node')) {
    const pc = parseInt(el.getAttribute('data-pc'), 10);
    if (isNaN(pc) || !seenPC.has(pc)) continue;
    const pos = _pos(el);
    if (!pos) continue;
    if (!pcCands.has(pc)) pcCands.set(pc, []);
    pcCands.get(pc).push(pos);
  }

  const cands0 = pcCands.get(unique[0].pc) || [];
  if (!cands0.length) return [];

  // Anchor: first candidate of the lowest-pitch note
  const chosen = [cands0[0]];
  for (let i = 1; i < unique.length; i++) {
    const cands = pcCands.get(unique[i].pc) || [];
    if (!cands.length) continue;
    // Pick candidate closest to current centroid of already-chosen positions
    const cx = chosen.reduce((s, p) => s + p.x, 0) / chosen.length;
    const cy = chosen.reduce((s, p) => s + p.y, 0) / chosen.length;
    let best = cands[0];
    let bestD = Math.hypot(cands[0].x - cx, cands[0].y - cy);
    for (const c of cands) {
      const d = Math.hypot(c.x - cx, c.y - cy);
      if (d < bestD) { bestD = d; best = c; }
    }
    chosen.push(best);
  }
  return chosen;
}

// ════════════════════════════════════════════════════════════════════
// GRID PATH FINDING
// ════════════════════════════════════════════════════════════════════

/**
 * Collect all unique SVG node positions from the visible Tonnetz grid.
 * Used as the traversable graph for BFS path routing.
 */
function _allGridNodes(svg) {
  const seen = new Set();
  const result = [];
  for (const el of svg.querySelectorAll('.tn-node')) {
    const pos = _pos(el);
    if (!pos) continue;
    const k = _key(pos);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(pos);
  }
  return result;
}

/**
 * BFS shortest path on the Tonnetz grid between two SVG positions.
 * Nodes are considered adjacent if their distance is ≤ ADJACENCY_PX.
 *
 * Returns an array of {x,y} waypoints from `from` to `to` (inclusive).
 * Falls back to a direct [from, to] segment if no path is found.
 */
function _gridPath(from, to, gridNodes) {
  const toKey = _key(to);

  // Fast path: already adjacent
  if (Math.hypot(to.x - from.x, to.y - from.y) <= ADJACENCY_PX) {
    return [from, to];
  }

  const queue   = [[from]];
  const visited = new Set([_key(from)]);

  while (queue.length) {
    const path = queue.shift();
    const cur  = path[path.length - 1];

    for (const node of gridNodes) {
      const nk = _key(node);
      if (visited.has(nk)) continue;
      if (Math.hypot(node.x - cur.x, node.y - cur.y) > ADJACENCY_PX) continue;

      const next = [...path, node];
      if (nk === toKey) return next;
      visited.add(nk);
      queue.push(next);
    }
  }

  return [from, to]; // unreachable → direct fallback
}

/**
 * Build the full worm waypoints by chaining BFS segments between
 * consecutive chord-tone positions (lowest → highest pitch).
 */
function _wormWaypoints(positions, gridNodes) {
  if (positions.length === 0) return [];
  const waypoints = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const seg = _gridPath(positions[i - 1], positions[i], gridNodes);
    // Skip seg[0] — already the last waypoint
    for (const wp of seg.slice(1)) waypoints.push(wp);
  }
  return waypoints;
}

// ════════════════════════════════════════════════════════════════════
// CHORD BUBBLE RENDERER (Glow Worm)
// ════════════════════════════════════════════════════════════════════

class ChordBubbleRenderer {
  /**
   * @param {string|Element} container
   *   ID string or DOM element of the Tonnetz panel container.
   *   The SVG is looked up inside it via querySelector('svg').
   * @param {Object} [options]
   * @param {string} [options.labelEl]
   *   ID of an existing element to write the resolved chord name into.
   */
  constructor(container, options = {}) {
    this._opts  = options;
    this._unsub = null;
    this._group = null;   // <g class="tn-chord-bubble-layer">

    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this._container = el || null;

    this._initGroup();

    // Subscribe — must happen AFTER TonnetzNeighborhood subscribes so our
    // render runs after the Tonnetz has already rebuilt the SVG.
    this._unsub = HarmonyState.on(state => this._render(state));
    this._render(HarmonyState.get());
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  destroy() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (this._group?.parentNode) this._group.parentNode.removeChild(this._group);
    this._group = null;
  }

  // ── Internal ─────────────────────────────────────────────────────

  _getSVG() {
    if (!this._container) return null;
    return this._container.querySelector('svg.tonnetz-svg')
        || this._container.querySelector('svg');
  }

  _initGroup() {
    const svg = this._getSVG();
    if (!svg) return;
    this._group = _el('g', { class: 'tn-chord-bubble-layer', 'pointer-events': 'none' });
    svg.appendChild(this._group);
  }

  /** Main render: called by HarmonyState subscriber. */
  _render(state) {
    if (!this._group) { this._initGroup(); if (!this._group) return; }

    const svg = this._getSVG();
    if (svg && this._group.parentNode !== svg) svg.appendChild(this._group);

    // Clear previous render
    this._group.textContent = '';
    if (!svg) return;

    // ── Determine active notes sorted by pitch ───────────────────
    //
    // Priority:
    //   1. If primaryTriad exists, use its notes (avoids ghost notes in
    //      transform mode). All triad notes get octave 4 for sorting.
    //   2. Otherwise, use activeNotes (which carry real octave data for
    //      note-toggle mode — gives true low→high ordering).
    //
    const triads  = state.activeTriads || [];
    const primary = triads.find(t => t.role === 'primary');

    const rawNotes = primary?.notes
      ? primary.notes.map(note => ({ note, octave: 4 }))
      : (state.activeNotes || []);

    const sortedNotes = rawNotes
      .map(an => {
        const pc    = noteToPC(an.note);
        const pitch = (an.octave != null ? an.octave : 4) * 12 + pc;
        return { ...an, pc, pitch };
      })
      .filter(n => !isNaN(n.pc) && n.pc >= 0)
      .sort((a, b) => a.pitch - b.pitch);

    if (sortedNotes.length < 2) return;

    // ── Resolve chord quality → color ────────────────────────────
    const pcs     = [...new Set(sortedNotes.map(n => n.pc))];
    const resolved = resolveChord(pcs);
    const color    = (resolved && QUALITY_COLORS[resolved.quality]) || DEFAULT_COLOR;

    // ── Ensure glow filter is defined ───────────────────────────
    _ensureFilter(svg);

    // ── Get one ordered SVG position per unique pitch class ──────
    const positions = _orderedPositions(svg, sortedNotes);
    if (positions.length < 2) return;

    // ── Build worm waypoints via BFS grid-path routing ───────────
    const gridNodes = _allGridNodes(svg);
    const waypoints = _wormWaypoints(positions, gridNodes);

    // ── Render glow worm ─────────────────────────────────────────
    //
    // Two-layer approach:
    //   glowGroup  — filtered (blur+sharp merge) for the luminous halo
    //   sharpGroup — unfiltered sharp overdraw for crisp edges
    //
    const glowGroup  = _el('g', { filter: `url(#${FILTER_ID})`, opacity: '0.85' });
    const sharpGroup = _el('g');

    // ── Path segments ────────────────────────────────────────────
    if (waypoints.length >= 2) {
      const d = waypoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

      const pathAttrs = {
        d,
        stroke:             color,
        'stroke-width':     WORM_STROKE_W,
        'stroke-linecap':   'round',
        'stroke-linejoin':  'round',
        fill:               'none',
      };

      // Blurred glow layer (wider, more transparent)
      glowGroup.appendChild(_el('path', { ...pathAttrs, 'stroke-width': WORM_STROKE_W + 4, opacity: '0.6', class: 'tn-worm-glow' }));
      // Sharp foreground
      sharpGroup.appendChild(_el('path', { ...pathAttrs, opacity: '0.9', class: 'tn-worm-path' }));
    }

    // ── Node halos at each chord tone ────────────────────────────
    for (const pos of positions) {
      const cx = pos.x.toFixed(1);
      const cy = pos.y.toFixed(1);

      // Soft glow halo (in filtered group)
      glowGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R,
        fill:         color,
        'fill-opacity': '0.5',
        class:        'tn-worm-node-glow',
      }));

      // Crisp bright ring (in sharp group — shows above node fill, below label)
      sharpGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R - 2,
        fill:           'none',
        stroke:         color,
        'stroke-width': '3',
        opacity:        '0.9',
        class:          'tn-worm-node-ring',
      }));
    }

    this._group.appendChild(glowGroup);
    this._group.appendChild(sharpGroup);

    // ── Chord name label ─────────────────────────────────────────
    if (resolved) {
      const maxY = Math.max(...positions.map(p => p.y));
      const cx   = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      this._drawLabel(cx, maxY + 34, resolved.name, color);
      this._updateExternalLabel(resolved.name);
    }
  }

  /**
   * Draw a compact chord-name badge just below the lowest chord tone node.
   */
  _drawLabel(cx, ly, text, color) {
    const PAD  = 6;
    const estW = text.length * 8 + PAD * 2;
    const estH = 20;

    const bg = _el('rect', {
      x:      cx - estW / 2,
      y:      ly - estH / 2,
      width:  estW,
      height: estH,
      rx:     '5',
      fill:   color,
      'fill-opacity': '0.85',
    });

    const lbl = _el('text', {
      x:                   cx,
      y:                   ly,
      'text-anchor':       'middle',
      'dominant-baseline': 'central',
      'font-size':         '12',
      'font-weight':       '700',
      'font-family':       'system-ui, -apple-system, sans-serif',
      fill:                '#fff',
      class:               'tn-chord-bubble-label',
    });
    lbl.textContent = text;

    this._group.appendChild(bg);
    this._group.appendChild(lbl);
  }

  /**
   * Optionally write chord name to an external DOM element (e.g. chord badge).
   */
  _updateExternalLabel(name) {
    if (!this._opts.labelEl) return;
    const el = typeof this._opts.labelEl === 'string'
      ? document.getElementById(this._opts.labelEl)
      : this._opts.labelEl;
    if (el) el.textContent = name;
  }
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { ChordBubbleRenderer };

if (typeof window !== 'undefined') {
  window.ChordBubbleRenderer = ChordBubbleRenderer;
}
