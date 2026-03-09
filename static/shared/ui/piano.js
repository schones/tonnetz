// piano.js — Clickable piano keyboard component for Skratch Studio
// Range: G3–G5 (two full octaves), with computer keyboard mapping
//
// Label modes: 'none' (keyboard shortcuts), 'note' (C D E…), 'solfege' (Do Re Mi…)
// Mark mode: clicking a key toggles a red dot marker (note still plays)

const KEYS = [
  { note: 'G3', white: true },
  { note: 'G#3', white: false },
  { note: 'A3', white: true },
  { note: 'A#3', white: false },
  { note: 'B3', white: true },
  { note: 'C4', white: true },
  { note: 'C#4', white: false },
  { note: 'D4', white: true },
  { note: 'D#4', white: false },
  { note: 'E4', white: true },
  { note: 'F4', white: true },
  { note: 'F#4', white: false },
  { note: 'G4', white: true },
  { note: 'G#4', white: false },
  { note: 'A4', white: true },
  { note: 'A#4', white: false },
  { note: 'B4', white: true },
  { note: 'C5', white: true },
  { note: 'C#5', white: false },
  { note: 'D5', white: true },
  { note: 'D#5', white: false },
  { note: 'E5', white: true },
  { note: 'F5', white: true },
  { note: 'F#5', white: false },
  { note: 'G5', white: true },
];

// Computer keyboard → note mapping
const KEY_MAP = {
  'a': 'G3', 's': 'A3', 'd': 'B3', 'f': 'C4',
  'g': 'D4', 'h': 'E4', 'j': 'F4', 'k': 'G4', 'l': 'A4',
  'z': 'G#3', 'x': 'A#3', 'c': 'C#4', 'v': 'D#4',
  'b': 'F#4', 'n': 'G#4', 'm': 'A#4',
  'q': 'B4', 'w': 'C5', 'e': 'D5', 'r': 'E5',
  't': 'F5', 'y': 'G5',
  '2': 'C#5', '3': 'D#5', '5': 'F#5',
};

const NOTE_TO_KEY = {};
for (const [key, note] of Object.entries(KEY_MAP)) {
  NOTE_TO_KEY[note] = key.toUpperCase();
}

// Solfege syllables for note letters (movable-do, C-major basis)
const NOTE_TO_SOLFEGE = {
  'C': 'Do', 'C#': 'Di', 'Db': 'Ra',
  'D': 'Re', 'D#': 'Ri', 'Eb': 'Me',
  'E': 'Mi',
  'F': 'Fa', 'F#': 'Fi',
  'G': 'Sol', 'G#': 'Si', 'Ab': 'Le',
  'A': 'La', 'A#': 'Li', 'Bb': 'Te',
  'B': 'Ti',
};

export class Piano {
  constructor(container, { onNoteOn, onNoteOff, onSustainChange, onMarkChange, keyWidth = 22 }) {
    this.container = container;
    this.onNoteOn = onNoteOn || (() => { });
    this.onNoteOff = onNoteOff || (() => { });
    this.onSustainChange = onSustainChange || (() => { });
    this.onMarkChange = onMarkChange || (() => { });
    this._keyWidth = keyWidth;
    this._keyEls = {};
    this._highlightedKey = null;
    this._pressedComputerKeys = new Set();
    this._mouseNote = null;
    this._isSustained = false;

    // Annotation state
    this._labelMode = 'none';  // 'none' | 'note' | 'solfege'
    this._markMode = false;
    this._markedNotes = new Set();

    this._injectStyles();
    this._build();
    this._bindKeyboard();
  }

