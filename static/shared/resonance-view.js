/**
 * resonance-view.js
 * =================
 * Tonnetz sparkle-blob visualizer. The invisible Tonnetz grid is the spatial
 * layout; blobs appear at every lattice node whose pitch class is active.
 * Each blob's shape is the FFT spectrum wrapped radially — the same analyser
 * data the Spectrum panel reads linearly, bent into a circle around each node.
 *
 * Reads from:
 *   - HarmonyState (active notes/chords)
 *   - A shared Tone.Analyser passed via setAnalyser()
 *
 * Exposes: class ResonanceView { init, setAnalyser, start, stop, destroy }
 *
 * Temporal alignment with the Spectrum panel
 * ------------------------------------------
 * The Spectrum panel (templates/explorer.html _initSpectrumRenderer) is the
 * reference for how the envelope jitters and how particles attack/decay/cluster.
 * Spatial mapping differs (radial vs linear); timing constants below match.
 *
 *                           Spectrum                  Resonance (before)         Resonance (now)
 *   FFT envelope              raw bins each frame     attack 0.35 / decay 0.9    raw (analyser's
 *                                                     exponential on top of      internal smoothing
 *                                                     analyser smoothing)        only — matches
 *   Particle pool             600                     500                        1200
 *   Spawn threshold           −60 dB                  0.01 linear (≈ −40 dB)     0.001 linear (≈ −60 dB)
 *   Spawn sites per node      top 6 peaks             top 6 peaks                ALL harmonics above thr.
 *   Spawn rate per site       0.35 probabilistic      min(0.9, mag * 2)          min(0.9, mag * 1.6)
 *   Particle lifetime         ~2.08 s (life −= .008)  0.30 – 0.60 s              1.20 – 2.00 s
 *   Initial velocity          ±0.3 H, 0.3 – 0.8 V     0.6 – 1.5 radial           1.1 – 2.1 radial
 *   Angular spread            n/a                     ±15°                       ±30°
 *   Deceleration              none (gravity only)     ×0.96 per frame            none (drift + wiggle)
 *   Wiggle                    sin(life*6) * 0.15      none                       same
 *   Trail fade                0.22 alpha              0.28                       0.22
 *   Envelope stroke           1.2 px, shadowBlur 6    1.5 px, blur 5             1.2 px, blur 6
 *   Particle base size        2.0 – 4.5 px            1.5 – 3.0 px               2.0 – 4.5 px
 *   Glow alpha (inner stop)   0.55 on every particle  0.08 on "hot" only         0.50 on every particle
 *
 * Spectrum's peak-hold line (decays at 0.995/frame) has no equivalent here —
 * the radial envelope has no obvious analogue and adding one would be a
 * feature, not an alignment. Leaving it out.
 */

import { noteToPC } from './transforms.js';
import { HarmonyState } from './harmony-state.js';

// ── Tonnetz grid shape ────────────────────────────────────────────
// Canonical orientation (see explorer-spec.md):
//   horizontal step (col +1)          → +P5 (+7 st)
//   diagonal up-right   (col+1,row-1) → +M3 (+4 st)
//   diagonal down-right (row +1)      → +m3 (+3 st)  [P5 − M3]
//   PC(col, row) = (7·col + 3·row) mod 12
const GRID_COLS = 7;
const GRID_ROWS = 5;

// Offsets of a node's six Tonnetz neighbors (dcol, drow):
//   [ +P5, −P5, +M3, −M3, +m3, −m3 ]
const NEIGHBOR_OFFSETS = [
  [ 1,  0], [-1,  0],   // P5
  [ 1, -1], [-1,  1],   // M3
  [ 0,  1], [ 0, -1],   // m3
];

// ── Harmonic sampling ─────────────────────────────────────────────
const BASE_FREQ   = 130.81;  // C3 — base octave for harmonic 1
const NUM_HARMONICS = 16;
const DB_FLOOR    = -90;

// ── Role colors (same palette as the Spectrum panel) ──────────────
const ROLE_COLORS = {
  root:    [212, 160,  60],
  third:   [232, 116,  97],
  fifth:   [100, 160, 220],
  seventh: [ 80, 175, 130],
};
const DEFAULT_ROLE = 'root';

