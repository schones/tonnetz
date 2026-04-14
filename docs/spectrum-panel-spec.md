# Harmonic Resonance — Implementation Spec
**SongLab · April 2026**

---

## Overview

A ChromaVerb-inspired FFT visualizer that shows real spectral content of chords/notes as glowing particles on a log-frequency axis. Particles are colored by harmonic function (root/third/fifth/seventh using SongLab design tokens). An orange envelope curve traces the live spectrum, with peak-hold for decay visualization.

**Goal for tomorrow:** working prototype with Salamander piano + guitar samples, MIDI input from Launchkey 49, integrated as an Explorer panel candidate.

---

## 1. Sample Loading Strategy

### The Problem
Salamander full set is ~80MB (26 velocity-layered stereo WAVs). Loading all samples before first playback creates a 10-30s dead zone.

### Option A: Progressive Loading (Recommended)
Load a **skeleton set** (6 samples) for instant playback, then backfill the full set in the background.

```
Phase 1 (instant, ~3MB):
  C2.mp3, C3.mp3, C4.mp3, C5.mp3, A3.mp3, A4.mp3

Phase 2 (background, ~15MB):
  Fill remaining chromatic samples: D#2, F#2, A2, D#3, F#3, D#4, F#4, A5, etc.

Phase 3 (optional, deferred):
  Full velocity layers if we ever want velocity-sensitive response
```

Tone.js `Sampler` interpolates between available samples, so 6 samples gives usable coverage with some timbral smearing. As Phase 2 loads, quality silently improves.

**Implementation:**
```javascript
const sampler = new Tone.Sampler({
  urls: SKELETON_SET,
  baseUrl: "https://tonejs.github.io/audio/salamander/",
  onload: () => {
    setReady(true);
    // Kick off Phase 2 in background
    loadRemainingSamples(sampler);
  }
});
```

### Option B: Synth-First Hybrid
Start with an FM synth (instant), swap to Salamander when loaded. User sees a voice toggle that starts as "Synth" and gains "Piano" once samples arrive.

**Pro:** Zero wait. **Con:** Audible voice switch mid-session; two audio paths to manage.

### Option C: Self-Hosted Subset
Host a curated 8-sample set on Railway (or a CDN). Smaller files, controlled latency.

**Pro:** Fastest realistic piano. **Con:** Hosting cost, another deploy surface.

**Recommendation:** Option A for piano, Option B as fallback for slow connections (detect with `navigator.connection` if available).

---

## 2. Instrument Voices

### Piano — Salamander Grand
- Source: `https://tonejs.github.io/audio/salamander/`
- Format: mp3
- Skeleton: C2, C3, A3, C4, A4, C5 (covers the chord voicing range C3-C6)
- Rich overtone content — FFT visualization will be dense and complex
- Natural decay makes the particle fade-out physically meaningful

### Guitar — Options

**Option 1: Tone.js acoustic guitar samples**
- Source: `https://tonejs.github.io/audio/casio/` (not guitar, but similar bright attack)
- Limited, not ideal

**Option 2: Free SFZ/WAV guitar sets (self-hosted)**
Several CC0/CC-BY acoustic guitar sample sets exist:
- **Karoryfer Bigcat** — free Strat and acoustic guitar SFZ sets
- **VSCO2 Community Edition** — orchestral + guitar, CC0
- **UI Steel Guitar** — University of Iowa, public domain

For tomorrow, the pragmatic path:
```
Use Tone.js FMSynth with guitar-like parameters as placeholder:
  - High modulationIndex (2.5) for pluck attack
  - Fast envelope decay (0.8s)
  - Harmonicity: 2 (octave partial emphasis)

Then swap in real samples once we pick a set.
```

**Option 3: FM synthesis guitar (no samples needed)**
```javascript
const guitar = new Tone.PolySynth(Tone.FMSynth, {
  options: {
    harmonicity: 2,
    modulationIndex: 2.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.8, sustain: 0.05, release: 1.5 },
    modulation: { type: "triangle" },
    modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.5 },
  }
});
```
This actually looks interesting in the FFT — the FM sidebands create a more complex spectral fingerprint than additive synth, and you can see the inharmonicity.

### Voice Architecture
```
voices = {
  piano:  { loader: SalamanderProgressive, fallback: FMPiano },
  guitar: { loader: null (Phase 2), fallback: FMGuitar },
  organ:  { loader: null, synth: AdditiveSynth },
  pad:    { loader: null, synth: TrianglePad },
}

Each voice exposes:
  .triggerAttackRelease(notes, duration)
  .connect(analyserNode)
  .isLoaded  // for sample-based voices
  .dispose()
```

---

## 3. MIDI Input Module

### Architecture
The MIDI module should be a standalone ES module that any SongLab component can subscribe to — not just Harmonic Resonance.

```
/static/js/
  midi-input.js        ← new module
  harmonic-resonance.js
  harmony-state.js     ← existing pub/sub
```

### midi-input.js API
```javascript
// Singleton — discovers and manages Web MIDI devices
const MIDIInput = {
  async init(),              // Request MIDI access, enumerate devices
  getDevices(),              // Returns available input devices
  selectDevice(deviceId),    // Bind to specific device

  // Event subscriptions
  onNoteOn(callback),        // (note, velocity, channel) => void
  onNoteOff(callback),       // (note, channel) => void
  onCC(callback),            // (cc, value, channel) => void
  onPitchBend(callback),     // (value, channel) => void

  // State
  activeNotes,               // Set<midiNumber> of currently held notes
  lastDevice,                // persisted device preference (localStorage)
};
```

