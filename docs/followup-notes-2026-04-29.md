# Followup notes — 2026-04-30 session

Context: tonight's session (2026-04-29 evening) drafted and ran
the Cantor migration phase 1 prompt. Acceptance criteria 1, 2,
4, 5, 6, 7 from cantor-migration-audit.md §3.4 passed.
**Criterion 3 (saved-device auto-restore) did not pass**, for
reasons the audit didn't anticipate. The fix is bigger than a
one-line follow-up; it's an architectural lift that needs its
own session.

This document outlines what tomorrow's session needs to
accomplish, in enough detail that the work is drafttable
without re-deriving the problem.


## The bug, in one paragraph

Cantor's `_initAudioInput` calls `AudioInput.init()`, which may
auto-restore a previously selected device. At init time
`window.Tone.context.state !== 'running'` (no user gesture yet),
so AudioInput's restore path falls back to a standalone
AudioContext. The auto-restored MediaStream is rooted in that
standalone context, not in Tone's. Cantor's keyboard analyser
lives in Tone's context. So when the reconciler eventually
starts the interpreter (after the user does *some* gesture that
starts Tone), the interpreter reads from a Tone-context analyser
that has no MediaStreamSource connected to it — silence. Wash
doesn't light up.

Harmonograph hit this same problem at some point and solved it
with a `_audioInputNeedsToneRewire` flag plus an
`_attachAudioInputToTone()` function that, on the first
post-Tone-start gesture, tears down the standalone-context
stream and re-`selectDevice`s inside Tone's running context.
Cantor didn't inherit this machinery — only a fragment of it
(the `AudioInput.disconnect()` at the top of
`_initAudioInput`). Pre-migration, the disconnect papered over
the missing rewire by ensuring the auto-restored device was
never active. Post-migration with the disconnect removed, the
auto-restored device IS active but unusably routed.


## The right fix: lift the rewire machinery into audio-input.js

Both harmonograph and cantor need this. Any future surface that
uses AudioInput + a Tone-rooted analyser will also need it.
Lifting the pattern into the shared module is the right shape.

Constraint: `audio-input.js` is on the file-scope-restricted
list (WORKING_STYLE.md). Tomorrow's session must start with
explicit lift on this file. The lift's scope should be
intentionally narrow — pull the rewire machinery into the
shared module, update the two consuming surfaces, nothing
else rides along.


## Specific machinery to lift (from templates/harmonograph.html)

1. **`_audioInputNeedsToneRewire` flag** (harmonograph.html:520).
   Module-scoped boolean. Set `true` if `AudioInput.init()` left
   the device active in a non-Tone context. Cleared after
   successful rewire.

2. **`_attachAudioInputToTone()` function** (harmonograph.html:993–1018).
   Reads the rewire flag; if set and a device is active:
   - calls `AudioInput.disconnect()`
   - calls `AudioInput.setAnalyser(<Tone-rooted analyser>)`
   - calls `await AudioInput.selectDevice(activeDevice.id)`
   - clears the flag
   On the no-rewire-needed path (flag false but a device exists),
   it just calls `setAnalyser` defensively. Worth confirming
   that's the actual semantics by reading the function — this
   note is a sketch, not a spec.

3. **Where the flag is set** (harmonograph.html:1149 inside
   `_switchAudioInputDevice`). After a `selectDevice` succeeds,
   if `rawCtx.state !== 'running'`, the flag is set so that the
   *next* gesture-driven path will rewire. There may be other
   set-sites in `_initAudioInput` worth tracing — read it.


## Shape options for the lifted API

Two reasonable shapes; tomorrow's session picks one:

**Shape A: AudioInput exposes the rewire machinery as part of
its own API.** New methods like
`AudioInput.rewireForTone(analyser)` that consumers call after
their first `Tone.start()` resolves. The flag stays internal to
AudioInput; callers don't need to track it. Smallest API
surface; consumers don't need to know about the
non-Tone-context fallback at all.

**Shape B: AudioInput exposes the flag, consumers call the
existing methods.** AudioInput grows an
`AudioInput.needsToneRewire()` boolean and consumers call
`disconnect` → `setAnalyser` → `selectDevice` themselves when
the flag is set. More flexible (consumers can interleave other
work) but pushes more responsibility to callers and risks
inconsistent rewire sequences.

Shape A is cleaner. Worth confirming by reading
`audio-input.js` to see how the existing API is shaped — the
lift should match the module's existing style.


## Acceptance criteria for the lift session

