# Cantor Migration Audit — AudioInterpreter v0

Scope: the transition plan for migrating Cantor — and, at compressed
depth, the other current consumers of the audio-analysis stack —
onto `static/shared/audio-interpreter.js`. This audit is read-only;
no source files were modified during the pass.

Companion documents:

- `docs/audio-interpreter-design.md` — the spec being migrated TO.
- `docs/audio-analysis-orchestration.md` — read-only audit of the
  existing-state side, with all claims pinned `file:line`.
- `static/shared/audio-interpreter.js` — what actually got built.

Where the orchestration audit pins a claim by `file:line`, this audit
re-cites the underlying source directly so readers don't have to
chase through two documents.

---

## 1. Scope and ground rules

### What this audit covers

Two consumers, at different depths:

- **Cantor.** Deepest treatment. The named deliverable. Phase 1 is
  fully specified; phase 2 is sketched under both branches of
  Open Question 1 (MIDI publishing path).
- **Every other current consumer of the old audio-analysis stack.**
  Each at compressed depth, in a first-class section: Harmonograph,
  Melody, SkratchLab audio-bridge, input-provider, and Polyrhythm
  (the only input-provider downstream).

For each consumer, the audit produces enough detail that a future
Claude Code prompt can be carved out of one or two of its sections.

### What this audit is not

- It does not change source. The only file written is this one.
- It does not decide either of the two open questions in scope
  (OQ1: MIDI publishing path; OQ9: `window.AudioInput` runtime
  coupling). Both are presented as recommend-but-not-decide
  (Section 6). The user makes the final call.
- It does not replace the orchestration audit's existing-state
  description. It builds on it.
- It does not address Beat Field implementation, chord-detection
  top-N candidates, adaptive tuning, the Cantor 3D-math refactor,
  or post-v0 AudioInterpreter feature work (Section 9).

### Phase 1 vs phase 2 framing for Cantor

Migration is two phases by construction (design doc §12):

- **Phase 1.** AudioInterpreter v0 owns audio-derived chord
  publishing for Cantor. MIDI publishing in `templates/cantor.html`
  is unchanged. Smallest behavioral footprint, plus the
  saved-device fix from orchestration-audit Notable A.
- **Phase 2.** Depends on OQ1's resolution; sketched in both
  branches in Section 4.

### Verification policy applied

The orchestration audit's claims are taken as ground truth for the
existing-state side. The four spot-check enumerations specified in
the brief were re-run against today's tree:

- Importers of `static/shared/chord-detection.js`: same 4 hits as
  the orchestration audit, plus `audio-interpreter.js:35` (new and
  expected). One incidental match in
  `templates/harmonograph.html:829` is a comment, not an import.
- Importers of `static/shared/pitch-detection.js`: same 4 hits as
  the orchestration audit, plus `audio-interpreter.js:36` (new).
  `templates/harmony.html:767, :774` are doc-comment migration
  notes, not real imports — `harmony.html` is not a current
  pitch-detection consumer.
- Importers of `static/shared/onset-detection.js`: same 1 hit
  (`input-provider.js:27`) plus `audio-interpreter.js:34` (new).
- `MusicalEventStream.publish` call sites: same 5 sites
  (`templates/cantor.html:322, :333, :438, :464`,
  `static/shared/cantor-view.js:743`).

No drift since the orchestration audit was committed.

The AudioInterpreter side was verified by reading
`static/shared/audio-interpreter.js` directly; Section 2
characterizes the actual public surface.

---

## 2. AudioInterpreter v0 public surface

This section is grounded in `static/shared/audio-interpreter.js`,
not in the design doc. Where the implementation differs from or
extends the spec, this section describes what shipped.

### 2.1 Factory

- Default export: `createAudioInterpreter`
  (`audio-interpreter.js:903`). Same name from the named export at
  `audio-interpreter.js:241`.
- Signature: `createAudioInterpreter(options) → AudioInterpreter`.
- Options shape (`audio-interpreter.js:216-219`):
  - `analyser` — required. Throws
    `'audio-interpreter: analyser is required'` if missing or if
    `options` itself is falsy (`audio-interpreter.js:242-244`).
  - `sourceQuality` — optional, defaults to `'mic'`
    (`audio-interpreter.js:247`). Forwarded to onset and chord
    detectors at start time.
- Throws on construction only for missing analyser. Detector
  construction failures inside `start()` are caught and warned
  (e.g. pitch detector wraps create+start in try/catch at
  `audio-interpreter.js:766-784`).

### 2.2 Lifecycle methods

- `start()` (`audio-interpreter.js:832-836`) — instantiates and
  starts onset, chord, and pitch detectors, then starts the
  silence watcher. Idempotent: returns early if already running
  via the `running` flag (`audio-interpreter.js:833`).
- `stop()` (`audio-interpreter.js:839-843`) — stops all three
  detectors and the silence watcher, then resets transient state
  (timers, locked pitch, ring buffer, last-published chord key)
  at `audio-interpreter.js:807-822`. Idempotent: returns early if
  not running (`audio-interpreter.js:840`).
- `setAnalyser(newAnalyser)` (`audio-interpreter.js:851-859`) —
  hot-swap. If running, calls `stopSubsystems()` then
  `startSubsystems()` against the new analyser; if stopped, just
  updates the stored reference. Throws on falsy argument.
  Implication: a mid-run swap fully tears down and rebuilds the
  three detectors. Useful to know — it means setAnalyser is not
  a cheap operation.
- `isRunning()` (`audio-interpreter.js:861-863`) — boolean.

### 2.3 Debug / inspection API

Open Question 4 in the design doc is resolved in code: the debug
API is part of the shipped surface, not just a build aid.

- `setDebug(on)` / `isDebug()`
  (`audio-interpreter.js:865-871`) — toggles
  `console.log('[AudioInterpreter]', …)` output for significant
  transitions: noteAttack, noteRelease, chord publishes, chord
  suppressions, start/stop. The debug log calls are sprinkled
  through the file (e.g. `audio-interpreter.js:364, 383, 569,
  613, 788, 823`).
- `getState()` (`audio-interpreter.js:877-890`) — snapshot:
  `{ running, pitchedState, lockedPitch, lockedNoteId,
  pendingOnset, lastConfidentPitch, pitchCurrentlyConfident,
  recentOnsetCount, lastPublishedChordKey, silenceCounter }`.
  The doc-comment at `audio-interpreter.js:874-876` explicitly
  notes "Not part of any consumer contract — fields may change."

### 2.4 Event vocabulary actually emitted

Three event types are actually published in v0; everything else in
design-doc §4 is reserved schema, not emitted.

- `noteAttack` (`audio-interpreter.js:353-363`) — emitted only by
  the transient pathway (`attackType: 'transient'`,
  `timbralClass: 'pitched'`). The emergent pathway is structurally
  reserved but does not fire (`audio-interpreter.js:351-352`,
  comment).
- `noteRelease` (`audio-interpreter.js:376-385`) — emitted by the
  state machine on sustained loss of pitch confidence (release
  debounce 150 ms). This is *audio-derived* noteRelease via the
  state-machine path. The spec's "audio-derived noteRelease is
  v3+" line in design-doc §10 referred to *richer* energy-decay
  detection; the simple confidence-drop release is part of v0.
