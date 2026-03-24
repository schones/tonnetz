/**
 * ch1-sound.js — Chapter 1: Sound & Notes
 * =========================================
 * Four interactive sections introducing sound, pitch, the 12 notes,
 * concert pitch, and the keyboard pattern.
 *
 * Audio:
 *   - Section 1 uses a Tone.Oscillator (sine wave)
 *   - Sections 2–4 use a Salamander piano sampler (lazy-loaded via intro-audio.js)
 *   - Section 3 adds an oboe sampler (local to this chapter)
 *
 * All interactive components are mounted lazily via onActivate when
 * the section scrolls into view.
 */

import {
  noteFreq,
  ensureTone,
  ensureSampler,
  playSamplerNote,
  buildKeyboard,
  injectSharedCSS,
  registerCleanup,
} from '/static/intro/intro-audio.js';

// ════════════════════════════════════════════════════════════════════
// MODULE STATE
// ════════════════════════════════════════════════════════════════════

let _oscillator = null;
let _oscillatorGain = null;
let _oboeSampler = null;
let _oboeSamplerLoading = false;
let _oboeSamplerReady = false;

/** Set of section IDs whose interactive has already been mounted. */
const _mounted = new Set();

// Shared keyboard state (sections 2–4)
let _sharedKb = null;         // current keyboard instance { el, keys, cleanup }
let _sharedKbScrollEl = null; // the .intro-kb-scroll wrapper (moves between sections)
let _sharedKbInfo = null;     // the .intro-kb-info note-display line
let _sharedKbHostEl = null;   // which widget element currently owns the keyboard
let _s2Widget = null;         // section 2's .intro-widget container
let _s3Widget = null;         // section 3's .intro-widget container
let _s4Widget = null;         // section 4's .intro-widget container
let _a440Widget = null;       // section 3's A440 buttons div (built once, show/hide)
let _findWidget = null;       // section 4's find buttons div (built once, show/hide)

// ════════════════════════════════════════════════════════════════════
// CH1-ONLY CSS (injected once)
// ════════════════════════════════════════════════════════════════════

const CH1_CSS = /* css */ `

/* Override the dashed placeholder border once real content is mounted */
.intro-interactive:not(:empty) {
  border: 1px solid var(--border, #dfe6e9);
  border-style: solid;
}

/* ── Section 1: Oscillator ─────────────────────────────────── */

.ch1-osc-canvas {
  width: 100%;
  max-width: 500px;
  height: 120px;
  border-radius: 10px;
  background: var(--bg-primary, #1a1a2e);
  display: block;
}

.ch1-slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 500px;
}

.ch1-slider-row label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted, #b2bec3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.ch1-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--border, #dfe6e9);
  outline: none;
  cursor: pointer;
}

.ch1-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary, #6c5ce7);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
  cursor: grab;
}

.ch1-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary, #6c5ce7);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
  cursor: grab;
}

.ch1-play-btn {
  padding: 8px 20px;
  border: 2px solid var(--color-primary, #6c5ce7);
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary, #6c5ce7);
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}

.ch1-play-btn:hover {
  background: var(--color-primary, #6c5ce7);
  color: #fff;
}

.ch1-play-btn--active {
  background: var(--color-primary, #6c5ce7);
  color: #fff;
}

/* ── Section 3: A440 buttons ───────────────────────────────── */

.ch1-a440-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.ch1-a440-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 22px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 12px;
  background: var(--bg-secondary, #f0f0f5);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  user-select: none;
}

.ch1-a440-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
  transform: translateY(-2px);
}

.ch1-a440-btn--playing {
  background: var(--color-primary, #6c5ce7);
  border-color: var(--color-primary, #6c5ce7);
}

.ch1-a440-btn--playing .ch1-a440-note,
.ch1-a440-btn--playing .ch1-a440-freq {
  color: #fff;
}

.ch1-a440-note {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-primary, #2d3436);
}

.ch1-a440-freq {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted, #b2bec3);
  font-variant-numeric: tabular-nums;
}

.ch1-a440-explain {
  font-size: 0.82rem;
  color: var(--text-secondary, #636e72);
  text-align: center;
  max-width: 420px;
  line-height: 1.55;
  min-height: 1.5em;
}

/* ── Section 4: Find buttons ───────────────────────────────── */

.ch1-find-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.ch1-find-btn {
  padding: 6px 16px;
  border: 2px solid var(--border, #dfe6e9);
  border-radius: 8px;
  background: var(--bg-secondary, #f0f0f5);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  user-select: none;
  color: var(--text-primary, #2d3436);
}

.ch1-find-btn:hover {
  border-color: var(--color-primary, #6c5ce7);
}

.ch1-find-btn--active {
  background: var(--color-accent, #fdcb6e);
  border-color: var(--color-accent-dark, #f39c12);
  color: #2d3436;
}

/* Group brackets above black keys */
.ch1-group-label {
  position: absolute;
  top: -22px;
  font-size: 0.7rem;
  font-weight: 800;
  text-align: center;
  pointer-events: none;
  z-index: 3;
  color: var(--text-muted, #b2bec3);
}

/* ── Responsive ────────────────────────────────────────────── */

@media (max-width: 480px) {
  .ch1-osc-canvas { height: 90px; }
  .ch1-a440-btn { padding: 10px 16px; }
}
`;

