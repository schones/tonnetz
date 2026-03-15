/**
 * tips-pill.js
 * ============
 * Floating "Tips" pill that shows contextual theory tips during gameplay.
 * Self-contained module — owns its own CSS, DOM, and event wiring.
 *
 * Usage:
 *   import { TipsPill } from '/static/shared/tips-pill.js';
 *   const pill = TipsPill.init(document.body);
 *   pill.update(['intervals', 'triads', 'circle_of_fifths']);
 *
 * Connection chips inside expanded cards call TheoryTooltip.show() if
 * a tooltip engine instance is available on the page.
 */

import { THEORY } from './theory-content.js';
import { getProfile } from './user-profile.js';

/** Minimum topic difficulty shown per preset. */
const PRESET_MIN_DIFFICULTY = {
  beginner:       1,
  dabbler:        2,
  producer:       2,
  curious_player: 3,
  deep_diver:     4,
  math_explorer:  4,
};

/** Max learned topics to keep when enough unlearned topics exist. */
const MAX_LEARNED_SHOWN = 1;

/** Resolve depth per-topic: try active lens → additional lenses → 'musician'. */
function _resolveDepth(topic) {
  const profile = getProfile();
  if (!profile) return 'musician';
  // Try active lens directly against this topic's levels
  if (topic?.levels?.[profile.active_lens]) return profile.active_lens;
  // Try additional lenses
  for (const l of (profile.additional_lenses || [])) {
    if (topic?.levels?.[l]) return l;
  }
  return 'musician';
}

// ── CSS (injected once) ─────────────────────────────────────────────────────

const PILL_CSS = /* css */ `

/* ── pill button ─────────────────────────────────────────────────────── */

.tips-pill {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 8000;
  font-family: inherit;
}

.tips-pill__btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--border, #2a2847);
  border-radius: 999px;
  background: var(--bg-card, #16213e);
  color: var(--text-primary, #e8e6ff);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.tips-pill__btn:hover {
  background: var(--bg-card-hover, #1a2744);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
.tips-pill__btn[aria-expanded="true"] {
  border-color: var(--accent, #6c63ff);
}

.tips-pill__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  background: var(--accent, #6c63ff);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.tips-pill__count {
  font-variant-numeric: tabular-nums;
}

/* ── dropdown ────────────────────────────────────────────────────────── */

.tips-pill__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 320px;
  max-width: calc(100vw - 2rem);
  max-height: 420px;
  overflow-y: auto;
  background: var(--bg-card, #16213e);
  border: 1px solid var(--border, #2a2847);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  padding: 0.5rem;
  display: none;
}
.tips-pill__dropdown[data-open] {
  display: block;
}

/* ── tip card ────────────────────────────────────────────────────────── */

.tips-card {
  border-radius: 8px;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  transition: background 0.12s;
}
.tips-card:hover {
  background: rgba(255, 255, 255, 0.04);
}
.tips-card + .tips-card {
  margin-top: 0.35rem;
}

.tips-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tips-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tips-card__dot--high   { background: #f38ba8; }  /* red — highly relevant */
.tips-card__dot--medium { background: #f9e2af; }  /* gold — related */
.tips-card__dot--low    { background: #6c7086; }  /* gray — tangential */

.tips-card__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #e8e6ff);
}

.tips-card__preview {
  font-size: 0.78rem;
  color: var(--text-muted, #a6adc8);
  margin-top: 0.25rem;
  line-height: 1.4;
}

/* ── expanded card body ──────────────────────────────────────────────── */

.tips-card__body {
  display: none;
  margin-top: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border, #2a2847);
}
.tips-card[data-expanded] .tips-card__body {
  display: block;
}

.tips-card__content {
  font-size: 0.82rem;
  color: var(--text-primary, #e8e6ff);
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.tips-card__practical {
  font-size: 0.78rem;
  color: var(--text-muted, #a6adc8);
  font-style: italic;
  margin-bottom: 0.5rem;
}

.tips-card__connections {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tips-card__chip {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border, #2a2847);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--accent, #6c63ff);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.tips-card__chip:hover {
  background: rgba(108, 99, 255, 0.12);
  border-color: var(--accent, #6c63ff);
}

/* ── learned indicator ───────────────────────────────────────────────── */

.tips-card__learned {
  color: var(--text-success, #16a34a);
  font-size: 0.75rem;
  margin-left: auto;
  flex-shrink: 0;
}

/* ── empty state ─────────────────────────────────────────────────────── */

.tips-pill__empty {
  text-align: center;
  padding: 1.5rem 1rem;
  color: var(--text-muted, #a6adc8);
  font-size: 0.82rem;
}
`;

