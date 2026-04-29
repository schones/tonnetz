# AudioInterpreter — design doc

Status: design draft, pre-implementation.
Lives at: `static/shared/audio-interpreter.js` (planned).
Related docs: `docs/cantor-design.md`, `docs/beat-field-design.md`,
`docs/audio-analysis-orchestration.md` (read-only audit).

## 1. Concept

AudioInterpreter is the module that translates raw audio analysis
primitives — onset detection, pitch detection, chord detection — into
discrete musical events on `MusicalEventStream`. It is the audio-side
counterpart to MIDIInput: where MIDIInput publishes `noteAttack`,
`noteRelease`, and channel-mapped events from MIDI, AudioInterpreter
publishes the same event vocabulary derived from audio.

It is *not* a new analysis algorithm. It is an interpretation layer
that wraps the existing primitive detectors (`onset-detection.js`,
`pitch-detection.js`, `chord-detection.js`) and produces events whose
shape and semantics are identical regardless of input modality. With
AudioInterpreter in place, the consumers of MusicalEventStream
(CantorView, Beat Field, future melody-related work) read from a
unified stream and don't know or care whether events originated from
MIDI or from audio.

Phase 0 of this work established that chord-detection's overtone-as-
chord misclassification is fixed by gating on onset evidence, not by
replacing chord-detection. AudioInterpreter is the home for that
gating logic — and for several other interpretation decisions that
have been re-implemented per-surface across the platform.

## 2. Design principles

These guide the architecture and resolve ambiguity when specific
decisions could go multiple ways.

1. **The event is the interface.** Producers and consumers don't know
   about each other. AudioInterpreter publishes events; consumers
   subscribe. No surface-specific knowledge crosses the boundary.

2. **Input-agnostic events.** A `noteAttack` from MIDI and a
   `noteAttack` from audio are the same shape, distinguished only by
   a `source` field. Consumers behave identically for both.

3. **Honest about ambiguity.** When a primitive (especially chord-
   detection) emits multiple candidates above confidence threshold,
   the event carries that ambiguity rather than collapsing to a
   single answer. Consumers decide how to render uncertainty.

4. **Reserve expressive bandwidth.** Event types and fields that
   future work will need — `pitchBend`, `noteId` correlation,
   `attackType`, `timbralClass` — exist in the v0 vocabulary even
   when v0 doesn't populate them. Adding fields later is harder than
   reserving them now.

5. **Clean inputs first, degrade gracefully.** The state machine is
   tuned for monophonic and clean polyphonic input. Mixed recordings
   are tolerated but produce unreliable results; this is documented,
   not silently failed on.

6. **Silences are peaceful.** When audio is quiet, AudioInterpreter
   stops publishing. It does not publish "nothing happening" events.
   Consumers handle their own decay/fade behavior.

7. **Single producer per modality.** Audio events come from
   AudioInterpreter; MIDI events come from MIDIInput. There is one
   place to look for "who published this event."

8. **Channels and event types are independent and orthogonal.**
   Adding a new event type later (e.g., `phraseEnd`, `pitchBend`)
   should not require restructuring existing event flow.

9. **Architectural separation between analysis and rendering.** Audio-
   Interpreter knows about pitch, harmony, and percussion. It does
   not know about screen positions, torus geometry, or visual state.
   Strike events carry pitch/spectral content; consumers map to
   screen position using their own geometry.

10. **One shared event stream across producers.** All audio-derived
    musical content flows through one MusicalEventStream. Modality
    splits happen at production time (MIDI vs. audio); they do not
    propagate to consumers.

## 3. Three-subsystem architecture

AudioInterpreter is composed of three concurrent subsystems, all
reading from the same underlying primitives but interpreting them
into different event types. They run in parallel; a single onset
in the audio can produce events from more than one of them.

```
                    onset-detection.js  ──┐
                    pitch-detection.js  ──┼─→ AudioInterpreter
                    chord-detection.js  ──┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                          ▼                     ▼                     ▼
                  pitched-note tracker   chord tracker        percussive-strike
                  (stateful)             (onset-gated)        publisher
                                                              (stateless)
                          │                     │                     │
                          ▼                     ▼                     ▼
                  noteAttack             chordChange           percussiveStrike
                  noteRelease
                                          ↓
                                   MusicalEventStream
                                          ↓
                              (CantorView, Beat Field, ...)
```

### Pitched-note tracker

