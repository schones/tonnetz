# Cantor — Design Document

**Status:** Design draft v2, 2026-04-27 (revised after first design pass)
**Codename:** Cantor (after the lead singer who carries the melody;
also resonant with Georg Cantor's mathematical lineage)
**Relationship to existing work:** New visualization mode in
SongLab. Sibling to Harmonograph, not a replacement. Shares the
Tonnetz substrate, HarmonyState, MIDIInput, and the audio analysis
pipeline (pitch-detection.js, chord-detection.js).

---

## 1. Vision

Cantor renders music the way a listener experiences it, not the way
audio analysis describes it.

A listener hearing Bésame Mucho perceives a melody dancing over a
harmonic stage. They don't perceive "47 individual note events per
second across multiple frequency bands." Cantor closes that gap. It
introduces a perceptual interpretation layer between audio analysis
and visual rendering, so the visualization reflects the song's
musical *shape* — its melodic gesture, its harmonic motion, its
rhythmic feel — rather than the literal density of its underlying
signal.

The design intent, in one sentence: **the lit nodes should dance the
same way the melody does.**

This is a different product from Harmonograph. Harmonograph reacts
to raw audio features (RMS, FFT, onset density). Cantor interprets
musical content (melody, harmony, gesture). Both have their place;
Cantor is for moments when the listener wants the visualization to
illuminate *the song*, not the *audio*.

**Cantor is a visual instrument whose expressive vocabulary you
compose with.** The visualization is not a fixed mapping from audio
to pixels — it is a set of expressive channels (motion, brightness,
saturation, scale, color, shimmer, breath, drift) that can be
allocated to different musical content depending on context. v1
ships with a specific allocation; future versions expand the
vocabulary and may offer multiple mappings selectable by user,
piece, or pedagogical context. The system's value comes from the
richness and orthogonality of its channels, not from any single
fixed interpretation.

## 2. Design principles

**Music has shape.** Melody is a line drawn in pitch-time space. The
Tonnetz makes that line geometrically real — every interval is a
direction, every melodic gesture is a path. Cantor renders the path,
not just the points.

**The melody is the star.** Of all the perceptual streams in a piece
of music, the melody is the one that listeners track most actively.
Cantor gives it foreground brightness and motion. Other layers
(harmony, bass, texture) provide context without competing.

**The torus is space, not motion.** Harmonograph's RMS-driven spin
is decorative. In Cantor, the torus is a stage on which the dance
happens. It drifts slowly to feel alive but does not react to audio.

**Silences are peaceful.** When the music goes quiet, the
visualization should not collapse. Existing state continues to fade
gracefully, and the torus continues to drift, until the next
musical event.

**Real musical interpretation is hard, but tractable.** Polyphonic
audio analysis from arbitrary recordings is a research problem.
Polyphonic analysis from clean piano signal is solvable. MIDI
analysis is trivial. Cantor commits to the problem honestly, leans
on clean inputs first, and degrades gracefully on harder ones.

**Reserve expressive bandwidth.** Visual channels (breath, drift,
saturation, color, brightness, etc.) should exist before they're
strictly needed. Adding a channel later is harder than reserving it
now and binding it to musical content as the design matures.
Channels start decorative and become semantic over time.

## 3. Input model

Cantor is **input-agnostic**. Its perceptual layer reads from a
unified `MusicalEventStream` interface that abstracts over the input
source. The interpretation logic is the same regardless of where
events came from.

```
[MIDI input]    ─┐
                 ├─→ MusicalEventStream ─→ Cantor perceptual layer ─→ visual render
[Audio input]   ─┘
                 (note attacks, sustained notes, chord context, releases)
```

### MIDI input (v1, clean signal)

When a MIDI device is connected, MIDIInput publishes note events
directly into the stream. Velocity, exact timing, and channel
information come through cleanly.

**Melody/accompaniment split:** user-designated split point on the
keyboard. Default: middle C (MIDI note 60). Notes above the split are
melody; notes at or below are accompaniment. The split point is a
**prominent, draggable UI element** overlaid on the rendered
keyboard — a vertical line with a handle that the user can grab and
slide in real time. Visually obvious that it exists to be adjusted.
Matches how pianists naturally think about right-hand-melody,
left-hand-comp arrangements and works for the vast majority of solo
piano repertoire.

**Future extension:** channel-based split for setups where the user
configures their MIDI controller to send melody and accompaniment on
different channels (e.g., split keyboard with two zones). Not in v1.

### Audio input (v2, clean signal sources)

When audio is the source — solo piano played through an audio
interface, or a clean recording played through Loopback —
audio-input.js feeds the analysis pipeline:

- pitch-detection.js → monophonic pitch (when one note dominates)
- chord-detection.js → polyphonic chord context
- New: audio-onset-detection → note attack events from audio
- New: highest-active-pitch → melody candidate from polyphonic content

These four signals combine to produce `MusicalEventStream` events.
Less precise than MIDI (latency ~50–150ms; occasional pitch errors;
no clean melody/accompaniment separation on legato passages), but
fully functional for clean inputs.

**Heuristic for melody on audio:** highest sustained pitch is the
melody candidate. Works for ~80% of typical piano repertoire (any
melody-on-top arrangement). Fails on left-hand-leading passages,
inverted voicings, dense polyphony. Documented limitation; not a
blocker.

### Harder cases (out of scope for v1/v2)

Mixed recordings (band, orchestra, vocals + instruments), heavily
processed audio, anything where melody extraction is genuinely a
research problem. Cantor will accept these inputs but produces
unreliable results. Users wanting to visualize arbitrary recordings
should use Harmonograph (raw audio reactivity) instead.

## 4. Perceptual layers

Cantor decomposes music into four streams, rendered as visually
distinct elements:

| Layer    | Source                              | Visual treatment           |
|----------|-------------------------------------|----------------------------|
| Melody   | Highest voice / above-split MIDI    | Dancer's Body constellation|
| Harmony  | Chord-detection / sustained notes   | Triangle wash + change flash|
| Texture  | Spectral flatness, onset density    | DEFERRED (v3)              |
| Rhythm   | Tempo estimate, beat position       | DEFERRED (v3)              |

V1 ships with melody and harmony layers. Texture and rhythm are
designed for but not built — see Section 8.

## 5. Visual vocabulary

### Melody — Dancer's Body

The melody is rendered as a constellation of recently-played notes,
visible simultaneously, fading from newest to oldest.

- **Window:** ~2 seconds of melody history. Duration-based, not
  count-based, so phrasing comes through naturally regardless of
  tempo. (At 80 BPM in 4/4, ~2 seconds covers about a measure of
  eighth notes or two measures of quarter notes — a typical
  melodic phrase.)
- **Visual element per note:** the corresponding Tonnetz node lit
  with a "leading" color, with a small glow radius. New notes start
  at full brightness.
- **Color:** the melody's color is *of* the harmony, not separate
  from it. Each constellation node takes its tint from the active
  chord's quality color (warm for major, cool for minor, etc.) — at
  higher saturation than the chord wash, so the melody is visually
  the brightest, most-saturated instance of the current harmonic
  color. When the chord changes, the constellation's tint shifts
  with it. This unifies melody and harmony into one color language
  while preserving melody's visual primacy via brightness.
- **Decay:** exponential opacity fade over the 2-second window.
  Newest note ~1.0 opacity. Note from 2 seconds ago ~0.0.
- **Repeated notes:** if the same note repeats, the existing node
  brightens further (clamps at 1.0) rather than spawning a duplicate.
  This makes rhythmic emphasis (repeated melody notes) visually
  punchy.
- **Velocity:** initial brightness scales with attack velocity.
  Louder notes are visually punchier; soft notes are subtle. Radius
  and color are velocity-independent in v1.
- **Large leaps:** the constellation stretches across the Tonnetz
  to capture the gesture. Visual incoherence is a feature; melodic
  leaps *should* feel visually large.
- **Gap behavior:** if no melody note for >2 seconds, constellation
  fully fades. The Tonnetz returns to chord-only state. Next melody
  attack starts a fresh constellation.

### Harmony — Stage

Chord context is rendered as a soft wash over the chord's Tonnetz
triangle, plus a brief flash on chord change.

- **Wash:** the three nodes of the active chord's triangle (e.g.,
  C-E-G for Cmaj) light at 25–30% brightness with a soft fill across
  the triangle interior. Color reflects chord quality:
    - Major: warm (e.g., gold-amber)
    - Minor: cool (e.g., teal-blue)
    - Dominant: yellow
    - Diminished: red-tinged
    - Augmented: violet
    - Suspended: neutral gray-cyan
  The wash makes the chord's *region* visible, not just its points.
  This is what makes Tonnetz visualization meaningful — chords are
  areas of the harmonic space, not collections of notes.
