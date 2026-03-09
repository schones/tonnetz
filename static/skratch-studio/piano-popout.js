// piano-popout.js — Pop-out keyboard window for Skratch Studio
//
// This window has NO AudioBridge. All note-on/note-off/sustain events are
// forwarded to the main studio window via BroadcastChannel, where the
// AudioBridge and LoopPedal handle them.
//
// BroadcastChannel name: 'skratch-piano-sync'
//
// Messages sent TO main:
//   { type: 'popout-ready' }
//   { type: 'note-on',       note, instrument }
//   { type: 'note-off',      note }
//   { type: 'sustain-change', on: bool }
//   { type: 'instrument',    value }
//   { type: 'bpm',           value }
//   { type: 'volume',        value }
//   { type: 'label-mode',    value }
//   { type: 'mark-toggle',   note, add: bool }
//   { type: 'clear-marks' }
//
// Messages received FROM main:
//   { type: 'state-dump', instrument, bpm, volume, labelMode, markedNotes, markModeActive }
//   { type: 'instrument', value }
//   { type: 'bpm',        value }
//   { type: 'volume',     value }
//   { type: 'label-mode', value }
//   { type: 'mark-toggle', note, add: bool }
//   { type: 'clear-marks' }

import { Piano } from '../shared/ui/piano.js';

const CHANNEL_NAME = 'skratch-piano-sync';

const channel = new BroadcastChannel(CHANNEL_NAME);

// ── UI refs ───────────────────────────────────────────────────────────────────
const soundSelect      = document.getElementById('soundSelect');
const bpmSlider        = document.getElementById('bpmSlider');
const bpmValueEl       = document.getElementById('bpmValue');
const volumeSlider     = document.getElementById('volumeSlider');
const volumeValueEl    = document.getElementById('volumeValue');
const sustainIndicator = document.getElementById('sustainIndicator');
const labelSelect      = document.getElementById('labelSelect');
const btnMarkMode      = document.getElementById('btnMarkMode');
const btnClearMarks    = document.getElementById('btnClearMarks');
const statusMsg        = document.getElementById('statusMsg');

// ── Piano — large keys (keyWidth=44 ≈ 2× the default 22px) ──────────────────
const pianoContainer = document.getElementById('pianoContainer');

const piano = new Piano(pianoContainer, {
  keyWidth: 44,
  onNoteOn:  (note) => {
    channel.postMessage({ type: 'note-on', note, instrument: soundSelect.value });
  },
  onNoteOff: (note) => {
    channel.postMessage({ type: 'note-off', note });
  },
  onSustainChange: (on) => {
    channel.postMessage({ type: 'sustain-change', on });
    sustainIndicator.textContent = on ? 'Sustain: ON' : 'Sustain: OFF';
    sustainIndicator.classList.toggle('active', on);
  },
  onMarkChange: (note, add) => {
    if (_applyingSync) return;
    channel.postMessage({ type: 'mark-toggle', note, add });
  },
});

// ── Sync guard ────────────────────────────────────────────────────────────────
// Prevents echoing changes received from the main window back to it.
let _applyingSync = false;

// ── Control event listeners ───────────────────────────────────────────────────

soundSelect.addEventListener('change', () => {
  if (_applyingSync) return;
  channel.postMessage({ type: 'instrument', value: soundSelect.value });
});

bpmSlider.addEventListener('input', () => {
  const val = parseInt(bpmSlider.value, 10);
  bpmValueEl.textContent = val;
  if (_applyingSync) return;
  channel.postMessage({ type: 'bpm', value: val });
});

volumeSlider.addEventListener('input', () => {
  const val = parseInt(volumeSlider.value, 10);
  volumeValueEl.textContent = val + '%';
  if (_applyingSync) return;
  channel.postMessage({ type: 'volume', value: val });
});

labelSelect.addEventListener('change', () => {
  piano.setLabelMode(labelSelect.value);
  if (_applyingSync) return;
  channel.postMessage({ type: 'label-mode', value: labelSelect.value });
});

btnMarkMode.addEventListener('click', () => {
  const active = btnMarkMode.classList.toggle('active');
  piano.setMarkMode(active);
});

btnClearMarks.addEventListener('click', () => {
  piano.clearMarks();
  channel.postMessage({ type: 'clear-marks' });
});

// ── Incoming messages from main window ───────────────────────────────────────

channel.onmessage = (e) => {
  const msg = e.data;
  _applyingSync = true;
  try {
    switch (msg.type) {
      case 'state-dump':
        // Apply full state on connect
        if (msg.instrument && soundSelect.value !== msg.instrument) {
          soundSelect.value = msg.instrument;
        }
        if (msg.bpm != null) {
          bpmSlider.value = msg.bpm;
          bpmValueEl.textContent = msg.bpm;
        }
        if (msg.volume != null) {
          volumeSlider.value = msg.volume;
          volumeValueEl.textContent = msg.volume + '%';
        }
        if (msg.labelMode) {
          labelSelect.value = msg.labelMode;
          piano.setLabelMode(msg.labelMode);
        }
        if (msg.markedNotes && Array.isArray(msg.markedNotes)) {
          piano.clearMarks();
          for (const note of msg.markedNotes) {
            piano.applyMark(note, true);
          }
        }
        if (msg.markModeActive) {
          btnMarkMode.classList.add('active');
          piano.setMarkMode(true);
        }
        statusMsg.textContent = 'Connected to Skratch Studio.';
        break;

      case 'instrument':
        if (soundSelect.value !== msg.value) soundSelect.value = msg.value;
        break;

      case 'bpm':
        bpmSlider.value = msg.value;
        bpmValueEl.textContent = msg.value;
        break;

      case 'volume':
        volumeSlider.value = msg.value;
        volumeValueEl.textContent = msg.value + '%';
        break;

      case 'label-mode':
        labelSelect.value = msg.value;
        piano.setLabelMode(msg.value);
        break;

      case 'mark-toggle':
        piano.applyMark(msg.note, msg.add);
        break;

      case 'clear-marks':
        piano.clearMarks();
        break;
    }
  } finally {
    _applyingSync = false;
  }
};

// ── Announce readiness to main window ────────────────────────────────────────
// Small delay so the main window's channel listener is attached before this fires.
setTimeout(() => {
  channel.postMessage({ type: 'popout-ready' });
}, 100);

// ── Cleanup ───────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  piano.destroy();
  channel.close();
});