- `chordChange` (`audio-interpreter.js:555-568`) — onset-gated;
  carries `bass` and `pitchClasses` (the schema correctly fixes
  Notable E). `alternatives` is always `[]`
  (`audio-interpreter.js:564`).
- `chordChange { root: null }` for silence
  (`audio-interpreter.js:601-612`) — published by the silence
  watcher after 5 quiet samples (~500 ms).
- `percussiveStrike` (`audio-interpreter.js:720-734`) — fires on
  every onset; carries `strength`, `band`, `pitch` (when a recent
  confident pitch reading exists), and a `spectralFeatures`
  object with `flatness`, `pitchedness`, `transientSharpness`,
  `dominantHz`, `rms`.

`pitchBend` and `phraseEnd` are reserved in the spec but not
emitted; consumers can subscribe without errors.

The design-doc field names are preserved; one v0 implementation
choice worth pinning: `noteAttack.velocity` is sourced from onset
strength at the moment of attack (`audio-interpreter.js:356`),
not pitch confidence. This matches §4's note "from onset strength
or pitch confidence-weighted energy."

### 2.5 Window-coupling

Two coupling points to `window`:

- `window.MusicalEventStream` lookup at publish time
  (`audio-interpreter.js:306-307`). The interpreter does not
  import the module; it expects the side-effect global. Consistent
  with `MusicalEventStream`'s self-attaching pattern at
  `static/shared/musical-event-stream.js:25-108`.
- `window.AudioInput?.getStream?.()` lookup at start time
  (`audio-interpreter.js:761-764`) — used to share the existing
  MediaStream with pitch-detection so a second `getUserMedia` is
  avoided. This is the precise coupling Open Question 9 calls
  out; addressed in Section 6.
- `window.__audioInterpreter = api` set at the bottom of the
  factory (`audio-interpreter.js:896-898`). The comment notes
  multiple instances overwrite — there is no known v0 use case
  for two interpreters on one page.

### 2.6 Implementation choices worth flagging for migration

- `noteId` scheme (Open Question 5): monotonic counter prefixed
  with `'audio-'` — `audio-interpreter.js:301-303`. Consumers that
  need to correlate releases to attacks should treat the id as an
  opaque string.
- Pitch detector resilience: create or start failures degrade
  gracefully — onset and chord still run, only the pitched-note
  tracker is affected (`audio-interpreter.js:766-784`).
- The pitched-note tracker's deferred classification has a
  fast-path: if a confident pitch reading is already within
  `PITCH_PROXIMITY_MS` (80 ms) when an onset arrives, classification
  fires immediately rather than waiting for the
  `DEFERRED_CLASSIFICATION_MS` (40 ms) timer
  (`audio-interpreter.js:700-704`).
- Chord publishing dedupes against `lastPublishedChordKey`
  (`audio-interpreter.js:540-542`) using `${root}-${quality}`.
  Cantor's existing dedupe via `_lastChordPushed`
  (`templates/cantor.html:489, :531-532`) is functionally
  identical and goes away post-migration.

---

## 3. Cantor migration — phase 1 transition plan

Phase 1 = AudioInterpreter handles audio-derived chord publishing
only. MIDI publishing path in `templates/cantor.html` is unchanged.

### 3.1 Code that goes away in `templates/cantor.html`

All citations pin to current line numbers in
`templates/cantor.html`.

- `import { create as createChordDetector }` from
  `chord-detection.js` (`cantor.html:286-287`). AudioInterpreter
  imports its own detectors; the template no longer needs this.
- `_chordDetector`, `_silenceWatcherId`, `_silenceCounter`,
  `_lastChordPushed` module-scoped state (`cantor.html:486-489`).
  All four states move into the interpreter.
- `CHORD_TYPE_MAP` (`cantor.html:494-505`). chord-detection's
  `quality` strings → `transforms.js`-style chord-type keys. This
  is consumer-side mapping, not interpretation, so it stays in
  Cantor *somewhere* — but as a small helper next to the new
  `chordChange` subscriber, not inside the chord-detection
  callback. See "What stays" below.
- `_startChordDetection` (`cantor.html:507-564`) — the entire
  function. Replaced by the AudioInterpreter wiring inside
  `_initAudioInput`.
- `_stopChordDetection` (`cantor.html:566-585`) — the entire
  function. Stop semantics move into AudioInterpreter; the
  HarmonyState reset on stop (`cantor.html:578-584`) is preserved
  by Cantor's `chordChange { root: null }` subscriber (the silence
  path now publishes the no-harmony event for free).
- The two implicit start triggers:
  - MIDI note-on auto-start (`cantor.html:455-457`): the
    `if (AudioInput.isActive) _startChordDetection()` block. This
    is exactly Notable A's failure mode — the saved-device case
    never starts chord detection without a MIDI gesture or
    dropdown change. The reconciler in 3.3 fixes this.
  - Device-change handler auto-start (`cantor.html:835, :839`):
    the `_stopChordDetection()` and `_startChordDetection()` calls
    around `selectDevice`. Replaced by the reconciler running on
    every status update.

### 3.2 Code that stays

- Keyboard click → MusicalEventStream publishers
  (`cantor.html:319-339`). Unchanged in phase 1; OQ1 branch (b)
  may revisit (Section 4.2).
- MIDI note-on / note-off → MusicalEventStream publishers
  (`cantor.html:435-475`). Unchanged in phase 1. The
  `if (AudioInput.isActive) _startChordDetection()` line 455-457
  is removed (see above), and the rest of the MIDI handler is
  untouched.
- All UI: dropdowns (`cantor.html:741-786`, `:811-814`), status
  text (`cantor.html:774-785`), the Hardware row, the split-point
  overlay (`cantor.html:594-738`).
- `AudioInput.init()` and dropdown population
  (`cantor.html:794-806, :811-814`).
- `CantorView` consumption of HarmonyState — unchanged. Cantor
  still subscribes to MusicalEventStream for `noteAttack` (today
  via `static/shared/cantor-view.js:311, :667`); it adds a
  `chordChange` subscriber that drives `HarmonyState.highlightChord`
  via the same `CHORD_TYPE_MAP`.

### 3.3 New wiring shape

`_initAudioInput` post-migration is approximately (sketch, not
final code):

1. `AudioInput.init()` and populate the dropdown — unchanged.
2. Construct AudioInterpreter once: `const interpreter =
   createAudioInterpreter({ analyser: KeyboardView.getAnalyser(),
   sourceQuality: AudioInput.getSourceQuality() ?? 'mic' });`.
3. Add a top-of-module `chordChange` subscriber on
   `MusicalEventStream` that:
   - On `root: null` events, calls `HarmonyState.update({
     activeTriads: [], activeChord: null, activeNotes: [] })`
     (replacing the manual reset in the removed
     `_stopChordDetection` body, `cantor.html:578-584`).
   - On non-null events, looks `quality` up in the (relocated)
     `CHORD_TYPE_MAP`; on hit, calls
     `HarmonyState.highlightChord(rootName, type, 'primary')`.
     The interpreter delivers `root` as a pitch class integer
     (`audio-interpreter.js:537, :557`); Cantor needs the root
     *name* for `highlightChord`, so the subscriber converts via
     `NOTE_NAMES[event.root]` (already imported at
     `cantor.html:284`).