- **Sevenths and extensions:** the seventh node (e.g., B in Cmaj7)
  is dimly lit (~15% brightness) but does not extend the wash. The
  seventh is a color on the chord, not a structural change.
- **Chord-change flash:** when the chord changes, the new chord's
  three nodes briefly pulse to ~70% brightness, then settle to
  ambient (~30%) over 300–500ms with exponential falloff. The flash
  is the perceptually salient event; the settled wash is the
  ongoing context.
- **Cross-fade between chords:** during a chord change, the old
  wash fades out while the new wash flashes in. The two are briefly
  visible simultaneously, interpolated over the same ~400ms window
  as the flash decay. This avoids a hard visual cut and lets the
  listener feel the harmonic motion as continuous.
- **Ambiguity (multiple candidates):** when chord-detection has
  multiple candidates above its confidence threshold, render *all*
  of them simultaneously, each with saturation proportional to its
  confidence (sum-normalized to 1). When ambiguity resolves to a
  clear chord, the others fade out. This makes harmonic ambiguity
  visually honest — the audio actually contains multiple
  possibilities, and the visualization reflects that uncertainty
  rather than guessing. Saturation thus encodes a unified
  "certainty" signal: tonal+unambiguous = full saturation,
  tonal+ambiguous = partial saturation, noise = no saturation.
