/**
 * visual-toggle.js
 * ================
 * Opt-in "🎨 Visuals" toggle button + collapsible quick-customizer panel.
 * Injects UI into a game's controls area without touching game logic.
 *
 * Depends on:
 *   - visual-config.js  → VisualConfig
 *
 * Exports: VisualToggle
 */

import { VisualConfig } from './visual-config.js';

// ════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════

const STYLES = `
.visual-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  background: var(--bg-card, #1e1e2e);
  color: var(--text-primary, #cdd6f4);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
  position: relative;
}
.visual-toggle-btn:hover {
  background: var(--bg-hover, #313244);
  border-color: var(--accent, #6c63ff);
}
.visual-toggle-btn[aria-expanded="true"] {
  border-color: var(--accent, #6c63ff);
  color: var(--accent, #6c63ff);
}

.visual-toggle-wrapper {
  position: relative;
  display: inline-block;
}
.visual-toggle-wrapper--top-right { margin-left: auto; }
.visual-toggle-wrapper--top-left  { margin-right: auto; }
.visual-toggle-wrapper--bottom-right { margin-left: auto; }

.visual-toggle-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 220px;
  background: var(--bg-card, #1e1e2e);
  border: 1px solid var(--border, #444);
  border-radius: 10px;
  padding: 0.9rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  z-index: 200;
  display: none;
  flex-direction: column;
  gap: 0.75rem;
}
.visual-toggle-wrapper--top-left .visual-toggle-panel {
  right: auto;
  left: 0;
}
.visual-toggle-panel[data-open="true"] {
  display: flex;
}

.vt-section-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #888);
  margin-bottom: 0.25rem;
}

/* Enable/disable row */
.vt-enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.vt-toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}
.vt-toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.vt-toggle-track {
  position: absolute;
  inset: 0;
  background: var(--border, #444);
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.2s;
}
.vt-toggle-track::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.vt-toggle-switch input:checked + .vt-toggle-track {
  background: var(--accent, #6c63ff);
}
.vt-toggle-switch input:checked + .vt-toggle-track::after {
  transform: translateX(16px);
}

/* Button group (color scheme / canvas effect) */
.vt-btn-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.vt-btn-group button {
  flex: 1 1 0;
  padding: 0.25rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--border, #444);
  border-radius: 5px;
  background: transparent;
  color: var(--text-primary, #cdd6f4);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  white-space: nowrap;
}
.vt-btn-group button:hover {
  background: var(--bg-hover, #313244);
}
.vt-btn-group button[aria-pressed="true"] {
  background: var(--accent, #6c63ff);
  border-color: var(--accent, #6c63ff);
  color: #fff;
}

/* Divider */
.vt-divider {
  border: none;
  border-top: 1px solid var(--border, #333);
  margin: 0;
}

/* Studio link */
.vt-studio-link {
  display: block;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent, #6c63ff);
  text-decoration: none;
  padding: 0.3rem;
  border: 1px solid var(--accent, #6c63ff);
  border-radius: 6px;
  transition: background 0.12s;
}
.vt-studio-link:hover {
  background: var(--accent, #6c63ff);
  color: #fff;
}
`;

// ════════════════════════════════════════════════════════════════════
// VISUAL TOGGLE
// ════════════════════════════════════════════════════════════════════