// ── Smoothing ─────────────────────────────────────────────────────
// HarmonyState gates WHICH pitch classes are allowed to light up — only
// PCs in activeNotes read new FFT data. This prevents harmonic bleed
// (e.g. an F major chord lighting up every node the FFT overlaps).
// When a PC leaves activeNotes its harmonic magnitudes decay by
// RELEASE_DECAY per frame so the blob fades naturally (~0.5 s at 60 fps).
// While active, Spectrum-style raw reads drive the envelope — the
// analyser's own exponential smoothing (Tone.js default 0.8) is enough.
const SILENT_EPS    = 0.001;  // total energy below this → node goes dark
const RELEASE_DECAY = 0.9;    // per-frame multiplier once PC leaves activeNotes

// ── Particle pool ─────────────────────────────────────────────────
// Lifetimes and pool size match Spectrum's ~2 s trails so sustained
// chords reach a similar steady-state particle density.
const PARTICLE_POOL     = 1200;
const PARTICLE_LIFE_MIN = 1.2;
const PARTICLE_LIFE_MAX = 2.0;

// ── Peak markers ──────────────────────────────────────────────────
const PEAK_COUNT         = 6;      // top N harmonics get a bright dot
const HOT_PEAK_COUNT     = 6;      // every marked peak glows (match Spectrum)
const PEAK_MAG_THRESHOLD = 0.001;  // ≈ −60 dB, matches Spectrum spawn floor

function dbToLinear(db) {
  if (db <= DB_FLOOR) return 0;
  return Math.pow(10, db / 20);
}

function linearToDb(lin) {
  if (lin <= 0) return DB_FLOOR;
  const db = 20 * Math.log10(lin);
  return db < DB_FLOOR ? DB_FLOOR : db;
}

function entryToPC(entry) {
  const name = (entry && entry.note != null) ? entry.note : entry;
  if (typeof name !== 'string') return -1;
  const pc = noteToPC(name);
  return Number.isNaN(pc) ? -1 : pc;
}

// ══════════════════════════════════════════════════════════════════
// ResonanceView
// ══════════════════════════════════════════════════════════════════

