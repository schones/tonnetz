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
import { getProfile, updateTopicStatus } from './user-profile.js';

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

.tt-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 1.1rem;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.tt-close:hover,
.tt-close:focus-visible {
  background: var(--accent-soft, rgba(108,99,255,0.1));
  color: var(--text-primary);
}

.tt-back {
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.tt-back--visible {
  display: flex;
}
.tt-back:hover,
.tt-back:focus-visible {
  background: var(--accent-soft, rgba(108,99,255,0.1));
  color: var(--text-primary);
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

/* ── expand / collapse ────────────────────────────────────────────────── */

.tt-expand {
  display: block;
  margin: 0 1.125rem 0.5rem;
  padding: 0;
  background: none;
  border: none;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent, #6c63ff);
  cursor: pointer;
}
.tt-expand:hover { text-decoration: underline; }

.tt-detail { display: none; }
.tt-detail--open { display: block; }

/* ── learned checkmark ───────────────────────────────────────────────── */

.tt-learned {
  color: var(--text-success, #16a34a);
  font-size: 0.85rem;
  flex-shrink: 0;
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
    this._additionalLenses = [];  // populated from profile on each show()
    this._el = null;        // tooltip element
    this._backdrop = null;
    this._currentTopicId = null;
    this._lastAnchor = null;
    this._triggerEl = null;  // the element that opened the tooltip (for focus restore)
    this._history = [];      // stack of {topicId} for Back navigation

    this._injectCSS();
    this._build();
    this._bindGlobalKeys();
  }

  // ── static depth persistence ───────────────────────────────────────

  static loadDepth() {
    const profile = getProfile();
    if (profile) {
      return TheoryTooltip._lensToDepth(profile.active_lens, profile.additional_lenses);
    }
    const v = localStorage.getItem(DEPTH_KEY);
    return VALID_DEPTHS.includes(v) ? v : 'musician';
  }

  static saveDepth(depth) {
    localStorage.setItem(DEPTH_KEY, depth);
  }

  /** Map profile lens → valid depth key, with fallback chain. */
  static _lensToDepth(lens, additionalLenses = []) {
    const MAP = { playful: 'musician', musician: 'musician', theorist: 'theorist', math: 'math' };
    const mapped = MAP[lens];
    if (mapped) return mapped;
    for (const l of additionalLenses) {
      const m = MAP[l];
      if (m) return m;
    }
    return 'musician';
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
    if (anchorEl) {
      this._lastAnchor = anchorEl;
      this._triggerEl = anchorEl;
    }

    // clear history on fresh open (not a connection navigation)
    if (!isSwap) {
      this._history = [];
    }

    // Re-resolve depth from profile on each fresh open (not connection swap)
    const profile = getProfile();
    if (!isSwap && profile) {
      this._depth = profile.active_lens;
      this._additionalLenses = profile.additional_lenses || [];
    }

    this._populate(topic);

    // Track topic visit in profile (only first time — unseen → visited)
    if (profile) {
      const status = profile.topics?.[topicId]?.status;
      if (!status || status === 'unseen') {
        updateTopicStatus(topicId, 'visited', 'tooltip');
      }
    }

    this._updateBackButton();

    if (!isSwap) {
      document.body.appendChild(this._backdrop);
      document.body.appendChild(this._el);
    }

    this._position(this._lastAnchor);
    this._el.style.animation = isSwap ? 'none' : '';
    this._el.setAttribute('aria-label', `Theory tooltip: ${topic.title}`);

    // move focus into the tooltip
    this._el.focus();
  }

  hide() {
    if (!this._currentTopicId) return;
    this._currentTopicId = null;
    this._lastAnchor = null;
    this._history = [];
    this._backdrop.remove();
    this._el.remove();

    // restore focus to the element that opened the tooltip
    if (this._triggerEl) {
      this._triggerEl.focus();
      this._triggerEl = null;
    }
  }

  setDepth(depth) {
    if (!VALID_DEPTHS.includes(depth)) return;
    this._depth = depth;
    TheoryTooltip.saveDepth(depth);

    const topic = THEORY.topics[this._currentTopicId];
    if (topic) this._renderBody(topic);
  }

  /**
   * Re-scan the DOM for new [data-theory] elements and apply a11y attributes.
   * Call this after dynamically adding theory triggers (e.g., game integrations,
   * Blockly workspace updates, or SPA route changes that inject new content).
   */
  refreshTriggers() {
    document.querySelectorAll('[data-theory]').forEach(el => {
      if (el.closest('.tt-tooltip')) return;
      // Idempotent: only set attributes if not already present
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    });
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
    el.setAttribute('aria-label', 'Theory tooltip');
    el.setAttribute('tabindex', '-1');
    el.innerHTML = `
      <div class="tt-header">
        <button class="tt-back" aria-label="Go back to previous topic">\u2190</button>
        <h3 class="tt-title"></h3>
        <span class="tt-learned" style="display:none" aria-label="Learned">\u2713</span>
        <span class="tt-badge"></span>
        <button class="tt-close" aria-label="Close tooltip">\u2715</button>
      </div>
      <p class="tt-summary"></p>
      <button class="tt-expand" type="button">Read more</button>
      <div class="tt-detail">
        <div class="tt-depth-toggle">
          <button class="tt-depth-btn" data-depth="musician">Musician</button>
          <button class="tt-depth-btn" data-depth="theorist">Theorist</button>
          <button class="tt-depth-btn" data-depth="math">Math</button>
        </div>
        <div class="tt-body"></div>
        <div class="tt-mnemonics"></div>
        <p class="tt-practical"></p>
      </div>
      <div class="tt-connections"></div>
    `;

    // close button
    el.querySelector('.tt-close').addEventListener('click', () => this.hide());

    // back button
    el.querySelector('.tt-back').addEventListener('click', () => this._goBack());

    // depth toggle clicks
    el.querySelector('.tt-depth-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.tt-depth-btn');
      if (btn) this.setDepth(btn.dataset.depth);
    });

    // expand / collapse detail
    el.querySelector('.tt-expand').addEventListener('click', () => {
      const detail = el.querySelector('.tt-detail');
      const expandBtn = el.querySelector('.tt-expand');
      const isOpen = detail.classList.contains('tt-detail--open');
      detail.classList.toggle('tt-detail--open', !isOpen);
      expandBtn.textContent = isOpen ? 'Read more' : 'Show less';
      this._position(this._lastAnchor);
    });

    // connection chip clicks — push current topic onto history
    el.querySelector('.tt-connections').addEventListener('click', (e) => {
      const chip = e.target.closest('.tt-conn-chip');
      if (chip) {
        e.stopPropagation();
        const targetId = chip.dataset.topic;
        // Guard: only navigate if target topic exists; prevents history pollution from dead links
        if (!THEORY.topics[targetId]) return;
        if (this._currentTopicId) {
          this._history.push(this._currentTopicId);
        }
        this.show(targetId, null);
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

    // learned checkmark
    const profile = getProfile();
    const isLearned = profile?.topics?.[this._currentTopicId]?.status === 'learned';
    el.querySelector('.tt-learned').style.display = isLearned ? '' : 'none';

    // summary — prefer quick_summary for the compact view
    el.querySelector('.tt-summary').textContent = topic.quick_summary || topic.summary;

    // reset expand state (each topic starts collapsed)
    el.querySelector('.tt-detail').classList.remove('tt-detail--open');
    el.querySelector('.tt-expand').textContent = 'Read more';

    // body + depth toggle highlight (renderBody handles both)
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
    // Per-topic depth resolution: preferred lens → additional lenses → musician
    const resolved = this._resolveDepthForTopic(topic);
    console.log(`[theory-engine] topic="${this._currentTopicId}" lens="${this._depth}" → depth="${resolved}"`);

    const content = topic.levels?.[resolved];
    this._el.querySelector('.tt-body').textContent = content
      ? trimContent(content)
      : 'Content coming soon.';

    // Highlight the depth button matching what's actually displayed
    this._el.querySelectorAll('.tt-depth-btn').forEach(btn => {
      btn.classList.toggle('tt-depth-btn--active', btn.dataset.depth === resolved);
    });
  }

  /** Try preferred depth against this topic's levels, fall back through additional lenses → musician. */
  _resolveDepthForTopic(topic) {
    if (topic.levels?.[this._depth]) return this._depth;
    for (const lens of this._additionalLenses) {
      if (topic.levels?.[lens]) return lens;
    }
    return 'musician';
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

  // ── history navigation ──────────────────────────────────────────────

  _goBack() {
    if (this._history.length === 0) return;
    const prevId = this._history.pop();
    this.show(prevId, null);
  }

  _updateBackButton() {
    const btn = this._el.querySelector('.tt-back');
    btn.classList.toggle('tt-back--visible', this._history.length > 0);
  }

  // ── positioning ────────────────────────────────────────────────────

  _position(anchorEl) {
    const el = this._el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // reset any previously constrained max-height
    el.style.maxHeight = '';
    el.style.visibility = 'hidden';
    el.style.top = '0px';
    el.style.left = '0px';

    const ttRect = el.getBoundingClientRect();
    let top, left;

    if (anchorEl) {
      const aRect = anchorEl.getBoundingClientRect();
      const spaceBelow = vh - aRect.bottom - GAP - MARGIN;
      const spaceAbove = aRect.top - GAP - MARGIN;

      // prefer below; flip above only if more room there
      if (ttRect.height <= spaceBelow) {
        top = aRect.bottom + GAP;
      } else if (ttRect.height <= spaceAbove) {
        top = aRect.top - GAP - ttRect.height;
      } else {
        // neither side fits entirely — pick the larger side, constrain height
        if (spaceBelow >= spaceAbove) {
          top = aRect.bottom + GAP;
          el.style.maxHeight = `${spaceBelow}px`;
        } else {
          el.style.maxHeight = `${spaceAbove}px`;
          top = MARGIN;
        }
      }

      left = aRect.left + aRect.width / 2 - ttRect.width / 2;
    } else {
      // no anchor (connection click) — center on screen
      top = (vh - ttRect.height) / 2;
      left = (vw - ttRect.width) / 2;
    }

    // vertical clamp
    if (top < MARGIN) top = MARGIN;
    const currentMaxH = parseFloat(el.style.maxHeight) || ttRect.height;
    if (top + currentMaxH > vh - MARGIN) {
      top = vh - MARGIN - currentMaxH;
      if (top < MARGIN) {
        top = MARGIN;
        el.style.maxHeight = `${vh - MARGIN * 2}px`;
      }
    }

    // horizontal clamp
    if (left < MARGIN) left = MARGIN;
    if (left + ttRect.width > vw - MARGIN) {
      left = vw - MARGIN - ttRect.width;
      if (left < MARGIN) left = MARGIN;
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
    // Store bound references so destroy() can remove them
    this._onKeydown = (e) => { if (e.key === 'Escape') this.hide(); };
    this._onResize = () => this.hide();
    document.addEventListener('keydown', this._onKeydown);
    window.addEventListener('resize', this._onResize);
  }

  // ── teardown (for SPA-style navigation) ───────────────────────────

  /**
   * Remove global listeners and detach tooltip DOM.
   * Call when unmounting the page in an SPA context to prevent leaks.
   */
  destroy() {
    this.hide();
    document.removeEventListener('keydown', this._onKeydown);
    window.removeEventListener('resize', this._onResize);
    this._el = null;
    this._backdrop = null;
  }
}

// ── init function ─────────────────────────────────────────────────────────

export function initTheoryTooltips() {
  const tooltip = new TheoryTooltip();

  // Apply a11y attributes to all trigger elements found at init time
  tooltip.refreshTriggers();

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-theory]');
    if (!trigger) return;
    // don't trigger on connection chips (handled internally)
    if (trigger.closest('.tt-tooltip')) return;
    e.preventDefault();
    e.stopPropagation();
    tooltip.show(trigger.getAttribute('data-theory'), trigger);
  });

  // keyboard support: Enter and Space open tooltips
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const trigger = e.target.closest('[data-theory]');
    if (!trigger || trigger.closest('.tt-tooltip')) return;
    e.preventDefault();
    tooltip.show(trigger.getAttribute('data-theory'), trigger);
  });

  return tooltip;
}
