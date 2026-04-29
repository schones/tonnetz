# Beat Field — design doc

Status: design complete, pre-implementation.
Lives at: `/cantor` (Beat Field is a layer of the Cantor view, not a separate page).
Related docs: `docs/multi-axis-spin.md`, `docs/color-confidence.md`.

## Concept

Beat Field is the percussion-reactive backdrop layer of the Cantor view. Where the Cantor torus visualizes harmonic and melodic content (chord wash, melody constellation), Beat Field visualizes rhythmic content — drums, transients, percussive hits — through a field of grains that respond to strike events.

The visual model is grains of sand on a vibrating surface. At rest, the grains sit in a flat, unstructured layer. A percussion strike disturbs the surface from a specific origin point; ripples propagate outward; grains move in response and form a transient pattern; the surface settles back to flat as the strike's energy decays. Between strikes, the field returns to zero.

Naming and positioning fits alongside the platform's existing geometric-noun views: Cantor (chord/melody torus), Harmonograph (pendulum-traced harmony), Beat Field (percussion grain layer).

The Chladni-pattern reference that started this design has been deliberately set aside as a reference frame. Chladni-like nodal structure may emerge from sustained ripple interference in the long decay tail of long strikes, but it is not the foundation of the model. The foundation is grains on a vibrating surface, full stop.

## Design principles

- **Visualization-first, with atmosphere as a tunable knob.** v1 ships with parameters tuned for legibility — the viewer can read percussion content off the field. A bias parameter on the grain motion law slides the system toward atmosphere (chaotic shaking, less legible, more emotionally coupled) without code changes.
- **Single shared field.** All strikes superpose into one displacement field. The three input bands are a detection-side artifact, not a rendering-side concept. There is one plate, one field, one grain layer.
- **Flat resting state.** When no strikes are active, the field is at zero everywhere and grains relax toward uniform distribution. Optional low-amplitude ambient jitter ("breathe") may persist at rest. Patterns are events, not steady states.
- **Ripple-and-return event model.** Each strike is a transient. Strikes have origins, decay envelopes, and band-specific ripple characters. The visual gesture is emergence and dissolution, not modulation of a continuous state.
- **Architectural separation between input and rendering.** The strike event is the interface. Audio and MIDI paths produce identical strike-event shapes. The renderer doesn't know or care about the source.

## Pipeline

```
audio input ────► band split (low/mid/high) ────► onset detection per band ─┐
                                                                            │
                                                                            ▼
                                                                   strike event {
                                                                     band,
                                                                     time,
                                                                     spectral_features,
                                                                     origin: {x, y},
                                                                     decay_envelope
                                                                   }
                                                                            ▲
                                                                            │
MIDI input ────► channel-to-band routing ────► channel-to-position lookup ──┘

                                              │
                                              ▼
                                  active strike list (with per-strike age, decays out of list when below epsilon)
                                              │
                                              ▼
                                  shared displacement field
                                  D(x,y,t) = Σ active strikes
                                              amplitude(age) · ripple_shape(distance from origin, age, band)
                                              │
                                              ▼
                                  grain motion: random walk biased by |D| and/or |∇D|, bias weight = atmosphere knob
                                              │
                                              ▼
                                  torus occlusion alpha mask
                                              │
                                              ▼
                                  canvas 2D render, layered behind the SVG torus
```

The strike event is the canonical interface. Both input paths populate it; everything downstream is shared.

## Visual model

### Displacement field

```
D(x,y,t) = Σ amplitude(strike, t) · ripple_shape(|p - origin_strike|, age_strike, band_strike)
        active strikes
```

`ripple_shape(distance, age, band)` is a band-parameterized function returning a scalar displacement. It encodes:

- **Spatial frequency** — how tightly packed the ripple's oscillations are. High band = fine; low band = wide.
- **Propagation speed** — how fast the ripple expands from the origin.
- **Spatial envelope** — the falloff with distance from the leading wavefront.
- **Temporal envelope** — handled separately via `amplitude(strike, t)`, but ripple_shape may also have age-dependent shape (e.g., wavefront width grows with age).

