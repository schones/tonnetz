/**
 * theory-content.js
 * =================
 * THE ANCHOR DOCUMENT for the Tonnetz education layer.
 *
 * PURPOSE:
 *   Single source of truth for all music theory content across the platform.
 *   Pure data — zero rendering logic lives here.
 *
 * CONSUMED BY:
 *   - tooltip.js          → in-game (?) progressive disclosure tooltips
 *   - theory-panel.js     → contextual sidebar in Tonnetz explorer
 *   - /theory.html        → standalone Theory Reference Hub (Option F)
 *   - /learn.html         → Guided Tour lesson player (Option D)
 *   - game-intros/*.js    → pre-game intro screens (Option B)
 *
 * SCHEMA OVERVIEW:
 *   THEORY.topics         → master list of all 25+ theory topics
 *   THEORY.visualizations → config for each interactive visual
 *   THEORY.games          → per-game intro content
 *   THEORY.glossary       → quick-reference definitions
 *   THEORY.mnemonics      → memorable hooks per concept
 *
 * DEPTH LEVELS (used throughout):
 *   "musician"  → feel, character, practical use. No jargon.
 *   "theorist"  → formal names, interval structure, function.
 *   "math"      → frequency ratios, modular arithmetic, group theory.
 *
 * AUDIENCE TIERS (tag each topic):
 *   "beginner"      → absolute newcomers, kids
 *   "intermediate"  → music students, hobbyists
 *   "advanced"      → theory nerds, composers, developers
 *
 * ADDING NEW CONTENT:
 *   1. Add topic object to THEORY.topics under the correct tier
 *   2. Follow the exact schema below — all fields required
 *   3. Add to THEORY.glossary if it introduces a new term
 *   4. If a visualization exists, link it via visualizationKey
 *   5. Run `node scripts/validate-theory.js` to check schema
 *
 * ================================================================
 */

// ── DIFFICULTY FORMULA ──────────────────────────────────────────────
// difficulty = min(longest_prerequisite_chain + 1, 5)
// Chain length = 0 for topics with no prerequisites (difficulty 1).
// Recompute if prerequisites change.
// ────────────────────────────────────────────────────────────────────

