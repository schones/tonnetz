# SongLab Codebase Review — Opus 4.7

**Date:** 2026-04-16
**Scope:** `static/shared/`, `static/games/`, `static/skratch-studio/`, `static/intro/`, `templates/`, `app.py` + Python helpers
**Method:** Static analysis only — no server started, no changes made.

**Severity key:** **critical** = blocks user flow / data safety; **warning** = bug risk or material architectural smell; **info** = consistency nit or future risk.

---

## Executive Summary — Must-fix Before User Testing

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | **critical** | `static/skratch-studio/audio-bridge.js:12,491,518` | Imports `startPitchDetection` / `stopPitchDetection` from `shared/audio.js`, which no longer exports them. Breaks SkratchLab init on any page that loads `studio.js`. |
| 2 | **critical** | `static/strumming/detection.js:80,114,220` | Calls dead routes `/start_listen`, `/stop_listen`, `/poll_audio`. Strum Patterns mic detection 404s. |
| 3 | **critical** | `static/rhythm/rhythm.js:549,561,589` | Same dead-route calls. Rhythm Lab mic-based tap detection 404s. |
| 4 | **critical** | `static/shared/chord-detection.js:303` | Hardcoded `sampleRate = 44100`. On 48 kHz contexts (default in modern Chrome) chroma-bin math is off, shifting detected chord by a fixed semitone. |
| 5 | **critical** | `static/shared/audio-input.js:239–248` | Creates a fresh `new AudioContext()` while connecting a `MediaStreamSource` from that context into a `Tone.Analyser` that lives in Tone's context. Cross-context node wiring is invalid per the Web Audio spec — either drops samples or throws in some browsers. |
| 6 | **critical** | `/games/swing-trainer` | Known 500 on production (STATUS.md). Featured in main nav & landing page grid; first-impression killer. |
| 7 | **warning** | `templates/skratch-studio.html` + `static/skratch-studio/studio.js:1700,1936`, `sandbox.js:78` | `new Function(...)` is evaluating user-supplied Blockly output. Sandboxed only by variable scope; not a cross-user risk (single-tenant app), but worth documenting. |
| 8 | **warning** | Seven dev / test routes still in `app.py` | `/test_sustain`, `/test-tooltips`, `/test/shared`, `/test/fretboard`, `/chord-wheel-test`, `/tone-check`, `/showcase` should be hidden before external testers. |

Fix #1–#3 before shipping to testers — they're the only hard crashes.

---

## 1. Module API Audit — `static/shared/`

### Per-module inventory

#### `ai.js`
- **Export pattern:** named exports of pure-ish functions; module-level `STORAGE_PREFIX`. Exports: `getPerformance` (68), `recordAttempt` (79), `recordSession` (111), `clearPerformance` (132), `getAdaptiveWeights` (158), `selectWeighted` (205), `getWeakAreas` (228), `getPerformanceSummary` (248), `isAIAvailable` (300), `getSessionFeedback` (312).
- **Dependencies:** none.
- **Consumers:** `templates/melody.html:352`, `templates/strumming.html:684`.
- **Audio:** none.
- **Error handling:** readJSON/writeJSON swallow with empty `catch` (23–40); `getSessionFeedback` returns `null` on any error (343) — silent network failure. **info**.

#### `audio-input.js`
- **Export pattern:** singleton object + global + default. `export { AudioInput }; export default AudioInput;` (355–356). Module state: `_analyser, _stream, _sourceNode, _audioContext, _devices, _selectedDeviceId` (49–55).
- **Dependencies:** Web Audio, localStorage. Accepts an injected `Tone.Analyser`; does not import Tone.
- **Consumers:** `static/shared/input-provider.js:26` is the only real consumer. Not yet wired into Spectrum panel or `keyboard-view.js` despite spec.
- **AudioContext ownership:** **creates its own `new AudioContext()`** at `audio-input.js:239`, then connects `createMediaStreamSource(...)` (241) → `analyser._analyser` (248). **critical** — mixing contexts is invalid per Web Audio spec.
- **Stream lifecycle:** `selectDevice` (213) creates; `_disconnectCurrent` (133) stops tracks and disconnects source; public `disconnect()` (339).
- **Error handling:** `getUserMedia` failure → `console.warn` and returns `false` (222) — UI cannot distinguish "denied" from "device missing". **info**.

#### `audio-toggle.js`
- **Export pattern:** IIFE with global only: `window.AudioToggle = { ... }` (121). No ES exports.
- **Consumers:** script-tag loaded in `templates/base.html:330`, `skratch-studio.html:28,1112`, `explorer.html:1678`. Read by `audio.js:194,211`.
- **AudioContext:** uses `Tone.context.state` + `Tone.start()`; owns nothing.
- **Error handling:** intentionally swallows `Tone.start()` rejections (34).

#### `audio.js`
- **Export pattern:** named exports + module singleton state (`audioContext`, `synth`). Exports: `initAudio`, `frequencyToNote`, `noteToFrequency`, `getIntervalName`, `getSemitones`, `getNoteRange`, `playNote`, `playInterval`, plus constants.
- **Consumers:** `templates/melody.html:343`, `static/shared/pitch-detection.js:36`, and **broken** `static/skratch-studio/audio-bridge.js:12` (imports deleted names).
- **AudioContext:** creates a singleton `Tone.PolySynth` connected to destination (74–83).
- **Error handling:** hard-throws if Tone global is missing (68). **warning** — callers in `melody.html` have no catch.

