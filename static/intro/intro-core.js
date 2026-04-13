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

import { mountNextSteps, revealNextSteps } from '/static/intro/intro-next-steps.js';

// ── Chapter module map ─────────────────────────────────────────────────────

const CHAPTER_MODULES = {
  1: '/static/intro/ch1-sound.js',
  2: '/static/intro/ch2-scales.js',
  3: '/static/intro/ch3-chords.js',
  4: '/static/intro/ch4-beyond-triads.js',
  5: '/static/intro/ch5-tonnetz.js',
  6: '/static/intro/ch6-transforms.js',
};

// ── IntroCore ──────────────────────────────────────────────────────────────

export const IntroCore = {

  /**
   * Load a chapter, render its sections, and wire the scroll observer.
   * @param {number} chapterNum  1–6
   */
  async init(chapterNum) {
    const modulePath = CHAPTER_MODULES[chapterNum];
    if (!modulePath) {
      console.warn('[intro-core] unknown chapter:', chapterNum);
      return;
    }

    const mod = await import(modulePath);
    const { sections, acts, chapterMeta } = mod;

    // ── Wire chapter-level UI ──────────────────────────────────────────
    const chapterEl = document.querySelector('.intro-chapter');
    if (chapterEl) chapterEl.setAttribute('data-tone', chapterMeta.tone);

    const titleEl = document.querySelector('.intro-chapter__title');
    if (titleEl) titleEl.textContent = chapterMeta.title;

    // ── Render content ─────────────────────────────────────────────────
    const container = document.querySelector('.intro-sections');
    if (!container) return;

    if (acts) {
      // Scrollytelling acts path — sticky interactive + scroll-driven steps
      IntroCore._initActs(acts, sections, chapterNum, container);
    } else {
      // Legacy sections path (backward compatible)
      sections.forEach(section => {
        const el = _buildSection(section);
        container.appendChild(el);
      });

      const activatedSections = new Set();

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const sectionEl = entry.target;
          const sectionId = sectionEl.id;
          const sectionDef = sections.find(s => s.id === sectionId);

          if (entry.isIntersecting) {
            sectionEl.classList.add('intro-section--active');

            // First time entering: schedule --seen after sentences animate in
            if (!sectionEl.classList.contains('intro-section--seen')) {
              const spans = sectionEl.querySelectorAll('.intro-narration__sentence');
              const animDuration = Math.max(spans.length - 1, 0) * 200 + 400;
              setTimeout(() => sectionEl.classList.add('intro-section--seen'), animDuration + 50);
            }

            if (sectionDef?.onActivate && !activatedSections.has(sectionId)) {
              activatedSections.add(sectionId);
              try { sectionDef.onActivate(sectionEl); } catch (e) {
                console.warn('[intro-core] onActivate error for', sectionId, e);
              }
            }

            if (sectionDef?.onEnter) {
              try { sectionDef.onEnter(sectionEl); } catch (e) {
                console.warn('[intro-core] onEnter error for', sectionId, e);
              }
            }

            IntroCore.markSectionComplete(chapterNum, sectionId, sections);
          } else {
            sectionEl.classList.remove('intro-section--active');

            if (sectionDef?.onLeave) {
              try { sectionDef.onLeave(sectionEl); } catch (e) {
                console.warn('[intro-core] onLeave error for', sectionId, e);
              }
            }
          }
        });
      }, { threshold: [0.3] });

      container.querySelectorAll('.intro-section').forEach(el => observer.observe(el));
    }

    // Show footer after content is in the DOM
    const footer = document.querySelector('.intro-chapter__footer');
    if (footer) footer.hidden = false;

    // ── Progress bar (initial state) ───────────────────────────────────
    IntroCore._updateProgressBar(chapterNum, sections);

    // ── What's Next card ───────────────────────────────────────────────
    mountNextSteps(chapterNum);
    const existingProgress = getIntroProgress();
    if (existingProgress?.chapters?.[chapterNum]?.completed) {
      revealNextSteps();
    }
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
        revealNextSteps();
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

  // ── Acts (scrollytelling) ─────────────────────────────────────────────────

  _initActs(acts, sections, chapterNum, container) {
    const actActiveStepId = new Map(); // actId → currently active stepId

    const stepObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const stepEl = entry.target;
        const actEl = stepEl.closest('.intro-act');
        const actId = actEl?.dataset.actId;
        const stepId = stepEl.dataset.stepId;
        if (!actId || !stepId) return;

        const act = acts.find(a => a.id === actId);
        if (!act) return;
        const step = act.steps.find(s => s.id === stepId);
        if (!step) return;

        const stickyEl = actEl.querySelector('.intro-act__sticky');

        if (entry.isIntersecting) {
          const prevStepId = actActiveStepId.get(actId);
          if (prevStepId === stepId) return; // already active — no-op

          // Deactivate previous step
          if (prevStepId) {
            const prevStepEl = actEl.querySelector(`[data-step-id="${prevStepId}"]`);
            if (prevStepEl) prevStepEl.classList.remove('intro-step--active');
            const prevStep = act.steps.find(s => s.id === prevStepId);
            if (prevStep?.onLeave) {
              try { prevStep.onLeave(stickyEl); } catch (e) {
                console.warn('[intro-core] onLeave error for', prevStepId, e);
              }
            }
          }

          // Activate new step
          actActiveStepId.set(actId, stepId);
          stepEl.classList.add('intro-step--active');

          if (step.onEnter) {
            try { step.onEnter(stickyEl); } catch (e) {
              console.warn('[intro-core] onEnter error for', stepId, e);
            }
          }

          IntroCore.markSectionComplete(chapterNum, stepId, sections);
        }
      });
    }, { rootMargin: '-33% 0px -33% 0px', threshold: 0 });

    acts.forEach(act => {
      const actEl = document.createElement('div');
      actEl.className = 'intro-act';
      actEl.dataset.actId = act.id;

      // Sticky container for the interactive widget
      const stickyEl = document.createElement('div');
      stickyEl.className = 'intro-act__sticky';
      actEl.appendChild(stickyEl);

      if (act.mountInteractive) {
        try {
          act.mountInteractive(stickyEl);
        } catch (e) {
          console.warn('[intro-core] mountInteractive error for', act.id, e);
        }
      }

      // Steps container
      const stepsEl = document.createElement('div');
      stepsEl.className = 'intro-act__steps';
      actEl.appendChild(stepsEl);

      act.steps.forEach(step => {
        const stepEl = _buildStepCard(step);
        stepsEl.appendChild(stepEl);
        stepObserver.observe(stepEl);
      });

      container.appendChild(actEl);
    });
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