export const THEORY = {

  // ================================================================
  // TOPICS
  // Each topic maps to a lesson, a tooltip entry, and a hub card.
  // ================================================================

  topics: {

    // ── TIER 1: SOUND & NOTATION ──────────────────────────────────

    sound_basics: {
      id: "sound_basics",
      title: "What is Sound?",
      content_type: "building_block",
      quick_summary: "Sound is vibration through air. Frequency sets pitch, amplitude sets volume, and overtone patterns create timbre.",
      difficulty: 1,
      related_games: [],
      related_visualizations: [],
      creative_prompts: ["Hit different things around you — a desk, a cup, a pillow. Which one makes the highest sound?", "Try humming a low note, then a really high one. Can you feel the difference in your throat?", "Record yourself clapping, then play it back. Sound is just vibrations traveling through air!"],
      tags: ["physics", "acoustics", "fundamentals"],
      visualizationKey: "waveform_explorer",   // links to THEORY.visualizations
      prerequisites: [],

      // ONE-LINER shown in tooltips and hub card previews
      summary: "Sound is vibration — frequency determines pitch, amplitude determines volume.",

      levels: {
        musician: `
          Sound starts with something vibrating — a guitar string, a drum skin, your vocal cords.
          That vibration pushes air molecules back and forth, creating waves that reach your ears.
          Faster vibrations = higher pitch. Bigger vibrations = louder sound. 
          Every instrument has its own unique "color" of sound called timbre — 
          why a C on piano sounds different from a C on violin even at the same pitch.
        `,
        theorist: `
          Sound is a longitudinal pressure wave traveling through a medium (usually air).
          Frequency (Hz) determines perceived pitch. Amplitude determines loudness (dB).
          Timbre is determined by the harmonic series — the pattern of overtones above the fundamental frequency.
          The audible range for humans is roughly 20 Hz to 20,000 Hz.
          Concert A (A4) is standardized at 440 Hz.
        `,
        math: `
          A pure tone is a sinusoidal pressure wave: p(t) = A · sin(2πft + φ)
          where A = amplitude, f = frequency (Hz), φ = phase offset.
          Real instruments produce complex waves: sums of sinusoids at integer multiples of f (the harmonic series).
          The Fourier transform decomposes any periodic wave into its sine/cosine components,
          revealing the frequency spectrum that defines timbre.
          f_n = n · f₀  (nth harmonic, n = 1, 2, 3, ...)
        `,
        playful: {
          available: true,
          summary: "Sound is what happens when something shakes the air — your ears catch those shakes and turn them into everything you hear.",
          body: `Put your fingers on your throat and hum. Feel that buzzing? That's you making sound. Your vocal cords are vibrating, pushing the air around, and those vibrations travel all the way to someone else's ears.

All sound works like this. A guitar string vibrates. A drum skin vibrates. Even a clap is two hands smacking together and shaking the air between them.

Two things change how a sound... sounds. **Pitch** is how high or low it is — a bird chirp vs. a foghorn. **Volume** is how loud or soft — a whisper vs. a yell. Music is just people choosing pitches and volumes on purpose, in patterns.`,
        },
      },

      practical: "Next time you pluck a guitar string, watch it vibrate. That motion IS the sound.",
      
      connections: ["the_staff", "octave", "intervals"], // related topic IDs
    },

    the_staff: {
      id: "the_staff",
      title: "The Staff & Clefs",
      content_type: "building_block",
      quick_summary: "Five lines and four spaces map pitch visually. Clefs anchor specific notes to the grid.",
      difficulty: 2,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["notation", "reading", "fundamentals"],
      visualizationKey: "staff_explorer",
      prerequisites: ["sound_basics", "note_names"],

      summary: "Five lines and four spaces encode pitch visually. Clefs tell you which pitches.",

      levels: {
        musician: `
          Music notation is a map: higher on the staff = higher in pitch, lower = lower.
          The treble clef (the curly symbol) marks the G above middle C on the second line.
          The bass clef marks the F below middle C on the fourth line.
          Middle C sits on a short ledger line between the two staves — the pivot point of the grand staff.
          Notes on lines: Every Good Boy Does Fine (EGBDF). Spaces: FACE.
        `,
        theorist: `
          The staff is a five-line pitch grid. Each line and space represents a diatonic pitch.
          The treble clef (G clef) originated as a stylized letter G, anchored to the second line (G4).
          The bass clef (F clef) anchors to the fourth line (F3).
          Alto and tenor clefs (C clefs) are used for viola, trombone, and cello.
          Ledger lines extend the staff above and below — middle C (C4) is one ledger line below treble / above bass.
        `,
        math: `
          The staff encodes a discrete mapping: staff_position → pitch_class + octave.
          Position p (0 = first line, counting by half-positions) maps to MIDI note:
          MIDI = 12 × (octave + 1) + pitch_class_index
          where pitch_class_index follows the diatonic ordering {C=0, D=2, E=4, F=5, G=7, A=9, B=11}.
          Accidentals (♯, ♭) shift MIDI ± 1 without changing staff position — 
          this is why enharmonic equivalents (C# vs D♭) look different but sound identical in equal temperament.
        `,
        playful: {
          available: true,
          summary: "The staff is five lines where music gets written down — the higher a note sits, the higher it sounds.",
          body: `The staff is five horizontal lines. Notes are dots that sit on the lines or in the spaces between them. Higher dot = higher pitch. Lower dot = lower pitch. That's the basic idea.

At the start of every staff there's a symbol called a **clef** that tells you which notes the lines mean. The most common one looks like a fancy "&" — that's the **treble clef**, used for higher sounds.

Find any piece of sheet music and follow the dots with your eyes. When they move up, the melody goes up. When they drop down, it goes down. You're reading the *shape* of the music, even if you can't name every note yet.

Lots of great musicians never learn to read sheet music — they play by ear. But the staff is like a map. If you can read it, you can play music you've never heard before, written by someone you've never met, from hundreds of years ago. That's pretty useful.`,
        },
      },

      practical: "Spend 5 minutes on musictheory.net's Note Identification exercise. Fluent reading is muscle memory.",
      
      connections: ["note_names", "rhythm", "ledger_lines"],
    },

    ledger_lines: {
      id: "ledger_lines",
      title: "Ledger Lines",
      content_type: "building_block",
      quick_summary: "Short extension lines above or below the staff for notes beyond its five-line range.",
      difficulty: 3,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["notation", "reading", "fundamentals"],
      visualizationKey: "staff_explorer",
      prerequisites: ["the_staff"],

      summary: "Short lines above or below the staff that extend its range. Middle C lives on a ledger line.",

      levels: {
        musician: `
          The staff only has five lines, but music goes much higher and lower than that.
          Ledger lines are tiny extra lines drawn above or below the staff for notes that don't fit.
          Middle C is the most famous ledger line note — it sits just below the treble clef
          or just above the bass clef. Rather than memorizing dozens of ledger lines,
          most musicians learn the common ones (middle C, A above treble staff) and count from there.
          If a passage uses many ledger lines, composers often switch clefs or use 8va markings instead.
        `,
        theorist: `
          Ledger lines extend the five-line staff in both directions, preserving the diatonic pitch mapping.
          Each ledger line or space follows the same pattern as the staff itself.
          Common ledger line notes: middle C (C4) = one ledger line below treble, one above bass.
          A5 = two ledger lines above treble staff. C3 = two ledger lines below bass staff.
          Ottava markings (8va, 8vb, 15ma) transpose notation by one or two octaves to reduce ledger lines.
          In orchestral scores, instrument transpositions also minimize ledger line usage.
        `,
        math: `
          Ledger lines extend the staff mapping function: position p → pitch, for p outside [0, 8].
          Each additional line adds 2 diatonic steps (one line + one space).
          Ledger line count from staff edge to note: ⌈(|n - staff_edge|) / 2⌉.
          Readability degrades roughly linearly with ledger line count —
          studies show >3 ledger lines significantly slow sight-reading.
          The decision to use 8va vs. ledger lines is an optimization problem:
          minimize cognitive load while preserving pitch clarity.
        `,
        playful: { available: false },
      },

      practical: "Start by memorizing just middle C as a ledger line in both clefs. From there, count up or down by step to find other ledger line notes.",

      connections: ["the_staff", "note_names", "octave"],
    },

    note_names: {
      id: "note_names",
      title: "Note Names & the Musical Alphabet",
      content_type: "building_block",
      quick_summary: "Seven letters A through G name the white keys. Sharps and flats fill the five gaps between them.",
      difficulty: 1,
      related_games: [{ game_id: "melody_match", relevance: "supporting" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: [],
      creative_prompts: ["Can you play all seven white notes from C to B? Try giving each one a silly voice.", "Find two notes that are right next to each other. Now find two far apart. Which pair sounds smoother?", "Play only the black keys in any order. Everything sounds cool — why do you think that is?"],
      tags: ["notation", "pitch", "fundamentals"],
      visualizationKey: "keyboard_explorer",
      prerequisites: [],

      summary: "Seven letters (A–G), twelve pitches. Sharps and flats fill the gaps.",

      levels: {
        musician: `
          The musical alphabet runs A B C D E F G — then starts over.
          On a piano, these are the white keys. The black keys are the "in-between" notes:
          sharps (♯) raise a note by one small step, flats (♭) lower it.
          C# and D♭ are the same key — different names for the same sound (enharmonic equivalents).
          Why 7 letters for 12 pitches? Western music evolved from 7-note scales (diatonic),
          and the 5 extra notes were added later.
        `,
        theorist: `
          The 12 chromatic pitches form pitch classes in ℤ₁₂.
          Diatonic note names (A–G) correspond to the "white key" subset.
          Accidentals — sharp (♯, +1 semitone), flat (♭, −1 semitone), double sharp (𝄪, +2), double flat (𝄫, −2) —
          adjust pitch while preserving the letter name for diatonic context.
          Enharmonic equivalence: C# = D♭ in equal temperament (both = MIDI 61),
          but spelled differently based on harmonic function within a key.
        `,
        math: `
          Pitch classes form the cyclic group ℤ₁₂ = {0, 1, 2, ..., 11}.
          Standard mapping: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11.
          The diatonic "white keys" {0,2,4,5,7,9,11} are not equally spaced — 
          they follow the pattern of the major scale (W-W-H-W-W-W-H).
          Accidentals shift the pitch class index ±1 (mod 12) while the staff position (letter) stays fixed.
        `,
        playful: {
          available: true,
          summary: "Music uses 7 letter names — A through G — and then starts over. That's it. The whole alphabet of music.",
          body: `The notes go: A, B, C, D, E, F, G. After G it goes back to A. No H, no Z. Just seven letters on repeat, forever.

On a piano, the white keys are these seven notes. Find a group of two black keys — the white key just left of them is C. Go right from there: C, D, E, F, G, A, B, C. You're back to C again.

The black keys are the notes *between* some of the letters. They get names like C♯ ("C sharp" — a tiny step up from C) or B♭ ("B flat" — a tiny step down from B).

Count every key, black and white, from one C to the next: you get 12. Those 12 notes are all there is. Everything in music — every song, every style — comes from arranging these 12 notes.`,
        },
      },

      practical: "Learn the piano keyboard layout first — it's the clearest physical model of the 12 pitches.",
      
      connections: ["semitones_whole_tones", "the_staff", "chromatic_scale"],
    },

    rhythm: {
      id: "rhythm",
      title: "Rhythm & Duration",
      content_type: "building_block",
      quick_summary: "Notes have duration from whole to sixteenth. Time signatures organize beats into recurring measures.",
      difficulty: 2,
      related_games: [{ game_id: "melody_match", relevance: "primary" }, { game_id: "rhythm_lab", relevance: "primary" }, { game_id: "strum_patterns", relevance: "primary" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: [],
      creative_prompts: ["Clap a steady beat, then try clapping twice as fast. You just went from quarter notes to eighth notes!", "Record a 4-beat pattern using different drum sounds. Can a friend copy it back to you?", "Try holding a note for 4 beats, then 2, then 1. Hear how the energy changes?"],
      tags: ["rhythm", "notation", "time"],
      visualizationKey: "rhythm_grid",
      prerequisites: ["sound_basics"],

      summary: "Notes have duration. Time signatures organize beats into measures.",

      levels: {
        musician: `
          Every note has a rhythmic value: whole note (4 beats), half (2), quarter (1), eighth (½), sixteenth (¼).
          The time signature (like 4/4) tells you how many beats per measure and what kind of note gets one beat.
          4/4 is the most common — four quarter-note beats per bar. 3/4 is the waltz feel (ONE two three ONE two three).
          Rests are silences with the same duration values as notes.
          Dotted notes add half their value (dotted quarter = 1.5 beats).
        `,
        theorist: `
          Duration is expressed as dyadic fractions of a whole note.
          Time signatures: numerator = beats per measure, denominator = note value of one beat.
          Simple meters (2/4, 3/4, 4/4) divide beats into twos.
          Compound meters (6/8, 9/8, 12/8) divide beats into threes — the "swing" feel.
          Tuplets (triplets, quintuplets) divide beats into non-standard groupings.
          Ties connect two note durations; slurs indicate legato phrasing (different visual, different meaning).
        `,
        math: `
          Note duration: whole = 1, half = 1/2, quarter = 1/4, eighth = 1/8, etc.
          Dotted note: d' = d × (3/2). Double-dotted: d'' = d × (7/4).
          Tempo (BPM) converts rhythmic values to time:
          t_seconds = (60 / BPM) × duration_in_quarter_notes
          A triplet eighth has 2/3 the duration of a regular eighth note: three triplet-eighths = one quarter note.
          Time signature n/d: measure duration = n × (1/d) whole notes.
        `,
        playful: {
          available: true,
          summary: "Rhythm is the pattern of long and short sounds — it's the part of music that makes you want to move.",
          body: `Clap a steady beat. Now clap twice between some of those beats. You just changed the rhythm — you made some sounds shorter and some longer.

Every piece of music has a **beat** — a steady pulse underneath, like a clock ticking. You feel it even when you can't hear it. That's why your foot taps on its own.

Rhythm is what you do *on top of* that beat. Sometimes you land right on it. Sometimes you squeeze extra sounds between beats. Sometimes you leave silence. The pattern you make is the rhythm.

You don't need any instruments for this. Tap a table. Stomp. Snap. Rhythm is just patterns in time.`,
        },
      },

      practical: "Clap along to music and count out loud. Physical beat internalization precedes reading.",
      
      connections: ["the_staff", "meter_and_groove"],
    },

    meter_and_groove: {
      id: "meter_and_groove",
      title: "Meter & Groove",
      content_type: "framework",
      quick_summary: "Meter groups beats into strong-weak patterns. Groove is how performers shape those patterns with feel and accent.",
      difficulty: 3,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["rhythm", "feel", "meter", "groove"],
      visualizationKey: "rhythm_grid",
      prerequisites: ["rhythm"],

      summary: "Meter organizes beats into patterns. Groove is how those beats are felt — the difference between a march and a waltz.",

      levels: {
        musician: `
          Meter is the recurring pattern of strong and weak beats.
          4/4 feels like: STRONG weak medium weak. 3/4 feels like: STRONG weak weak (waltz).
          6/8 groups beats in threes: STRONG weak weak medium weak weak — a galloping, rolling feel.
          Groove is what happens when musicians interpret the meter with personality.
          A swing groove delays the offbeats slightly. A funk groove emphasizes the "and" beats.
          The same time signature can feel completely different depending on where the accents land
          and how the subdivisions are pushed or pulled.
        `,
        theorist: `
          Meter is hierarchical beat grouping: beats group into measures, subdivisions group into beats.
          Simple meters (2/4, 3/4, 4/4): beats subdivide by 2 (duple subdivision).
          Compound meters (6/8, 9/8, 12/8): beats subdivide by 3 (triple subdivision).
          Asymmetric meters (5/4, 7/8): unequal beat groupings (e.g., 7/8 = 2+2+3 or 3+2+2).
          Swing feel: tuplet-based subdivision where pairs of eighth notes are played ~2:1 ratio.
          Polyrhythm: two independent meters simultaneously (e.g., 3 against 2).
          Hemiola: temporary metric shift, usually 3×2 against 2×3 within the same span.
        `,
        math: `
          Meter defines a hierarchical grouping on a time grid of resolution r.
          Simple n/d: measure = n beats, each beat = d⁻¹ whole notes, subdivision = 2.
          Compound n/d: measure = n/3 beats, each beat = 3×d⁻¹ whole notes, subdivision = 3.
          Swing ratio s: pairs of notes with durations (s·d, (2-s)·d) where s ∈ [1, 2].
          s=1 is straight, s=2.0 is pure triplet swing (2:1 ratio).
          Empirical jazz performance averages s≈1.6–1.7, lighter than a strict triplet feel.
          Polyrhythm p:q: p evenly-spaced events against q evenly-spaced events.
          LCM(p,q) determines the minimum resolution grid needed to notate both patterns.
          Metric modulation: tempo₂ = tempo₁ × (sub₁ / sub₂), preserving pulse continuity.
        `,
        playful: { available: false },
      },

      practical: "Listen to the same song drumless, then with drums. The groove is everything the drummer adds beyond the bare meter. Try conducting in 3/4 vs 4/4 — feel the difference in your body.",

      connections: ["rhythm", "blues_scale"],
    },

    // ── TIER 2: PITCH RELATIONSHIPS ───────────────────────────────

    semitones_whole_tones: {
      id: "semitones_whole_tones",
      title: "Semitones & Whole Tones",
      content_type: "building_block",
      quick_summary: "The semitone is the smallest step between adjacent keys. Two semitones make a whole tone, the atoms of all scales.",
      difficulty: 2,
      related_games: [{ game_id: "harmony_trainer", relevance: "primary" }, { game_id: "relative_pitch", relevance: "supporting" }],
      related_visualizations: ["scale_explorer"],
      creative_prompts: [],
      tags: ["intervals", "pitch", "fundamentals"],
      visualizationKey: "chromatic_clock",
      prerequisites: ["note_names"],

      summary: "The smallest step in Western music is a semitone (half step). Two semitones = a whole tone.",

      levels: {
        musician: `
          A semitone is the smallest gap between two notes in Western music — 
          one key to the very next key on a piano (including black keys).
          Two semitones make a whole tone (whole step).
          The distance from C to C# is one semitone. C to D is one whole tone (two semitones).
          All scales, chords, and intervals are built from combinations of these small steps.
          Think of semitones as the atoms of Western harmony.
        `,
        theorist: `
          The semitone (half step, minor second) is the generator of the 12-tone equal temperament (12-TET) system.
          Twelve semitones span one octave (a frequency ratio of exactly 2:1).
          A whole tone = 2 semitones (major second).
          The chromatic scale: 12 consecutive semitones from any root, returning to the same pitch class one octave up.
          In 12-TET, all semitones are equal (unlike just intonation, where they vary slightly).
        `,
        math: `
          In 12-TET, each semitone = frequency ratio of 2^(1/12) ≈ 1.05946.
          n semitones above frequency f₀: f = f₀ × 2^(n/12)
          12 semitones: f = f₀ × 2^(12/12) = f₀ × 2 (the octave).
          The group of pitch classes under semitone addition forms ℤ₁₂.
          Just intonation (pre-equal-temperament): the major whole tone = 9:8 ≈ 1.125,
          minor whole tone = 10:9 ≈ 1.111 — unequal, which is why 12-TET was standardized.
        `,
        playful: {
          available: true,
          summary: "A semitone is the smallest step between two notes — one key to the very next key on a piano. A whole tone is two of those steps.",
          body: `On a piano, pick any key. The key right next to it — whether black or white — is one **semitone** away. That's the smallest step you can take.

Now skip a key and go to the one after it. That's a **whole tone** — two semitones.

Play a few semitones in a row. They sound very close together, kind of tense. Now play a few whole tones in a row. Bigger jumps, more relaxed.

That's basically it. These two step sizes are the ingredients for building scales. Every scale is just a recipe that tells you when to step by a semitone and when to step by a whole tone.`,
        },
      },

      practical: "On a piano or guitar, move one fret/key at a time — that's a semitone. Hear how small it is.",
      
      connections: ["intervals", "chromatic_scale", "major_scale"],
    },

    intervals: {
      id: "intervals",
      title: "Intervals",
      content_type: "building_block",
      quick_summary: "The distance between two pitches, measured in semitones. Each interval has a distinctive sound and emotional character.",
      difficulty: 3,
      related_games: [{ game_id: "harmony_trainer", relevance: "primary" }, { game_id: "melody_match", relevance: "primary" }, { game_id: "relative_pitch", relevance: "primary" }, { game_id: "chord_spotter", relevance: "supporting" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: ["scale_explorer", "tonnetz_grid"],
      creative_prompts: ["Try playing two notes at the same time. Does it sound nice or crunchy?", "Can you make a melody that only uses big jumps between notes?", "Play a note, then the note right next to it. Now skip 5 keys up. Hear the difference?"],
      tags: ["intervals", "pitch", "ear-training"],
      visualizationKey: "interval_character_cards",
      prerequisites: ["semitones_whole_tones"],

      summary: "An interval is the distance between two pitches. Each has a distinctive sound character.",

      levels: {
        musician: `
          Every pair of notes has an interval — a measurable distance with a recognizable sound.
          Smaller intervals sound close and tight (minor 2nd = tense, almost clashing).
          Larger intervals sound open (perfect 5th = heroic and powerful).
          The best way to memorize intervals is by famous melodies that start with them:
          minor 2nd → Jaws theme. Major 3rd → "When the Saints Go Marching In."
          Perfect 5th → Star Wars theme. Octave → "Somewhere Over the Rainbow."
        `,
        theorist: `
          Intervals have two properties: generic size (2nd, 3rd, 4th...) and quality (major, minor, perfect, diminished, augmented).
          "Perfect" intervals (unison, 4th, 5th, octave) have no major/minor distinction.
          The 13 intervals within an octave:
          m2(1), M2(2), m3(3), M3(4), P4(5), TT(6), P5(7), m6(8), M6(9), m7(10), M7(11), P8(12) semitones.
          Consonance vs dissonance: P5, P4, M3, m3, M6, m6 = consonant. m2, M2, TT, M7 = dissonant.
          Compound intervals exceed an octave: M9 = M2 + octave.
        `,
        math: `
          Interval of n semitones: frequency ratio = 2^(n/12).
          Just intonation ratios (approximated by 12-TET):
          P5 = 3:2 (2^(7/12) ≈ 1.498), P4 = 4:3 (2^(5/12) ≈ 1.335),
          M3 = 5:4 (2^(4/12) ≈ 1.260), m3 = 6:5 (2^(3/12) ≈ 1.189).
          Consonance correlates with ratio simplicity (Helmholtz roughness theory).
          The tritone (TT, 6 semitones) = 2^(6/12) = √2 — irrational, maximally dissonant.
          Interval inversion: n + n' = 12. M3 inverts to m6 (4+8=12). P5 inverts to P4 (7+5=12).
        `,
        playful: {
          available: true,
          summary: "An interval is the distance between two notes — small intervals sound close and smooth, big intervals sound like a jump.",
          body: `Hum the first two notes of "Happy Birthday." That's a small interval — the notes are neighbors. Now hum the first two notes of the *Star Wars* theme. Much bigger jump. That's a large interval.

Intervals get their names from counting letter names. C up to D = a 2nd (two letters). C up to E = a 3rd. C up to G = a 5th.

Here's the thing: you already recognize intervals, even without names. When you hear the opening of a song and instantly know what it is — that's your brain recognizing the interval. Your ears learned this before your brain caught up. Now we're just giving names to what you already hear.`,
        },
      },

      practical: "Train your ear daily — even 5 minutes on teoria.com's interval exercises builds recognition fast.",

      // Mnemonic songs for each interval
      mnemonics: {
        m2: "Jaws theme / 'Happy Birthday' (first two notes)",
        M2: "'Happy Birthday' (first to third note)",
        m3: "Smoke on the Water riff / 'Greensleeves'",
        M3: "'When the Saints Go Marching In' / 'Oh When the Saints'",
        P4: "'Here Comes the Bride' / 'Amazing Grace'",
        TT: "'The Simpsons' theme / 'Maria' (West Side Story)",
        P5: "Star Wars theme / 'Twinkle Twinkle Little Star'",
        m6: "'The Entertainer' / 'Because' (Beatles)",
        M6: "'My Bonnie Lies Over the Ocean' / 'NBC' jingle",
        m7: "'Somewhere' (West Side Story) / 'Watermelon Man'",
        M7: "'Take On Me' (A-ha) / 'Don't Know Why' (Norah Jones)",
        P8: "'Somewhere Over the Rainbow' / 'Bali Ha'i'",
      },
      
      connections: ["octave", "triads", "circle_of_fifths", "tonnetz_geometry"],
    },

    octave: {
      id: "octave",
      title: "The Octave",
      content_type: "building_block",
      quick_summary: "Twelve semitones up doubles the frequency. Notes an octave apart sound like the same pitch, higher or lower.",
      difficulty: 3,
      related_games: [{ game_id: "harmony_trainer", relevance: "supporting" }, { game_id: "relative_pitch", relevance: "supporting" }],
      related_visualizations: [],
      creative_prompts: ["Find a C on the keyboard, then find the next C up. Play them together — they sound like twins!", "Try singing a note, then singing it higher until it feels like the same note again. That's an octave!", "Play a melody, then play the same thing one octave higher. Same tune, brighter and lighter."],
      tags: ["intervals", "pitch", "fundamentals"],
      visualizationKey: "keyboard_explorer",
      prerequisites: ["semitones_whole_tones"],

      summary: "Twelve semitones up = frequency doubles. Notes an octave apart sound like 'the same note, higher.'",

      levels: {
        musician: `
          An octave is the most natural interval in music — everywhere, in every culture.
          Play C on a piano, then the next C up: they sound like the same note, just higher.
          This is because the higher C vibrates exactly twice as fast as the lower one.
          Our ears perceive frequency doubling as "sameness" — it's hard-wired in human auditory processing.
          All scales and chords repeat in every octave because of this equivalence.
        `,
        theorist: `
          The octave (P8) spans 12 semitones, with a frequency ratio of exactly 2:1.
          Octave equivalence: pitch classes repeat identically every octave — 
          which is why we can treat all C's as "the same note" regardless of register.
          Scientific pitch notation specifies octave: C4 = middle C (261.63 Hz), C5 = 523.25 Hz.
          MIDI encodes pitch absolutely: MIDI note = 12 × (octave + 1) + pitch_class.
          The harmonic series naturally produces octaves (2nd harmonic = 2f₀).
        `,
        math: `
          Octave ratio: f₂/f₁ = 2:1 exactly (both just and equal temperament).
          This is unique — all other "pure" intervals are approximated in 12-TET.
          Pitch class equivalence: notes differing by 12k semitones (k ∈ ℤ) belong to the same pitch class.
          This defines the quotient group: pitch_classes = ℤ / 12ℤ = ℤ₁₂.
          The octave is the fundamental domain of pitch class space — 
          the Tonnetz wraps around in both dimensions because of this.
        `,
        playful: {
          available: true,
          summary: "An octave is the distance from one note to the next note with the same name — it sounds like the same note, just higher or lower.",
          body: `Sing the beginning of "Somewhere Over the Rainbow." The jump on "Some-WHERE" — that's an octave. The two notes sound almost identical, but one is higher.

On a piano, find any C. Count 8 white keys up (including the one you started on). You're on C again. Play both. They're different pitches, but they sound... related. Like they belong together. That's an octave.

When adults and kids sing the same song together, they're usually singing in octaves without knowing it. Same melody, same letter names, different height.

The word "octave" comes from the Latin word for eight. Count the letters: C, D, E, F, G, A, B, C. Eight notes, and then the whole pattern starts over.`,
        },
      },

      practical: "Sing 'Somewhere Over the Rainbow' — that first leap ('Some-WHERE') is a perfect octave.",
      
      connections: ["semitones_whole_tones", "intervals", "chromatic_scale"],
    },

    chromatic_scale: {
      id: "chromatic_scale",
      title: "The Chromatic Scale",
      content_type: "building_block",
      quick_summary: "All twelve notes in order, each a semitone apart. The complete pitch palette from which all scales are carved.",
      difficulty: 3,
      related_games: [],
      related_visualizations: ["scale_explorer"],
      creative_prompts: [],
      tags: ["scales", "pitch", "fundamentals"],
      visualizationKey: "chromatic_clock",
      prerequisites: ["semitones_whole_tones"],

      summary: "All 12 notes in order, each a semitone apart. The complete palette of Western pitch.",

      levels: {
        musician: `
          The chromatic scale is every note, one semitone at a time: C C# D D# E F F# G G# A A# B → C.
          It's not really used as a "key" — it's the complete catalog of available pitches.
          Play all the keys on a piano in order (black and white) and you're playing chromatically.
          Chromatic passages in music create tension, excitement, or a sense of slithering motion.
          Think of the creepy ascending chromatic line in a horror movie — that's the chromatic scale at work.
          It's the raw material from which all other scales are carved.
        `,
        theorist: `
          The chromatic scale contains all 12 pitch classes: {0,1,2,3,4,5,6,7,8,9,10,11}.
          Interval pattern: H-H-H-H-H-H-H-H-H-H-H-H (12 consecutive semitones).
          It is symmetric — starting from any pitch class produces the same intervals.
          Chromatic notes in a diatonic context are "accidentals" — notes outside the current key.
          Chromatic passing tones, neighbor tones, and approach notes add color to diatonic melody.
          Total chromaticism (all 12 notes treated equally) leads to atonality and serialism.
        `,
        math: `
          The chromatic scale = the full cyclic group ℤ₁₂ = {0, 1, 2, ..., 11}.
          Every other scale is a proper subset of the chromatic scale.
          Interval vector: [12,12,12,12,12,6] — maximally uniform distribution of interval classes.
          Chromatic transposition T_n: maps every pitch class x → x+n (mod 12).
          The group of transpositions ⟨T₁⟩ ≅ ℤ₁₂ acts simply transitively on the chromatic scale.
          In frequency space: consecutive chromatic pitches have ratio 2^(1/12) ≈ 1.05946.
        `,
        playful: { available: false },
      },

      practical: "Play every key on a piano from C to C, white and black, in order. That's the chromatic scale — the entire pitch universe of Western music in one octave.",

      connections: ["semitones_whole_tones", "note_names", "major_scale", "octave"],
    },

    // ── TIER 3: SCALES ────────────────────────────────────────────

    major_scale: {
      id: "major_scale",
      title: "The Major Scale",
      content_type: "building_block",
      quick_summary: "Seven notes in a W-W-H-W-W-W-H pattern. The bright, stable foundation of Western tonal music.",
      difficulty: 3,
      related_games: [{ game_id: "chord_spotter", relevance: "supporting" }, { game_id: "harmony_trainer", relevance: "supporting" }, { game_id: "melody_match", relevance: "supporting" }, { game_id: "relative_pitch", relevance: "supporting" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: ["scale_explorer"],
      creative_prompts: ["Play the white keys from C to the next C. You just played a major scale — the happiest sound in music!", "Try starting a major scale from G. You'll need one black key (F#) to keep the pattern right.", "Play a major scale up, then back down. Can you sing along with Do Re Mi?"],
      tags: ["scales", "tonality", "fundamentals"],
      visualizationKey: "scale_dna",
      prerequisites: ["semitones_whole_tones"],

      summary: "Seven notes, a specific W-W-H-W-W-W-H pattern. The foundation of Western music.",

      levels: {
        musician: `
          The major scale is the 'do-re-mi' scale. It sounds bright, happy, resolved.
          It's built from a specific pattern of steps: Whole Whole Half Whole Whole Whole Half.
          Start on ANY note, follow that pattern, and you get a major scale.
          C major uses only white keys (C D E F G A B C) — that's why it's taught first.
          G major is the same pattern starting on G — but now you need F# to maintain the W-W-H-W-W-W-H shape.
          Every key adds one more sharp or flat (which is why the circle of fifths matters).
        `,
        theorist: `
          The major scale is a heptatonic (7-note) scale defined by the interval pattern:
          W-W-H-W-W-W-H (2-2-1-2-2-2-1 semitones).
          Scale degrees: 1̂ (tonic), 2̂ (supertonic), 3̂ (mediant), 4̂ (subdominant),
          5̂ (dominant), 6̂ (submediant), 7̂ (leading tone).
          All 12 major scales contain the same interval relationships — just starting on a different pitch class.
          The major scale is mode I of the diatonic system (Ionian mode).
          Chords built diatonically: I(M), ii(m), iii(m), IV(M), V(M), vi(m), vii°(dim).
        `,
        math: `
          Major scale as pitch class set: {0, 2, 4, 5, 7, 9, 11} (C major, C=0).
          Interval vector: [2,5,4,3,6,1] (counts of each interval class 1–6).
          The major scale is maximally even — notes are as evenly distributed around ℤ₁₂ as possible
          for a 7-note subset.
          Transposing to key of X: add X (mod 12) to each element.
          G major: {7,9,11,0,2,4,6} = {G,A,B,C,D,E,F#}.
          The pattern generates all 12 major scales via transposition (no rotation needed).
        `,
        playful: {
          available: true,
          summary: "A major scale is a specific pattern of whole steps and half steps — it's the \"Do Re Mi\" sound.",
          body: `Sing "Do, Re, Mi, Fa, Sol, La, Ti, Do." That's a major scale. You already know it.

What makes it a *major* scale is the recipe: **whole, whole, half, whole, whole, whole, half.** Start on C, follow that recipe, and you hit only white keys: C, D, E, F, G, A, B, C.

Start on a different note and the recipe still works — you'll just need some black keys to keep the pattern right. Start on G and you need one sharp (F♯). Start on D and you need two (F♯ and C♯). Different starting note, same recipe, same bright, happy sound.

Most of the music you hear on the radio is built on major scales. Once you know the recipe, you can build one starting from any of the 12 notes.`,
        },
      },

      practical: "Learn C, G, and F major scales first. They're the keys used in most beginner repertoire and cover both a sharp and a flat.",
      
      connections: ["minor_scale", "modes", "circle_of_fifths", "diatonic_chords"],
    },

    minor_scale: {
      id: "minor_scale",
      title: "The Minor Scale",
      content_type: "building_block",
      quick_summary: "Same notes as its relative major but centered on a different root, producing a darker, more complex mood.",
      difficulty: 4,
      related_games: [{ game_id: "chord_spotter", relevance: "supporting" }, { game_id: "harmony_trainer", relevance: "supporting" }, { game_id: "melody_match", relevance: "supporting" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: ["scale_explorer"],
      creative_prompts: ["Play the white keys from A to the next A. Does it sound sadder than starting from C?", "Play a major scale, then lower the third note by one key. Hear how the mood shifts?", "Try making up a spooky melody using only the A minor scale (white keys starting on A)."],
      tags: ["scales", "tonality", "emotion"],
      visualizationKey: "scale_dna",
      prerequisites: ["major_scale"],

      summary: "Same notes as a relative major, different root. Darker, more complex emotionally.",

      levels: {
        musician: `
          Minor scales sound darker, sadder, more complex than major.
          The natural minor scale is just the major scale starting from its 6th degree.
          A natural minor = C major starting from A: A B C D E F G A.
          Same notes, totally different feel — because the "home base" changed.
          There's also harmonic minor (raised 7th, creates tension before resolution)
          and melodic minor (raises 6th AND 7th going up, lowers them going down).
          Most "sad" or "dramatic" music lives in minor keys.
        `,
        theorist: `
          Three minor scale variants:
          Natural minor (Aeolian): W-H-W-W-H-W-W. Relative to major (shares key signature).
          Harmonic minor: raises 7̂ by one semitone → W-H-W-W-H-A2-H (A2 = augmented second, 3 semitones).
            Creates the leading tone needed for authentic V→i cadence.
          Melodic minor: ascending raises 6̂ and 7̂; descending = natural minor.
            Eliminates the awkward augmented second of harmonic minor.
          Parallel minor: same tonic as major (C minor vs C major), different notes.
          Relative minor: same notes as major, tonic on 6̂ (A minor relative to C major).
        `,
        math: `
          Natural minor (Aeolian) pitch class set from C: {0,2,3,5,7,8,10}.
          Interval pattern: 2-1-2-2-1-2-2 semitones.
          Relative relationship: natural minor on pitch p = major scale on pitch (p+3) mod 12.
          Harmonic minor: {0,2,3,5,7,8,11} — raises 7th by 1.
          The augmented second between 6̂ and 7̂ in harmonic minor = 3 semitones (unusual in scalar context).
          Melodic minor ascending: {0,2,3,5,7,9,11} (same as major with ♭3).
          This is the "jazz minor" scale — important in jazz harmony.
        `,
        playful: {
          available: true,
          summary: "A minor scale uses a different step pattern than major — it sounds darker, sadder, or more mysterious.",
          body: `Play all the white keys from A to A. That's A minor — the easiest minor scale on piano. Now play from C to C. Same white keys, but it sounds completely different. A minor sounds dark. C major sounds bright.

The minor recipe: **whole, half, whole, whole, half, whole, whole.** Compare it to major — the half steps land in different places. Small change, big difference.

Here's something strange: A minor and C major use the exact same notes. A, B, C, D, E, F, G. But starting on A instead of C shifts everything. It's like telling the same story from a different character's perspective — the facts are identical, but it *feels* different.`,
        },
      },

      practical: "Listen to the same melody in major then minor (e.g., 'Happy Birthday' in minor). The emotional shift is immediate and dramatic.",
      
      connections: ["major_scale", "modes", "relative_minor_major", "harmonic_minor"],
    },

    relative_minor_major: {
      id: "relative_minor_major",
      title: "Relative Major & Minor",
      content_type: "framework",
      quick_summary: "Major and minor keys sharing identical notes but different tonal centers. C major and A minor are relatives.",
      difficulty: 5,
      related_games: [{ game_id: "relative_key_trainer", relevance: "primary" }],
      related_visualizations: ["circle_of_fifths_explorer"],
      creative_prompts: [],
      tags: ["keys", "tonality", "scales", "relationships"],
      visualizationKey: "circle_of_fifths",
      prerequisites: ["major_scale", "minor_scale"],

      summary: "Every major key has a minor twin using the same notes. C major and A minor are relatives.",

      levels: {
        musician: `
          C major and A minor use exactly the same notes — all white keys.
          But they sound completely different because "home" is different (C vs A).
          Every major key has a "relative minor" that shares its key signature:
          G major ↔ E minor, D major ↔ B minor, F major ↔ D minor.
          The relative minor starts on the 6th degree of the major scale.
          This is why you see songs that feel like they shift from happy to sad
          without actually changing the notes — they're moving between relatives.
        `,
        theorist: `
          Relative keys share identical pitch class content (key signature) but different tonal centers.
          Relative minor root = major root − 3 semitones (minor third below).
          Major scale degree 6̂ = relative minor tonic. Minor scale degree 3̂ = relative major tonic.
          Common pivot: the vi chord in major = i chord in relative minor.
          This relationship is visible on the circle of fifths: relative pairs share the same position
          (major on the outside ring, minor on the inside).
          Vs. parallel keys: same root, different mode (C major ↔ C minor — different notes, same tonic).
        `,
        math: `
          Relative minor of key k: k − 3 (mod 12), i.e., T₉(k).
          Pitch class sets are identical: Scale(C major) = Scale(A minor) = {0,2,4,5,7,9,11}.
          The tonic mapping shifts the "origin" in the same set: 0 (C) → 9 (A).
          On the circle of fifths, relative pairs are co-located —
          the minor circle is rotated 3 positions (90°) from the major circle.
          Diatonic chord functions reassign: I(major) → ♭III(minor), vi(major) → i(minor).
          The relative relation is an involution on key-pairs: rel(rel(k)) = k.
        `,
        playful: { available: false },
      },

      practical: "Take any song in C major. Play the same notes but treat A as home — start and end on A. Notice how the mood darkens instantly. Same notes, different story.",

      connections: ["major_scale", "minor_scale", "circle_of_fifths"],
    },

    harmonic_minor: {
      id: "harmonic_minor",
      title: "The Harmonic Minor Scale",
      content_type: "building_block",
      quick_summary: "Natural minor with a raised seventh, creating a leading tone that pulls strongly toward resolution.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["scale_explorer"],
      creative_prompts: [],
      tags: ["scales", "tonality", "tension", "classical"],
      visualizationKey: "scale_dna",
      prerequisites: ["minor_scale"],

      summary: "Natural minor with a raised 7th. Creates the leading tone needed for strong resolution in minor keys.",

      levels: {
        musician: `
          Natural minor has a problem: its 7th degree is a whole step below the tonic,
          so it doesn't "pull" toward home the way the major scale's 7th does.
          The fix: raise the 7th by one semitone. In A minor: G becomes G#.
          Now you get that strong pull from G# up to A — the "leading tone" effect.
          The trade-off: an exotic-sounding gap opens between the 6th and 7th degrees (F to G#).
          That augmented second gives harmonic minor its distinctive Middle Eastern or classical flavor.
          Most minor key classical music relies on this scale for its cadences.
        `,
        theorist: `
          Harmonic minor: W-H-W-W-H-A2-H (2-1-2-2-1-3-1 semitones).
          Pitch class set from A: {9,11,0,2,4,5,8} = A B C D E F G#.
          The raised 7̂ (G#) creates a leading tone → tonic resolution (7̂→1̂ by semitone).
          This enables the dominant triad (E major: E-G#-B) and V7 (E7: E-G#-B-D) in minor keys.
          Without the raised 7th, v is minor (Em), lacking dominant function strength.
          The augmented second (A2, 3 semitones) between ♭6̂ and ♮7̂ is the scale's signature sound.
          Diatonic chords: i, ii°, III+, iv, V, VI, vii° (note the augmented III and major V).
        `,
        math: `
          Harmonic minor pitch class set (from C): {0, 2, 3, 5, 7, 8, 11}.
          Compared to natural minor {0,2,3,5,7,8,10}: element 10 → 11 (raised 7th).
          Interval vector: [3,3,5,4,4,2] — different from major [2,5,4,3,6,1].
          The augmented second between degrees 6 and 7 = 3 semitones.
          The scale is NOT maximally even (unlike major/natural minor) —
          the 3-semitone gap breaks the near-uniform distribution.
          Generates unique chord structures: the diminished 7th on 7̂ (vii°7) is a symmetric chord
          {11,2,5,8} (mod 12), invariant under T₃.
        `,
        playful: { available: false },
      },

      practical: "Play A natural minor (all white keys from A), then play it again but change every G to G#. Hear how the G# creates urgency to resolve up to A? That's the leading tone in action.",

      connections: ["minor_scale", "chord_function", "seventh_chords"],
    },

    modes: {
      id: "modes",
      title: "Modes",
      content_type: "building_block",
      quick_summary: "Seven rotations of the major scale, each with a distinct character from bright Lydian to dark Locrian.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["scale_explorer"],
      creative_prompts: [],
      tags: ["scales", "modes", "tonality", "color"],
      visualizationKey: "scale_mood_spectrum",
      prerequisites: ["major_scale", "minor_scale"],

      summary: "Seven modes = seven ways to rotate the major scale. Each has a distinct sonic personality.",

      levels: {
        musician: `
          Modes are like different "flavors" of the major scale.
          Start C major from C → Ionian (normal major, bright).
          Start it from D → Dorian (minor feel, but with a raised 6th — used in jazz and funk. "Scarborough Fair").
          Start from E → Phrygian (very dark, Spanish/flamenco feel).
          Start from F → Lydian (major but dreamier, the raised 4th gives it a floating quality. Film scores love this).
          Start from G → Mixolydian (major but flat 7th — rock and blues live here. "Norwegian Wood").
          Start from A → Aeolian (natural minor — melancholic).
          Start from B → Locrian (unstable, rare — the "evil" mode).
        `,
        theorist: `
          The seven diatonic modes are rotations of the major scale:
          I   Ionian:      W-W-H-W-W-W-H (major)
          II  Dorian:      W-H-W-W-W-H-W (minor, ♮6)
          III Phrygian:    H-W-W-W-H-W-W (minor, ♭2)
          IV  Lydian:      W-W-W-H-W-W-H (major, ♯4)
          V   Mixolydian:  W-W-H-W-W-H-W (major, ♭7)
          VI  Aeolian:     W-H-W-W-H-W-W (natural minor)
          VII Locrian:     H-W-W-H-W-W-W (diminished, ♭2, ♭5)
          Characteristic note: the one pitch that distinguishes each mode from major/minor.
          Modal music avoids strong V→I cadences (they imply key-based tonality).
        `,
        math: `
          Mode n of scale S = cyclic rotation of S's interval pattern by (n-1) positions.
          All modes share the same pitch class SET as their parent major scale (same 7 notes).
          They differ only in which element is designated tonic (the "rotation center").
          Modal brightness ordering (most to least bright):
          Lydian > Ionian > Mixolydian > Dorian > Aeolian > Phrygian > Locrian.
          Each step left adds one ♭ (lowers one scale degree by 1 semitone).
          Modal interchange: borrowing chords from parallel modes (same root, different mode) — 
          the ♭VII chord in rock comes from Mixolydian.
        `,
        playful: { available: false },
      },

      practical: "Don't memorize modes as separate scales. Hear them as 'major with one note changed.' Dorian = minor with a brighter 6th. Lydian = major with a dreamy raised 4th.",
      
      connections: ["major_scale", "minor_scale", "diatonic_chords", "modal_interchange"],
    },

    modal_interchange: {
      id: "modal_interchange",
      title: "Modal Interchange (Borrowed Chords)",
      content_type: "framework",
      quick_summary: "Borrowing chords from parallel modes for harmonic color, like using a minor iv in a major key.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["harmony", "modes", "chords", "color"],
      visualizationKey: null,
      prerequisites: ["modes", "diatonic_chords"],

      summary: "Borrowing chords from parallel modes adds color. The ♭VII in rock? That's borrowed from Mixolydian.",

      levels: {
        musician: `
          Modal interchange means borrowing chords from a parallel mode — same root, different scale.
          You're in C major but grab a chord from C minor? That's modal interchange.
          The most common borrowed chord: ♭VII (B♭ major in the key of C) — straight from Mixolydian.
          Other favorites: iv (Fm instead of F — gives a bittersweet "Radiohead" feel),
          ♭VI (A♭ major — dramatic, cinematic), and ♭III (E♭ major — bright surprise).
          It's why some progressions sound familiar but slightly "off" in a beautiful way.
          The Beatles were masters of this — "In My Life" borrows from minor for emotional depth.
        `,
        theorist: `
          Modal interchange: using chords diatonic to a parallel mode (same tonic, different mode).
          Most common source: parallel minor (Aeolian) → provides ♭III, iv, ♭VI, ♭VII.
          From Dorian: the natural-6 minor chords (e.g., IV in Dorian minor context).
          From Mixolydian: ♭VII (very common in rock, pop, and folk).
          From Lydian: #IV° or II (bright, uplifting color).
          Chord function is reinterpreted: ♭VII acts as a "soft dominant" (plagal-adjacent).
          ♭VI → ♭VII → I is the "Mario cadence" / backdoor progression —
          resolves to tonic without traditional V→I motion.
        `,
        math: `
          Modal interchange draws chords from the union of diatonic collections sharing a tonic.
          For tonic C: Ionian {0,2,4,5,7,9,11}, Aeolian {0,2,3,5,7,8,10}, Dorian {0,2,3,5,7,9,10}, etc.
          The available chord palette expands from 7 diatonic triads to potentially all triads,
          though in practice only a subset sounds coherent.
          Voice leading efficiency governs which borrowed chords sound smooth:
          ♭VI → ♭VII → I in C: {8,0,3} → {10,2,5} → {0,4,7} — each voice moves ≤ 4 semitones.
          The "brightness" metric of modes (Lydian brightest, Locrian darkest)
          predicts which borrowed chords add brightness vs. darkness to a progression.
        `,
        playful: { available: false },
      },

      practical: "In a I-IV-V-I progression in C major, try replacing IV (F) with iv (Fm). That one lowered note (A→A♭) transforms the feel from bright to bittersweet.",

      connections: ["modes", "diatonic_chords", "chord_function", "common_progressions"],
    },

    pentatonic: {
      id: "pentatonic",
      title: "Pentatonic Scales",
      content_type: "building_block",
      quick_summary: "Five notes, no semitones, no tritones. Universally consonant and found in folk traditions worldwide.",
      difficulty: 4,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["scales", "improvisation", "universality"],
      visualizationKey: "scale_dna",
      prerequisites: ["major_scale"],

      summary: "Five notes. No dissonance. The scale of folk music, blues, and instant improvisation.",

      levels: {
        musician: `
          The pentatonic scale is the most universal scale in the world — found in folk music on every continent.
          Major pentatonic = major scale with the 4th and 7th removed (C D E G A).
          Remove the two notes that cause the most tension, and what's left is pure consonance.
          You can play ANY note in a pentatonic scale over its tonic chord and it will sound good.
          Minor pentatonic (A C D E G) is the backbone of blues, rock, and a lot of pop.
          The black keys on a piano form a major pentatonic scale (F# G# A# C# D#) — improvise freely on them!
        `,
        theorist: `
          Major pentatonic: {0, 2, 4, 7, 9} — degrees 1, 2, 3, 5, 6 of the major scale.
          Omits the tritone-generating degrees 4̂ and 7̂ (which form a tritone with each other in diatonic context).
          Minor pentatonic: {0, 3, 5, 7, 10} — degrees 1, ♭3, 4, 5, ♭7.
          Relative relationship mirrors major/minor: A minor pentatonic = C major pentatonic (same notes, different root).
          Pentatonic scales are maximally consonant 5-note subsets of the chromatic scale.
          "Anhemitonic" (no half steps) — the absence of semitones eliminates all dissonant neighbor relationships.
        `,
        math: `
          Major pentatonic {0,2,4,7,9}: interval vector [0,3,2,1,4,0].
          Note: interval class 1 count = 0 (no semitones) and ic6 count = 0 (no tritones) — "anhemitonic" and "atritonic."
          As a subset of ℤ₁₂, the major pentatonic is a 5-element maximally even set.
          The 5 notes of pentatonic can be generated by stacking P5s:
          C → G → D → A → E (5 steps on the circle of fifths) = {C, D, E, G, A}.
          This P5-stacking origin explains why pentatonic is so consonant — 
          all notes are "close" on the circle of fifths (small harmonic distance).
        `,
        playful: { available: false },
      },

      practical: "Improvise freely on the black keys of a piano. Every note sounds good. That's the power of pentatonic.",
      
      connections: ["major_scale", "minor_scale", "blues_scale", "circle_of_fifths"],
    },

    blues_scale: {
      id: "blues_scale",
      title: "The Blues Scale",
      content_type: "building_block",
      quick_summary: "Minor pentatonic plus a flatted fifth. The blue note adds tension, grit, and expressive depth.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["scales", "blues", "jazz", "emotion"],
      visualizationKey: "scale_dna",
      prerequisites: ["pentatonic"],

      summary: "Minor pentatonic + one 'blue note' (♭5). The sound of tension, bending, and expression.",

      levels: {
        musician: `
          The blues scale is minor pentatonic with one extra note added: the "blue note" — a flatted 5th.
          In A: A C D D# E G. That D# is the blue note — it clashes, bends, aches.
          Blues scales sound tense and expressive. You don't resolve the blue note, you slide past it.
          This is the scale under virtually all blues guitar solos, much of jazz improvisation,
          and the "grit" in soul and R&B.
          The blue note historically represents the microtonal inflections of African-American musical tradition —
          notes that don't fit neatly into Western equal temperament.
        `,
        theorist: `
          Blues scale = minor pentatonic + ♭5 (tritone above root).
          {0, 3, 5, 6, 7, 10} from root (in C: C, E♭, F, G♭, G, B♭).
          The ♭5 ("blue note") creates a tritone with the root — maximum dissonance deliberately introduced.
          Often used as a passing tone between 4̂ and 5̂, not as a resting point.
          The blues scale is used against major, dominant 7th, and minor chord contexts interchangeably —
          its ambiguity (♭3 against major chord, natural 5 vs ♭5) is expressive, not a mistake.
          "Blue notes" historically include ♭3, ♭5, ♭7 — notes that fall "between" Western semitones.
        `,
        math: `
          Blues scale {0,3,5,6,7,10}: 6 pitch classes.
          The ♭5 = pitch class 6 from root — the tritone, = 2^(6/12) = √2 (maximally irrational ratio).
          The presence of both 6 and 7 (♭5 and ♮5) creates a 1-semitone cluster — high dissonance, high tension.
          Blues often uses the scale against a dominant 7th chord (1,3,5,♭7):
          the scale's ♭3 against the chord's ♮3 creates a "crushed" third — 
          simultaneously implying major and minor, which is the defining harmonic ambiguity of blues.
        `,
        playful: { available: false },
      },

      practical: "The blues scale is meant to be *bent*. On guitar, physically bend strings to slide between notes. That glide is the soul of the sound.",
      
      connections: ["pentatonic", "modes", "seventh_chords", "twelve_bar_blues"],
    },

    twelve_bar_blues: {
      id: "twelve_bar_blues",
      title: "The 12-Bar Blues",
      content_type: "reference",
      quick_summary: "A twelve-measure I-IV-V chord form that underpins blues, early rock and roll, and jazz blues.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["form", "blues", "progression", "improvisation"],
      visualizationKey: null,
      prerequisites: ["blues_scale", "diatonic_chords"],

      summary: "Twelve measures, three chords, infinite expression. The most influential form in popular music.",

      levels: {
        musician: `
          The 12-bar blues is a 12-measure chord pattern that repeats:
          | I  | I  | I  | I  |
          | IV | IV | I  | I  |
          | V  | IV | I  | V  |
          In the key of A: A(4 bars), D(2 bars), A(2 bars), E(1), D(1), A(1), E(1 turnaround).
          This simple form is the foundation of blues, early rock & roll, jazz blues, and countless pop songs.
          "Johnny B. Goode," "Hound Dog," countless B.B. King songs — all 12-bar blues.
          The turnaround (bar 12) sets up the loop back to the beginning.
        `,
        theorist: `
          Standard 12-bar blues form using dominant 7th chords:
          | I7  | I7   | I7   | I7  |
          | IV7 | IV7  | I7   | I7  |
          | V7  | IV7  | I7   | V7  |
          All chords are dominant 7ths — unusual in functional harmony (normally only V is dominant).
          This "non-functional" use of dominant 7ths is a defining feature of blues harmony.
          Common variations: quick-change (IV7 in bar 2), jazz blues (adds ii-V motion),
          minor blues (i-iv-v with adjustments), 8-bar blues, 16-bar blues.
          The turnaround (last 2 bars) often uses chromatic voice leading: I-I7-IV-#IV°-I/5-V7.
        `,
        math: `
          The 12-bar form as a formal structure: 3 phrases of 4 bars (AAB lyric form, T-S-D harmonic form).
          Phrase 1 (T): [I, I, I, I] — establishes tonic.
          Phrase 2 (S): [IV, IV, I, I] — subdominant departure and return.
          Phrase 3 (D): [V, IV, I, V] — dominant tension, resolution, turnaround.
          Dominant 7ths on every degree: I7, IV7, V7 all contain tritones.
          The I7 chord (e.g., C-E-G-B♭) is harmonically ambiguous —
          it has dominant function relative to IV, explaining the I7→IV7 motion in bar 5.
          12 bars × 4 beats = 48 beats per cycle. At 120 BPM, one chorus ≈ 24 seconds.
        `,
        playful: { available: false },
      },

      practical: "Learn a 12-bar blues in A on any instrument. It's the universal jam session language — walk into any blues jam, call '12-bar in A,' and everyone can play along.",

      connections: ["blues_scale", "diatonic_chords", "chord_function", "common_progressions"],
    },

    // ── TIER 4: CHORDS ────────────────────────────────────────────

    triads: {
      id: "triads",
      title: "Triads",
      content_type: "building_block",
      quick_summary: "Three notes stacked in thirds. Major, minor, diminished, and augmented are the four atoms of harmony.",
      difficulty: 4,
      related_games: [{ game_id: "chord_spotter", relevance: "primary" }, { game_id: "relative_key_trainer", relevance: "supporting" }, { game_id: "skratch_studio", relevance: "supporting" }],
      related_visualizations: ["chord_voicing_visualizer", "tonnetz_grid"],
      creative_prompts: ["Play C, E, and G together. Now try C, Eb, and G. One is happy, one is sad — which is which?", "Pick any white key, skip one, play the next, skip one, play the next. You just built a triad!", "Play a major chord, then slide the middle note down one key. You just turned it minor!"],
      tags: ["chords", "harmony", "fundamentals"],
      visualizationKey: "chord_construction",
      prerequisites: ["intervals"],

      summary: "Three notes stacked in thirds. The atom of harmony: major, minor, diminished, augmented.",

      levels: {
        musician: `
          A chord is three or more notes played together. The triad is the simplest chord.
          Major triad: bright, stable, happy (C E G — the "C major chord").
          Minor triad: darker, more complex (C E♭ G — one note lower than major).
          Diminished triad: tense, unstable (C E♭ G♭ — two minor thirds stacked).
          Augmented triad: eerie, unresolved (C E G# — two major thirds stacked).
          The difference between major and minor is ONE note — one semitone lower third.
          That single semitone shift changes the entire emotional character of the chord.
        `,
        theorist: `
          Triads are three pitch classes arranged as stacked thirds (intervals of a 3rd).
          Four triad types by interval content (bottom third + top third):
          Major (M):    M3 + m3 = P5 total (C-E-G)
          Minor (m):    m3 + M3 = P5 total (C-E♭-G)
          Diminished (°): m3 + m3 = d5 total (C-E♭-G♭)
          Augmented (+): M3 + M3 = A5 total (C-E-G#)
          Root position: root in bass. 1st inversion: third in bass (6 chord). 2nd inversion: fifth in bass (6/4 chord).
          All triads on Tonnetz: major = downward triangle, minor = upward triangle.
        `,
        math: `
          Triad = ordered triple of pitch classes {r, r+i, r+i+j} where:
          Major: i=4, j=3 (M3 + m3)
          Minor: i=3, j=4 (m3 + M3)
          Diminished: i=3, j=3 (m3 + m3)
          Augmented: i=4, j=4 (M3 + M3)
          24 standard triads: 12 major + 12 minor (the "Riemannian Tonnetz" covers these).
          Neo-Riemannian transforms operate on triads:
          P (Parallel): {r, r+4, r+7} ↔ {r, r+3, r+7} — third moves ±1
          R (Relative): {r, r+4, r+7} ↔ {r+9, r+4, r+7} — root/fifth relationship
          L (Leading-tone): {r, r+4, r+7} ↔ {r+4, r+7, r+11} — subtle shift
        `,
        playful: {
          available: true,
          summary: "A triad is three notes stacked together — the simplest chord, and the foundation of how harmony works.",
          body: `Pick a note. Skip one, grab the next. Skip one more, grab the next. Play all three at once. That's a triad.

Starting on C: take C, skip D, take E, skip F, take G. Play C-E-G together. Sounds full and happy — that's a **major triad.** Start on A: A, skip B, take C, skip D, take E. Play A-C-E. Darker — that's a **minor triad.**

The only difference is the middle note. In a major triad it's a slightly bigger step from the bottom note. In a minor triad it's slightly smaller. One note shifts, and the whole mood changes.

Nearly every song is built from triads moving one to the next. Learn to hear them and build them, and you understand how most music is put together.`,
        },
      },

      practical: "Learn to play all four triad types from C. Then transpose to G and F. Six chords that unlock most beginner repertoire.",
      
      connections: ["intervals", "diatonic_chords", "seventh_chords", "tonnetz_geometry", "tonnetz_transforms"],
    },

    seventh_chords: {
      id: "seventh_chords",
      title: "Seventh Chords",
      content_type: "building_block",
      quick_summary: "A triad plus a seventh above the root, adding richer color and the harmonic tension that drives resolution.",
      difficulty: 5,
      related_games: [{ game_id: "chord_spotter", relevance: "primary" }],
      related_visualizations: ["chord_voicing_visualizer"],
      creative_prompts: [],
      tags: ["chords", "harmony", "jazz", "tension"],
      visualizationKey: "chord_construction",
      prerequisites: ["triads"],

      summary: "Triads + one more third = richer color. The dominant 7th is the engine of harmonic motion.",

      levels: {
        musician: `
          Add one more note (a seventh above the root) to a triad and you get a seventh chord.
          They sound richer, more sophisticated, more "jazzy."
          Most important: the dominant 7th (G7 in the key of C) — it creates irresistible pull back to C.
          The major 7th (Cmaj7) sounds lush and dreamy. The minor 7th (Am7) sounds smooth and relaxed.
          Jazz is built almost entirely on seventh chords. Pop uses them for color. 
          Even if you don't play jazz, understanding the dominant 7th unlocks WHY progressions feel resolved.
        `,
        theorist: `
          Five main seventh chord types (root + interval from root):
          Major 7 (M7):        {0, 4, 7, 11} — M3+m3+M3 (dreamy, tonic color)
          Dominant 7 (7):      {0, 4, 7, 10} — M3+m3+m3 (tension, V function)
          Minor 7 (m7):        {0, 3, 7, 10} — m3+M3+m3 (smooth, ii or vi function)
          Half-diminished (ø7):{0, 3, 6, 10} — m3+m3+M3 (jazz ii° in minor)
          Fully diminished (°7):{0, 3, 6, 9}  — m3+m3+m3 (maximum tension, symmetric)
          The dominant 7th contains a tritone (between 3rd and 7th: B-F in G7) that
          resolves inward to C major's root-third (C-E). This is the engine of V→I motion.
        `,
        math: `
          Dominant 7: {0,4,7,10}. Contains tritone between degrees 3 and 7: intervals of 6 semitones.
          The tritone {4,10} in G7 (B=11, F=5 in C context) resolves by contrary motion:
          B→C (+1 semitone), F→E (−1 semitone) — voice leading minimization.
          Fully diminished 7: {0,3,6,9} — symmetric under T₃ (transposition by 3).
          Only 3 distinct diminished 7th chords exist (all others are transpositions of one of three).
          Half-diminished (ø7) = {0,3,6,10}: used as ii°⁷ in minor keys (the ii-V-i backbone of jazz).
        `,
        playful: { available: false },
      },

      practical: "Learn G7→C and D7→G progressions. Play them repeatedly. Feel how the 7th chord *wants* to resolve — that pull is harmonic gravity.",
      
      connections: ["triads", "chord_function", "cadences", "jazz_harmony"],
    },

    // ── TIER 5: HARMONIC SYSTEMS ──────────────────────────────────

    circle_of_fifths: {
      id: "circle_of_fifths",
      title: "The Circle of Fifths",
      content_type: "framework",
      quick_summary: "Twelve keys arranged by ascending fifths. Adjacent keys share the most notes; the circle maps all of Western tonality.",
      difficulty: 4,
      related_games: [],
      related_visualizations: ["circle_of_fifths_explorer"],
      creative_prompts: [],
      tags: ["harmony", "keys", "structure", "navigation"],
      visualizationKey: "circle_of_fifths",
      prerequisites: ["major_scale", "intervals"],

      summary: "All 12 keys arranged by perfect fifth. The map of Western tonal harmony.",

      levels: {
        musician: `
          The circle of fifths arranges all 12 musical keys in a circle.
          Move clockwise = up a perfect fifth (add one sharp to key signature).
          Move counter-clockwise = down a fifth (add one flat).
          C major has no sharps/flats. G has one sharp. D has two. Etc.
          Keys next to each other on the circle are closely related — they share most of their notes.
          Keys across the circle are "furthest apart" harmonically.
          Use it to: understand key signatures, find related keys, plan chord progressions, navigate modulations.
        `,
        theorist: `
          The circle of fifths orders pitch classes by successive P5 transposition (T₇ in ℤ₁₂).
          Clockwise: C G D A E B (=C♭) F# G♭ D♭ A♭ E♭ B♭ F → C.
          12 applications of T₇ returns to start: 7×12 = 84 = 7 × 12 (mod 12 cycles).
          Key signatures: each clockwise step adds 1 sharp (or removes 1 flat).
          Relative minors sit at the 9th semitone of their major (minor third below):
          C major ↔ A minor. G major ↔ E minor. Etc.
          Harmonic distance: keys n steps apart on circle share (7-n) diatonic pitch classes.
          Adjacent keys (1 step) share 6 of 7 notes — very easy to modulate between.
        `,
        math: `
          The circle of fifths is the orbit of C under T₇ in ℤ₁₂.
          Since gcd(7, 12) = 1, T₇ generates all of ℤ₁₂ — every pitch class appears exactly once.
          (This is why 7 semitones / perfect fifth works as a generator; T₆ would only give 2 elements.)
          Key distance metric: d(k₁, k₂) = min(|k₁-k₂|, 12-|k₁-k₂|) steps on circle.
          Common tones between adjacent keys: 6 of 7 diatonic pitches shared.
          The diatonic collection is a "maximally even" 7-element subset of ℤ₁₂ —
          the circle of fifths ordering is equivalent to the Farey sequence property of maximal evenness.
        `,
        playful: { available: false },
      },

      practical: "Memorize the order of sharps (F C G D A E B) and flats (B E A D G C F) — they're the circle of fifths forward and backward.",
      
      connections: ["major_scale", "minor_scale", "chord_function", "modulation", "tonnetz_geometry"],
    },

    diatonic_chords: {
      id: "diatonic_chords",
      title: "Diatonic Chords & Roman Numerals",
      content_type: "framework",
      quick_summary: "Seven chords built from a scale's own notes. Roman numerals label each chord's position and quality.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["circle_of_fifths_explorer"],
      creative_prompts: [],
      tags: ["harmony", "chords", "function", "analysis"],
      visualizationKey: null,
      prerequisites: ["major_scale", "triads"],

      summary: "7 chords built naturally from a major scale. Roman numerals describe their scale position.",

      levels: {
        musician: `
          Every major scale gives you 7 "free" chords — built by stacking thirds using only the scale's notes.
          In C major: C(I), Dm(ii), Em(iii), F(IV), G(V), Am(vi), Bdim(vii°).
          Roman numerals show the scale degree: uppercase = major, lowercase = minor, ° = diminished.
          The three most important chords in any key are I, IV, and V.
          Most pop songs use: I-V-vi-IV or I-IV-V-I. Learn these in a few keys and you can play hundreds of songs.
          The power of roman numerals: a song analyzed as I-V-vi-IV works in ANY key — 
          just start from a different root.
        `,
        theorist: `
          Diatonic triads in major: I(M), ii(m), iii(m), IV(M), V(M), vi(m), vii°(dim).
          Chord function (three groups):
          Tonic function (stable): I, iii, vi
          Subdominant function (mild tension): ii, IV
          Dominant function (strong tension → resolution): V, vii°
          Functional harmony moves: T → S → D → T (tonic → subdominant → dominant → tonic).
          "Deceptive cadence": V → vi instead of V → I. Surprises the ear with vi (minor) where I was expected.
          Secondary dominants: V/V = D major in C major context, temporarily "tonicizing" G.
        `,
        math: `
          Diatonic triad on scale degree n: notes at positions {n, n+2, n+4} (mod 7, diatonic indexing).
          In pitch class space (C major): chord on degree n = {diatonic[n], diatonic[n+2], diatonic[n+4]} mod 12.
          Chord quality depends on the semitone gaps in the major scale at that position:
          Degree 1: gaps 4,3 → major. Degree 2: gaps 3,4 → minor. Degree 7: gaps 3,3 → diminished.
          Roman numeral analysis is key-invariant: I always = {0, 4, 7} relative to tonic (mod 12).
          This invariance is why transposition preserves harmonic function — 
          same roman numeral analysis means same "story" in any key.
        `,
        playful: { available: false },
      },

      practical: "Learn the I, IV, V chords in G, C, and D major. You can play hundreds of folk and rock songs with just those 9 chords.",
      
      connections: ["major_scale", "triads", "chord_function", "common_progressions", "circle_of_fifths"],
    },

    chord_function: {
      id: "chord_function",
      title: "Chord Function: Tonic, Subdominant, Dominant",
      content_type: "framework",
      quick_summary: "Chords serve as tonic (stable), subdominant (departure), or dominant (tension), creating the grammar of harmonic motion.",
      difficulty: 5,
      related_games: [{ game_id: "chord_spotter", relevance: "supporting" }],
      related_visualizations: ["chord_voicing_visualizer"],
      creative_prompts: [],
      tags: ["harmony", "function", "tension", "resolution"],
      visualizationKey: "tension_meter",
      prerequisites: ["diatonic_chords"],

      summary: "Chords don't just have names — they have jobs. Tension and resolution is the grammar of music.",

      levels: {
        musician: `
          Every chord in a key has a gravitational role.
          Tonic (I, vi): home. Stable, resolved, restful. Where the music starts and ends.
          Subdominant (IV, ii): departure. Mild tension, moving away from home.
          Dominant (V, vii°): tension. Unstable, urgently pulling back toward tonic.
          The basic story of most Western music: leave home (subdominant), 
          build tension (dominant), return home (tonic). Over and over, at different scales.
          The V→I resolution is the "exhale" of music — the moment of arrival.
        `,
        theorist: `
          Functional harmony (Riemann's framework):
          Tonic (T): I, iii, vi — provide stability, can begin or end phrases.
          Subdominant (S): IV, ii — move away from tonic, precede dominant.
          Dominant (D): V, vii° — maximize tension, resolve to tonic.
          Standard progression: T → (S) → D → T.
          Dominant function is powered by: (1) the leading tone (7̂→1̂), (2) the tritone in V7 resolving inward.
          Modal harmony (e.g., Dorian, Mixolydian) weakens functional cadences —
          the ♭7 removes the leading tone, reducing dominant pull. This is the "floating" quality of modal music.
        `,
        math: `
          Voice leading efficiency drives functional harmony.
          V7 → I resolution: B→C (m2 up), F→E (m2 down), D stays, G→C (P4 down).
          Total voice leading distance = 1+1+0+5 = 7 semitones — very small for 4-voice motion.
          Tymoczko's voice leading geometry: triads are points in orbifold T³/S₃.
          Smooth voice leading = short distances in this space.
          Neo-Riemannian theory extends function beyond tonal centers:
          P, L, R transforms move between triads with maximum common tones (2 of 3 notes preserved).
          This explains "functional" progressions in film music that have no clear key center.
        `,
        playful: { available: false },
      },

      practical: "Play I - IV - V - I in any key and really listen. The I feels like home. The IV like leaving. The V like needing to return. Music is organized suspense.",
      
      connections: ["diatonic_chords", "cadences", "common_progressions", "tonnetz_transforms"],
    },

    cadences: {
      id: "cadences",
      title: "Cadences",
      content_type: "framework",
      quick_summary: "Chord pairs that punctuate phrases: authentic (V to I), plagal (IV to I), half (to V), and deceptive (V to vi).",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["harmony", "resolution", "phrase", "function"],
      visualizationKey: "tension_meter",
      prerequisites: ["chord_function"],

      summary: "Harmonic punctuation marks. How chord pairs create endings, pauses, and surprises.",

      levels: {
        musician: `
          A cadence is how a musical phrase ends — the harmonic equivalent of punctuation.
          Authentic cadence (V→I): the period. Complete, final, resolved. "The End."
          Plagal cadence (IV→I): the "Amen" cadence. Gentle, church-like closure.
          Half cadence (anything→V): the comma. Pauses on tension, expects more.
          Deceptive cadence (V→vi): the plot twist. You expect resolution but get surprise.
          Every song you know uses cadences to shape phrases. The reason a chorus feels "finished"
          at the end is almost always an authentic cadence.
        `,
        theorist: `
          Four primary cadence types:
          Perfect authentic cadence (PAC): V→I, both in root position, melody ends on 1̂. Strongest closure.
          Imperfect authentic cadence (IAC): V→I with inversions or melody on 3̂/5̂. Weaker closure.
          Half cadence (HC): phrase ends on V. Open, expectant — "to be continued."
          Plagal cadence (PC): IV→I. Mild closure, often used as a tag after an authentic cadence.
          Deceptive cadence (DC): V→vi (or V→♭VI). Subverts expectation — vi shares two notes with I.
          Phrygian half cadence: iv⁶→V in minor. The ♭2̂→1̂ bass motion gives a distinctive falling quality.
        `,
        math: `
          Cadential strength correlates with voice leading efficiency to tonic:
          V→I: total voice leading distance ≈ 4 semitones (B→C, D→C/E, G→G).
          V7→I: tritone resolution {11,5} → {0,4} = 1+1 = 2 semitones for the tritone voices.
          Deceptive cadence V→vi: {7,11,2} → {9,0,4}. Distance = 2+1+2 = 5 (slightly less efficient than V→I).
          The shared pitch classes between V and vi explain why vi is the
          most convincing deception — it shares maximum common tones with I.
          Cadential closure perception is modeled as a function of
          (1) bass motion by P4/P5, (2) leading tone resolution, (3) metric position (downbeat).
        `,
        playful: { available: false },
      },

      practical: "Play C-G-Am-F, then C-G-C. Feel how G→C is satisfying and final (authentic), while G→Am is a surprise (deceptive). Cadences are the grammar of musical storytelling.",

      connections: ["chord_function", "diatonic_chords", "common_progressions", "seventh_chords"],
    },

    common_progressions: {
      id: "common_progressions",
      title: "Common Chord Progressions",
      content_type: "reference",
      quick_summary: "Recurring chord patterns like I-V-vi-IV and ii-V-I that form the harmonic backbone of countless songs.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["harmony", "songwriting", "progressions", "pop"],
      visualizationKey: null,
      prerequisites: ["diatonic_chords", "chord_function"],

      summary: "I–V–vi–IV, ii–V–I, I–IV–V — the building blocks behind thousands of songs.",

      levels: {
        musician: `
          A few chord progressions dominate popular music:
          I-V-vi-IV: "Let It Be," "No Woman No Cry," "Someone Like You." The most common pop progression.
          I-IV-V-I: Rock and folk backbone. "Twist and Shout," "La Bamba."
          vi-IV-I-V: Same chords rotated. "Despacito," "Africa."
          ii-V-I: The jazz standard. Nearly every jazz song uses this somewhere.
          I-vi-IV-V: '50s doo-wop. "Stand By Me," "Earth Angel."
          The magic is that these work in ANY key — learn the roman numerals, not just the letter names.
        `,
        theorist: `
          Common progressions follow functional harmonic logic (T→S→D→T):
          I-V-vi-IV: T→D→T→S (deceptive turn to vi keeps it cycling).
          I-IV-V-I: T→S→D→T (textbook functional motion).
          ii-V-I: S→D→T (the strongest cadential motion in jazz).
          I-vi-IV-V: T→T→S→D (the '50s progression — builds tension gradually).
          ♭VI-♭VII-I: borrowed chord approach ("Mario cadence," backdoor resolution).
          i-♭VII-♭VI-V: Andalusian cadence (descending bass in minor — "Hit the Road Jack").
          Progression recycling is not plagiarism — harmonic patterns are shared vocabulary,
          like sentence structures in language.
        `,
        math: `
          The I-V-vi-IV loop in pitch class sets (C major):
          {0,4,7} → {7,11,2} → {9,0,4} → {5,9,0}.
          Voice leading distances between consecutive chords:
          I→V: 7+7+7=21 (root position), or 3+1+2=6 (optimal voicing).
          The popularity of I-V-vi-IV may relate to its balanced voice leading:
          each step moves minimal total distance while visiting all three harmonic functions.
          Jazz ii-V-I: {2,5,9} → {7,11,2} → {0,4,7}. Tritone in V7 resolves by contrary semitone motion.
          Markov chain models of pop harmony show I-V and I-IV as highest-probability transitions,
          with vi-IV as the most common "surprising" transition (high entropy, high usage).
        `,
        playful: { available: false },
      },

      practical: "Learn I-V-vi-IV in three keys (C, G, D). You can now play along with hundreds of pop songs. Seriously — try it with any playlist.",

      connections: ["diatonic_chords", "chord_function", "cadences", "twelve_bar_blues", "modal_interchange"],
    },

    circle_of_fifths_advanced: {
      id: "circle_of_fifths_advanced",
      title: "Modulation & Key Relationships",
      content_type: "framework",
      quick_summary: "How key distance on the circle of fifths governs modulation smoothness and shared harmonic material.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["harmony", "modulation", "keys", "navigation"],
      visualizationKey: "circle_of_fifths",
      prerequisites: ["circle_of_fifths", "chord_function"],

      summary: "Moving between keys — how far, how smoothly, and why it creates drama.",

      levels: {
        musician: `
          Modulation means changing key mid-piece. It's a powerful emotional tool.
          Moving to a closely related key (one step on the circle of fifths) feels smooth and natural.
          Moving far (across the circle) feels jarring and dramatic — used for maximum contrast.
          The "truck driver's modulation": abruptly moving up one half step or whole step at a climax.
          Smooth modulation uses a "pivot chord" — a chord that exists in both the old and new key.
          Film composers modulate constantly to follow emotional arcs.
        `,
        theorist: `
          Types of modulation:
          Diatonic pivot chord: chord that functions in both keys (most common, smoothest).
          Chromatic modulation: alter one note of a chord to create a new chord in the new key.
          Enharmonic modulation: respell a chord (e.g., G#° = A♭°) to pivot to a distant key.
          Sequential modulation: repeat a pattern, each time transposed (often by step or fifth).
          Common-tone modulation: keep one note, reharmonize the others.
          Harmonic distance: 2 keys n steps apart on circle share (7-n) common diatonic tones.
          Distant modulations (tritone apart, 6 steps) share no common tones — maximum surprise.
        `,
        math: `
          Key relationship metric on circle of fifths: d(k₁, k₂) = min(n, 12-n) where n = |steps between keys|.
          Common tone count between major scales k₁ and k₂: 7 - d(k₁, k₂) for d ≤ 7.
          Pivot chord analysis: chord C ∈ Scale(k₁) ∩ Scale(k₂) — exists in both diatonic collections.
          Number of pivot chord candidates ≈ proportional to common tone count between keys.
          Enharmonic equivalence in ℤ₁₂ allows pitch class respelling:
          G#°7 = {8,11,2,5} = A♭°7 = {8,11,2,5} — same pitch classes, different functions.
          Tritone substitution in jazz: V7 can be replaced by ♭II7 (tritone away) — 
          same tritone interval, different orientation.
        `,
        playful: { available: false },
      },

      practical: "Find a song you love that has a dramatic key change. Listen for the moment it happens. Did it feel smooth or jarring? That tells you how far the modulation was on the circle.",
      
      connections: ["circle_of_fifths", "chord_function", "secondary_dominants"],
    },

    modulation: {
      id: "modulation",
      title: "Modulation",
      content_type: "framework",
      quick_summary: "Changing key mid-piece using pivot chords, chromatic shifts, or direct jumps for emotional contrast.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["circle_of_fifths_explorer"],
      creative_prompts: [],
      tags: ["harmony", "keys", "transitions", "composition"],
      visualizationKey: "circle_of_fifths",
      prerequisites: ["circle_of_fifths", "chord_function"],

      summary: "Changing key mid-song. Close keys feel smooth; distant keys feel dramatic.",

      levels: {
        musician: `
          Modulation is changing key during a piece — shifting the entire tonal center.
          The most common modulation: up to the key of the dominant (C major → G major).
          In pop music, the "key change" near the end of a song lifts the energy
          (think the final chorus of "Love on Top" by Beyoncé — it modulates FOUR times).
          Smooth modulations use a "pivot chord" that belongs to both the old and new key.
          Abrupt modulations (just jump to the new key) are dramatic and attention-grabbing.
          Composers use modulation to create large-scale emotional arcs across an entire piece.
        `,
        theorist: `
          Modulation types by smoothness:
          Pivot chord (diatonic): a chord common to both keys serves as a bridge.
          Chromatic pivot: alter one note of a diatonic chord to target the new key.
          Direct/phrase modulation: new key starts at a phrase boundary with no preparation.
          Sequential: a pattern repeats at successively different pitch levels.
          Enharmonic: a chord is respelled to function differently (e.g., Ger⁶ → V7).
          Closely related keys (±1 on circle of fifths) share 6/7 notes — easiest to modulate between.
          Remote keys (tritone apart) share the fewest notes — most dramatic.
        `,
        math: `
          Modulation = changing the tonic reference within ℤ₁₂.
          Key distance d(k₁, k₂) on circle of fifths: min(|k₁-k₂|, 12-|k₁-k₂|) steps.
          Common tones between keys k₁ and k₂: |Scale(k₁) ∩ Scale(k₂)| = 7 - d(k₁, k₂) for d ≤ 6.
          Pivot chord set: Chords(k₁) ∩ Chords(k₂) — larger for closer keys.
          Adjacent keys share 4 common triads; keys a tritone apart share 0 common triads.
          The modulation graph (nodes = keys, edges = smooth modulations) is
          the circle of fifths, with edge weight inversely proportional to key distance.
        `,
        playful: { available: false },
      },

      practical: "Find a song with a key change (Beyoncé's 'Love on Top' or Whitney Houston's 'I Wanna Dance with Somebody'). Listen for the exact moment — your ears will tell you when the floor shifts.",

      connections: ["circle_of_fifths", "circle_of_fifths_advanced", "chord_function", "cadences"],
    },

    secondary_dominants: {
      id: "secondary_dominants",
      title: "Secondary Dominants",
      content_type: "framework",
      quick_summary: "Temporary dominant chords that point to non-tonic degrees, adding chromatic sparkle without fully changing key.",
      difficulty: 5,
      related_games: [],
      related_visualizations: [],
      creative_prompts: [],
      tags: ["harmony", "chromaticism", "tension", "tonicization"],
      visualizationKey: "tension_meter",
      prerequisites: ["chord_function", "seventh_chords"],

      summary: "V/V, V/ii, V/vi — dominant chords that temporarily point to a non-tonic chord, adding chromatic color.",

      levels: {
        musician: `
          A secondary dominant is a temporary "pointing" chord — it makes any chord feel like a temporary tonic.
          In C major, the chord D7 doesn't belong. But D7→G sounds like V→I in G major.
          So D7 is "V of V" (V/V) — it dominantizes the V chord.
          Similarly, E7→Am is "V of vi" — it tonicizes the vi chord.
          Secondary dominants add color and direction to progressions without fully changing key.
          They're everywhere: Beatles songs, jazz standards, classical development sections.
          Any major or minor chord in the key can be "tonicized" by its own dominant.
        `,
        theorist: `
          Secondary dominant: V(7)/x, where x is any diatonic chord (except vii°, which lacks a stable root).
          In C major: V/ii = A(7), V/iii = B(7), V/IV = C(7), V/V = D(7), V/vi = E(7).
          Each introduces a chromatic note (the leading tone of the target chord):
          V/V = D7 introduces F#. V/vi = E7 introduces G#.
          These are "tonicizations" — momentary key shifts, not full modulations.
          Extended secondary function: vii°/x, ii-V/x chains.
          Applied chords resolve by P5 descent (or P4 ascent) to their target, just like V→I.
          When a secondary dominant doesn't resolve to its target: deceptive secondary resolution.
        `,
        math: `
          Secondary dominant V7/x: the dominant 7th chord whose root is P5 above x's root.
          V7/V in C: root = 7+7 = 14 ≡ 2 (mod 12) = D. Chord = {2, 6, 9, 0} = D7 (D, F#, A, C).
          The chromatic note introduced: the leading tone of target x = (root_x - 1) mod 12.
          For V7/V: leading tone of G = F# = 6 (not in C major diatonic set {0,2,4,5,7,9,11}).
          Tonicization creates a local pitch class expansion:
          diatonic set ∪ {chromatic leading tone} temporarily.
          Chain of secondary dominants: V7/vi → V7/ii → V7/V → V7 → I follows the circle of fifths
          backward through the diatonic chords — each resolving down a P5.
        `,
        playful: { available: false },
      },

      practical: "In a C major progression, replace the plain G chord with D7→G. That D7 (V/V) adds a spark of tension that makes the G arrival more satisfying. It's a one-chord upgrade to any basic progression.",

      connections: ["chord_function", "seventh_chords", "circle_of_fifths_advanced", "modulation"],
    },

    // ── TIER 6: THE TONNETZ ───────────────────────────────────────

    tonnetz_geometry: {
      id: "tonnetz_geometry",
      title: "The Tonnetz",
      content_type: "framework",
      quick_summary: "A 2D pitch lattice where fifths run horizontally and thirds diagonally. Chords are triangles; voice leading is proximity.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["tonnetz_grid"],
      creative_prompts: [],
      tags: ["tonnetz", "geometry", "neo-riemannian", "visualization"],
      visualizationKey: "tonnetz_explorer",
      prerequisites: ["triads", "intervals"],

      summary: "A 2D lattice that maps all pitch relationships geometrically. Chords are triangles.",

      levels: {
        musician: `
          The Tonnetz is a map of musical pitch relationships.
          Every note appears as a dot. Notes connected by a line are a perfect fifth (horizontal),
          minor third (upper diagonal), or major third (lower diagonal) apart.
          Every triangle in the lattice is a chord: downward triangles are major chords,
          upward triangles are minor chords.
          Moving from one triangle to an adjacent one changes just one note — 
          smooth chord changes happen as small movements on the Tonnetz.
          Film composers like Hans Zimmer and John Williams use Tonnetz logic to create
          harmonic motion that feels inevitable without following traditional key-based rules.
        `,
        theorist: `
          The Tonnetz (German: "tone network") was introduced by Euler (1739) and developed by Riemann (1880).
          Axes: horizontal = P5 (+7 semitones), NE diagonal = m3 (+3), SE diagonal = M3 (+4).
          Note: any two axes generate the third (7 = 3+4, confirming ℤ₁₂ redundancy).
          Major triad = downward-pointing triangle (root, M3 above, P5 above).
          Minor triad = upward-pointing triangle (root, m3 above, P5 above).
          Three neo-Riemannian transforms (edge-flips between adjacent triangles):
          P (Parallel): shared P5 edge, third inverts (M3↔m3)
          R (Relative): shared M3 edge, root/fifth swap
          L (Leading-tone): shared m3 edge, subtle voice leading
          PLR group: 24 elements, acts on the 24 major/minor triads.
        `,
        math: `
          Tonnetz as quotient space: ℝ²/Λ where Λ is the lattice generated by P5 and M3 vectors.
          In ℤ₁₂: P5 = +7 (mod 12), M3 = +4 (mod 12), m3 = +3 (mod 12).
          The lattice wraps around: after 12 steps right (12×7 = 84 = 7×12 ≡ 0 mod 12) → return to start.
          After 3 steps NE (3×3 = 9... eventually 4×3=12≡0) → toroidal topology.
          The Tonnetz is topologically a torus — it tiles the plane but wraps into a donut shape.
          PLR group ≅ dihedral group D₁₂ acting on 24 consonant triads.
          Hexatonic cycles (P then L, repeated): C+ → c → E+ → e → G#+ → g# → C+.
          Octatonic cycles (P then R, repeated): cover 8 triads.
          Tymoczko (2006): Tonnetz = dual graph of the "triad voice-leading lattice" in orbifold T³/S₃.
        `,
        playful: { available: false },
      },

      practical: "Explore the Tonnetz in this app. Find a major chord. Click its neighbors. Listen to how smoothly the harmony changes — that smoothness is geometric efficiency.",
      
      connections: ["triads", "intervals", "tonnetz_transforms", "neo_riemannian"],
    },

    tonnetz_transforms: {
      id: "tonnetz_transforms",
      title: "Neo-Riemannian Transforms (P, L, R)",
      content_type: "framework",
      quick_summary: "Three single-note operations (P, L, R) that transform any triad to its Tonnetz neighbor.",
      difficulty: 5,
      related_games: [{ game_id: "relative_key_trainer", relevance: "supporting" }],
      related_visualizations: ["tonnetz_grid"],
      creative_prompts: [],
      tags: ["tonnetz", "neo-riemannian", "transforms", "voice-leading"],
      visualizationKey: "chord_morphing",
      prerequisites: ["tonnetz_geometry", "triads"],

      summary: "Three operations (P, L, R) transform any major/minor triad into an adjacent one by moving one note.",

      levels: {
        musician: `
          Three moves that transform any chord into a neighboring chord on the Tonnetz:
          P (Parallel): C major → C minor. Same root and fifth, third drops one semitone.
          R (Relative): C major → A minor. The "natural" major/minor pair — shares C and E.
          L (Leading-tone): C major → E minor. Subtle, cinematic shift.
          These three moves are the building blocks of "chromatic" harmony in film and art music.
          Chains of these transforms create dreamlike, key-less harmonic sequences —
          the music keeps moving without ever "arriving" in a traditional key.
          Listen to the opening of Beethoven's 9th, or basically any Hans Zimmer score.
        `,
        theorist: `
          Formal definitions (on major triad {r, r+4, r+7}):
          P: {r, r+4, r+7} → {r, r+3, r+7}  (third: r+4 → r+3, i.e. -1 semitone)
          R: {r, r+4, r+7} → {r-3, r+4, r+7} (root: r → r-3, i.e. -3 semitones — relative minor)
          L: {r, r+4, r+7} → {r+4, r+7, r+11} (root: r → r+11, i.e. -1 semitone — leading tone)
          On minor triad {r, r+3, r+7}: transforms invert (P, R, L operate symmetrically).
          Compositions: PL = rotation by M3, PR = rotation by m3, LR = rotation by m2.
          The PLR group has 24 elements — one for each of the 24 major/minor triads.
          Special cycles:
          Hexatonic: (PL)³ = identity (6 chords, cycle of M3s)
          Octatonic: (PR)⁴ = identity (8 chords, cycle of m3s)
        `,
        math: `
          The PLR group is isomorphic to the dihedral group D₁₂ of order 24.
          It acts simply transitively on the 24 major/minor triads.
          P, L, R are involutions: P²=L²=R²=identity.
          Group presentation: ⟨P, L, R | P²=L²=R²=(PL)³=(PR)⁴=(LR)⁶=1⟩
          (orders of compositions match the hexatonic, octatonic, and chromatic cycles).
          The Tonnetz is the Cayley graph of this group — each edge = one generator (P, L, or R).
          Contextual inversion interpretation: P, L, R are inversions that fix different intervals:
          P fixes the P5, L fixes the m3, R fixes the M3.
          Voice leading: each transform moves exactly one note by one or two semitones.
          Minimum total voice leading distance = 1 (P and L move 1 semitone, R moves 2).
        `,
        playful: { available: false },
      },

      practical: "In the Tonnetz explorer: pick any chord, apply P, then L, then R. Hear how each move shifts just one note. That's voice leading efficiency made visible.",
      
      connections: ["tonnetz_geometry", "triads", "chord_function", "hexatonic_cycles"],
    },

    neo_riemannian: {
      id: "neo_riemannian",
      title: "Neo-Riemannian Theory",
      content_type: "framework",
      quick_summary: "Chromatic harmony analyzed by geometric transforms rather than key centers, explaining keyless film-score progressions.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["tonnetz_grid"],
      creative_prompts: [],
      tags: ["theory", "neo-riemannian", "chromaticism", "film-music"],
      visualizationKey: "chord_morphing",
      prerequisites: ["tonnetz_geometry", "tonnetz_transforms"],

      summary: "A framework for chromatic harmony that doesn't need keys. Geometry replaces function.",

      levels: {
        musician: `
          Traditional harmony asks "what key are we in?" Neo-Riemannian theory asks
          "how did we get from one chord to the next?"
          It explains music that drifts through chords without settling in a key —
          like film scores, late Romantic music, and some progressive rock.
          Instead of keys and functions, it tracks which notes move and by how much.
          The result: an elegant geometric model where smooth chord changes = small movements on the Tonnetz.
          This is why filmmakers can score emotional scenes with chord progressions
          that don't follow any textbook rules — they follow geometric efficiency instead.
        `,
        theorist: `
          Neo-Riemannian theory (NRT) originated with David Lewin (1982), Brian Hyer, and Richard Cohn (1990s).
          It extends Hugo Riemann's dualistic harmony to explain chromatic progressions
          that resist functional tonal analysis.
          Core principle: parsimonious voice leading — chords connected by minimal note movement.
          The three basic transforms (P, L, R) are contextual inversions, each preserving two common tones.
          NRT excels at analyzing: Schubert, Wagner, Liszt, film scores, video game music.
          Compound transforms (PL, PR, LR) create closed cycles —
          harmonic motion without tonal resolution.
          Extended NRT: SLIDE transform, hexatonic poles, Weitzmann regions.
        `,
        math: `
          NRT formalizes chromatic harmony using group actions on the set of 24 consonant triads.
          The PLR group ≅ D₁₂ (dihedral group of order 24) acting on {major, minor} × ℤ₁₂.
          Each generator is a contextual inversion: the inversion axis depends on the input chord's quality.
          P: inversion fixing the P5 (preserves root and fifth).
          L: inversion fixing the m3 (preserves third and fifth).
          R: inversion fixing the M3 (preserves root and third).
          Tymoczko's orbifold model: triads as points in T³/S₃ (3-torus modulo permutation).
          NRT transforms = short geodesics in this orbifold.
          Cohn's hexatonic systems partition the 24 triads into 4 hexatonic sets of 6,
          each closed under PL. Between sets: LR transitions.
        `,
        playful: { available: false },
      },

      practical: "Watch any dramatic film scene — notice how the music moves between chords that don't seem to belong to any key. That's neo-Riemannian harmony at work. The Tonnetz makes it visible.",

      connections: ["tonnetz_geometry", "tonnetz_transforms", "hexatonic_cycles", "chord_function"],
    },

    hexatonic_cycles: {
      id: "hexatonic_cycles",
      title: "Hexatonic Cycles",
      content_type: "framework",
      quick_summary: "Six chords looping through alternating P and L transforms. Maximally smooth voice leading in a closed cycle.",
      difficulty: 5,
      related_games: [],
      related_visualizations: ["tonnetz_grid"],
      creative_prompts: [],
      tags: ["tonnetz", "neo-riemannian", "cycles", "chromaticism"],
      visualizationKey: "chord_morphing",
      prerequisites: ["tonnetz_transforms"],

      summary: "Six chords cycling through P and L transforms. Maximally smooth voice leading in a closed loop.",

      levels: {
        musician: `
          A hexatonic cycle is a loop of six chords created by alternating P and L transforms:
          C major → C minor → A♭ major → A♭ minor → E major → E minor → back to C major.
          Each step changes just one note by one semitone — the smoothest possible chord changes.
          The six chords use only six of the twelve pitch classes (hence "hexatonic").
          This cycle sounds dreamlike, floating, and otherworldly — no sense of key, just smooth motion.
          Composers like Brahms, Wagner, and film composer Howard Shore use hexatonic cycles
          for passages that feel suspended between worlds.
        `,
        theorist: `
          Hexatonic cycle = (PL)³ = identity. Alternating P (parallel) and L (leading-tone) transforms.
          Starting from C major: C+ →P c →L A♭+ →P a♭ →L E+ →P e →L C+.
          The 6 chords use exactly 6 pitch classes: one of the four "hexatonic collections."
          Four hexatonic systems (Cohn, 1996):
          H₀: {C+, c, A♭+, a♭, E+, e} — pitch classes {0, 3, 4, 7, 8, 11}
          H₁: {G+, g, E♭+, e♭, B+, b} — pitch classes {2, 3, 6, 7, 10, 11}
          H₂: {D+, d, B♭+, b♭, F#+, f#} — pitch classes {1, 2, 5, 6, 9, 10}
          H₃: {A+, a, F+, f, D♭+, d♭} — pitch classes {0, 1, 4, 5, 8, 9}
          Hexatonic poles: the pair of chords in each system with NO common tones (e.g., C+ and a♭).
        `,
        math: `
          The hexatonic cycle is the orbit of a triad under the compound operation PL (order 3).
          (PL)³ = identity: period 6 on triads (alternating major/minor), period 3 on roots (cycle of M3s).
          Root motion: 0 → 0 → 8 → 8 → 4 → 4 → 0 (mod 12). Major third cycle: {0, 4, 8}.
          Hexatonic pitch class set: complement of an augmented triad's complement.
          H₀ = {0,3,4,7,8,11} = ℤ₁₂ \\ {1,2,5,6,9,10}.
          Each hexatonic set is the union of two augmented triads a semitone apart: {0,4,8} ∪ {3,7,11}.
          Interval vector of a hexatonic collection: [3,0,3,6,3,0] — no ic1 or ic5.
          The four hexatonic systems partition all 24 consonant triads into 4 groups of 6.
          The "hyper-hexatonic system" connects the 4 groups via LR transforms.
        `,
        playful: { available: false },
      },

      practical: "On a keyboard, play: C major → C minor → A♭ major → A♭ minor → E major → E minor → C major. Each change is just one note moving by one semitone. It sounds like the music is breathing.",

      connections: ["tonnetz_transforms", "neo_riemannian", "tonnetz_geometry"],
    },
  }, // end topics


  // ================================================================
  // VISUALIZATIONS
  // Each entry configures one interactive component.
  // Renderer classes live in /js/visuals/*.js
  // ================================================================

  visualizations: {

    chromatic_clock: {
      id: "chromatic_clock",
      title: "Chromatic Clock",
      componentClass: "ChromaticClock",         // /js/visuals/chromatic-clock.js
      relatedTopics: ["semitones_whole_tones", "intervals", "circle_of_fifths"],
      description: "12 notes arranged as a clock face. Intervals are arcs. Symmetry becomes visible.",
      interactionHints: [
        "Click any note to set it as root",
        "Hover interval arcs to hear and identify",
        "Toggle 'chord mode' to highlight triads",
      ],
    },

    keyboard_explorer: {
      id: "keyboard_explorer",
      title: "Interactive Keyboard",
      componentClass: "KeyboardExplorer",
      relatedTopics: ["note_names", "semitones_whole_tones", "octave"],
      description: "Play notes, see frequency (Hz), MIDI number, and interval relationships ripple outward.",
      interactionHints: [
        "Click any key to hear and identify it",
        "Hold a key to see all interval relationships highlighted",
        "Toggle 'scale mode' to highlight a selected scale pattern",
      ],
    },

    scale_dna: {
      id: "scale_dna",
      title: "Scale DNA",
      componentClass: "ScaleDNA",
      relatedTopics: ["major_scale", "minor_scale", "modes", "pentatonic", "blues_scale"],
      description: "The W-H step pattern shown as a barcode. Drag the root to transpose. Compare scales side by side.",
      interactionHints: [
        "Drag root note left/right to transpose",
        "Select two scales to overlay and compare",
        "Click any step to hear the note",
      ],
    },

    scale_mood_spectrum: {
      id: "scale_mood_spectrum",
      title: "Mode Brightness Spectrum",
      componentClass: "ModeBrightness",
      relatedTopics: ["modes"],
      description: "All 7 modes on a brightness axis from Locrian (darkest) to Lydian (brightest).",
      interactionHints: [
        "Click any mode to hear it",
        "Drag the brightness slider to step through modes",
        "See which scale degree changes at each step",
      ],
    },

    interval_character_cards: {
      id: "interval_character_cards",
      title: "Interval Character Cards",
      componentClass: "IntervalCards",
      relatedTopics: ["intervals"],
      description: "Each interval as a card: name, semitone count, sonic character, ratio, mnemonic song.",
      interactionHints: [
        "Click any card to hear the interval",
        "Flip the card for the mnemonic song",
        "Quiz mode: hear it, identify it",
      ],
    },

    circle_of_fifths: {
      id: "circle_of_fifths",
      title: "Circle of Fifths",
      content_type: "framework",
      quick_summary: "Twelve keys arranged by ascending fifths. Adjacent keys share the most notes; the circle maps all of Western tonality.",
      difficulty: 4,
      related_games: [],
      related_visualizations: ["circle_of_fifths_explorer"],
      creative_prompts: [],
      componentClass: "CircleOfFifths",
      relatedTopics: ["circle_of_fifths", "major_scale", "minor_scale", "modulation"],
      description: "Animated circle. Watch key signatures accumulate. Trace modulation paths. See relative minors.",
      interactionHints: [
        "Click any key to set it as tonic",
        "Drag between two keys to see modulation distance",
        "Toggle 'relative minor' overlay",
        "Watch sharps/flats animate as you move around the circle",
      ],
    },

    waveform_explorer: {
      id: "waveform_explorer",
      title: "Waveform & Ratio Visualizer",
      componentClass: "WaveformExplorer",
      relatedTopics: ["sound_basics", "intervals", "octave"],
      description: "Two sine waves. Change the interval, watch alignment change. See why P5 (3:2) is so consonant.",
      interactionHints: [
        "Set the interval with the slider",
        "Watch wave alignment — simple ratios align more often",
        "Toggle between just intonation and equal temperament",
      ],
    },

    chord_construction: {
      id: "chord_construction",
      title: "Chord Construction Sandbox",
      componentClass: "ChordBuilder",
      relatedTopics: ["triads", "seventh_chords"],
      description: "Drag intervals onto a root note. The system identifies what you've built and shows its Tonnetz position.",
      interactionHints: [
        "Drag interval chips onto the root",
        "System names the chord and shows its type",
        "Click 'Show on Tonnetz' to see its lattice position",
      ],
    },

    chord_morphing: {
      id: "chord_morphing",
      title: "Chord Morphing (PLR Transforms)",
      componentClass: "ChordMorphing",
      relatedTopics: ["tonnetz_transforms", "tonnetz_geometry"],
      description: "Start on any triad. Apply P, L, R transforms one at a time. Watch the Tonnetz triangle flip and slide.",
      interactionHints: [
        "Select a starting chord",
        "Click P, L, or R to apply transform",
        "Watch triangle move on Tonnetz, hear the chord change",
        "Build a sequence and play it back",
      ],
    },

    tension_meter: {
      id: "tension_meter",
      title: "Harmonic Tension Meter",
      componentClass: "TensionMeter",
      relatedTopics: ["chord_function", "cadences", "seventh_chords"],
      description: "Real-time dissonance gauge as chords play. See tension rise through ii→V, release on I.",
      interactionHints: [
        "Play any chord or progression",
        "Watch the needle move",
        "See which intervals inside the chord create tension",
      ],
    },

    tonnetz_explorer: {
      id: "tonnetz_explorer",
      title: "Tonnetz Explorer",
      componentClass: "TonnetzExplorer",
      relatedTopics: ["tonnetz_geometry", "tonnetz_transforms", "triads"],
      description: "The main Tonnetz lattice. Click nodes, highlight chords, trace progressions.",
      interactionHints: [
        "Click any node to hear and identify the note",
        "Click any triangle to highlight a chord",
        "Use chord buttons to see progressions traced on the lattice",
        "Apply PLR transforms to morph between chords",
      ],
    },

    staff_explorer: {
      id: "staff_explorer",
      title: "Staff Explorer",
      componentClass: "StaffExplorer",
      relatedTopics: ["the_staff", "note_names"],
      description: "Interactive staff. Click lines and spaces to hear notes. See ledger lines appear as you go higher/lower.",
      interactionHints: [
        "Click any line or space to hear the note",
        "Toggle treble / bass / grand staff",
        "Drag a note to see its name change",
      ],
    },

    rhythm_grid: {
      id: "rhythm_grid",
      title: "Rhythm Grid",
      componentClass: "RhythmGrid",
      relatedTopics: ["rhythm", "meter_and_groove"],
      description: "A beat grid showing subdivisions. Tap to place notes. Hear how meter and groove shape rhythmic feel.",
      interactionHints: [
        "Click grid cells to place or remove notes",
        "Switch between 4/4, 3/4, and 6/8 time signatures",
        "Adjust the swing amount to hear groove changes",
      ],
    },
  }, // end visualizations


  // ================================================================
  // GAMES
  // Intro screen content for each game (Option B).
  // ================================================================

  games: {

    interval_trainer: {
      id: "interval_trainer",
      title: "Interval Trainer",
      subtitle: "Ear training · Recognition · Aural skills",
      number: 1,
      difficulty: "beginner–intermediate",
      duration: "~5 min/session",
      objective: "Identify musical intervals by ear",
      relatedTopics: ["intervals", "semitones_whole_tones"],
      visualizationKey: "interval_character_cards",

      hook: "The ability to hear an interval and name it — without any instrument — is one of the most powerful skills a musician can develop.",

      whatYouTrain: "Recognizing the distance between two notes by sound alone. From a minor second to an octave, each interval has a character your ear can learn.",

      whyItMatters: "Interval recognition is the foundation of transcribing music by ear, improvising, and understanding why chord progressions feel the way they do.",

      theoryPreview: {
        musician: "An interval is how far apart two notes are in pitch. Each has a recognizable sonic personality — tense, bright, open, hollow. This game trains that recognition.",
        theorist: "Intervals are measured in semitones within 12-TET. They have size (2nd, 3rd...) and quality (major, minor, perfect). This game covers all 12 chromatic intervals within an octave.",
        math: "Interval n semitones → frequency ratio 2^(n/12). Consonance correlates with ratio simplicity. P5 (7st) ≈ 3:2, M3 (4st) ≈ 5:4, tritone (6st) = √2 (maximally irrational).",
      },
    },

    harmony_explorer: {
      id: "harmony_explorer",
      title: "Harmony Explorer",
      subtitle: "Tonnetz · Chord progressions · Voice leading",
      number: 2,
      difficulty: "intermediate",
      duration: "~10 min/session",
      objective: "Navigate the Tonnetz and understand chord relationships geometrically",
      relatedTopics: ["tonnetz_geometry", "tonnetz_transforms", "triads", "chord_function"],
      visualizationKey: "tonnetz_explorer",

      hook: "Music's harmonic logic has a shape — and you can see it.",

      whatYouTrain: "Reading chord relationships spatially. Understanding why certain chord progressions feel smooth (short distance on the Tonnetz) or surprising (large distance).",

      whyItMatters: "Seeing harmony geometrically accelerates intuition. Film composers and jazz musicians think in these spatial terms — now you can too.",

      theoryPreview: {
        musician: "Every chord is a triangle on the Tonnetz. Adjacent triangles share two notes. Moving between neighbors = smooth voice leading. This game makes that visible.",
        theorist: "The Tonnetz represents triads as triangles in a lattice of perfect fifths and thirds. Neo-Riemannian transforms (P, L, R) are edge-flips — each moves one voice by one or two semitones.",
        math: "The PLR group acts on 24 major/minor triads, isomorphic to D₁₂. The Tonnetz is its Cayley graph. Hexatonic cycles: (PL)³=identity. Octatonic cycles: (PR)⁴=identity.",
      },
    },

    rhythm_trainer: {
      id: "rhythm_trainer",
      title: "Rhythm Trainer",
      subtitle: "Timing · Meter · Subdivision",
      number: 3,
      difficulty: "beginner",
      duration: "~5 min/session",
      objective: "Feel and reproduce rhythmic patterns accurately",
      relatedTopics: ["rhythm"],
      visualizationKey: "rhythm_grid",

      hook: "Rhythm is the skeleton of music. Everything else hangs on it.",

      whatYouTrain: "Internalizing rhythmic patterns, understanding meter, and reproducing subdivisions accurately under time pressure.",

      whyItMatters: "Solid rhythm is more important than perfect pitch for most practical musicianship. A rhythm mistake is heard immediately; a slightly sharp note much less so.",

      theoryPreview: {
        musician: "Rhythm is organized time. The beat is the pulse. Notes are durations relative to that pulse. 4/4 means four beats per bar, each beat a quarter note.",
        theorist: "Duration as dyadic fractions of a whole note. Simple meters divide beats in 2; compound meters in 3. Polyrhythm: two or more independent meters simultaneously.",
        math: "Duration in seconds = (60/BPM) × (note_value / quarter_note_value). Metric structure = hierarchical grouping of time points. Cross-rhythm ratio n:m means n pulses against m.",
      },
    },
  }, // end games


  // ================================================================
  // GLOSSARY
  // Quick-reference definitions (used in tooltip one-liners)
  // ================================================================

  glossary: {
    semitone:        "The smallest interval in Western music — one piano key, one guitar fret.",
    whole_tone:      "Two semitones. Also called a 'whole step' or 'major second.'",
    interval:        "The distance in pitch between two notes, measured in semitones.",
    triad:           "A three-note chord built by stacking two thirds above a root.",
    tonic:           "The home note (or chord) of a key. The note the music resolves to.",
    dominant:        "The fifth scale degree, or the chord built on it. Creates the strongest tension before tonic.",
    leading_tone:    "The seventh scale degree — one semitone below tonic. Strongly pulls upward to resolve.",
    consonance:      "Intervals or chords that sound stable and restful (P5, M3, m3, P4).",
    dissonance:      "Intervals or chords that sound tense and unstable (m2, M7, tritone).",
    enharmonic:      "Two different names for the same pitch: C# and D♭ are enharmonic.",
    tritone:         "An interval of 6 semitones — exactly half an octave. Maximally dissonant.",
    modulation:      "Changing from one key to another during a piece.",
    cadence:         "A harmonic progression that creates a sense of pause or ending.",
    voice_leading:   "The smooth movement of individual notes (voices) between chords.",
    diatonic:        "Using only the notes of a given key or scale (no accidentals).",
    chromatic:       "Using notes outside the current key/scale (accidentals).",
    tonnetz:         "A 2D lattice mapping pitch relationships geometrically. Chords appear as triangles.",
    PLR:             "Parallel, Leading-tone, Relative — the three neo-Riemannian triad transforms.",
    pitch_class:     "A note name ignoring octave (all C's are pitch class 0).",
    equal_temperament: "The tuning system dividing the octave into 12 equal semitones. Standard today.",
    just_intonation: "Tuning based on pure frequency ratios (3:2, 5:4). Sounds pure but can't change keys freely.",
  },

}; // end THEORY


// ================================================================
// VALIDATION (run with: node scripts/validate-theory.js)
// Checks all required fields are present, all cross-references valid
// ================================================================
export function validateTheory() {
  const errors = [];
  const topicIds = new Set(Object.keys(THEORY.topics));
  const vizIds = new Set(Object.keys(THEORY.visualizations));

  Object.entries(THEORY.topics).forEach(([id, topic]) => {
    // Required fields
    ['id','title','tier','tags','summary','levels','practical','connections'].forEach(field => {
      if (!topic[field]) errors.push(`${id}: missing field '${field}'`);
    });
    // Required depth levels
    ['musician','theorist','math'].forEach(level => {
      if (!topic.levels?.[level]) errors.push(`${id}: missing depth level '${level}'`);
    });
    // Enforce prerequisites array exists (even if empty) so consumers can always iterate
    if (!Array.isArray(topic.prerequisites)) {
      errors.push(`${id}: missing or non-array 'prerequisites' (use [] for root topics)`);
    }
    // Valid visualization key
    if (topic.visualizationKey && !vizIds.has(topic.visualizationKey)) {
      errors.push(`${id}: visualizationKey '${topic.visualizationKey}' not found`);
    }
    // Valid connections
    topic.connections?.forEach(conn => {
      if (!topicIds.has(conn)) errors.push(`${id}: connection '${conn}' not found`);
    });
    // Valid prerequisites
    topic.prerequisites?.forEach(pre => {
      if (!topicIds.has(pre)) errors.push(`${id}: prerequisite '${pre}' not found`);
    });
  });

  // Validate THEORY.games — confirm relatedTopics point to valid topic keys
  Object.entries(THEORY.games || {}).forEach(([gameId, game]) => {
    (game.relatedTopics || []).forEach(ref => {
      if (!topicIds.has(ref)) {
        errors.push(`games.${gameId}: relatedTopics reference '${ref}' not found in topics`);
      }
    });
  });

  if (errors.length === 0) {
    // validation passed
  } else {
    console.error('✗ Validation errors:\n' + errors.join('\n'));
  }
  return errors;
}