`amplitude(strike, t)` is the per-strike decay envelope. Different bands may have meaningfully different envelopes (a kick decays slowly; a hi-hat decays fast).

### Grain motion law

For each grain at position `p`, per frame:

```
step = random_unit_vector() * step_size_base * f(|D(p,t)|)
     + bias_weight * (-∇|D(p,t)|) * gradient_step_size
```

The first term is the random-walk component — grains get kicked harder where the field is more agitated. The second term is the gradient-descent bias — grains drift toward lower vibration regions. `bias_weight` is the visualization-atmosphere knob:

- High bias (visualization end, v1 default) — grains converge quickly to low-`|D|` regions; patterns form fast and read clearly.
- Zero bias (atmosphere end) — pure random-walk shaking; patterns barely visible, percussion feels purely kinetic.

Grains do not interact (no pairwise forces). This keeps cost linear in grain count and avoids O(N²) compute.

### Resting state

When all active strikes have decayed out of the list, `D = 0` and gradients vanish. Grains continue their random walk with `step_size = ambient_jitter_amplitude` — a low-amplitude breathing motion that keeps the layer alive without producing pattern. Over time grains diffuse toward uniform distribution.

### Spatial origins, tied to torus pitch geometry

Each strike's origin point sits in a band-appropriate region around the torus's screen-space outline. Origins are not random — they encode pitch position.

- **Audio path:** the strike's spectral content (centroid, fundamental, etc.) maps to a pitch position. That pitch position maps to a point on the torus via Cantor's existing pitch-to-position mapping. The strike origin is a randomized point in a small region around that point, scaled to be outside the torus silhouette.
- **MIDI path:** a hand-authored table maps MIDI drum channel notes (GM standard: 36 = kick, 38 = snare, 42 = closed hat, etc.) to pitch positions on the torus. Same downstream geometry.

Effect: low-pitch percussion radiates from the torus's low-pitch region; high-pitch percussion from its high-pitch region. The rhythm and harmony layers are spatially co-located by pitch.

The grain layer must, per frame, read:

- The torus's current screen-space silhouette (a sampled ring of points around the torus's outer edge after 3D projection).
- The torus's pitch-axis-to-screen-position mapping (probably already exists in `cantor-view.js` for chord wash and melody glyph placement).

### Torus occlusion

The torus is partly transparent but still occludes some content visually. Without occlusion handling, ripples appear to disappear into and reappear out of the torus, reading as a rendering bug.

Implementation: a soft alpha-mask of the torus silhouette dims both the displacement field and the rendered grains in the region directly behind the torus. Falloff width tunable.

## Rendering

- **Layer:** HTML canvas 2D element, positioned behind the existing SVG torus via z-index. Two separate DOM elements; the existing SVG renderer is unchanged.
- **Grain count:** target 2,000–10,000 grains. Below that range it looks like dots; above that range cost rises without perceptual benefit at the resolution Cantor renders at.
- **Cost estimate:** at 10,000 grains and ~30 active strikes (worst case at fast tempo), ~3M ops per frame. Well within canvas-2D budget at 60fps.
- **Color register:** grayscale, per the saturation principle in `docs/color-confidence.md` — percussion is non-tonal, so it lives in the gray register. Open to revisit if a subtle color treatment proves visually warranted, but default is gray.

### Performance notes

The dominant cost is `grain_count × active_strikes`. Mitigations available if needed:

- Precompute ripple_shape lookup tables, indexed by (distance, age) per band.
- Factor mode-shape evaluations where they factor (axis-separable functions can cache x and y components separately).
- Pre-allocate the strike list and grain array; mutate in place. JavaScript GC pauses from per-frame allocations are the real risk, not raw math.
- Active strikes drop out of the list when their amplitude falls below epsilon, bounding the sum.