function _injectCSS() {
  injectSharedCSS();
  if (document.getElementById('ch1-styles')) return;
  const el = document.createElement('style');
  el.id = 'ch1-styles';
  el.textContent = CH1_CSS;
  document.head.appendChild(el);
}

// ════════════════════════════════════════════════════════════════════
// OBOE SAMPLER (chapter 3 only)
// ════════════════════════════════════════════════════════════════════

async function _loadOboeSampler() {
  if (_oboeSampler || _oboeSamplerLoading) return;
  _oboeSamplerLoading = true;
  // ensureToneLoaded is not exported; piggyback by calling ensureSampler which loads Tone
  // Actually we need Tone loaded first — call ensureSampler which will load the script
  await ensureSampler();
  try {
    const resp = await fetch('https://gleitz.github.io/midi-js-soundfonts/MusyngKite/oboe-mp3.js');
    if (!resp.ok) throw new Error(`Soundfont fetch failed (${resp.status})`);
    const text = await resp.text();
    const sfMatch = /MIDI\.Soundfont\.\w+\s*=\s*(\{[\s\S]+\})\s*;?\s*$/.exec(text);
    if (!sfMatch) throw new Error('Unexpected soundfont format');
    // eslint-disable-next-line no-new-func
    const allNotes = new Function('return ' + sfMatch[1])();
    const sparseKeys = ['A2', 'A3', 'A4', 'A5', 'A6'];
    const urls = {};
    sparseKeys.forEach(k => { if (allNotes[k]) urls[k] = allNotes[k]; });
    const vol = new Tone.Volume(0).toDestination();
    _oboeSampler = new Tone.Sampler({
      urls,
      onload: () => { _oboeSamplerReady = true; },
      onerror: (err) => console.warn('[ch1] Oboe sampler error:', err),
    }).connect(vol);
  } catch (err) {
    console.warn('[ch1] Failed to load oboe sampler:', err);
    _oboeSamplerLoading = false;
  }
}

// ════════════════════════════════════════════════════════════════════
// SHARED KEYBOARD MANAGER
// ════════════════════════════════════════════════════════════════════

/**
 * Rebuild the shared keyboard inside hostEl (an .intro-widget div).
 * Cleans up the previous instance, builds the new keyboard, fades it in.
 * The keyboard is inserted at the front of hostEl; the info line follows it.
 * Supplementary widgets already in hostEl remain after the info line.
 * @param {HTMLElement} hostEl       — the .intro-widget to build into
 * @param {number}      startOctave
 * @param {number}      numOctaves
 * @param {Object}      [opts]       — passed through to buildKeyboard
 * @param {string}      [opts.containerStyle]  — inline style for the scroll wrapper
 */
function _rebuildKeyboard(hostEl, startOctave, numOctaves, opts = {}) {
  if (_sharedKb) {
    _sharedKb.cleanup();
    _sharedKb = null;
  }
  if (_sharedKbScrollEl) {
    _sharedKbScrollEl.remove();
    _sharedKbScrollEl = null;
  }

  if (!_sharedKbInfo) {
    _sharedKbInfo = document.createElement('div');
    _sharedKbInfo.className = 'intro-kb-info';
    _sharedKbInfo.innerHTML = '&nbsp;';
  }

  const scroll = document.createElement('div');
  scroll.className = 'intro-kb-scroll';
  if (opts.containerStyle) {
    scroll.setAttribute('style', opts.containerStyle);
  }
  scroll.style.opacity = '0';
  scroll.style.transition = 'opacity 0.15s ease';
  _sharedKbScrollEl = scroll;

  const kb = buildKeyboard(scroll, startOctave, numOctaves, opts);
  _sharedKb = kb;
  _sharedKbHostEl = hostEl;

  hostEl.insertBefore(scroll, hostEl.firstChild);
  scroll.insertAdjacentElement('afterend', _sharedKbInfo);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scroll.style.opacity = '1';
    });
  });
}