const VisualToggle = {
  _wrapper: null,
  _panel:   null,
  _btn:     null,

  /**
   * Inject the toggle button + panel into the given container element.
   * @param {string} containerId  ID of the container element
   * @param {object} [options]    { position: 'top-right' | 'top-left' | 'bottom-right' }
   */
  init(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[VisualToggle] Container #${containerId} not found.`);
      return;
    }

    const position = options.position || 'top-right';

    // Inject styles once
    if (!document.getElementById('visual-toggle-styles')) {
      const style = document.createElement('style');
      style.id = 'visual-toggle-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    // Outer wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `visual-toggle-wrapper visual-toggle-wrapper--${position}`;

    // Toggle button
    const btn = document.createElement('button');
    btn.className = 'visual-toggle-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'visual-toggle-panel');
    btn.innerHTML = '🎨 Visuals';
    btn.addEventListener('click', () => this._togglePanel());

    // Panel
    const panel = document.createElement('div');
    panel.className = 'visual-toggle-panel';
    panel.id = 'visual-toggle-panel';
    panel.setAttribute('data-open', 'false');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Visual layer settings');
    panel.innerHTML = this._buildPanelHTML();

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);
    container.appendChild(wrapper);

    this._wrapper = wrapper;
    this._panel   = panel;
    this._btn     = btn;

    this._bindEvents(panel);
    this._syncToConfig();
  },

  // ── Panel HTML ────────────────────────────────────────────────

  _buildPanelHTML() {
    return `
      <div class="vt-enable-row">
        <span class="vt-section-label" style="margin-bottom:0">Visual layer</span>
        <label class="vt-toggle-switch" aria-label="Enable visual layer">
          <input type="checkbox" id="vt-enable" ${VisualConfig.enabled ? 'checked' : ''}>
          <span class="vt-toggle-track"></span>
        </label>
      </div>

      <hr class="vt-divider">

      <div>
        <div class="vt-section-label">Color scheme</div>
        <div class="vt-btn-group" role="group" aria-label="Color scheme">
          <button data-scheme="tonnetz" aria-pressed="${VisualConfig.colorScheme === 'tonnetz'}">Tonnetz</button>
          <button data-scheme="quality" aria-pressed="${VisualConfig.colorScheme === 'quality'}">Quality</button>
          <button data-scheme="none"    aria-pressed="${VisualConfig.colorScheme === 'none'}">Off</button>
        </div>
      </div>

      <div>
        <div class="vt-section-label">Canvas effect</div>
        <div class="vt-btn-group" role="group" aria-label="Canvas effect">
          <button data-effect="particle" aria-pressed="${VisualConfig.canvasEffect === 'particle'}">Particles</button>
          <button data-effect="glow"     aria-pressed="${VisualConfig.canvasEffect === 'glow'}">Glow</button>
          <button data-effect="none"     aria-pressed="${VisualConfig.canvasEffect === 'none'}">None</button>
        </div>
      </div>

      <div>
        <div class="vt-section-label">Presets</div>
        <div class="vt-btn-group" role="group" aria-label="Visual presets">
          <button data-preset="harmony">Harmony</button>
          <button data-preset="minimal">Minimal</button>
          <button data-preset="classic">Classic</button>
        </div>
      </div>

      <hr class="vt-divider">

      <a id="vt-studio-link" class="vt-studio-link" href="/skratch-studio?visualPreset=${VisualConfig.preset}"
         target="_blank" rel="noopener">Open in Skratch Studio →</a>
    `;
  },

  // ── Event Binding ─────────────────────────────────────────────

  _bindEvents(panel) {
    // Enable toggle
    const enableCb = panel.querySelector('#vt-enable');
    if (enableCb) {
      enableCb.addEventListener('change', () => {
        VisualConfig.set({ enabled: enableCb.checked });
      });
    }

    // Color scheme buttons
    panel.querySelectorAll('[data-scheme]').forEach(btn => {
      btn.addEventListener('click', () => {
        VisualConfig.set({ colorScheme: btn.dataset.scheme });
        panel.querySelectorAll('[data-scheme]').forEach(b =>
          b.setAttribute('aria-pressed', b.dataset.scheme === btn.dataset.scheme));
      });
    });

    // Canvas effect buttons
    panel.querySelectorAll('[data-effect]').forEach(btn => {
      btn.addEventListener('click', () => {
        VisualConfig.set({ canvasEffect: btn.dataset.effect });
        panel.querySelectorAll('[data-effect]').forEach(b =>
          b.setAttribute('aria-pressed', b.dataset.effect === btn.dataset.effect));
      });
    });

    // Preset buttons
    panel.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        VisualConfig.applyPreset(btn.dataset.preset);
        this._syncToConfig();
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this._wrapper && !this._wrapper.contains(e.target)) {
        this._closePanel();
      }
    }, { capture: false });
  },

  // ── Panel Open/Close ──────────────────────────────────────────

  _togglePanel() {
    const isOpen = this._panel.getAttribute('data-open') === 'true';
    if (isOpen) {
      this._closePanel();
    } else {
      this._openPanel();
    }
  },

  _openPanel() {
    this._panel.setAttribute('data-open', 'true');
    this._btn.setAttribute('aria-expanded', 'true');
  },

  _closePanel() {
    if (!this._panel) return;
    this._panel.setAttribute('data-open', 'false');
    this._btn.setAttribute('aria-expanded', 'false');
  },

  // ── Sync UI to VisualConfig state ─────────────────────────────

  _syncToConfig() {
    if (!this._panel) return;

    const enableCb = this._panel.querySelector('#vt-enable');
    if (enableCb) enableCb.checked = VisualConfig.enabled;

    this._panel.querySelectorAll('[data-scheme]').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.scheme === VisualConfig.colorScheme));

    this._panel.querySelectorAll('[data-effect]').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.effect === VisualConfig.canvasEffect));

    // Update studio link
    const link = this._panel.querySelector('#vt-studio-link');
    if (link) link.href = `/skratch-studio?visualPreset=${VisualConfig.preset}`;
  },
};

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { VisualToggle };

if (typeof window !== 'undefined') {
  window.VisualToggle = VisualToggle;
}