- **Quiet override:** when the melody constellation is active, the
  chord wash should remain visually subordinate. Melody node
  brightness > chord wash brightness, always. The melody can
  *touch* a chord wash region (e.g., melody on E while Cmaj is
  active lights up E's node both from the melody constellation and
  the chord wash, brighter than either alone) — this is correct and
  desirable.

### Torus — Space

The torus is the stage on which everything else happens. It does not
react to audio in v1, but it does *breathe* — a subtle decorative
motion that establishes the torus as a living surface and reserves
expressive bandwidth for future musical mappings.

- **Geometry:** same as Harmonograph's Stage 1 torus.
- **Rotation:** ambient slow drift. Y-axis only. Default rate: one
  full revolution per ~45 seconds. User-configurable.
- **Breathing (decorative in v1):** the torus's major radius slowly
  swells and contracts by ±5% over a ~6–10 second period. Subtle —
  felt more than seen. Currently un-mapped to musical content.
  Reserved for future binding (possibilities: smoothed dynamic
  energy, harmonic tension, melodic phrase shape, manual user
  setting). Even when bound, breathing should remain ambient — the
  torus should never feel like it's *gasping*.
- **No morph:** Cantor's torus does not morph toward sphere. The
  full Tonnetz triangle structure remains visible at all times. The
  chord wash mechanic depends on the triangle structure being
  legible, and sphere-mode geometry would obscure it.
- **No dynamic alpha:** triangle stroke and fill stay at fixed
  opacity. No audioReactive overlay.

### Channels reserved for future mapping

Cantor v1 ships with some visual channels actively bound to musical
content (constellation → melody, wash → harmony, flash → chord
change), and others currently decorative or static (breathing, slow
drift). The decorative channels are deliberately *available* for
future binding to musical content as the design matures. New
channels — saturation, scale, tilt, particle density, glow falloff,
etc. — can be added incrementally as Cantor's expressive vocabulary
grows.

The list below is illustrative, not exhaustive:

| Channel              | v1 binding         | Future binding candidates              |
|----------------------|--------------------|----------------------------------------|
| Constellation pos    | Melody pitch       | (already bound)                        |
| Constellation color  | Chord quality      | (already bound)                        |
| Constellation bright | Velocity + age     | (already bound)                        |
| Wash color           | Chord quality      | (already bound)                        |
| Wash saturation      | Detection certainty| (already bound, v1)                    |
| Torus rotation       | Static drift       | Tempo, phrase shape, harmonic motion   |
| Torus breath         | Decorative cycle   | Dynamics, harmonic tension, dynamics   |
| Triangle stroke      | Static             | Texture, register, density             |
| Background           | Static dark        | Mode/key, section, song-level color    |
| Particle/shimmer     | (not in v1)        | Spectral flatness, percussion          |
| Glow falloff         | Static             | Reverb amount, "space" of the room     |

### Phrase boundaries (v3, possibly later)

A previous design sketch proposed phrase-driven torus rotation —
advancing rotation only at phrase ends. Dropped from v2. Reasoning:
the steady drift already gives the visualization a sense of motion,
and phrase-driven rotation would have required a phrase-detection
algorithm (silence threshold + harmonic resolution) that doesn't
yet exist.

