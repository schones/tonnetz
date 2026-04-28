/**
 * cantor-view.js
 * ==============
 * Sibling visualization to HarmonographView for the /cantor route.
 *
 * v1 layer: static Tonnetz substrate + chord-wash on activeTriads
 * (per docs/cantor-design.md §5–6).
 *
 * The substrate is a 7×5 Tonnetz lattice rendered as dim nodes and
 * faint triangle outlines on the black canvas — felt more than seen.
 * Each currently-active triad lights up its triangle (the three
 * triangle nodes plus a translucent fill) with a quality-tinted
 * wash; chord changes cross-fade — the old wash decays from ambient
 * to zero while the new wash flashes from peak to ambient — both with
 * a ~400ms exponential time constant.
 *
 * Render list — Cantor maintains an internal map of active washes
 * derived from HarmonyState.activeTriads. Each entry keys on
 * (rootPC, baseQuality), so adding a 7th to a held triad does NOT
 * re-trigger the flash (same triangle, just a color shift + seventh
 * dot); switching to a different triad does. Entries carry an
 * optional `confidence` field so a future audio-chord-detection
 * pass can feed multiple ambiguous candidates here and have their
 * saturation scaled by their share of total confidence. v1 only
 * consumes activeTriads, where confidence is undefined and all
 * entries render at full ambient saturation.
 *
 * Future stages (per docs/cantor-design.md §8) will layer in:
 *   - Melody constellation (Dancer's Body) from MusicalEventStream
 *   - Slow torus drift + decorative breathing / 3D projection
 *   - AudioInterpreter wrapping pitch + chord detection (v2)
 *
 * Exposes: class CantorView { init, destroy }
 */

import { noteToPC, triadPCs } from './transforms.js';
import { HarmonyState } from './harmony-state.js';
import { MusicalEventStream } from './musical-event-stream.js';

// ── Tonnetz lattice (canvas-fitted) ──────────────────────────────
//
// 7×5 lattice with the canonical orientation:
//   col +1            → +P5 (+7 st)
//   row +1            → +m3 (+3 st)
//   col +1, row -1    → +M3 (+4 st)
//   PC(col, row) = (7·col + 3·row) mod 12
//
// TODO: factor into a shared canvas-Tonnetz utility — the same
// layout currently lives in harmonograph-view.js, and
// tonnetz-neighborhood.js exposes only an SVG renderer with a
// different coordinate system, so neither is directly reusable here.
const GRID_COLS = 7;
const GRID_ROWS = 5;

// ── Wash colors per chord quality / chord type ───────────────────
//
// Starting palette per docs/cantor-design.md §5; sevenths warm/cool
// to track their base triad while shifting hue. Cantor reads
// activeChord.type when a 7th sits on top of the active triad so
// the wash hue tracks "this is a dom7" vs "this is plain major".
const QUALITY_COLORS = {
  // Triads
  major:       '#D4A03C',
  minor:       '#3C7FA0',
  diminished:  '#A04545',
  augmented:   '#7A4FA0',
  // Suspended
  sus2:        '#5A8A8A',
  sus4:        '#5A8A8A',
  '7sus4':     '#5A8A8A',
  // Sevenths — warmer/cooler shifts of their base
  maj7:        '#E5B450',
  dom7:        '#D4C03C',
  min7:        '#2D6580',
  dim7:        '#7A2525',
  'half-dim7': '#7A2525',
  minmaj7:     '#2D6580',
  // Higher extensions fall back to seventh / triad family
  add9:        '#D4A03C',
  dom9:        '#D4C03C',
  maj9:        '#E5B450',
  min9:        '#2D6580',
};
const FALLBACK_COLOR = '#808080';

// ── Wash alphas & timing ─────────────────────────────────────────
const AMBIENT_NODE_ALPHA = 0.30;
const FLASH_PEAK_ALPHA   = 0.70;
const FILL_ALPHA_RATIO   = 0.40;   // fillAlpha = nodeAlpha * 0.40 → ambient ≈ 0.12
const SEVENTH_NODE_ALPHA = 0.15;
const TIME_CONSTANT_MS   = 400;
const FADE_LIMIT_MS      = 5 * TIME_CONSTANT_MS;  // prune leaving entries past this