4. Replace the device-change handler's manual start/stop with a
   reconciler call. New helper, modeled on
   `templates/harmonograph.html:797-813`:

   ```
   function _reconcileAudioInterpreter() {
     const toneRunning = window.Tone && window.Tone.context
       && window.Tone.context.state === 'running';
     const should = AudioInput.isActive && toneRunning;
     if (should && !interpreter.isRunning()) interpreter.start();
     else if (!should && interpreter.isRunning()) interpreter.stop();
   }
   ```

   This is called from `_updateAudioInputStatus` (today purely UI
   at `cantor.html:774-785`) so every status update — init,
   device change, device list change, the saved-device restore
   path — converges chord detection state to "running iff audio
   is live."

   Small wrinkle: `_updateAudioInputStatus` runs before
   `Tone.start()` has been awaited. Harmonograph handles the same
   case by re-reconciling after `_ensureToneStarted()` completes
   (`templates/harmonograph.html:822-824`). Cantor's reconciler
   should call out from the same places harmonograph's does:
   `_initAudioInput` (after init), `AudioInput.onDeviceChange`,
   the dropdown `change` handler post-`selectDevice`, and after
   any `Tone.start()` resolves. Saved-device restore must hit at
   least one of these.

### 3.4 Behavioral acceptance criteria

Each criterion names the trigger, the expected observable, the
pre-migration code path, and the post-migration code path.

1. **MIDI-only flow lights up the wash.**
   Trigger: user plays a MIDI note while no audio device is
   selected.
   Observable: `HarmonyState.activeTriads` updates as the sampler
   produces audio that the analyser picks up.
   Pre: `cantor.html:435-460` MIDI note-on handler →
   `_startChordDetection()` at `cantor.html:455-457` →
   `_chordDetector.start(...)` → `HarmonyState.highlightChord`.
   Post: MIDI note-on handler unchanged (less the auto-start
   block). The reconciler — which fires from
   `_updateAudioInputStatus` — *does not* start the interpreter
   in this flow because `AudioInput.isActive` is false. The
   sampler is still fed into the same shared analyser, but the
   intentional gate at `cantor.html:453-457` (the original
   comment about "avoid sampler feedback overriding setTriad")
   is preserved by the reconciler's `AudioInput.isActive` clause.
   This means: phase 1's behavior here is *unchanged*, including
   the design choice that MIDI-only mode does not run audio chord
   detection. Manual `setTriad` continues to control the wash.

2. **Audio device selected, user plays into mic — wash tracks
   chord changes.**
   Trigger: user selects a hardware audio device, plays a chord.
   Observable: chord-change events update HarmonyState (same as
   today, plus dedupe and silence handling).
   Pre: dropdown `change` handler at `cantor.html:816-849` →
   `selectDevice` → `_startChordDetection()` at
   `cantor.html:839` → `_chordDetector.start(...)` callback at
   `cantor.html:524-538` → `HarmonyState.highlightChord`.
   Post: dropdown `change` handler retained (less the
   `_startChordDetection` call) →
   `_updateAudioInputStatus()` →
   `_reconcileAudioInterpreter()` → `interpreter.start()` →
   chord detector inside interpreter publishes `chordChange` →
   Cantor's `MusicalEventStream` subscriber → same
   `HarmonyState.highlightChord` call.

3. **Saved-device auto-restore — Notable A fix.**
   Trigger: user reloads the page; AudioInput remembers the
   previously selected device and restores it.
   Observable post-migration: chord detection runs without
   requiring the user to play a MIDI note or re-pick the device.
   Observable pre-migration: chord detection *does not* run
   until the next MIDI note-on or device-change event.
   Pre: `_initAudioInput` at `cantor.html:787-849` calls
   `_stopChordDetection()` at `cantor.html:807` and never starts
   it; the saved-device restore happens inside
   `AudioInput.init()` but no Cantor-side start path responds.
   Post: `_updateAudioInputStatus()` is called from
   `_initAudioInput` (already at `cantor.html:809`), and the
   reconciler picks up the now-active AudioInput state and
   starts the interpreter. **This must be verified after the
   migration** — it is the one place where post-migration
   behavior is *intentionally different* from pre.

