/**
 * intro-core.js
 * =============
 * Scroll engine and progress tracker for the Tonnetz intro module.
 *
 * Usage:
 *   import { IntroCore } from '/static/intro/intro-core.js';
 *   IntroCore.init(1);  // loads Chapter 1
 */

import {
  getIntroProgress,
  updateIntroProgress,
  markChapterComplete,
} from '/static/shared/user-profile.js';

// ── Chapter module map ─────────────────────────────────────────────────────

const CHAPTER_MODULES = {
  1: '/static/intro/ch1-sound.js',
  2: '/static/intro/ch2-scales.js',
  3: '/static/intro/ch3-chords.js',
  4: '/static/intro/ch4-tonnetz.js',
  5: '/static/intro/ch5-transforms.js',
};

// ── IntroCore ──────────────────────────────────────────────────────────────

export const IntroCore = {

  /**
   * Load a chapter, render its sections, and wire the scroll observer.
   * @param {number} chapterNum  1–5
   */
  async init(chapterNum) {
    const modulePath = CHAPTER_MODULES[chapterNum];
    if (!modulePath) {
      console.warn('[intro-core] unknown chapter:', chapterNum);
      return;
    }

    const mod = await import(modulePath);
    const { sections, chapterMeta } = mod;

    // ── Wire chapter-level UI ──────────────────────────────────────────
    const chapterEl = document.querySelector('.intro-chapter');
    if (chapterEl) chapterEl.setAttribute('data-tone', chapterMeta.tone);

    const titleEl = document.querySelector('.intro-chapter__title');
    if (titleEl) titleEl.textContent = chapterMeta.title;

    // ── Render sections ────────────────────────────────────────────────
    const container = document.querySelector('.intro-sections');
    if (!container) return;

    sections.forEach(section => {
      const el = _buildSection(section);
      container.appendChild(el);
    });

    // Show footer after sections are in the DOM
    const footer = document.querySelector('.intro-chapter__footer');
    if (footer) footer.hidden = false;

    // ── Progress bar (initial state) ───────────────────────────────────
    IntroCore._updateProgressBar(chapterNum, sections);

    // ── IntersectionObserver ───────────────────────────────────────────
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const sectionEl = entry.target;
        sectionEl.classList.add('intro-section--active');

        const sectionId = sectionEl.id;
        const sectionDef = sections.find(s => s.id === sectionId);

        // Run mount hook if defined
        if (sectionDef?.onActivate) {
          try {
            sectionDef.onActivate(sectionEl);
          } catch (e) {
            console.warn('[intro-core] onActivate error for', sectionId, e);
          }
        }

        // Track progress
        IntroCore.markSectionComplete(chapterNum, sectionId, sections);
      });
    }, { threshold: 0.5 });

    container.querySelectorAll('.intro-section').forEach(el => observer.observe(el));
  },

  // ── Progress API ─────────────────────────────────────────────────────────

  /** Returns the full intro progress object from the profile. */
  getProgress() {
    return getIntroProgress();
  },

  /**
   * Mark a section as viewed. Updates profile + progress bar.
   * @param {number} chapterNum
   * @param {string} sectionId
   * @param {Array}  sections    — the chapter's full sections array
   */
  markSectionComplete(chapterNum, sectionId, sections) {
    const totalSections = sections.length;
    updateIntroProgress(chapterNum, sectionId, totalSections);

    // Check if all sections are now viewed → mark chapter complete
    const progress = getIntroProgress();
    const chData = progress?.chapters?.[chapterNum];
    if (chData && !chData.completed) {
      const viewed = chData.viewed || [];
      const allViewed = sections.every(s => viewed.includes(s.id));
      if (allViewed) {
        markChapterComplete(chapterNum);
      }
    }

    IntroCore._updateProgressBar(chapterNum, sections);
  },

  /**
   * Returns progress summary for a chapter.
   * @param {number} chapterNum
   * @returns {{ completed: boolean, sectionsViewed: number, sectionsTotal: number }}
   */
  getChapterProgress(chapterNum) {
    const progress = getIntroProgress();
    if (!progress) return { completed: false, sectionsViewed: 0, sectionsTotal: 0 };
    const ch = progress.chapters?.[chapterNum];
    if (!ch) return { completed: false, sectionsViewed: 0, sectionsTotal: 0 };
    return {
      completed: ch.completed || false,
      sectionsViewed: (ch.viewed || []).length,
      sectionsTotal: ch.total || 0,
    };
  },

  // ── Internal helpers ──────────────────────────────────────────────────────

  _updateProgressBar(chapterNum, sections) {
    const progress = getIntroProgress();
    const ch = progress?.chapters?.[chapterNum];
    const viewed = ch?.viewed?.length || 0;
    const total = sections.length;
    const pct = total > 0 ? Math.round((viewed / total) * 100) : 0;

    const fill = document.querySelector('.intro-chapter__progress-fill');
    if (fill) fill.style.width = pct + '%';

    const label = document.querySelector('.intro-chapter__progress-label');
    if (label) label.textContent = `${viewed} of ${total} sections`;
  },
};

// ── DOM builder ────────────────────────────────────────────────────────────

function _buildSection(section) {
  const el = document.createElement('div');
  el.className = 'intro-section';
  el.id = section.id;

  // Narration
  const narration = document.createElement('div');
  narration.className = 'intro-narration';
  narration.textContent = section.narration;
  el.appendChild(narration);

  // Interactive placeholder
  if (section.interactive) {
    const interactive = document.createElement('div');
    interactive.className = 'intro-interactive';
    interactive.dataset.component = section.interactive;
    el.appendChild(interactive);
  }

  // Try It callout
  if (section.tryIt) {
    const tryIt = document.createElement('div');
    tryIt.className = 'intro-try-it';
    tryIt.textContent = section.tryIt;
    el.appendChild(tryIt);
  }

  // Game link card
  if (section.gameLink) {
    const link = document.createElement('a');
    link.className = 'intro-game-link';
    link.href = section.gameLink.url;
    link.textContent = section.gameLink.label;
    el.appendChild(link);
  }

  return el;
}