// ── Substrate ────────────────────────────────────────────────────
const SUBSTRATE_NODE_COLOR    = '#1a1a1a';
const SUBSTRATE_NODE_RING     = 'rgba(255, 255, 255, 0.06)';
const SUBSTRATE_TRI_STROKE    = 'rgba(255, 255, 255, 0.05)';
const SUBSTRATE_NODE_RADIUS_F = 0.18;  // fraction of min cell-dim

// ── Melody constellation (Dancer's Body) ─────────────────────────
// Default split sits mid-keyboard for the visible C4–C6 range so a
// fresh load shows a clear "melody above, accompaniment below" region;
// overridable via setSplitPoint (cantor.html persists user choice).
const MELODY_SPLIT_PITCH_DEFAULT = 72;  // C5
const MELODY_WINDOW_S       = 2.0;    // hard prune past this age
const MELODY_DECAY_TAU_S    = 1.0;    // exp(-age/τ): 2s → ~0.14 opacity
const MELODY_LIT_NODE_F     = 1.7;    // bright inner core radius (× substrate node)
const MELODY_GLOW_RADIUS_F  = 2.0;    // outer halo extends 2× past the core
const MELODY_NEUTRAL_COLOR  = '#D4A03C';  // warm gold — "no chord context"

// ── Helpers ──────────────────────────────────────────────────────

function _hexToRGB(hex) {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex || '');
  if (!m) return [128, 128, 128];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
}

function _rootPC(root) {
  if (root == null) return NaN;
  if (typeof root === 'number') return ((root % 12) + 12) % 12;
  return noteToPC(root);
}

/** Find the seventh's pitch class from activeChord (if any 7th is present). */
function _seventhPCFor(activeChord, triadRootPC) {
  if (!activeChord || !Array.isArray(activeChord.extensionNotes)) return null;
  const acRootPC = _rootPC(activeChord.root);
  if (acRootPC !== triadRootPC) return null;
  for (const en of activeChord.extensionNotes) {
    const enPC = _rootPC(en);
    if (isNaN(enPC)) continue;
    const interval = ((enPC - triadRootPC) % 12 + 12) % 12;
    if (interval === 9 || interval === 10 || interval === 11) {
      return enPC;
    }
  }
  return null;
}

/**
 * Pick the chord-type key whose color we should use for a triad. If
 * activeChord matches the triad (same root + base quality), prefer
 * its type so 7ths and extensions pull the right hue.
 */
function _colorKeyFor(triad, activeChord) {
  if (activeChord) {
    const acRoot = _rootPC(activeChord.root);
    const tRoot  = _rootPC(triad.root);
    if (acRoot === tRoot && activeChord.quality === triad.quality) {
      return activeChord.type || triad.quality;
    }
  }
  return triad.quality;
}