#### `chord-bubble-renderer.js`
- **Export pattern:** class + global. `export { ChordBubbleRenderer };` (741) plus `window.ChordBubbleRenderer = ...` (744).
- **Dependencies:** `harmony-state.js`, `transforms.js`, `chord-resolver.js`.
- **Consumers:** `explorer.html:1719`, `theory/chord-progressions.html:663`.

#### `chord-detection.js`
- **Export pattern:** factory `export function create(options)` (271). No global.
- **Dependencies:** `chord-resolver.js` (12).
- **Consumers:** `input-provider.js:29`.
- **AudioContext:** consumes injected analyser (272); throws if missing.
- **Error handling:** **critical** — `chord-detection.js:303` hardcodes `sampleRate = 44100`. If the actual `AudioContext.sampleRate` is 48000, the FFT-bin → pitch-class mapping mis-rounds; chords will be detected a fixed semitone off.
- **Additional info:** duplicates `NOTE_NAMES`, `KEY_TO_PC`, and chord templates that already exist in `chord-resolver.js` and `transforms.js`.

#### `chord-resolver.js`
- **Export pattern:** named + global. `export { resolveChord };` (168); `window.ChordResolver = { resolveChord };` (171). Pure.
- **Consumers:** `js/chord-wheel.js:24`, `test-fretboard.html:176`, `explorer.html:1721`, `chord-bubble-renderer.js:32`, `chord-detection.js:12`.

#### `config.js` / `config.example.js`
- **Export pattern:** empty comment files. No runtime role. Candidates for deletion.

#### `fretboard-view.js`
- **Export pattern:** class + global. `export { FretboardView };` (559), `window.FretboardView = ...` (562).
- **Consumers:** `test-fretboard.html:174`, `explorer.html:1723`.

#### `harmony-state.js`
- **Export pattern:** singleton object + global. Module-level `_state` and `_listeners` arrays (76).
- **Consumers:** 12+ — see list in STATUS.md shared components. This is the pub/sub backbone.
- **Subscribe API:** `HarmonyState.on(fn)` returns unsubscribe function. Every first-party consumer calls it and stores the unsub locally (`tonnetz-neighborhood.js:1265`, `chord-bubble-renderer.js:326`, `fretboard-view.js:222`, `keyboard-view.js:684`, `visual-layer.js:102`, `js/chord-wheel.js:516`, `intro/ch5-tonnetz.js:347`) — good pattern.

#### `input-provider.js`
- **Export pattern:** factory `export function createInputProvider(config)` (328).
- **Dependencies:** `midi-input.js`, `audio-input.js`, `onset-detection.js`, `pitch-detection.js`, `chord-detection.js`.
- **Consumers:** `static/games/polyrhythm.js:15` (only).
- **Stream lifecycle:** pitch-detection case reads `AudioInput.getStream()` (438); if null, the pitch detector falls through to its own `getUserMedia` call. `destroy()` at 612 unwires MIDI callbacks and stops detectors.
- **Error handling:** **warning** — for mic_chord and mic_onset, if no analyser is supplied the provider `console.warn`s and silently no-ops (469, 489); UI pill stays enabled, modality is a dead end.

#### `keyboard-view.js`
- **Export pattern:** singleton + global + named re-exports (1135, 1138). Module state at 391–400.
- **Dependencies:** `transforms.js`, `harmony-state.js`, Tone global.
- **Consumers:** 10+ templates/modules.
- **AudioContext / Analyser ownership:** creates the shared `new Tone.Analyser('fft', 4096)` (405), wires volume nodes through it, and exposes `getAnalyser()` (945).
- **Stream lifecycle:** playback only; no streams. `_ensureAnalyser` is lazy but never torn down.

#### `mascot.js`
- **Export pattern:** `export function createMascot(expression, size)` (51). Returns `SVGSVGElement`.
- **Consumers:** `static/games/scale-builder.js:28`.

#### `midi-input.js`
- **Export pattern:** singleton + global + default (250–254). Module state 38–46.
- **Consumers:** `explorer.html:1711`, `input-provider.js:25`.
- **Stream lifecycle:** `_attach` sets `input.onmidimessage`; `_detachCurrent` nulls it. **No public `destroy()`**. **info** — fine for page-reload navigation, but wouldn't survive an SPA transition.
- **Error handling:** listener dispatch wrapped with `console.error` at multiple sites (63, 68, 77, 84, 93).

#### `onset-detection.js`
- **Export pattern:** factory `export function create(options)` (51). No global.
- **Consumers:** `input-provider.js:27`.
- **AudioContext:** consumes injected analyser; throws if missing.
- **Error handling:** **info** — no try/catch around the rAF loop; one thrown `analyser.getValue()` kills the detector silently.

#### `pitch-detection.js`
- **Export pattern:** factory `export function createPitchDetector(options)` (156).
- **Consumers:** `templates/melody.html:344`, `input-provider.js:28`.
- **AudioContext / Stream:** **creates its own** `new AudioContext()` per-start (232). If caller supplies a stream, reuses it; otherwise calls `getUserMedia` internally (221–228). `stop()` closes the context (327–330).
- **info** — uses deprecated `createScriptProcessor` (239) instead of `AudioWorklet`.
- **Error handling:** hard throws on unknown engine names (169, 172, 348, 351); AudioContext.close swallowed silently (328).

