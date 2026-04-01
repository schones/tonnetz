/**
 * mascot.js
 * =========
 * Reusable eighth-note mascot for Scale Builder walkthroughs.
 * Self-contained — no external CSS needed.
 *
 * Usage:
 *   import { createMascot } from '../shared/mascot.js';
 *   const svg = createMascot('excited', 60);
 *   container.appendChild(svg);
 */

let _uid = 0;

// ── Palette ─────────────────────────────────────────────────
const BODY    = '#3d2c7c';
const HI      = '#5a3fb5';
const SH      = '#2a1e5c';
const EYE_W   = '#f0ecff';
const PUPIL_C = '#1a1230';
const MOUTH_S = '#e0d4ff';   // stroke color
const MOUTH_F = '#1a1230';   // fill color (open mouth)
const CHEEK_C = '#7c5cbf';

const NS = 'http://www.w3.org/2000/svg';

// ── Helpers ─────────────────────────────────────────────────

function mk(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function add(parent, tag, attrs) {
  const el = mk(tag, attrs);
  parent.appendChild(el);
  return el;
}

// ════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════

/**
 * Create a mascot SVG element.
 * @param {'neutral'|'excited'|'thinking'|'wrongNote'|'encouraging'|'aha'|'listening'|'wink'} expression
 * @param {number} [size=60] Height in pixels
 * @returns {SVGSVGElement}
 */
export function createMascot(expression = 'neutral', size = 60) {
  const u = `m${_uid++}`;
  const kf = [];

  const svg = mk('svg', {
    viewBox: '0 0 50 80',
    width: Math.round(size * 50 / 80),
    height: size,
  });
  svg.style.cssText = 'overflow:visible;flex-shrink:0;display:block';

  const root = mk('g');

  // ── Base body ──
  buildBody(root);

  // ── Expression-specific face + animations ──
  const face = mk('g');
  applyExpression(root, face, u, kf, expression);
  root.appendChild(face);

  // ── Inject scoped keyframes ──
  if (kf.length) {
    const s = mk('style');
    s.textContent = kf.join('\n');
    svg.appendChild(s);
  }

  svg.appendChild(root);
  return svg;
}

// ════════════════════════════════════════════════════════════════
// BODY (stem, flag, note head)
// ════════════════════════════════════════════════════════════════

function buildBody(g) {
  // Stem
  add(g, 'line', {
    x1: 13, y1: 29, x2: 13, y2: 64,
    stroke: BODY, 'stroke-width': 4.5, 'stroke-linecap': 'round',
  });

  // Flag (tail)
  add(g, 'path', {
    d: 'M13,64 C13,74 28,72 26,63',
    fill: 'none', stroke: BODY, 'stroke-width': 3.5, 'stroke-linecap': 'round',
  });
  // Flag highlight
  add(g, 'path', {
    d: 'M13,64 C13,71 24,69 23,64',
    fill: 'none', stroke: HI, 'stroke-width': 2, opacity: 0.35, 'stroke-linecap': 'round',
  });

  // Note head (tilted ellipse)
  const hd = mk('g', { transform: 'rotate(-10, 28, 22)' });
  add(hd, 'ellipse', { cx: 28, cy: 22, rx: 17, ry: 13, fill: BODY });
  add(hd, 'ellipse', { cx: 23, cy: 18, rx: 9, ry: 6, fill: HI, opacity: 0.5 });
  add(hd, 'ellipse', { cx: 33, cy: 27, rx: 9, ry: 5, fill: SH, opacity: 0.35 });
  g.appendChild(hd);
}

// ════════════════════════════════════════════════════════════════
// EXPRESSION DISPATCH
// ════════════════════════════════════════════════════════════════

function applyExpression(root, face, u, kf, expr) {
  const O  = '25px 40px';   // center origin
  const OB = '25px 75px';   // bottom origin

  switch (expr) {
    case 'neutral':
      stdEyes(face, u, kf, { blink: true, lookAround: true });
      smileMouth(face);
      floatAnim(root, u, kf, 0, O);
      break;

    case 'excited':
      stdEyes(face, u, kf, { scale: 1.15 });
      openMouth(face, 'ellipse');
      addCheeks(face);
      danceAnim(root, u, kf, O);
      break;

    case 'thinking':
      stdEyes(face, u, kf, { pupilDx: -2, pupilDy: -2 });
      asymMouth(face);
      floatAnim(root, u, kf, 10, O);
      break;

    case 'wrongNote':
      stdEyes(face, u, kf, {});
      frownMouth(face);
      raisedBrows(face);
      root.style.transform = 'rotate(5deg)';
      root.style.transformOrigin = O;
      break;

    case 'encouraging':
      stdEyes(face, u, kf, {});
      openMouth(face, 'dSmile');
      addEncouragingArm(root);
      beckonAnim(root, u, kf, OB);
      break;

    case 'aha':
      stdEyes(face, u, kf, { scale: 1.3 });
      openMouth(face, 'oval');
      pulseAnim(root, u, kf, O);
      break;

    case 'listening':
      happyEyes(face);
      smileMouth(face);
      addListeningArm(root);
      tiltAnim(root, u, kf, 10, 14, O);
      break;

    case 'wink':
      winkEyes(face, u, kf);
      smileMouth(face);
      root.style.transform = 'rotate(-7deg)';
      root.style.transformOrigin = O;
      break;

    default:
      stdEyes(face, u, kf, { blink: true, lookAround: true });
      smileMouth(face);
      floatAnim(root, u, kf, 0, O);
  }
}

// ════════════════════════════════════════════════════════════════
// EYES
// ════════════════════════════════════════════════════════════════

const LX = 22, RX = 34, EY = 21;

function stdEyes(parent, u, kf, opts) {
  const { scale: s = 1, blink, lookAround, pupilDx: dx = 0, pupilDy: dy = 0 } = opts;
  const erx = 5 * s, ery = 5.5 * s, pr = 2.5 * s;

  // Blink group wraps both eyes
  const eyeG = mk('g');
  if (blink) {
    const n = `${u}_blink`;
    kf.push(`@keyframes ${n}{0%,90%,100%{transform:scaleY(1)}94%,96%{transform:scaleY(.08)}}`);
    eyeG.style.transformOrigin = `28px ${EY}px`;
    eyeG.style.animation = `${n} 4s ease-in-out infinite`;
  }

  // Whites
  add(eyeG, 'ellipse', { cx: LX, cy: EY, rx: erx, ry: ery, fill: EYE_W });
  add(eyeG, 'ellipse', { cx: RX, cy: EY, rx: erx, ry: ery, fill: EYE_W });

  // Pupils (look-around group)
  const pupG = mk('g');
  if (lookAround) {
    const n = `${u}_look`;
    kf.push(
      `@keyframes ${n}{` +
      `0%,35%,100%{transform:translate(0,0)}` +
      `45%,65%{transform:translate(1.5px,0)}` +
      `70%,90%{transform:translate(-1px,-.5px)}}`
    );
    pupG.style.animation = `${n} 6s ease-in-out infinite`;
  }
  add(pupG, 'circle', { cx: LX + dx, cy: EY + 1 + dy, r: pr, fill: PUPIL_C });
  add(pupG, 'circle', { cx: RX + dx, cy: EY + 1 + dy, r: pr, fill: PUPIL_C });
  eyeG.appendChild(pupG);

  parent.appendChild(eyeG);
}

function happyEyes(parent) {
  // Curved arcs — no whites/pupils
  add(parent, 'path', {
    d: 'M18,20 Q22,16 26,20',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 2, 'stroke-linecap': 'round',
  });
  add(parent, 'path', {
    d: 'M30,20 Q34,16 38,20',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 2, 'stroke-linecap': 'round',
  });
}

function winkEyes(parent, u, kf) {
  // Left eye: normal
  add(parent, 'ellipse', { cx: LX, cy: EY, rx: 5, ry: 5.5, fill: EYE_W });
  add(parent, 'circle', { cx: LX, cy: EY + 1, r: 2.5, fill: PUPIL_C });

  // Right eye: happy arc with periodic squeeze
  const wg = mk('g');
  const n = `${u}_wink`;
  kf.push(`@keyframes ${n}{0%,85%,100%{transform:scaleY(1)}90%,95%{transform:scaleY(.08)}}`);
  wg.style.transformOrigin = `${RX}px ${EY}px`;
  wg.style.animation = `${n} 4s ease-in-out infinite`;
  add(wg, 'path', {
    d: `M30,${EY} Q${RX},${EY - 4} 38,${EY}`,
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 2, 'stroke-linecap': 'round',
  });
  parent.appendChild(wg);
}

// ════════════════════════════════════════════════════════════════
// MOUTH
// ════════════════════════════════════════════════════════════════

function smileMouth(parent) {
  add(parent, 'path', {
    d: 'M24,29 Q28,33 32,29',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 1.5, 'stroke-linecap': 'round',
  });
}

function openMouth(parent, type) {
  if (type === 'ellipse') {
    // Excited: filled ellipse
    add(parent, 'ellipse', { cx: 28, cy: 30, rx: 4, ry: 3.5, fill: MOUTH_F });
  } else if (type === 'oval') {
    // Aha: open oval
    add(parent, 'ellipse', { cx: 28, cy: 30, rx: 3.5, ry: 4, fill: MOUTH_F });
  } else if (type === 'dSmile') {
    // Encouraging: D-shaped open smile
    add(parent, 'path', { d: 'M23,28 Q28,35 33,28', fill: MOUTH_F, stroke: 'none' });
  }
}

function asymMouth(parent) {
  // Thinking: small asymmetric line
  add(parent, 'path', {
    d: 'M26,29 Q28,31 31,30',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 1.5, 'stroke-linecap': 'round',
  });
}

function frownMouth(parent) {
  add(parent, 'path', {
    d: 'M24,31 Q28,27 32,31',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 1.5, 'stroke-linecap': 'round',
  });
}

// ════════════════════════════════════════════════════════════════
// EXTRAS (cheeks, brows, arms)
// ════════════════════════════════════════════════════════════════

function raisedBrows(parent) {
  add(parent, 'path', {
    d: 'M18,15 Q22,12 26,15',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 1.2, 'stroke-linecap': 'round',
  });
  add(parent, 'path', {
    d: 'M30,15 Q34,12 38,15',
    fill: 'none', stroke: MOUTH_S, 'stroke-width': 1.2, 'stroke-linecap': 'round',
  });
}

function addCheeks(parent) {
  add(parent, 'circle', { cx: 16, cy: 27, r: 3.5, fill: CHEEK_C, opacity: 0.3 });
  add(parent, 'circle', { cx: 40, cy: 27, r: 3.5, fill: CHEEK_C, opacity: 0.3 });
}

function addEncouragingArm(root) {
  add(root, 'line', {
    x1: 16, y1: 48, x2: 40, y2: 42,
    stroke: BODY, 'stroke-width': 3, 'stroke-linecap': 'round',
  });
  add(root, 'circle', { cx: 40, cy: 42, r: 4, fill: BODY });
}

function addListeningArm(root) {
  add(root, 'path', {
    d: 'M40,28 Q44,22 44,15',
    fill: 'none', stroke: BODY, 'stroke-width': 3, 'stroke-linecap': 'round',
  });
  add(root, 'ellipse', { cx: 44, cy: 14, rx: 3, ry: 4, fill: BODY });
}

// ════════════════════════════════════════════════════════════════
// ANIMATIONS
// ════════════════════════════════════════════════════════════════

function floatAnim(root, u, kf, tilt, origin) {
  const n = `${u}_float`;
  kf.push(
    `@keyframes ${n}{` +
    `0%,100%{transform:rotate(${tilt}deg) translateY(0)}` +
    `50%{transform:rotate(${tilt}deg) translateY(-3px)}}`
  );
  root.style.transformOrigin = origin;
  root.style.animation = `${n} 2.5s ease-in-out infinite`;
}

function danceAnim(root, u, kf, origin) {
  const n = `${u}_dance`;
  kf.push(
    `@keyframes ${n}{` +
    `0%,100%{transform:rotate(-8deg) translateY(0)}` +
    `50%{transform:rotate(-14deg) translateY(-4px)}}`
  );
  root.style.transformOrigin = origin;
  root.style.animation = `${n} .8s ease-in-out infinite`;
}

function beckonAnim(root, u, kf, origin) {
  const n = `${u}_beckon`;
  kf.push(
    `@keyframes ${n}{` +
    `0%,100%{transform:rotate(0deg)}` +
    `50%{transform:rotate(-14deg)}}`
  );
  root.style.transformOrigin = origin;
  root.style.animation = `${n} 1.2s ease-in-out infinite`;
}

function pulseAnim(root, u, kf, origin) {
  const n = `${u}_pulse`;
  kf.push(
    `@keyframes ${n}{` +
    `0%,100%{transform:rotate(-12deg) scale(1)}` +
    `50%{transform:rotate(-12deg) scale(1.04)}}`
  );
  root.style.transformOrigin = origin;
  root.style.animation = `${n} 1.5s ease-in-out infinite`;
}

function tiltAnim(root, u, kf, from, to, origin) {
  const n = `${u}_tilt`;
  kf.push(
    `@keyframes ${n}{` +
    `0%,100%{transform:rotate(${from}deg)}` +
    `50%{transform:rotate(${to}deg)}}`
  );
  root.style.transformOrigin = origin;
  root.style.animation = `${n} 2s ease-in-out infinite`;
}
