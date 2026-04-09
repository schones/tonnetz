# SongLab Visual Engine — Spec v0.1

## Vision
A generative visual canvas driven by harmonic data from the Tonnetz. The Tonnetz grid is the hidden engine — chord geometry, voice leading distances, and tonal relationships map to visual parameters. The user sees art; the math sees music theory.

## Architecture

### Data Flow
```
HarmonyState (pub/sub)
  → chord events: { root, quality, notes[], timestamp }
  → transform events: { type: P/L/R, from, to }
  
AudioBridge (existing)
  → tempo/BPM
  → amplitude/envelope
  → beat events

VisualEngine (new)
  ← subscribes to HarmonyState + AudioBridge
  → drives Canvas2D or WebGL render loop
  → outputs to <canvas> element
```

### Module: `static/shared/visual-engine.js`
```
class VisualEngine {
  constructor(canvas, options = {})
  
  // Lifecycle
  start()          // begin render loop
  stop()           // pause render loop
  reset()          // clear canvas, reset state
  
  // Input (called by HarmonyState subscription)
  onChord(chord)           // { root, quality, notes, octave }
  onTransform(transform)   // { type, from, to }
  onBeat(beatInfo)         // { number, bpm, downbeat }
  onAmplitude(level)       // 0.0 - 1.0
  
  // Configuration
  setStyle(preset)         // 'geometric', 'fluid', 'particle', 'minimal'
  setColorMode(mode)       // 'harmonic', 'warm', 'cool', 'monochrome'
  setIntensity(level)      // 0.0 - 1.0, controls visual density
}
```

## Harmonic-to-Visual Mappings

### 1. Chord → Shape + Position

The Tonnetz gives every pitch class an (x, y) coordinate:
- Horizontal axis: perfect fifths (C → G → D → A → ...)
- Diagonal up-right: major thirds
- Diagonal down-right: minor thirds

A triad = three connected points = a triangle.

**Mapping:**
- Major triad → upward-pointing triangle (compact, stable)
- Minor triad → downward-pointing triangle (inverted, tension)
- Diminished → contracted triangle (all minor thirds, tight cluster)
- Augmented → equilateral triangle (all major thirds, symmetric)
- 7th chords → quadrilateral (four points)

**Canvas position**: The triangle's centroid on the Tonnetz grid maps to a position on the canvas. Moving through a progression = the shape drifting across the canvas.

### 2. Voice Leading → Motion Quality

Calculate the semitone distance between consecutive chords:
- **0-2 semitones total movement** (e.g., Am → C): smooth morph, gentle drift
- **3-5 semitones** (e.g., C → G): moderate movement, shape rotation
- **6+ semitones** (e.g., C → F♯): dramatic jump, flash, shape transformation
- **Common tones**: notes that don't move become visual anchors (fixed points while other vertices move)

The glow worm path concept extends here: draw a trail connecting successive chord shapes, with the trail fading over time. Voice leading efficiency = trail smoothness.

### 3. Chord Quality → Color

Extend the existing chord color system:
```
Major       → blue family (#2D5F8A → #7BBDE8)
Minor       → green family (#4CAF50 → #7BC67E)  
Dominant 7  → gold family (#D4A03C → #F0D080)
Diminished  → red/dark family (#C62828 → #E88080)
Augmented   → purple family (#7B6BA5 → #B8A0D0)
Suspended   → teal family (#5B8A9A → #90C8D8)
```

Color transitions should blend smoothly between chord qualities. A major → minor shift = blue smoothly turning green.

### 4. Tempo → Animation Dynamics

- **BPM → pulse rate**: Shapes breathe/pulse on the beat
- **BPM → particle emission rate**: Higher tempo = more particles
- **BPM → trail decay**: Fast tempo = shorter trails (recent history), slow = long flowing trails
- **Downbeat → emphasis**: Beat 1 gets a visual accent (pulse, flash, size bump)
- **Swing ratio → asymmetry**: Swung rhythms make the visual pulse asymmetric (long-short-long-short)

### 5. Key/Tonal Center → Spatial Gravity

- Tonic chord = center of canvas (home position)
- Dominant = pulled to the right (fifths axis)
- Subdominant = pulled to the left
- Relative minor/major = vertical shift
- Distant keys = edges of canvas
- Modulation = the entire "camera" shifts to recenter on the new tonic