Watches pitch-detection's continuous output. Tracks one note at a
time (the dominant pitched content). Publishes `noteAttack` when a
new note begins, `noteRelease` when it ends. Has internal state — the
currently sustaining note, if any — and runs the state machine
detailed in Section 5.

In v0, attacks come from the *transient* pathway: an onset has fired
recently and pitch-detection is confident at the same time. The
*emergent* pathway (pitch-detection stabilizes on a new note without
a corresponding onset, e.g., legato singing) is structurally reserved
but not implemented in v0. The `attackType` field on `noteAttack`
distinguishes them; v0 only emits `'transient'`.

### Chord tracker

Watches chord-detection's frame-by-frame output. Publishes
`chordChange` when the dominant chord identity shifts. Carries the
ambiguity information (multiple candidates with confidence weights)
when chord-detection is uncertain.

This is the home of Phase 0's "supplement, not replace" decision.
Chord-detection runs continuously as it does today. The chord tracker
gates *publishing* on recent onset evidence — if no onset has
occurred in the last ~200ms, chord-detection's output is monitored
but not published. This suppresses the overtone-as-chord
misclassification that motivated this whole rebuild: a sustained
single note's overtone series can template-match as a chord, but
without a recent onset cluster there's no event-level evidence that a
chord change occurred.

The chord tracker also owns the silence-watcher behavior currently
duplicated in cantor.html and harmonograph.html (Notable B in the
audit). When the audio has been quiet for a debounce window, the
chord tracker publishes a `chordChange` with `null` chord (or
equivalent "no harmony" event) so consumers can release stuck
highlights.

### Percussive-strike publisher

Stateless. On every onset, computes a percussive strength score from
spectral character (band classification, transient sharpness,
pitched-content amount) and publishes a `percussiveStrike` with that
strength. Pitched and percussive are not mutually exclusive: a guitar
strum produces both a `noteAttack` (or `chordChange`) and a low-
strength `percussiveStrike`; a kick drum produces only a high-
strength `percussiveStrike`.

The strength field is a continuous value, not a boolean. Beat Field's
rendering naturally adapts: low-strength strikes produce barely-
visible ripples, high-strength strikes produce strong ripples. The
single shared field handles superposition.