### Launchkey 49 Specifics
- Keys: standard note on/off on channel 1
- Pads: note on/off on channel 10 (drum map) — could trigger chord presets
- Knobs: CC 21-28 — map to visualizer params (sustain, density, etc.)
- Transport buttons: CC 115-118 — could control play/stop

### Integration with Harmonic Resonance
```
MIDI note on  →  trigger synth/sampler note
            →  update HarmonyState (if chord detected)
            →  FFT analyser captures audio
            →  particles spawn from spectral data

MIDI CC knob  →  map to visualizer parameter
              →  e.g., CC21 = particle density, CC22 = sustain

MIDI pad      →  trigger preset chord
              →  or trigger walkthrough step
```

### Integration with HarmonyState
```javascript
// In harmonic-resonance.js or wherever the panel lives:
import { HarmonyState } from './harmony-state.js';
import { MIDIInput } from './midi-input.js';

MIDIInput.onNoteOn((note, vel) => {
  synth.triggerAttack(midiToName(note), undefined, vel / 127);
});

MIDIInput.onNoteOff((note) => {
  synth.triggerRelease(midiToName(note));
  // After release, check remaining active notes for chord detection
  const active = Array.from(MIDIInput.activeNotes);
  if (active.length >= 3) {
    const chord = ChordResolver.resolve(active);
    HarmonyState.publish('chordChange', chord);
  }
});
```

---

## 4. Explorer Panel Integration

### Panel Registration
Harmonic Resonance becomes the **fifth panel** in Explorer, alongside Tonnetz, Chord Wheel, Keyboard, and Fretboard.

```javascript
// In explorer.js panel registry:
panels: {
  tonnetz:    { module: 'tonnetz-view.js',    label: 'Tonnetz' },
  wheel:      { module: 'chord-wheel.js',     label: 'Wheel' },
  keyboard:   { module: 'keyboard-view.js',   label: 'Keys' },
  fretboard:  { module: 'fretboard-view.js',  label: 'Fretboard' },
  spectrum:   { module: 'spectrum-view.js',    label: 'Spectrum' },  // ← new
}
```

### HarmonyState Subscription
```javascript
// spectrum-view.js
HarmonyState.subscribe('chordChange', (chord) => {
  // Play the chord through the synth/sampler
  // FFT does the rest — particles respond to real audio
});

HarmonyState.subscribe('noteOn', (note) => {
  // Individual note — from keyboard click, fretboard tap, or MIDI
});
```

### Panel-Specific Considerations
- **Canvas sizing:** Must handle the composable panel layout (1-panel full width, 2-panel split, 3+ compact). The log frequency axis scales well since it's proportional.
- **Audio routing:** Only one panel should own the audio output. Spectrum panel creates the synth + analyser; other panels trigger notes through HarmonyState, not directly.
- **Performance:** requestAnimationFrame loop is already efficient. At 700 particles with radial gradients, watch for frame drops on mobile. Consider reducing particle count when panel is < 400px wide.
- **Dark theme only:** This visualization only works on the dark DAW theme. If user is on light theme in Explorer, either auto-switch or show a muted/simplified version.

---

## 5. Tomorrow's Build Plan

### Morning Block — Harmonic Resonance Core
1. Create `spectrum-view.js` as a composable panel (follows existing panel patterns)
2. Implement progressive Salamander loading (skeleton → backfill)
3. Add FM guitar voice as placeholder
4. Wire up voice selector (Piano / Guitar / Synth)
5. Port the canvas rendering from the prototype (adapt to panel sizing)

### Afternoon Block — MIDI Input
1. Create `midi-input.js` singleton module
2. Implement Web MIDI API device discovery + selection
3. Note on/off → synth trigger + chord detection
4. CC mapping for Launchkey 49 knobs
5. Test with Launchkey — verify latency is acceptable
6. Wire MIDI into HarmonyState pub/sub

### Integration Checkpoint
- Spectrum panel responds to:
  - [ ] Direct chord buttons (like the prototype)
  - [ ] HarmonyState chord changes (from other panels)
  - [ ] MIDI keyboard input (live playing)
  - [ ] Walkthrough step changes
- Voice switching works without audio glitches
- Panel renders correctly at all Explorer layout sizes

### Stretch Goals
- Pad-to-chord mapping for Launchkey pads
- Knob-to-parameter CC mapping UI
- Peak frequency annotation (show note name at strongest peaks)
- Screenshot/export of current visualization state

---

## 6. File Manifest

```
New files:
  /static/js/spectrum-view.js       — panel component
  /static/js/midi-input.js          — MIDI singleton
  /static/css/spectrum-panel.css     — panel styles (dark theme)

Modified files:
  /static/js/explorer.js            — register spectrum panel
  /static/js/harmony-state.js       — add noteOn/noteOff events if missing
  /templates/explorer.html           — add panel toggle button
```

---

## 7. Open Questions

1. **Guitar samples:** Do we want to invest time finding/hosting real acoustic guitar samples now, or is FM guitar good enough for MVP? Real samples would make the FFT display more interesting (inharmonic partials, body resonance).

2. **Audio ownership:** If the user has MIDI connected and is playing live, should the spectrum panel be the *only* audio source? Or should keyboard/fretboard panels also produce sound independently? (Potential for doubled audio.)

3. **Walkthrough integration:** When a walkthrough auto-advances chords, should Harmonic Resonance play them audibly, or just visualize? If the walkthrough already has its own audio playback, we'd get doubled notes.

4. **Mobile:** Web MIDI API is not available on iOS Safari. Android Chrome supports it. Do we need a fallback, or is MIDI desktop-only for now?

5. **Panel default state:** Should Spectrum be hidden by default in Explorer (opt-in), or visible? It's the most visually dramatic panel but also the most resource-intensive.