This creates a sense of tension and resolution visually — dominant chords literally pull the shapes away from center, and resolving to tonic brings them home.

### 6. Dynamics / Amplitude → Visual Intensity

- Louder = brighter colors, larger shapes, more particles
- Softer = muted colors, smaller shapes, minimal particles
- Crescendo = gradual bloom
- Sforzando = flash/burst

(This mapping becomes powerful once MIDI velocity data is available)

## Visual Style Presets

### Geometric
Clean triangles and lines. The Tonnetz geometry is visible but abstracted — shapes morph and drift across a dark canvas. Trails are clean lines. Minimal, elegant.
Best for: theory-focused users, presentations, teaching

### Fluid
Shapes dissolve into flowing gradients and blobs. Chords become pools of color that merge and separate. Trails are soft, watercolor-like smears.
Best for: ambient listening, relaxation, background visuals

### Particle
Each chord emits a burst of particles from its triangle vertices. Particles inherit the chord's color and drift based on voice leading direction. High-energy, dynamic.
Best for: uptempo songs, live performance visuals, engagement

### Minimal
Single shape, single color, white on black. Only the essential geometry. The triangle morphs, the trail is a thin line. 
Best for: focus, meditation, studying harmony

## Implementation Phases

### Phase V1: Static Canvas (post-launch)
- VisualEngine class with Canvas2D
- Subscribe to HarmonyState chord events
- Draw chord triangles with color mapping
- Basic morph animation between chords
- Trail/history rendering
- One style preset (Geometric)
- Driven by walkthrough playback or Skratch Studio play

### Phase V2: Beat-Responsive
- Subscribe to AudioBridge beat/tempo events
- Pulse on beat, emphasis on downbeat
- Tempo-driven animation speed
- Trail decay linked to BPM

### Phase V3: Style Presets
- Implement Fluid, Particle, Minimal presets
- Style selector UI
- Per-song recommended style (in song-examples.js)

### Phase V4: MIDI-Driven
- Real-time chord detection from MIDI input
- Velocity → amplitude mapping
- Live performance mode (full-screen canvas)
- OBS/streaming integration (transparent background option)

### Phase V5: Interactive
- Click/touch the canvas to influence visuals
- Drag to shift tonal center
- Pinch to zoom the Tonnetz "camera"
- Share/export as video or GIF

## Integration Points

### With Explorer
- "Visualizer" toggle in panel switcher (alongside Tonnetz, Chord wheel, Fretboard)
- Walkthrough drives the visual engine step by step
- Split view: Tonnetz on left, Visualizer on right

### With Skratch Studio
- Canvas area already exists — visual engine can render there
- Block playback drives chord events into the engine
- "Visual mode" toggle replaces the dot-grid canvas with the generative canvas

### With Song Database
- Each song entry could include a recommended visual style
- "Watch" mode: pick a song, see its progression as pure visuals
- Landing page: animated Tonnetz visualization playing a song progression as the hero background

### With Future MIDI
- The ultimate mode: plug in a keyboard, play, see visuals respond in real time
- Latency target: <16ms (one frame) from MIDI event to visual update
- ChordResolver already exists for identifying chords from note input

## Open Questions
- Canvas2D vs WebGL? Canvas2D is simpler and sufficient for V1-V3. WebGL unlocks particle systems and 3D for V4-V5.
- Should the visual engine run in a Web Worker for performance isolation?
- Screen recording / export: MediaRecorder API can capture the canvas, but quality and format support varies.
- How does this interact with the planned animated Tonnetz on the landing page? Could be the same engine in a constrained mode.

## Connection to Original Vision
This is the feature that started the whole project. Everything built so far — the Tonnetz math, HarmonyState, audio engine, song database, Skratch Studio — is infrastructure that makes this possible. The visual engine is the capstone that turns harmonic analysis into something you can feel, not just understand.

The key insight: the Tonnetz isn't just a teaching tool. It's a coordinate system for translating music into visual space. Every chord has a shape, a position, a color, and a relationship to every other chord. That's everything you need to generate meaningful, responsive visual art from music.