The publisher does not classify pitched-vs-unpitched; it always
publishes a strike event. The strength score *encodes* how percussive
the event is. Downstream consumers that only want true percussion
(Beat Field's headline behavior) can threshold on strength; consumers
that want every onset (a future tempo tracker) can read all of them.

## 4. Event vocabulary

Events published by AudioInterpreter, with the fields each carries.
Fields marked **reserved** are part of the v0 schema for forward
compatibility but are not populated by v0 logic; they default to
`null` or a sentinel value.

### `noteAttack`

A pitched musical event has begun.

| Field          | Type                      | v0 populated? | Notes |
|----------------|---------------------------|---------------|-------|
| `type`         | `'noteAttack'`            | yes           |       |
| `pitch`        | MIDI note number (int)    | yes           | locked at attack time |
| `velocity`     | 0–1 normalized            | yes           | from onset strength or pitch confidence-weighted energy |
| `timestamp`    | high-precision ms         | yes           | occurrence time, not publish time |
| `source`       | `'audio'` or `'midi'`     | yes           | `'audio'` for AudioInterpreter |
| `noteId`       | unique id (string or int) | yes           | for future release / bend correlation |
| `attackType`   | `'transient'` \| `'emergent'` | yes (v0 always `'transient'`) |  |
| `timbralClass` | `'pitched'` \| `'percussive'` \| `'mixed'` | reserved | v0 always `'pitched'` |
| `confidence`   | 0–1                       | yes           | pitch-detection confidence at attack moment |

### `noteRelease`

A pitched event has ended. v0 publishes from MIDI only; audio-derived
release is v3+.

| Field       | Type                    | v0 populated? | Notes |
|-------------|-------------------------|---------------|-------|
| `type`      | `'noteRelease'`         | yes           |       |
| `noteId`    | matching the noteAttack | yes (MIDI)    | for correlation |
| `pitch`     | MIDI note number        | yes (MIDI)    |       |
| `timestamp` | high-precision ms       | yes (MIDI)    |       |
| `source`    | `'audio'` or `'midi'`   | yes (MIDI)    |       |

### `chordChange`

The active chord has shifted.

| Field          | Type                      | v0 populated? | Notes |
|----------------|---------------------------|---------------|-------|
| `type`         | `'chordChange'`           | yes           |       |
| `root`         | pitch class (int 0–11)    | yes           | `null` for "no harmony" (silence) |
| `quality`      | string (`'maj'`, `'min'`, etc.) | yes     | uses chord-detection's quality keys |
| `pitchClasses` | array of int 0–11         | yes           | the actual notes detected |
| `bass`         | pitch class or `null`     | yes           | preserved from chord-detection (avoids audit Notable E) |
| `confidence`   | 0–1                       | yes           |       |
| `alternatives` | array of `{root, quality, confidence}` | yes | candidates above threshold; `[]` when unambiguous |
| `velocity`     | 0–1 normalized            | yes           | aggregate dynamic at change moment |
| `timestamp`    | high-precision ms         | yes           |       |
| `source`       | `'audio'` or `'midi'`     | yes           |       |

### `percussiveStrike`

A percussive (or percussive-adjacent) onset has occurred.

| Field              | Type                      | v0 populated? | Notes |
|--------------------|---------------------------|---------------|-------|
| `type`             | `'percussiveStrike'`      | yes           |       |
| `strength`         | 0–1                       | yes           | how percussive — composite spectral score |
| `band`             | `'low'` \| `'mid'` \| `'high'` | yes      | spectral band classification |
| `pitch`            | MIDI note (int) or `null` | yes           | `null` for unpitched; populated when concurrent pitch is confident |
| `spectralFeatures` | object (open shape)       | yes           | brightness, centroid, transient sharpness, etc. — Beat Field consumes |
| `timestamp`        | high-precision ms         | yes           |       |
| `source`           | `'audio'` or `'midi'`     | yes           | MIDI drum events translate via GM mapping |

### Reserved event types (v0 vocabulary, not yet emitted)

| Type         | Purpose                                                |
|--------------|--------------------------------------------------------|
| `pitchBend`  | continuous pitch change within a sustained note        |
| `phraseEnd`  | reserved per cantor-design.md for v3 phrase detection  |

These are listed in the schema and consumers can subscribe to them
without errors; v0 simply never publishes them. v1+ work fills them
in.

## 5. Pitched-note state machine

The state machine inside the pitched-note tracker. The only stateful
subsystem in AudioInterpreter; chord tracker and percussive-strike
publisher are effectively stateless (the chord tracker's "recent
onset" gate is a small ring buffer, not state per se).

### States

- **Silent** — no note is currently being tracked. Pitch-detection
  may be emitting readings, but they are not confident enough to lock
  onto.
- **Sustaining** — a note is locked. The tracker holds the note's
  pitch, noteId, and start time. Pitch-detection's continuous output
  is monitored but does not modify the locked pitch unless the change
  is large enough to trigger a transition.

### Transitions

#### Silent → Sustaining (transient)

Trigger: an onset fires AND pitch-detection becomes confident within
the deferred-classification window (~30–50ms).

Action:
- Assign new `noteId`.
- Lock pitch at pitch-detection's reading.
- Publish `noteAttack` with `attackType: 'transient'`, the locked
  pitch, velocity from onset strength, timestamp from onset
  occurrence time.

#### Silent → Sustaining (emergent) — *v3+, reserved*

Trigger: pitch-detection becomes confident and stays stable for the
emergence-debounce window (~150ms) without a corresponding onset.

Action: same as transient, but `attackType: 'emergent'` and timestamp
is the moment pitch-detection first crossed the confidence threshold.

In v0 this transition does not fire; sustained singing without a
clean attack will not produce a `noteAttack` event. Documented v0
limitation.

#### Sustaining → Sustaining (same note, pitch fluctuation ignored)

Trigger: pitch-detection's reading shifts by less than the same-note
threshold (~100 cents / one semitone) from the locked pitch.

Action: none. The locked pitch stays as-is. Vibrato and small bends
are absorbed.

#### Sustaining → Sustaining (note change, transient)

Trigger: pitch-detection's reading shifts by ≥ same-note threshold
AND an onset fires concurrently.

Action:
- Publish `noteRelease(currentNoteId)`.
- Assign new `noteId`.
- Lock pitch at the new reading.
- Publish `noteAttack` with `attackType: 'transient'`.

These two events are published atomically (same frame).

#### Sustaining → Sustaining (note change, no onset)

Trigger: pitch-detection's reading shifts by ≥ same-note threshold,
holds the new pitch for the pitch-shift-debounce window (~80ms), and
no onset fires.

Action: same as transient note change, but `attackType: 'emergent'`
on the new noteAttack. *V0: this transition does not fire (emergent
pathway not implemented).*

In v3+ this is the legato-pitched-change case. v0 either keeps the
old note locked (if pitch-detection's confidence stays on the old
pitch) or transitions to Silent (if confidence drops during the
shift) and waits for a fresh transient attack to start a new note.

#### Sustaining → Silent

Trigger: pitch-detection's confidence drops below threshold for the
release-debounce window (~150ms; longer than attack debounce, since
release is perceptually slower).

Action: publish `noteRelease(currentNoteId)`.

### Debouncing summary

| Window                       | Approximate value | Purpose |
|------------------------------|-------------------|---------|
| Deferred-classification      | 30–50 ms          | wait for pitch-detection to catch up to an onset before classifying |
| Pitch-shift debounce         | 80 ms             | absorb brief pitch flicker mid-note |
| Release debounce             | 150 ms            | absorb brief confidence dropouts before declaring release |
| Emergence debounce (v3+)     | 150 ms            | how long a stable pitch must hold before emergent attack fires |

All values are starting estimates. Calibration against test corpus
during build.

## 6. Percussive strength continuum and dual classification

The percussive-strike publisher fires on every onset. The classification
isn't pitched-vs-percussive — it's a strength score on a continuum.

### Strength composition

`strength` is a composite score derived from:

- **Pitched-ness** of the spectral content at the onset moment
  (inverse: more harmonic structure → lower percussive strength).
- **Transient sharpness** (faster attack envelope → higher strength).
- **Spectral flatness** at onset (flatter spectrum → more noise-like
  → higher strength).
- **Band-energy distribution** (energy concentrated in low band → kick-
  like; high band → cymbal/hat-like; mid band → snare-/clap-like).

The exact scoring function is calibration-driven (Section 9). The
event carries the composite as `strength` and the underlying features
as `spectralFeatures` for consumers that want richer access.

### Dual classification examples

| Audio event           | noteAttack? | percussiveStrike strength | chordChange? |
|-----------------------|-------------|---------------------------|--------------|
| Kick drum hit         | no          | high (~0.9)               | no           |
| Snare hit             | no          | high (~0.85)              | no           |
| Closed hi-hat         | no          | medium (~0.6)             | no           |
| Sung note (clean)     | yes         | low (~0.1)                | no           |
| Piano single note     | yes         | very low (~0.05)          | no           |
| Strummed chord        | yes (root)  | low–medium (~0.2–0.3)     | yes          |
| Pizzicato string note | yes         | medium (~0.4)             | no           |
| Slap-bass note        | yes         | high (~0.7)               | no           |

Beat Field's rendering thresholds and falloff are tuned so that low-
strength strikes are barely-visible ripples; the visualization
naturally degrades gracefully across the continuum.

### MIDI percussive strikes

MIDI drum input (channel 10, GM standard) is translated to
`percussiveStrike` events by AudioInterpreter (or a small MIDI-side
helper). GM note number → band and pitch via a static table:

- 35–36 (bass drum) → band: low, pitch: corresponding pitch class
- 38, 40 (snare) → band: mid
- 42, 44, 46 (hats) → band: high
- 41, 43, 45, 47, 48, 50 (toms) → band: low/mid by note range
- 49, 51, 55, 57, 59 (cymbals) → band: high

The pitch field is populated for tonal mapping (Beat Field's origin
positioning); strength is derived from MIDI velocity. This keeps the
"single shared event interface" property — MIDI and audio drums flow
through the same downstream code path.

## 7. Chord publishing and onset gating

Chord-detection's chroma+resolver logic runs continuously, as it does
today. It samples FFT, computes chroma, runs template matching, emits
a current best-fit chord on every animation frame. AudioInterpreter
does not change this.

What AudioInterpreter changes is *when chord-detection's output
becomes a published event.*

### Gating rule

The chord tracker maintains a small ring buffer of recent onset
timestamps. On each chord-detection frame:

- If chord-detection's current best-fit differs from the last
  published chord, AND there has been an onset within the last
  ~200ms, publish `chordChange` with the new chord.
- If the change is more than ~500ms after the last onset (sustained
  ringing chord that's drifting in chord-detection's output, likely
  due to overtone artifacts), do not publish.
- If the audio has been quiet (silence-watcher condition) for the
  silence-debounce window, publish a `chordChange` with `root: null`
  to signal "no harmony" so consumers can release highlights.

### What this fixes

The motivating bug from Phase 0: a sustained single note's overtone
series template-matches as a chord. With the gate, that
misclassification stays inside chord-detection's frame-by-frame
output but never reaches the event stream. The chroma matcher is
correct given an onset cluster; gating publishing on onset evidence
preserves that correctness.

### What this preserves

Cantor's existing chord display, Harmonograph's chord rendering
(post-migration, when/if it migrates), and any future chord-aware
consumer. The published `chordChange` event carries everything
chord-detection knows (root, quality, pitchClasses, bass, confidence,
alternatives) — Notable E in the audit (input-provider drops `bass`
and `pitchClasses`) is explicitly fixed by the schema in Section 4.

### Onset-gating window calibration

The 200ms / 500ms values are starting estimates. Calibration:

- Too short → real chord changes during legato comping are missed.
- Too long → overtone-driven phantom chords leak through.
- May need to be tempo-adaptive in v3+ (faster tempo → shorter window).

## 8. Lifecycle and relationship to per-surface wiring

The audit (`audio-analysis-orchestration.md`) found that each
always-on surface (Cantor, Harmonograph) re-implements analyser
hookup, sourceQuality detection, detector start/stop, and a near-
identical silence watcher. AudioInterpreter is the consolidation
point.

### What AudioInterpreter owns

- Resolution of the shared `Tone.Analyser` from
  `KeyboardView.getAnalyser()`.
- Resolution of `sourceQuality` from `AudioInput.getSourceQuality()`,
  defaulting to `'mic'`.
- Instantiation and lifecycle (start/stop) of the three primitive
  detectors: `onset-detection.js`, `pitch-detection.js`,
  `chord-detection.js`.
- The silence-watcher equivalent (today duplicated in
  cantor.html:543-563 and harmonograph.html:888-906).
- Device-change handling — when AudioInput's active device changes,
  AudioInterpreter rewires its detectors automatically.
- Publishing the events in Section 4 to MusicalEventStream.

### What surfaces own (post-migration)

- UI: dropdowns, status text, split-point overlay (Cantor), etc.
- AudioInput device management: dropdown change handlers,
  permission flow, device list population.
- HarmonyState updates from the surface's perspective.
- Any surface-specific event subscriptions (CantorView subscribes to
  `noteAttack` and `chordChange`; Beat Field subscribes to
  `percussiveStrike`).

### Lifecycle pattern

AudioInterpreter exposes a small interface — start, stop, setAnalyser,
isRunning. Surfaces call:

- `start()` when audio analysis should be running.
- `stop()` when it shouldn't.
- `setAnalyser(analyser)` if the analyser source changes (rare; today
  always KeyboardView's singleton).

The reconciler-style pattern from Harmonograph
(`_updateAudioInputStatus`) becomes the recommended way for surfaces
to call `start()`/`stop()`. AudioInterpreter does not subscribe to
AudioInput events itself — it's a passive consumer of whatever
analyser it's been handed and whatever lifecycle calls the surface
makes. This keeps the surface in control of "when should analysis be
running" while moving "how analysis runs" into AudioInterpreter.

### Notable A's resolution

The audit flagged that Cantor's chord-detection isn't started from
`_initAudioInput` — only from MIDI note-on or device-change. After
migration, Cantor's `_initAudioInput` calls AudioInterpreter via the
reconciler pattern at init time, so the saved-device auto-restore
case starts analysis without requiring a user gesture. The wart is
fixed by virtue of moving Cantor onto the consolidated lifecycle.

### Harmonograph

Out of scope for migration in this design. Harmonograph has its own
working pattern (the reconciler at `_updateAudioInputStatus`) and
isn't a Cantor consumer. A future Harmonograph migration would
collapse its in-template detector wiring onto AudioInterpreter the
same way Cantor's does, and would resolve the silence-watcher
duplication entirely. Tracked as a follow-up; not blocked by
AudioInterpreter v0.

## 9. Tuning surface

Parameters whose values are calibration-driven, not pre-decided.
Implementation exposes them as configurable values; build-phase
calibration sets defaults against the test corpus (cantor-design.md
Section 9).

### Pitched-note tracker
- Same-note pitch threshold (cents). Starting value: 100 (one semitone).
- Pitch-shift debounce window (ms). Starting value: 80.
- Release debounce window (ms). Starting value: 150.
- Pitch-detection confidence threshold for "confident". Inherits from
  pitch-detection.js's existing confidence model.

### Chord tracker
- Onset-gating window (ms): how recent an onset must be to permit a
  chord publish. Starting value: 200.
- Sustained-chord-drift suppression window (ms). Starting value: 500.
- Silence debounce for "no harmony" event (ms). Starting value: 500.
- Confidence threshold for ambiguity vs. unambiguous. Starting
  value: TBD; inherits from chord-detection.js's `minConfidence`
  option.

### Percussive-strike publisher
- Strength composition function: relative weights of pitched-ness,
  transient sharpness, spectral flatness, band distribution.
  Starting values: TBD against test corpus including isolated drum
  hits, sung notes, piano notes, strummed chords.
- Band classification thresholds: where low/mid/high split. Starting
  values inherited from typical drum-frequency conventions (low
  <200Hz, mid 200–2000Hz, high >2000Hz) but tunable.

### Deferred-classification window
- Starting value: 40 ms. Latency added to all attack events.

### MIDI drum mapping
- GM-standard table (Section 6). Static; not tunable, but
  user-overridable in v3+.

## 10. Deferred features

Reserved in the architecture and event vocabulary; not implemented
in v0.

### Emergent attacks (sustained singing, bowed strings, etc.)

The pitched-note tracker's "Silent → Sustaining (emergent)" and
"Sustaining → Sustaining (no onset note change)" transitions. v0
limitation: sung legato lines and other gradual-onset pitched events
will not light up the constellation in CantorView's audio mode.
Documented limitation. Lands in v3+ alongside continuous pitch
tracking refinements.

### Audio-derived noteRelease

v0 publishes `noteRelease` from MIDI only. Audio-derived release
detection (energy decay + pitch confidence drop) is hard to do
robustly and the v0 consumers (CantorView, Beat Field) don't
depend on it. v3+ work, paired with note duration and phrase
detection.

### pitchBend

Continuous pitch change within a sustained note. v0 ignores within-
semitone pitch fluctuation (vibrato is absorbed into the locked
pitch); v0 truncates blues bends and slides (the bend doesn't
visualize, but the note stays one note — degraded gracefully). v3+
adds a `pitchBend { noteId, newPitch, timestamp }` event that
modifies a sustained note's pitch over time, enabling Tonnetz nodes
to *move* during bends.

### Finer timbral classification

`timbralClass` field reserves space for future expansion beyond
`'pitched' | 'percussive' | 'mixed'` — instrument identity, attack
character, etc. Not in v0 scope.

### Tempo / beat / phrase detection

Consumer-side derivations from `noteAttack` and `percussiveStrike`
streams. Not AudioInterpreter's job. `phraseEnd` event type is
reserved for when phrase detection lands as a consumer-side
subscriber that publishes back to the stream (or via a separate
stream).

### Adaptive tuning

All tuning parameters in Section 9 are static in v0. v3+ may make
some adaptive (e.g., onset-gating window scales with detected tempo).

## 11. Open questions

These are deliberately unresolved. Address during build or after v0
testing.

1. **MIDI publishing path during migration.** Today MIDIInput's
   note-on/note-off handlers publish directly to MusicalEventStream
   from inside cantor.html's template (lines 411-475). Two options:
   (a) MIDI publishing stays in the template, AudioInterpreter only
   handles audio; (b) MIDI publishing moves into AudioInterpreter
   (or a paired MIDIInterpreter), making AudioInterpreter / its
   sibling the single publisher. Option (a) is a smaller migration;
   option (b) is architecturally cleaner. Decide during the Cantor
   migration audit.

2. **Strength as scalar vs. feature vector.** Section 4 has
   `strength` as a single 0–1 scalar plus `spectralFeatures` as an
   open object. Is the scalar enough, or should the structured
   features (band, brightness, transient sharpness) be separate
   first-class fields? Beat Field cares about band specifically;
   other consumers may not. Resolve during build phase against
   real Beat Field needs.

3. **Onset-gating window adaptive vs. fixed.** The 200ms publishing
   window is fixed in v0. Should it adapt to detected tempo (e.g.,
   shorter at fast tempo)? Defer to post-v0 testing — the fixed
   value may be fine for the cantor-design test corpus.

4. **Inspection / debug API.** Should AudioInterpreter expose its
   current state (current locked pitch, recent onset count, etc.)
   for debugging consoles, or stay purely event-publishing? Debug
   inspection is useful during build; whether it's part of the
   shipping API is a later decision.

5. **noteId scheme.** Strings, integers, monotonic counter, UUID?
   Implementation detail; just needs to be unique within a session.
   Decide during build.

6. **Cross-surface AudioInterpreter sharing.** If both Cantor and a
   future migrated Harmonograph want to use AudioInterpreter on the
   same page (they don't today, but could), is it one shared
   instance or per-surface? Probably shared (it's reading from
   KeyboardView's singleton analyser anyway), but worth confirming.

7. **Testing strategy.** AudioInterpreter is harder to unit-test
   than the primitives it wraps because of its state machine and
   timing dependencies. Likely needs a small fixture corpus
   (recorded audio clips with known expected event sequences) more
   than traditional unit tests. Out of scope for design doc; address
   in build phase.

## 12. Cantor migration implications (high-level)

Detailed migration plan lives in `docs/cantor-migration-audit.md`
(planned, next session). High-level summary:

### Code that goes away in cantor.html

- `_chordDetector` module-scoped state (lines 486-489).
- `_startChordDetection` / `_stopChordDetection` (507-585).
- The silence watcher (543-563).
- `CHORD_TYPE_MAP` (494-505) — moves into AudioInterpreter or its
  helper since it's a chord-detection-output-to-transforms-key map.
- `_lastChordPushed` de-dupe state.
- Chord-detection start triggers in MIDI note-on (455-457) and
  device-change handler (835-839).

### Code that stays

- Keyboard click → MusicalEventStream publishers (322-338).
- MIDI note-on/note-off → MusicalEventStream publishers (438-468) —
  unless Open Question 1 resolves toward moving MIDI publishing into
  AudioInterpreter, in which case these also move.
- All UI: dropdowns, status text, split-point overlay (when added),
  audio device management.
- HarmonyState updates triggered by stream events.

### New wiring shape

Cantor's `_initAudioInput` post-migration is approximately:
- Initialize AudioInput, populate dropdown.
- Hand AudioInterpreter the analyser via `setAnalyser`.
- Call AudioInterpreter's start/stop via the reconciler pattern
  (modeled on Harmonograph's `_updateAudioInputStatus`).
- Subscribe cantor-view to `noteAttack`, `chordChange`, and
  `percussiveStrike` (the last for Beat Field, when it lands).

Specific call-site reorganization, behavioral acceptance criteria,
risk register, and phasing — covered in the migration audit.

### Risk register (high-level)

- Field-preservation: AudioInterpreter's `chordChange` must carry
  `bass` and `pitchClasses` (audit Notable E flagged
  input-provider's reshape drops these). Schema in Section 4
  handles this; build must implement faithfully.
- Behavioral parity: post-migration Cantor must behave identically
  to pre-migration on the existing test corpus, plus fix Notable A's
  saved-device case. Acceptance criteria belong in the migration
  audit, not here.
- File-scope rules: `harmony-state.js`, `audio-input.js`,
  `keyboard-view.js`, `chord-detection.js`, `musical-event-stream.js`
  are off-limits without explicit lift per WORKING_STYLE.md. The
  migration should not need lift on any of these — AudioInterpreter
  is a new file, and it consumes the others through their existing
  public surfaces. Confirm during the migration audit.

### Phasing

Migration is naturally two phases:

- **Migration phase 1:** AudioInterpreter v0 exists, Cantor uses it
  for chord publishing only. MIDI publishing path unchanged. Behavior
  identical to today plus saved-device fix. Smallest possible
  behavioral footprint.
- **Migration phase 2:** AudioInterpreter (or paired MIDIInterpreter)
  becomes the single publisher for both audio and MIDI events.
  Cantor's template is just a view + UI shell. Bigger behavioral
  footprint, separate acceptance pass.

Phase 2 depends on Open Question 1's resolution.

### Beat Field readiness

After AudioInterpreter v0 ships, Beat Field's prerequisite ("onset-
driven analysis interface specified") is satisfied. Beat Field
implementation can begin in parallel with or after the Cantor
migration. The strike-event interface is the `percussiveStrike`
event in Section 4; Beat Field updates its design doc to reference
this schema rather than defining its own input pipeline (planned
edit, deferred until this design is finalized).