let _cssInjected = false;

function injectCSS() {
  if (_cssInjected) return;
  const style = document.createElement('style');
  style.textContent = PILL_CSS;
  document.head.appendChild(style);
  _cssInjected = true;
}

// ── TipsPill class ──────────────────────────────────────────────────────────

class TipsPill {
  /**
   * Factory — creates the pill and appends it to `containerEl`.
   * @param {HTMLElement} containerEl
   * @param {object}      [opts]
   * @param {object}      [opts.tooltipEngine] - TheoryTooltip instance for deep-dive chips
   * @returns {TipsPill}
   */
  static init(containerEl, opts = {}) {
    injectCSS();
    return new TipsPill(containerEl, opts);
  }

  constructor(containerEl, opts) {
    this._container = containerEl;
    this._tooltipEngine = opts.tooltipEngine || null;
    this._topicKeys = [];
    this._open = false;

    // Build DOM
    this._el = document.createElement('div');
    this._el.className = 'tips-pill';
    this._el.innerHTML = `
      <button class="tips-pill__btn" aria-expanded="false" aria-haspopup="true"
              title="Theory tips for this exercise">
        <span class="tips-pill__icon">?</span>
        <span>Tips</span>
        <span class="tips-pill__count">0</span>
      </button>
      <div class="tips-pill__dropdown" role="menu" aria-label="Theory tips"></div>
    `;
    this._btn = this._el.querySelector('.tips-pill__btn');
    this._countEl = this._el.querySelector('.tips-pill__count');
    this._dropdown = this._el.querySelector('.tips-pill__dropdown');

    containerEl.appendChild(this._el);

    // Events
    this._btn.addEventListener('click', () => this._toggle());
    this._onOutsideClick = (e) => {
      if (this._open && !this._el.contains(e.target)) this._close();
    };
    // Fix 3: let TheoryTooltip consume Escape first — the tooltip appends .tt-tooltip
    // to the DOM when open and removes it on hide, so its presence means "tooltip is active".
    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this._open) {
        if (document.querySelector('.tt-tooltip')) return;
        this._close();
      }
    };
    document.addEventListener('mousedown', this._onOutsideClick);
    document.addEventListener('keydown', this._onKeydown);
  }

  /** Fix 2: show or hide the entire pill (e.g. suppress during test mode). */
  setVisible(visible) {
    this._el.style.display = visible ? '' : 'none';
    if (!visible) this._close();
  }

  /** Pass the tooltip engine instance so connection chips can open deep-dives. */
  setTooltipEngine(engine) {
    this._tooltipEngine = engine;
  }

  /**
   * Update the tip list with new topic keys.
   * Filters by difficulty floor based on user preset; updates count to reflect visible tips.
   * @param {Array<{id: string, relevance: 'high'|'medium'|'low'}>} topics
   */
  update(topics) {
    // Normalize: accept string[] or {id, relevance}[]
    const normalized = topics.map(t =>
      typeof t === 'string' ? { id: t, relevance: 'medium' } : t
    );

    // Filter by difficulty floor
    const profile = getProfile();
    const minDiff = PRESET_MIN_DIFFICULTY[profile?.preset] ?? 1;
    this._topicKeys = normalized.filter(({ id }) => {
      const topic = THEORY.topics[id];
      if (!topic) return false;
      const diff = typeof topic.difficulty === 'number' ? topic.difficulty : 1;
      return diff >= minDiff;
    });

    this._countEl.textContent = this._topicKeys.length;
    this._renderCards();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _toggle() {
    this._open ? this._close() : this._openDropdown();
  }

  _openDropdown() {
    this._open = true;
    this._dropdown.setAttribute('data-open', '');
    this._btn.setAttribute('aria-expanded', 'true');
  }

  _close() {
    this._open = false;
    this._dropdown.removeAttribute('data-open');
    this._btn.setAttribute('aria-expanded', 'false');
  }

  _renderCards() {
    this._dropdown.innerHTML = '';

    if (!this._topicKeys.length) {
      this._dropdown.innerHTML = '<div class="tips-pill__empty">No tips for this exercise yet.</div>';
      return;
    }

    // Split into unlearned vs learned, then aggressively trim learned
    const profile = getProfile();
    const unlearned = [];
    const learned = [];
    for (const entry of this._topicKeys) {
      if (profile?.topics?.[entry.id]?.status === 'learned') {
        learned.push(entry);
      } else {
        unlearned.push(entry);
      }
    }
    // Show at most MAX_LEARNED_SHOWN learned topics, only if few unlearned remain
    const learnedToShow = unlearned.length >= 3 ? 0 : MAX_LEARNED_SHOWN;
    const visible = [...unlearned, ...learned.slice(0, learnedToShow)];

    // Update count to reflect what's actually shown
    this._countEl.textContent = visible.length;

    for (const { id, relevance } of visible) {
      const topic = THEORY.topics[id];
      if (!topic) continue;

      const isLearned = profile?.topics?.[id]?.status === 'learned';

      const card = document.createElement('div');
      card.className = 'tips-card';
      card.setAttribute('role', 'menuitem');
      card.setAttribute('tabindex', '0');

      // Header + preview (always visible)
      const summary = topic.summary || '';
      const preview = summary.length > 80 ? summary.slice(0, 80) + '…' : summary;

      card.innerHTML = `
        <div class="tips-card__header">
          <span class="tips-card__dot tips-card__dot--${isLearned ? 'low' : relevance}"></span>
          <span class="tips-card__title">${topic.title}</span>
          ${isLearned ? '<span class="tips-card__learned" aria-label="Learned">\u2713</span>' : ''}
        </div>
        <div class="tips-card__preview">${preview}</div>
        <div class="tips-card__body"></div>
      `;

      // Click to expand/collapse
      card.addEventListener('click', () => this._toggleCard(card, topic));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._toggleCard(card, topic);
        }
      });

      this._dropdown.appendChild(card);
    }
  }

  _toggleCard(card, topic) {
    const wasExpanded = card.hasAttribute('data-expanded');
    if (wasExpanded) {
      card.removeAttribute('data-expanded');
      return;
    }

    card.setAttribute('data-expanded', '');
    const body = card.querySelector('.tips-card__body');

    // Only populate on first expand
    if (body.children.length) return;

    // Use profile-aware depth for content (per-topic fallback)
    const depth = _resolveDepth(topic);
    const rawContent = topic.levels?.[depth];
    // Depth may be a string (musician/theorist/math) or an object ({available, summary, body})
    const content = (rawContent && typeof rawContent === 'object')
      ? (rawContent.body || rawContent.summary || '')
      : (rawContent || topic.summary || '');
    const contentEl = document.createElement('div');
    contentEl.className = 'tips-card__content';
    contentEl.textContent = content;
    body.appendChild(contentEl);

    // Practical tip
    if (topic.practical) {
      const practEl = document.createElement('div');
      practEl.className = 'tips-card__practical';
      practEl.textContent = topic.practical;
      body.appendChild(practEl);
    }

    // Connection chips — link to related topics
    const connections = topic.connections || [];
    if (connections.length) {
      const chipsEl = document.createElement('div');
      chipsEl.className = 'tips-card__connections';

      for (const connId of connections) {
        const connTopic = THEORY.topics[connId];
        if (!connTopic) continue;

        const chip = document.createElement('span');
        chip.className = 'tips-card__chip';
        chip.textContent = connTopic.title;
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');

        // Fix 1: anchor tooltip to the pill button, not the chip — _close() hides the
        // dropdown before show() runs, so the chip's getBoundingClientRect() returns zeros.
        const openTooltip = (e) => {
          e.stopPropagation();
          if (this._tooltipEngine) {
            this._close();
            this._tooltipEngine.show(connId, this._btn);
          }
        };
        chip.addEventListener('click', openTooltip);
        chip.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTooltip(e);
          }
        });

        chipsEl.appendChild(chip);
      }
      body.appendChild(chipsEl);
    }
  }

  /** Clean up listeners and remove DOM. */
  destroy() {
    document.removeEventListener('mousedown', this._onOutsideClick);
    document.removeEventListener('keydown', this._onKeydown);
    this._el.remove();
    this._el = null;
  }
}

export { TipsPill };
