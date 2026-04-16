# Audio & Input Architecture

**Created:** 2026-04-16
**Status:** Spec — ready for implementation
**Depends on:** Phase A+ (MIDI input, game shell CSS) being complete
**Related:** `spectrum-panel-spec.md`, `game-engine-spec.md`, `songlab-build-plan.md`

---

## Executive Summary

SongLab's audio input is being rebuilt from a server-side DSP model (Python/librosa, high latency, single-user bottleneck) to a client-side architecture (Web Audio API + Tone.js, low latency, scales infinitely). The migration delivers five detection modalities — click, MIDI, onset, pitch, and chord — through a unified input abstraction that games consume without caring about hardware.

Hardware support spans three tiers: built-in mic (everyone), MIDI controller (keyboard players), and audio interface (guitarists, vocalists with pro gear). MIDI + audio interface are coupled as "pro hardware" with a shared device-picker UX.

---

## Current State Inventory

### Working

| Component | Location | What it does |
|---|---|---|
| Server-side mono pitch | `pitch_matcher.py` → `/process_audio_chunk` | `librosa.pyin`, 65–1047 Hz, returns note + cents + confidence |
| Server-side chord detection | `chord_detector.py` → `/identify` path in app.py | Chroma templates (10 chord types) + bass note detection |
| MIDI input | `static/shared/midi-input.js` | Web MIDI API, Launchkey 49 auto-detect, note on/off → HarmonyState |
| FFT analyser | `Tone.Analyser` (4096-bin) in `keyboard-view.js` | Shared analyser feeding Spectrum panel; `KeyboardView.getAnalyser()` public API |
| Spectrum panel | Explorer "Harmonic Resonance" tab | Real-time FFT particle visualizer, reads from shared analyser |

### Broken / Dead Code

| Component | Location | Problem |
|---|---|---|
| `startPitchDetection()` | `static/shared/audio.js` | Calls `POST /start_listen` and `GET /poll_audio` — neither route exists in app.py |
| `stopPitchDetection()` | `static/shared/audio.js` | Calls `POST /stop_listen` — route doesn't exist |
| `autocorrelate()` | `static/shared/audio.js` | Defined but never called by any code path |
| Melody Match mic input | `templates/melody.html` | Imports `startPitchDetection` from audio.js — calls broken routes |

### Missing

| Capability | Impact |
|---|---|
| Audio interface device selection | Scarlett 2i2 users default to laptop mic |
| Client-side pitch detection | All pitch games depend on server roundtrip (~130–300 ms) |
| Client-side chord detection | Guitar chord input requires server |
| Onset detection | No rhythm/tap input exists — all rhythm games are click-only |
| Unified input abstraction | Each game wires its own input; no shared picker or event model |
| Live external audio in Spectrum panel | Spectrum only visualizes internal Tone.js sampler output |

---

## Architecture Decisions

### Decision 1: Kill dead code

Delete from `static/shared/audio.js`:
- `startPitchDetection()` / `stopPitchDetection()` — poll-based model for non-existent routes
- `autocorrelate()` — unreferenced

Keep: `initAudio()`, `frequencyToNote()`, `noteToFrequency()`, `playNote()`, `playInterval()`, `getIntervalName()`, `getSemitones()`, `getNoteRange()`, constants. These are still consumed by games and utilities.

Fix `templates/melody.html` to use the new `pitch-detection.js` module (Task 4 below).

### Decision 2: Client-side DSP as primary path

**Server-side (`/process_audio_chunk` → librosa) becomes legacy/optional.**

Rationale:
- **Latency:** Server roundtrip is ~130–300 ms (capture → POST → pyin → response). Client-side is ~20–50 ms. Rhythm games need <50 ms; pitch feedback while singing needs <80 ms.
- **Scaling:** Server path holds a Python worker thread per concurrent user. Railway hobby tier = one worker. Client-side = zero server cost.
- **Cold start:** Railway hobby tier has ~15 s cold start. First mic interaction after inactivity appears broken to the user.
- **Mobile:** POST-per-frame burns battery and data. Client-side runs locally.

**The Python backend stays alive** for:
- Fallback if client-side detection fails in an edge case
- Future "upload your recording for analysis" feature (Phase E AI feedback)
- No code changes needed server-side — just stop routing real-time traffic through it