#### `progress.js`
- **Export pattern:** named functions.
- **Consumers:** `melody.html:348`, `strumming.html:684`, `static/rhythm/rhythm.js:16`.
- **Error handling:** readJSON / writeJSON swallow silently (18–35).

#### `song-examples.js`
- **Export pattern:** `export default SONG_EXAMPLES;`.
- **Consumers:** `polyrhythm.js:16`, `walkthrough-overlay.js:21`, `walkthrough-sidebar.js:26`, `theory/chord-progressions.html:665`, `theory/modes.html:712` (dynamic).

#### `theory-content.js`
- **Export pattern:** named exports `THEORY` data + `validateTheory()`.
- **Consumers:** `theory-engine.js:13`, `tips-pill.js:16`.

#### `theory-engine.js`
- **Export pattern:** class `TheoryTooltip` (351) + function `initTheoryTooltips` (784).
- **Consumers:** `harmony.html:1105`, `test-tooltips.html:131`, `relative-key-trainer.js:36`.

#### `tips-pill.js`
- **Export pattern:** object namespace `export { TipsPill };` (496).
- **Consumers:** `harmony.html:1104`, `relative-key-trainer.js:35`.

#### `tonnetz-neighborhood.js`
- **Export pattern:** singleton + global (1486, 1489).
- **Consumers:** 7 pages/modules.
- **Lifecycle:** `init(containerId)` + `destroy()`. Singleton means only one instance per page.

#### `transforms.js`
- **Export pattern:** ~20 named exports + `window.Transforms` (478–498, 501–523). Includes `CHORD_TYPES` — a third chord-type registry.
- **Consumers:** ~15 modules. Canonical source of truth for pitch math.

#### `user-profile.js`
- **Export pattern:** 15 named functions.
- **Consumers:** `intro/intro-core.js:15`, `theory-engine.js:14`, `tips-pill.js:17`.
- **Error handling:** **warning** — `_save()` (46) has no try/catch. A quota-exceeded error in Safari private mode or aggressive storage clearing will bubble out of every profile write.

#### `visual-config.js`, `visual-layer.js`, `visual-toggle.js`
- **Export pattern:** named + singleton. `visual-layer.js:23` has its own inline `NOTE_PC` map that duplicates `transforms.noteToPC`. **info**.

#### `walkthrough-overlay.js`
- **Export pattern:** class `WalkthroughOverlay` (472). **warning** — no consumers found; file comment says it was replaced by `walkthrough-sidebar.js`. Orphan.

#### `walkthrough-sidebar.js`
- **Export pattern:** class (561).
- **Consumers:** `explorer.html:1727`.

#### `walkthroughs.js`
- **Export pattern:** named data export (633).
- **Consumers:** `walkthrough-sidebar.js:27`, `explorer.html:1725`.

### Cross-module inconsistencies

**info — six distinct export styles in one directory:**

| Style | Modules |
|---|---|
| Singleton object + `window.*` global | `harmony-state.js`, `tonnetz-neighborhood.js`, `audio-input.js`, `midi-input.js`, `keyboard-view.js` |
| Singleton object, no global | `visual-layer.js`, `visual-toggle.js` |
| Class export + global | `chord-bubble-renderer.js`, `fretboard-view.js` |
| Class export, no global | `walkthrough-overlay.js`, `walkthrough-sidebar.js` |
| Factory `create*()` | `chord-detection.js`, `onset-detection.js`, `pitch-detection.js`, `input-provider.js`, `mascot.js` |
| Pure named exports | `ai.js`, `progress.js`, `user-profile.js`, `audio.js`, `transforms.js`, `chord-resolver.js`, `theory-engine.js`, `theory-content.js` |
| IIFE global only | `audio-toggle.js` |

Settle on a small menu of allowed patterns and migrate.

**warning — factory-function naming inconsistency.** `chord-detection.js:271` and `onset-detection.js:51` export bare `create`; `pitch-detection.js:156` exports `createPitchDetector`. `input-provider.js` has to rename on import:

```js
import { create as createOnsetDetector } from './onset-detection.js';
import { create as createChordDetector } from './chord-detection.js';
import { createPitchDetector } from './pitch-detection.js';
```

**critical — AudioContext ownership fragmentation.** Four patterns coexist:

1. `audio.js` uses Tone's default context via `Tone.getContext().rawContext` (72).
2. `keyboard-view.js:405` creates the shared `Tone.Analyser` and owns the playback-side audio graph.
3. `audio-input.js:239` creates an **independent** raw `new AudioContext()`, then connects a MediaStreamSource from *that* context to a `Tone.Analyser` living in Tone's context (248). **Not valid** per the Web Audio spec — a node from one context cannot be connected to a node in another. In practice this either drops samples silently or throws `InvalidAccessError` depending on the browser.
4. `pitch-detection.js:232` creates **another** independent `new AudioContext()` for its YIN ScriptProcessor.