4. **Audio device disconnected mid-session — wash clears.**
   Trigger: user picks "None" from the dropdown.
   Observable: silence watcher publishes `chordChange { root:
   null }`; HarmonyState's active triad clears.
   Pre: dropdown handler at `cantor.html:816-823` calls
   `_stopChordDetection()` (which calls `HarmonyState.update`
   with empties at `cantor.html:578-584`).
   Post: dropdown handler calls
   `_reconcileAudioInterpreter()` → `interpreter.stop()`. The
   interpreter's stop tears down everything but does not publish
   a final silence event; Cantor's subscriber must call the
   HarmonyState reset itself when the reconciler stops the
   interpreter (or Cantor's stop path explicitly). Either is
   fine; the path needs one or the other so the wash clears.

5. **Audio goes quiet for ≥500 ms — wash clears (live
   silence-watcher path).**
   Trigger: user is on a hardware device but stops playing.
   Observable: same as criterion 4.
   Pre: silence watcher at `cantor.html:543-563` calls
   `HarmonyState.update` with empties.
   Post: AudioInterpreter's silence watcher
   (`audio-interpreter.js:585-617`) publishes `chordChange {
   root: null }`. Cantor's `chordChange` subscriber detects
   `root === null` and runs the same HarmonyState reset.

6. **Same-chord re-strums don't re-fire.**
   Trigger: user strums the same C-major chord repeatedly.
   Observable: `HarmonyState.highlightChord` is called only on
   change.
   Pre: dedupe at `cantor.html:530-532` via `_lastChordPushed`.
   Post: chord-detection itself dedupes
   (`chord-detection.js:412-413`); the interpreter dedupes
   defensively too (`audio-interpreter.js:540-542`). Cantor's
   subscriber sees only true changes.

7. **`cantor-view.js` `_testSnap` synthetic events still work
   (Notable F).**
   Trigger: dev calls the `_testSnap` helper.
   Observable: the constellation snaps to the synthetic note.
   Pre: `cantor-view.js:743-749` publishes `noteAttack` directly
   on `MusicalEventStream`; `cantor-view.js:311` subscribes and
   `:667` filters to `noteAttack`.
   Post: unchanged. `MusicalEventStream` is still the bus;
   AudioInterpreter is just one more publisher on it. The
   subscriber filters by `event.type`, not by `event.source`.

### 3.5 Edge cases pinned to orchestration-audit Notable findings

- **Notable A — saved-device gap.** Must be FIXED by phase 1.
  Acceptance criterion 3 above is the explicit test.
- **Notable B — silence-watcher duplication.** Resolved
  incidentally: Cantor's local watcher
  (`cantor.html:543-563`) goes away; AudioInterpreter's watcher
  (`audio-interpreter.js:585-617`) takes over. Harmonograph's
  copy still exists post-Cantor migration; it is resolved when
  Harmonograph migrates (Section 7.1).
- **Notable C — harmonograph's flatness gate.** N/A for Cantor;
  Cantor never applied this gate
  (`cantor.html:524-538` shows no flatness check). Flagged in
  Section 7.1 for the harmonograph migration.
- **Notable E — input-provider dropping bass and pitchClasses.**
  Must NOT be reintroduced. AudioInterpreter's `chordChange`
  carries both (`audio-interpreter.js:559-560`). Cantor's
  subscriber must consume them directly from the event, not from
  any shaped/derived form. `cantor-view.js` does not currently
  read these fields from the chord pathway, so the post-migration
  subscriber's behavior matches today; the field-preservation
  matters for future consumers of the same stream (e.g. a
  bass-aware future variant) and for Harmonograph if it migrates
  later.
- **Notable F — `_testSnap` synthetic events.** See criterion 7
  above. Must continue to work; the migration does not change
  the bus.

---

## 4. Cantor migration — phase 2 sketches

Phase 2's content depends on OQ1's resolution. Both branches are
sketched in enough detail that a future Claude Code prompt can be
drafted from the chosen branch without revisiting this audit.

### 4.1 Branch (a): MIDI publishing stays in the template

OQ1 resolves toward "MIDI publishing remains in
`templates/cantor.html`." This is the smaller migration; phase 2
is essentially a close-out.

Work in branch (a):

- Confirm the phase 1 acceptance criteria still hold after a soak
  period.
- Document the architectural divide explicitly: AudioInterpreter
  owns audio → events; the template owns MIDI → events; the
  keyboard click path also owns clicks → events. Three
  publishers, one stream. This becomes a permanent shape.
- Keep this audit's Section 3 as the final reference for "how
  Cantor wires up audio."
- No source changes beyond what phase 1 already did.

Future prompt sketch: "Run the acceptance criteria from
`docs/cantor-migration-audit.md` Section 3.4 against the live
build; flag any drift; close phase 2 in `docs/STATUS.md`." Tiny.

### 4.2 Branch (b): MIDI publishing moves into AudioInterpreter
or a paired MIDIInterpreter

OQ1 resolves toward "AudioInterpreter (or a sibling) becomes the
single publisher for audio AND MIDI events." Bigger migration,
separate acceptance pass.

#### What changes in `templates/cantor.html`

- `MIDIInput.onNoteOn` callback at `cantor.html:435-460`: the
  publish block at `:438-445` moves out. The sampler-trigger
  block at `:446-459` *stays* — that's UI/audio playback,
  unrelated to the event bus. The sampler logic and the
  drum-channel drop at `:437` follow whatever owns the publish.
- `MIDIInput.onNoteOff` callback at `cantor.html:462-474`: the
  publish block at `:464-468` moves out. Sampler release at
  `:470-473` stays.
- The `_initMIDI` IIFE simplifies further: it still awaits
  `MIDIInput.init()` so device labels surface in the console
  log at `cantor.html:417-420`, but the note-on/note-off
  registration becomes the new publisher's job.

#### Two architectural shapes possible

Shape 1 — **MIDIInterpreter as a sibling module.** New file
`static/shared/midi-interpreter.js` that mirrors
`audio-interpreter.js`'s factory shape: `createMIDIInterpreter()`
with `start()`, `stop()`, `isRunning()`, optional debug API.
Internally subscribes to `MIDIInput.onNoteOn` / `onNoteOff` and
publishes the same `noteAttack` / `noteRelease` event shape (with
`source: 'midi'`). Drum-channel drop at `cantor.html:437` becomes
the interpreter's job — or it gets re-interpreted as
`percussiveStrike` events via the GM mapping in design-doc §6.
The MIDI sampler trigger remains in the template because it's
audio playback, not interpretation.

Shape 2 — **MIDI absorbed into AudioInterpreter.**
`createAudioInterpreter` gains an option like `midiInput` and
internally subscribes to it too. Slightly tighter coupling but
fewer files. The naming gets awkward (`audio-interpreter` that
also handles MIDI).

Shape 1 is cleaner — it preserves design principle 7 ("Single
producer per modality") explicitly: AudioInterpreter for audio,
MIDIInterpreter for MIDI, both publish to one bus. Recommended in
Section 6's OQ1 discussion.

#### What changes in `audio-interpreter.js` under shape 1

Nothing. `audio-interpreter.js` does not need to know about MIDI
at all under shape 1. The two interpreters are siblings.

Under shape 2, `audio-interpreter.js` gains a `midiInput` option
and internal handlers; its `start()`/`stop()` lifecycles also
manage the MIDI subscriptions.

#### Keyboard click path — the third producer

The on-screen keyboard's `onNotePlay` / `onNoteRelease` callbacks
at `cantor.html:319-338` publish directly to MusicalEventStream
with `source: 'keyboard'`. That is a third producer today.

In branch (b), the keyboard click path needs its own decision —
the audit flags this but does not resolve it. Three options:

- **Leave it where it is.** Three producers; bus-level uniformity
  is fine. The template orchestrates the keyboard widget anyway,
  so co-locating its publish there is reasonable.
- **Move into KeyboardView.** `static/shared/keyboard-view.js`
  becomes the publisher; the template's `onNotePlay` callback
  goes away. KeyboardView is on the file-scope-restricted list
  (per `docs/WORKING_STYLE.md`); this would need lift.
- **Wrap as a "ClickInterpreter" sibling module.** Symmetric with
  AudioInterpreter and MIDIInterpreter. Probably overkill — the
  click path has no interpretation work, just translation.

Recommended treatment for branch (b): leave the keyboard click
path in the template. The interpreter-per-modality model applies
where there's interpretation; click events have none. Document
this decision in the same place branch (b)'s shape decision
lives.

#### Acceptance criteria deltas from phase 1

Beyond the phase 1 criteria, branch (b) adds:

- **MIDI `noteAttack` and `noteRelease` continue to fire** with
  the same shape (pitch, velocity, source: `'midi'`, channel,
  timestamp). Pre-migration shape pinned at `cantor.html:438-445,
  :464-468`. Post-migration shape published from
  MIDIInterpreter (or AudioInterpreter under shape 2).
- **Drum channel still suppressed.** Pre: `cantor.html:437`. Post:
  same logic in the new publisher.
- **Sampler still triggers from MIDI input.** Pre:
  `cantor.html:446-459, :470-473`. Post: same template-side
  logic, just decoupled from publishing.
- **Order of operations on a single MIDI note-on.** Pre: publish
  → sampler trigger. Post: needs the same order or a documented
  reason to change. The sampler's first triggerAttack drives the
  AudioContext to running; `_reconcileAudioInterpreter()` may
  fire after that and start the interpreter. If publish is moved
  to a sibling that runs synchronously on MIDI, the order is
  preserved.

#### Risk: race between MIDIInterpreter publish and reconciler

A MIDI note-on with audio active should produce one
`noteAttack` (from MIDIInterpreter) and possibly a delayed
`noteAttack` from AudioInterpreter (the sampler's output through
the analyser). These are *different* events with different
sources and different noteIds — that's by design (design doc
principle 2). Cantor-view's subscriber filters by `event.type ===
'noteAttack'` regardless of source today
(`cantor-view.js:667`); behavior under branch (b) is the same.
Nothing to fix; just a property to confirm during acceptance.

---

## 5. Risk register

Risks identified during this pass. Behavioral risks defer to
Section 3.4's acceptance criteria; only structural risks get a
verification step here.

### R1. Field preservation in `chordChange`

What: AudioInterpreter must publish `bass` and `pitchClasses` on
`chordChange`, mirroring chord-detection's output. Where:
`audio-interpreter.js:559-560`. Who's affected: any future
consumer of the chord stream (and Harmonograph if it migrates).
Mitigation: the v0 implementation is correct. No fix needed
unless a future change to `audio-interpreter.js` regresses the
schema.

Verification (structural): a test or assertion in any future
chord-stream consumer should access `event.bass` and
`event.pitchClasses` directly. If consumers reshape on receive,
the next consumer pays the Notable-E tax again.

### R2. Behavioral parity for Cantor

What: post-migration Cantor must behave identically to today on
the existing test corpus, with the one intentional exception of
Notable A's saved-device case. Mitigation: Section 3.4. No
structural verification needed beyond running the criteria.

### R3. File-scope rules

What: `harmony-state.js`, `audio-input.js`, `keyboard-view.js`,
`chord-detection.js`, `musical-event-stream.js` are off-limits
without explicit lift (`docs/WORKING_STYLE.md`). The phase 1
migration touches none of them — it modifies
`templates/cantor.html` (not on the list) and reads from the
public surfaces of the restricted files.

Verification (structural): the migration PR's diff should
contain edits only to:
- `templates/cantor.html` (phase 1)
- And, only if branch (b) is chosen, a new
  `static/shared/midi-interpreter.js`

Branch (b) shape 2 (MIDI absorbed into AudioInterpreter) edits
`audio-interpreter.js`, which is not on the restricted list —
acceptable, but the audit flags shape 1 as cleaner anyway.

### R4. Reconciler-pattern adoption

What: Cantor's phase 1 wiring depends on a reconciler being
called from every state-transition site that affects "should
audio analysis be running." Pre-migration, the implicit start
triggers cover this by accident. Post-migration, if the
reconciler isn't called from the right places, Notable A
re-emerges in a new form (e.g. saved device restored but Tone
not yet running, reconciler never re-fires after Tone.start).

Verification (structural): the post-migration code should call
`_reconcileAudioInterpreter()` from at least the four sites
harmonograph does — `_initAudioInput` after init,
`AudioInput.onDeviceChange`, the dropdown `change` handler
post-`selectDevice`, and after any `Tone.start()` resolves
(`templates/harmonograph.html:797-813, :822-824`).

### R5. Silence-watcher behavioral parity

What: AudioInterpreter's silence watcher publishes a
`chordChange { root: null }` event; Cantor's pre-migration
silence watcher reaches into HarmonyState directly. The new path
adds a publish-then-subscribe hop. Functionally equivalent, but
the subscriber must handle `root === null` correctly to avoid a
"chord stays stuck" regression.

Verification (behavioral): acceptance criterion 5. No structural
check needed; the subscriber is small and easy to inspect.

### R6. CHORD_TYPE_MAP placement

What: `CHORD_TYPE_MAP` (`cantor.html:494-505`) is currently
applied inside the chord-detection callback. Post-migration it
applies inside the `chordChange` subscriber. If a future consumer
of the same stream needs a different mapping (e.g. a different
chord-type vocabulary), the per-consumer mapping pattern is the
right shape. Don't lift the map into AudioInterpreter — it's
consumer-side translation, not interpretation. Flagged here as a
shape decision the migration must respect, not as a bug.

### R7. `MusicalEventStream` not yet attached when interpreter
publishes

What: AudioInterpreter looks up `window.MusicalEventStream` per
publish (`audio-interpreter.js:306-307`). If `start()` is called
before `musical-event-stream.js` has self-attached, publishes
silently no-op. In Cantor's case, the import order
(`cantor.html:282-283` ahead of any `start()` call) makes this
fine, but the reconciler pattern fires from
`_updateAudioInputStatus`, which runs after init — well after
all imports.

Verification (structural): the migration must keep
`MusicalEventStream` imported in `cantor.html` (currently
`cantor.html:282-283`). The compile step will catch if it's
removed accidentally — the existing publishers at `cantor.html:
322, :333, :438, :464` reference it directly.

### R8. Pitch-detection double-acquire

What: `audio-interpreter.js:761-764` looks up
`window.AudioInput?.getStream?.()` to share the existing
MediaStream. If `AudioInput` hasn't been initialized when
`interpreter.start()` runs, the pitch detector falls back to its
own `getUserMedia` (per
`pitch-detection.js:265-399`'s setup). On Cantor, the reconciler
only starts the interpreter when `AudioInput.isActive` is true,
so the stream is always available — but the *initial*
`getStream` lookup happens before the analyser-only flow ever
needs pitch. Edge: if the analyser is connected via Tone but the
mic isn't open, the interpreter still tries to acquire its own
stream.

This is OQ9 in a different costume; addressed in Section 6.
Mitigation: as part of resolving OQ9, decide whether
AudioInterpreter should accept an explicit stream option, or
should delay pitch-detector start until a stream is available.

---

## 6. Open question recommendations

The audit recommends but does not decide. The user makes the
final call.

### 6.1 OQ1 — MIDI publishing path during migration

**Trade-off analysis grounded in the codebase.**

Option (a) — MIDI publishing stays in the template
(`cantor.html:435-475`). Pros:
- Smallest migration. Phase 2 is a close-out.
- Keeps the template's role visible: it's the page-level
  composition root.
- No new files, no new public surface.

Cons:
- Permanently violates design principle 7 ("Single producer per
  modality") in spirit: the *bus* has one producer per modality,
  but those producers are spread across two locations
  (AudioInterpreter for audio, the template's IIFE for MIDI).
- Future migrations of other surfaces that want MIDI publishing
  will copy-paste the template's pattern, exactly the duplication
  this whole rebuild is meant to eliminate.
- Drum-channel drop at `cantor.html:437` and any future MIDI
  filtering / channel mapping live in template scripts forever.

Option (b) — MIDI publishing moves into a paired
MIDIInterpreter (or into AudioInterpreter). Pros:
- One place to look for "where does a MIDI noteAttack come from."
- Drum-channel handling, GM percussion mapping
  (design-doc §6), and any future MIDI work happen in a module
  with the same lifecycle / debug discipline as
  AudioInterpreter.
- Other surfaces (Beat Field, future Harmonograph) inherit MIDI
  publishing for free instead of re-implementing.

Cons:
- Bigger migration. Phase 2 is a real piece of work, with its
  own acceptance pass.
- Adds a new module to the shared layer.
- Sampler-trigger logic stays in templates; the split between
  "publish event" and "play sound" becomes explicit (and is
  arguably the right split anyway).

**Recommendation.** Option (b), shape 1 (separate
MIDIInterpreter module). Reasoning:

- The orchestration audit's Notable B (silence-watcher
  duplication) and Notable A (Cantor's implicit start triggers)
  are exactly the kind of drift that happens when interpretation
  logic spreads across templates. Keeping MIDI out of that
  pattern from the start means the next surface (Beat Field, or
  a Harmonograph migration) doesn't have to fight the same
  battles.
- Shape 1 (sibling module) is cleaner than shape 2 (absorbing
  MIDI into AudioInterpreter): the naming is honest, the test
  surface is independent, and the lifecycles are decoupled.
- The work is small relative to phase 1: MIDIInterpreter is a
  shallow wrapper around `MIDIInput.onNoteOn` / `onNoteOff` plus
  the drum-channel drop and the publish call. It does not have a
  state machine or onset gate.

The audit recommends but does not decide. The user can defer
phase 2 indefinitely under option (a) without losing the phase 1
benefits. No decision is required to ship phase 1.

### 6.2 OQ9 — `window.AudioInput` runtime coupling

**Trade-off analysis grounded in the codebase.**

The coupling: `audio-interpreter.js:761-764` reads
`window.AudioInput?.getStream?.()` at start time. This is the
same pattern Notable D in the orchestration audit flagged
(`harmonograph-view.js:886` reads `window.MIDIInput`).
ES-module-import alternatives exist for both modules — Cantor
imports `AudioInput` via the module path at
`cantor.html:274-275`.

Option (a) — clean up by passing AudioInput (or a stream) as an
explicit factory option.

Pros:
- Removes the `window` dependency. Tests can construct an
  interpreter with a mock stream.
- Consistent with the rest of the shared layer (audio-input.js,
  midi-input.js, chord-detection.js, etc., all use ES-module
  imports).
- Makes the interpreter's contract explicit — no hidden
  side-channel.

Cons:
- Changes the factory signature: every caller (today only
  Cantor's phase 1 wiring; tomorrow harmonograph migration, beat
  field, etc.) has to plumb an extra option.
- The fallback to `pitch-detection.js`'s own `getUserMedia` would
  need an explicit "no stream" path too, otherwise mic-only
  consumers regress.
- Slightly contradicts design-doc §8's "passive consumer of
  whatever analyser it's been handed" model — now there's a
  second injected dependency.

Option (b) — accept the precedent.

Pros:
- Matches harmonograph's pattern (the existing surface that
  audio-interpreter is partly modeled on).
- No changes to the v0 surface.
- The `window` lookup is defensive (`?.getStream?.()`) — already
  handles "AudioInput not present."

Cons:
- One more place that grew a `window.AudioInput` reader. The
  "audio-input.js attaches itself to window" pattern stays
  load-bearing.
- Notable D's discomfort persists.

**Recommendation.** Option (b) for phase 1, with option (a)
flagged as the right cleanup once any second consumer (Beat
Field or harmonograph migration) lands. Reasoning:

- Phase 1's behavioral footprint should be minimized. Adding a
  required `audioInput` option to the factory ripples through
  testing and the wiring sketch in Section 3.3 unnecessarily.
- The cleanup belongs in the same change that adds the second
  consumer — at that point the explicit injection has a real
  payoff (e.g. injecting different stream sources for different
  surfaces, if that ever matters), and the migration is one
  module's worth of plumbing instead of two.
- The `window.AudioInput.getStream()` lookup is already
  defensive; phase 1 doesn't pay a correctness tax for keeping
  it.

The audit recommends but does not decide. The user can override
this and require the cleanup as part of phase 1; that's a single
factory-option addition plus updated wiring in Section 3.3.

---

## 7. Non-Cantor consumer sections

Each consumer at compressed depth. Cite the orchestration audit
where its claims still hold; re-cite source `file:line` where the
migration sketch needs it directly.

### 7.1 Harmonograph

#### Current wiring

- Imports both `chord-detection.js` and `pitch-detection.js`
  in-template (`templates/harmonograph.html:484, :486`; orchestration
  audit §1 cites `:483-486`).
- Reconciles start/stop in `_updateAudioInputStatus`
  (`templates/harmonograph.html:797-813`; orchestration audit
  Notable A cites the same range). This is the pattern Cantor
  adopts post-migration.
- Maintains its own silence watcher
  (`templates/harmonograph.html:888-906`; orchestration audit
  Notable B). Near-identical to Cantor's.
- Applies a flatness gate inside the chord-detection callback
  using `PitchDetection.getCurrentFlatness() > 0.4`
  (`templates/harmonograph.html:867-879`; orchestration audit
  Notable C). Cross-detector coupling — chord detection silently
  depends on pitch detection running.
- Does not use onset detection
  (orchestration audit §2; harmonograph drives its onset density
  from MIDI, not audio).
- `harmonograph-view.js:886` reads `window.MIDIInput` at runtime
  (Notable D). Not on the migration's critical path but worth
  pinning.

#### What changes under AudioInterpreter

- `_chordDetector` and `_pitchDetector` instances and their
  start/stop functions all collapse into a single
  AudioInterpreter instance.
- The silence watcher (`harmonograph.html:888-906`) goes away —
  resolves Notable B fully once both surfaces have migrated.
- The flatness gate (`harmonograph.html:867-879`) is the
  interesting case. AudioInterpreter does NOT replicate this
  gate today (`audio-interpreter.js` has no `getCurrentFlatness`
  consumer). Three options:
  1. **Discard the gate.** AudioInterpreter's onset gate
     (design doc §7) plays a similar role: chord publishing
     requires recent onset evidence, which suppresses
     overtone-driven phantom chords. The flatness gate was
     harmonograph's home-grown version of the same idea. If the
     onset gate is sufficient on harmonograph's content, the
     flatness gate is redundant.
  2. **Move the gate into AudioInterpreter as a consumer-side
     hint.** Add an option (e.g. `requireFlatBelow: 0.4`) and
     have the chord tracker check it. Adds a config knob; might
     prove useful for noisy inputs.
  3. **Apply the gate consumer-side in the harmonograph
     subscriber.** Filter incoming `chordChange` events on
     harmonograph's flatness check. Preserves today's behavior
     exactly; doesn't help any other consumer.
  Audit recommendation, deferred to harmonograph migration:
  start with (1) and validate against the test corpus; fall back
  to (2) if there's a measurable regression.
- The reconciler stays. Harmonograph already has it; the only
  change is calling `interpreter.start()` / `stop()` instead of
  the four detector-specific functions.
- The MIDI onset density path (`harmonograph.html:685-687`'s
  `window.__harmonograph.pushOnset()` driven by MIDI noteOn)
  could optionally be replaced by subscribing to the
  AudioInterpreter / MIDIInterpreter `noteAttack` stream — but
  that's a harmonograph-internal refactor unrelated to the
  audio analysis migration.

#### Scope and risk

Larger than Cantor's. Two detectors (not one), the flatness gate
is a real cross-coupling, and harmonograph-view.js is on the
file-scope-restricted list (`docs/WORKING_STYLE.md`). The
*template* (`harmonograph.html`) is not on the restricted list,
so the migration likely touches only the template — but the
flatness-gate decision benefits from being made carefully, and
the surface has more visual surfaces to regress.

Risk concentrations:
- Flatness-gate behavioral regression (the option (1) vs (2)
  decision above).
- Harmonograph's onset-density path drives the flowing trails;
  if migration accidentally changes when chord-change events
  arrive, the trails' density may shift visibly.

#### Future-prompt sketch

A future Claude Code prompt to do the harmonograph migration
would need to: read this section and the orchestration audit's
Notable C, decide on the flatness-gate disposition, replace the
chord+pitch in-template wiring with a single AudioInterpreter
instance constructed in `_initAudioInput`, retain the existing
reconciler in `_updateAudioInputStatus`, remove the local silence
watcher, and validate against harmonograph's existing test
corpus (any cantor-design-style corpus harmonograph already
uses, plus a manual pass for trail density). Out of scope for
the prompt: harmonograph-view.js's `window.MIDIInput` reader at
`harmonograph-view.js:886` (Notable D) and the
on-screen-keyboard publish paths.

### 7.2 Melody

#### Current wiring

- Imports `pitch-detection.js` only
  (`templates/melody.html:344`; orchestration audit §2).
- No chord detection, no onset detection, no silence watcher.
- Pitched output drives the melody UI directly; events go to a
  callback, not to MusicalEventStream.

#### What changes under AudioInterpreter

Smallest scope of any consumer. Two viable paths:

- **Don't migrate.** Melody's use case is *raw* pitch detection —
  it wants the continuous frequency, not interpreted
  `noteAttack` events. AudioInterpreter does not expose the raw
  reading; subscribing to `noteAttack` would lose data. Keep
  `pitch-detection.js` as a primitive and let melody use it
  directly.
- **Migrate to a `noteAttack` subscriber.** If melody's UI is
  fine with discrete attacks (it currently isn't, but a future
  redesign might be), it could subscribe to AudioInterpreter's
  stream. Big behavior change.

#### Scope and risk

Path 1 (don't migrate) is the right call for v0. Risk: zero.
Path 2 is a melody redesign, not an audio-analysis migration.

#### Future-prompt sketch

No migration prompt is warranted. The audit flags melody as
"primitive consumer that does not benefit from
AudioInterpreter's interpretation layer." If melody is later
rewritten to consume discrete events, that prompt is a melody
redesign, not an audio-analysis migration; it would specify the
new event subscriber, the UI change, and the deprecation of
melody's direct pitch-detection import.

### 7.3 SkratchLab audio-bridge

#### Current wiring

- Imports `pitch-detection.js` directly
  (`static/skratch-studio/audio-bridge.js:12`; orchestration
  audit §2).
- Same shape as melody: raw pitch detection feeding a
  SkratchLab-specific consumer.

#### What changes under AudioInterpreter

Same analysis as melody: SkratchLab uses raw pitch readings, not
interpreted attacks. Keep the direct import. No migration.

#### Scope and risk

Zero. Flag as "primitive consumer; not a migration target."

#### Future-prompt sketch

None warranted.

### 7.4 input-provider

#### Current wiring

`static/shared/input-provider.js` is a parallel abstraction layer
to AudioInterpreter, not a consumer of it. It owns its own
detector instances and exposes a uniform event vocabulary
(`noteOn`, `noteOff`, `chord`, `onset`) for games (orchestration
audit §2, §5). Specifically:

- Creates pitch, chord, and onset detectors internally
  (`static/shared/input-provider.js:354-358, :419-510`).
- Reshapes chord-detection's output, dropping `bass` and
  `pitchClasses` (`static/shared/input-provider.js:476-483`;
  orchestration audit Notable E).
- Has a UI (the modality picker pills) for runtime modality
  switching.
- Only one consumer in the codebase: Polyrhythm (Section 7.5).

input-provider's event vocabulary differs from
AudioInterpreter's:

| input-provider | AudioInterpreter            |
|----------------|-----------------------------|
| `noteOn`       | `noteAttack`                |
| `noteOff`      | `noteRelease`               |
| `chord`        | `chordChange`               |
| `onset`        | `percussiveStrike` (closest)|

Field shapes also differ: input-provider's `noteOn` carries
`{ note: 'C', octave: 4, velocity, source }`
(`input-provider.js:367, :452-457`), while AudioInterpreter's
`noteAttack` carries `{ pitch: <MIDI int>, velocity, … }`
(`audio-interpreter.js:353-363`).

#### What changes under AudioInterpreter — three options

This is the architecturally most complex of the non-Cantor
sections.

- **Option A: input-provider becomes an AudioInterpreter
  consumer.** Internally, instead of constructing chord/pitch/
  onset detectors directly, input-provider constructs an
  AudioInterpreter and subscribes to MusicalEventStream. The
  modality picker still chooses between click/MIDI/mic-X, but
  the mic modalities all flow through one AudioInterpreter. The
  reshape-on-emit logic at `input-provider.js:476-483` becomes
  the place where AudioInterpreter's events are translated to
  input-provider's vocabulary.
  - Pros: One audio-analysis path across the platform; Notable E
    is fixable as a side effect (input-provider's reshape can
    pass `bass` and `pitchClasses` through).
  - Cons: input-provider's modality switching is finer-grained
    than AudioInterpreter's "all on / all off." Today,
    `mic_pitch` runs only the pitch detector;
    `mic_chord` runs only the chord detector; `mic_onset` runs
    only the onset detector. AudioInterpreter has no mode
    switch — it always runs all three. If a game uses
    `mic_pitch` to save resources, that property is lost.
- **Option B: input-provider stays as-is, with Notable E fixed
  in place.** input-provider keeps its own detectors. The
  reshape at `input-provider.js:476-483` is updated to pass
  through `bass` and `pitchClasses`. Two parallel abstractions
  coexist: AudioInterpreter for always-on surfaces,
  input-provider for games.
  - Pros: Smallest change. Modality switching preserved exactly.
  - Cons: Permanent duplication of the analysis path. Any future
    interpretation work (the onset gate, the silence watcher,
    timbral classification) has to be re-implemented in
    input-provider or stay only on the always-on side.
- **Option C: input-provider absorbed into AudioInterpreter.**
  AudioInterpreter grows the modality concept (click, MIDI,
  mic_pitch, mic_chord, mic_onset). The modality picker UI moves
  into input-provider's place but as a thin shell over
  AudioInterpreter. Polyrhythm's wiring becomes
  `createAudioInterpreter({ modes: { onset: { mic: true } } })`
  or similar.
  - Pros: One module owns input handling. Cleanest end-state.
  - Cons: Largest migration. AudioInterpreter today is the
    audio-side counterpart to MIDIInput; turning it into a
    multi-modality input layer is a real expansion of scope.

#### Recommendation (audit, not decision)

Option B for now. Reasoning:

- AudioInterpreter v0's design doc explicitly defers
  multi-modality: design principle 7 ("Single producer per
  modality") and §8's "passive consumer of whatever analyser
  it's been handed" both point at a model where AudioInterpreter
  is one of several siblings (audio, MIDI, click), not a
  multi-modality container.
- Polyrhythm's resource-efficiency property (only the requested
  detector runs) is real; option A loses it.
- The Notable E fix in option B is a one-line change at
  `input-provider.js:476-483` (add `bass` and `pitchClasses` to
  the emitted shape). High value, near-zero risk.
- Option C is a future architectural decision worth revisiting
  after Beat Field lands and a second game (or the
  cantor-on-Beat-Field cross-surface case) creates pressure for
  unification.

#### Scope and risk

Option B: tiny. One field-pass-through edit and an audit-flag
that the duplicate-analysis-path tax is being paid intentionally.

#### Future-prompt sketch

A future Claude Code prompt to do the option B fix would need to:
add `bass` and `pitchClasses` to the chord event emitted by
`input-provider.js:476-483`, and verify that no consumer relies
on the absence of those fields (today, only Polyrhythm uses
input-provider, and Polyrhythm subscribes only to `'onset'`, so
this is safe). Optionally include a comment pointing to design
principle 7 and noting that the long-term direction is option A
or C.

### 7.5 Polyrhythm

#### Current wiring

- Only consumer of `input-provider.js` in the codebase
  (orchestration audit §2; `static/games/polyrhythm.js:15,
  :1845-1856`).
- Declares `supported: { click: true, midi: true, onset: { mic:
  true, interface: true } }`
  (`static/games/polyrhythm.js:1846-1851`).
- Subscribes to `'onset'` events
  (`static/games/polyrhythm.js:1856`).
- Wires its own analyser via `ensureAnalyser()` and passes it
  into the provider (`static/games/polyrhythm.js:1843, :1853`).
- Hooks the `mic_onset` pill click directly to open the mic via
  `wireMicToAnalyser()` (`static/games/polyrhythm.js:1862-1870`).

#### What changes under AudioInterpreter

Strictly downstream of input-provider's resolution. Three
contingent shapes:

- **If input-provider stays (option B above):** Polyrhythm is
  unchanged. Its subscription to `'onset'` events continues to
  work; the modality picker continues to render mic_onset and
  open the mic on click. Zero migration work for Polyrhythm
  itself.
- **If input-provider migrates to consume AudioInterpreter
  (option A):** Polyrhythm's API surface is unchanged — it
  subscribes to `'onset'` events on the provider. The
  resource-efficiency change (all three detectors run, not just
  onset) is invisible to Polyrhythm but may affect performance
  on lower-end devices. Worth measuring.
- **If input-provider is absorbed into AudioInterpreter
  (option C):** Polyrhythm's wiring rewrites — `createInputProvider`
  becomes `createAudioInterpreter` (or whatever the absorbed API
  is), the supported declaration shape changes, and the
  `'onset'` subscription becomes a `percussiveStrike`
  subscription with strength filtering. Largest change.

#### Scope and risk

Contingent on 7.4. Under option B (recommended), zero scope.

#### Future-prompt sketch

If option A or C is later chosen, a Polyrhythm migration prompt
would need to: characterize Polyrhythm's onset event consumption
(callback shape, fields used), map it to either the new
input-provider event shape (option A) or
`percussiveStrike` directly (option C), and verify the
modality-picker and gestural mic-open flow still work. Under
option B, no prompt is needed.

---

## 8. Sequencing recommendation

### Recommended order

1. **Cantor phase 1** (Section 3). The named deliverable. Lands
   first; all subsequent migrations build on the patterns it
   establishes (reconciler, `chordChange { root: null }` for
   silence, field preservation).
2. **input-provider Notable E fix** (Section 7.4 option B
   recommendation). Independent of Cantor; can land in parallel
   if the user wants. Tiny PR.
3. **Cantor phase 2** (Section 4) — *only if* OQ1 resolves toward
   branch (b). Otherwise this is a close-out with no source
   change.
4. **Harmonograph migration** (Section 7.1). Depends on Cantor
   phase 1's pattern being settled (so harmonograph's reconciler
   simplification has a model to follow). Independent of
   phase 2 / OQ1 resolution.

Melody and SkratchLab audio-bridge are not migrated (Sections
7.2, 7.3). Polyrhythm is contingent on 7.4 and not migrated under
the recommended option B (Section 7.5).

### Dependencies and parallelism

- Cantor phase 1 → Harmonograph migration. The reconciler
  pattern Cantor adopts is already in harmonograph; the
  dependency is the *AudioInterpreter usage idiom*, not the
  reconciler itself. Harmonograph could in principle migrate
  before Cantor, but Cantor's migration is the canonical
  reference and should ship first.
- Cantor phase 1 ↔ input-provider Notable E. Independent.
  Parallel-safe.
- Cantor phase 2 ↔ harmonograph migration. Independent of each
  other but both depend on Cantor phase 1.
- input-provider option-A or option-C revisit ↔ Beat Field.
  Beat Field's arrival is the natural pressure for revisiting
  input-provider's role. Defer until Beat Field is on the
  schedule.

### What does *not* block what

- Cantor phase 2 does not need to land before any non-Cantor
  migration. Both branches of OQ1 leave AudioInterpreter's audio
  surface stable.
- Harmonograph's flatness-gate decision is internal to that
  migration and does not block any other.
- Polyrhythm is downstream of input-provider. Under option B,
  Polyrhythm never migrates; under A or C, it migrates after
  input-provider does.

---

## 9. Out of scope / explicitly deferred

This audit deliberately does not address:

- **Beat Field implementation.** Tracked in
  `docs/beat-field-design.md`. AudioInterpreter v0 satisfies its
  prerequisite (the `percussiveStrike` event interface); the
  build-out is its own deliverable.
- **chord-detection.js top-N candidates lift.** Required to
  populate `chordChange.alternatives` non-trivially. Currently
  AudioInterpreter emits `alternatives: []`
  (`audio-interpreter.js:564`); this audit does not touch
  `chord-detection.js`. Deferred to v3+ (design doc §11 OQ8).
- **Adaptive tuning windows.** All AudioInterpreter parameters
  are static in v0 (design doc §9, §10, §11 OQ3). The migration
  uses these defaults; calibration is its own pass.
- **Harmonograph migration timeline.** The shape is in Section
  7.1; the actual scheduling is deferred. The recommended
  sequence (Section 8) places it after Cantor phase 1; the
  *when* is the user's call.
- **Cantor 3D math refactor.** `docs/WORKING_STYLE.md` flags
  cantor's 3D math as a duplicate of harmonograph's; that
  refactor is unrelated to audio analysis migration.
- **`harmonograph-view.js:886` `window.MIDIInput` cleanup**
  (orchestration audit Notable D). Adjacent to OQ9 in spirit but
  not part of the audio-analysis migration scope.
- **Post-v0 AudioInterpreter feature work.** Emergent attacks,
  audio-derived `noteRelease` (richer than v0's confidence-drop
  release), `pitchBend`, finer timbral classification, tempo /
  beat / phrase detection (design doc §10). All deferred.
- **Test infrastructure.** Design doc §11 OQ7 calls out fixture
  corpora as the right testing model for AudioInterpreter; this
  audit does not specify that infrastructure. Acceptance for the
  Cantor migration relies on Section 3.4's behavioral criteria
  applied manually.