### Decision 3: YIN for pitch detection (with CREPE upgrade path)

| | YIN (JS) | CREPE-tiny (TF.js) |
|---|---|---|
| Quality | Good for clean input; weaker on noisy/breathy voice | Excellent; handles noise, vibrato, wobble |
| Latency | ~5–15 ms/frame | ~30–50 ms (GPU), ~80–150 ms (CPU-only) |
| Bundle | ~3 KB | ~5 MB model (lazy download) |
| Mobile | Fine | Marginal without WebGL |
| Effort | ~1 day | ~2 days |

**Ship YIN now.** The existing 15-cent pedagogical grace window confirms "close enough" is acceptable. YIN delivers that for voice and single-note guitar with zero model download and full mobile support.

**CREPE is planned as a Pro-tier upgrade (Phase E timeframe).** The `pitch-detection.js` module uses a strategy pattern so the engine is swappable without changing the API:

```js
const detector = createPitchDetector({
  engine: 'yin',        // free tier — ships by default, ~3 KB
  // engine: 'crepe',   // pro tier — 5 MB lazy-load, Phase E
  sampleRate: 44100,
  graceWindow: 15,      // cents — pedagogical "close enough" window
});

detector.start(({ frequency, note, octave, cents, confidence }) => {
  // Identical callback shape regardless of engine
});
```

CREPE loads lazily — model downloads only when explicitly selected or when the system detects repeated low-confidence results and offers the upgrade. Free users never see the download.

**When CREPE earns its keep:** a user singing into a laptop mic in a noisy room. A user with a Scarlett probably doesn't need CREPE (clean signal → YIN is sufficient). Product moment: "Low confidence scores detected. Try your audio interface, or enable Enhanced Pitch Detection (Pro)."

### Decision 4: Spectral flux for onset detection

Onset detection (detecting *when* an attack happens, not *what pitch*) is the highest-leverage new capability. It's computationally cheap, works on any source (clap, tap, voice "ta," guitar pick, drum hit), and unlocks four existing games plus the Polyrhythm Trainer.

Algorithm: compare consecutive FFT frames. A spike in spectral energy = onset. Reads from the same shared `Tone.Analyser` — no extra DSP cost.

**Fundamental constraint for polyrhythm:** a single mic stream produces a single onset stream. You cannot separate two near-simultaneous onsets (e.g., left-hand tap + right-hand tap 20 ms apart). For Polyrhythm Trainer Level 2 ("tap both layers"), the game must use *two separate input channels* — two keyboard keys, two MIDI pads, or mic + keyboard. Mic-only polyrhythm is limited to Level 1 ("tap along with one layer"). This is a physics constraint, not a shortcut. Game design accounts for it.

### Decision 5: Chord detection via chroma templates

Port the existing `chord_detector.py` logic to client-side JS:
1. Compute chroma vector (12-bin energy profile) from FFT
2. Correlate against chord templates (Major, Minor, Dim, Aug, Dom7, Maj7, Min7, sus2, sus4, m7b5)
3. Detect bass note in low-frequency band
4. Publish detected chord to HarmonyState

Quality depends entirely on source:
- **Audio interface (Scarlett DI guitar):** Excellent. Clean signal, clear harmonic structure.
- **Built-in mic, acoustic guitar, quiet room:** Okay-ish. Room reflections smear chroma.
- **Built-in mic, noisy environment:** Unreliable.

Ship as `interface: recommended, mic: experimental`. UI communicates expectations honestly.

### Decision 6: MIDI + audio interface = coupled "pro hardware"

From the browser's perspective, a Scarlett 2i2 is a `getUserMedia` audio input device. The Launchkey 49 is a Web MIDI device. A Musicians-tier user likely has both on the same USB hub.

These are coupled in UX:
- Shared "Hardware" settings panel (or flyout) in the Explorer
- Single device-discovery flow finds both simultaneously
- Status display: `🎹 Launchkey 49 MK3 ✅` / `🎸 Scarlett 2i2 USB ✅ (Input 1)`

The Scarlett feeds the same `Tone.Analyser` the Spectrum panel reads — meaning a guitarist plugging in sees their harmonics visualized in real-time on Harmonic Resonance. This is both a compelling demo and a natural integration test.

---

## Detection Modalities

Five modalities, each with a dedicated module:

| Modality | Module | What it detects | Best source | Fallback source | Games served |
|---|---|---|---|---|---|
| **click** | (native DOM) | UI interaction | mouse/touch | — | All games (baseline) |
| **midi** | `midi-input.js` ✅ | Note on/off, velocity, CC | Launchkey / any MIDI | — | All pitched games, Explorer |
| **onset** | `onset-detection.js` (new) | Attack timing + strength | interface or mic | keyboard spacebar | Polyrhythm, Rhythm Lab, Strum Patterns, Swing Trainer |
| **pitch** | `pitch-detection.js` (new) | Monophonic frequency → note | interface or mic | click on keyboard | Harmony Trainer, Melody Match, Scale Builder |
| **chord** | `chord-detection.js` (new) | Polyphonic chord identity | interface (recommended) | mic (experimental) | Chord Spotter, Voice Leading Detective, Explorer |

### Source quality axis

The *modality* (what kind of musical information) and *source quality* (what hardware) are separate concerns:

| Source | onset quality | pitch quality | chord quality | Permission needed |
|---|---|---|---|---|
| **Built-in mic** | Good (claps, taps) | Decent (voice), mediocre (guitar) | Unreliable in noise | `getUserMedia` |
| **Audio interface** (Scarlett) | Excellent | Excellent | Excellent (DI guitar) | `getUserMedia` with device selection |
| **MIDI device** (Launchkey) | n/a (use noteOn timing) | Exact (MIDI note number) | Exact (chord from held notes) | Web MIDI API |

### Game input support matrix

Each game declares supported modalities. The input picker UI shows only available options.

```js
// Example: per-game input declaration
inputSupport: {
  click: true,
  midi: true,
  onset: { mic: true, interface: true },
  pitch: { mic: true, interface: true },
  chord: { mic: 'experimental', interface: 'recommended' },
}
```

| Game | click | midi | onset | pitch | chord |
|---|---|---|---|---|---|
| Harmony Trainer | ✅ | ✅ | — | ✅ | — |
| Strum Patterns | ✅ | — | ✅ | — | — |
| Swing Trainer | ✅ | ✅ (pads) | ✅ | — | — |
| Melody Match | ✅ | ✅ | — | ✅ | — |
| Chord Spotter | ✅ | ✅ | — | — | ✅ |
| Rhythm Lab | ✅ | ✅ (pads) | ✅ | — | — |
| Scale Builder | ✅ | ✅ | — | ✅ | — |
| Relative Key Trainer | ✅ | — | — | — | — |
| Polyrhythm Trainer (B8) | ✅ | ✅ (pads) | ✅ | — | — |
| Voice Leading Detective (B7) | ✅ | ✅ | — | — | ✅ |

---

## New Modules — Specifications

### Module 1: Dead code cleanup (audio.js)

**Delete:**
- `startPitchDetection(callback)` (lines 256–291)
- `stopPitchDetection()` (lines 296–305)
- `autocorrelate(buffer, sampleRate)` (lines 315–368)
- Related module state: `micStream`, `analyserNode`, `detectionRunning`, `detectionFrameId`

**Keep:** `initAudio()`, all note/frequency conversion functions, `playNote()`, `playInterval()`, constants and their exports.

**Fix:** `templates/melody.html` — replace `startPitchDetection` import with new `pitch-detection.js` module.

**Effort:** 30 minutes

### Module 2: `static/shared/audio-input.js` — device selection + shared stream

Manages audio input device selection and feeds the shared `Tone.Analyser`.

```js
// Public API
export async function init();
  // Enumerates audio input devices
  // Auto-detects known interfaces (Scarlett, Focusrite, etc.)
  // Returns { devices: AudioInputDevice[], detected: AudioInputDevice | null }

export async function selectDevice(deviceId);
  // Creates MediaStream from selected device
  // Connects to shared Tone.Analyser chain
  // Stores preference in localStorage

export function getSourceQuality();
  // Returns 'interface' | 'mic' based on selected device

export function getStream();
  // Returns current MediaStream (for modules that need raw access)

export function onDeviceChange(callback);
  // Fires when devices connect/disconnect (USB plug events)
```

**Auto-detection heuristic:** device label matching against known interface names (`Scarlett`, `Focusrite`, `Audient`, `MOTU`, `PreSonus`, `Universal Audio`, `Steinberg`, `Behringer UMC`). Falls back to `'mic'` for unrecognized devices.