Recommend: one owner (Tone's context), one analyser (the shared one in `keyboard-view.js`), and `audio-input.js` re-homed to create its `MediaStreamSource` from `Tone.context.rawContext`.

**warning — triplicated chord-type registries:**

- `chord-detection.js:39–63` — `NOTE_NAMES`, `KEY_TO_PC`, `CHORD_TEMPLATES`, `QUALITY_SYMBOLS`.
- `chord-resolver.js:22, 31–48` — `NOTE_NAMES`, `CHORD_TYPES` with priority.
- `transforms.js:486–491` — `CHORD_TYPES`, `chordPCs`, `chordNotes`, `chordSymbol`.

Adding a chord quality requires changes in two of the three. Consolidate into `transforms.js`.

**info — duplicated `noteToPC` tables.** `visual-layer.js:23` keeps its own `NOTE_PC` map; should import from `transforms.js`.

**warning — missing teardown paths.** `harmony-state.js`, `midi-input.js`, `keyboard-view.js` shared analyser, and `audio.js` PolySynth all live for the lifetime of the page. Fine for full-reload navigation; footgun if SongLab ever adds client-side SPA routing.

---

## 2. Dead Code & Stale References

### Dead function calls

**critical — `startPitchDetection` / `stopPitchDetection`** are no longer exported from `static/shared/audio.js` (file ends at line 253; only `initAudio`, `frequencyToNote`, `noteToFrequency`, `getIntervalName`, `getSemitones`, `getNoteRange`, `playNote`, `playInterval` are exported). One consumer still imports them:
- `static/skratch-studio/audio-bridge.js:12` — `import { startPitchDetection, stopPitchDetection } from '../shared/audio.js';`
- `audio-bridge.js:491` — `await startPitchDetection(...)`
- `audio-bridge.js:518` — `stopPitchDetection()`

In ES-module strict mode the import yields `undefined` bindings; the first call throws `TypeError: startPitchDetection is not a function`. Because `studio.js:9` and `music-engine.js:3` pull in `audio-bridge.js`, loading `/skratchlab` likely fails outright once the mic path is exercised.

**info — `autocorrelate`** has no remaining callers in source. All hits are in docs.

### Non-existent Python routes

`app.py` defines only `/`, `/play`, `/process_audio_chunk`, `/status`, `/api/chat`, plus template renders. No `/start_listen`, `/poll_audio`, `/stop_listen` — but still called from:

**critical** — `static/strumming/detection.js:80,114,220` → `/start_listen`, `/stop_listen`, `/poll_audio`. Imported by `templates/strumming.html:686`.

**critical** — `static/rhythm/rhythm.js:549,561,589` → same dead routes. Imported by `templates/rhythm.html:194`.

`docs/audio-architecture.md` only calls out Melody Match and Harmony Trainer. These two games were missed.

**warning** — `/process_audio_chunk` has one live caller: `templates/harmony.html:875`. Harmony Trainer still runs through server-side librosa. Per `audio-architecture.md:438`, the plan is to migrate it to `pitch-detection.js`.

**info** — `/play` is called by `templates/tone-check.html:408` and `templates/relative.html:506`. `/status` is called only by `templates/relative.html:624`.

### Broken imports

All relative imports across `static/shared/`, `static/intro/`, `static/skratch-studio/`, `static/js/`, `static/games/` resolve to files that exist — **except** the `audio-bridge.js:12` import noted above. That is the only static-level broken import in the repo.

### Unreachable code

**info** — `audio.js` is clean (file is 253 lines; dead functions already deleted). `docs/audio-architecture.md:203–210` still cites the old line numbers; the doc is stale.

**info** — `docs/songlab-build-plan.md:86, 574` describe completed work as still pending.

### Orphan files

| Severity | File | Note |
|---|---|---|
| warning | `static/games/swing-trainer.html` | Stray duplicate of `templates/games/swing-trainer.html`. Served nowhere. |
| warning | `static/skratch-studio/test-sustain.html` | Reachable only via `/test_sustain` (dev route). |
| warning | `static/intro/old-ch1-sound.js` | Pre-refactor snapshot; no importer. |
| warning | `static/intro/scrollymess-ch1-sound.js` | Pre-refactor snapshot; no importer. |
| warning | `static/shared/walkthrough-overlay.js` | Replaced by `walkthrough-sidebar.js`; no current importers. |
| info | `static/shared/config.js` / `config.example.js` | Comment-only stubs. |
| info | `static/shared/songSchema.json` | Not referenced by code. Tooling-only? |
| info | `static/shared/tonnetz-logo-{dark,light}.svg` | No template references found. |

### CSS defined-but-never-used

Spot-check only — not exhaustive.

**styles.css:**
- warning — `.container--narrow` (172) and `.gauge__arc-bg` (421) defined, never used in templates.
- info — `.mtt-header*` family (177–214) is only still used by `skratch-studio-help.html`; the rest of the app uses `.sl-nav*`.

**game-shell.css:** all sampled classes in use.

**design-tokens.css:**
- info — `--font-size-4xl` (41) and `--transition-color` (66) have zero non-self consumers.
- info — `--accent-transport`, `--chord-augmented`, `--chord-borrowed`, `--bg-input`, `--border-subtle`, `--text-ghost`, `--bg-deep` all have very few consumers; worth a pruning pass.

### Unused Python

- warning — `audio_processor.py:3` — `import scipy.signal` never referenced.
- warning — `game_engine.py:23–26, 111–403` — the entire CLI tree (`main`, `_run_session`, `_play_identify_round`, `_play_clarity_round`, `_record_buffer`, `_print_high_scores`, `_bar`) and its `sounddevice` dependency are unreachable from `app.py`. The Flask app only imports `CHALLENGES`, `SAMPLE_RATE`, `SILENCE_RMS`, `_compute_score`, `_display_root`, `_load_scores`, `_save_score`.
- info — `pitch_matcher.py:36` — `_midi_to_hz` defined but never called.
- info — `chord_detector.py:302` — `identify_triad` back-compat alias is only called from the dead CLI in `game_engine.py`.

---

## 3. Security Review

### 3.1 API keys in client-facing code

**info — clean.** `ANTHROPIC_API_KEY` lives in `.env` / Railway env vars and is only read server-side at `app.py:92`. No `sk-ant-`, `x-api-key`, or hard-coded secrets in any `.js`, `.html`, or `.css`. `static/shared/config.js` and `config.example.js` are comment-only stubs that explicitly direct the reader to set the key server-side.

### 3.2 Unproxied external fetches from the browser

Only two outbound URLs, both to a pinned GitHub Pages CDN for soundfont data:
- `static/intro/ch1-sound.js:276` — `fetch('https://gleitz.github.io/midi-js-soundfonts/MusyngKite/oboe-mp3.js')`.
- `static/intro/scrollymess-ch1-sound.js:124` — same URL (orphan file, probably about to delete).

Plus `static/shared/keyboard-view.js:466` fetches from the same origin via `${MUSYNGKITE_BASE}${sfName}-mp3.js`. Known static asset, no secrets. **info** — worth mirroring to your own CDN for supply-chain hygiene, but not urgent.

No direct calls to `api.anthropic.com`, `openai.com`, or other AI providers from the browser. All AI traffic routes through `/api/chat` proxy.

### 3.3 `/api/chat` proxy completeness

`app.py:85–126`. Reviewed in detail.

- **info** — Rate limit: in-memory per-IP, 30 req/min. Effective against casual abuse; will reset across worker restarts and across the 15 s Railway cold-start. Doesn't defend against distributed abuse. Acceptable for current scale.
- **info** — `max_tokens` clamped to 1024 (108). Good.
- **warning** — `model` is caller-controlled (107). An attacker can request `claude-opus-4-7` instead of the default Haiku, burning your Anthropic budget. Add an allowlist: `{"claude-haiku-4-5-20251001", "claude-sonnet-4-6"}` and reject anything else.
- **warning** — `system` prompt is caller-controlled (110–111). That is **prompt-injection-by-design** for this app (a client-side tutor lets the caller shape the system prompt). Fine for the current internal use case, but anyone who discovers the endpoint can use your API key as a generic Claude proxy. Mitigation: either (a) move `system` prompt to server-side and accept only a `persona: string` key, or (b) add Origin/Referer check.
- **info** — CORS: Flask default (no `Access-Control-*` headers). Browser's same-origin policy prevents cross-site use. Acceptable. There is no `flask_cors` in the repo (confirmed).
- **info** — Errors return `"error": "Upstream request failed"` on exception (126). Doesn't leak stack traces.
- **warning** — No body-size cap specific to this endpoint. Only the app-wide `MAX_CONTENT_LENGTH = 16 MB` (75) applies. A 5 MB JSON body with a giant `messages` array is billable to Anthropic. Add a length cap on `messages` before proxying.

### 3.4 User input → eval / innerHTML / SQL

**`new Function(...)` hits:**
- `static/skratch-studio/sandbox.js:78` — compiles Blockly-emitted code. Same-origin user-supplied; single-tenant app (no shared server state), so no cross-user risk. **info**.
- `static/skratch-studio/studio.js:1700, 1936` — similarly evaluates Blockly user code. **info**.
- `static/shared/keyboard-view.js:479` — parses a **trusted CDN** soundfont JS file (`MIDI.Soundfont.xxx = {...}`). Has an inline comment explicitly noting "This is safe because the source is the known CDN gleitz.github.io, not user input." Accurate, but worth an eslint-disable allowlist plus an SRI hash on the fetch long-term. **info**.
- `static/intro/ch1-sound.js:282` — same pattern, same CDN. **info**.
- `static/intro/scrollymess-ch1-sound.js:130` — same (orphan file).

**`innerHTML =` hits:** 135 occurrences across 34 files. Spot-checked the highest-count files (explorer.html has 3; walkthrough-sidebar.js has 10; theory templates have 5+). All observed sites assign either:
- hard-coded markup (e.g. `container.innerHTML = '<div class="rhythm-empty">...</div>'`, `explorer.html:2032`), or
- template-literal strings built from trusted internal data (walkthrough names, chord symbols, song titles from `song-examples.js`, computed note names). No user-typed free-form input reaches innerHTML in the sampled paths. **info** — full audit still warranted before supporting user-named playlists or comments, but clean for current feature set.

**`document.write` / `insertAdjacentHTML`:** no hits.

**SQL:** no SQL, SQLAlchemy, or raw DB access in `app.py`. Scores persist to a JSON file via `_save_score` in `game_engine.py`. No user-controlled path segments reach `open()`.

### 3.5 localStorage tampering

15 files use localStorage. Inventory:
- `ai.js` — per-game attempt history, session history.
- `progress.js` — leaderboard-style scores.
- `user-profile.js` — UUID, topic status, game progress, intro progress, feature flags.
- `audio-input.js` — preferred audio device ID.
- `midi-input.js` — preferred MIDI device ID.
- `audio-toggle.js`, `visual-toggle.js` — user preference.
- `theory-engine.js` — tooltip seen-flag.
- Games — per-game best scores.

**info** — Everything is client-local; nothing server-authoritative lives in localStorage. Scores are not signed (any user can edit to 9999), but there is no competitive leaderboard against other users, so tampering impact is limited to self-deception. **warning** — `user-profile.js:46` `_save()` has no try/catch; Safari private mode / quota-exceeded throws will bubble up through `initProfile`, `updateTopicStatus`, `markChapterComplete`.

### 3.6 CORS / security headers

No CSP meta tag, no `X-Frame-Options` header, no `Strict-Transport-Security` set explicitly (Railway may add HSTS in front). **info** — acceptable for current rollout; revisit before opening auth/payments.

### 3.7 File upload: `/play` endpoint

`app.py:297–378`. Accepts `multipart/form-data` with an `audio` field.

- **info** — `app.config['MAX_CONTENT_LENGTH'] = 16 MB` (75) caps payload.
- **info** — `librosa.load(io.BytesIO(audio_file.read()))` (322) decodes via soundfile/audioread. These libraries have had CVEs historically (libsndfile, ffmpeg) but upload is gated behind same-origin UI and rate-limit-equivalent constraints (single concurrent user on Railway hobby). Log-only risk.
- **info** — `_save_score` (368) persists `player` name straight from form input to JSON. Name is only ever displayed, not re-rendered as HTML, not used as a path.
- No path traversal: the route never constructs filesystem paths from user input.

### 3.8 Polyrhythm `fetch(...)` and `AI` feedback

`static/games/polyrhythm.js:1` innerHTML use looks like static assignments; not flagged.

`ai.js:343` swallows fetch errors silently. A malicious server proxy could return invalid JSON or HTML; the consumer only tries `.content?.[0]?.text`, so the failure mode is benign. **info**.

---

## 4. Architecture Health

### 4.1 `_suppressAutoPlay` pattern in `explorer.html`

**warning**. The flag is defined at `explorer.html:2509` and manipulated at 17 sites (1922, 1924, 2412, 2414, 2509, 2600, 2607, 2715, 2720, 2722, 2798, 2856–2859, 2870, 2872, 2884, 2899, 3400, 3421). `docs/SESSION_LOG.md:70` already calls this out:

> The `_suppressAutoPlay` pattern is becoming load-bearing — may need a more principled audio-trigger architecture.

Agreed. Current usage is entirely inside the Explorer template — it's not a shared convention. The core problem: `HarmonyState.update(...)` has a single listener path in `keyboard-view.js` that both **renders** (visual highlight) and **plays audio**. Any code path that wants a silent state change wraps the update in a suppressor block.

Replacement options, rough ordering of ambition:
1. **Split the listener.** `HarmonyState.on('render', fn)` vs `HarmonyState.on('playback', fn)`. `keyboard-view.js` subscribes to both; callers that want silent updates just skip the playback path. Minimal API change; caller burden.
2. **Event-source tagging.** `HarmonyState.update(state, { source: 'walkthrough' | 'user' | 'midi' | 'sync' })`. Audio plays only for `source !== 'sync'`. Moves the decision into the consumer.
3. **Separate methods.** `setChord()` is silent; `playChord()` plays; `setAndPlay()` is the explicit both. Zero magic. Biggest churn.

Option 2 is the cheapest migration and gives the most leverage for future inputs (MIDI source tagging already exists per STATUS.md). Recommend.

### 4.2 HarmonyState pub/sub — subscription leaks

**info — clean.** Surveyed all 16 call sites. Every class-based consumer stores the returned unsubscribe (`_unsub = HarmonyState.on(...)`) and releases it in `destroy()`:

- `tonnetz-neighborhood.js:1265`
- `chord-bubble-renderer.js:326`
- `fretboard-view.js:222`
- `keyboard-view.js:684`
- `visual-layer.js:102`
- `js/chord-wheel.js:516`
- `intro/ch5-tonnetz.js:347`

Template-level `.on()` calls (`explorer.html:2553`, `test-fretboard.html:190`, `test-shared.html:292`, `chord-wheel-test.html:515`, `theory/chord-progressions.html:1112`, `theory/circle-of-fifths.html:418`) are page-lifetime subscriptions; leak-equivalent but fine since navigation is a full reload. No dynamic mount/unmount exists that would accumulate subscribers.

### 4.3 Tone.js AudioContext lifecycle

**warning — multiple contexts co-exist at runtime.** Confirmed:

1. **Tone's default context** — used by `audio.js:72` (`Tone.getContext().rawContext`), `audio-toggle.js:33` (`Tone.context.state`), `keyboard-view.js:590` (`Tone.context.state !== 'running'`), `skratch-studio/studio.js:1238`, `skratch-studio/loop-pedal.js:229`, intro chapters, polyrhythm game.
2. **`audio-input.js:239`** — creates an independent `new AudioContext()` for the mic stream, then tries to wire into Tone's context's analyser (see §1 cross-context finding). **critical for correctness.**
3. **`pitch-detection.js:232`** — creates yet another independent `new AudioContext()` for the YIN ScriptProcessor. Separate from Tone's. Works because it never attempts to connect to Tone nodes, but a third live AudioContext burns battery, especially on mobile.
4. **Polyrhythm game** (`static/games/polyrhythm.js:1152`) creates its own `Tone.Analyser` and calls `new Tone.UserMedia()` (1170). Another analyser on the same (Tone) context — fine in isolation.

Recommend: one rule — "all audio in Tone's context." Retrofit `audio-input.js` and `pitch-detection.js` to pull `Tone.getContext().rawContext` instead of minting their own. This also unblocks the documented goal of routing live mic into Spectrum panel.

**info — `Tone.start()` gestures.** Properly gated at `audio-toggle.js:34`, `polyrhythm.js:1169`, `relative-key-trainer.js:2654`, `scale-builder.js:1724`, `swing-trainer.html:552`, `skratch-studio/music-engine.js:35`, `loop-pedal.js:138`, `audio-bridge.js:150`. Consistent pattern across the app.

### 4.4 Template inheritance

**warning — 5 templates are standalone HTML (no `{% extends 'base.html' %}`):**

| Template | Route | Intentional? |
|---|---|---|
| `templates/explorer.html` | `/explorer` | Yes — DAW layout reproduces nav inline (verified lines 1–30). |
| `templates/skratch-studio.html` | `/skratchlab` | Yes — DAW layout. |
| `templates/skratch-studio-help.html` | `/skratchlab/help` | **warning** — no back link. |
| `templates/piano-popout.html` | `/skratchlab/piano-popout` | Yes — chromeless popout window. |
| `templates/base.html` | — | Not a page, intentional. |

STATUS.md's "Swing Trainer doesn't extend base.html" is **stale**. `templates/games/swing-trainer.html:1` → `{% extends "base.html" %}` (verified). The standalone copy is `static/games/swing-trainer.html` (served nowhere) — should be deleted.

### 4.5 `chord-resolver.js` vs `chord-detection.js` — merge?

**warning — partial merge, not full.**

Current factoring:
- `chord-resolver.js` — pure-math symbol resolution: given pitch classes, return a chord name. Also handles key-aware disambiguation.
- `chord-detection.js` — audio-processing path: FFT frames → chroma vector → template correlation → pitch classes → bass note → emit.

The audio-to-pitch-class pipeline is real work and belongs in `chord-detection.js`. But:
- `chord-detection.js` has its **own** `CHORD_TEMPLATES` (52) and `QUALITY_SYMBOLS` (66) — duplicates of `chord-resolver.js` `CHORD_TYPES` (31–48) and `transforms.js` `CHORD_TYPES`.
- After template match, `chord-detection.js` then pipes through `resolveChord()` anyway (via the import on line 12) for key-aware disambiguation.

**Recommendation:** do not merge the files. Do dedupe the chord-template data. Canonicalize `CHORD_TYPES` in `transforms.js`; `chord-resolver.js` should import from there; `chord-detection.js` should derive its binary templates from the same source (intervals → 12-bit mask is trivial). One registry to update when a new chord quality is added.

---

## 5. User Testing Readiness — Route Audit

### Summary table

| Route | Template | Extends base | 404 risk | Nav | Mobile | Ready | Fix needed |
|---|---|---|---|---|---|---|---|
| `/` | `index.html` | Yes | None | Yes | Low | **Yes** | — |
| `/relative` | `relative.html` | Yes | None | Yes | Low | **Yes** | — |
| `/tone-check` | `tone-check.html` | Yes | None | Yes | Low | **Hide** | Dev artifact |
| `/chord-identification` | `chord-identification.html` | Yes | None | Yes | Low-Med | **Yes** | — |
| `/harmony` | `harmony.html` | Yes | None | Yes | Med | **Yes** | — |
| `/melody` | `melody.html` | Yes | None | Yes | Med | **Yes** | — |
| `/rhythm` | `rhythm.html` | Yes | **High** | Yes | Med | **No** | `rhythm.js` calls dead routes (`/start_listen`, etc.) |
| `/strumming` | `strumming.html` | Yes | **High** | Yes | Med | **No** | `detection.js` calls dead routes |
| `/games/chord-walks` | `relative-key-trainer.html` | Yes | None | Yes | Med | **Yes** | — |
| `/games/scale-builder` | `scale-builder.html` | Yes | None | Yes | Med | **Yes** | — |
| `/games/swing-trainer` | `games/swing-trainer.html` | Yes | None | Yes | Med | **No** | Known 500 — repro & fix |
| `/games/polyrhythm` | `games/polyrhythm.html` | Yes | None | Yes | Med | **Yes** | — |
| `/skratchlab` | `skratch-studio.html` | No (intentional) | **High** | Yes (mirrored) | High (fixed-width DAW) | **No** | Dead import `startPitchDetection` in `audio-bridge.js` |
| `/skratchlab/help` | `skratch-studio-help.html` | No | None | **No** | Low | **Needs polish** | Add back link |
| `/skratchlab/piano-popout` | `piano-popout.html` | No (intentional) | None | N/A | N/A | **Yes** | — |
| `/test_sustain` | `static/skratch-studio/test-sustain.html` | No | **High** | No | Low | **Hide** | Dev, and inherits dead import |
| `/test-tooltips` | `test-tooltips.html` | Yes | None | Yes | Low | **Hide** | Dev artifact |
| `/test/shared` | `test-shared.html` | Yes | None | Yes | Low | **Hide** | Dev artifact |
| `/test/fretboard` | `test-fretboard.html` | Yes | None | Yes | Low | **Hide** | Dev artifact |
| `/showcase` | `showcase.html` | Yes | Warning | Yes | Low | **Hide** | Marketing/dev; not nav-linked |
| `/explorer` | `explorer.html` | No (intentional) | None | Yes (mirrored) | High (DAW) | **Yes (desktop)** | Add "desktop recommended" banner for <900px |
| `/tutorial` | `tutorial.html` | Yes | None | Yes | Low | **Yes** | — |
| `/chord-wheel-test` | `chord-wheel-test.html` | Yes | None | Yes | Low | **Hide** | Dev artifact — title says "Isolation Test" |
| `/theory/circle-of-fifths` | `theory/circle-of-fifths.html` | Yes | None | Yes | Med | **Yes** | — |
| `/theory/tonal-centers` | `theory/tonal-centers.html` | Yes | None | Yes | Med | **Yes** | — |
| `/theory/chord-progressions` | `theory/chord-progressions.html` | Yes | None | Yes | Med | **Yes** | — |
| `/theory/modes` | `theory/modes.html` | Yes | None | Yes | Med | **Yes** | — |
| `/intro` | `intro/hub.html` | Yes | None | Yes | Low | **Yes** | — |
| `/intro/<n>` | `intro/chapter.html` | Yes | None | Yes | Low | **Yes** | — |

### Routes NOT ready for user testing — punch list

#### critical — `/skratchlab` broken on load
**File:** `static/skratch-studio/audio-bridge.js:12`.
**Issue:** imports `startPitchDetection, stopPitchDetection` from `../shared/audio.js`, but those exports no longer exist. `studio.js:9` and `music-engine.js:3` import from `audio-bridge.js`, so **SkratchLab fails to initialise**.
**Fix:** either (a) restore thin wrappers in `audio.js` that call `createPitchDetector` from `pitch-detection.js`, or (b) rewrite `audio-bridge.js:12,491,518` to import `createPitchDetector` directly. Option (b) is cleaner.

#### critical — `/rhythm` mic/tap detection broken
**Files:** `static/rhythm/rhythm.js:549, 561, 589`.
**Issue:** calls `/start_listen`, `/poll_audio`, `/stop_listen` — none exist in `app.py`. Any user who enables mic-based tap detection hits 404.
**Fix:** migrate to `onset-detection.js` via `input-provider.js`, or (quicker stopgap) disable the mic path in the UI until migration lands.

#### critical — `/strumming` mic/strum detection broken
**Files:** `static/strumming/detection.js:80, 114, 220`.
**Issue:** same dead routes.
**Fix:** same — migrate to `onset-detection.js`, or disable the mic path until then.

#### critical — `/games/swing-trainer` 500
**Template:** `templates/games/swing-trainer.html` (this one **does** extend base.html — STATUS.md is stale on that point).
**Issue:** known 500 on production, not yet reproduced in dev.
**Fix:** (a) repro locally; most likely a runtime error in inline JS or a missing `url_for` asset; (b) delete the stale `static/games/swing-trainer.html` so it can't confuse anyone later.

#### warning — `/skratchlab/help` orphan
**Template:** `templates/skratch-studio-help.html:1–5` — standalone, no nav, no back link.
**Fix:** add a prominent "← Back to SkratchLab" link at the top. Also has the `.mtt-header*` CSS family — consider renaming to `.sl-nav*` to match the rest of the app.

#### warning — 7 dev routes still exposed
All of `/test_sustain`, `/test-tooltips`, `/test/shared`, `/test/fretboard`, `/chord-wheel-test`, `/tone-check`, `/showcase` are reachable via direct URL. Not nav-linked, but shareable. Testers who copy-paste URLs will land on obvious dev pages (chord-wheel-test literally says "Isolation Test" in its title).
**Fix:** comment out these six route handlers in `app.py:174–262` (or gate with `if app.debug:`) before April 2026 testing session.

#### info — `/explorer` desktop-only
Standalone DAW layout with media queries at `max-width: 1100px` and `max-width: 900px`, but the 5-tab panel UX requires width. STATUS.md confirms mobile is deferred.
**Fix (optional):** add a "Best viewed on desktop" hint for <900px viewports. Otherwise just warn testers up front.

#### info — `/melody` mic permission UX
`templates/melody.html:908` calls `createPitchDetector().start(...)` inside `handleStart()` — first mic prompt fires on click. If browser denies or delays, line 922 shows error in game feedback. No pre-click "we'll ask for mic" hint. Non-blocker, nice polish.

---

## Appendix — What's in good shape

Noting these explicitly so the review isn't lopsided:

- HarmonyState subscriber hygiene is clean — every class consumer owns an unsub (§4.2).
- The AI proxy (`/api/chat`) correctly keeps the Anthropic key server-side, rate-limits, and doesn't leak stack traces (§3.3). The two hardening items (model allowlist, fixed system prompt) are material but not blockers.
- No SQL, no secrets in client code, no unproxied third-party API calls aside from a pinned CDN soundfont (§3.1, §3.2).
- Template inheritance is deliberate and consistent — the 4 standalone templates are intentional standalones (DAW layouts or popouts), not strays (§4.4). The STATUS.md note about Swing Trainer is just stale.
- The factory-pattern detection modules (`pitch-detection`, `chord-detection`, `onset-detection`, `input-provider`) are the right design for the migration — they just need the sample-rate bug fixed, the cross-context connection fixed, and the naming standardized (§1).
- Dead-function cleanup is mostly done; only one broken import remains, and it's localized to `audio-bridge.js` (§2).
