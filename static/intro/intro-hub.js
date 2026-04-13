/**
 * intro-hub.js
 * ============
 * Hub page logic — reads intro progress and updates chapter cards.
 */

import { IntroCore } from '/static/intro/intro-core.js';

// Total sections per chapter (kept in sync with chapter JS files)
const CHAPTER_TOTALS = { 1: 4, 2: 3, 3: 4, 4: 5, 5: 4, 6: 3 };

document.addEventListener('DOMContentLoaded', () => {
  const progress = IntroCore.getProgress();

  for (let n = 1; n <= 6; n++) {
    const card = document.querySelector(`.intro-chapter-card[data-chapter="${n}"]`);
    const fill = document.querySelector(`[data-progress-fill="${n}"]`);
    const label = document.querySelector(`[data-progress-label="${n}"]`);
    const btn = document.querySelector(`[data-chapter-btn="${n}"]`);
    if (!card) continue;

    const chData = progress?.chapters?.[n];
    const total = CHAPTER_TOTALS[n] ?? 0;
    const viewed = chData?.viewed?.length ?? 0;
    const completed = chData?.completed ?? false;

    // Progress bar
    const pct = total > 0 ? Math.round((viewed / total) * 100) : 0;
    if (fill) fill.style.width = pct + '%';

    // Section count label
    if (label) {
      label.textContent = viewed > 0
        ? `${viewed} of ${total} sections`
        : `${total} sections`;
    }

    // Button text + style
    if (btn) {
      if (completed) {
        btn.textContent = 'Review';
        btn.classList.add('intro-btn--review');
      } else if (viewed > 0) {
        btn.textContent = 'Continue';
      } else {
        btn.textContent = 'Start';
      }
    }

    // Visual distinction for completed chapters
    if (completed) {
      card.classList.add('intro-chapter-card--completed');
    }
  }

  // Highlight "resume" chapter — the first incomplete one
  const resumeChapter = _findResumeChapter(progress);
  if (resumeChapter) {
    const card = document.querySelector(`.intro-chapter-card[data-chapter="${resumeChapter}"]`);
    if (card) card.style.setProperty('box-shadow', '0 0 0 2px var(--tone-accent)');
  }
});

function _findResumeChapter(progress) {
  if (!progress) return 1;
  for (let n = 1; n <= 6; n++) {
    const ch = progress.chapters?.[n];
    if (!ch?.completed) return n;
  }
  return null; // all complete
}