**Spectrum panel integration:** when an external device is selected, its stream feeds the existing `Tone.Analyser` alongside (or instead of) internal Tone.js sampler output. Guitarist plugs in → harmonics visualize in Harmonic Resonance. This requires a `MediaStreamSource` → analyser node connection in `keyboard-view.js`.

**iOS Safari note:** `enumerateDevices()` returns placeholder labels until after first `getUserMedia` call. Init flow: request mic permission (generic) → enumerate → show real device names → let user pick. Same user-gesture requirement already handled for Tone.js.

**Effort:** ~1 day

### Module 3: `static/shared/onset-detection.js` — attack timing

Detects audio onsets (taps, claps, plucks, vocal attacks) via spectral flux.

```js
// Public API
export function create(options);
  // options: { analyser, threshold?, cooldownMs? }
  // analyser: Tone.Analyser instance (reuses Spectrum panel's)
  // threshold: onset sensitivity (default 0.3, adjustable per game)
  // cooldownMs: minimum ms between onsets (default 50, prevents double-triggers)

export function start(onOnset);
  // onOnset: ({ timestamp, strength }) => void
  // timestamp: performance.now() of detected onset
  // strength: 0–1 normalized energy spike

export function stop();

export function setThreshold(value);
  // Live adjustment — games can tighten/loosen during play

export function setSensitivity(sourceQuality);
  // Adjusts internal thresholds based on 'interface' vs 'mic'
```

**Algorithm:** spectral flux = sum of positive differences between consecutive FFT magnitude frames. When flux exceeds threshold (adaptive, based on recent flux history), fire onset event. Cooldown prevents double-triggers from a single percussive attack.

**Reads from existing `Tone.Analyser`** — no additional DSP chain. Performance cost is one array comparison per animation frame.

**Effort:** ~half-day

### Module 4: `static/shared/pitch-detection.js` — monophonic fundamental

Detects pitch from audio input using YIN algorithm, with strategy pattern for future CREPE upgrade.

```js
// Public API
export function createPitchDetector(options);
  // options: {
  //   engine: 'yin',             // 'yin' (default/free) | 'crepe' (future pro)
  //   sampleRate: 44100,
  //   bufferSize: 2048,          // samples per analysis frame
  //   graceWindow: 15,           // cents — "close enough" threshold
  //   confidenceThreshold: 0.8,  // below this → "didn't hear clearly"
  // }

// Returned detector object:
detector.start(callback);
  // callback: ({ frequency, note, octave, cents, confidence, fullName }) => void
  // frequency: Hz (0 if silence/no pitch)
  // note: 'C', 'F#', etc.
  // octave: integer
  // cents: deviation from nearest ET pitch (after grace window: 0 if within ±15¢)
  // confidence: 0–1
  // fullName: 'C4', 'F#3', etc.

detector.stop();

detector.setEngine(engineName);
  // Swap engine at runtime (for pro upgrade flow)
  // 'crepe' triggers lazy model download (~5 MB) with progress callback
```

**YIN implementation:** time-domain autocorrelation with cumulative mean normalized difference function. Well-documented algorithm (de Cheveigné & Kawahara, 2002). Existing JS implementations available for reference (Pitchfinder, aubio.js). Runs on `ScriptProcessorNode` or `AudioWorklet` (prefer AudioWorklet for main-thread-free processing if browser supports it, fall back to ScriptProcessor).

**Grace window:** inherited from current `frequencyToNote()` in audio.js — ±15 cents snaps to nearest note with `cents: 0`. Pedagogically: a kid singing 10 cents flat gets a green checkmark, not a red X.

**Confidence threshold:** below 0.8 → callback fires with `frequency: 0` and the game shows "Try again" rather than scoring a wrong answer. This is the pedagogical decision: silence/noise is "no input," not "wrong input."

**CREPE upgrade path (Phase E / Pro tier):**
- `detector.setEngine('crepe')` triggers lazy download of TF.js + CREPE-tiny model
- Progress callback for download UI: "Downloading enhanced pitch detection... 2.1 / 5.0 MB"
- Once loaded, callback shape is identical — games don't change
- Model cached in browser after first download
- Product trigger: repeated low-confidence detections → "Enable Enhanced Pitch Detection (Pro)?" prompt

