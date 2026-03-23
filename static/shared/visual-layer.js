/**
 * visual-layer.js
 * ===============
 * HarmonyState subscriber + canvas overlay renderer.
 * Computes note colors from VisualConfig and writes them back into
 * HarmonyState so TonnetzNeighborhood can read them on re-render.
 * Also drives canvas particle/glow effects.
 *
 * Depends on:
 *   - harmony-state.js   → HarmonyState
 *   - visual-config.js   → VisualConfig, getColor, PITCH_COLORS
 *
 * Exports: VisualLayer
 */

import { HarmonyState } from './harmony-state.js';
import { VisualConfig, getColor, PITCH_COLORS } from './visual-config.js';

// ════════════════════════════════════════════════════════════════════
// NOTE NAME → PITCH CLASS LOOKUP
// ════════════════════════════════════════════════════════════════════

const NOTE_PC = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11,
};

function _noteToPC(noteName) {
  // Strip octave digit if present (e.g. "C4" → "C")
  const base = noteName.replace(/\d+$/, '');
  return NOTE_PC[base] ?? 0;
}

// ════════════════════════════════════════════════════════════════════
// VISUAL LAYER
// ════════════════════════════════════════════════════════════════════

const VisualLayer = {
  _canvas:          null,
  _ctx:             null,
  _container:       null,
  _unsub:           null,
  _resizeObserver:  null,
  _rafId:           null,
  _particles:       [],
  _glows:           [],
  _isOwnUpdate:     false,

  // ── Init / Destroy ──────────────────────────────────────────────

  /**
   * Create a canvas overlay inside containerId and subscribe to HarmonyState.
   * @param {string} containerId  ID of the element that holds the Tonnetz SVG
   * @param {object} [options]    Optional { width, height }
   */
  init(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[VisualLayer] Container #${containerId} not found.`);
      return;
    }
    this._container = container;

    // Ensure the container can anchor the absolutely-positioned canvas
    const cs = getComputedStyle(container);
    if (cs.position === 'static') {
      container.style.position = 'relative';
    }

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.width  = options.width  ?? container.clientWidth  ?? 400;
    canvas.height = options.height ?? container.clientHeight ?? 300;
    canvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'pointer-events: none',
      `z-index: ${VisualConfig.canvasEffect === 'glow' ? 5 : 10}`,
    ].join('; ');

    container.appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    // Keep canvas sized to container
    this._resizeObserver = new ResizeObserver(() => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    this._resizeObserver.observe(container);

    // Subscribe to HarmonyState
    this._isOwnUpdate = false;
    this._unsub = HarmonyState.on(state => this._onStateChange(state));
  },

  /** Remove canvas, unsubscribe, cancel animation. */
  destroy() {
    if (this._unsub)           { this._unsub(); this._unsub = null; }
    if (this._resizeObserver)  { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._rafId !== null)  { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._canvas)          { this._canvas.remove(); this._canvas = null; this._ctx = null; }
    this._container  = null;
    this._particles  = [];
    this._glows      = [];
  },

  // ── State Handler ────────────────────────────────────────────────

  _onStateChange(state) {
    if (!VisualConfig.enabled) {
      this._clearCanvas();
      return;
    }

    // Re-entrancy guard: bail if this notification was caused by our own
    // updateSilent + update() write below.
    if (this._isOwnUpdate) {
      this._isOwnUpdate = false;
      return;
    }

    const activeNotes = state.activeNotes || [];
    if (activeNotes.length === 0) {
      this._clearCanvas();
      return;
    }

    // Determine the triad quality for color calculations
    const primaryTriad = (state.activeTriads || []).find(t => t.role === 'primary')
                       || (state.activeTriads || [])[0];
    const triadQuality = primaryTriad ? primaryTriad.quality : 'default';

    // Compute colors for each active note
    let updatedNotes = activeNotes;
    if (VisualConfig.colorScheme !== 'none') {
      updatedNotes = activeNotes.map(an => {
        const pc = _noteToPC(an.note);
        let color;
        if (VisualConfig.colorScheme === 'tonnetz') {
          color = getColor(pc, triadQuality);
        } else {
          // 'quality' — quality-only coloring, ignores pitch
          color = getColor(0, triadQuality);
        }
        return { ...an, color };
      });
    }

    // Write colors back silently, then fire a single clean notification
    // so TonnetzNeighborhood re-renders with the new fill colors.
    HarmonyState.updateSilent({ activeNotes: updatedNotes });
    this._isOwnUpdate = true;
    HarmonyState.update({});

    // Update canvas z-index based on active effect
    if (this._canvas) {
      this._canvas.style.zIndex = VisualConfig.canvasEffect === 'glow' ? '5' : '10';
    }

    // Trigger canvas effect
    const colors = updatedNotes.map(an => an.color).filter(Boolean);
    switch (VisualConfig.canvasEffect) {
      case 'particle':
        this._spawnParticles(updatedNotes, colors);
        break;
      case 'glow':
        this._drawGlow(updatedNotes, colors);
        break;
      default:
        this._clearCanvas();
    }
  },

  // ── Canvas Helpers ───────────────────────────────────────────────

  _clearCanvas() {
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
    this._particles = [];
    this._glows     = [];
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  /** Compute spawn position for a note using circle-of-fifths angular layout. */
  _spawnPos(pc) {
    const w = this._canvas.width;
    const h = this._canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    const hue    = PITCH_COLORS[((pc % 12) + 12) % 12] ?? 0;
    const angle  = hue * (Math.PI / 180);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  },

  // ── Particle Effect ──────────────────────────────────────────────

  _spawnParticles(notes, colors) {
    const now = performance.now();
    for (let i = 0; i < notes.length; i++) {
      const note  = notes[i];
      const color = colors[i] || '#fff';
      const pc    = _noteToPC(note.note);
      const { x: sx, y: sy } = this._spawnPos(pc);
      const count = 12 + Math.floor(Math.random() * 7); // 12–18
      for (let p = 0; p < count; p++) {
        const angle  = Math.random() * Math.PI * 2;
        const offset = Math.random() * 30;          // scatter radius
        const speed  = 30 + Math.random() * 50;     // px per second outward
        this._particles.push({
          ox:    sx + Math.cos(angle) * offset,      // spawn x
          oy:    sy + Math.sin(angle) * offset,      // spawn y
          dx:    Math.cos(angle) * speed,            // velocity px/s
          dy:    Math.sin(angle) * speed,
          color,
          born:  now,
          life:  800,
          r:     2 + Math.random() * 3,
        });
      }
    }
    this._startRaf();
  },

  // ── Glow Effect ──────────────────────────────────────────────────

  _drawGlow(notes, colors) {
    const now = performance.now();
    for (let i = 0; i < notes.length; i++) {
      const note  = notes[i];
      const color = colors[i] || '#fff';
      const pc    = _noteToPC(note.note);
      const { x, y } = this._spawnPos(pc);
      this._glows.push({
        x, y,
        color,
        alpha:  1,
        born:   now,
        life:   1200,
        radius: 60,
      });
    }
    this._startRaf();
  },

  // ── Animation Loop ───────────────────────────────────────────────

  _startRaf() {
    if (this._rafId !== null) return; // already running
    const tick = (now) => {
      this._rafId = null;
      if (!this._canvas || !this._ctx) return;

      const ctx = this._ctx;
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

      // Draw glows
      this._glows = this._glows.filter(g => {
        const age = now - g.born;
        if (age >= g.life) return false;
        const t     = age / g.life;
        const alpha = (1 - t) * 0.4;
        const grad  = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
        grad.addColorStop(0, _colorWithAlpha(g.color, alpha));
        grad.addColorStop(1, _colorWithAlpha(g.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      // Draw particles — position computed from spawn + elapsed time
      this._particles = this._particles.filter(p => {
        const age = now - p.born;
        if (age >= p.life) return false;
        const t   = age / 1000; // seconds elapsed
        const ft  = 1 - (age / p.life);
        const x   = p.ox + p.dx * t;
        const y   = p.oy + p.dy * t;
        ctx.globalAlpha = ft;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });

      // Continue loop only if there's something to draw
      if (this._particles.length > 0 || this._glows.length > 0) {
        this._rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
    };
    this._rafId = requestAnimationFrame(tick);
  },
};

// ── Color Helper ──────────────────────────────────────────────────

/**
 * Inject an alpha value into an HSL color string.
 * "hsl(120, 65%, 60%)" → "hsla(120, 65%, 60%, 0.4)"
 */
function _colorWithAlpha(hslStr, alpha) {
  if (!hslStr) return `rgba(255,255,255,${alpha})`;
  if (hslStr.startsWith('hsla')) return hslStr.replace(/[\d.]+\)$/, `${alpha})`);
  if (hslStr.startsWith('hsl')) return hslStr.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  return hslStr;
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { VisualLayer };

if (typeof window !== 'undefined') {
  window.VisualLayer = VisualLayer;
}