1. **Cantor criterion 3 passes** (the original migration audit
   §3.4 criterion). Reload cantor.html with a previously
   selected audio device; the wash lights up without requiring
   a MIDI note or device-pick gesture, after one gesture that
   starts Tone (e.g., clicking the on-screen keyboard).

2. **Harmonograph saved-device behavior is unchanged.** The
   migration is a refactor, not a behavior change for
   harmonograph. Manual test: load harmonograph.html with a
   saved device; verify the visualization responds to mic input
   the same way it did before the lift.

3. **Cantor and harmonograph use the same API path.** Both
   call into the lifted function (or read the lifted flag);
   neither has its own copy of `_attachAudioInputToTone`.

4. **No file-scope-restricted file changes beyond the lifted
   `audio-input.js`.** Specifically: harmony-state.js,
   keyboard-view.js, chord-detection.js, musical-event-stream.js
   are still off-limits. Even harmonograph-view.js stays
   off-limits — the lift only touches `templates/harmonograph.html`
   and `templates/cantor.html` on the consumer side.


## Files in scope for tomorrow's session

- `static/shared/audio-input.js` — receives the lifted machinery.
  **Requires explicit lift to edit.**
- `templates/cantor.html` — replaces ad-hoc init logic with a
  call into the lifted API.
- `templates/harmonograph.html` — replaces in-template
  `_audioInputNeedsToneRewire` / `_attachAudioInputToTone` with
  calls into the lifted API.

Not in scope:
- Any other audio-input.js changes (e.g., addressing OQ9's
  `window.AudioInput` coupling, refactoring the device-restore
  path itself, etc.). These are tracked separately and should
  not ride along with the lift.
- The harmonograph migration onto AudioInterpreter v0
  (cantor-migration-audit.md §7.1). That's a separate prompt
  arc and should not be conflated with the rewire lift.


## Sequencing within tomorrow's session

WORKING_STYLE rule applies: one Claude Code prompt per session
focus area. The rewire lift is one focus area.

Suggested chat-side sequence:
1. User confirms intent to lift `audio-input.js`.
2. Read the three sites of `AudioInput.disconnect()` in
   harmonograph.html and the surrounding rewire machinery —
   confirm the sketch above matches the actual code.
3. Read the existing `audio-input.js` API surface — pick
   between shape A and shape B based on style fit.
4. Draft the Claude Code prompt: read list, scope, file paths,
   acceptance criteria. Standard format per
   docs/claude-code-preferences.md (or whatever the house
   convention is — tonight's prompt followed
   "read the following files first" + scoped task + explicit
   paths).
5. Run the prompt as a separate Claude Code session.
6. Verify acceptance criteria against both surfaces.
7. End-of-session: STATUS.md / SESSION_LOG.md / git.


## Open questions for tomorrow

- **Does the lift touch only `audio-input.js`, or does it also
  need to touch `harmonograph-view.js`?** The rewire flag is
  in `templates/harmonograph.html`, not in
  `static/shared/harmonograph-view.js`. If that holds for
  cantor too, harmonograph-view.js stays off-limits and is
  untouched. Worth confirming with a grep before drafting.

- **Does the lift change the AudioInput public API in a way
  that affects other consumers?** Other importers of
  audio-input.js need to keep working. Spot-check: grep for
  `AudioInput.` across the codebase before drafting. Likely
  consumers: explorer, melody, skratchlab — all of which use
  AudioInput's basic device-selection surface but probably
  don't touch the rewire path.

- **Should the lifted machinery handle the "no Tone" case
  gracefully?** Some surfaces may not use Tone at all (or use
  Tone but not start it from `audio-input.js`'s perspective).
  Shape A's `rewireForTone(analyser)` should probably no-op if
  the flag is false rather than throwing.


## Calibration reminders for tomorrow

- **The audit's §3 had a blind spot at `_initAudioInput`.**
  When drafting the lift prompt, don't lean on the audit for
  context on the rewire pattern — go to harmonograph.html
  directly. The audit didn't model this layer.

- **Read before recommending.** Tonight I recommended
  removing line 778 before reading harmonograph's pattern.
  The diagnosis was right but the prescription was made in
  ignorance. The grep-before-guess rule applies to inherited
  code: when removing something that was copy-pasted from
  another surface, read the original site first.

- **The lift is small but high-trust.** `audio-input.js` is
  off-limits for a reason — it's in the path of every audio
  surface. The Claude Code prompt should be tight, the
  acceptance criteria sharp, and the scope locked down.