**Effort:** ~1 day

### Module 5: `static/shared/chord-detection.js` — polyphonic chord identity

Detects chords from polyphonic audio using chroma-vector template matching. Port of `chord_detector.py`.

```js
// Public API
export function create(options);
  // options: {
  //   analyser: Tone.Analyser,      // reuses shared analyser
  //   sourceQuality: 'interface' | 'mic',
  //   keyContext: null | 'C' | 'G' | ...,  // optional — enables key-aware resolution
  //   minConfidence: 0.6,
  // }

export function start(onChord);
  // onChord: ({ root, quality, symbol, bass, confidence, pitchClasses }) => void
  // root: 'C', 'F#', etc.
  // quality: 'major', 'minor', 'dom7', 'maj7', 'min7', 'dim', 'aug', 'sus2', 'sus4', 'm7b5'
  // symbol: 'Cmaj7', 'F#m', 'Bdim' — formatted display string
  // bass: 'C', 'E', etc. — detected bass note (for slash chords)
  // confidence: 0–1 — template correlation strength
  // pitchClasses: [0, 4, 7] — detected chroma peaks as pitch class integers

export function stop();

export function setKeyContext(key);
  // Updates key for diatonic preference in ambiguous resolution
  // Mirrors the key-aware resolution logic from chord-resolver.js
```

**Algorithm (ported from chord_detector.py):**
1. Extract 12-bin chroma vector from FFT (sum energy in each pitch class bin)
2. Normalize chroma vector
3. Correlate against all chord templates (12 roots × 10 qualities = 120 candidates)
4. Rank by correlation score
5. Apply key-context preference for ambiguous chords (augmented, diminished — same logic as `chord-resolver.js`)
6. Detect bass note from low-frequency band (60–270 Hz)
7. Emit result if confidence exceeds threshold

**Source quality adaptation:**
- `'interface'`: lower noise floor, tighter confidence threshold (0.6), faster response
- `'mic'`: higher noise floor, looser threshold (0.4), require more sustained energy before emitting

**Integration with existing chord-resolver.js:** `chord-detection.js` handles audio → pitch classes. It can optionally pipe pitch classes through the existing `ChordResolver.resolveChord()` for key-aware disambiguation, reusing that logic rather than duplicating it.

**Effort:** ~1 day

### Module 6: `static/shared/input-provider.js` — unified abstraction

Thin abstraction layer that games consume. Declares supported modalities, manages the input picker UI, and emits a uniform event stream.

```js
// Game registration
export function createInputProvider(config);
  // config: {
  //   gameId: 'polyrhythm-trainer',
  //   supported: {
  //     click: true,
  //     midi: true,
  //     onset: { mic: true, interface: true },
  //     pitch: { mic: true, interface: true },
  //     chord: { mic: 'experimental', interface: 'recommended' },
  //   },
  //   containerEl: document.getElementById('input-picker'),  // mount point for picker UI
  // }

// Returned provider object:
provider.on('noteOn', ({ note, octave, velocity, source }) => {});
provider.on('noteOff', ({ note, octave, source }) => {});
provider.on('onset', ({ timestamp, strength, source }) => {});
provider.on('chord', ({ root, quality, symbol, confidence, source }) => {});

provider.getActiveModality();
  // Returns current selection: 'click' | 'midi' | 'mic_pitch' | 'mic_chord' | 'mic_onset'

provider.destroy();
  // Cleanup — stops detection, removes picker UI
```

**Picker UI:** row of icon+label pills rendered into the container element. Only shows modalities the game declares as supported. Grays out modalities whose hardware isn't connected (e.g., MIDI pill grayed if no MIDI device). Shows source-quality badge for chord detection ("Recommended: audio interface").

**Thin now, rich later:** initial version handles event routing and UI. Future versions add: input recording/playback for replays, input quantization for rhythm games, multi-source mixing (e.g., MIDI + onset simultaneously).

**Effort:** ~1 day for thin version

---

## Implementation Order

