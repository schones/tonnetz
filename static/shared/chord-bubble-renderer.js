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
import { noteToPC } from './transforms.js';
import { resolveChord } from './chord-resolver.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';
const FILTER_ID = 'tn-glow-filter';

/**
 * Maximum px distance between two SVG node centers that are considered
 * adjacent on the Tonnetz grid (M3 ≈ 100px, m3/P5 ≈ 100px, allow margin).
 */
const ADJACENCY_PX = 115;

const WORM_STROKE_W = 4;   // glow path stroke-width (px)
const GLOW_NODE_R = 24;  // glowing halo circle radius (px)

/** Quality → path / node color. Matches tonnetz-neighborhood.js quality CSS vars. */
const QUALITY_COLORS = {
  major: '#2563eb',
  minor: '#e64a19',
  dim: '#7c3aed',
  aug: '#d97706',
  dom7: '#2563eb',
  maj7: '#2563eb',
  min7: '#e64a19',
  dim7: '#7c3aed',
  hdim7: '#7c3aed',
  minmaj7: '#e64a19',
  augmaj7: '#d97706',
  aug7: '#d97706',
  sus2: '#0891b2',
  sus4: '#0891b2',
};
const DEFAULT_COLOR = '#6c63ff';

/** Fixed palette for progression trail chords (visually distinct, accessible). */
const PROGRESSION_PALETTE = [
  '#2563eb',  // blue
  '#16a34a',  // green
  '#d97706',  // amber
  '#9333ea',  // purple
  '#e64a19',  // deep orange
  '#0891b2',  // cyan
];

