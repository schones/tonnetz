/**
 * theory-engine.js
 * ================
 * Progressive-disclosure tooltip system for music theory content.
 *
 * Usage:
 *   import { initTheoryTooltips } from '/static/shared/theory-engine.js';
 *   initTheoryTooltips();
 *
 * Then any element with data-theory="topic_id" becomes click-to-tooltip.
 */

import { THEORY } from './theory-content.js';

// ── CSS (injected once) ─────────────────────────────────────────────────────

const TOOLTIP_CSS = /* css */ `

/* ── trigger elements ─────────────────────────────────────────────────── */

[data-theory] {
  cursor: help;
  border-bottom: 1.5px dashed var(--accent, #6c63ff);
  transition: color 0.15s, border-color 0.15s;
}
[data-theory]:hover {
  color: var(--accent, #6c63ff);
}

/* ── backdrop ─────────────────────────────────────────────────────────── */

.tt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* ── tooltip container ────────────────────────────────────────────────── */

.tt-tooltip {
  position: fixed;
  z-index: 9999;
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border, #e8e6f0);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  font-family: var(--font-main, system-ui, sans-serif);
  color: var(--text-primary, #1a1a2e);
  animation: tt-fade-in 0.2s ease-out;
  overscroll-behavior: contain;
}

[data-theme="dark"] .tt-tooltip {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

/* scrollbar */
.tt-tooltip::-webkit-scrollbar { width: 6px; }
.tt-tooltip::-webkit-scrollbar-track { background: transparent; }
.tt-tooltip::-webkit-scrollbar-thumb {
  background: var(--border, #ccc);
  border-radius: 3px;
}

/* ── header ───────────────────────────────────────────────────────────── */

.tt-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.125rem 0.625rem;
  border-bottom: 1px solid var(--border, #e8e6f0);
}

.tt-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
}

.tt-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}
.tt-badge--beginner      { background: rgba(22,163,74,0.14); color: var(--text-success, #16a34a); }
.tt-badge--intermediate  { background: rgba(108,99,255,0.14); color: var(--accent, #6c63ff); }
.tt-badge--advanced      { background: rgba(230,74,25,0.14);  color: var(--text-accent-warm, #e64a19); }

/* ── summary ──────────────────────────────────────────────────────────── */

.tt-summary {
  margin: 0;
  padding: 0.625rem 1.125rem;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--text-secondary, #6b7280);
  line-height: 1.45;
}

/* ── depth toggle ─────────────────────────────────────────────────────── */

.tt-depth-toggle {
  display: inline-flex;
  margin: 0 1.125rem 0.5rem;
  border: 1px solid var(--border, #e8e6f0);
  border-radius: 8px;
  overflow: hidden;
}

.tt-depth-btn {
  padding: 0.3rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: inherit;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tt-depth-btn:not(:last-child) {
  border-right: 1px solid var(--border, #e8e6f0);
}
.tt-depth-btn:hover {
  background: var(--accent-soft, rgba(108,99,255,0.08));
}
.tt-depth-btn--active {
  background: var(--accent, #6c63ff);
  color: #fff;
}
.tt-depth-btn--active:hover {
  background: var(--accent, #6c63ff);
  color: #fff;
}

/* ── body (depth content) ─────────────────────────────────────────────── */

.tt-body {
  padding: 0.5rem 1.125rem 0.75rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-line;
}

/* ── mnemonics ────────────────────────────────────────────────────────── */

.tt-mnemonics {
  margin: 0 1.125rem 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--accent-soft, rgba(108,99,255,0.06));
  border-radius: 8px;
  font-size: 0.78rem;
}
.tt-mnemonics__heading {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
}
.tt-mnemonics dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.5rem;
}
.tt-mnemonics dt {
  font-weight: 700;
  color: var(--accent, #6c63ff);
}
.tt-mnemonics dd {
  margin: 0;
  color: var(--text-primary);
}

/* ── practical tip ────────────────────────────────────────────────────── */

.tt-practical {
  margin: 0;
  padding: 0.5rem 1.125rem 0.625rem;
  font-size: 0.78rem;
  font-style: italic;
  color: var(--text-secondary, #6b7280);
  border-top: 1px solid var(--border, #e8e6f0);
  line-height: 1.5;
}

/* ── connections ──────────────────────────────────────────────────────── */

.tt-connections {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem 1.125rem 0.875rem;
}
.tt-connections__label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
  width: 100%;
  margin-bottom: 0.1rem;
}

.tt-conn-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  background: var(--accent-soft, rgba(108,99,255,0.08));
  color: var(--accent, #6c63ff);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.tt-conn-chip:hover {
  background: var(--accent, #6c63ff);
  color: #fff;
}

/* ── animation ────────────────────────────────────────────────────────── */

@keyframes tt-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .tt-tooltip { animation: none; }
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────

function trimContent(str) {
  if (!str) return '';
  return str.replace(/^\s+/gm, m => {
    // collapse leading whitespace per line to a single space (template literals indent)
    return '';
  }).trim();
}

// ── TheoryTooltip ───────────────────────────────────────────────────────

const DEPTH_KEY = 'tonnetz-theory-depth';
const VALID_DEPTHS = ['musician', 'theorist', 'math'];
const GAP = 8;
const MARGIN = 16;

export class TheoryTooltip {

  constructor() {
    this._depth = TheoryTooltip.loadDepth();
    this._el = null;        // tooltip element
    this._backdrop = null;
    this._currentTopicId = null;
    this._lastAnchor = null;

    this._injectCSS();
    this._build();
    this._bindGlobalKeys();
  }

  // ── static depth persistence ───────────────────────────────────────

  static loadDepth() {
    const v = localStorage.getItem(DEPTH_KEY);
    return VALID_DEPTHS.includes(v) ? v : 'musician';
  }

  static saveDepth(depth) {
    localStorage.setItem(DEPTH_KEY, depth);
  }

  // ── public API ─────────────────────────────────────────────────────

  show(topicId, anchorEl) {
    const topic = THEORY.topics[topicId];
    if (!topic) {
      console.warn(`[theory-engine] topic "${topicId}" not found`);
      return;
    }

    const isSwap = this._currentTopicId !== null;
    this._currentTopicId = topicId;
    if (anchorEl) this._lastAnchor = anchorEl;

    this._populate(topic);

    if (!isSwap) {
      // fresh open
      document.body.appendChild(this._backdrop);
      document.body.appendChild(this._el);
    }

    this._position(this._lastAnchor);
    this._el.style.animation = isSwap ? 'none' : '';
  }

  hide() {
    if (!this._currentTopicId) return;
    this._currentTopicId = null;
    this._lastAnchor = null;
    this._backdrop.remove();
    this._el.remove();
  }

  setDepth(depth) {
    if (!VALID_DEPTHS.includes(depth)) return;
    this._depth = depth;
    TheoryTooltip.saveDepth(depth);
    this._updateDepthButtons();

    const topic = THEORY.topics[this._currentTopicId];
    if (topic) this._renderBody(topic);
  }

  // ── build skeleton ─────────────────────────────────────────────────

  _build() {
    // backdrop
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'tt-backdrop';
    this._backdrop.addEventListener('click', () => this.hide());

    // tooltip shell
    const el = document.createElement('div');
    el.className = 'tt-tooltip';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="tt-header">
        <h3 class="tt-title"></h3>
        <span class="tt-badge"></span>
      </div>
      <p class="tt-summary"></p>
      <div class="tt-depth-toggle">
        <button class="tt-depth-btn" data-depth="musician">Musician</button>
        <button class="tt-depth-btn" data-depth="theorist">Theorist</button>
        <button class="tt-depth-btn" data-depth="math">Math</button>
      </div>
      <div class="tt-body"></div>
      <div class="tt-mnemonics"></div>
      <p class="tt-practical"></p>
      <div class="tt-connections"></div>
    `;

    // depth toggle clicks
    el.querySelector('.tt-depth-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.tt-depth-btn');
      if (btn) this.setDepth(btn.dataset.depth);
    });

    // connection chip clicks
    el.querySelector('.tt-connections').addEventListener('click', (e) => {
      const chip = e.target.closest('.tt-conn-chip');
      if (chip) {
        e.stopPropagation();
        this.show(chip.dataset.topic, null);
      }
    });

    this._el = el;
  }

  // ── populate ───────────────────────────────────────────────────────

  _populate(topic) {
    const el = this._el;

    // title + badge
    el.querySelector('.tt-title').textContent = topic.title;
    const badge = el.querySelector('.tt-badge');
    badge.textContent = topic.tier;
    badge.className = `tt-badge tt-badge--${topic.tier}`;

    // summary
    el.querySelector('.tt-summary').textContent = topic.summary;

    // depth buttons
    this._updateDepthButtons();

    // body
    this._renderBody(topic);

    // mnemonics
    this._renderMnemonics(topic.mnemonics);

    // practical
    const pEl = el.querySelector('.tt-practical');
    if (topic.practical) {
      pEl.textContent = topic.practical;
      pEl.style.display = '';
    } else {
      pEl.style.display = 'none';
    }

    // connections
    this._renderConnections(topic.connections);
  }

  _renderBody(topic) {
    this._el.querySelector('.tt-body').textContent = trimContent(topic.levels[this._depth]);
  }

  _renderMnemonics(mnemonics) {
    const wrap = this._el.querySelector('.tt-mnemonics');
    if (!mnemonics || Object.keys(mnemonics).length === 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    const pairs = Object.entries(mnemonics)
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    wrap.innerHTML = `
      <p class="tt-mnemonics__heading">Mnemonics</p>
      <dl>${pairs}</dl>
    `;
  }

  _renderConnections(connections) {
    const wrap = this._el.querySelector('.tt-connections');
    if (!connections || connections.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    const chips = connections
      .filter(id => THEORY.topics[id])
      .map(id => {
        const t = THEORY.topics[id];
        return `<button class="tt-conn-chip" data-topic="${id}">${t.title}</button>`;
      });

    if (chips.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = '';
    wrap.innerHTML = `<span class="tt-connections__label">Related</span>${chips.join('')}`;
  }

  _updateDepthButtons() {
    this._el.querySelectorAll('.tt-depth-btn').forEach(btn => {
      btn.classList.toggle('tt-depth-btn--active', btn.dataset.depth === this._depth);
    });
  }

  // ── positioning ────────────────────────────────────────────────────

  _position(anchorEl) {
    const el = this._el;

    // temporarily make measurable
    el.style.visibility = 'hidden';
    el.style.top = '0px';
    el.style.left = '0px';

    const ttRect = el.getBoundingClientRect();

    let top, left;

    if (anchorEl) {
      const aRect = anchorEl.getBoundingClientRect();
      // default: below, centered
      top = aRect.bottom + GAP;
      left = aRect.left + aRect.width / 2 - ttRect.width / 2;

      // flip above if overflows bottom
      if (top + ttRect.height > window.innerHeight - MARGIN) {
        top = aRect.top - GAP - ttRect.height;
      }
    } else {
      // no anchor (connection click) — center on screen
      top = (window.innerHeight - ttRect.height) / 2;
      left = (window.innerWidth - ttRect.width) / 2;
    }

    // clamp
    if (top < MARGIN) top = MARGIN;
    if (top + ttRect.height > window.innerHeight - MARGIN) {
      top = window.innerHeight - MARGIN - ttRect.height;
    }
    if (left < MARGIN) left = MARGIN;
    if (left + ttRect.width > window.innerWidth - MARGIN) {
      left = window.innerWidth - MARGIN - ttRect.width;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = '';
  }

  // ── CSS injection ──────────────────────────────────────────────────

  _injectCSS() {
    if (document.getElementById('tt-styles')) return;
    const style = document.createElement('style');
    style.id = 'tt-styles';
    style.textContent = TOOLTIP_CSS;
    document.head.appendChild(style);
  }

  // ── global keys ────────────────────────────────────────────────────

  _bindGlobalKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    window.addEventListener('resize', () => this.hide());
  }
}

// ── init function ─────────────────────────────────────────────────────────

export function initTheoryTooltips() {
  const tooltip = new TheoryTooltip();

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-theory]');
    if (!trigger) return;
    // don't trigger on connection chips (handled internally)
    if (trigger.closest('.tt-tooltip')) return;
    e.preventDefault();
    e.stopPropagation();
    tooltip.show(trigger.getAttribute('data-theory'), trigger);
  });

  return tooltip;
}