The `phraseEnd` event type is reserved in MusicalEventStream's API
for future use without committing to detection now. When phrase
detection eventually lands (likely in v3 alongside texture and
rhythm), it can drive things like a brief constellation linger at
phrase ends, or a momentary settle in chord wash intensity. The
torus rotation itself stays steady.

## 6. Animation behaviors and timing

### Melody constellation
- Window duration: 2.0 seconds (configurable)
- Decay curve: exponential, time constant ~0.7s
- Per-note glow radius: 1.5x the dim chord-node radius
- Color: chord-quality-driven, full saturation. Shifts with chord.
- Velocity → initial brightness scaling: linear, MIDI velocity 0–127
  → brightness 0.3–1.0 (so even soft notes are visible, but loud
  notes pop)

### Chord wash
- Active wash brightness: 0.25–0.30 (relative to melody peak 1.0)
- Wash color: quality-mapped (table in Section 5)
- Triangle fill alpha: 0.10–0.15 (subtle, so it reads as "field"
  rather than "object")
- Ambiguity behavior: when multiple candidates above threshold,
  saturation per-candidate = (its confidence) / (sum of all
  above-threshold confidences). Candidates fade in/out as their
  confidence crosses threshold.

### Chord-change flash
- Peak brightness: 0.70
- Decay to ambient: exponential, 400ms time constant
- Affects only the three chord-triangle nodes, not the seventh
- Cross-fade: old wash fades out over the same 400ms window as
  new wash flashes in. Both visible briefly, weighted by progress
  through the change.

### Torus drift
- Rate: 8 deg/sec default (one revolution per 45s)
- Axis: Y only (donut-hole horizontal)
- Constant rate in v1 (no random variation)

### Torus breath (v1, decorative)
- Major radius modulation: ±5% of base
- Period: 8 seconds (sine wave)
- Phase: independent of any other timing
- Currently un-mapped to musical content

## 7. Architecture

Cantor is a **new view** alongside HarmonographView. They share
infrastructure but render independently:

```
HarmonyState (existing)
  ├─→ HarmonographView (existing, untouched)
  └─→ CantorView (new)

MusicalEventStream (new abstraction)
  ├─← MIDIInput (existing, wired up)
  └─← AudioInterpreter (new module — wraps pitch-detection,
                         chord-detection, onset-detection)
       └─→ CantorView reads from this
```

### File plan
- `static/shared/cantor-view.js` — new view class. Owns its own
  rendering loop, reads MusicalEventStream and HarmonyState,
  writes to its own canvas.
- `static/shared/musical-event-stream.js` — new module. Defines
  the event types (`noteAttack`, `noteRelease`, `chordChange`,
  `phraseEnd`). Provides `subscribe()` / `publish()` API. MIDIInput
  and AudioInterpreter publish; CantorView subscribes.
- `static/shared/audio-interpreter.js` — new module. Wraps
  pitch-detection, chord-detection, and a new audio-onset
  detector. Emits `MusicalEventStream` events.
- `templates/cantor.html` — new route. Mirrors harmonograph.html's
  shell but instantiates CantorView.
- Flask route: `/cantor` → renders cantor.html.

### Reused infrastructure (untouched)
- `harmony-state.js` — chord state pub/sub
- `tonnetz-neighborhood.js` — Tonnetz substrate, node positions
- `midi-input.js` — Web MIDI singleton
- `pitch-detection.js`, `chord-detection.js` — audio analysis
  primitives, called by AudioInterpreter
- `audio-input.js` — MediaStream lifecycle, dropdown UI
- `keyboard-view.js` — on-screen keyboard, Tone.js sampler

### What CantorView does NOT do
- Does not modify Harmonograph in any way
- Does not change HarmonyState's existing API (only consumes)
- Does not replace MIDIInput's existing publish path (just adds a
  new subscriber via MusicalEventStream)

## 8. Phased implementation

### v1 — Minimum viable Cantor (target: end of next session)

Inputs: MIDI only.