export class ResonanceView {
  constructor() {
    this.canvas    = null;
    this.ctx       = null;
    this.container = null;
    this.analyser  = null;

    this.width  = 0;
    this.height = 0;
    this.dpr    = 1;

    // Grid nodes for the 7×5 lattice
    this.nodes = [];               // [{ col, row, x, y, pc }]
    this.nodesByPC = Array.from({ length: 12 }, () => []);
    this.edges = [];               // [[nodeIdxA, nodeIdxB], …]

    // Per-PC smoothed harmonic magnitudes + activity state
    this.pcState = new Array(12);
    for (let i = 0; i < 12; i++) {
      this.pcState[i] = {
        harmonics: new Float32Array(NUM_HARMONICS),
        energy: 0,
        active: false,
        role: DEFAULT_ROLE,
      };
    }

    // Particle pool
    this.particles = new Array(PARTICLE_POOL);
    for (let i = 0; i < PARTICLE_POOL; i++) {
      this.particles[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, lifeMax: 1, size: 0, hot: false,
        r: 255, g: 255, b: 255,
      };
    }
    this._spawnCursor = 0;

    this._rafId = null;
    this._running = false;
    this._unsubscribe = null;
    this._resizeHandler = () => this._resize();
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  init(containerId) {
    this.container = (typeof containerId === 'string')
      ? document.getElementById(containerId)
      : containerId;
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sl-resonance-canvas';
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize();
  }

  setAnalyser(analyser) {
    this.analyser = analyser || null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._resize();
    window.addEventListener('resize', this._resizeHandler);

    // Clear all per-PC state and the particle pool so a fresh mount starts
    // dark. Role flags still come from HarmonyState, but nothing renders
    // until the FFT actually has energy at a node's harmonics.
    for (let pc = 0; pc < 12; pc++) {
      const s = this.pcState[pc];
      s.harmonics.fill(0);
      s.energy = 0;
      s.active = false;
      s.role = DEFAULT_ROLE;
    }
    for (let i = 0; i < PARTICLE_POOL; i++) this.particles[i].active = false;

    // Seed with current state so a chord held before the tab mounts is
    // reflected immediately; HarmonyState.on doesn't fire an initial snapshot.
    this._readHarmonyState(HarmonyState.get());
    this._unsubscribe = HarmonyState.on((state) => this._readHarmonyState(state));

    const loop = () => {
      if (!this._running) return;
      this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    window.removeEventListener('resize', this._resizeHandler);
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  }

  destroy() {
    this.stop();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.analyser = null;
  }

  // ── Geometry ──────────────────────────────────────────────────
  _resize() {
    if (!this.canvas || !this.ctx || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.width  = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.dpr    = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width  = Math.floor(this.width  * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._buildGrid();
  }

  _buildGrid() {
    const W = this.width, H = this.height;
    // Horizontal extent is 8·dx (col span 0..6 plus row skew 0..4 × ½),
    // vertical extent is 4·dy.
    const padX = Math.max(24, W * 0.05);
    const padY = Math.max(24, H * 0.08);
    const dx = (W - 2 * padX) / 8;
    const dy = (H - 2 * padY) / 4;
    const originX = padX;
    const originY = padY;

    this.nodes = [];
    this.nodesByPC = Array.from({ length: 12 }, () => []);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x  = originX + col * dx + row * (dx / 2);
        const y  = originY + row * dy;
        const pc = ((7 * col + 3 * row) % 12 + 12) % 12;
        const idx = this.nodes.length;
        this.nodes.push({ col, row, x, y, pc });
        this.nodesByPC[pc].push(idx);
      }
    }

    // Edges: P5 / M3 / m3 neighbors (dedup by storing once per pair)
    const seen = new Set();
    this.edges = [];
    const nodeIdxAt = (col, row) =>
      (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS)
        ? -1
        : row * GRID_COLS + col;
    for (const n of this.nodes) {
      const a = nodeIdxAt(n.col, n.row);
      for (const [dc, dr] of NEIGHBOR_OFFSETS) {
        const b = nodeIdxAt(n.col + dc, n.row + dr);
        if (b < 0) continue;
        const key = a < b ? (a + ',' + b) : (b + ',' + a);
        if (seen.has(key)) continue;
        seen.add(key);
        this.edges.push([a, b]);
      }
    }

    // Node radius scales with grid density
    this._nodeBaseR = Math.max(8, Math.min(dx, dy) * 0.18);
    this._nodeMaxR  = Math.min(dx, dy) * 0.55 * 1.3;
  }

  // ── HarmonyState → role/active flags ──────────────────────────
  _readHarmonyState(state) {
    for (let pc = 0; pc < 12; pc++) {
      this.pcState[pc].active = false;
      this.pcState[pc].role   = DEFAULT_ROLE;
    }
    const notes = Array.isArray(state.activeNotes) ? state.activeNotes : [];
    if (!notes.length) return;

    // Same classification logic as the Spectrum panel: first three non-
    // extension entries are root/third/fifth; anything tagged source:
    // 'extension' gets the seventh palette.
    const triadRoles = ['root', 'third', 'fifth'];
    let triadIdx = 0;
    for (const entry of notes) {
      const pc = entryToPC(entry);
      if (pc < 0) continue;
      const isExt = entry && entry.source === 'extension';
      let role;
      if (isExt) {
        role = 'seventh';
      } else {
        role = triadRoles[triadIdx] || 'fifth';
        triadIdx++;
      }
      const s = this.pcState[pc];
      s.active = true;
      // Prefer the lowest-index role; don't overwrite root with fifth
      // if the same PC shows up twice across octaves.
      if (s.role === DEFAULT_ROLE || triadRoles.indexOf(role) < triadRoles.indexOf(s.role)) {
        s.role = role;
      }
    }
  }

  // ── Render loop ───────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    if (!ctx) return;

    // Trail fade + faint lattice always render — they're ambient.
    // 0.22 alpha matches Spectrum — gives particles a ~2 s visible tail.
    ctx.fillStyle = 'rgba(8, 8, 8, 0.22)';
    ctx.fillRect(0, 0, W, H);
    this._drawGrid();

    // HarmonyState picks WHICH PCs can light up (activeNotes); the FFT
    // shapes HOW they look. Released PCs skip the FFT read and decay
    // out. No audio at an active PC → no blob; active flag alone is
    // never enough to render.
    this._updateHarmonicsFromFFT();
    this._drawBlobs();
    this._updateAndDrawParticles();
  }

  _updateHarmonicsFromFFT() {
    const data = (this.analyser && typeof this.analyser.getValue === 'function')
      ? this.analyser.getValue()
      : null;
    const haveFFT = data && data.length > 0;

    const sr = (window.Tone && window.Tone.context && window.Tone.context.sampleRate) || 44100;
    const N  = haveFFT ? data.length : 0;
    const nyquist = sr / 2;

    for (let pc = 0; pc < 12; pc++) {
      const s = this.pcState[pc];
      const harmonics = s.harmonics;

      // HarmonyState gate: only PCs that are currently held/selected
      // read new FFT energy. Released PCs decay out — they keep whatever
      // harmonic shape they had when released, but shrink each frame.
      if (!s.active) {
        let sum = 0;
        for (let k = 0; k < NUM_HARMONICS; k++) {
          harmonics[k] *= RELEASE_DECAY;
          sum += harmonics[k];
        }
        s.energy = sum;
        continue;
      }

      const f0 = BASE_FREQ * Math.pow(2, pc / 12);
      let sum = 0;
      for (let k = 0; k < NUM_HARMONICS; k++) {
        const f = f0 * (k + 1);
        let mag = 0;
        if (haveFFT && f < nyquist) {
          const bin = Math.round((f / nyquist) * N);
          if (bin >= 0 && bin < N) mag = dbToLinear(data[bin]);
        }
        // Raw read — Spectrum does the same. The analyser's internal
        // smoothing is the entire envelope; no extra follower here.
        harmonics[k] = mag;
        sum += mag;
      }
      s.energy = sum;
    }
  }

  // ── Faint lattice scaffolding ─────────────────────────────────
  _drawGrid() {
    const ctx = this.ctx;
    ctx.save();

    // Edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of this.edges) {
      const na = this.nodes[a], nb = this.nodes[b];
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
    }
    ctx.stroke();

    // Dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (const n of this.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Node rendering (radial spectrum analyzer) ────────────────
  _drawBlobs() {
    const maxR = this._nodeMaxR;

    for (let pc = 0; pc < 12; pc++) {
      const s = this.pcState[pc];
      if (s.energy < SILENT_EPS) continue;
      const color = ROLE_COLORS[s.role] || ROLE_COLORS[DEFAULT_ROLE];
      for (const idx of this.nodesByPC[pc]) {
        const n = this.nodes[idx];
        this._drawRadialSpectrumAt(n.x, n.y, s.harmonics, maxR, color);
      }
    }
  }

  // Render one node as a miniature circular spectrum analyzer:
  //   angular axis = harmonic number (1 at 12 o'clock, clockwise)
  //   radial axis  = magnitude in dB (inner = silent, outer = 0 dB)
  _drawRadialSpectrumAt(cx, cy, harmonics, maxR, rgb) {
    const ctx = this.ctx;
    const N = NUM_HARMONICS;
    const innerR = maxR * 0.18;
    const span   = maxR - innerR;
    const dbRange = 0 - DB_FLOOR;

    // Build the envelope points.
    const pts = new Array(N);
    let totalEnergy = 0;
    for (let k = 0; k < N; k++) {
      // Canvas y is down, so +angle from -π/2 traces clockwise.
      const angle = -Math.PI / 2 + (k / N) * Math.PI * 2;
      const mag = harmonics[k];
      const db  = linearToDb(mag);
      let t = (db - DB_FLOOR) / dbRange;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const rr = innerR + t * span;
      pts[k] = {
        x: cx + Math.cos(angle) * rr,
        y: cy + Math.sin(angle) * rr,
        a: angle,
        mag,
        r: rr,
      };
      totalEnergy += mag;
    }

    // Fill under the envelope: radial gradient, transparent center →
    // subtle color at envelope edge. Atmospheric, not solid.
    this._tracePolar(pts);
    const fillGrad = ctx.createRadialGradient(cx, cy, innerR * 0.4, cx, cy, maxR);
    fillGrad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
    fillGrad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Envelope stroke — role-colored, matches Spectrum's 1.2 px / blur 6
    // treatment but tinted per chord function.
    this._tracePolar(pts);
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.shadowColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = `rgba(${Math.min(255, rgb[0] + 30)}, ${Math.min(255, rgb[1] + 30)}, ${Math.min(255, rgb[2] + 30)}, 0.88)`;
    ctx.stroke();
    ctx.restore();

    // Identify the strongest harmonics (top PEAK_COUNT by magnitude).
    const ranked = [];
    for (let k = 0; k < N; k++) {
      if (pts[k].mag > PEAK_MAG_THRESHOLD) ranked.push(k);
    }
    ranked.sort((a, b) => pts[b].mag - pts[a].mag);
    const peakCount = Math.min(PEAK_COUNT, ranked.length);

    // Peak dots on the envelope — small, bright, flicker with the signal.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (let i = 0; i < peakCount; i++) {
      const p = pts[ranked[i]];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles radiate outward from EVERY above-threshold harmonic so the
    // starburst fills the full circle, not just the upward-facing arc where
    // low-k peaks cluster.
    this._spawnFromHarmonics(pts, ranked, rgb);

    // Center dot — size scales subtly with total energy, 2..5 px range.
    const coreR = 2 + Math.min(3, totalEnergy * 0.8);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.95)`;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smooth closed curve through the radial points using midpoint-
  // quadratic interpolation — with 16 points this is plenty smooth
  // without subsampling.
  _tracePolar(pts) {
    const ctx = this.ctx;
    const N = pts.length;
    const last = pts[N - 1], first = pts[0];
    const sx = (last.x + first.x) * 0.5;
    const sy = (last.y + first.y) * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 0; i < N; i++) {
      const p  = pts[i];
      const pn = pts[(i + 1) % N];
      const mx = (p.x + pn.x) * 0.5;
      const my = (p.y + pn.y) * 0.5;
      ctx.quadraticCurveTo(p.x, p.y, mx, my);
    }
    ctx.closePath();
  }

  // ── Particles ─────────────────────────────────────────────────
  // Sparks radiating off the spectral envelope: each harmonic above
  // threshold is a spawn site on the envelope edge, emitting particles
  // along the radial direction from the node center (± a 30° spread)
  // so the result is a full starburst, not a one-sided plume.
  _spawnFromHarmonics(pts, ranked, rgb) {
    const SPREAD = Math.PI / 6; // ±30°
    for (let i = 0; i < ranked.length; i++) {
      const p = pts[ranked[i]];
      // Higher rate than Spectrum's 35 % cap: every above-threshold
      // harmonic sheds sparks every frame on a loud signal, producing
      // a visible radial cloud rather than lone peaks.
      const rate = Math.min(0.9, p.mag * 1.6);
      const count = Math.floor(rate) + (Math.random() < (rate % 1) ? 1 : 0);
      if (count <= 0) continue;
      const hot = i < HOT_PEAK_COUNT;
      const baseSize = 2 + Math.random() * 2.5;
      for (let s = 0; s < count; s++) {
        const spread = (Math.random() - 0.5) * 2 * SPREAD;
        // The angle from node center to spawn point IS p.a (spawn point
        // sits at (cx + cos(p.a)·r, cy + sin(p.a)·r)), so p.a + spread
        // gives a direction that radiates outward from the center.
        const dir = p.a + spread;
        const speed = 1.1 + Math.random() * 1.0;
        this._spawnParticle(
          p.x, p.y,
          Math.cos(dir) * speed, Math.sin(dir) * speed,
          rgb, hot, baseSize
        );
      }
    }
  }

  _spawnParticle(x, y, vx, vy, rgb, hot, baseSize) {
    const pool = this.particles;
    for (let n = 0; n < PARTICLE_POOL; n++) {
      const i = (this._spawnCursor + n) % PARTICLE_POOL;
      const p = pool[i];
      if (!p.active) {
        this._spawnCursor = (i + 1) % PARTICLE_POOL;
        p.active = true;
        p.x = x; p.y = y; p.vx = vx; p.vy = vy;
        p.lifeMax = PARTICLE_LIFE_MIN + Math.random() * (PARTICLE_LIFE_MAX - PARTICLE_LIFE_MIN);
        p.life = p.lifeMax;
        p.size = baseSize + (Math.random() - 0.5) * 0.3;
        p.hot  = hot;
        p.r = rgb[0]; p.g = rgb[1]; p.b = rgb[2];
        return;
      }
    }
  }

  _updateAndDrawParticles() {
    const ctx = this.ctx;
    // Assume ~60 fps. If framerate wobbles we just get slightly different
    // particle lifetimes, which is fine visually.
    const dt = 1 / 60;
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      // Near-constant drift + sinusoidal wiggle, like Spectrum. No
      // multiplicative deceleration — particles travel freely until
      // their lifetime runs out.
      const lifeT = p.lifeMax - p.life;
      p.x += p.vx + Math.sin(lifeT * 6) * 0.15;
      p.y += p.vy + Math.cos(lifeT * 4) * 0.10;

      const alpha = p.life / p.lifeMax;
      // Shrink as they fade: ends at ~40% of start size.
      const curSize = p.size * (0.4 + 0.6 * alpha);

      // Soft halo on every particle, matching Spectrum's always-on glow.
      const glowR = curSize * 4;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.5})`);
      grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner dot — lightened role color (mirrors Spectrum).
      const lr = Math.min(255, p.r + 60);
      const lg = Math.min(255, p.g + 60);
      const lb = Math.min(255, p.b + 60);
      ctx.fillStyle = `rgba(${lr}, ${lg}, ${lb}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, curSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export default ResonanceView;