const TRAIL_OPACITY = 0.35;
const COMMON_TONE_COLOR = '#fbbf24'; // gold for common-tone pulse
const COMMON_TONE_R = 18;

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
    id: FILTER_ID,
    x: '-40%',
    y: '-40%',
    width: '180%',
    height: '180%',
    'color-interpolation-filters': 'sRGB',
  });

  const blur = _el('feGaussianBlur', { stdDeviation: '3', result: 'blur' });
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

  const queue = [[from]];
  const visited = new Set([_key(from)]);

  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];

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
    this._opts = options;
    this._unsub = null;
    this._group = null;   // <g class="tn-chord-bubble-layer">

    // History trail (single-chord exploration mode):
    //   _historyChord       — { root, quality, notes } of the previous chord
    //   _historyCommonTones — note names common to history + current chord
    //   _historyPulseId     — bumps each setHistory() call; renderer fires the
    //                         gold pulse animation only when it sees a new id
    this._historyChord       = null;
    this._historyCommonTones = [];
    this._historyPulseId     = 0;
    this._historyRenderedId  = 0;

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

  // ── Single-chord history trail (Explorer mode) ───────────────────
  //
  // Outside of progression playback the renderer can hold one "previous
  // chord" and draw it as a faded glow worm trail behind the active chord,
  // plus a one-shot gold pulse on shared (common) tones. This is how
  // Explorer brings the chord-progressions visual energy to free clicking.

  /**
   * @param {{root:string, quality:string, notes?:string[]}|null} historyChord
   * @param {string[]} [commonToneNotes]  Note names common to history + current chord.
   */
  setHistory(historyChord, commonToneNotes) {
    this._historyChord       = historyChord || null;
    this._historyCommonTones = commonToneNotes || [];
    this._historyPulseId++;
    this._render(HarmonyState.get());
  }

  clearHistory() {
    this._historyChord       = null;
    this._historyCommonTones = [];
    this._historyPulseId++;
    this._render(HarmonyState.get());
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
    // Only re-attach if completely detached; _renderAll positions the group
    // inside gScene (between the grid and node layer) to fix z-order.
    if (svg && !this._group.parentNode) svg.appendChild(this._group);

    // Clear previous render
    this._group.textContent = '';
    if (!svg) return;

    // ── Progression mode: multi-path rendering ───────────────────
    const prog = state.progressionState;
    if (prog && prog.chords.length > 0 && prog.currentIndex >= 0) {
      this._renderProgression(svg, state);
      return;
    }

    // ── Standard single-chord rendering ──────────────────────────
    this._renderSingle(svg, state);
  }

  /** Render a single chord glow worm (original behavior). */
  _renderSingle(svg, state) {
    const triads = state.activeTriads || [];
    const primary = triads.find(t => t.role === 'primary');

    // ── History trail: draw the previous chord as a faded glow worm
    //    behind the active one. Same visual language as the chord-
    //    progressions trail, but driven by Explorer's chord-change
    //    handler instead of HarmonyState.progressionState.
    if (this._historyChord && primary) {
      const samePrimary =
        this._historyChord.root === primary.root &&
        this._historyChord.quality === primary.quality;
      if (!samePrimary) {
        _ensureFilter(svg);
        const gridNodes = _allGridNodes(svg);
        // Use a colour that contrasts with the active worm — match the
        // history chord's own quality so it stays legible.
        const histResolved = resolveChord(
          (this._historyChord.notes || []).map(n => noteToPC(n)).filter(pc => !isNaN(pc))
        );
        const histColor =
          (histResolved && QUALITY_COLORS[histResolved.quality]) || DEFAULT_COLOR;
        this._renderTrailChord(svg, this._historyChord, histColor, gridNodes);

        // One-shot gold pulse on common tones — only when a *new* history
        // has just been set (we compare pulse ids so passive re-renders
        // from other state changes don't keep retriggering it).
        if (this._historyPulseId !== this._historyRenderedId &&
            this._historyCommonTones.length > 0) {
          this._renderCommonTonePulse(svg, this._historyCommonTones);
        }
        this._historyRenderedId = this._historyPulseId;
      }
    }

    const rawNotes = primary?.notes
      ? primary.notes.map(note => ({ note, octave: 4 }))
      : (state.activeNotes || []);

    const sortedNotes = rawNotes
      .map(an => {
        const pc = noteToPC(an.note);
        const pitch = (an.octave != null ? an.octave : 4) * 12 + pc;
        return { ...an, pc, pitch };
      })
      .filter(n => !isNaN(n.pc) && n.pc >= 0)
      .sort((a, b) => a.pitch - b.pitch);

    if (sortedNotes.length < 2) return;

    const pcs = [...new Set(sortedNotes.map(n => n.pc))];
    const resolved = resolveChord(pcs);
    const color = (resolved && QUALITY_COLORS[resolved.quality]) || DEFAULT_COLOR;

    _ensureFilter(svg);

    const positions = _orderedPositions(svg, sortedNotes);
    if (positions.length < 2) return;

    const gridNodes = _allGridNodes(svg);
    const waypoints = _wormWaypoints(positions, gridNodes);

    const glowGroup = _el('g', { filter: `url(#${FILTER_ID})`, opacity: '0.85' });
    const sharpGroup = _el('g');

    if (waypoints.length >= 2) {
      const d = waypoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

      const pathAttrs = {
        d,
        stroke: color,
        'stroke-width': WORM_STROKE_W,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
      };

      glowGroup.appendChild(_el('path', { ...pathAttrs, 'stroke-width': WORM_STROKE_W + 4, opacity: '0.6', class: 'tn-worm-glow' }));
      sharpGroup.appendChild(_el('path', { ...pathAttrs, opacity: '0.9', class: 'tn-worm-path' }));
    }

    for (const pos of positions) {
      const cx = pos.x.toFixed(1);
      const cy = pos.y.toFixed(1);

      glowGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R,
        fill: color, 'fill-opacity': '0.5',
        class: 'tn-worm-node-glow',
      }));

      sharpGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R - 2,
        fill: 'none', stroke: color, 'stroke-width': '3', opacity: '0.9',
        class: 'tn-worm-node-ring',
      }));
    }

    this._group.appendChild(glowGroup);
    this._group.appendChild(sharpGroup);

    if (resolved) {
      // The Tonnetz renderer owns the on-canvas chord label
      // (tonnetz-neighborhood.js § CHORD LABELS). We only update the
      // external DOM badge here to avoid a doubled label.
      const labelText = state.activeChord && state.activeChord.symbol
        ? state.activeChord.symbol
        : resolved.name;
      this._updateExternalLabel(labelText);
    }
  }

  /**
   * Render multiple glow worm paths for a chord progression.
   * Trail chords are faded; active chord is full brightness;
   * common tones between consecutive chords get a gold pulse.
   */
  _renderProgression(svg, state) {
    const prog = state.progressionState;
    const idx = prog.currentIndex;

    _ensureFilter(svg);
    const gridNodes = _allGridNodes(svg);

    // ── Render trail chords (indices < currentIndex) ──────────────
    for (let i = 0; i < idx; i++) {
      const chord = prog.chords[i];
      const trailColor = PROGRESSION_PALETTE[i % PROGRESSION_PALETTE.length];
      this._renderTrailChord(svg, chord, trailColor, gridNodes);
    }

    // ── Render active chord (currentIndex) with full glow ────────
    const activeChord = prog.chords[idx];
    const activePcs = (activeChord.notes || []).map(n => noteToPC(n)).filter(pc => !isNaN(pc));
    const resolved = resolveChord([...new Set(activePcs)]);
    const activeColor = (resolved && QUALITY_COLORS[resolved.quality]) || DEFAULT_COLOR;
    this._renderActiveChord(svg, activeChord, activeColor, gridNodes);

    // ── Common-tone pulse (between previous and current chord) ───
    // Only pulse on an actual step event; clear the flag so resizes
    // or other re-renders don't re-trigger the animation.
    if (state._progressionEvent) {
      const commonTones = state._progressionCommonTones || [];
      if (commonTones.length > 0) {
        this._renderCommonTonePulse(svg, commonTones);
      }
      // Consume the event flag (silent update so we don't re-trigger)
      HarmonyState.updateSilent({ _progressionEvent: false });
    }

    // ── Chord name label for active chord ────────────────────────
    if (resolved) {
      const label = activeChord.romanNumeral
        ? `${resolved.name} (${activeChord.romanNumeral})`
        : resolved.name;
      this._updateExternalLabel(label);
    }
  }

  /** Render a trail chord: same glow worm visual as active, just dimmed. */
  _renderTrailChord(svg, chord, color, gridNodes) {
    const sortedNotes = (chord.notes || [])
      .map(note => {
        const pc = noteToPC(note);
        return { note, octave: 4, pc, pitch: 4 * 12 + pc };
      })
      .filter(n => !isNaN(n.pc) && n.pc >= 0)
      .sort((a, b) => a.pitch - b.pitch);

    if (sortedNotes.length < 2) return;

    const positions = _orderedPositions(svg, sortedNotes);
    if (positions.length < 2) return;

    const waypoints = _wormWaypoints(positions, gridNodes);

    // Wrapper group: only opacity differs from active worm
    const wrapper = _el('g', { opacity: String(TRAIL_OPACITY), class: 'tn-prog-trail' });
    const glowGroup = _el('g', { filter: `url(#${FILTER_ID})` });
    const sharpGroup = _el('g');

    if (waypoints.length >= 2) {
      const d = waypoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

      const pathAttrs = {
        d,
        stroke: color,
        'stroke-width': WORM_STROKE_W,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
      };

      glowGroup.appendChild(_el('path', { ...pathAttrs, 'stroke-width': WORM_STROKE_W + 4, opacity: '0.6', class: 'tn-worm-glow' }));
      sharpGroup.appendChild(_el('path', { ...pathAttrs, opacity: '0.9', class: 'tn-trail-path' }));
    }

    for (const pos of positions) {
      const cx = pos.x.toFixed(1);
      const cy = pos.y.toFixed(1);

      glowGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R,
        fill: color, 'fill-opacity': '0.5',
        class: 'tn-worm-node-glow',
      }));

      sharpGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R - 2,
        fill: 'none', stroke: color, 'stroke-width': '3', opacity: '0.9',
        class: 'tn-trail-node',
      }));
    }

    wrapper.appendChild(glowGroup);
    wrapper.appendChild(sharpGroup);
    this._group.appendChild(wrapper);
  }

  /** Render the active chord with full glow (same as single-chord mode). */
  _renderActiveChord(svg, chord, color, gridNodes) {
    const sortedNotes = (chord.notes || [])
      .map(note => {
        const pc = noteToPC(note);
        return { note, octave: 4, pc, pitch: 4 * 12 + pc };
      })
      .filter(n => !isNaN(n.pc) && n.pc >= 0)
      .sort((a, b) => a.pitch - b.pitch);

    if (sortedNotes.length < 2) return;

    const positions = _orderedPositions(svg, sortedNotes);
    if (positions.length < 2) return;

    const waypoints = _wormWaypoints(positions, gridNodes);

    const glowGroup = _el('g', { filter: `url(#${FILTER_ID})`, opacity: '0.85' });
    const sharpGroup = _el('g');

    if (waypoints.length >= 2) {
      const d = waypoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

      const pathAttrs = {
        d,
        stroke: color,
        'stroke-width': WORM_STROKE_W,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
      };

      glowGroup.appendChild(_el('path', { ...pathAttrs, 'stroke-width': WORM_STROKE_W + 4, opacity: '0.6', class: 'tn-worm-glow' }));
      sharpGroup.appendChild(_el('path', { ...pathAttrs, opacity: '0.9', class: 'tn-worm-path' }));
    }

    for (const pos of positions) {
      const cx = pos.x.toFixed(1);
      const cy = pos.y.toFixed(1);

      glowGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R,
        fill: color, 'fill-opacity': '0.5',
        class: 'tn-worm-node-glow',
      }));

      sharpGroup.appendChild(_el('circle', {
        cx, cy, r: GLOW_NODE_R - 2,
        fill: 'none', stroke: color, 'stroke-width': '3', opacity: '0.9',
        class: 'tn-worm-node-ring',
      }));
    }

    this._group.appendChild(glowGroup);
    this._group.appendChild(sharpGroup);

    // Chord label is drawn by tonnetz-neighborhood.js; nothing to do here.
  }

  /**
   * Briefly highlight common-tone nodes with a gold pulse.
   * Uses CSS animation for a ~500ms fade-out.
   */
  _renderCommonTonePulse(svg, commonToneNames) {
    const commonPCs = new Set(commonToneNames.map(n => noteToPC(n)));
    const g = _el('g', { class: 'tn-common-tone-pulse' });

    for (const el of svg.querySelectorAll('.tn-node')) {
      const pc = parseInt(el.getAttribute('data-pc'), 10);
      if (isNaN(pc) || !commonPCs.has(pc)) continue;
      const pos = _pos(el);
      if (!pos) continue;

      const circle = _el('circle', {
        cx: pos.x.toFixed(1),
        cy: pos.y.toFixed(1),
        r: COMMON_TONE_R,
        fill: COMMON_TONE_COLOR,
        'fill-opacity': '0.8',
        class: 'tn-common-tone-dot',
      });

      // Animate opacity fade
      const anim = document.createElementNS(SVG_NS, 'animate');
      anim.setAttribute('attributeName', 'fill-opacity');
      anim.setAttribute('from', '0.8');
      anim.setAttribute('to', '0');
      anim.setAttribute('dur', '0.5s');
      anim.setAttribute('fill', 'freeze');
      circle.appendChild(anim);

      g.appendChild(circle);
    }

    this._group.appendChild(g);
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