function _buildStepCard(step) {
  const el = document.createElement('div');
  el.className = 'intro-step';
  el.id = step.id;
  el.dataset.stepId = step.id;

  const narration = document.createElement('div');
  narration.className = 'intro-narration';
  narration.textContent = step.narration;
  el.appendChild(narration);

  if (step.tryIt) {
    const tryIt = document.createElement('div');
    tryIt.className = 'intro-try-it';
    tryIt.textContent = step.tryIt;
    el.appendChild(tryIt);
  }

  if (step.gameLink) {
    const link = document.createElement('a');
    link.className = 'intro-game-link';
    link.href = step.gameLink.url;
    link.textContent = step.gameLink.label;
    el.appendChild(link);
  }

  return el;
}

function _buildNarrationSentences(container, text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const parts = sentences.length > 0 ? sentences : [text];
  parts.forEach((sentence, i) => {
    const span = document.createElement('span');
    span.className = 'intro-narration__sentence';
    span.textContent = i < parts.length - 1 ? sentence + ' ' : sentence;
    span.style.transitionDelay = `${i * 200}ms`;
    container.appendChild(span);
  });
}

function _buildSection(section) {
  const el = document.createElement('div');
  el.className = 'intro-section';
  el.id = section.id;

  // Narration — split into sentences for progressive reveal
  const narration = document.createElement('div');
  narration.className = 'intro-narration';
  _buildNarrationSentences(narration, section.narration);
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