// ════════════════════════════════════════════════════════════════════
// KEYBOARD HELPERS
// ════════════════════════════════════════════════════════════════════

/** Clear all custom highlights from a keyboard */
function _clearHighlights(kb) {
  kb.keys.forEach(el => {
    el.classList.remove(
      'intro-kb-key--pattern-hl',
      'intro-kb-key--octave-hl',
      'intro-kb-key--show-label',
    );
  });
}

/** Add subtle group indicators above the black keys */
function _addGroupBrackets(kb) {
  const blackKeys = [];
  kb.keys.forEach((el, noteId) => {
    if (el.classList.contains('intro-kb-key--black')) {
      blackKeys.push({ el, noteId, pc: parseInt(el.dataset.pc, 10) });
    }
  });

  // Group: pc 1,3 = group of 2; pc 6,8,10 = group of 3
  blackKeys.forEach(({ el, pc }) => {
    if (pc === 1 || pc === 3) {
      el.classList.add('intro-kb-key--group-2');
    } else {
      el.classList.add('intro-kb-key--group-3');
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// SECTION 1: OSCILLATOR WIDGET
// ════════════════════════════════════════════════════════════════════

function _mountOscillator(sectionEl) {
  _injectCSS();
  const host = sectionEl.querySelector('.intro-interactive');
  if (!host) return;

  const widget = document.createElement('div');
  widget.className = 'intro-widget';

  const freqDisplay = document.createElement('div');
  freqDisplay.className = 'intro-freq-display';
  freqDisplay.textContent = '440 Hz';

  const canvas = document.createElement('canvas');
  canvas.className = 'ch1-osc-canvas';
  canvas.width = 500;
  canvas.height = 120;

  const sliderRow = document.createElement('div');
  sliderRow.className = 'ch1-slider-row';

  const lowLabel = document.createElement('label');
  lowLabel.textContent = '100 Hz';
  const highLabel = document.createElement('label');
  highLabel.textContent = '1000 Hz';

  const slider = document.createElement('input');
  slider.className = 'ch1-slider';
  slider.type = 'range';
  slider.min = '100';
  slider.max = '1000';
  slider.value = '440';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Frequency');

  sliderRow.append(lowLabel, slider, highLabel);

  const playBtn = document.createElement('button');
  playBtn.className = 'ch1-play-btn';
  playBtn.textContent = '▶ Play tone';

  widget.append(freqDisplay, canvas, sliderRow, playBtn);
  host.appendChild(widget);

  let isPlaying = false;
  let animId = null;
  let currentFreq = 440;

  const ctx = canvas.getContext('2d');
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary').trim() || '#6c5ce7';

  let logW = 500;
  let logH = 120;

  function drawWave() {
    ctx.clearRect(0, 0, logW, logH);
    const cycles = 2 + (currentFreq - 100) / 900 * 8;
    const amplitude = logH * 0.38;
    const midY = logH / 2;
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    for (let x = 0; x <= logW; x++) {
      const t = x / logW;
      const y = midY + Math.sin(t * cycles * Math.PI * 2 + performance.now() * 0.003) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (isPlaying) animId = requestAnimationFrame(drawWave);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, logW, logH);
    const cycles = 2 + (currentFreq - 100) / 900 * 8;
    const amplitude = logH * 0.38;
    const midY = logH / 2;
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.4;
    for (let x = 0; x <= logW; x++) {
      const t = x / logW;
      const y = midY + Math.sin(t * cycles * Math.PI * 2) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  function startOsc() {
    ensureTone().then(() => {
      if (!_oscillator) {
        _oscillatorGain = new Tone.Gain(0.25).toDestination();
        _oscillator = new Tone.Oscillator({
          frequency: currentFreq,
          type: 'sine',
        }).connect(_oscillatorGain);
      }
      _oscillator.frequency.value = currentFreq;
      _oscillator.start();
      isPlaying = true;
      playBtn.textContent = '■ Stop';
      playBtn.classList.add('ch1-play-btn--active');
      drawWave();
    });
  }

  function stopOsc() {
    if (_oscillator) {
      try { _oscillator.stop(); } catch (_) {}
    }
    isPlaying = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    playBtn.textContent = '▶ Play tone';
    playBtn.classList.remove('ch1-play-btn--active');
    drawStatic();
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) stopOsc();
    else startOsc();
  });

  slider.addEventListener('input', () => {
    currentFreq = parseInt(slider.value, 10);
    freqDisplay.textContent = `${currentFreq} Hz`;
    if (_oscillator && isPlaying) {
      _oscillator.frequency.value = currentFreq;
    }
    if (!isPlaying) drawStatic();
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    logW = rect.width;
    logH = rect.height;
    if (!isPlaying) drawStatic();
  }

  requestAnimationFrame(() => {
    resizeCanvas();
    drawStatic();
  });

  const resizeObs = new ResizeObserver(() => resizeCanvas());
  resizeObs.observe(canvas);
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: A440 WIDGET BUILDER
// ════════════════════════════════════════════════════════════════════

/** Build the A440 oboe-demo widget. Returns a div; caller mounts and shows/hides it. */
function _buildA440Widget() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; padding-top:4px;';

  const explain = document.createElement('div');
  explain.className = 'ch1-a440-explain';
  explain.innerHTML = '&nbsp;';

  const notes = [
    { note: 'A3', freq: 220, label: 'A3' },
    { note: 'A4', freq: 440, label: 'A4' },
    { note: 'A5', freq: 880, label: 'A5' },
  ];

  const btnRow = document.createElement('div');
  btnRow.className = 'ch1-a440-row';

  let activeBtn = null;
  let activeTimeout = null;

  notes.forEach(({ note, freq, label }) => {
    const btn = document.createElement('button');
    btn.className = 'ch1-a440-btn';

    const nameEl = document.createElement('span');
    nameEl.className = 'ch1-a440-note';
    nameEl.textContent = label;

    const freqEl = document.createElement('span');
    freqEl.className = 'ch1-a440-freq';
    freqEl.textContent = `${freq} Hz`;

    btn.append(nameEl, freqEl);

    btn.addEventListener('click', async () => {
      await ensureTone();
      ensureSampler();

      if (activeBtn) activeBtn.classList.remove('ch1-a440-btn--playing');
      if (activeTimeout) clearTimeout(activeTimeout);
      btn.classList.add('ch1-a440-btn--playing');
      activeBtn = btn;
      activeTimeout = setTimeout(() => {
        btn.classList.remove('ch1-a440-btn--playing');
        activeBtn = null;
      }, 1800);

      if (_oboeSamplerReady && _oboeSampler) {
        _oboeSampler.triggerAttackRelease(note, '2n', Tone.now());
      } else {
        playSamplerNote(note, '2n');
      }

      if (note === 'A3') {
        explain.textContent = 'A3 = 220 Hz — half the frequency of A4';
      } else if (note === 'A4') {
        explain.textContent = 'A4 = 440 Hz — the universal tuning reference';
      } else {
        explain.textContent = 'A5 = 880 Hz — double the frequency of A4';
      }
    });

    btnRow.appendChild(btn);
  });

  const doublingLine = document.createElement('div');
  doublingLine.className = 'intro-widget__label';
  doublingLine.textContent = 'Each octave doubles the frequency: 220 → 440 → 880';
  doublingLine.style.marginTop = '8px';

  wrap.append(btnRow, explain, doublingLine);
  return wrap;
}

// ════════════════════════════════════════════════════════════════════
// SECTION 4: FIND WIDGET BUILDER
// ════════════════════════════════════════════════════════════════════

/** Build the "Find every ___" buttons widget. Returns a div; caller mounts and shows/hides it. */
function _buildFindWidget() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; padding-top:4px;';

  const findRow = document.createElement('div');
  findRow.className = 'ch1-find-row';

  const findNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let activeFind = null;

  findNotes.forEach(noteName => {
    const btn = document.createElement('button');
    btn.className = 'ch1-find-btn';
    btn.textContent = noteName;

    btn.addEventListener('click', async () => {
      await ensureTone();
      ensureSampler();
      if (!_sharedKb) return;

      if (activeFind === noteName) {
        _clearHighlights(_sharedKb);
        activeFind = null;
        btn.classList.remove('ch1-find-btn--active');
        if (_sharedKbInfo) _sharedKbInfo.innerHTML = '&nbsp;';
        return;
      }

      findRow.querySelectorAll('.ch1-find-btn--active').forEach(b => b.classList.remove('ch1-find-btn--active'));
      _clearHighlights(_sharedKb);

      activeFind = noteName;
      btn.classList.add('ch1-find-btn--active');

      const matchingKeys = [];
      _sharedKb.keys.forEach((el, noteId) => {
        if (el.dataset.noteName === noteName) {
          el.classList.add('intro-kb-key--pattern-hl');
          el.classList.add('intro-kb-key--show-label');
          matchingKeys.push(noteId);
        }
      });

      matchingKeys.forEach((noteId, i) => {
        setTimeout(() => playSamplerNote(noteId, '8n'), i * 250);
      });

      if (_sharedKbInfo) _sharedKbInfo.textContent = `Every ${noteName} across 3 octaves`;
    });

    findRow.appendChild(btn);
  });

  const hint = document.createElement('div');
  hint.className = 'intro-widget__label';
  hint.textContent = 'Click a key to hear it, or use the buttons to find every instance of a note';

  wrap.append(findRow, hint);
  return wrap;
}

// ════════════════════════════════════════════════════════════════════
// CLEANUP (ch1-only resources: oscillator + oboe sampler)
// ════════════════════════════════════════════════════════════════════

registerCleanup(function _cleanup() {
  if (_oscillator) {
    try { _oscillator.stop(); _oscillator.dispose(); } catch (_) {}
    _oscillator = null;
  }
  if (_oscillatorGain) {
    try { _oscillatorGain.dispose(); } catch (_) {}
    _oscillatorGain = null;
  }
  if (_oboeSampler) {
    try { _oboeSampler.releaseAll(); _oboeSampler.dispose(); } catch (_) {}
    _oboeSampler = null;
    _oboeSamplerReady = false;
    _oboeSamplerLoading = false;
  }
});

// ════════════════════════════════════════════════════════════════════
// SECTION DEFINITIONS (exported for intro-core.js)
// ════════════════════════════════════════════════════════════════════

export const chapterMeta = {
  number: 1,
  title: 'Sound & Notes',
  tone: 'playful',
  description: 'What is sound? Meet the 12 notes and the spaces between them.',
};

export const sections = [
  {
    id: 'ch1-what-is-sound',
    title: 'What is Sound?',
    narration:
      'Tap your desk. Hum. Clap your hands. ' +
      'That\'s sound — something vibrating, pushing air into your ears. ' +
      'The faster it vibrates, the higher it sounds. ' +
      'That speed has a name: frequency. ' +
      'And frequency is what gives every sound its pitch.',
    interactive: 'oscillator',
    tryIt: 'Drag the slider. Hear how the pitch rises?',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-what-is-sound')) return;
      _mounted.add('ch1-what-is-sound');
      _mountOscillator(sectionEl);
    },
  },
  {
    id: 'ch1-meet-the-notes',
    title: 'Meet the Notes',
    narration:
      'You could slide through every possible pitch forever. But musicians carved out ' +
      '12 specific pitches that sound good together. They repeat over and over, higher and higher. ' +
      'Each repetition is called an octave — the same note, just higher.',
    interactive: 'keyboard-12',
    tryIt: 'Click any key. These 12 notes are all of music.',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-meet-the-notes')) return;
      _mounted.add('ch1-meet-the-notes');
      _injectCSS();
      ensureSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s2Widget = document.createElement('div');
      _s2Widget.className = 'intro-widget';
      host.appendChild(_s2Widget);
    },
    onEnter(_sectionEl) {
      if (!_s2Widget) return;
      if (_sharedKbHostEl === _s2Widget) return;
      _rebuildKeyboard(_s2Widget, 4, 1, {
        showLabels: true,
        onNoteDown(name, oct) {
          if (_sharedKbInfo) {
            const freq = noteFreq(name, oct).toFixed(1);
            _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
          }
        },
      });
      if (_a440Widget) _a440Widget.style.display = 'none';
      if (_findWidget) _findWidget.style.display = 'none';
    },
  },
  {
    id: 'ch1-concert-pitch',
    title: 'A = 440',
    narration:
      'Of all the notes, one has a special job. A4 — the A above middle C — vibrates at exactly ' +
      '440 times per second. This is the universal tuning reference. Every instrument in every ' +
      'orchestra in the world tunes to this note. When you hear an orchestra warming up, that\'s the ' +
      'oboe playing A440 and everyone matching it.',
    interactive: 'a440-demo',
    tryIt: 'This is the note the whole world agrees on.',
    onActivate(sectionEl) {
      if (_mounted.has('ch1-concert-pitch')) return;
      _mounted.add('ch1-concert-pitch');
      _loadOboeSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s3Widget = document.createElement('div');
      _s3Widget.className = 'intro-widget';
      host.appendChild(_s3Widget);
      _a440Widget = _buildA440Widget();
      _a440Widget.style.display = 'none';
      _s3Widget.appendChild(_a440Widget);
    },
    onEnter(_sectionEl) {
      if (!_s3Widget) return;
      if (_sharedKbHostEl !== _s3Widget) {
        _rebuildKeyboard(_s3Widget, 3, 2, {
          showLabels: true,
          onNoteDown(name, oct) {
            if (_sharedKbInfo) {
              const freq = noteFreq(name, oct).toFixed(1);
              _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
            }
          },
        });
      }
      const a4Key = _sharedKb?.keys.get('A4');
      if (a4Key) a4Key.classList.add('intro-kb-key--a4-pulse');
      if (_a440Widget) _a440Widget.style.display = '';
      if (_findWidget) _findWidget.style.display = 'none';
    },
    onLeave(_sectionEl) {
      if (_sharedKb) {
        const a4Key = _sharedKb.keys.get('A4');
        if (a4Key) a4Key.classList.remove('intro-kb-key--a4-pulse');
      }
      if (_a440Widget) _a440Widget.style.display = 'none';
    },
  },
  {
    id: 'ch1-keyboard-pattern',
    title: 'The Keyboard Pattern',
    narration:
      'Look at the keyboard. See the pattern? Two black keys, then three black keys, ' +
      'repeating forever. That pattern is how you find any note instantly. ' +
      'C is always just left of the two black keys. F is always just left of the three. ' +
      'Once you see it, you can never unsee it.',
    interactive: 'keyboard-pattern',
    tryIt: 'Can you find all the C notes? How about F?',
    gameLink: {
      game: 'harmony-trainer',
      label: 'Ready to train your ear?',
      url: '/harmony',
    },
    onActivate(sectionEl) {
      if (_mounted.has('ch1-keyboard-pattern')) return;
      _mounted.add('ch1-keyboard-pattern');
      _injectCSS();
      ensureSampler();
      const host = sectionEl.querySelector('.intro-interactive');
      if (!host) return;
      _s4Widget = document.createElement('div');
      _s4Widget.className = 'intro-widget';
      host.appendChild(_s4Widget);
      _findWidget = _buildFindWidget();
      _findWidget.style.display = 'none';
      _s4Widget.appendChild(_findWidget);
    },
    onEnter(_sectionEl) {
      if (!_s4Widget) return;
      if (_sharedKbHostEl !== _s4Widget) {
        _rebuildKeyboard(_s4Widget, 3, 3, {
          showLabels: false,
          containerStyle: 'position:relative; overflow-x:visible; --intro-kb-ww:28px; --intro-kb-bw:18px; --intro-kb-h:110px;',
          onNoteDown(name, oct, el) {
            el.classList.add('intro-kb-key--show-label');
            if (_sharedKbInfo) {
              const freq = noteFreq(name, oct).toFixed(1);
              _sharedKbInfo.textContent = `${name}${oct} = ${freq} Hz`;
            }
          },
          onNoteUp(_name, _oct, el) {
            setTimeout(() => {
              if (!el.classList.contains('intro-kb-key--pressed')) {
                el.classList.remove('intro-kb-key--show-label');
              }
            }, 1200);
          },
        });
        _addGroupBrackets(_sharedKb);
      }
      if (_a440Widget) _a440Widget.style.display = 'none';
      if (_findWidget) _findWidget.style.display = '';
    },
    onLeave(_sectionEl) {
      if (_sharedKb) _clearHighlights(_sharedKb);
      if (_findWidget) {
        _findWidget.querySelectorAll('.ch1-find-btn--active').forEach(b => b.classList.remove('ch1-find-btn--active'));
        _findWidget.style.display = 'none';
      }
    },
  },
];