  _injectStyles() {
    if (document.getElementById('skratch-piano-styles')) return;
    const style = document.createElement('style');
    style.id = 'skratch-piano-styles';
    style.textContent = `
      .sk-piano {
        display: flex;
        position: relative;
        height: var(--sk-kh, 72px);
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .sk-piano__key {
        position: relative;
        border: 1px solid #2a2a3e;
        border-radius: 0 0 3px 3px;
        cursor: pointer;
        transition: background 0.08s, box-shadow 0.08s;
        box-sizing: border-box;
      }
      .sk-piano__key--white {
        background: #d8d8e0;
        width: var(--sk-kw, 22px);
        height: var(--sk-kh, 72px);
        z-index: 1;
      }
      .sk-piano__key--white:hover {
        background: #e8e8f0;
      }
      .sk-piano__key--white.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 10px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--white.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 8px var(--color-secondary, #00cec9);
      }
      .sk-piano__key--black {
        background: #111118;
        width: var(--sk-bkw, 14px);
        height: var(--sk-bkh, 44px);
        margin-left: var(--sk-bkm, -7px);
        margin-right: var(--sk-bkm, -7px);
        z-index: 2;
        border: 1px solid #000;
      }
      .sk-piano__key--black:hover {
        background: #2a2a3e;
      }
      .sk-piano__key--black.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 10px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--black.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 8px var(--color-secondary, #00cec9);
      }
      /* Bottom label: keyboard shortcut or note annotation */
      .sk-piano__label {
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: var(--sk-lsz, 7px);
        color: #888;
        pointer-events: none;
        line-height: 1;
        white-space: nowrap;
      }
      .sk-piano__key--black .sk-piano__label {
        color: #777;
        font-size: var(--sk-lsz, 7px);
        bottom: 2px;
      }
      .sk-piano__key.active .sk-piano__label,
      .sk-piano__key.detected .sk-piano__label {
        color: #fff;
      }
      /* Octave reference mark on C keys */
      .sk-piano__octave-mark {
        position: absolute;
        top: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: var(--sk-osz, 6px);
        color: #999;
        pointer-events: none;
        white-space: nowrap;
      }
      .sk-piano__key.active .sk-piano__octave-mark {
        color: rgba(255,255,255,0.7);
      }
      /* Red dot marker (mark mode) */
      .sk-piano__mark-dot {
        display: none;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: #ff4757;
        pointer-events: none;
        box-shadow: 0 0 3px rgba(255,71,87,0.6);
      }
      .sk-piano__key--white .sk-piano__mark-dot {
        width: var(--sk-mdw, 10px);
        height: var(--sk-mdw, 10px);
        top: var(--sk-mdt, 32px);
      }
      .sk-piano__key--black .sk-piano__mark-dot {
        width: var(--sk-bmdw, 8px);
        height: var(--sk-bmdw, 8px);
        top: var(--sk-bmdt, 14px);
      }
      .sk-piano__key.marked .sk-piano__mark-dot {
        display: block;
      }
      /* Crosshair cursor while mark mode is active */
      .sk-piano.mark-mode .sk-piano__key {
        cursor: cell;
      }
    `;
    document.head.appendChild(style);
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'sk-piano';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Piano keyboard — G3 to G5');

    // Apply scale-dependent CSS custom properties when not using the default size
    if (this._keyWidth !== 22) {
      const s = this._keyWidth / 22;
      const px = n => `${Math.round(n * s)}px`;
      this.el.style.setProperty('--sk-kw',   px(22));
      this.el.style.setProperty('--sk-kh',   px(72));
      this.el.style.setProperty('--sk-bkw',  px(14));
      this.el.style.setProperty('--sk-bkh',  px(44));
      this.el.style.setProperty('--sk-bkm',  `-${px(7)}`);
      this.el.style.setProperty('--sk-lsz',  `${Math.max(8, Math.round(7 * s))}px`);
      this.el.style.setProperty('--sk-osz',  `${Math.max(7, Math.round(6 * s))}px`);
      this.el.style.setProperty('--sk-mdw',  px(10));
      this.el.style.setProperty('--sk-mdt',  px(32));
      this.el.style.setProperty('--sk-bmdw', px(8));
      this.el.style.setProperty('--sk-bmdt', px(14));
    }

    for (const key of KEYS) {
      const el = document.createElement('div');
      el.className = `sk-piano__key sk-piano__key--${key.white ? 'white' : 'black'}`;
      el.dataset.note = key.note;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', key.note);

      const noteLetter = key.note.replace(/\d+$/, '');   // e.g. 'C#4' → 'C#'
      const shortcut   = NOTE_TO_KEY[key.note] || '';
      const solfege    = NOTE_TO_SOLFEGE[noteLetter] || '';

      // Bottom label — content swaps based on labelMode
      const label = document.createElement('span');
      label.className = 'sk-piano__label';
      label.dataset.shortcut  = shortcut;
      label.dataset.noteLetter = noteLetter;
      label.dataset.solfege   = solfege;
      label.dataset.isWhite   = key.white ? '1' : '';
      label.textContent = shortcut;  // default: keyboard shortcut
      el.appendChild(label);

      // Octave reference mark on all C keys
      if (key.note.startsWith('C') && !key.note.includes('#') && !key.note.includes('b')) {
        const mark = document.createElement('span');
        mark.className = 'sk-piano__octave-mark';
        mark.textContent = key.note;  // e.g. 'C4', 'C5'
        el.appendChild(mark);
      }

      // Red dot marker element
      const dotEl = document.createElement('span');
      dotEl.className = 'sk-piano__mark-dot';
      dotEl.setAttribute('aria-hidden', 'true');
      el.appendChild(dotEl);

      // Mouse events
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._mouseDown(key.note, el);
      });
      el.addEventListener('mouseup', () => this._mouseUp(key.note, el));
      el.addEventListener('mouseleave', () => this._mouseUp(key.note, el));

