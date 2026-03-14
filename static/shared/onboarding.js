/**
 * onboarding.js
 * =============
 * First-visit onboarding overlay — shows preset cards when no profile exists.
 *
 * Usage:
 *   import { showOnboardingIfNeeded } from '/static/shared/onboarding.js';
 *   showOnboardingIfNeeded();   // no-ops if profile already exists
 */

import { getProfile, initProfile } from './user-profile.js';

// ── Preset display data ──────────────────────────────────────────────────

const PRESET_CARDS = [
  {
    key: 'beginner',
    icon: '🌱',
    label: "I'm brand new to music",
    desc: 'Start from the very beginning with sound, rhythm, and notes.',
    accent: '#4ade80',
  },
  {
    key: 'dabbler',
    icon: '🎸',
    label: 'I play an instrument a little',
    desc: "You know some basics — let's fill in the gaps.",
    accent: '#38bdf8',
  },
  {
    key: 'producer',
    icon: '🎛️',
    label: "I make beats but don't know theory",
    desc: "You have great ears — let's add vocabulary.",
    accent: '#f59e0b',
  },
  {
    key: 'curious_player',
    icon: '🎹',
    label: 'I play and want to understand theory',
    desc: 'Connect what you play to why it works.',
    accent: '#a78bfa',
  },
  {
    key: 'deep_diver',
    icon: '🔬',
    label: 'I know theory, show me the deep stuff',
    desc: 'Advanced harmony, transforms, and analysis.',
    accent: '#f87171',
  },
  {
    key: 'math_explorer',
    icon: '🧮',
    label: "I'm here for the math",
    desc: 'Frequency ratios, group theory, and geometric music theory.',
    accent: '#2dd4bf',
  },
];

// ── CSS ──────────────────────────────────────────────────────────────────

const ONBOARDING_CSS = /* css */ `
.ob-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 1;
  transition: opacity 0.35s ease;
}
.ob-overlay--hidden {
  opacity: 0;
  pointer-events: none;
}

.ob-panel {
  width: 94vw;
  max-width: 720px;
  max-height: 92vh;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
  padding: 2.5rem 2rem 2rem;
  text-align: center;
  animation: ob-rise 0.4s ease-out;
  overscroll-behavior: contain;
}

.ob-panel::-webkit-scrollbar { width: 6px; }
.ob-panel::-webkit-scrollbar-track { background: transparent; }
.ob-panel::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

@keyframes ob-rise {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ob-wordmark {
  font-family: var(--font-main, 'Nunito', sans-serif);
  font-size: clamp(32px, 6vw, 48px);
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -1.5px;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.ob-welcome {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.ob-prompt {
  font-size: 0.85rem;
  color: var(--text-muted, var(--text-secondary));
  margin-bottom: 1.75rem;
}

/* ── card grid ── */
.ob-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.85rem;
  text-align: left;
  margin-bottom: 1.5rem;
}

.ob-card {
  position: relative;
  overflow: hidden;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 1.15rem 1.15rem 1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.ob-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3.5px;
  background: var(--card-accent);
}

.ob-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
  border-color: var(--card-accent);
}
[data-theme="dark"] .ob-card:hover {
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.ob-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ob-card__icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  line-height: 1;
}

.ob-card__label {
  font-family: var(--font-main, 'Nunito', sans-serif);
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  line-height: 1.25;
}

.ob-card__desc {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* ── footer ── */
.ob-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.ob-skip {
  background: none;
  border: none;
  font-family: var(--font-main, 'Nunito', sans-serif);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  transition: background 0.15s;
}
.ob-skip:hover {
  background: var(--accent-soft);
}
.ob-skip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ob-settings-note {
  font-size: 0.7rem;
  color: var(--text-muted, var(--text-secondary));
}

@media (max-width: 520px) {
  .ob-panel { padding: 2rem 1.25rem 1.5rem; }
  .ob-grid  { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .ob-panel  { animation: none; }
  .ob-overlay { transition: none; }
}
`;

// ── Overlay builder ──────────────────────────────────────────────────────

function _injectCSS() {
  if (document.getElementById('ob-styles')) return;
  const style = document.createElement('style');
  style.id = 'ob-styles';
  style.textContent = ONBOARDING_CSS;
  document.head.appendChild(style);
}

function _buildOverlay(onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'ob-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Welcome to Tonnetz');

  const cards = PRESET_CARDS.map(p => `
    <div class="ob-card" data-preset="${p.key}" tabindex="0"
         role="button" aria-label="${p.label}"
         style="--card-accent: ${p.accent};">
      <div class="ob-card__icon" aria-hidden="true">${p.icon}</div>
      <div class="ob-card__label">${p.label}</div>
      <div class="ob-card__desc">${p.desc}</div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="ob-panel">
      <div class="ob-wordmark">tonnetz</div>
      <p class="ob-welcome">Welcome to Tonnetz — learn music theory through play.</p>
      <p class="ob-prompt">Tell us about yourself so we can tailor your experience.</p>
      <div class="ob-grid">${cards}</div>
      <div class="ob-footer">
        <button class="ob-skip" type="button">Skip for now</button>
        <span class="ob-settings-note">You can change this later in Settings.</span>
      </div>
    </div>
  `;

  // ── card clicks ──
  overlay.querySelector('.ob-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.ob-card');
    if (!card) return;
    onSelect(card.dataset.preset);
  });

  // ── keyboard: Enter/Space on cards ──
  overlay.querySelector('.ob-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.ob-card');
    if (!card) return;
    e.preventDefault();
    onSelect(card.dataset.preset);
  });

  // ── skip ──
  overlay.querySelector('.ob-skip').addEventListener('click', () => {
    onSelect('beginner');
  });

  return overlay;
}

function _dismiss(overlay) {
  overlay.classList.add('ob-overlay--hidden');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  // safety fallback in case transitionend doesn't fire
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 500);
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Show the onboarding overlay if no profile exists yet.
 * Returns a Promise that resolves with the created profile (or null if
 * profile already existed and no overlay was shown).
 */
export function showOnboardingIfNeeded() {
  if (getProfile()) return Promise.resolve(null);

  _injectCSS();

  return new Promise((resolve) => {
    const overlay = _buildOverlay((preset) => {
      const profile = initProfile(preset);
      _dismiss(overlay);
      resolve(profile);
    });

    document.body.appendChild(overlay);

    // trap focus: focus the first card
    requestAnimationFrame(() => {
      const firstCard = overlay.querySelector('.ob-card');
      if (firstCard) firstCard.focus();
    });
  });
}