export class CantorView {
  constructor() {
    this.container = null;
    this.canvas    = null;
    this.ctx       = null;

    this.width  = 0;
    this.height = 0;
    this.dpr    = 1;

    // Lattice
    this.nodes      = [];   // [{ col, row, x, y, pc }]
    this.triangles  = [];   // [{ a, b, c }] — index triples into nodes
    this._nodeBaseR = 8;

    // Render list keyed by `${rootPC}_${baseQuality}`. Stable across
    // chord changes that share a base triad (Cmaj → Cmaj7) so adding
    // a 7th doesn't re-flash; replaced wholesale on different triads.
    this._renderList = new Map();

    // Melody constellation buffer keyed by MIDI pitch.
    //   pitch → { pitch, velocity (0–1), timestamp (ms) }
    // Age-based: notes prune when (now − timestamp)/1000 > MELODY_WINDOW_S
    // regardless of held/released state — the constellation is gesture,
    // not current state, so a 250ms staccato note still glows for ~2s.
    this._melodyNotes = new Map();

    // Melody/accompaniment split. Notes with pitch > _splitPoint feed the
    // constellation; pitch ≤ _splitPoint are accompaniment (chord-detection
    // input only). User-configurable via setSplitPoint(); cantor.html
    // persists the chosen value in localStorage.
    this._splitPoint = MELODY_SPLIT_PITCH_DEFAULT;

    this._rafId         = null;
    this._unsubHarmony  = null;
    this._unsubStream   = null;
    this._resizeHandler = () => this._resize();
    this._lastHeartbeat = 0;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  init(stageElementId) {
    this.container = (typeof stageElementId === 'string')
      ? document.getElementById(stageElementId)
      : stageElementId;
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sl-cantor-canvas';
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', this._resizeHandler);

    // Subscribe to HarmonyState — diff activeTriads into the render
    // list on every update. Seed with the current snapshot so a chord
    // already in flight when /cantor is opened comes through.
    this._unsubHarmony = HarmonyState.on((s) => this._onHarmonyState(s));
    this._onHarmonyState(HarmonyState.get());

    // Subscribe to MusicalEventStream for the melody constellation.
    this._unsubStream = MusicalEventStream.subscribe((ev) => this._onMusicalEvent(ev));

    const loop = () => {
      if (!this.ctx) return;
      this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  destroy() {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    if (this._unsubHarmony) { this._unsubHarmony(); this._unsubHarmony = null; }
    if (this._unsubStream)  { this._unsubStream();  this._unsubStream  = null; }
    window.removeEventListener('resize', this._resizeHandler);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this._renderList.clear();
    this._melodyNotes.clear();
  }

  _resize() {
    if (!this.canvas || !this.ctx || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.width  = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.dpr    = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width  = Math.floor(this.width  * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._buildLattice();
  }

  // ── Lattice ─────────────────────────────────────────────────────

  _buildLattice() {
    const W = this.width, H = this.height;
    const padX = Math.max(24, W * 0.06);
    const padY = Math.max(24, H * 0.10);

    // Total horizontal extent: (cols−1) cells + half-cell skew per row
    const dx = (W - 2 * padX) / (GRID_COLS - 1 + (GRID_ROWS - 1) * 0.5);
    const dy = (H - 2 * padY) / (GRID_ROWS - 1);
    const originX = padX;
    const originY = padY;

    this.nodes = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x  = originX + col * dx + row * (dx / 2);
        const y  = originY + row * dy;
        const pc = ((7 * col + 3 * row) % 12 + 12) % 12;
        this.nodes.push({ col, row, x, y, pc });
      }
    }

    const idxAt = (col, row) =>
      (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS)
        ? -1
        : row * GRID_COLS + col;

    // Triangles — each interior cell yields up to two triads:
    //   upward (major)   = (col, row), (col+1, row), (col+1, row-1)
    //   downward (minor) = (col, row), (col+1, row), (col,   row+1)
    this.triangles = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS - 1; col++) {
        if (row > 0) {
          const a = idxAt(col,     row);
          const b = idxAt(col + 1, row);
          const c = idxAt(col + 1, row - 1);
          if (a >= 0 && b >= 0 && c >= 0) this.triangles.push({ a, b, c });
        }
        if (row < GRID_ROWS - 1) {
          const a = idxAt(col,     row);
          const b = idxAt(col + 1, row);
          const c = idxAt(col,     row + 1);
          if (a >= 0 && b >= 0 && c >= 0) this.triangles.push({ a, b, c });
        }
      }
    }

    this._nodeBaseR = Math.max(4, Math.min(dx, dy) * SUBSTRATE_NODE_RADIUS_F);
  }

  // ── HarmonyState diff → render list ─────────────────────────────

  _onHarmonyState(state) {
    const now    = Date.now();
    const triads = state.activeTriads || [];
    const ac     = state.activeChord  || null;

    const incoming = new Set();

    for (const t of triads) {
      if (!t || t.quality == null || t.root == null) continue;
      const rootPC = _rootPC(t.root);
      if (isNaN(rootPC)) continue;

      const triPCsArr = triadPCs(rootPC, t.quality);
      if (!triPCsArr || triPCsArr.length !== 3) continue;

      const key = `${rootPC}_${t.quality}`;
      incoming.add(key);

      const colorHex  = QUALITY_COLORS[_colorKeyFor(t, ac)]
                     || QUALITY_COLORS[t.quality]
                     || FALLBACK_COLOR;
      const seventhPC = _seventhPCFor(ac, rootPC);

      const existing = this._renderList.get(key);
      if (existing && existing.state !== 'leaving') {
        // Already entering or ambient — refresh data without resetting state.
        existing.seventhPC  = seventhPC;
        existing.color      = colorHex;
        existing.rgb        = _hexToRGB(colorHex);
        existing.confidence = undefined;
      } else {
        // New, or returning while previously fading out — start fresh flash.
        this._renderList.set(key, {
          key, rootPC, quality: t.quality,
          seventhPC,
          color: colorHex,
          rgb: _hexToRGB(colorHex),
          confidence: undefined,
          state: 'entering',
          stateStartedAt: now,
        });
      }
    }

    for (const [key, entry] of this._renderList) {
      if (!incoming.has(key) && entry.state !== 'leaving') {
        entry.state = 'leaving';
        entry.stateStartedAt = now;
      }
    }
  }

  // ── MusicalEventStream → melody buffer ──────────────────────────

  _onMusicalEvent(ev) {
    if (!ev || ev.type !== 'noteAttack') return;       // releases don't affect the buffer
    if (typeof ev.pitch !== 'number') return;
    if (ev.pitch <= this._splitPoint) return;          // accompaniment — chord-detection drives the wash

    const v  = (typeof ev.velocity === 'number') ? Math.max(0, Math.min(1, ev.velocity)) : 0.7;
    const ts = (typeof ev.timestamp === 'number') ? ev.timestamp : Date.now();

    const existing = this._melodyNotes.get(ev.pitch);
    if (existing) {
      // Repeated note — refresh timestamp, brighten via max-velocity.
      existing.timestamp = ts;
      existing.velocity  = Math.max(existing.velocity, v);
    } else {
      this._melodyNotes.set(ev.pitch, { pitch: ev.pitch, velocity: v, timestamp: ts });
    }
  }

  /**
   * Set the melody/accompaniment split. Notes strictly above `midiNote` go
   * into the constellation; notes at or below feed chord-detection only.
   * No-op if `midiNote` isn't an integer in [0, 127].
   */
  setSplitPoint(midiNote) {
    if (typeof midiNote !== 'number' || !Number.isFinite(midiNote)) return;
    const m = Math.round(midiNote);
    if (m < 0 || m > 127) return;
    this._splitPoint = m;
  }

  /** Pick the constellation tint from the FIRST active triad, or warm-gold default. */
  _melodyColor() {
    const state = HarmonyState.get();
    const triads = state.activeTriads || [];
    if (triads.length > 0) {
      const t0 = triads[0];
      if (t0 && t0.quality != null && t0.root != null) {
        const ck = _colorKeyFor(t0, state.activeChord);
        return QUALITY_COLORS[ck] || QUALITY_COLORS[t0.quality] || MELODY_NEUTRAL_COLOR;
      }
    }
    return MELODY_NEUTRAL_COLOR;
  }

  _renderMelodyConstellation(now) {
    if (this._melodyNotes.size === 0) return;

    const ctx   = this.ctx;
    const baseR = this._nodeBaseR;
    const litR  = baseR * MELODY_LIT_NODE_F;     // chord-wash node radius
    const glowR = litR * MELODY_GLOW_RADIUS_F;

    const [r, g, b] = _hexToRGB(this._melodyColor());

    // When a triad is active, anchor the per-note PC lookup at the
    // wash centroid so a melody triad coalesces on the wash's three
    // corners instead of scattering across independent lattice cells.
    const triads = HarmonyState.get().activeTriads || [];
    let frameAnchor = null;
    if (triads.length > 0) {
      const xys = this._triadNodeXYs(triads[0]);
      if (xys) {
        frameAnchor = {
          x: (xys[0].x + xys[1].x + xys[2].x) / 3,
          y: (xys[0].y + xys[1].y + xys[2].y) / 3,
        };
      }
    }

    const expired = [];
    for (const [pitch, note] of this._melodyNotes) {
      const age = (now - note.timestamp) / 1000;
      if (age > MELODY_WINDOW_S) { expired.push(pitch); continue; }

      const opacity    = Math.exp(-age / MELODY_DECAY_TAU_S);
      const brightness = Math.max(0.5, Math.min(1.0, 0.5 + note.velocity * 0.5));
      const alpha      = opacity * brightness;
      if (alpha < 0.005) continue;

      const pc   = ((pitch % 12) + 12) % 12;
      const node = this._findNodeForPitch(pc, frameAnchor);
      if (!node) continue;

      // Two-pass: soft outer halo first, then hot inner core on top.
      // The halo carries presence; the core makes the played note read
      // as a discrete glyph rather than a vague glow.
      const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
      halo.addColorStop(0,    `rgba(${r}, ${g}, ${b}, ${(alpha * 0.55).toFixed(3)})`);
      halo.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.30).toFixed(3)})`);
      halo.addColorStop(1,    `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, litR, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pitch of expired) this._melodyNotes.delete(pitch);
  }

  // ── Render ──────────────────────────────────────────────────────

  _stateAlpha(entry, now) {
    const elapsed = Math.max(0, now - entry.stateStartedAt);
    if (entry.state === 'entering') {
      // Flash → ambient: a + (peak − a) · e^(−t/τ)
      return AMBIENT_NODE_ALPHA
           + (FLASH_PEAK_ALPHA - AMBIENT_NODE_ALPHA)
             * Math.exp(-elapsed / TIME_CONSTANT_MS);
    }
    if (entry.state === 'leaving') {
      return AMBIENT_NODE_ALPHA * Math.exp(-elapsed / TIME_CONSTANT_MS);
    }
    return AMBIENT_NODE_ALPHA;
  }

  _pruneAndPromote(now) {
    const expired = [];
    for (const [key, entry] of this._renderList) {
      const elapsed = now - entry.stateStartedAt;
      if (entry.state === 'leaving' && elapsed > FADE_LIMIT_MS) {
        expired.push(key);
      } else if (entry.state === 'entering' && elapsed > FADE_LIMIT_MS) {
        entry.state = 'ambient';
      }
    }
    for (const key of expired) this._renderList.delete(key);
  }

  /** Triangle whose 3 node-PCs match `triPCs`, closest to canvas center. */
  _findBestTriangle(triPCs) {
    if (!triPCs || triPCs.length !== 3) return null;
    const target = new Set(triPCs);
    if (target.size !== 3) return null;
    const cx = this.width / 2, cy = this.height / 2;
    let best = null, bestDist = Infinity;
    for (const tri of this.triangles) {
      const pa = this.nodes[tri.a];
      const pb = this.nodes[tri.b];
      const pc = this.nodes[tri.c];
      const set = new Set([pa.pc, pb.pc, pc.pc]);
      if (set.size !== 3) continue;
      let match = true;
      for (const t of target) if (!set.has(t)) { match = false; break; }
      if (!match) continue;
      const tcx = (pa.x + pb.x + pc.x) / 3;
      const tcy = (pa.y + pb.y + pc.y) / 3;
      const d = Math.hypot(tcx - cx, tcy - cy);
      if (d < bestDist) { bestDist = d; best = tri; }
    }
    return best;
  }

  /**
   * Three canonical lattice node positions {x, y} for a triad's wash.
   * Shared by the wash render path and the melody constellation so a
   * melody triad coalesces on the same triangle the wash is rendering.
   */
  _triadNodeXYs(triad) {
    if (!triad || triad.quality == null || triad.root == null) return null;
    const rootPC = _rootPC(triad.root);
    if (isNaN(rootPC)) return null;
    const triPCsArr = triadPCs(rootPC, triad.quality);
    if (!triPCsArr || triPCsArr.length !== 3) return null;
    const tri = this._findBestTriangle(triPCsArr);
    if (!tri) return null;
    const a = this.nodes[tri.a];
    const b = this.nodes[tri.b];
    const c = this.nodes[tri.c];
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: c.x, y: c.y }];
  }

  /** Closest node with `pc` to anchorXY, or to canvas center if anchorXY is null. */
  _findNodeForPitch(pc, anchorXY = null) {
    const ax = anchorXY ? anchorXY.x : this.width / 2;
    const ay = anchorXY ? anchorXY.y : this.height / 2;
    let best = null, bestDist = Infinity;
    for (const n of this.nodes) {
      if (n.pc !== pc) continue;
      const d = Math.hypot(n.x - ax, n.y - ay);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  _render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.width, H = this.height;
    const now = Date.now();

    this._pruneAndPromote(now);

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // ── Substrate: faint triangle outlines ─────────────────────
    ctx.strokeStyle = SUBSTRATE_TRI_STROKE;
    ctx.lineWidth = 1;
    for (const tri of this.triangles) {
      const pa = this.nodes[tri.a];
      const pb = this.nodes[tri.b];
      const pc = this.nodes[tri.c];
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.lineTo(pc.x, pc.y);
      ctx.closePath();
      ctx.stroke();
    }

    // ── Substrate: dim node dots ──────────────────────────────
    const baseR = this._nodeBaseR;
    ctx.fillStyle = SUBSTRATE_NODE_COLOR;
    for (const n of this.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = SUBSTRATE_NODE_RING;
    for (const n of this.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Render list washes ────────────────────────────────────
    const list = [...this._renderList.values()];

    // Saturation scaling (used only when render-list entries carry
    // explicit confidence values — v2 audio chord-detection ambiguity).
    let totalConf = 0;
    let hasConf   = false;
    for (const e of list) {
      if (e.confidence != null) {
        hasConf = true;
        totalConf += Math.max(0, e.confidence);
      }
    }

    for (const entry of list) {
      const stateA = this._stateAlpha(entry, now);
      const sat = (hasConf && entry.confidence != null)
        ? (Math.max(0, entry.confidence) / Math.max(1e-6, totalConf))
        : 1.0;
      const nodeA = stateA * sat;
      if (nodeA < 0.005) continue;
      const fillA = nodeA * FILL_ALPHA_RATIO;

      const xys = this._triadNodeXYs({ root: entry.rootPC, quality: entry.quality });
      if (!xys) continue;
      const [a, b, c] = xys;
      const [r, g, bC] = entry.rgb;

      // Triangle wash
      ctx.fillStyle = `rgba(${r}, ${g}, ${bC}, ${fillA.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();

      // Triad nodes — lit a touch larger than substrate dots
      ctx.fillStyle = `rgba(${r}, ${g}, ${bC}, ${nodeA.toFixed(3)})`;
      const litR = baseR * 1.45;
      for (const n of [a, b, c]) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, litR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Seventh node (dim, no wash extension)
      if (entry.seventhPC != null) {
        const sevenA = (SEVENTH_NODE_ALPHA / AMBIENT_NODE_ALPHA) * stateA * sat;
        if (sevenA >= 0.005) {
          const tcx = (a.x + b.x + c.x) / 3;
          const tcy = (a.y + b.y + c.y) / 3;
          const sn = this._findNodeForPitch(entry.seventhPC, { x: tcx, y: tcy });
          if (sn) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${bC}, ${sevenA.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sn.x, sn.y, baseR * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // ── Melody constellation (topmost layer) ──────────────────
    this._renderMelodyConstellation(now);

    // ── Heartbeat: melody buffer size + active chord at a glance ──
    if (now - this._lastHeartbeat >= 1000) {
      this._lastHeartbeat = now;
      const state = HarmonyState.get();
      const ac    = state.activeChord;
      const t0    = (state.activeTriads || [])[0];
      let chordLabel = '—';
      if (ac && ac.symbol) {
        chordLabel = ac.symbol;
      } else if (t0 && t0.root != null && t0.quality) {
        chordLabel = `${t0.root}${t0.quality}`;
      }
      console.log(`[cantor] constellation: ${this._melodyNotes.size} notes, chord: ${chordLabel}`);
    }
  }
}

export default CantorView;