| # | Task | Effort | Unlocks | Dependencies |
|---|---|---|---|---|
| 1 | Dead code cleanup (audio.js) | 30 min | Clean codebase, Melody Match fix prep | None |
| 2 | `audio-input.js` (device selection) | 1 day | Scarlett support, Spectrum reads live audio, device picker | None |
| 3 | `onset-detection.js` | half-day | Polyrhythm Trainer, Rhythm Lab/Strum/Swing upgrades | Shared `Tone.Analyser` (exists) |
| 4 | `pitch-detection.js` (YIN) | 1 day | Melody Match client-side, Harmony Trainer client-side | Task 1 (removes old code) |
| 5 | `chord-detection.js` | 1 day | Chord Spotter guitar input, Voice Leading Detective, Explorer live chord | Task 2 (needs audio-input for interface quality) |
| 6 | `input-provider.js` (thin) | 1 day | Unified game input picker | Tasks 2–5 (wraps all modalities) |

**Total: ~5 days of Claude Code work.** Each task is independently shippable.

**Priority shortcut:** if only building one module before user testing, **build onset-detection.js** (task 3). Half a day, zero dependencies beyond what exists, unlocks the entire rhythm game upgrade path.

---

## Migration Plan for Existing Games

After modules are built, each game migrates from its current input wiring to `input-provider.js`:

| Game | Current input | Migration |
|---|---|---|
| Melody Match | Broken (`startPitchDetection` → dead routes) | Rewire to `pitch-detection.js` via provider. **Urgent — currently non-functional.** |
| Harmony Trainer | Server-side (`/process_audio_chunk`) | Rewire to `pitch-detection.js` via provider |
| Chord Spotter | Click only | Add chord detection via provider |
| Rhythm Lab | Click only | Add onset detection via provider |
| Strum Patterns | Click only | Add onset detection via provider |
| Swing Trainer | Click only | Add onset detection via provider |
| Scale Builder | Click only | Add pitch detection via provider |
| Polyrhythm Trainer | Not built yet | Build natively on provider from day one |

Games migrate incrementally. Click always remains as fallback — no game loses existing functionality.

---

## Python Backend — Retention Plan

`audio_processor.py`, `pitch_matcher.py`, `chord_detector.py`, and the `/process_audio_chunk` route stay in the codebase but are no longer the real-time path.

**Current role:** legacy fallback.

**Future role (Phase E):** "Upload your practice recording" feature — user records a session, uploads audio file, server runs pyin + chord detection + onset analysis on the full recording, returns a detailed practice report. This is where server-side DSP quality (pyin > YIN) genuinely matters and latency doesn't.

**If simplifying deployment before Phase E:** the Python audio dependencies (librosa, scipy, numpy) are the heaviest items in `requirements.txt`. Removing them significantly speeds up Railway builds. Decision can be deferred — no code changes needed either way.

---

## Future: CREPE Integration (Phase E / Pro Tier)

**Trigger:** Phase E (AI-powered feedback) development begins, or user testing reveals YIN quality is insufficient for key use cases.

**Implementation:**
1. Add TF.js as a lazy-loaded dependency (not in main bundle)
2. Download CREPE-tiny model (~5 MB) on first Pro-tier pitch detection request
3. Cache model in browser storage after download
4. `pitchDetector.setEngine('crepe')` swaps engine at runtime — identical callback API
5. Product surface: "Enhanced Pitch Detection" toggle in Pro settings, or automatic upgrade prompt on repeated low-confidence detections

**Bundle impact on free tier:** zero. CREPE code and model are never loaded unless explicitly requested.

---

## Open Questions

1. **AudioWorklet vs ScriptProcessorNode:** AudioWorklet runs DSP off the main thread (better performance) but has compatibility gaps in older Safari. Recommend AudioWorklet with ScriptProcessor fallback. Needs testing on target devices during user testing prep.

2. **Onset detection for voice "ta-ta-ta":** spectral flux works well for percussive attacks but may need tuning for voiced onsets (which have a softer attack profile). Test with real voice input during Polyrhythm Trainer development.

3. **Chord detection update rate:** how often should `chord-detection.js` emit? Every FFT frame (~23 ms at 4096/44100) is too chatty. Every 100 ms is more practical. Or: emit on *change* only (new chord detected that differs from previous). Recommend change-based with a 100 ms debounce.

4. **Multi-device audio mixing:** if both Scarlett and built-in mic are connected, which feeds the analyser? Recommend: user picks one. Don't mix. Mixing introduces latency alignment problems and defeats the clean-signal advantage of the interface.