Visuals:
- Melody constellation (Dancer's Body), tinted by chord quality,
  velocity-scaled brightness
- Chord wash (quality-colored triangle fill + dim node glow)
- Chord-change flash with cross-fade interpolation
- Chord ambiguity rendered as multiple desaturated candidates
- Ambient slow torus drift
- Torus breathing (decorative, un-mapped)
- Prominent split-point UI overlaid on the keyboard view

Acceptance test: play simple solo piano arrangements (Linus and
Lucy, Peace Piece reduction, Bésame Mucho) on the Launchkey 49.
Verify:
- Right-hand melody appears as a constellation that dances on the
  Tonnetz, fading naturally
- Constellation color shifts with the chord underneath it
- Left-hand chord changes shift the wash, with a clear flash on
  each change, cross-fading between old and new
- Both layers coexist legibly — melody is visually dominant, chord
  is visually contextual
- Torus drifts gently and breathes subtly, doesn't react to audio
- Silences feel peaceful, not broken
- Split point can be moved without page reload

### v2 — Audio input (target: session 2 after v1)

Adds AudioInterpreter module wrapping audio analysis. Tests against:
- Solo piano played through audio interface (live)
- Clean recordings via Loopback: Bill Evans "Peace Piece", "Linus
  and Lucy" original, Fred Hersch solo standards

Limitations documented: melody-from-audio is heuristic (highest
voice), fails on left-hand-leading passages.

### v3 — Texture and rhythm (deferred)

Texture: spectral-flatness-driven saturation (the "music has color,
noise is gray" principle previously logged as a platform design
direction). Shimmer overlay for non-tonal content (Chladni-pattern
gold particles). Both already designed in prior sessions; pulled
into Cantor scope when v1/v2 are stable.

Rhythm: beat tracking, tempo-locked subtle pulse on torus or chord
nodes. Phrase detection (driving optional torus rotation experiment).

### v4 — Polish and pedagogy

Walkthrough integration (Cantor pairs naturally with the song
walkthroughs you already have). Color palette refinement. User
controls (split point, decay rate, chord wash intensity).
Possible "ghost trails" mode where multiple constellations from
recent phrases coexist as faded layers (the Phrase Painter sketch
from the original design conversation).

## 9. Reference test tracks

Live solo piano with clear melody-over-accompaniment structure.
These are the calibration corpus.

**Primary (v1 acceptance):**
- Bill Evans, "Peace Piece" — gold standard for slow, sparse,
  melody-over-held-harmony
- Vince Guaraldi, "Linus and Lucy" (original) — ostinato bass +
  dancing right-hand melody
- Bill Evans, "Waltz for Debby" (studio) — moderate tempo,
  clear chord changes, lyrical

**Secondary (v2 audio testing):**
- Brad Mehldau, "Knives Out" (Live in Tokyo, 2004) — complex
  two-handed counterpoint
- Keith Jarrett, "Köln Concert Part IIc" — extended ostinato +
  melodic exploration
- Fred Hersch, "I Fall in Love Too Easily" (Solo, 2015) — solo
  standard
- Tord Gustavsen, anything from Changing Places — spacious solo jazz

**Stress tests:**
- Glenn Gould, Bach Goldberg Variations Aria — classical melodic
  line, ornamentation, rubato
- Nils Frahm, "Says" — ostinato-only piece, "what does Cantor do
  when there isn't really a melody?"

## 10. Open questions

These are deliberately unresolved. Address during build or after v1
testing.

### Resolved during initial design conversation

- **Constellation color** → tracks chord quality. Melody is *of* the
  harmony.
- **Bass visualization** → deferred to v3 as separate third layer.
- **Onset velocity → visual** → brightness only in v1.
- **Chord ambiguity** → render all candidates, saturation
  proportional to confidence.
- **Cross-fade between chords** → interpolated, ~400ms.
- **Torus rotation** → keep slow steady drift in v1.
- **Phrase detection** → not needed for v1; reserved as event type
  for v3.
- **Split point UI** → prominent, on the keyboard view itself.
- **Tagline** → "See the song" for now, revisit later.

### Still open

1. **What drives the breathing?** Currently decorative. Future
   mapping candidates: smoothed dynamic energy, harmonic tension,
   melodic phrase shape, manual user setting, none (stays
   decorative). Decide after v1 ships and we can listen to it.

2. **Constellation window:** 2 seconds is a starting estimate. Will
   need ear-tuning against real performances. Too short → melody
   doesn't read as gesture. Too long → constellation feels stale or
   crowded. May need to be tempo-adaptive in v3.

3. **Ambiguity threshold:** what confidence cutoff causes a chord
   candidate to be rendered? Too low → flickery, every brief
   candidate appears. Too high → ambiguity is invisible, looks
   like silence. Tune after v1 against test corpus.

4. **What about a "no chord" state?** When the user is playing
   melody alone with no chordal accompaniment, the wash is empty.
   v1 just lets the melody constellation dance in empty space —
   probably correct, but worth confirming it feels right.

5. **Color palette specifics:** the quality-mapped colors (warm =
   major, cool = minor, etc.) need exact values. Pull from existing
   SongLab design tokens where possible. Probably the same
   quality-color-tokens used in Tonnetz/Explorer.

6. **Melody/audio mode (v2):** how is "highest sustained pitch"
   actually computed in real time from polyphonic chord-detection
   output? Use the highest-confidence note above the split-point
   pitch class? Use chroma vector + register tracking? Decide
   during v2 build.

7. **Performance on busy passages:** what happens on a fast melodic
   run (16th notes at 120 BPM)? 8 notes per second, 2-second
   window → up to 16 simultaneous constellation members. Visually
   too crowded? May need a max-count cap (e.g., always show last 8
   notes regardless of timing), or a faster decay during dense
   passages. Address during v1 testing.

8. **Default torus orientation:** does the torus start at a fixed
   rotation, or does it remember last orientation across sessions?
   Probably fixed default for simplicity in v1.

## 11. Naming and positioning

**Name:** Cantor.
- Carries musical lineage (cantor = lead singer in a chorus,
  one who carries the melody)
- Resonates with mathematical foundation (Georg Cantor, set theory)
- Tonal fit with platform's serious-but-warm voice (alongside
  Tonnetz, SongLab, SkratchLab)