## Coupling and architecture

The grain layer reads two pieces of Cantor's per-frame state:

1. The torus's screen-space silhouette.
2. The torus's pitch-axis-to-screen-position mapping function.

This is one-way coupling — Beat Field depends on torus state, the torus does not depend on Beat Field. Both pieces live in the same `static/shared/cantor-view.js` file, so the coupling is local and acceptable.

Future-refactor flag, alongside the existing 3D-math duplication TODO: if Beat Field, Cantor torus, or pitch geometry are ever extracted as reusable modules, the pitch mapping wants to live as a shared module that both the torus and the grain layer consume, rather than the grain layer reading torus internals.

## Tuning surface

The following parameters want to be calibrated against real audio with real test tracks, not pre-decided. They are exposed as configurable values in the implementation:

- Ripple shape per band: spatial frequency, propagation speed, spatial envelope falloff.
- Decay envelope shape per band: attack, sustain, decay times.
- Per-band region size and shape around the torus silhouette.
- Selector function thresholds per band (which spectral features map to which palette entries).
- Bias weight on the grain motion law (visualization-atmosphere knob).
- Grain count, base size, base opacity.
- Torus occlusion falloff width.
- Ambient idle jitter amplitude.
- MIDI channel-to-pitch-position table (when MIDI lands).

## Deferred

- **Continuous-mode mapping (option 3 from design discussion).** v1 uses per-band palettes with discrete selector logic. A future swap replaces the per-band selector with a continuous mapping from spectral features to ripple parameters. Architecturally, this is a function replacement at one well-defined spot in the pipeline.
- **MIDI integration.** Architecture supports it via the channel-to-pitch-position table; concrete implementation waits for MIDI input to land on the platform.
- **Chladni-style late-decay refinement.** Long-sustaining strikes (e.g., a sustained crash) could resolve into nodal-line interference patterns in their decay tail. Not part of v1; revisit if specific cymbal-style sounds want a richer treatment.
- **Atmosphere-end calibration.** v1 ships with bias_weight tuned for visualization. The atmosphere end of the dial is exposed but not pre-tuned.
- **Color treatment for percussion.** v1 is grayscale. If percussion warrants a subtle hue treatment that doesn't violate the color-confidence principle, revisit.

## Prerequisites

- **Onset-driven analysis.** Beat Field consumes onsets from the onset-driven analysis rebuild (separate chat thread / separate work). Beat Field implementation should not begin until the onset detection interface is at least specified, even if not fully implemented, so the strike-event shape can be coordinated.
- **Percussion test track content.** The existing `tests/` infrastructure doesn't have percussion content. Before tuning can begin, either a percussion section added to existing test tracks or a dedicated percussion-focused test track. Suggested coverage: bars of isolated kick, isolated snare, isolated closed hat, isolated open hat, basic backbeat, busier pattern with fills, full kit with cymbals.

## Open questions

- **URL path.** `/beatfield` or `/beat-field`? Match whatever convention the rest of the platform uses for multi-word view names.
- **Visibility relative to Cantor.** Beat Field is a layer of the Cantor view. Is it always on, or is there a toggle? If always on, what does it look like for music with no percussion (purely solo piano, say)? The flat-resting-state design handles this gracefully — the layer is just visibly empty — but it's worth confirming that's the desired behavior rather than hiding the layer entirely when no strikes are detected.
- **Per-band ambient state.** Does ambient idle jitter exist regardless of audio input, or is it coupled to broadband audio energy? Coupling it to broadband energy is more honest (a quiet vocal still produces faint shimmer; silence produces none) but adds a dependency on a continuous audio feature outside the strike-event pipeline.
- **Test track structure.** Whether percussion content goes into existing test tracks or a dedicated track depends on how the test track infrastructure currently composes — design call for the parallel onset-detection work, not Beat Field specifically.
