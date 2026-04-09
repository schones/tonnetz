/**
 * walkthrough-sidebar.js
 * ======================
 * Sidebar walkthrough driver for the Explorer DAW redesign.
 *
 * Replaces the bottom-right floating bubble (walkthrough-overlay.js).
 * Renders into a fixed left-side panel that lives in the Explorer
 * markup. Reads walkthrough data from walkthroughs.js exactly like
 * the overlay did, drives HarmonyState, and dims non-focused panels.
 *
 * Public API mirrors WalkthroughOverlay so explorer.html can swap
 * the import with minimal changes:
 *
 *   const sidebar = new WalkthroughSidebar({
 *     rootEl,                  // <aside> element in the page
 *     onExit, onStep, onExport,
 *     playChord,
 *   });
 *   sidebar.start(walkthrough);
 *   sidebar.exit();
 *   sidebar.active;
 */

import { HarmonyState } from './harmony-state.js';
import SONG_EXAMPLES from './song-examples.js';

// ════════════════════════════════════════════════════════════════════
// CHORD NAME PARSER (mirrors Explorer's _parseChordName)
// ════════════════════════════════════════════════════════════════════

function parseChordName(name) {
  if (!name) return null;
  const m = name.match(/^([A-Ga-g][#♯b♭]?)(m|min|minor|maj|major|dim|aug|7|m7|maj7)?$/);
  if (!m) return null;
  const letter = m[1].charAt(0).toUpperCase();
  const acc = m[1].length > 1 ? m[1].charAt(1) : '';
  let root = letter;
  if (acc === '#' || acc === '♯') root += '♯';
  else if (acc === 'b' || acc === '♭') root += '♭';
  const suffix = (m[2] || '').toLowerCase();
  let quality = 'major';
  if (suffix === 'm' || suffix === 'min' || suffix === 'minor') quality = 'minor';
  else if (suffix === 'dim') quality = 'diminished';
  else if (suffix === 'm7') quality = 'minor';
  else if (suffix === '7' || suffix === 'maj7') quality = 'major';
  return { root, quality };
}

/** Pretty chord label for the step row, e.g. "F", "Em", "A♭7". */
function prettyChord(name) {
  if (!name) return '';
  return name.replace(/#/g, '♯').replace(/b(?=\d|$|m|7)/g, '♭');
}

// ════════════════════════════════════════════════════════════════════
// RELATED SONG LOOKUP (same as overlay)
// ════════════════════════════════════════════════════════════════════

function findRelatedSongs(conceptSpecifics, excludeNames = [], limit = 3) {
  if (!conceptSpecifics || !conceptSpecifics.length) return [];
  const specificsSet = new Set(conceptSpecifics);
  const excludeLower = excludeNames.map(n => n.toLowerCase());
  const matches = SONG_EXAMPLES.filter(ex => {
    if (!ex.concept_specifics.some(cs => specificsSet.has(cs))) return false;
    const songLower = ex.song.toLowerCase();
    if (excludeLower.some(n => songLower.includes(n) || n.includes(songLower))) return false;
    return true;
  });
  return matches.slice(0, limit).map(ex => `${ex.song} — ${ex.artist}`);
}

function extractExcludeNames(walkthroughSong) {
  if (!walkthroughSong) return [];
  const songPart = walkthroughSong.split(' — ')[0].split(' \u2014 ')[0];
  return songPart.split(' / ').map(s => s.trim().toLowerCase());
}

// ════════════════════════════════════════════════════════════════════
// PANEL FOCUS (dim non-focused Explorer panels)
// ════════════════════════════════════════════════════════════════════

const PANEL_FOCUS_MAP = {
  tonnetz:   'exp-panel--tonnetz',
  keyboard:  'exp-panel--keyboard',
  wheel:     'exp-panel--chord-wheel',
  fretboard: 'exp-panel--fretboard',
};

function normaliseFocus(focus) {
  if (!focus) return [];
  return Array.isArray(focus) ? focus : [focus];
}

function applyPanelFocus(focusPanels) {
  const allPanels = document.querySelectorAll('.exp-panel');
  if (!focusPanels.length) {
    allPanels.forEach(el => el.classList.remove('exp-panel--dimmed'));
    return;
  }
  const focusClasses = new Set(focusPanels.map(k => PANEL_FOCUS_MAP[k]).filter(Boolean));
  allPanels.forEach(el => {
    const isFocused = [...focusClasses].some(cls => el.classList.contains(cls));
    el.classList.toggle('exp-panel--dimmed', !isFocused);
  });
}

// ════════════════════════════════════════════════════════════════════
// WALKTHROUGH SIDEBAR
// ════════════════════════════════════════════════════════════════════

class WalkthroughSidebar {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.rootEl   — the <aside> sidebar element
   * @param {Function}    [options.onExit]
   * @param {Function}    [options.onStep] — called as ({root, quality, transform}) on each step
   * @param {Function}    [options.onExport]
   * @param {Function}    [options.playChord] — async (root, quality) => void
   */
  constructor(options = {}) {
    this._root = options.rootEl;
    if (!this._root) throw new Error('WalkthroughSidebar: rootEl is required');

    this._onExit = options.onExit || (() => {});
    this._onStep = options.onStep || null;
    this._onExport = options.onExport || null;
    this._playChord = options.playChord || null;

    this._walkthrough = null;
    this._stepIndex = 0;
    this._prevChord = null;

    this._cacheRefs();
    this._bindEvents();
    this.renderEmpty();
  }

  // ── Cache DOM refs ────────────────────────────────────────────────
  _cacheRefs() {
    const $ = sel => this._root.querySelector(sel);
    this._labelEl    = $('[data-wt-label]');
    this._counterEl  = $('[data-wt-counter]');
    this._progressEl = $('[data-wt-progress]');
    this._titleEl    = $('[data-wt-title]');
    this._songEl     = $('[data-wt-song]');
    this._stepsEl    = $('[data-wt-steps]');
    this._noteEl     = $('[data-wt-note]');
    this._alsoEl     = $('[data-wt-also]');
    this._seeAlsoEl  = $('[data-wt-see-also]');
    this._backBtn    = $('[data-wt-back]');
    this._nextBtn    = $('[data-wt-next]');
    this._exitBtn    = $('[data-wt-exit]');
    this._exportBtn  = $('[data-wt-export]');
  }

  _bindEvents() {
    if (this._backBtn)   this._backBtn.addEventListener('click', () => this._back());
    if (this._nextBtn)   this._nextBtn.addEventListener('click', () => this._next());
    if (this._exitBtn)   this._exitBtn.addEventListener('click', () => this.exit());
    if (this._exportBtn) this._exportBtn.addEventListener('click', () => this._onExport && this._onExport());

    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); this._next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); this._back();
      } else if (e.key === 'Escape') {
        e.preventDefault(); this.exit();
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────────
  start(walkthrough) {
    if (!walkthrough || !walkthrough.steps || !walkthrough.steps.length) return;
    this._walkthrough = walkthrough;
    this._stepIndex = 0;
    this._prevChord = null;
    this._root.classList.add('wts--active');
    this._renderShell();
    this._goToStep(0);
  }

  exit() {
    applyPanelFocus([]);
    this._walkthrough = null;
    this._root.classList.remove('wts--active');
    this.renderEmpty();
    this._onExit();
  }

  get active() {
    return this._walkthrough != null;
  }

  // ── Empty state ──────────────────────────────────────────────────
  renderEmpty() {
    if (this._labelEl)    this._labelEl.textContent = 'Walkthrough';
    if (this._counterEl)  this._counterEl.textContent = '—';
    if (this._progressEl) this._progressEl.style.setProperty('--wt-progress', '0%');
    if (this._titleEl)    this._titleEl.textContent = 'No walkthrough loaded';
    if (this._songEl)     this._songEl.textContent = 'Pick a song from the home page to start a guided tour.';
    if (this._stepsEl)    this._stepsEl.innerHTML = '';
    if (this._noteEl)     this._noteEl.textContent = '';
    if (this._alsoEl)     { this._alsoEl.textContent = ''; this._alsoEl.style.display = 'none'; }
    if (this._seeAlsoEl)  { this._seeAlsoEl.innerHTML = ''; this._seeAlsoEl.style.display = 'none'; }
    if (this._exportBtn)  this._exportBtn.style.display = 'none';
    if (this._backBtn)    this._backBtn.disabled = true;
    if (this._nextBtn)    this._nextBtn.disabled = true;
  }

  // ── Render shell when a walkthrough loads ────────────────────────
  _renderShell() {
    const wt = this._walkthrough;
    if (this._titleEl) this._titleEl.textContent = wt.title || 'Walkthrough';
    if (this._songEl)  this._songEl.textContent  = wt.song  || '';

    // Build the step list once — states get updated per step.
    this._stepsEl.innerHTML = '';
    wt.steps.forEach((step, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'wts-step';
      row.dataset.idx = String(i);
      const parsed = parseChordName(step.chord);
      if (parsed) row.dataset.quality = parsed.quality;
      row.innerHTML = `
        <span class="wts-step__badge">${i + 1}</span>
        <span class="wts-step__body">
          <span class="wts-step__chord">${prettyChord(step.chord || '')}</span>
          <span class="wts-step__fn">${step.function || step.title || ''}</span>
        </span>
        <span class="wts-step__check" aria-hidden="true">✓</span>
      `;
      row.addEventListener('click', () => this._goToStep(i));
      this._stepsEl.appendChild(row);
    });
  }

  // ── Step navigation ──────────────────────────────────────────────
  _next() {
    if (!this._walkthrough) return;
    const max = this._walkthrough.steps.length - 1;
    if (this._stepIndex < max) this._goToStep(this._stepIndex + 1);
  }
  _back() {
    if (!this._walkthrough) return;
    if (this._stepIndex > 0) this._goToStep(this._stepIndex - 1);
  }

  _goToStep(index) {
    const wt = this._walkthrough;
    if (!wt) return;
    const step = wt.steps[index];
    const total = wt.steps.length;
    const isFirst = index === 0;
    const isLast  = index === total - 1;

    // Track previous chord for transform highlighting
    if (index > 0) {
      this._prevChord = parseChordName(wt.steps[index - 1].chord);
    } else {
      this._prevChord = null;
    }
    this._stepIndex = index;

    // Header counter + progress
    if (this._counterEl)  this._counterEl.textContent = `${index + 1} / ${total}`;
    if (this._progressEl) {
      const pct = Math.round(((index + 1) / total) * 100);
      this._progressEl.style.setProperty('--wt-progress', pct + '%');
    }

    // Step list state
    [...this._stepsEl.querySelectorAll('.wts-step')].forEach((row, i) => {
      row.classList.toggle('wts-step--done',   i < index);
      row.classList.toggle('wts-step--active', i === index);
      row.classList.toggle('wts-step--future', i > index);
    });

    // Educational note
    if (this._noteEl) this._noteEl.textContent = step.body || '';

    // Related-songs blurb
    const excludeNames = extractExcludeNames(wt.song);
    const related = findRelatedSongs(step.concept_specifics, excludeNames);
    if (this._alsoEl) {
      if (related.length) {
        this._alsoEl.textContent = `You\u2019ll also hear this in: ${related.join(', ')}`;
        this._alsoEl.style.display = '';
      } else {
        this._alsoEl.textContent = '';
        this._alsoEl.style.display = 'none';
      }
    }

    // See-also link on final step
    if (this._seeAlsoEl) {
      if (isLast && wt.seeAlso && wt.seeAlso.label && wt.seeAlso.href) {
        this._seeAlsoEl.innerHTML = '';
        const link = document.createElement('a');
        link.href = wt.seeAlso.href;
        link.className = 'wts-see-also-link';
        link.textContent = `Practice this \u2192 ${wt.seeAlso.label}`;
        this._seeAlsoEl.appendChild(link);
        this._seeAlsoEl.style.display = '';
      } else {
        this._seeAlsoEl.innerHTML = '';
        this._seeAlsoEl.style.display = 'none';
      }
    }

    // Export button on final step
    if (this._exportBtn) {
      this._exportBtn.style.display = (isLast && this._onExport) ? '' : 'none';
    }

    // Back/Next state
    if (this._backBtn) this._backBtn.disabled = isFirst;
    if (this._nextBtn) {
      this._nextBtn.disabled = isLast;
      this._nextBtn.textContent = isLast ? 'Done' : 'Next →';
    }

    // Panel focus dimming
    applyPanelFocus(normaliseFocus(step.focus));

    // Scroll active step into view inside its scroller
    const activeRow = this._stepsEl.querySelector('.wts-step--active');
    if (activeRow && activeRow.scrollIntoView) {
      activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Drive HarmonyState + audio
    this._applyStep(step);
  }

  _applyStep(step) {
    const parsed = parseChordName(step.chord);
    if (!parsed) return;

    if (this._onStep) {
      this._onStep({
        root: parsed.root,
        quality: parsed.quality,
        transform: step.highlightTransform || null,
      });
    }

    if (step.highlightTransform && this._prevChord) {
      HarmonyState.setTransform(
        step.highlightTransform,
        this._prevChord.root,
        this._prevChord.quality
      );
    } else {
      HarmonyState.setTriad(parsed.root, parsed.quality);
    }

    // Force replay if the chord didn't change between steps
    if (step.autoPlay && this._playChord) {
      const prev = this._prevChord;
      const same = prev && prev.root === parsed.root && prev.quality === parsed.quality;
      if (same) {
        setTimeout(() => this._playChord(parsed.root, parsed.quality), 50);
      }
    }
  }
}

export { WalkthroughSidebar };
