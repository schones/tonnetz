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
 */

import { noteToPC } from './transforms.js';
import { HarmonyState } from './harmony-state.js';

// ── Tonnetz grid shape ────────────────────────────────────────────
// Canonical orientation (see explorer-spec.md):
//   horizontal step (col +1)          → +P5 (+7 st)
//   diagonal up-right   (col+1,row-1) → +M3 (+4 st)
//   diagonal down-right (row +1)      → +m3 (+3 st)  [P5 − M3]
//   PC(col, row) = (7·col + 3·row) mod 12
const GRID_COLS = 9;
const GRID_ROWS = 7;

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
const ATTACK_RATE  = 0.35;   // ~50 ms rise at 60 fps
const DECAY_RATE   = 0.88;   // ~500 ms release floor
const SILENT_EPS   = 0.0015; // energy below this → node goes dark

// ── Particle pool ─────────────────────────────────────────────────
const PARTICLE_POOL  = 360;
const PARTICLE_LIFE_MIN = 0.4;
const PARTICLE_LIFE_MAX = 0.8;

function dbToLinear(db) {
  if (db <= DB_FLOOR) return 0;
  return Math.pow(10, db / 20);
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

    // Grid nodes for the 9×7 lattice
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

    // Seed role/active from current HarmonyState immediately
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
    // Horizontal extent is 11·dx (col span 0..8 plus row skew 0..6 × ½),
    // vertical extent is 6·dy.
    const padX = Math.max(24, W * 0.05);
    const padY = Math.max(24, H * 0.08);
    const dx = (W - 2 * padX) / 11;
    const dy = (H - 2 * padY) / 6;
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
    this._nodeMaxR  = Math.min(dx, dy) * 0.55;
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

    // Trail fade
    ctx.fillStyle = 'rgba(8, 8, 8, 0.28)';
    ctx.fillRect(0, 0, W, H);

    this._updateHarmonicsFromFFT();
    this._drawGrid();
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
      const f0 = BASE_FREQ * Math.pow(2, pc / 12);

      // Read raw magnitudes from FFT (or synthesize a gentle shape if
      // no analyser is connected yet, so the view still animates).
      let rawSum = 0;
      for (let k = 0; k < NUM_HARMONICS; k++) {
        const f = f0 * (k + 1);
        let mag = 0;
        if (haveFFT && f < nyquist) {
          const bin = Math.round((f / nyquist) * N);
          if (bin >= 0 && bin < N) mag = dbToLinear(data[bin]);
        } else if (!haveFFT && s.active) {
          // Synthetic fallback: 1/k envelope + a tiny flicker
          mag = (0.6 / (k + 1)) * (0.85 + 0.15 * Math.sin(performance.now() * 0.003 + k + pc));
        }

        if (s.active) {
          // Fast rise toward raw magnitude
          harmonics[k] += (mag - harmonics[k]) * ATTACK_RATE;
        } else {
          // Independent release — decay regardless of FFT content
          harmonics[k] *= DECAY_RATE;
          if (harmonics[k] < 1e-4) harmonics[k] = 0;
        }
        rawSum += harmonics[k];
      }
      s.energy = rawSum;
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

  // ── Blob rendering ────────────────────────────────────────────
  _drawBlobs() {
    const ctx = this.ctx;
    const now = performance.now();
    const baseR = this._nodeBaseR;
    const maxR  = this._nodeMaxR;

    for (let pc = 0; pc < 12; pc++) {
      const s = this.pcState[pc];
      if (s.energy < SILENT_EPS) continue;

      // Scale blob radius with total energy, clamped to the node cell.
      const energyScale = Math.min(1, s.energy * 0.8);
      const avgR = baseR + energyScale * (maxR - baseR);

      const color = ROLE_COLORS[s.role] || ROLE_COLORS[DEFAULT_ROLE];

      // Render at every lattice node whose PC matches
      for (const idx of this.nodesByPC[pc]) {
        const n = this.nodes[idx];
        this._drawBlobAt(n.x, n.y, s.harmonics, avgR, color, now, pc, s);
      }
    }
  }

  _drawBlobAt(cx, cy, harmonics, avgR, rgb, now, pc, pcState) {
    const ctx = this.ctx;
    const N = NUM_HARMONICS;
    const pts = new Array(N);

    // Angular rotation drifts slightly per PC so identical shapes don't
    // phase-lock across nodes.
    const rot = (now * 0.00015 + pc * 0.27) % (Math.PI * 2);

    // Normalize harmonics so a full chord doesn't wash out — use max of
    // recent harmonics + a tiny epsilon.
    let maxH = 1e-4;
    for (let k = 0; k < N; k++) if (harmonics[k] > maxH) maxH = harmonics[k];

    let edgeSum = 0;
    for (let k = 0; k < N; k++) {
      const angle = rot + (k / N) * Math.PI * 2;
      // Each slice extends from avgR·0.65 (silent) to avgR·1.35 (loud),
      // so the blob is always recognizable as a lobed shape.
      const norm = harmonics[k] / maxH;     // 0..1
      const rr   = avgR * (0.65 + norm * 0.7);
      pts[k] = { x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr, r: rr, a: angle, mag: harmonics[k] };
      edgeSum += rr;
    }

    // Three layers: outer ghost → inner fill → envelope stroke
    this._tracePath(pts, 1.0);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.05)`;
    ctx.fill();

    this._tracePath(pts, 0.6);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.12)`;
    ctx.fill();

    this._tracePath(pts, 1.0);
    ctx.lineWidth = 0.6 + Math.min(0.8, pcState.energy * 0.25);
    ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`;
    ctx.stroke();

    // Hot core
    const coreR = Math.max(2, Math.min(6, 2 + pcState.energy * 1.4));
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    // Particle spawning from high-energy slices
    this._spawnFromBlob(cx, cy, pts, rgb, pcState.energy);
  }

  _tracePath(pts, scale) {
    const ctx = this.ctx;
    const N = pts.length;
    ctx.beginPath();
    // Start at midpoint of segment N-1 → 0
    const last = pts[N - 1], first = pts[0];
    const startX = (last.x + first.x) * 0.5;
    const startY = (last.y + first.y) * 0.5;
    ctx.moveTo(startX, startY);
    for (let i = 0; i < N; i++) {
      const p  = pts[i];
      const pn = pts[(i + 1) % N];
      const mx = (p.x + pn.x) * 0.5;
      const my = (p.y + pn.y) * 0.5;
      // Scale control point relative to circle center — not strictly
      // necessary for the outer (scale=1) pass, but keeps the inner fill
      // (scale<1) shrunk toward the node.
      if (scale === 1) {
        ctx.quadraticCurveTo(p.x, p.y, mx, my);
      } else {
        // Shrink both the control point and mid-point toward blob centroid
        // (approximated by averaging all pts once could be nicer — but
        // shrinking toward each slice's chord midpoint also works well).
        const cpX = p.x * scale + (1 - scale) * ((p.x + pn.x + pts[(i + N - 1) % N].x) / 3);
        const cpY = p.y * scale + (1 - scale) * ((p.y + pn.y + pts[(i + N - 1) % N].y) / 3);
        const mX  = mx * scale + (1 - scale) * ((p.x + pn.x) / 2);
        const mY  = my * scale + (1 - scale) * ((p.y + pn.y) / 2);
        ctx.quadraticCurveTo(cpX, cpY, mX, mY);
      }
    }
    ctx.closePath();
  }

  // ── Particles ─────────────────────────────────────────────────
  _spawnFromBlob(cx, cy, pts, rgb, energy) {
    // Spawn rate scales with energy. At low energy: maybe 0 per frame.
    const target = Math.min(6, energy * 8);
    const count = Math.floor(target) + (Math.random() < (target % 1) ? 1 : 0);
    if (count <= 0) return;

    // Rank slices by magnitude; pick proportionally among the top half
    const N = pts.length;
    for (let s = 0; s < count; s++) {
      // Weighted pick: sample by magnitude
      let totalMag = 0;
      for (let k = 0; k < N; k++) totalMag += pts[k].mag;
      if (totalMag <= 0) return;
      let r = Math.random() * totalMag;
      let pick = 0;
      for (let k = 0; k < N; k++) {
        r -= pts[k].mag;
        if (r <= 0) { pick = k; break; }
      }
      const p = pts[pick];
      const spread = (Math.random() - 0.5) * 0.5;
      const dirX = Math.cos(p.a + spread);
      const dirY = Math.sin(p.a + spread);
      const speed = 0.6 + Math.random() * 1.6 + energy * 0.6;
      const hot = p.mag / (pts[(pick + 1) % N].mag + pts[(pick + N - 1) % N].mag + 1e-6) > 0.8;
      this._spawnParticle(
        p.x, p.y,
        dirX * speed, dirY * speed,
        rgb, hot
      );
    }
  }

  _spawnParticle(x, y, vx, vy, rgb, hot) {
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
        p.size = hot ? (1.6 + Math.random() * 1.4) : (0.9 + Math.random() * 1.1);
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
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;

      const alpha = p.life / p.lifeMax;
      if (p.hot) {
        // Soft glow halo
        const glowR = p.size * 4;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner dot on hot particles
      if (p.hot) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export default ResonanceView;
