/**
 * cantor-view.js
 * ==============
 * Sibling visualization to HarmonographView for the /cantor route.
 *
 * v1 layer: static Tonnetz substrate + chord-wash on activeTriads
 * (per docs/cantor-design.md §5–6).
 *
 * Two lattice modes (selected via `params.mode3D`, default true):
 *   2D — 7×5 lattice, static (col, row) → (x, y) layout. Substrate
 *        renders dim node dots + faint triangle outlines.
 *   3D — 12×4 toroidal lattice, (col, row) → (u, v) parametric coords
 *        projected per-frame to screen space via _projectNodes3D.
 *        Substrate renders dim node dots + 96 faint toroidal edges
 *        (no triangle outlines — Cantor only renders ACTIVE triads;
 *        the 96 triangles are a lookup table for valid triad node
 *        combinations on the torus, not always-on visual scaffold).
 *        Back-face attenuation in [0.2, 1.0] dims far-side geometry.
 *
 * 6A bakes in a fixed rotation (rotX=30°, rotY=45°, rotZ=0°) so the
 * shape reads as 3D without any animation. 6B will introduce per-frame
 * drift and breathing.
 *
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
 *   - Slow torus drift + decorative breathing (6B)
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

// 3D mode: P5 → u (12-step cycle around the big ring), m3 → v (4-step
// cycle around the tube). 12·4 = 48 nodes; each PC appears 4× on the
// surface (one per row).
const GRID_COLS_3D = 12;
const GRID_ROWS_3D = 4;

// Offsets of a node's six Tonnetz neighbors (dcol, drow):
//   [ +P5, −P5, +M3, −M3, +m3, −m3 ]
const NEIGHBOR_OFFSETS_3D = [
  [1, 0], [-1, 0],   // P5
  [1, -1], [-1, 1],   // M3
  [0, 1], [0, -1],   // m3
];

// Static rotation for 6A — torus orientation baked in. 6B will replace
// these with per-frame drift + breathing.
const ROT_X_DEFAULT = 30 * Math.PI / 180;
const ROT_Y_DEFAULT = 45 * Math.PI / 180;
const ROT_Z_DEFAULT = 0;

// Torus geometry (matches harmonograph-view.js defaults). Cantor never
// morphs toward a sphere, so morph is always 0.
const TORUS_MAJOR_R = 1.0;
const TORUS_MINOR_R = 0.4;

// ── Wash colors per chord quality / chord type ───────────────────
//
// Starting palette per docs/cantor-design.md §5; sevenths warm/cool
// to track their base triad while shifting hue. Cantor reads
// activeChord.type when a 7th sits on top of the active triad so
// the wash hue tracks "this is a dom7" vs "this is plain major".
const QUALITY_COLORS = {
  // Triads
  major: '#D4A03C',
  minor: '#3C7FA0',
  diminished: '#A04545',
  augmented: '#7A4FA0',
  // Suspended
  sus2: '#5A8A8A',
  sus4: '#5A8A8A',
  '7sus4': '#5A8A8A',
  // Sevenths — warmer/cooler shifts of their base
  maj7: '#E5B450',
  dom7: '#D4C03C',
  min7: '#2D6580',
  dim7: '#7A2525',
  'half-dim7': '#7A2525',
  minmaj7: '#2D6580',
  // Higher extensions fall back to seventh / triad family
  add9: '#D4A03C',
  dom9: '#D4C03C',
  maj9: '#E5B450',
  min9: '#2D6580',
};
const FALLBACK_COLOR = '#808080';

// ── Wash alphas & timing ─────────────────────────────────────────
const AMBIENT_NODE_ALPHA = 0.30;
const FLASH_PEAK_ALPHA = 0.70;
const FILL_ALPHA_RATIO = 0.40;   // fillAlpha = nodeAlpha * 0.40 → ambient ≈ 0.12
const SEVENTH_NODE_ALPHA = 0.15;
const TIME_CONSTANT_MS = 400;
const FADE_LIMIT_MS = 5 * TIME_CONSTANT_MS;  // prune leaving entries past this

// ── Substrate ────────────────────────────────────────────────────
const SUBSTRATE_NODE_COLOR = '#1a1a1a';
const SUBSTRATE_NODE_RING = 'rgba(255, 255, 255, 0.06)';
const SUBSTRATE_TRI_STROKE = 'rgba(255, 255, 255, 0.05)';
const SUBSTRATE_NODE_RADIUS_F = 0.18;  // fraction of min cell-dim

// ── Melody constellation (Dancer's Body) ─────────────────────────
// Default split sits mid-keyboard for the visible C4–C6 range so a
// fresh load shows a clear "melody above, accompaniment below" region;
// overridable via setSplitPoint (cantor.html persists user choice).
const MELODY_SPLIT_PITCH_DEFAULT = 72;  // C5
const MELODY_WINDOW_S = 2.0;    // hard prune past this age
const MELODY_DECAY_TAU_S = 1.0;    // exp(-age/τ): 2s → ~0.14 opacity
const MELODY_LIT_NODE_F = 1.7;    // bright inner core radius (× substrate node)
const MELODY_GLOW_RADIUS_F = 2.0;    // outer halo extends 2× past the core
const MELODY_NEUTRAL_COLOR = '#D4A03C';  // warm gold — "no chord context"

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
    const tRoot = _rootPC(triad.root);
    if (acRoot === tRoot && activeChord.quality === triad.quality) {
      return activeChord.type || triad.quality;
    }
  }
  return triad.quality;
}

export class CantorView {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // Lattice
    //   2D mode: nodes carry { col, row, x, y, pc }
    //   3D mode: nodes carry { col, row, u, v, pc } and per-frame screen
    //            positions are recomputed in _projectNodes3D.
    // Triangles in 2D: { a, b, c }. In 3D: { a, b, c, type } where
    // type ∈ {'major', 'minor'} is used to match against triad quality
    // when picking the wash candidate.
    this.nodes = [];
    this.triangles = [];
    this.edges = [];   // 3D mode only — 96 toroidal edges
    this._nodesByPC = Array.from({ length: 12 }, () => []);
    this._nodeBaseR = 8;

    // Per-frame screen-space cache for 3D mode: parallel to this.nodes
    //   { x, y, nz, alphaFactor }
    // `nz` is the rotated outward-normal z-component (∈ [-1, 1]); used
    // for back-face alpha attenuation on nodes and as a fast tiebreak on
    // edges. Recomputed every frame in _projectNodes3D.
    this._nodeScreen = [];

    // Live params. Only mode3D is user-facing in v1 (toggle via
    // `cantorView.params.mode3D = false` in the dev console).
    this.params = {
      mode3D: true,
      torusMajorR: TORUS_MAJOR_R,
      torusMinorR: TORUS_MINOR_R,
      paused: false,
    };

    // 3D rotation state. Static for 6A; 6B introduces per-frame drift.
    this._rotX = ROT_X_DEFAULT;
    this._rotY = ROT_Y_DEFAULT;
    this._rotZ = ROT_Z_DEFAULT;
    this._projScale = 1;     // k — orthographic scale, set in _resize

    // Tracks the lattice mode last built so a dev-console mutation of
    // `params.mode3D` can trigger a lazy rebuild on the next frame.
    this._lastBuiltMode3D = null;

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

    // Per-frame map of pc → nodeIdx for vertices of currently-rendered
    // wash triangles. Populated in the wash loop after a wash picks its
    // triangle; consumed in the constellation render so a melody note
    // whose PC matches a wash vertex snaps to that exact lattice node
    // rather than guessing via screen-space proximity (which picks the
    // wrong instance on the 3D torus where each PC appears 4×).
    this._activeWashVertices = new Map();

    // Melody/accompaniment split. Notes with pitch > _splitPoint feed the
    // constellation; pitch ≤ _splitPoint are accompaniment (chord-detection
    // input only). User-configurable via setSplitPoint(); cantor.html
    // persists the chosen value in localStorage.
    this._splitPoint = MELODY_SPLIT_PITCH_DEFAULT;

    this._rafId = null;
    this._unsubHarmony = null;
    this._unsubStream = null;
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
      if (!this.params.paused) this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  /** Force a single render frame regardless of pause state. */
  renderOnce() {
    if (!this.ctx) return;
    this._render();
  }

  destroy() {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    if (this._unsubHarmony) { this._unsubHarmony(); this._unsubHarmony = null; }
    if (this._unsubStream) { this._unsubStream(); this._unsubStream = null; }
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
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Orthographic scale for 3D mode. Same formula as
    // harmonograph-view.js _resize: fit a torus of (R + r) into ~70% of
    // the smaller canvas dimension.
    const fit = Math.min(this.width, this.height) * 0.35;
    this._projScale = fit / (this.params.torusMajorR + this.params.torusMinorR);

    this._buildLattice();
  }

  // ── Lattice ─────────────────────────────────────────────────────

  _buildLattice() {
    if (this.params.mode3D) {
      this._buildLattice3D();
    } else {
      this._buildLattice2D();
    }
    this._lastBuiltMode3D = !!this.params.mode3D;
  }

  _buildLattice2D() {
    const W = this.width, H = this.height;
    const padX = Math.max(24, W * 0.06);
    const padY = Math.max(24, H * 0.10);

    // Total horizontal extent: (cols−1) cells + half-cell skew per row
    const dx = (W - 2 * padX) / (GRID_COLS - 1 + (GRID_ROWS - 1) * 0.5);
    const dy = (H - 2 * padY) / (GRID_ROWS - 1);
    const originX = padX;
    const originY = padY;

    // Clear 3D-only state on the way back so a toggle 3D → 2D doesn't
    // leave stale indices in _nodesByPC / edges / _nodeScreen.
    this.nodes = [];
    this.edges = [];
    this._nodesByPC = Array.from({ length: 12 }, () => []);
    this._nodeScreen = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = originX + col * dx + row * (dx / 2);
        const y = originY + row * dy;
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
          const a = idxAt(col, row);
          const b = idxAt(col + 1, row);
          const c = idxAt(col + 1, row - 1);
          if (a >= 0 && b >= 0 && c >= 0) this.triangles.push({ a, b, c });
        }
        if (row < GRID_ROWS - 1) {
          const a = idxAt(col, row);
          const b = idxAt(col + 1, row);
          const c = idxAt(col, row + 1);
          if (a >= 0 && b >= 0 && c >= 0) this.triangles.push({ a, b, c });
        }
      }
    }

    this._nodeBaseR = Math.max(4, Math.min(dx, dy) * SUBSTRATE_NODE_RADIUS_F);
  }

  // 3D mode: 12 cols × 4 rows on a toroidal surface. Nodes carry
  // parametric (u, v) coords; canvas positions are recomputed per-frame
  // in _projectNodes3D from current rotation state. Edges wrap toroidally
  // so every node has all six Tonnetz neighbors. 96 triangles total —
  // every cell yields one major (upward) and one minor (downward) triad,
  // with no boundary gaps because the lattice wraps on both axes.
  _buildLattice3D() {
    const COLS = GRID_COLS_3D;
    const ROWS = GRID_ROWS_3D;
    const dU = (Math.PI * 2) / COLS;
    const dV = (Math.PI * 2) / ROWS;

    this.nodes = [];
    this._nodesByPC = Array.from({ length: 12 }, () => []);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const u = col * dU;
        const v = row * dV;
        const pc = ((7 * col + 3 * row) % 12 + 12) % 12;
        const idx = this.nodes.length;
        this.nodes.push({ col, row, u, v, pc });
        this._nodesByPC[pc].push(idx);
      }
    }

    const idxAt = (col, row) => row * COLS + col;

    // Toroidal edges (P5/M3/m3 neighbors), deduped.
    const seen = new Set();
    this.edges = [];
    for (const n of this.nodes) {
      const a = idxAt(n.col, n.row);
      for (const [dc, dr] of NEIGHBOR_OFFSETS_3D) {
        const c2 = ((n.col + dc) % COLS + COLS) % COLS;
        const r2 = ((n.row + dr) % ROWS + ROWS) % ROWS;
        const b = idxAt(c2, r2);
        const key = a < b ? (a + ',' + b) : (b + ',' + a);
        if (seen.has(key)) continue;
        seen.add(key);
        this.edges.push([a, b]);
      }
    }

    // 96 triangles total (used as a *lookup table* for valid triad
    // node combinations on the torus, not always-on visual scaffold).
    // Winding chosen so (p1 − p0) × (p2 − p0) points outward from the
    // surface at morph=0:
    //   Upward (major):
    //     v0 = (col,           row)
    //     v1 = (col+1 mod 12, (row−1+4) mod 4)
    //     v2 = (col+1 mod 12,  row)
    //   Downward (minor):
    //     v0 = (col,           row)
    //     v1 = (col+1 mod 12,  row)
    //     v2 = (col,          (row+1) mod 4)
    this.triangles = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cNext = (col + 1) % COLS;
        const rPrev = (row - 1 + ROWS) % ROWS;
        const rNext = (row + 1) % ROWS;
        this.triangles.push({
          a: idxAt(col, row),
          b: idxAt(cNext, rPrev),
          c: idxAt(cNext, row),
          type: 'major',
        });
        this.triangles.push({
          a: idxAt(col, row),
          b: idxAt(cNext, row),
          c: idxAt(col, rNext),
          type: 'minor',
        });
      }
    }

    // Node radius scales with projection scale so dot size tracks the
    // canvas the projected torus actually fills.
    const k = this._projScale;
    this._nodeBaseR = Math.max(4, k * 0.05);

    // Pre-allocate the per-frame screen-cache parallel to nodes.
    this._nodeScreen = new Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      this._nodeScreen[i] = { x: 0, y: 0, nz: 0, alphaFactor: 1 };
    }
  }

  // ── 3D math (DUPLICATED from harmonograph-view.js) ──────────────
  //
  // TODO: Extract shared 3D torus geometry into static/shared/torus-geometry.js
  // and import here + in harmonograph-view.js. Duplicating for v1 to honor
  // the "do not touch harmonograph" scope rule.
  //
  // Cantor doesn't morph toward a sphere, so _uvToXYZ here is the pure
  // torus parameterization with the morph branch dropped. _rotate3D and
  // _projectOrtho are byte-for-byte equivalents of harmonograph's.

  _uvToXYZ(u, v) {
    const R = this.params.torusMajorR;
    const r = this.params.torusMinorR;
    const cu = Math.cos(u), su = Math.sin(u);
    const cv = Math.cos(v), sv = Math.sin(v);
    return {
      x: (R + r * cv) * cu,
      y: (R + r * cv) * su,
      z: r * sv,
    };
  }

  // Apply rotations around world X, then Y, then Z (Euler XYZ).
  _rotate3D(p) {
    let x = p.x, y = p.y, z = p.z;
    // X
    const cx = Math.cos(this._rotX), sx = Math.sin(this._rotX);
    let y1 = y * cx - z * sx;
    let z1 = y * sx + z * cx;
    y = y1; z = z1;
    // Y
    const cy = Math.cos(this._rotY), sy = Math.sin(this._rotY);
    let x2 = x * cy + z * sy;
    let z2 = -x * sy + z * cy;
    x = x2; z = z2;
    // Z
    const cz = Math.cos(this._rotZ), sz = Math.sin(this._rotZ);
    let x3 = x * cz - y * sz;
    let y3 = x * sz + y * cz;
    x = x3; y = y3;
    return { x, y, z };
  }

  // Orthographic projection: drop z, scale by k, center on canvas. Y is
  // flipped so +y points up in world space.
  _projectOrtho(p) {
    const k = this._projScale;
    return {
      screenX: this.width / 2 + k * p.x,
      screenY: this.height / 2 - k * p.y,
      depth: p.z,
    };
  }

  /**
   * Per-frame: project every lattice node to screen space and compute
   * its outward-normal alpha attenuation factor. Populates _nodeScreen
   * in place. The outward normal at (u, v) in local torus space is
   * (cos(u)·cos(v), sin(u)·cos(v), sin(v)); rotate it through _rotate3D
   * and use the rotated nz as the facing value.
   */
  _projectNodes3D() {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const p = this._rotate3D(this._uvToXYZ(n.u, n.v));
      const s = this._projectOrtho(p);

      const cu = Math.cos(n.u), su = Math.sin(n.u);
      const cv = Math.cos(n.v), sv = Math.sin(n.v);
      const nrm = this._rotate3D({ x: cu * cv, y: su * cv, z: sv });
      const nz = nrm.z;  // already unit-length (rotation preserves norm)
      const alphaFactor = Math.max(0.2, Math.min(1.0, 0.6 + 0.4 * nz));

      const cache = this._nodeScreen[i];
      cache.x = s.screenX;
      cache.y = s.screenY;
      cache.nz = nz;
      cache.alphaFactor = alphaFactor;
    }
  }

  // ── HarmonyState diff → render list ─────────────────────────────

  _onHarmonyState(state) {
    const now = Date.now();
    const triads = state.activeTriads || [];
    const ac = state.activeChord || null;

    const incoming = new Set();

    for (const t of triads) {
      if (!t || t.quality == null || t.root == null) continue;
      const rootPC = _rootPC(t.root);
      if (isNaN(rootPC)) continue;

      const triPCsArr = triadPCs(rootPC, t.quality);
      if (!triPCsArr || triPCsArr.length !== 3) continue;

      const key = `${rootPC}_${t.quality}`;
      incoming.add(key);

      const colorHex = QUALITY_COLORS[_colorKeyFor(t, ac)]
        || QUALITY_COLORS[t.quality]
        || FALLBACK_COLOR;
      const seventhPC = _seventhPCFor(ac, rootPC);

      const existing = this._renderList.get(key);
      if (existing && existing.state !== 'leaving') {
        // Already entering or ambient — refresh data without resetting state.
        existing.seventhPC = seventhPC;
        existing.color = colorHex;
        existing.rgb = _hexToRGB(colorHex);
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

    const v = (typeof ev.velocity === 'number') ? Math.max(0, Math.min(1, ev.velocity)) : 0.7;
    const ts = (typeof ev.timestamp === 'number') ? ev.timestamp : Date.now();

    const existing = this._melodyNotes.get(ev.pitch);
    if (existing) {
      // Repeated note — refresh timestamp, brighten via max-velocity.
      existing.timestamp = ts;
      existing.velocity = Math.max(existing.velocity, v);
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

  /**
   * Dev-only: deterministically test the constellation snap path. Sets a
   * single triad on HarmonyState, renders once to populate the wash map,
   * then for each pc in `notePCs` publishes a melody noteAttack and
   * inspects how the constellation would resolve that pc's position.
   *
   * Bypasses MIDI input, audio chord detection, and rAF timing — call
   * straight from the console for a one-shot pass/fail.
   *
   *   cantorView._testSnap('E', 'minor', [4, 7, 11])
   */
  _testSnap(triadRoot, triadQuality, notePCs) {
    this._melodyNotes.clear();
    HarmonyState.clearAll();
    HarmonyState.setTriad(triadRoot, triadQuality);

    this.renderOnce();

    const washVertices = [];
    for (const [pc, nodeIdx] of this._activeWashVertices) {
      let x, y;
      if (this.params.mode3D) {
        const s = this._nodeScreen[nodeIdx];
        x = s.x; y = s.y;
      } else {
        const n = this.nodes[nodeIdx];
        x = n.x; y = n.y;
      }
      washVertices.push({ pc, nodeIdx, x, y });
    }
    const washPCSet = new Set(washVertices.map(v => v.pc));

    const notes = [];
    let allPass = true;
    for (const pc of notePCs) {
      // Force the injected midi above the split point so it enters the
      // melody buffer regardless of where the user has the split set.
      let midi = ((pc % 12) + 12) % 12;
      while (midi <= this._splitPoint) midi += 12;

      MusicalEventStream.publish({
        type: 'noteAttack',
        pitch: midi,
        velocity: 0.8,
        source: 'test',
        timestamp: Date.now(),
      });

      this.renderOnce();

      const washNodeIdx = this._activeWashVertices.has(pc)
        ? this._activeWashVertices.get(pc)
        : null;

      let glyphX = null, glyphY = null;
      if (washNodeIdx != null) {
        if (this.params.mode3D) {
          const s = this._nodeScreen[washNodeIdx];
          glyphX = s.x; glyphY = s.y;
        } else {
          const n = this.nodes[washNodeIdx];
          glyphX = n.x; glyphY = n.y;
        }
      } else {
        const triads = HarmonyState.get().activeTriads || [];
        let anchor = null;
        if (triads.length > 0) {
          const tg = this._triadNodeXYs(triads[0]);
          if (tg) {
            const [a, b, c] = tg.xys;
            anchor = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
          }
        }
        const node = this._findNodeForPitch(pc, anchor);
        if (node) { glyphX = node.x; glyphY = node.y; }
      }

      const snapped = washNodeIdx != null;
      if (!washPCSet.has(pc) || !snapped) allPass = false;

      notes.push({ pc, snapped, washNodeIdx, glyphX, glyphY });
    }

    return {
      triad: { root: triadRoot, quality: triadQuality },
      washVertices,
      notes,
      pass: allPass,
    };
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

    const ctx = this.ctx;
    const baseR = this._nodeBaseR;
    const litR = baseR * MELODY_LIT_NODE_F;     // chord-wash node radius
    const glowR = litR * MELODY_GLOW_RADIUS_F;

    const [r, g, b] = _hexToRGB(this._melodyColor());

    // When a triad is active, anchor the per-note PC lookup at the
    // wash centroid so a melody triad coalesces on the wash's three
    // corners instead of scattering across independent lattice cells.
    // In 3D the centroid is recomputed from current-frame projected
    // positions — never cached across frames.
    const triads = HarmonyState.get().activeTriads || [];
    let frameAnchor = null;
    if (triads.length > 0) {
      const tg = this._triadNodeXYs(triads[0]);
      if (tg) {
        const [a, b, c] = tg.xys;
        frameAnchor = {
          x: (a.x + b.x + c.x) / 3,
          y: (a.y + b.y + c.y) / 3,
        };
      }
    }

    const expired = [];
    for (const [pitch, note] of this._melodyNotes) {
      const age = (now - note.timestamp) / 1000;
      if (age > MELODY_WINDOW_S) { expired.push(pitch); continue; }

      const opacity = Math.exp(-age / MELODY_DECAY_TAU_S);
      const brightness = Math.max(0.5, Math.min(1.0, 0.5 + note.velocity * 0.5));

      const pc = ((pitch % 12) + 12) % 12;

      // If this PC is a vertex of an active wash triangle, snap to the
      // wash's chosen lattice node directly. The wash has already made
      // the authoritative pick; skip _findNodeForPitch's proximity logic
      // (which on the 3D torus often picks the wrong instance of a PC
      // that appears 4× across the surface).
      let node = null;
      const washNodeIdx = this._activeWashVertices.get(pc);

      if (washNodeIdx != null) {
        if (this.params.mode3D) {
          const s = this._nodeScreen[washNodeIdx];
          node = { x: s.x, y: s.y, alphaFactor: s.alphaFactor };
        } else {
          const n = this.nodes[washNodeIdx];
          node = { x: n.x, y: n.y, alphaFactor: 1.0 };
        }
      } else {
        node = this._findNodeForPitch(pc, frameAnchor);
      }
      if (!node) continue;

      // alphaFactor = 1 in 2D, [0.2, 1.0] in 3D from the chosen node's
      // outward normal facing.
      const alpha = opacity * brightness * node.alphaFactor;
      if (alpha < 0.005) continue;

      // Two-pass: soft outer halo first, then hot inner core on top.
      // The halo carries presence; the core makes the played note read
      // as a discrete glyph rather than a vague glow.
      const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
      halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.55).toFixed(3)})`);
      halo.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.30).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
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

  /**
   * Three screen-space node positions {x, y} plus a back-face attenuation
   * factor for a triad's wash. Shared by the wash render path and the
   * melody constellation so a melody triad coalesces on the same triangle
   * the wash is rendering.
   *
   * 2D mode: closest-to-canvas-center triangle with matching PCs.
   *          alphaFactor is always 1.0.
   * 3D mode: candidates are triangles whose 3 vertex PCs match the triad
   *          AND whose `type` matches its quality; pick the most
   *          viewer-facing one (highest nz/nlen of surface normal).
   *          alphaFactor = 0.6 + 0.4 · (nz/nlen), clamped to [0.2, 1.0].
   *          Returns null for dim/aug/sus qualities — they don't fit a
   *          Tonnetz triangle.
   *
   * Returns null when no triangle matches.
   */
  _triadNodeXYs(triad) {
    if (!triad || triad.quality == null || triad.root == null) return null;
    const rootPC = _rootPC(triad.root);
    if (isNaN(rootPC)) return null;
    const triPCsArr = triadPCs(rootPC, triad.quality);
    if (!triPCsArr || triPCsArr.length !== 3) return null;
    const target = new Set(triPCsArr);
    if (target.size !== 3) return null;

    if (this.params.mode3D) {
      const wantType = (triad.quality === 'major') ? 'major'
        : (triad.quality === 'minor') ? 'minor'
          : null;
      if (wantType == null) return null;

      let bestTri = null, bestFacing = -Infinity;
      for (const tri of this.triangles) {
        if (tri.type !== wantType) continue;
        const pa = this.nodes[tri.a];
        const pb = this.nodes[tri.b];
        const pc = this.nodes[tri.c];
        const set = new Set([pa.pc, pb.pc, pc.pc]);
        if (set.size !== 3) continue;
        let match = true;
        for (const t of target) if (!set.has(t)) { match = false; break; }
        if (!match) continue;

        const p0r = this._rotate3D(this._uvToXYZ(pa.u, pa.v));
        const p1r = this._rotate3D(this._uvToXYZ(pb.u, pb.v));
        const p2r = this._rotate3D(this._uvToXYZ(pc.u, pc.v));
        const e1x = p1r.x - p0r.x, e1y = p1r.y - p0r.y, e1z = p1r.z - p0r.z;
        const e2x = p2r.x - p0r.x, e2y = p2r.y - p0r.y, e2z = p2r.z - p0r.z;
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const nlen = Math.hypot(nx, ny, nz);
        if (nlen < 1e-8) continue;
        const facing = nz / nlen;
        if (facing > bestFacing) {
          bestFacing = facing;
          bestTri = tri;
        }
      }
      if (!bestTri) return null;
      const sa = this._nodeScreen[bestTri.a];
      const sb = this._nodeScreen[bestTri.b];
      const sc = this._nodeScreen[bestTri.c];
      const alphaFactor = Math.max(0.2, Math.min(1.0, 0.6 + 0.4 * bestFacing));
      return {
        xys: [{ x: sa.x, y: sa.y }, { x: sb.x, y: sb.y }, { x: sc.x, y: sc.y }],
        nodeIndices: [bestTri.a, bestTri.b, bestTri.c],
        pcs: [this.nodes[bestTri.a].pc, this.nodes[bestTri.b].pc, this.nodes[bestTri.c].pc],
        alphaFactor,
      };
    }

    // 2D: closest to canvas center.
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
    if (!best) return null;
    const a = this.nodes[best.a];
    const b = this.nodes[best.b];
    const c = this.nodes[best.c];
    return {
      xys: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: c.x, y: c.y }],
      nodeIndices: [best.a, best.b, best.c],
      pcs: [a.pc, b.pc, c.pc],
      alphaFactor: 1.0,
    };
  }

  /**
   * Closest node-with-pitch-class-`pc` to anchorXY (or canvas center if
   * null). Returns { x, y, alphaFactor } or null.
   *
   * 2D: iterates all nodes filtered by pc; alphaFactor is always 1.0.
   * 3D: iterates the 4 instances of `pc` on the toroidal lattice,
   *     using current-frame screen positions from _nodeScreen, and
   *     returns the per-node back-face alphaFactor.
   */
  _findNodeForPitch(pc, anchorXY = null) {
    const ax = anchorXY ? anchorXY.x : this.width / 2;
    const ay = anchorXY ? anchorXY.y : this.height / 2;

    if (this.params.mode3D) {
      const indices = this._nodesByPC[pc];
      if (!indices || indices.length === 0) return null;
      let bestIdx = -1, bestDist = Infinity;
      for (const i of indices) {
        const s = this._nodeScreen[i];
        const d = Math.hypot(s.x - ax, s.y - ay);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      if (bestIdx < 0) return null;
      const s = this._nodeScreen[bestIdx];
      return { x: s.x, y: s.y, alphaFactor: s.alphaFactor };
    }

    let best = null, bestDist = Infinity;
    for (const n of this.nodes) {
      if (n.pc !== pc) continue;
      const d = Math.hypot(n.x - ax, n.y - ay);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (!best) return null;
    return { x: best.x, y: best.y, alphaFactor: 1.0 };
  }

  _render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.width, H = this.height;
    const now = Date.now();

    // Dev-console toggle: `cantorView.params.mode3D = false` should
    // switch to the 2D path next frame. Detect a drift from the
    // last-built lattice and rebuild before any other reads.
    if (!!this.params.mode3D !== this._lastBuiltMode3D) {
      this._buildLattice();
    }

    this._pruneAndPromote(now);

    // 3D mode: project the lattice once per frame so substrate, wash,
    // and constellation all read from the same screen-space cache.
    if (this.params.mode3D) this._projectNodes3D();

    // Reset the per-frame wash-vertex map; the wash loop below repopulates
    // it for each visible wash so the constellation can snap PC-matched
    // glyphs onto the same lattice nodes.
    this._activeWashVertices.clear();

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const baseR = this._nodeBaseR;

    if (this.params.mode3D) {
      // ── 3D substrate: faint toroidal edges + dim node dots ────
      // Triangle outlines are NOT drawn in 3D — Cantor renders only
      // active triads; the 96 triangles are a lookup table for valid
      // triad node combinations, not visual scaffold.
      ctx.lineWidth = 1;
      for (const [ai, bi] of this.edges) {
        const sa = this._nodeScreen[ai];
        const sb = this._nodeScreen[bi];
        const af = (sa.alphaFactor + sb.alphaFactor) * 0.5;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.05 * af).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
      }

      for (let i = 0; i < this.nodes.length; i++) {
        const s = this._nodeScreen[i];
        const af = s.alphaFactor;
        ctx.fillStyle = `rgba(26, 26, 26, ${af.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, baseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.06 * af).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, baseR, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // ── 2D substrate: faint triangle outlines + dim node dots ──
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
    }

    // ── Render list washes ────────────────────────────────────
    const list = [...this._renderList.values()];

    // Saturation scaling (used only when render-list entries carry
    // explicit confidence values — v2 audio chord-detection ambiguity).
    let totalConf = 0;
    let hasConf = false;
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

      const tg = this._triadNodeXYs({ root: entry.rootPC, quality: entry.quality });
      if (!tg) continue;
      const [a, b, c] = tg.xys;
      const af = tg.alphaFactor;

      // Populate snap targets first, regardless of visibility — the
      // constellation needs these even when the wash itself has decayed
      // below the visible threshold, since melody decay (1s τ) outlives
      // wash visibility.
      for (let i = 0; i < 3; i++) {
        this._activeWashVertices.set(tg.pcs[i], tg.nodeIndices[i]);
      }

      const nodeA = stateA * sat * af;
      if (nodeA < 0.005) continue;
      const fillA = nodeA * FILL_ALPHA_RATIO;
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
        const tcx = (a.x + b.x + c.x) / 3;
        const tcy = (a.y + b.y + c.y) / 3;
        const sn = this._findNodeForPitch(entry.seventhPC, { x: tcx, y: tcy });
        if (sn) {
          const sevenA = (SEVENTH_NODE_ALPHA / AMBIENT_NODE_ALPHA)
            * stateA * sat * sn.alphaFactor;
          if (sevenA >= 0.005) {
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
      const ac = state.activeChord;
      const t0 = (state.activeTriads || [])[0];
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