- Deliberately less self-explanatory than alternatives (SongDancer,
  MelodyTrace) — assumes a curious user willing to learn the term

**Positioning:** Cantor is for moments when the listener wants the
visualization to illuminate the *song*. Harmonograph is for moments
when raw audio reactivity is the point (parties, noisy environments,
non-musical inputs). Both ship in SongLab; users choose based on
intent.

**Cantor as visual instrument:** Cantor is not a fixed mapping from
audio to pixels. It is a set of expressive visual channels —
constellation motion, color saturation, brightness, scale, drift,
breath, eventually shimmer/particles/glow falloff — that can be
allocated to different musical content depending on context. v1
ships with a particular allocation. Future versions expand the
vocabulary, refine the mappings, and may eventually offer multiple
mapping presets selectable by user, piece, or pedagogical context
(e.g., "lyrical mode" emphasizes melody and breath; "rhythmic mode"
emphasizes attack and pulse; "contemplative mode" slows everything
down).

This framing has architectural implications: each visual channel
should be independent and orthogonal. Adding a new channel later
should not require restructuring the rendering pipeline. Each
channel should expose a clean parameter that bindings can target.
Cantor's value compounds as its vocabulary grows.

**Tagline candidate:** "See the song." (Counterpart to Harmonograph's
"Music has a shape — see it.")

---

## Appendix A — Glossary

- **Dancer's Body:** the melody constellation visualization style.
  3–4 most recent melody notes shown simultaneously, fading newest
  to oldest. Captures gesture, not just current state.
- **Wash:** soft fill across a chord's Tonnetz triangle, plus dim
  glow on the three triangle nodes. Visualizes harmonic context as
  region rather than points.
- **Flash:** brief brightness pulse on a chord's three nodes when
  the chord changes. The perceptually salient event of harmonic
  motion.
- **MusicalEventStream:** abstract pub/sub interface that
  decouples Cantor's perceptual layer from its input source.
  Producers: MIDIInput, AudioInterpreter. Consumer: CantorView.
- **AudioInterpreter:** new module that wraps pitch-detection,
  chord-detection, and audio-onset-detection, emitting
  MusicalEventStream events from audio input.

## Appendix B — Relationship to other deferred ideas

This design doc consolidates several previously-deferred ideas:

- **"Music has color, noise is gray"** principle — folded into v3
  (texture layer)
- **Shimmer overlay (Chladni)** — folded into v3 (texture layer)
- **Multi-axis torus spin (Tonnetz-aware mapping)** — NOT folded
  in. Stays a Harmonograph idea. Cantor's torus is intentionally
  static.
- **Two-handed bass visualization** — folded into v3 as separate
  bass layer
- **Phrase-driven rotation** — folded into v2 as experiment

The Chladni educational content idea remains independent — it's a
content piece, not a Cantor feature.
