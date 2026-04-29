# Audio Analysis Orchestration — Read-only Audit

Scope: how the audio-analysis modules in `static/shared/` are
instantiated, started, fed, and torn down by SongLab's surfaces and
games today. Out of scope: detection algorithms, FFT internals, UI
rendering, game-specific logic.

All claims below are pinned to `file:line`. Quotations are sparse;
prefer the line reference.

---

## 1. Cantor's chord-detection lifecycle

Cantor is a self-contained surface. Its audio analysis wiring lives
entirely in [templates/cantor.html](../templates/cantor.html); there is
no cantor-specific audio module — `static/shared/cantor-view.js` only
consumes `HarmonyState` and `MusicalEventStream`
([cantor-view.js:48-50](../static/shared/cantor-view.js#L48-L50)).

### Imports

[cantor.html:286-287](../templates/cantor.html#L286-L287) imports the
factory:

```
import { create as createChordDetector }
  from '…/static/shared/chord-detection.js';
```

Other audio-related imports on the same page:
[`AudioInput`](../templates/cantor.html#L274-L275),
[`MIDIInput`](../templates/cantor.html#L280-L281),
[`MusicalEventStream`](../templates/cantor.html#L282-L283),
[`KeyboardView`](../templates/cantor.html#L272-L273).

### Module-scoped detector state

[cantor.html:486-489](../templates/cantor.html#L486-L489) declares
single-detector state at the module scope:

- `_chordDetector` — the detector instance, created lazily.
- `_silenceWatcherId` — `setInterval` id for the silence poller.
- `_silenceCounter` — consecutive quiet polls.
- `_lastChordPushed` — `${root}-${type}` key for change-detect.

### Instantiation (`_startChordDetection`)

Defined at [cantor.html:507-564](../templates/cantor.html#L507-L564).

1. Idempotency guard: returns early if `_chordDetector` already exists
   ([cantor.html:508](../templates/cantor.html#L508)).
2. Resolves the shared analyser via `KeyboardView.getAnalyser()`
   ([cantor.html:509-511](../templates/cantor.html#L509-L511)). That
   call creates a singleton `Tone.Analyser('fft', 4096)` on first use
   inside `keyboard-view.js`
   ([keyboard-view.js:402-407](../static/shared/keyboard-view.js#L402-L407)).
3. Resolves `sourceQuality` from `AudioInput.getSourceQuality()`,
   defaulting to `'mic'`
   ([cantor.html:513-516](../templates/cantor.html#L513-L516)).
4. Calls `createChordDetector({ analyser, sourceQuality })`
   ([cantor.html:518](../templates/cantor.html#L518)).

### Start / callback handling

`_chordDetector.start(...)` is invoked at
[cantor.html:524-538](../templates/cantor.html#L524-L538). The callback:

- Maps `event.quality` (chord-detection's quality keys) to
  `transforms.js` chord-type keys via the local `CHORD_TYPE_MAP`
  ([cantor.html:494-505](../templates/cantor.html#L494-L505)).
- De-dupes against `_lastChordPushed`
  ([cantor.html:530-532](../templates/cantor.html#L530-L532)).
- Calls `HarmonyState.highlightChord(root, type, 'primary')`
  ([cantor.html:536](../templates/cantor.html#L536)).

A silence watcher poll loop runs in parallel
([cantor.html:543-563](../templates/cantor.html#L543-L563)): every
100 ms it sums above-`-60 dB` linear energy from the same analyser; 5
consecutive samples below `0.02` clear the active triad/chord/notes on
`HarmonyState`. The chord detector itself only emits on chord change
([chord-detection.js:412-413](../static/shared/chord-detection.js#L412-L413)),
so without the watcher the last chord would stick after silence.

### What triggers `_startChordDetection`

Two trigger sites:

- **First MIDI note-on path.** When a MIDI note-on fires AND
  `AudioInput.isActive` is true, `_startChordDetection()` is called
  from inside the note-on handler
  ([cantor.html:435-460](../templates/cantor.html#L435-L460), specifically
  [cantor.html:455-457](../templates/cantor.html#L455-L457)). The
  comment at
  [cantor.html:453-457](../templates/cantor.html#L453-L457) explains
  why it's gated on `AudioInput.isActive`: without an external mic the
  sampler's own output would feed the analyser and override manual
  `setTriad` calls.
- **Audio device selection.** The Hardware-row `<select>` change
  handler tears down (`_stopChordDetection()`,
  `AudioInput.disconnect()`), wires the analyser, then calls
  `AudioInput.selectDevice(deviceId)`, then
  `_startChordDetection()` on success
  ([cantor.html:816-849](../templates/cantor.html#L816-L849), specifically
  [cantor.html:835-839](../templates/cantor.html#L835-L839)).

### Stop / teardown (`_stopChordDetection`)

Defined at [cantor.html:566-585](../templates/cantor.html#L566-L585).
Steps:

1. Calls `_chordDetector.stop()` and nulls the reference.
2. Clears the silence-watcher interval and its counter/key.
3. Calls `HarmonyState.update({ activeTriads: [], activeChord: null,
   activeNotes: [] })` to release any stuck highlight so manual
   `setTriad` regains control.

`_stopChordDetection()` is invoked from:

- **Audio init.** Called once during `_initAudioInput`
  ([cantor.html:807](../templates/cantor.html#L807)) before the saved
  device is rebuilt through the dropdown path.
- **Pre-switch teardown.** Called twice from the device-`change`
  handler — once before `AudioInput.disconnect()` and once before
  `AudioInput.selectDevice` to ensure clean state
  ([cantor.html:818, 835](../templates/cantor.html#L818)).

There is no page-unload teardown hook on this surface.

---

## 2. `input-provider.js` vs. per-surface wiring

`input-provider.js` is *only* consumed by games. The "always-on"
surfaces (Cantor, Harmonograph, Explorer) wire the detection modules
directly in their templates.

### Surfaces wiring detectors directly (no input-provider)

- **Cantor** — `chord-detection` only
  ([cantor.html:286-287](../templates/cantor.html#L286-L287)).
- **Harmonograph** — `chord-detection` and `pitch-detection`
  ([harmonograph.html:483-486](../templates/harmonograph.html#L483-L486)).
  Onset detection is *not* used; the view consumes onset density via
  `window.__harmonograph.pushOnset()` driven by MIDI noteOn
  ([harmonograph.html:685-687](../templates/harmonograph.html#L685-L687)),
  not via `onset-detection.js`.
- **Explorer** — uses `chord-resolver.js` directly
  ([explorer.html:1919-1920](../templates/explorer.html#L1919-L1920))
  and `AudioInput`+`MIDIInput`
  ([explorer.html:1907-1910](../templates/explorer.html#L1907-L1910));
  it does not import `chord-detection`, `onset-detection`, or
  `pitch-detection`.
- **Melody** — imports `pitch-detection` directly
  ([melody.html:344](../templates/melody.html#L344)).
- **SkratchLab audio bridge** — imports `pitch-detection` directly
  ([skratch-studio/audio-bridge.js:12](../static/skratch-studio/audio-bridge.js#L12)).

### Surfaces using `input-provider`

- **Polyrhythm Trainer** — only consumer in the codebase today
  ([polyrhythm.js:15, 1845-1856](../static/games/polyrhythm.js#L15)).
  Declares `supported: { click, midi, onset: { mic, interface } }`
  ([polyrhythm.js:1846-1851](../static/games/polyrhythm.js#L1846-L1851))
  and subscribes to `'onset'` events
  ([polyrhythm.js:1856](../static/games/polyrhythm.js#L1856)).

### Convention summary (what the code shows)

The two patterns are consistent:

- Cantor and Harmonograph (always-on visualization surfaces) import
  their detectors directly in the template, share `KeyboardView`'s
  singleton FFT analyser, and orchestrate start/stop themselves
  alongside `AudioInput` device management.
- `input-provider` is the abstraction games use for runtime modality
  switching (click/MIDI/mic-pitch/mic-chord/mic-onset). It owns the
  detector instances internally
  ([input-provider.js:354-358](../static/shared/input-provider.js#L354-L358))
  and does not expose them to callers.

The task's framing — "always-on surfaces wire detectors directly,
games use input-provider" — matches what's in the code today, with one
caveat: Polyrhythm is the only game wired through input-provider. No
other consumer of `createInputProvider` exists in `static/games/`,
`static/`, or `templates/` (grep confirmed,
[search results above](#)).

---

## 3. MusicalEventStream publishers and subscribers

[musical-event-stream.js](../static/shared/musical-event-stream.js) is
a pub/sub object on `window.MusicalEventStream` with `publish()`,
`subscribe()`, `getRecentNotes()`, `reset()` (defined at
[musical-event-stream.js:38-100](../static/shared/musical-event-stream.js#L38-L100)).

### Publishers

All publish call sites in the codebase:

| File:line | Source | Event types |
|---|---|---|
| [cantor.html:322-328](../templates/cantor.html#L322-L328) | KeyboardView `onNotePlay` (on-screen click) | `noteAttack` |
| [cantor.html:333-338](../templates/cantor.html#L333-L338) | KeyboardView `onNoteRelease` (on-screen click) | `noteRelease` |
| [cantor.html:438-445](../templates/cantor.html#L438-L445) | `MIDIInput.onNoteOn` callback | `noteAttack` |
| [cantor.html:464-468](../templates/cantor.html#L464-L468) | `MIDIInput.onNoteOff` callback | `noteRelease` |
| [cantor-view.js:743-749](../static/shared/cantor-view.js#L743-L749) | `_testSnap` dev/test helper | `noteAttack` (synthetic) |

No other file publishes to `MusicalEventStream`. Grep across `static/`
and `templates/` confirms.

### Subscribers

- [cantor-view.js:311](../static/shared/cantor-view.js#L311) —
  `MusicalEventStream.subscribe((ev) => this._onMusicalEvent(ev))`,
  filtered to `noteAttack` events at
  [cantor-view.js:667](../static/shared/cantor-view.js#L667). Used to
  drive the melody constellation; releases are not consumed.

There is one subscriber today.

### MIDI noteAttack wiring (the pattern onset-detection would follow)

The MIDI publish pattern lives entirely in
[cantor.html:411-475](../templates/cantor.html#L411-L475) inside the
`_initMIDI` IIFE. Specifically:

- `MIDIInput.init()` is awaited
  ([cantor.html:415](../templates/cantor.html#L415)).
- `MIDIInput.onNoteOn` registers a callback that publishes
  `{ type: 'noteAttack', pitch, velocity, source: 'midi', timestamp,
  channel }` to the stream
  ([cantor.html:435-445](../templates/cantor.html#L435-L445)). Channel
  10 (drum pads) is dropped at
  [cantor.html:437](../templates/cantor.html#L437).
- `MIDIInput.onNoteOff` mirrors with `noteRelease`
  ([cantor.html:462-469](../templates/cantor.html#L462-L469)).

The keyboard click path uses the same publish API and mirrors the
shape (pitch, velocity, source: `'keyboard'`) at
[cantor.html:319-339](../templates/cantor.html#L319-L339).

The producer comment at
[musical-event-stream.js:5-7](../static/shared/musical-event-stream.js#L5-L7)
names "MIDIInput now, AudioInterpreter later" as the intended
producers; only MIDIInput (and the on-screen keyboard) publish today.

---

## 4. Shared "audio analyzer lifecycle" pattern

There is no formal lifecycle abstraction. Each surface manages its
detectors itself. Two patterns are visible:

### Shared `Tone.Analyser` source

A single FFT analyser is owned by `keyboard-view.js`:

- `_sharedAnalyser` is a module-scoped `Tone.Analyser('fft', 4096)`
  created lazily by `_ensureAnalyser()`
  ([keyboard-view.js:399-407](../static/shared/keyboard-view.js#L399-L407)).
- It is wired in-line between every instrument volume node and the
  audio destination
  ([keyboard-view.js:409-420](../static/shared/keyboard-view.js#L409-L420)),
  so any audio playing through `KeyboardView`'s sampler reaches the
  same analyser.
- `KeyboardView.getAnalyser()` exposes it
  ([keyboard-view.js:945-947](../static/shared/keyboard-view.js#L945-L947)).

Surfaces that need an FFT detector (chord-detection,
harmonograph-view's blob renderer, the Spectrum panel,
resonance-view) all read from this analyser. `AudioInput` then routes
external mic/interface streams *into* it via `setAnalyser` +
`selectDevice`
([audio-input.js:208-289](../static/shared/audio-input.js#L208-L289)),
so MIDI sampler output and external audio share one FFT.

`pitch-detection.js` does **not** use this shared analyser. It creates
its own `AudioContext` and pulls samples via `ScriptProcessorNode` on
the raw `MediaStream`
([pitch-detection.js:265-399](../static/shared/pitch-detection.js#L265-L399)).
The comment at
[pitch-detection.js:284-289](../static/shared/pitch-detection.js#L284-L289)
documents the intent: pinned sample-rate for YIN, no Tone graph wiring.

### Detector factories

All three detection modules export a factory:

- `chord-detection.js` → `export function create(options)`
  ([chord-detection.js:271](../static/shared/chord-detection.js#L271)).
  Options: `{ analyser, sourceQuality?, keyContext?, minConfidence? }`.
  Returns `{ start, stop, setKeyContext }`.
- `onset-detection.js` → `export function create(options)`
  ([onset-detection.js:51](../static/shared/onset-detection.js#L51)).
  Options: `{ analyser, threshold?, cooldownMs? }`. Returns
  `{ start, stop, setThreshold, setSensitivity }`.
- `pitch-detection.js` → `export function createPitchDetector(options)`
  ([pitch-detection.js:205](../static/shared/pitch-detection.js#L205)).
  Options: `{ engine?, sampleRate?, bufferSize?, graceWindow?,
  confidenceThreshold?, stream? }`. Returns `{ start, stop,
  setEngine }`.

`chord-detection` and `onset-detection` use `requestAnimationFrame` to
read `analyser.getValue()` each tick
([chord-detection.js:294-295,
444](../static/shared/chord-detection.js#L294-L295),
[onset-detection.js:110-111,
170](../static/shared/onset-detection.js#L110-L111)). Both expose
`stop()` that calls `cancelAnimationFrame` and nulls the callback.

### Start / teardown sequencing in surfaces

In every direct-wire surface the sequence is:

1. Resolve the analyser from `KeyboardView.getAnalyser()`.
2. Resolve `sourceQuality` from `AudioInput.getSourceQuality() ||
   'mic'`.
3. Call `createXxxDetector({ analyser, sourceQuality })`.
4. `detector.start(callback)`.
5. On device switch / page action: `detector.stop()`, then null the
   reference.

See:

- Cantor:
  [cantor.html:507-585](../templates/cantor.html#L507-L585).
- Harmonograph chord:
  [harmonograph.html:852-922](../templates/harmonograph.html#L852-L922).
- Harmonograph pitch:
  [harmonograph.html:930-987](../templates/harmonograph.html#L930-L987).

`input-provider.js` follows the same shape internally for its
managed detectors:
[input-provider.js:380-413](../static/shared/input-provider.js#L380-L413)
(stop), [input-provider.js:419-510](../static/shared/input-provider.js#L419-L510)
(start). Modality switches always call `stopCurrentModality()` before
`startModality(next)`.

There is **no** shared "lifecycle helper" file (no
`detector-lifecycle.js`, no abstract base class). Each surface
re-implements the sequence in template script blocks.

### Silence watcher (chord-only pattern)

Both Cantor
([cantor.html:543-563](../templates/cantor.html#L543-L563)) and
Harmonograph
([harmonograph.html:888-906](../templates/harmonograph.html#L888-L906))
duplicate the same 100 ms-poll, 5-quiet-sample silence watcher because
chord-detection only emits on change. The two implementations are
near-identical (same threshold `0.02`, same `-60 dB` cutoff, same
counter logic). pitch-detection has its own internal confidence gate
and needs no external watcher
([harmonograph.html:533-535](../templates/harmonograph.html#L533-L535)).

---

## 5. Audio-analysis module dependency graph (direct imports only)

```
audio-input.js            → (no inter-module imports; uses Tone via window/options)
midi-input.js             → (no imports)
musical-event-stream.js   → (no imports)
chord-resolver.js         → (no imports)

onset-detection.js        → (no imports — analyser is injected)
pitch-detection.js        → audio.js (frequencyToNote)
chord-detection.js        → chord-resolver.js (resolveChord)

input-provider.js         → midi-input.js
                          → audio-input.js
                          → onset-detection.js
                          → pitch-detection.js
                          → chord-detection.js

cantor-view.js            → musical-event-stream.js
                          → harmony-state.js
                          → transforms.js
harmonograph-view.js      → harmony-state.js
                          → transforms.js
                          (uses window.MIDIInput at runtime,
                           [harmonograph-view.js:886](../static/shared/harmonograph-view.js#L886))
resonance-view.js         → harmony-state.js
                          → transforms.js
keyboard-view.js          → owns the shared Tone.Analyser; consumed by
                            chord-detection / harmonograph / resonance
                            via getAnalyser()
chord-bubble-renderer.js  → chord-resolver.js
```

Verified imports:

- `chord-detection.js` imports `chord-resolver.js`
  ([chord-detection.js:12](../static/shared/chord-detection.js#L12)).
  No other imports.
- `pitch-detection.js` imports only `frequencyToNote` from `audio.js`
  ([pitch-detection.js:36](../static/shared/pitch-detection.js#L36)).
- `onset-detection.js` has no imports — analyser is injected via
  options ([onset-detection.js:51-55](../static/shared/onset-detection.js#L51-L55)).
- `audio-input.js` has no inter-module imports. Tone is read off
  `window.Tone`
  ([audio-input.js:138-144,
  260-273](../static/shared/audio-input.js#L138-L144)).
- `midi-input.js` has no imports
  ([midi-input.js:1-32](../static/shared/midi-input.js#L1-L32)).
- `musical-event-stream.js` has no imports
  ([musical-event-stream.js:25-108](../static/shared/musical-event-stream.js#L25-L108)).
- `chord-resolver.js` has no imports
  ([chord-resolver.js:1-173](../static/shared/chord-resolver.js#L1-L173)).
- `input-provider.js` imports all five input/detection modules
  ([input-provider.js:25-29](../static/shared/input-provider.js#L25-L29)).
- `chord-bubble-renderer.js` imports `chord-resolver.js`
  ([chord-bubble-renderer.js:32](../static/shared/chord-bubble-renderer.js#L32)).

Cross-page consumers of `chord-resolver` outside `chord-detection.js`
and `chord-bubble-renderer.js`:
[explorer.html:1919-1920](../templates/explorer.html#L1919-L1920),
[test-fretboard.html:175-176](../templates/test-fretboard.html#L175-L176),
[chord-wheel.js:24](../static/js/chord-wheel.js#L24).

---

## 6. Onset-detection factory consumers

**Confirmed by grep** — only one production consumer:

- [input-provider.js:27](../static/shared/input-provider.js#L27) imports
  `create as createOnsetDetector`. The factory is invoked at
  [input-provider.js:492](../static/shared/input-provider.js#L492) inside
  the `mic_onset` modality branch.

The only other reference outside the module's own file is in
[docs/code-review-opus47.md:193](./code-review-opus47.md#L193) (a
documentation file).

No template, no other shared module, no game file imports
`onset-detection.js` directly. Polyrhythm reaches it only via
`input-provider.createInputProvider({ supported: { onset: ... } })`
([polyrhythm.js:1845-1855](../static/games/polyrhythm.js#L1845-L1855)).

`static/strumming/detection.js` and `static/rhythm/rhythm.js` carry
TODO comments about migrating to `onset-detection.js` but do not
import it
([strumming/detection.js:79, 117, 222](../static/strumming/detection.js#L79),
[rhythm/rhythm.js:548, 558](../static/rhythm/rhythm.js#L548)).

---

## Notable findings

The following observations stood out during the audit. Flagged here
without speculation as to cause.

### A. Cantor's start trigger is implicit; Harmonograph's is reconciled

Cantor starts chord detection in two unrelated places — inside the
MIDI note-on handler
([cantor.html:455-457](../templates/cantor.html#L455-L457)) and inside
the audio device-`change` handler
([cantor.html:839](../templates/cantor.html#L839)). It is not started
from `_initAudioInput` itself; the call there is `_stopChordDetection`
([cantor.html:807](../templates/cantor.html#L807)) followed by
`AudioInput.disconnect()`. That means a saved-device auto-restore
would not start chord detection until the user either selects a device
through the dropdown or plays a MIDI note.

Harmonograph instead reconciles start/stop based on observed state in
`_updateAudioInputStatus`
([harmonograph.html:797-813](../templates/harmonograph.html#L797-L813)):
if `AudioInput.isActive && Tone.context.state === 'running'`, both
chord and pitch detectors are started together; otherwise both are
stopped. The reconciliation runs on every status update.

The two surfaces use the same `chord-detection.js` factory but
different policies for "when should it be running."

### B. Two separate copies of the silence watcher

The silence-watcher implementation is duplicated nearly verbatim in
[cantor.html:543-563](../templates/cantor.html#L543-L563) and
[harmonograph.html:888-906](../templates/harmonograph.html#L888-L906)
(same 100 ms poll, same `-60 dB` floor, same `0.02` energy threshold,
same 5-sample debounce). Neither is factored into a shared helper.

### C. Cross-detector flatness coupling between pitch and chord detection

Harmonograph's chord-detection callback gates on
`PitchDetection.getCurrentFlatness() > 0.4` to suppress noise-driven
phantom chords
([harmonograph.html:867-879](../templates/harmonograph.html#L867-L879)).
The flatness value is a module-level cache exported by
`pitch-detection.js`
([pitch-detection.js:66-78](../static/shared/pitch-detection.js#L66-L78)),
written from inside the YIN tick
([pitch-detection.js:325-326](../static/shared/pitch-detection.js#L325-L326))
and reset to 0 on `stop()`
([pitch-detection.js:410](../static/shared/pitch-detection.js#L410)).

This means Harmonograph's chord detector silently depends on the
pitch detector being running — if the pitch detector is stopped, the
gate falls through (`getCurrentFlatness()` returns 0, which passes
`> 0.4`). Cantor's chord detector does not perform this gate
([cantor.html:524-538](../templates/cantor.html#L524-L538)).

### D. `MIDIInput` consumed via global on harmonograph-view

[harmonograph-view.js:886](../static/shared/harmonograph-view.js#L886)
reads `window.MIDIInput` at runtime inside `_updateAudioReactive`
rather than importing the module. Cantor and the explorer template
import it through the ES-module path. The two access patterns reach
the same singleton (the module attaches itself to `window` at
[midi-input.js:253-255](../static/shared/midi-input.js#L253-L255)).

### E. Public types differ slightly between detectors

`chord-detection.js` returns events with `{ root, quality, symbol,
bass, confidence, pitchClasses }`
([chord-detection.js:419-426](../static/shared/chord-detection.js#L419-L426)).
`input-provider.js`'s `'chord'` event re-shapes that to `{ root,
quality, symbol, confidence, source }` — dropping `bass` and
`pitchClasses`
([input-provider.js:476-483](../static/shared/input-provider.js#L476-L483)).
Cantor and Harmonograph consume `pitchClasses` directly
([harmonograph.html:845-848](../templates/harmonograph.html#L845-L848))
and so cannot use `input-provider`'s chord event for their current
behavior.

### F. Test path publishes synthetic events to the live stream

`cantor-view.js`'s `_testSnap` dev helper publishes real
`noteAttack` events on the live `MusicalEventStream`
([cantor-view.js:743-749](../static/shared/cantor-view.js#L743-L749)).
There is no test-only stream. Documented as dev-only at
[cantor-view.js:697-703](../static/shared/cantor-view.js#L697-L703).