      // Touch events
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._mouseDown(key.note, el);
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._mouseUp(key.note, el);
      });

      this._keyEls[key.note] = el;
      this.el.appendChild(el);
    }

    this.container.appendChild(this.el);
  }

  _mouseDown(note, el) {
    this._mouseNote = note;
    el.classList.add('active');
    this.onNoteOn(note);

    // Toggle mark if mark mode is active
    if (this._markMode) {
      const adding = !this._markedNotes.has(note);
      if (adding) {
        this._markedNotes.add(note);
        el.classList.add('marked');
      } else {
        this._markedNotes.delete(note);
        el.classList.remove('marked');
      }
      this.onMarkChange(note, adding);
    }
  }

  _mouseUp(note, el) {
    if (this._mouseNote === note) {
      this._mouseNote = null;
      el.classList.remove('active');
      this.onNoteOff(note);
    }
  }

  _bindKeyboard() {
    this._onKeyDown = (e) => {
      if (document.querySelector('dialog[open]')) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' ||
        e.target.isContentEditable || e.target.closest('#blocklyDiv')) {
        return;
      }

      const isShift = e.getModifierState('Shift');
      const isCaps = e.getModifierState('CapsLock');
      const shouldSustain = isShift || isCaps;

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'CapsLock') {
        e.preventDefault();
      }

      if (this._isSustained !== shouldSustain) {
        this._isSustained = shouldSustain;
        this.onSustainChange(this._isSustained);
      }

      if (e.code === 'CapsLock' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        return;
      }

      if (e.repeat) return;

      const key = e.key.toLowerCase();
      const note = KEY_MAP[key];
      if (!note) return;

      e.preventDefault();
      this._pressedComputerKeys.add(key);

      const el = this._keyEls[note];
      if (el) el.classList.add('active');
      this.onNoteOn(note);
    };

    this._onKeyUp = (e) => {
      if (document.querySelector('dialog[open]')) return;
      const _tag = e.target.tagName;
      if (_tag === 'INPUT' || _tag === 'TEXTAREA' || _tag === 'SELECT' || _tag === 'BUTTON' ||
        e.target.isContentEditable || e.target.closest('#blocklyDiv')) {
        return;
      }

      const isShift = e.getModifierState('Shift');
      const isCaps = e.getModifierState('CapsLock');
      const shouldSustain = isShift || isCaps;

      if (this._isSustained !== shouldSustain) {
        this._isSustained = shouldSustain;
        this.onSustainChange(this._isSustained);
      }

      if (e.code === 'CapsLock' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        return;
      }

      const key = e.key.toLowerCase();
      const note = KEY_MAP[key];
      if (!note) return;

      this._pressedComputerKeys.delete(key);

      const el = this._keyEls[note];
      if (el) el.classList.remove('active');
      this.onNoteOff(note);
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  // ── Public annotation API ─────────────────────────────────────────────────

  /** Set the bottom label mode: 'none' (keyboard shortcuts), 'note', 'solfege' */
  setLabelMode(mode) {
    this._labelMode = mode;
    for (const key of KEYS) {
      const el    = this._keyEls[key.note];
      const label = el && el.querySelector('.sk-piano__label');
      if (!label) continue;
      const isWhite = label.dataset.isWhite === '1';

      switch (mode) {
        case 'none':
          label.textContent = label.dataset.shortcut;
          break;
        case 'note':
          // White keys: note letter only (C, D, E…); black keys: accidental (C#, D#…)
          label.textContent = label.dataset.noteLetter;
          break;
        case 'solfege':
          // White keys: solfege syllable; black keys: no label
          label.textContent = isWhite ? label.dataset.solfege : '';
          break;
      }
    }
  }

  /** Enable or disable mark mode. When enabled, clicking keys toggles a red dot marker. */
  setMarkMode(active) {
    this._markMode = active;
    if (this.el) this.el.classList.toggle('mark-mode', active);
  }

  /** Directly apply or remove a mark (for sync from another window — does not fire onMarkChange). */
  applyMark(note, add) {
    const el = this._keyEls[note];
    if (!el) return;
    if (add) {
      this._markedNotes.add(note);
      el.classList.add('marked');
    } else {
      this._markedNotes.delete(note);
      el.classList.remove('marked');
    }
  }

  /** Remove all red dot markers from all keys. */
  clearMarks() {
    for (const note of this._markedNotes) {
      const el = this._keyEls[note];
      if (el) el.classList.remove('marked');
    }
    this._markedNotes.clear();
  }

  // ── Mic pitch highlight ───────────────────────────────────────────────────

  highlightNote(noteName) {
    if (this._highlightedKey) {
      this._highlightedKey.classList.remove('detected');
      this._highlightedKey = null;
    }
    if (!noteName || noteName === '--') return;

    let el = this._keyEls[noteName];
    if (!el) {
      const baseNote = noteName.replace(/\d+$/, '');
      el = this._keyEls[baseNote + '4'] || this._keyEls[baseNote + '3'] || this._keyEls[baseNote + '5'];
    }
    if (el) {
      el.classList.add('detected');
      this._highlightedKey = el;
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this._keyEls = {};
    this._pressedComputerKeys.clear();
    this._markedNotes.clear();
  }
}
