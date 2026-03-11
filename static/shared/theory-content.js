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
      tier: "beginner",
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
      },

      practical: "Next time you pluck a guitar string, watch it vibrate. That motion IS the sound.",
      
      connections: ["the_staff", "octave", "intervals"], // related topic IDs
    },

    the_staff: {
      id: "the_staff",
      title: "The Staff & Clefs",
      tier: "beginner",
      tags: ["notation", "reading", "fundamentals"],
      visualizationKey: "staff_explorer",
      prerequisites: ["sound_basics"],

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
      },

      practical: "Spend 5 minutes on musictheory.net's Note Identification exercise. Fluent reading is muscle memory.",
      
      connections: ["note_names", "rhythm", "ledger_lines"],
    },

    note_names: {
      id: "note_names",
      title: "Note Names & the Musical Alphabet",
      tier: "beginner",
      tags: ["notation", "pitch", "fundamentals"],
      visualizationKey: "keyboard_explorer",
      prerequisites: ["the_staff"],

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
      },

      practical: "Learn the piano keyboard layout first — it's the clearest physical model of the 12 pitches.",
      
      connections: ["semitones_whole_tones", "the_staff", "chromatic_scale"],
    },

    rhythm: {
      id: "rhythm",
      title: "Rhythm & Duration",
      tier: "beginner",
      tags: ["rhythm", "notation", "time"],
      visualizationKey: "rhythm_grid",
      prerequisites: ["the_staff"],

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
          A triplet subdivides a beat by 2/3: three triplet-eighths = one quarter note.
          Time signature n/d: measure duration = n × (1/d) whole notes.
        `,
      },

      practical: "Clap along to music and count out loud. Physical beat internalization precedes reading.",
      
      connections: ["the_staff", "meter_and_groove"],
    },

    // ── TIER 2: PITCH RELATIONSHIPS ───────────────────────────────

    semitones_whole_tones: {
      id: "semitones_whole_tones",
      title: "Semitones & Whole Tones",
      tier: "beginner",
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
      },

      practical: "On a piano or guitar, move one fret/key at a time — that's a semitone. Hear how small it is.",
      
      connections: ["intervals", "chromatic_scale", "major_scale"],
    },

    intervals: {
      id: "intervals",
      title: "Intervals",
      tier: "intermediate",
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
      tier: "beginner",
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
      },

      practical: "Sing 'Somewhere Over the Rainbow' — that first leap ('Some-WHERE') is a perfect octave.",
      
      connections: ["semitones_whole_tones", "intervals", "chromatic_scale"],
    },

    // ── TIER 3: SCALES ────────────────────────────────────────────

    major_scale: {
      id: "major_scale",
      title: "The Major Scale",
      tier: "beginner",
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
      },

      practical: "Learn C, G, and F major scales first. They're the keys used in most beginner repertoire and cover both a sharp and a flat.",
      
      connections: ["minor_scale", "modes", "circle_of_fifths", "diatonic_chords"],
    },

    minor_scale: {
      id: "minor_scale",
      title: "The Minor Scale",
      tier: "beginner",
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
      },

      practical: "Listen to the same melody in major then minor (e.g., 'Happy Birthday' in minor). The emotional shift is immediate and dramatic.",
      
      connections: ["major_scale", "modes", "relative_minor_major", "harmonic_minor"],
    },

    modes: {
      id: "modes",
      title: "Modes",
      tier: "intermediate",
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
      },

      practical: "Don't memorize modes as separate scales. Hear them as 'major with one note changed.' Dorian = minor with a brighter 6th. Lydian = major with a dreamy raised 4th.",
      
      connections: ["major_scale", "minor_scale", "diatonic_chords", "modal_interchange"],
    },

    pentatonic: {
      id: "pentatonic",
      title: "Pentatonic Scales",
      tier: "beginner",
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
          Major pentatonic {0,2,4,7,9}: interval vector [0,2,3,2,2,1].
          Note: interval class 1 count = 0 (no semitones — "anhemitonic").
          As a subset of ℤ₁₂, the major pentatonic is a 5-element maximally even set.
          The 5 notes of pentatonic can be generated by stacking P5s:
          C → G → D → A → E (5 steps on the circle of fifths) = {C, D, E, G, A}.
          This P5-stacking origin explains why pentatonic is so consonant — 
          all notes are "close" on the circle of fifths (small harmonic distance).
        `,
      },

      practical: "Improvise freely on the black keys of a piano. Every note sounds good. That's the power of pentatonic.",
      
      connections: ["major_scale", "minor_scale", "blues_scale", "circle_of_fifths"],
    },

    blues_scale: {
      id: "blues_scale",
      title: "The Blues Scale",
      tier: "intermediate",
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
      },

      practical: "The blues scale is meant to be *bent*. On guitar, physically bend strings to slide between notes. That glide is the soul of the sound.",
      
      connections: ["pentatonic", "modes", "seventh_chords", "twelve_bar_blues"],
    },

    // ── TIER 4: CHORDS ────────────────────────────────────────────

    triads: {
      id: "triads",
      title: "Triads",
      tier: "beginner",
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
      },

      practical: "Learn to play all four triad types from C. Then transpose to G and F. Six chords that unlock most beginner repertoire.",
      
      connections: ["intervals", "diatonic_chords", "seventh_chords", "tonnetz_geometry", "tonnetz_transforms"],
    },

    seventh_chords: {
      id: "seventh_chords",
      title: "Seventh Chords",
      tier: "intermediate",
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
      },

      practical: "Learn G7→C and D7→G progressions. Play them repeatedly. Feel how the 7th chord *wants* to resolve — that pull is harmonic gravity.",
      
      connections: ["triads", "chord_function", "cadences", "jazz_harmony"],
    },

    // ── TIER 5: HARMONIC SYSTEMS ──────────────────────────────────

    circle_of_fifths: {
      id: "circle_of_fifths",
      title: "The Circle of Fifths",
      tier: "intermediate",
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
      },

      practical: "Memorize the order of sharps (F C G D A E B) and flats (B E A D G C F) — they're the circle of fifths forward and backward.",
      
      connections: ["major_scale", "minor_scale", "chord_function", "modulation", "tonnetz_geometry"],
    },

    diatonic_chords: {
      id: "diatonic_chords",
      title: "Diatonic Chords & Roman Numerals",
      tier: "intermediate",
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
      },

      practical: "Learn the I, IV, V chords in G, C, and D major. You can play hundreds of folk and rock songs with just those 9 chords.",
      
      connections: ["major_scale", "triads", "chord_function", "common_progressions", "circle_of_fifths"],
    },

    chord_function: {
      id: "chord_function",
      title: "Chord Function: Tonic, Subdominant, Dominant",
      tier: "intermediate",
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
      },

      practical: "Play I - IV - V - I in any key and really listen. The I feels like home. The IV like leaving. The V like needing to return. Music is organized suspense.",
      
      connections: ["diatonic_chords", "cadences", "common_progressions", "tonnetz_transforms"],
    },

    circle_of_fifths_advanced: {
      id: "circle_of_fifths_advanced",
      title: "Modulation & Key Relationships",
      tier: "advanced",
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
      },

      practical: "Find a song you love that has a dramatic key change. Listen for the moment it happens. Did it feel smooth or jarring? That tells you how far the modulation was on the circle.",
      
      connections: ["circle_of_fifths", "chord_function", "secondary_dominants"],
    },

    // ── TIER 6: THE TONNETZ ───────────────────────────────────────

    tonnetz_geometry: {
      id: "tonnetz_geometry",
      title: "The Tonnetz",
      tier: "intermediate",
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
      },

      practical: "Explore the Tonnetz in this app. Find a major chord. Click its neighbors. Listen to how smoothly the harmony changes — that smoothness is geometric efficiency.",
      
      connections: ["triads", "intervals", "tonnetz_transforms", "neo_riemannian"],
    },

    tonnetz_transforms: {
      id: "tonnetz_transforms",
      title: "Neo-Riemannian Transforms (P, L, R)",
      tier: "advanced",
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
      },

      practical: "In the Tonnetz explorer: pick any chord, apply P, then L, then R. Hear how each move shifts just one note. That's voice leading efficiency made visible.",
      
      connections: ["tonnetz_geometry", "triads", "chord_function", "hexatonic_cycles"],
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

  if (errors.length === 0) {
    console.log('✓ theory-content.js valid —', Object.keys(THEORY.topics).length, 'topics,', Object.keys(THEORY.visualizations).length, 'visualizations');
  } else {
    console.error('✗ Validation errors:\n' + errors.join('\n'));
  }
  return errors;
}
