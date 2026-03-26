/**
 * SONG EXAMPLES DATABASE — song-examples.js
 *
 * Curated real-song references that illustrate music theory concepts.
 * Each entry maps a recognizable musical moment to a theory concept.
 *
 * Consumed by: Theory Hub, games (Interval Spotter, Chord Progression Builder,
 *              etc.), intro module, tips pill, AI feedback (Phase E)
 * Version: v1 (static asset, no preference system)
 *
 * Schema notes:
 * - concept_ids: references to theory-content.js topic IDs
 * - concept_specifics: sub-concept detail (interval type, progression pattern, etc.)
 * - game_ids: which games could surface this example
 * - insight: per-lens explanation (playful/musician/theorist)
 * - min_age: youngest audience this example works for
 * - era_tags: audience familiarity buckets
 * - demo: optional Tone.js playback data
 * - preference_tags: for future preference matching (v2)
 */

const SONG_EXAMPLES = [

  // ═══════════════════════════════════════════
  // INTERVALS
  // ═══════════════════════════════════════════

  // --- Minor 2nd (1 semitone) ---
  {
    id: "jaws_m2",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_2nd"],
    game_ids: ["harmony_trainer", "interval_spotter", "melody_match"],
    song: "Jaws Theme",
    artist: "John Williams",
    year: 1975,
    genre_tags: ["film_score", "orchestral"],
    insight: {
      playful: "The scary shark music from Jaws? Just two notes going back and forth, one tiny step apart. That's why it sounds so tense — like something bad is about to happen!",
      musician: "The Jaws ostinato is a semitone oscillation (E–F) — a minor 2nd. It's a masterclass in how a single interval creates tension through repetition and rhythmic acceleration alone.",
      theorist: "Williams exploits the minor 2nd's inherent dissonance. The interval's instability, combined with the accelerating rhythmic pattern, creates anticipatory dread without ever needing harmonic resolution."
    },
    min_age: 6,
    era_tags: ["classic", "film"],
    demo: {
      notes: ["E3", "F3"],
      rhythm: "quarter-quarter",
      tempo: 100,
      loop: true
    },
    preference_tags: ["film", "scary", "orchestral", "classic"]
  },
  {
    id: "fur_elise_m2",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_2nd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Für Elise",
    artist: "Ludwig van Beethoven",
    year: 1810,
    genre_tags: ["classical", "piano"],
    insight: {
      playful: "That famous piano piece that goes back and forth at the beginning? Those two notes are just one tiny step apart — a minor 2nd! It sounds delicate and a little nervous.",
      musician: "The opening of Für Elise alternates E5–D#5, a minor 2nd. Beethoven uses this tight oscillation to create the piece's distinctive restless quality before resolving downward.",
      theorist: "The E–D#–E oscillation is a written-out upper neighbor tone — the semitone tension of the minor 2nd drives the melodic momentum through its need for resolution."
    },
    min_age: 6,
    era_tags: ["classic", "classical"],
    demo: {
      notes: ["E5", "D#5", "E5", "D#5", "E5"],
      rhythm: "eighth-eighth-eighth-eighth-eighth",
      tempo: 120,
      loop: false
    },
    preference_tags: ["classical", "piano", "famous"]
  },

  // --- Major 2nd (2 semitones) ---
  {
    id: "happy_birthday_M2",
    concept_ids: ["intervals"],
    concept_specifics: ["major_2nd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Happy Birthday to You",
    artist: "Traditional",
    year: 1893,
    genre_tags: ["traditional", "folk"],
    insight: {
      playful: "\"Hap-py\" — those first two notes of Happy Birthday are a major 2nd apart. It's just one whole step, like going from C to D!",
      musician: "The pickup into 'Happy Birthday' opens with a repeated note then steps up a major 2nd. It's the most universally known song opening — useful as an always-available reference.",
      theorist: "The ascending major 2nd (M2, 2 semitones) functions here as a scalar step within the major key, establishing tonal center immediately through its diatonic motion."
    },
    min_age: 4,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["G4", "G4", "A4"],
      rhythm: "eighth-eighth-quarter",
      tempo: 120,
      loop: false
    },
    preference_tags: ["traditional", "universal", "singalong"]
  },

  // --- Minor 3rd (3 semitones) ---
  {
    id: "smoke_water_m3",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_3rd"],
    game_ids: ["harmony_trainer", "interval_spotter"],
    song: "Smoke on the Water",
    artist: "Deep Purple",
    year: 1972,
    genre_tags: ["rock", "classic_rock"],
    insight: {
      playful: "That famous guitar riff — DUN dun DUN, DUN dun da-DUN — it's built on minor 3rds! It's probably the first riff every guitar student learns.",
      musician: "The Smoke on the Water riff outlines parallel minor 3rds (G–Bb, Ab–B, G–Bb). The power of the riff comes from how those minor 3rds move in parallel — no voice leading rules, just raw sound.",
      theorist: "Ritchie Blackmore's riff uses parallel minor 3rd dyads (power chord voicings without the fifth), creating a quartal-adjacent sound. The chromatic motion between dyad roots (G–Ab–G) adds tension."
    },
    min_age: 8,
    era_tags: ["classic", "boomer", "genx"],
    demo: {
      notes: ["G3", "Bb3"],
      rhythm: "quarter-quarter",
      tempo: 112,
      loop: false
    },
    preference_tags: ["rock", "guitar", "classic_rock", "riff"]
  },
  {
    id: "greensleeves_m3",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_3rd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Greensleeves",
    artist: "Traditional (English)",
    year: 1580,
    genre_tags: ["folk", "traditional", "classical"],
    insight: {
      playful: "That old-timey melody that sounds like a Renaissance fair? The jump at the beginning is a minor 3rd — it gives the song its gentle, slightly sad feeling.",
      musician: "Greensleeves opens with an ascending minor 3rd (A to C in A minor). The interval immediately establishes the minor tonality — you know within two notes that this is a sad song.",
      theorist: "The opening minor 3rd (scale degrees 1 to b3) is the defining interval of the minor mode, establishing the Aeolian framework before any harmonic context."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["A3", "C4"],
      rhythm: "quarter-half",
      tempo: 100,
      loop: false
    },
    preference_tags: ["folk", "traditional", "classical"]
  },

  // --- Major 3rd (4 semitones) ---
  {
    id: "oh_when_saints_M3",
    concept_ids: ["intervals"],
    concept_specifics: ["major_3rd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "When the Saints Go Marching In",
    artist: "Traditional",
    year: 1896,
    genre_tags: ["jazz", "traditional", "gospel"],
    insight: {
      playful: "\"Oh when the SAINTS\" — that jump from 'when' to 'SAINTS' is a major 3rd. It sounds bright and happy, like a parade is coming!",
      musician: "The melody leaps a major 3rd on 'when the Saints' (C to E in C major). The interval's bright, open quality is what gives this song its marching energy.",
      theorist: "The ascending major 3rd (M3, 4 semitones, ratio 5:4) outlines the lower portion of the tonic triad, establishing the major tonality unambiguously."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["C4", "E4", "F4", "G4"],
      rhythm: "quarter-quarter-quarter-half",
      tempo: 120,
      loop: false
    },
    preference_tags: ["jazz", "traditional", "marching", "gospel"]
  },
  {
    id: "kumbaya_M3",
    concept_ids: ["intervals"],
    concept_specifics: ["major_3rd"],
    game_ids: ["interval_spotter"],
    song: "Kumbaya",
    artist: "Traditional (African American spiritual)",
    year: 1926,
    genre_tags: ["spiritual", "folk", "traditional"],
    insight: {
      playful: "\"Kum-ba-YA\" — the jump up to 'ya' is a major 3rd. It's a warm, comforting sound.",
      musician: "The ascending major 3rd in 'Kumbaya' is a useful alternative mnemonic when you need a gentler, more sustained reference than 'When the Saints.'",
      theorist: "The major 3rd here functions as a leap from the fifth to the tonic of the dominant chord, creating a sense of arrival and warmth."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["G4", "B4"],
      rhythm: "quarter-half",
      tempo: 80,
      loop: false
    },
    preference_tags: ["folk", "spiritual", "campfire"]
  },

  // --- Perfect 4th (5 semitones) ---
  {
    id: "here_comes_bride_P4",
    concept_ids: ["intervals"],
    concept_specifics: ["perfect_4th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Bridal Chorus (Here Comes the Bride)",
    artist: "Richard Wagner",
    year: 1850,
    genre_tags: ["classical", "wedding"],
    insight: {
      playful: "\"HERE comes the bride\" — that first big jump up? That's a perfect 4th. It sounds grand and announcement-y, like something important is happening!",
      musician: "Wagner's Bridal Chorus opens with an ascending perfect 4th (Bb to Eb). The interval has a declarative, fanfare quality that's why it works for announcing the bride — and why P4s show up in so many anthems.",
      theorist: "The ascending P4 (5 semitones, ratio 4:3) is the inversion of the P5. Its use here as an opening gesture establishes dominant-to-tonic motion melodically, creating instant resolution and ceremony."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["Bb3", "Eb4"],
      rhythm: "quarter-dotted-half",
      tempo: 100,
      loop: false
    },
    preference_tags: ["classical", "wedding", "famous"]
  },
  {
    id: "amazing_grace_P4",
    concept_ids: ["intervals"],
    concept_specifics: ["perfect_4th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Amazing Grace",
    artist: "John Newton",
    year: 1772,
    genre_tags: ["hymn", "folk", "traditional"],
    insight: {
      playful: "\"A-MA-zing grace\" — that jump up on 'MA' is a perfect 4th. It's the same distance as 'Here Comes the Bride' but feels totally different because the rhythm is slower and more emotional.",
      musician: "Amazing Grace opens with a pickup note then leaps up a perfect 4th. Same interval as the Bridal Chorus, but the slower tempo and different rhythmic context transform its character entirely — proof that intervals are colored by context.",
      theorist: "The ascending P4 from scale degree 5 to 1 creates an anacrustic dominant-to-tonic arrival, one of the strongest melodic gestures in tonal music."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["G3", "C4"],
      rhythm: "eighth-dotted-quarter",
      tempo: 72,
      loop: false
    },
    preference_tags: ["hymn", "folk", "traditional", "emotional"]
  },

  // --- Tritone (6 semitones) ---
  {
    id: "simpsons_tritone",
    concept_ids: ["intervals"],
    concept_specifics: ["tritone"],
    game_ids: ["interval_spotter"],
    song: "The Simpsons Theme",
    artist: "Danny Elfman",
    year: 1989,
    genre_tags: ["tv", "comedy", "orchestral"],
    insight: {
      playful: "\"The SIMP-sons\" — that weird, wobbly jump on 'Simp-sons' is a tritone, the most unstable interval in music. It sounds goofy and off-kilter, which is perfect for the show!",
      musician: "Elfman opens with a tritone leap, immediately establishing the show's irreverent tone. The tritone (augmented 4th / diminished 5th) is the interval that wants to resolve most desperately — but here it just hangs there, unresolved, which is why it sounds comedic.",
      theorist: "The tritone (6 semitones, ratio √2:1) divides the octave exactly in half — the only interval that is its own inversion. Its inherent instability (historically called 'diabolus in musica') is repurposed here for comedic effect."
    },
    min_age: 8,
    era_tags: ["classic", "genx", "millennial", "genz"],
    demo: {
      notes: ["C4", "F#4"],
      rhythm: "quarter-quarter",
      tempo: 160,
      loop: false
    },
    preference_tags: ["tv", "comedy", "cartoon", "famous"]
  },
  {
    id: "maria_tritone",
    concept_ids: ["intervals"],
    concept_specifics: ["tritone"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Maria (West Side Story)",
    artist: "Leonard Bernstein",
    year: 1957,
    genre_tags: ["musical_theater", "classical"],
    insight: {
      playful: "\"Ma-RI-a\" — that jump up on 'RI' is a tritone. In this song it sounds dreamy and longing instead of scary, because of how Bernstein resolves it.",
      musician: "Bernstein uses the tritone (C to F#) on 'Ma-RI-a' to express overwhelming, almost irrational emotion — the interval's instability mirrors Tony's destabilized world. It resolves up by half step to G, which is the payoff.",
      theorist: "The tritone leap resolves upward by semitone to the fifth of the tonic, reinterpreting the augmented 4th as a chromatic approach to a consonance — a technique Bernstein borrowed from jazz voice leading."
    },
    min_age: 10,
    era_tags: ["classic", "boomer"],
    demo: {
      notes: ["C4", "F#4", "G4"],
      rhythm: "eighth-quarter-half",
      tempo: 100,
      loop: false
    },
    preference_tags: ["musical_theater", "broadway", "classic"]
  },

  // --- Perfect 5th (7 semitones) ---
  {
    id: "star_wars_P5",
    concept_ids: ["intervals"],
    concept_specifics: ["perfect_5th"],
    game_ids: ["harmony_trainer", "interval_spotter", "melody_match"],
    song: "Star Wars Main Theme",
    artist: "John Williams",
    year: 1977,
    genre_tags: ["film_score", "orchestral"],
    insight: {
      playful: "That heroic Star Wars fanfare? The big jump at the beginning is a perfect 5th — the most powerful, heroic-sounding interval in music. No wonder it's the sound of Luke Skywalker!",
      musician: "The Star Wars theme leaps up a perfect 5th (Bb to F, or in concert G to D). The P5 is the backbone of music — it's the interval between the root and fifth of every major and minor chord. Williams uses it here because nothing sounds more triumphant.",
      theorist: "The ascending P5 (7 semitones, ratio 3:2) is the most consonant non-octave interval. Williams' use as a melodic fanfare exploits its stability and openness — the interval implies both tonic and dominant simultaneously."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["G3", "D4"],
      rhythm: "quarter-dotted-half",
      tempo: 108,
      loop: false
    },
    preference_tags: ["film", "epic", "orchestral", "sci-fi"]
  },
  {
    id: "twinkle_P5",
    concept_ids: ["intervals"],
    concept_specifics: ["perfect_5th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Twinkle, Twinkle, Little Star",
    artist: "Traditional (Mozart arrangement)",
    year: 1761,
    genre_tags: ["children", "classical", "folk"],
    insight: {
      playful: "\"Twinkle twinkle little STAR\" — the jump from 'twinkle' up to 'star' is a perfect 5th! Same big heroic jump as Star Wars, but here it sounds gentle because it's slower.",
      musician: "The melody leaps from scale degree 1 to 5 (a perfect 5th) on the word 'star.' It's the gentlest possible way to introduce the most important interval in tonal music.",
      theorist: "The ascending P5 from tonic to dominant outlines the fundamental axis of tonal harmony in the simplest possible melodic context."
    },
    min_age: 3,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["C4", "C4", "G4", "G4"],
      rhythm: "quarter-quarter-quarter-quarter",
      tempo: 100,
      loop: false
    },
    preference_tags: ["children", "classical", "nursery", "beginner"]
  },

  // --- Minor 6th (8 semitones) ---
  {
    id: "entertainer_m6",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_6th"],
    game_ids: ["interval_spotter"],
    song: "The Entertainer",
    artist: "Scott Joplin",
    year: 1902,
    genre_tags: ["ragtime", "piano", "jazz"],
    insight: {
      playful: "That bouncy ragtime piano tune? The jump in the melody is a minor 6th — it sounds playful and a little surprising, like a cat jumping off a shelf.",
      musician: "The Entertainer's melody features a minor 6th leap that gives ragtime its characteristic jaunty quality. The interval is wide enough to feel like a jump but not so wide it feels heroic.",
      theorist: "The minor 6th (8 semitones) is the inversion of the major 3rd. In ragtime context, it functions as a melodic leap that creates syncopation emphasis through registral accent."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["E4", "C5"],
      rhythm: "eighth-quarter",
      tempo: 132,
      loop: false
    },
    preference_tags: ["ragtime", "piano", "classic", "playful"]
  },

  // --- Major 6th (9 semitones) ---
  {
    id: "nbc_M6",
    concept_ids: ["intervals"],
    concept_specifics: ["major_6th"],
    game_ids: ["interval_spotter"],
    song: "NBC Chimes",
    artist: "NBC",
    year: 1929,
    genre_tags: ["jingle", "broadcast"],
    insight: {
      playful: "The three NBC chimes (G–E–C) — the first jump from G up to E is a major 6th! It sounds warm and complete, like a happy sigh.",
      musician: "The NBC chimes outline a major 6th (G to E) followed by a descending third. It's one of the most recognizable three-note sequences in American broadcasting — and the M6 is why it sounds so warm.",
      theorist: "The ascending major 6th (9 semitones, ratio 5:3) is the inversion of the minor 3rd. Its warmth derives from its simple frequency ratio and its implication of the tonic triad in first inversion."
    },
    min_age: 8,
    era_tags: ["classic", "boomer", "genx"],
    demo: {
      notes: ["G4", "E5", "C5"],
      rhythm: "quarter-quarter-half",
      tempo: 100,
      loop: false
    },
    preference_tags: ["jingle", "broadcast", "american"]
  },
  {
    id: "my_bonnie_M6",
    concept_ids: ["intervals"],
    concept_specifics: ["major_6th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "My Bonnie Lies Over the Ocean",
    artist: "Traditional (Scottish)",
    year: 1881,
    genre_tags: ["folk", "traditional"],
    insight: {
      playful: "\"My BON-nie lies over the ocean\" — that jump up to 'BON' is a major 6th. It's a big leap that sounds adventurous, like you're looking out over the sea!",
      musician: "The ascending major 6th on 'My Bonnie' is one of the widest common melodic leaps in folk music. It creates an immediate sense of yearning and distance — fitting for a song about someone far away.",
      theorist: "The M6 leap from scale degree 5 to 3 (an octave higher would be 10th) outlines an inverted tonic triad, creating a sense of both openness and tonal stability."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["G3", "E4"],
      rhythm: "eighth-dotted-quarter",
      tempo: 96,
      loop: false
    },
    preference_tags: ["folk", "traditional", "scottish"]
  },

  // --- Minor 7th (10 semitones) ---
  {
    id: "somewhere_m7",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_7th"],
    game_ids: ["interval_spotter"],
    song: "Somewhere (West Side Story)",
    artist: "Leonard Bernstein",
    year: 1957,
    genre_tags: ["musical_theater", "classical"],
    insight: {
      playful: "\"There's a PLACE for us\" — the jump up to 'PLACE' is a minor 7th. It sounds like you're reaching for something really far away but can't quite grab it.",
      musician: "The ascending minor 7th in 'Somewhere' creates an almost unbearable sense of longing. The interval is one semitone short of an octave — close to resolution but not there, which mirrors the song's lyrical theme perfectly.",
      theorist: "The minor 7th (10 semitones, ratio approximately 9:5) is the characteristic interval of the dominant 7th chord. Melodically, its upward leap implies an unresolved dominant that yearns for tonic."
    },
    min_age: 10,
    era_tags: ["classic", "boomer"],
    demo: {
      notes: ["C4", "Bb4"],
      rhythm: "quarter-half",
      tempo: 72,
      loop: false
    },
    preference_tags: ["musical_theater", "broadway", "emotional"]
  },

  // --- Major 7th (11 semitones) ---
  {
    id: "take_on_me_M7",
    concept_ids: ["intervals"],
    concept_specifics: ["major_7th"],
    game_ids: ["interval_spotter"],
    song: "Take On Me",
    artist: "a-ha",
    year: 1985,
    genre_tags: ["pop", "synth_pop", "80s"],
    insight: {
      playful: "That catchy synth riff from 'Take On Me'? It has a major 7th leap in it — almost a full octave but not quite. It sounds bright and exciting, like a rocket about to launch!",
      musician: "The synth riff in 'Take On Me' includes a major 7th leap. The M7 is the most dissonant of the 'major' intervals — it's one semitone short of the octave, so it has a bright, crystalline tension that makes the riff so ear-catching.",
      theorist: "The major 7th (11 semitones, ratio 15:8) is the leading tone interval — its strong pull toward octave resolution gives it a unique forward momentum when used melodically."
    },
    min_age: 8,
    era_tags: ["classic", "genx", "millennial"],
    demo: {
      notes: ["C4", "B4"],
      rhythm: "eighth-quarter",
      tempo: 168,
      loop: false
    },
    preference_tags: ["pop", "80s", "synth", "catchy"]
  },

  // --- Octave (12 semitones) ---
  {
    id: "over_rainbow_P8",
    concept_ids: ["intervals"],
    concept_specifics: ["octave"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Somewhere Over the Rainbow",
    artist: "Harold Arlen (performed by Judy Garland)",
    year: 1939,
    genre_tags: ["film_score", "musical", "standard"],
    insight: {
      playful: "\"Some-WHERE over the rainbow\" — that huge jump up to 'WHERE' is a full octave! It's the same note, just way higher. It sounds like you're leaping up to the sky — which is exactly what the song is about!",
      musician: "The opening octave leap in 'Over the Rainbow' is one of the most famous in all of popular music. An octave is the widest 'safe' melodic leap — anything wider tends to sound like two separate phrases. Arlen uses it to capture the literal act of reaching upward.",
      theorist: "The ascending octave (P8, 12 semitones, ratio 2:1) is the interval of octave equivalence — the destination note is perceived as 'the same' pitch in a higher register. Its use as a melodic opening is rare and dramatic precisely because of the registral displacement."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: {
      notes: ["C4", "C5"],
      rhythm: "eighth-dotted-half",
      tempo: 80,
      loop: false
    },
    preference_tags: ["film", "classic", "musical", "emotional", "famous"]
  },


  // ═══════════════════════════════════════════
  // KEY & TONALITY
  // ═══════════════════════════════════════════

  {
    id: "eleanor_rigby_ambiguity",
    concept_ids: ["major_scale", "minor_scale", "diatonic_chords"],
    concept_specifics: ["relative_major_minor", "tonal_ambiguity"],
    game_ids: ["relative_key_trainer", "harmony_trainer"],
    song: "Eleanor Rigby",
    artist: "The Beatles",
    year: 1966,
    genre_tags: ["rock", "pop", "classical_influence"],
    insight: {
      playful: "Is Eleanor Rigby a happy song or a sad song? The music can't quite decide either — it lives right on the border between two keys (E minor and G major) that share all the same notes!",
      musician: "Eleanor Rigby is a classic case of tonal ambiguity. The verse sits squarely in E minor (Em–C–Em), but the C major chord and the melodic contour keep hinting at G major. It's the same set of notes — the question is which one feels like 'home.'",
      theorist: "The relative major/minor ambiguity in Eleanor Rigby arises from the shared diatonic collection of E Aeolian and G Ionian. The absence of a strong dominant function (B7) in the verse prevents clear establishment of either tonal center."
    },
    min_age: 10,
    era_tags: ["classic", "boomer", "universal"],
    demo: {
      notes: ["E4", "G4", "B4"],
      rhythm: "quarter-quarter-quarter",
      tempo: 136,
      loop: false
    },
    preference_tags: ["rock", "beatles", "classic", "sad"]
  },
  {
    id: "happy_pharrell_major",
    concept_ids: ["major_scale", "diatonic_chords"],
    concept_specifics: ["unambiguous_major"],
    game_ids: ["relative_key_trainer"],
    song: "Happy",
    artist: "Pharrell Williams",
    year: 2013,
    genre_tags: ["pop", "funk", "soul"],
    insight: {
      playful: "Happy sounds… well, happy! That's because it's in a major key with a super clear home base. There's no confusion about where 'home' is — the music smiles at you.",
      musician: "'Happy' is unambiguously major — F major with strong I-IV-V motion throughout. It's a useful reference for what an 'obviously major' song feels like, especially when contrasting with more ambiguous examples.",
      theorist: "The clarity of the major tonality derives from strong dominant-tonic cadential motion, Mixolydian-inflected vocal melody over purely diatonic harmony, and rhythmic emphasis on the tonic chord."
    },
    min_age: 6,
    era_tags: ["millennial", "genz"],
    demo: null,
    preference_tags: ["pop", "feel_good", "modern", "dance"]
  },
  {
    id: "billie_jean_minor",
    concept_ids: ["minor_scale", "diatonic_chords"],
    concept_specifics: ["unambiguous_minor"],
    game_ids: ["relative_key_trainer"],
    song: "Billie Jean",
    artist: "Michael Jackson",
    year: 1982,
    genre_tags: ["pop", "funk", "disco"],
    insight: {
      playful: "Billie Jean has that dark, mysterious groove — you can feel something isn't quite right. That's the minor key! The bassline practically screams 'this is serious.'",
      musician: "Billie Jean sits in F# minor with a driving bass ostinato. The minor key establishes tension and mystery from the first beat — there's no ambiguity here. It's a great reference for 'obviously minor.'",
      theorist: "The persistent F#m–G#m/F# bass ostinato creates a clear minor tonal center through root position emphasis and the Dorian-inflected natural 6th (D#) in the bass line."
    },
    min_age: 8,
    era_tags: ["classic", "boomer", "genx", "universal"],
    demo: null,
    preference_tags: ["pop", "funk", "disco", "classic", "groovy"]
  },
  {
    id: "hey_jude_major_minor",
    concept_ids: ["major_scale", "minor_scale", "diatonic_chords"],
    concept_specifics: ["major_with_minor_inflections"],
    game_ids: ["relative_key_trainer", "harmony_trainer"],
    song: "Hey Jude",
    artist: "The Beatles",
    year: 1968,
    genre_tags: ["rock", "pop"],
    insight: {
      playful: "Hey Jude starts out kind of bittersweet — not totally happy, not totally sad. That's because even though it's in a major key, it borrows some sad-sounding chords from the minor key!",
      musician: "Hey Jude is in F major but the verse includes a minor iv chord (Bbm), which is borrowed from F minor. This 'modal mixture' is what gives the verse its bittersweet quality before the triumphant 'na na na' coda.",
      theorist: "The Bb minor chord (iv) in the verse is a borrowed chord from the parallel minor (F Aeolian). The chromatic mediant relationship between IV (Bb major) and iv (Bb minor) — differing by only the Db — creates the signature bitter-to-sweet color shift."
    },
    min_age: 8,
    era_tags: ["classic", "boomer", "universal"],
    demo: null,
    preference_tags: ["rock", "beatles", "classic", "singalong"]
  },


  // ═══════════════════════════════════════════
  // CHORD PROGRESSIONS
  // ═══════════════════════════════════════════

  {
    id: "axis_of_awesome_I_V_vi_IV",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_V_vi_IV"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Let It Be / No Woman No Cry / With or Without You / etc.",
    artist: "Various (The Beatles, Bob Marley, U2, etc.)",
    year: null,
    genre_tags: ["pop", "rock", "universal"],
    insight: {
      playful: "There's a 4-chord pattern that shows up in HUNDREDS of hit songs — Let It Be, No Woman No Cry, Someone Like You, and tons more. Learn these four chords and you can play a LOT of music!",
      musician: "The I–V–vi–IV progression is the most common chord pattern in pop music. In C: C–G–Am–F. The Axis of Awesome famously performed a medley of 40+ songs using only these four chords. It works because it balances major brightness (I, IV, V) with one minor chord (vi) for emotional depth.",
      theorist: "The I–V–vi–IV progression's ubiquity stems from its complete diatonic coverage (all three triadic functions: tonic, dominant, subdominant) and the strong root motion by descending thirds and ascending seconds, creating a balanced sense of departure and return."
    },
    min_age: 8,
    era_tags: ["universal"],
    demo: null,
    preference_tags: ["pop", "rock", "songwriting", "universal"]
  },
  {
    id: "creep_chromatic_mediant",
    concept_ids: ["diatonic_chords", "chord_function", "neo_riemannian"],
    concept_specifics: ["I_III_IV_iv", "chromatic_mediant", "borrowed_chord"],
    game_ids: ["chord_progression_builder", "harmony_trainer", "chord_walks"],
    song: "Creep",
    artist: "Radiohead",
    year: 1993,
    genre_tags: ["rock", "alternative", "90s"],
    insight: {
      playful: "Creep has that moment where everything shifts and gets intense — that's because the second chord (III) doesn't belong in the key! It sneaks in from somewhere else and creates this incredible tension. Then the fourth chord borrows from the minor key to make it even sadder.",
      musician: "Creep uses G–B–C–Cm (I–III–IV–iv in G major). The B major chord is a chromatic mediant — it shares one note with G major (B) but the other two are chromatic (D# and F#). Then the Cm is borrowed from G minor. These two 'wrong' chords are what make the progression so emotionally powerful.",
      theorist: "The I–III–IV–iv progression demonstrates two distinct chromatic techniques: the chromatic mediant (III, reachable by an L transform on the Tonnetz) and modal mixture (iv borrowed from parallel minor). On the Tonnetz, the B major triad is exactly one L transform from G major — they share the B and differ by one semitone in the other two voices."
    },
    min_age: 12,
    era_tags: ["genx", "millennial"],
    demo: null,
    preference_tags: ["rock", "alternative", "90s", "emotional", "guitar"]
  },
  {
    id: "pachelbel_canon",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_V_vi_iii_IV_I_IV_V", "descending_bass"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Canon in D",
    artist: "Johann Pachelbel",
    year: 1680,
    genre_tags: ["classical", "baroque"],
    insight: {
      playful: "This is the song that plays at every wedding and graduation! It has an 8-chord pattern that goes around and around — and the bass note walks steadily downward like going down stairs.",
      musician: "Pachelbel's Canon uses D–A–Bm–F#m–G–D–G–A (I–V–vi–iii–IV–I–IV–V). The descending bass line (D–C#–B–A–G–F#–G–A) is what makes it so hypnotic. This progression has been borrowed by countless pop songs — if you know this, you know half of pop harmony.",
      theorist: "The progression follows a descending circle of thirds (I–V–vi–iii) then ascending stepwise (IV–I–IV–V), with the bass creating a mostly stepwise descent through the scale. The voice leading efficiency of the descending thirds pattern is what creates the seamless flow."
    },
    min_age: 8,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["classical", "wedding", "famous", "relaxing"]
  },
  {
    id: "twelve_bar_blues",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["twelve_bar_blues", "I_IV_V"],
    game_ids: ["chord_progression_builder", "harmony_trainer", "strum_patterns"],
    song: "Johnny B. Goode / Hound Dog / Rock Around the Clock / etc.",
    artist: "Various (Chuck Berry, Elvis, Bill Haley, etc.)",
    year: null,
    genre_tags: ["blues", "rock", "jazz"],
    insight: {
      playful: "The 12-bar blues is like the recipe for rock and roll! It's a 12-measure pattern using just 3 chords (I, IV, V) that repeats over and over. Almost every blues, early rock, and jazz song uses it.",
      musician: "The 12-bar blues (I-I-I-I-IV-IV-I-I-V-IV-I-V) is the most important chord progression in American popular music. Master it and you can sit in on any blues jam, rock rehearsal, or jazz session. The turnaround in bars 11-12 (I-V) creates the pull back to the top.",
      theorist: "The 12-bar blues is a 3-phrase AAB form where harmonic rhythm accelerates: 4 bars of tonic, 2 of subdominant, 2 of tonic, then dominant-subdominant-tonic-dominant in the final 4 bars. The V chord in bar 12 creates a half cadence that propels the cyclic form."
    },
    min_age: 8,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["blues", "rock", "jazz", "guitar", "piano", "jam"]
  },
  {
    id: "50s_progression",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_vi_IV_V", "doo_wop"],
    game_ids: ["chord_progression_builder"],
    song: "Stand By Me / Earth Angel / Blue Moon",
    artist: "Various (Ben E. King, The Penguins, Rodgers & Hart)",
    year: null,
    genre_tags: ["doo_wop", "pop", "50s"],
    insight: {
      playful: "This is the doo-wop sound from the 1950s — those smooth, dreamy songs your grandparents slow-danced to. Just four chords going around and around!",
      musician: "The I–vi–IV–V ('50s progression' or 'doo-wop changes') powered an entire decade of pop music. In C: C–Am–F–G. The vi chord (Am) is what gives it the bittersweet quality — it's the relative minor sneaking in to add depth.",
      theorist: "The I–vi–IV–V progression cycles through all three functional categories (tonic, tonic-substitute, subdominant, dominant) with root motion primarily by thirds and steps, creating a smooth harmonic rhythm that practically voice-leads itself."
    },
    min_age: 8,
    era_tags: ["classic", "boomer"],
    demo: null,
    preference_tags: ["doo_wop", "50s", "oldies", "romantic"]
  },
  {
    id: "andalusian_cadence",
    concept_ids: ["diatonic_chords", "chord_function", "minor_scale"],
    concept_specifics: ["i_VII_VI_V", "andalusian"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Hit the Road Jack / Sultans of Swing / Stairway to Heaven (intro)",
    artist: "Various (Ray Charles, Dire Straits, Led Zeppelin)",
    year: null,
    genre_tags: ["rock", "flamenco", "pop"],
    insight: {
      playful: "This is the dramatic, Spanish-sounding chord pattern — it goes down like walking down stairs in a minor key. You've heard it in tons of songs, from flamenco to classic rock!",
      musician: "The Andalusian cadence (i–VII–VI–V) is a descending minor progression with roots stepping down: Am–G–F–E in A minor. The final E major chord (V, not v) creates tension that pulls back to the top. It shows up everywhere from flamenco to Ray Charles to Led Zeppelin.",
      theorist: "The Andalusian cadence is a descending tetrachord bassline (8–7–6–5) harmonized diatonically in minor, with the dominant chord (V) typically rendered as major to provide a leading tone back to i. The Phrygian half cadence (VI–V) at the end is the characteristic gesture."
    },
    min_age: 10,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["rock", "flamenco", "dramatic", "guitar"]
  },
  {
    id: "jazz_ii_V_I",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["ii_V_I", "jazz_harmony"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Autumn Leaves / Fly Me to the Moon / All of Me",
    artist: "Various jazz standards",
    year: null,
    genre_tags: ["jazz", "standard"],
    insight: {
      playful: "Jazz musicians LOVE three chords played in a row: the ii, the V, and the I. It's like a running start, a jump, and a landing. Almost every jazz song is built from chains of this pattern!",
      musician: "The ii–V–I is the fundamental building block of jazz harmony. In C: Dm7–G7–Cmaj7. Learn to hear and play this in all 12 keys and you can navigate most jazz standards. The ii prepares the V, the V creates tension, the I resolves it.",
      theorist: "The ii–V–I progression creates the strongest functional harmonic motion in tonal music: predominant → dominant → tonic. The root motion by descending 5ths maximizes voice-leading efficiency. In jazz practice, these are extended to ii7–V7–Imaj7, and the V7 often carries alterations (b9, #9, b13) that increase chromatic voice-leading pull."
    },
    min_age: 12,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["jazz", "piano", "sophisticated", "harmony"]
  },


  // ═══════════════════════════════════════════
  // SCALES & MODES
  // ═══════════════════════════════════════════

  {
    id: "simpsons_lydian",
    concept_ids: ["modes"],
    concept_specifics: ["lydian"],
    game_ids: ["scale_builder"],
    song: "The Simpsons Theme",
    artist: "Danny Elfman",
    year: 1989,
    genre_tags: ["tv", "comedy", "orchestral"],
    insight: {
      playful: "The Simpsons theme sounds bright and a little weird — that's because it uses the Lydian mode, which is like a major scale with one note raised. It makes everything sound slightly floaty and strange!",
      musician: "Elfman wrote the Simpsons theme in Lydian mode — a major scale with a raised 4th (C Lydian = C D E F# G A B). That #4 is what gives it the 'brighter than bright' quality. It's the same mode that gives lots of film music its wonder and magic.",
      theorist: "Lydian (mode IV) is the brightest of the seven diatonic modes, with the raised 4th eliminating the only tendency tone (scale degree 4→3) present in Ionian. The resulting lack of tritone resolution creates a floating, non-cadential quality."
    },
    min_age: 8,
    era_tags: ["classic", "genx", "millennial", "genz"],
    demo: null,
    preference_tags: ["tv", "comedy", "cartoon"]
  },
  {
    id: "get_lucky_mixolydian",
    concept_ids: ["modes"],
    concept_specifics: ["mixolydian"],
    game_ids: ["scale_builder"],
    song: "Get Lucky",
    artist: "Daft Punk ft. Pharrell Williams",
    year: 2013,
    genre_tags: ["pop", "funk", "electronic"],
    insight: {
      playful: "Get Lucky has that laid-back, groovy feel — it's almost major but with a cool, relaxed twist. That's Mixolydian mode — a major scale where one note is lowered to make it less 'perfect' and more funky!",
      musician: "Get Lucky sits in B Mixolydian (B major with a lowered 7th — A natural instead of A#). The b7 is what prevents the harmony from ever feeling fully 'resolved,' which is why the groove can loop forever without getting boring. Same mode that powers most blues and rock.",
      theorist: "Mixolydian (mode V) lowers the 7th degree, eliminating the leading tone and replacing the major 7th's pull with a subtonic. The resulting bVII chord (A major in B Mixolydian) creates a backdoor cadence quality (bVII–I) that avoids classical dominant resolution."
    },
    min_age: 10,
    era_tags: ["millennial", "genz"],
    demo: null,
    preference_tags: ["pop", "funk", "electronic", "dance", "groovy"]
  },
  {
    id: "so_what_dorian",
    concept_ids: ["modes"],
    concept_specifics: ["dorian"],
    game_ids: ["scale_builder"],
    song: "So What",
    artist: "Miles Davis",
    year: 1959,
    genre_tags: ["jazz", "modal_jazz"],
    insight: {
      playful: "This famous jazz song sits on basically one chord for ages — but it doesn't sound boring because it uses the Dorian mode, which has a mysterious, sophisticated flavor somewhere between happy and sad.",
      musician: "'So What' is the quintessential modal jazz tune — 16 bars of D Dorian, then 8 bars of Eb Dorian, then back. Dorian is a minor mode with a raised 6th (natural 6th instead of b6), which gives it a warmer, jazzier quality than natural minor. Every jazz musician's first mode to learn.",
      theorist: "Dorian (mode II) differs from Aeolian only in the raised 6th degree. This creates a minor subdominant with a major quality (IV instead of iv), which is the characteristic Dorian chord. The 'So What' voicing (quartal: D–G–C–F–A) avoids tertian harmony entirely, emphasizing the mode's color rather than its function."
    },
    min_age: 12,
    era_tags: ["classic", "boomer"],
    demo: null,
    preference_tags: ["jazz", "sophisticated", "cool", "instrumental"]
  },
  {
    id: "white_rabbit_phrygian",
    concept_ids: ["modes"],
    concept_specifics: ["phrygian"],
    game_ids: ["scale_builder"],
    song: "White Rabbit",
    artist: "Jefferson Airplane",
    year: 1967,
    genre_tags: ["rock", "psychedelic", "60s"],
    insight: {
      playful: "White Rabbit has that eerie, Middle Eastern-sounding feel — like you've fallen down a rabbit hole into a strange world. That's the Phrygian mode, the darkest-sounding mode before you get into really exotic scales!",
      musician: "White Rabbit is built on E Phrygian — a minor scale with a lowered 2nd (F natural instead of F#). That b2 interval from the root is what gives Phrygian its distinctive 'Spanish' or 'exotic' quality. The F–E half-step pull is the mode's signature sound.",
      theorist: "Phrygian (mode III) is characterized by the lowered 2nd degree, creating a semitone above the tonic. The bII chord (F major in E Phrygian) creates the Phrygian half cadence (bII–i), a hallmark of flamenco and metal alike. The mode's darkness derives from having the most flats of any diatonic mode except Locrian."
    },
    min_age: 12,
    era_tags: ["classic", "boomer", "genx"],
    demo: null,
    preference_tags: ["rock", "psychedelic", "60s", "exotic", "dark"]
  },
  {
    id: "norwegian_wood_mixolydian",
    concept_ids: ["modes"],
    concept_specifics: ["mixolydian"],
    game_ids: ["scale_builder"],
    song: "Norwegian Wood",
    artist: "The Beatles",
    year: 1965,
    genre_tags: ["rock", "folk_rock"],
    insight: {
      playful: "Norwegian Wood has this gentle, folksy feel that's almost major but with a relaxed quality — that's Mixolydian again, just like Get Lucky but in a totally different style!",
      musician: "Norwegian Wood is in E Mixolydian — the melody sits on E major but uses D natural (the b7) prominently. It's a great example of how the same mode can sound completely different depending on tempo, instrumentation, and genre. Compare with Get Lucky for a stark contrast.",
      theorist: "The Mixolydian b7 in Norwegian Wood creates a bVII–I oscillation (D–E) that functions as a plagal-adjacent motion, avoiding dominant function entirely. The sitar-influenced arrangement further emphasizes the modal quality over functional tonality."
    },
    min_age: 10,
    era_tags: ["classic", "boomer"],
    demo: null,
    preference_tags: ["rock", "folk", "beatles", "gentle"]
  },


  // ═══════════════════════════════════════════
  // RHYTHM & METER
  // ═══════════════════════════════════════════

  {
    id: "take_five_5_4",
    concept_ids: ["rhythm"],
    concept_specifics: ["5_4_time", "odd_meter"],
    game_ids: ["rhythm_tapper"],
    song: "Take Five",
    artist: "Dave Brubeck Quartet",
    year: 1959,
    genre_tags: ["jazz", "cool_jazz"],
    insight: {
      playful: "Most music counts 1-2-3-4, 1-2-3-4. But Take Five counts 1-2-3-4-5, 1-2-3-4-5. Try counting along — it feels like the beat has an extra step. That's 5/4 time!",
      musician: "Take Five is the most famous piece in 5/4 time. The grouping is typically felt as 3+2 (ONE-two-three-FOUR-five). Paul Desmond's sax melody floats over this unusual pulse while the piano and drums lock in the groove. It proved that odd meters could swing.",
      theorist: "5/4 is an asymmetric meter, typically grouped as 3+2 or 2+3. In 'Take Five,' the 3+2 grouping creates a lopsided waltz-plus-march feel. The cognitive interest comes from the listener's expectation of a downbeat on beat 5 (in 4/4) being displaced to beat 6 (beat 1 of the next bar)."
    },
    min_age: 10,
    era_tags: ["classic", "boomer"],
    demo: null,
    preference_tags: ["jazz", "cool", "instrumental", "sophisticated"]
  },
  {
    id: "mission_impossible_5_4",
    concept_ids: ["rhythm"],
    concept_specifics: ["5_4_time", "odd_meter"],
    game_ids: ["rhythm_tapper"],
    song: "Mission: Impossible Theme",
    artist: "Lalo Schifrin",
    year: 1966,
    genre_tags: ["film_score", "tv", "spy"],
    insight: {
      playful: "The Mission: Impossible theme has that urgent, sneaky feel — part of what makes it tense is that it's in 5/4 time. Your brain expects beat 5 to be followed by a rest, but instead the next bar starts immediately!",
      musician: "Schifrin's Mission: Impossible theme is in 5/4, grouped as 3+2. The bongo pattern (da-da DAH da-da) makes the grouping obvious. The 5/4 meter creates inherent tension because the listener never fully settles into a predictable pulse — perfect for a spy show.",
      theorist: "The 5/4 meter in this context serves a programmatic function — the asymmetry creates cognitive unease that mirrors the narrative tension. The 3+2 grouping in the percussion, combined with the chromatic ostinato, layers metric and harmonic instability."
    },
    min_age: 8,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["film", "tv", "spy", "action", "famous"]
  },
  {
    id: "waltz_3_4",
    concept_ids: ["rhythm"],
    concept_specifics: ["3_4_time", "waltz"],
    game_ids: ["rhythm_tapper"],
    song: "My Favorite Things",
    artist: "Rodgers and Hammerstein (John Coltrane version also famous)",
    year: 1959,
    genre_tags: ["musical_theater", "jazz"],
    insight: {
      playful: "\"Raindrops on roses and whiskers on kittens\" — try clapping along and you'll feel it goes ONE-two-three, ONE-two-three. That's 3/4 time, the waltz feel!",
      musician: "My Favorite Things is in 3/4 — waltz time. The strong downbeat followed by two lighter beats creates the characteristic 'OOM-pah-pah' feel. Coltrane's jazz version takes the same 3/4 meter but transforms it into a modal exploration, showing how the same time signature can serve completely different musical goals.",
      theorist: "3/4 (simple triple meter) groups beats in threes with primary stress on beat 1. The inherent asymmetry of triple meter (vs. duple) creates a sense of forward motion that is self-perpetuating, as the listener anticipates the return of the downbeat."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["musical_theater", "jazz", "classic", "gentle"]
  },
  {
    id: "money_7_4",
    concept_ids: ["rhythm"],
    concept_specifics: ["7_4_time", "odd_meter"],
    game_ids: ["rhythm_tapper"],
    song: "Money",
    artist: "Pink Floyd",
    year: 1973,
    genre_tags: ["rock", "progressive_rock"],
    insight: {
      playful: "The cash register sounds at the start of Money tick along in a pattern of 7. Try counting: 1-2-3-4-5-6-7, 1-2-3-4-5-6-7. It feels like it's always about to fall over but never does!",
      musician: "Money's main riff is in 7/4, usually felt as 4+3. The bass riff is so iconic that most people don't even notice the odd meter — which is a testament to how well Waters and the band groove in it. The guitar solo switches to 4/4, then back to 7/4.",
      theorist: "The 7/4 meter (4+3 grouping) creates an inherently asymmetric pulse. The transition to 4/4 for the guitar solo demonstrates metric modulation without tempo change — the quarter-note pulse remains constant while the measure length changes."
    },
    min_age: 12,
    era_tags: ["classic", "boomer", "genx"],
    demo: null,
    preference_tags: ["rock", "progressive", "bass", "classic"]
  },


  // ═══════════════════════════════════════════
  // NEO-RIEMANNIAN / TRANSFORMS
  // ═══════════════════════════════════════════

  {
    id: "creep_L_transform",
    concept_ids: ["neo_riemannian"],
    concept_specifics: ["L_transform", "chromatic_mediant"],
    game_ids: ["chord_walks"],
    song: "Creep",
    artist: "Radiohead",
    year: 1993,
    genre_tags: ["rock", "alternative", "90s"],
    insight: {
      playful: "In Creep, when the chord jumps from G major to B major, one note stays the same and the other two move by just one tiny step each. On the Tonnetz, that's just flipping a triangle — the L (Leading-tone) transform!",
      musician: "The G→B move in Creep is an L transform: the fifth of G major (D) drops a semitone to D# (becoming the third of B major), and the root (G) drops a semitone to F# (becoming the fifth of B major). Only the B stays put. This is why the transition feels so smooth despite being 'out of key.'",
      theorist: "The L (Leading-tone exchange) transform maps G major (G–B–D) to B major (B–D#–F#) by moving the chordal fifth down by semitone. On the Tonnetz, this is a triangle flip across the shared edge B–G→B, resulting in a chromatic mediant relationship (major third apart, one common tone)."
    },
    min_age: 14,
    era_tags: ["genx", "millennial"],
    demo: null,
    preference_tags: ["rock", "alternative", "theory", "tonnetz"]
  },
  {
    id: "relative_P_transform",
    concept_ids: ["neo_riemannian"],
    concept_specifics: ["P_transform", "parallel_major_minor"],
    game_ids: ["chord_walks", "relative_key_trainer"],
    song: "Stairway to Heaven (Am → C section transitions)",
    artist: "Led Zeppelin",
    year: 1971,
    genre_tags: ["rock", "classic_rock"],
    insight: {
      playful: "When a chord changes from major to minor (or minor to major) with the same root note — like C major to C minor — that's the P (Parallel) transform. Just one note moves, and the whole mood flips!",
      musician: "The P transform changes only the third of a chord — C major (C–E–G) becomes C minor (C–Eb–G). One note moves one semitone, and the emotional character flips completely. Stairway to Heaven's transitions between A minor and C major sections use a combination of P and R transforms to shift mood.",
      theorist: "The P (Parallel) transform maps a major triad to its parallel minor (or vice versa) by moving the chordal third by one semitone. It is the only single neo-Riemannian operation that changes chord quality while preserving the root. On the Tonnetz, it's a flip across the root–fifth edge."
    },
    min_age: 12,
    era_tags: ["classic", "boomer", "genx"],
    demo: null,
    preference_tags: ["rock", "classic_rock", "theory", "tonnetz"]
  },
  {
    id: "my_funny_valentine_R_transform",
    concept_ids: ["neo_riemannian"],
    concept_specifics: ["R_transform", "relative_major_minor"],
    game_ids: ["chord_walks", "relative_key_trainer"],
    song: "My Funny Valentine",
    artist: "Rodgers & Hart (Chet Baker version iconic)",
    year: 1937,
    genre_tags: ["jazz", "standard"],
    insight: {
      playful: "Every minor key has a 'relative' major key that uses all the same notes — like A minor and C major. Moving between them is the R (Relative) transform. Jazz songs love to wander between these two worlds!",
      musician: "The R transform maps between relative major and minor: C minor ↔ Eb major. They share two notes and the third moves by a whole step. In 'My Funny Valentine,' the harmonic movement between Cm and Eb major creates the song's signature bittersweet quality — one transform, endless emotional range.",
      theorist: "The R (Relative) transform maps a minor triad to its relative major by raising the chordal fifth by a whole step: Cm (C–Eb–G) → Eb (Eb–G–Bb). On the Tonnetz, this is a flip across the minor-third edge. The R transform is unique in that it's the only PLR operation involving a whole-step voice motion."
    },
    min_age: 14,
    era_tags: ["classic", "boomer"],
    demo: null,
    preference_tags: ["jazz", "standard", "romantic", "theory", "tonnetz"]
  },


  // ═══════════════════════════════════════════
  // MISCELLANEOUS / CROSS-CUTTING
  // ═══════════════════════════════════════════

  {
    id: "blues_note_crossroads",
    concept_ids: ["pentatonic_scale"],
    concept_specifics: ["blue_note", "minor_pentatonic"],
    game_ids: ["scale_builder", "strum_patterns"],
    song: "Cross Road Blues",
    artist: "Robert Johnson",
    year: 1936,
    genre_tags: ["blues", "delta_blues"],
    insight: {
      playful: "Blues music has a secret weapon — a special note called the 'blue note' that's between major and minor. It makes the music sound soulful and a little bit gritty. Robert Johnson practically invented modern music with it!",
      musician: "The blue note (b5 or #4 added to the minor pentatonic) is the sound of the blues. In A blues: A–C–D–Eb–E–G. That Eb 'bends' between the D and E, creating the tension that defines the genre. Robert Johnson's vocal and guitar slides hit this ambiguous pitch space that can't be captured by standard notation.",
      theorist: "The 'blue note' (b5) creates a chromatic passing tone between the perfect 4th and perfect 5th of the pentatonic scale. In practice, blue notes are pitch-continuous (bent, scooped, or slid) rather than discrete, existing in the microtonal space between 12-TET scale degrees. This is a fundamental limitation of fixed-pitch instruments."
    },
    min_age: 10,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["blues", "guitar", "roots", "american", "historical"]
  },
  {
    id: "pentatonic_amazing_grace",
    concept_ids: ["pentatonic_scale"],
    concept_specifics: ["major_pentatonic"],
    game_ids: ["scale_builder"],
    song: "Amazing Grace",
    artist: "Traditional",
    year: 1772,
    genre_tags: ["hymn", "folk", "traditional"],
    insight: {
      playful: "Amazing Grace uses only 5 notes — the pentatonic scale! That's why it's one of the easiest melodies to sing and sounds good no matter what. The pentatonic scale is like music's 'safe mode' — every note sounds nice together.",
      musician: "Amazing Grace is built entirely on the major pentatonic (1–2–3–5–6, no 4th or 7th). The absence of the two 'tension' notes (4th and 7th, which form a tritone) is why pentatonic melodies always sound consonant and folk-like. It's also why these melodies work over almost any diatonic chord.",
      theorist: "The major pentatonic eliminates both semitone relationships present in the diatonic scale (3–4 and 7–1), producing a set with maximum intervallic uniformity. The resulting anhemitonic collection has no tritone, making any subset consonant — which explains the pentatonic's cross-cultural ubiquity."
    },
    min_age: 6,
    era_tags: ["classic", "universal"],
    demo: null,
    preference_tags: ["folk", "hymn", "traditional", "beginner"]
  },
  {
    id: "circle_of_fifths_hey_joe",
    concept_ids: ["circle_of_fifths"],
    concept_specifics: ["descending_fifths_progression"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Hey Joe",
    artist: "Jimi Hendrix",
    year: 1966,
    genre_tags: ["rock", "blues_rock"],
    insight: {
      playful: "Hey Joe's chords walk around the circle of fifths — each chord is a 'fifth' away from the next, like stepping stones in a circle. That's why it sounds like it's always moving forward!",
      musician: "Hey Joe follows C–G–D–A–E, a chain of ascending 5ths (or equivalently, the chords are connected by descending 4ths). On the circle of fifths, this is five consecutive clockwise steps. The progression has no functional 'home key' — it just walks through key areas, which gives it a wandering, restless quality.",
      theorist: "The progression traces a segment of the circle of fifths: C–G–D–A–E, with root motion by ascending P5 (or descending P4). This non-functional, pan-diatonic root motion creates tonal ambiguity — the listener can interpret multiple tonal centers. The final E major chord's resolution back to C is a non-standard motion (down a major third), adding to the open-ended feel."
    },
    min_age: 12,
    era_tags: ["classic", "boomer", "genx"],
    demo: null,
    preference_tags: ["rock", "guitar", "hendrix", "classic_rock"]
  },
  {
    id: "voice_leading_yesterday",
    concept_ids: ["triads"],
    concept_specifics: ["voice_leading", "chromatic_bass"],
    game_ids: ["harmony_trainer"],
    song: "Yesterday",
    artist: "The Beatles",
    year: 1965,
    genre_tags: ["pop", "rock"],
    insight: {
      playful: "Yesterday has a bass note that walks smoothly downward step by step — each chord connects to the next with the smallest possible movement. That's voice leading, and it's why the song flows so beautifully!",
      musician: "The verse of Yesterday features a chromatic descending bass line: F–E–Eb–D (over the chords F–Em7–A7–Dm). This is textbook voice leading — the bass moves by half steps, creating smooth connections between chords that might otherwise sound unrelated.",
      theorist: "The chromatic descending bass (tonic–leading tone–b7–6 in F major) creates a lament bass pattern that connects the tonic to the relative minor through chromatic passing tones. The Em7→A7 functions as a ii–V in D minor, a secondary dominant chain that makes the move to Dm feel inevitable."
    },
    min_age: 10,
    era_tags: ["classic", "boomer", "universal"],
    demo: null,
    preference_tags: ["pop", "beatles", "classic", "gentle", "guitar"]
  },
  {
    id: "deceptive_cadence_in_my_life",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["deceptive_cadence", "V_vi"],
    game_ids: ["harmony_trainer", "chord_progression_builder"],
    song: "In My Life",
    artist: "The Beatles",
    year: 1965,
    genre_tags: ["pop", "rock"],
    insight: {
      playful: "Sometimes in music, you think you know where a chord is going to land — but it goes somewhere else instead! That's a deceptive cadence. It's like when you expect to catch a ball and it curves at the last second.",
      musician: "A deceptive cadence (V→vi instead of V→I) sets up an expectation of resolution and then sidesteps it. The vi chord shares two notes with the I chord, so it almost resolves — but the minor quality adds an unexpected emotional twist. The Beatles use this throughout 'In My Life' to keep the harmony surprising.",
      theorist: "The deceptive cadence (V→vi) substitutes the tonic with its mediant relative, maintaining two common tones (scale degrees 1 and 3) while introducing the minor quality. The voice leading is nearly identical to an authentic cadence — the leading tone still resolves up to tonic — but the bass moves up by step instead of down by fifth."
    },
    min_age: 10,
    era_tags: ["classic", "boomer", "universal"],
    demo: null,
    preference_tags: ["pop", "beatles", "classic", "harmony"]
  },
  {
    id: "minor_pentatonic_sunshine",
    concept_ids: ["pentatonic_scale", "minor_scale"],
    concept_specifics: ["minor_pentatonic", "riff"],
    game_ids: ["scale_builder"],
    song: "Sunshine of Your Love",
    artist: "Cream (Eric Clapton)",
    year: 1967,
    genre_tags: ["rock", "blues_rock"],
    insight: {
      playful: "That heavy, crunchy guitar riff from Sunshine of Your Love? It's built entirely from the minor pentatonic scale — just 5 notes make all that power!",
      musician: "The Sunshine of Your Love riff is pure D minor pentatonic (D–F–G–A–C). Clapton and Bruce built one of rock's most iconic riffs from the simplest scale in music. The minor pentatonic is the first scale every rock and blues guitarist learns — and this riff shows why it's so effective.",
      theorist: "The minor pentatonic (1–b3–4–5–b7) is a subset of the natural minor scale with the 2nd and 6th degrees removed, eliminating both semitone relationships. The riff's descending contour (D–C–A, then D–C–Bb–A) exploits the scale's intervallic simplicity to create a memorable, singable theme."
    },
    min_age: 10,
    era_tags: ["classic", "boomer", "genx"],
    demo: null,
    preference_tags: ["rock", "guitar", "blues", "classic_rock", "riff"]
  },


  // ═══════════════════════════════════════════
  // MODERN POP & CONTEMPORARY
  // ═══════════════════════════════════════════

  {
    id: "bad_guy_minor",
    concept_ids: ["minor_scale", "diatonic_chords"],
    concept_specifics: ["unambiguous_minor", "minimal_harmony"],
    game_ids: ["relative_key_trainer", "harmony_trainer"],
    song: "bad guy",
    artist: "Billie Eilish",
    year: 2019,
    genre_tags: ["pop", "electropop", "alternative"],
    insight: {
      playful: "bad guy sounds dark, whispery, and a little creepy — that's because it lives in a minor key and barely uses any chords at all. Sometimes less is more!",
      musician: "bad guy sits in G minor with an extremely sparse two-chord vamp (Gm–Cm). The production relies on bass, texture, and vocal delivery rather than harmonic complexity. It's a masterclass in how minor tonality plus minimalism creates atmosphere.",
      theorist: "The i–iv oscillation (Gm–Cm) restricts the harmonic palette to two minor triads, eliminating dominant function entirely. The resulting static harmony foregrounds timbral and rhythmic interest — a production-first approach that inverts traditional pop harmony."
    },
    min_age: 10,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["pop", "alternative", "modern", "dark", "minimal"]
  },
  {
    id: "ocean_eyes_m6_leap",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_6th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "ocean eyes",
    artist: "Billie Eilish",
    year: 2015,
    genre_tags: ["pop", "indie_pop", "electropop"],
    insight: {
      playful: "In 'ocean eyes,' when Billie sings the title, her voice floats up in this dreamy, wide leap — that's a minor 6th. It sounds like falling into something beautiful.",
      musician: "The minor 6th leap in the melody of 'ocean eyes' creates a sense of breathless vulnerability. The interval's width gives the vocal line an ethereal, reaching quality that matches the lyrics perfectly.",
      theorist: "The ascending minor 6th (8 semitones, inversion of the major 3rd) functions here as a melodic leap that emphasizes the upper register, creating registral tension that resolves stepwise — a technique common in contemporary pop ballads."
    },
    min_age: 8,
    era_tags: ["genz", "alpha"],
    demo: {
      notes: ["E4", "C5"],
      rhythm: "quarter-half",
      tempo: 72,
      loop: false
    },
    preference_tags: ["pop", "indie", "modern", "dreamy", "emotional"]
  },
  {
    id: "drivers_license_pachelbel",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_V_vi_IV", "descending_bass"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "drivers license",
    artist: "Olivia Rodrigo",
    year: 2021,
    genre_tags: ["pop", "indie_pop", "ballad"],
    insight: {
      playful: "drivers license uses basically the same chord pattern as Pachelbel's Canon from 1680 — a 340-year-old trick that still makes people cry! The chords walk downward step by step, pulling you along emotionally.",
      musician: "drivers license is built on a descending bass variation of the I–V–vi–IV loop in Bb major. The verse's stepwise descending bass (Bb–A–G–F) mirrors Pachelbel's Canon and creates the same hypnotic, inevitable quality. Rodrigo proves this centuries-old pattern still has power.",
      theorist: "The descending stepwise bass line (scale degrees 1–7–6–5) over the I–V6–vi–IV progression creates a lament bass pattern — one of the oldest harmonic devices in Western music. The first-inversion V chord (V6) enables the smooth scalar descent without a root-position dominant, preserving the stepwise motion."
    },
    min_age: 10,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["pop", "modern", "emotional", "ballad", "heartbreak"]
  },
  {
    id: "good_4_u_punk_pop",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_V_vi_IV", "energy"],
    game_ids: ["chord_progression_builder"],
    song: "good 4 u",
    artist: "Olivia Rodrigo",
    year: 2021,
    genre_tags: ["pop_punk", "pop", "rock"],
    insight: {
      playful: "good 4 u is LOUD and angry — but underneath all that energy, it's the same I-V-vi-IV chord loop as Let It Be and a hundred other songs. The chords are simple; the attitude is what makes it different!",
      musician: "good 4 u uses the I–V–vi–IV progression (A–E–F#m–D) but with pop-punk energy and distorted guitars. Same four chords as 'Let It Be' and 'No Woman No Cry' — the difference is entirely arrangement, tempo, and attitude. A great example of how production transforms harmony.",
      theorist: "The I–V–vi–IV progression demonstrates functional harmony's independence from surface style. The identical pitch-class content serves ballad, reggae, and pop-punk equally — harmonic function is invariant under orchestration, tempo, and dynamic transformation."
    },
    min_age: 10,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["pop", "punk", "modern", "angry", "energetic"]
  },
  {
    id: "blinding_lights_synth",
    concept_ids: ["minor_scale", "diatonic_chords"],
    concept_specifics: ["minor_key_pop", "i_III_VI_VII"],
    game_ids: ["chord_progression_builder", "relative_key_trainer"],
    song: "Blinding Lights",
    artist: "The Weeknd",
    year: 2020,
    genre_tags: ["synth_pop", "pop", "80s_revival"],
    insight: {
      playful: "Blinding Lights sounds like a retro 80s song but brand new. It's in a minor key, which gives it that driving, urgent feeling — like you're running through a neon city at night!",
      musician: "Blinding Lights is in F minor with a i–III–VI–VII progression (Fm–Ab–Db–Eb). The III and VI chords are borrowed from the relative major (Ab major), which is why it sounds minor but with bright, major-chord energy. The 80s synth production reinforces the retro-modern duality.",
      theorist: "The i–III–VI–VII progression stays within the natural minor diatonic set (Aeolian) — all four chords are diatonic to F minor. The III (Ab) and VI (Db) are major chords built on minor scale degrees, giving the progression its characteristic blend of minor tonic gravity and major chord brightness."
    },
    min_age: 8,
    era_tags: ["genz", "millennial", "alpha"],
    demo: null,
    preference_tags: ["pop", "synth", "modern", "80s_revival", "dance"]
  },
  {
    id: "shape_of_you_rhythm",
    concept_ids: ["rhythm", "minor_scale"],
    concept_specifics: ["syncopation", "groove"],
    game_ids: ["rhythm_tapper"],
    song: "Shape of You",
    artist: "Ed Sheeran",
    year: 2017,
    genre_tags: ["pop", "dancehall"],
    insight: {
      playful: "Shape of You has that bouncy, skippy rhythm that makes you want to dance. The trick? The accents land in unexpected places — that's called syncopation, and it's what makes a groove groove!",
      musician: "Shape of You combines a dancehall-derived offbeat rhythm with a simple four-chord minor loop (C#m–F#m–A–B). The marimba riff's syncopation — accenting the 'and' of beat 2 and beat 4 — is what gives the track its infectious groove. Strip the syncopation and the song loses all its energy.",
      theorist: "The rhythmic profile displaces metric stress through consistent anticipation of strong beats, creating a persistent syncopation pattern. The offbeat accent structure derives from dancehall's characteristic 'skank' rhythm, transplanted into a pop production context."
    },
    min_age: 8,
    era_tags: ["millennial", "genz"],
    demo: null,
    preference_tags: ["pop", "dance", "modern", "groovy", "catchy"]
  },
  {
    id: "someone_like_you_I_V_vi_IV",
    concept_ids: ["diatonic_chords", "chord_function"],
    concept_specifics: ["I_V_vi_IV", "ballad"],
    game_ids: ["chord_progression_builder", "harmony_trainer"],
    song: "Someone Like You",
    artist: "Adele",
    year: 2011,
    genre_tags: ["pop", "ballad", "soul"],
    insight: {
      playful: "Someone Like You is one of the saddest pop songs ever — but it uses the exact same four chords as hundreds of happy songs! The difference is Adele's voice and the slow piano. Same recipe, completely different meal.",
      musician: "Someone Like You uses I–V–vi–IV in A major (A–E–F#m–D) as a slow arpeggiated piano ballad. It's the same progression as 'Let It Be,' 'good 4 u,' and 'With or Without You' — the emotional impact comes entirely from tempo, arrangement, and vocal delivery. A powerful demonstration that chord progressions don't have inherent emotions.",
      theorist: "The I–V–vi–IV progression's emotional neutrality is demonstrated by its appearance across genres from punk to power ballad. The perceived sadness in this context is a product of slow tempo (67 BPM), arpeggiated voicing (reducing harmonic density), and the minor vi chord receiving proportionally more temporal emphasis at slower speeds."
    },
    min_age: 10,
    era_tags: ["millennial", "genz"],
    demo: null,
    preference_tags: ["pop", "ballad", "emotional", "piano", "modern"]
  },
  {
    id: "old_town_road_mixolydian",
    concept_ids: ["modes", "pentatonic_scale"],
    concept_specifics: ["mixolydian", "pentatonic_melody"],
    game_ids: ["scale_builder"],
    song: "Old Town Road",
    artist: "Lil Nas X ft. Billy Ray Cyrus",
    year: 2019,
    genre_tags: ["country_rap", "hip_hop", "pop"],
    insight: {
      playful: "Old Town Road mixes country and hip hop — and the melody sits on a pentatonic scale, which is the one scale that sounds good in BOTH genres. That's why the crossover works!",
      musician: "Old Town Road uses a pentatonic-based melody over a minor-key beat (banjo sample + 808s). The major pentatonic scale is the connective tissue between country and hip hop — both genres lean heavily on pentatonic melodies. That shared musical DNA is why the genre crossover felt natural rather than forced.",
      theorist: "The anhemitonic major pentatonic's cross-cultural universality enables genre fusion — its absence of semitones makes it compatible with virtually any diatonic or modal harmonic context, functioning equally well in country (scalar), blues (with bent b3/b7), and hip hop (as melodic hook over loop-based production)."
    },
    min_age: 8,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["hip_hop", "country", "modern", "fun", "viral"]
  },
  {
    id: "stay_key_change",
    concept_ids: ["major_scale", "circle_of_fifths"],
    concept_specifics: ["modulation", "key_change"],
    game_ids: ["harmony_trainer"],
    song: "Stay",
    artist: "The Kid LAROI & Justin Bieber",
    year: 2021,
    genre_tags: ["pop", "dance_pop"],
    insight: {
      playful: "Stay has a moment where everything suddenly shifts up and gets more intense — that's a key change! It's like climbing a staircase and suddenly finding another floor you didn't expect.",
      musician: "Stay modulates up a semitone in the final chorus — one of the oldest tricks in pop songwriting (see: 'Love On Top,' 'I Wanna Dance with Somebody'). The half-step key change creates an instant energy boost without changing anything about the melody or rhythm.",
      theorist: "The semitone modulation (common-tone or direct modulation) raises all pitch classes by one semitone, preserving intervallic content while increasing registral tension. This is a non-functional modulation — there's no pivot chord or dominant preparation, just a sudden transposition."
    },
    min_age: 8,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["pop", "modern", "dance", "catchy"]
  },


  // ═══════════════════════════════════════════
  // DISNEY / PIXAR / KID-FRIENDLY
  // ═══════════════════════════════════════════

  {
    id: "let_it_go_key_change",
    concept_ids: ["major_scale", "minor_scale"],
    concept_specifics: ["relative_major_minor", "modulation"],
    game_ids: ["relative_key_trainer", "harmony_trainer"],
    song: "Let It Go (Frozen)",
    artist: "Idina Menzel (Robert Lopez & Kristen Anderson-Lopez)",
    year: 2013,
    genre_tags: ["disney", "musical", "pop", "film"],
    insight: {
      playful: "Let It Go starts in a sad-sounding minor key when Elsa is hiding her powers. Then when she decides to be free — \"Let it go!\" — the music switches to the happy major key! The music literally transforms with her!",
      musician: "Let It Go modulates from F minor (verse) to Ab major (chorus) — the relative major. The minor-to-relative-major shift mirrors Elsa's emotional arc: from fear to liberation. It's the same note set, just recentered — a powerful demonstration of how tonal center affects mood.",
      theorist: "The modulation from F Aeolian to Ab Ionian exploits relative key equivalence — identical pitch-class collections with different tonal centers. The pivot occurs at 'Let it go' where Ab major is recontextualized from III in F minor to I in Ab major, a common-chord modulation using the mediant as pivot."
    },
    min_age: 4,
    era_tags: ["millennial", "genz", "alpha"],
    demo: null,
    preference_tags: ["disney", "frozen", "musical", "kids", "emotional", "empowering"]
  },
  {
    id: "do_you_want_build_snowman_m3",
    concept_ids: ["intervals"],
    concept_specifics: ["minor_3rd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "Do You Want to Build a Snowman? (Frozen)",
    artist: "Kristen Bell (Robert Lopez & Kristen Anderson-Lopez)",
    year: 2013,
    genre_tags: ["disney", "musical", "film"],
    insight: {
      playful: "\"Do you want to build a SNOW-man?\" — the little jump up on 'snow' is a minor 3rd. It's the same distance as the Smoke on the Water guitar riff, but here it sounds sweet and hopeful instead of heavy!",
      musician: "The minor 3rd leap on 'snowman' gives the melody its childlike, playful character. The same interval sounds completely different in a children's song vs. a rock riff — context is everything.",
      theorist: "The ascending minor 3rd (3 semitones) from scale degree 5 to b7 in the major key context creates a brief modal inflection (Mixolydian coloring) that gives the melody its bittersweet, yearning quality beneath the playful surface."
    },
    min_age: 3,
    era_tags: ["millennial", "genz", "alpha"],
    demo: {
      notes: ["G4", "Bb4"],
      rhythm: "eighth-quarter",
      tempo: 120,
      loop: false
    },
    preference_tags: ["disney", "frozen", "kids", "cute", "singalong"]
  },
  {
    id: "how_far_ill_go_P5",
    concept_ids: ["intervals"],
    concept_specifics: ["perfect_5th"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "How Far I'll Go (Moana)",
    artist: "Auli'i Cravalho (Lin-Manuel Miranda)",
    year: 2016,
    genre_tags: ["disney", "musical", "pop", "film"],
    insight: {
      playful: "When Moana sings about wanting to go beyond the reef, her melody makes a big heroic leap — a perfect 5th, the same jump as the Star Wars theme! It sounds like adventure calling!",
      musician: "The ascending P5 in 'How Far I'll Go' creates the same heroic, reaching quality as the Star Wars fanfare but in a pop ballad context. Lin-Manuel Miranda uses the interval at the emotional peak to give Moana's yearning a musical shape — wide intervals for wide horizons.",
      theorist: "The ascending P5 at the melodic climax functions as an appoggiatura to the tonic, creating maximum registral tension before resolution. The interval's open, stable quality paradoxically creates instability in context because it arrives on a metrically strong beat with harmonic non-chord-tone status."
    },
    min_age: 4,
    era_tags: ["genz", "alpha"],
    demo: {
      notes: ["C4", "G4"],
      rhythm: "quarter-dotted-half",
      tempo: 80,
      loop: false
    },
    preference_tags: ["disney", "moana", "kids", "adventure", "empowering"]
  },
  {
    id: "remember_me_coco_major_minor",
    concept_ids: ["major_scale", "minor_scale"],
    concept_specifics: ["same_song_two_keys", "major_minor_contrast"],
    game_ids: ["relative_key_trainer"],
    song: "Remember Me (Coco)",
    artist: "Various (Kristen Anderson-Lopez & Robert Lopez)",
    year: 2017,
    genre_tags: ["disney", "pixar", "musical", "latin", "film"],
    insight: {
      playful: "In Coco, 'Remember Me' is sung twice — first as a loud, flashy rock version and later as a soft, sad lullaby. The lullaby version sounds sadder partly because it shifts to a minor key! Same melody, different mood.",
      musician: "Coco uses 'Remember Me' in two arrangements: Ernesto's bombastic performance (major, uptempo) and Miguel/Héctor's lullaby (minor, gentle). The major/minor contrast is the most direct demonstration of how key quality changes emotional content — it's the same tune reframed.",
      theorist: "The parallel major/minor reharmonization preserves the melodic contour while altering the intervallic content at the third degree (major 3rd → minor 3rd). This P-transform relationship between the two versions illustrates modal mixture as a compositional device for narrative contrast."
    },
    min_age: 4,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["disney", "pixar", "kids", "emotional", "latin", "beautiful"]
  },
  {
    id: "youve_got_friend_me_M3",
    concept_ids: ["intervals"],
    concept_specifics: ["major_3rd"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "You've Got a Friend in Me (Toy Story)",
    artist: "Randy Newman",
    year: 1995,
    genre_tags: ["disney", "pixar", "film", "jazz_pop"],
    insight: {
      playful: "\"You've got a FRIEND in me\" — that warm jump up on 'friend' is a major 3rd. It sounds happy and friendly, like a big hug in music form! Perfect for a song about friendship.",
      musician: "The major 3rd leap on 'friend' gives Randy Newman's melody its characteristic warmth. Newman's jazz-influenced writing uses the M3 as a comfort interval — it's stable, bright, and open. Combined with the shuffle rhythm, it creates instant nostalgia.",
      theorist: "The ascending major 3rd (4 semitones, ratio 5:4) from the root to the mediant outlines the lower portion of the tonic triad, establishing tonal stability immediately. Newman's use of swing eighth notes and chromatic passing tones adds jazz coloring without disrupting the diatonic clarity."
    },
    min_age: 3,
    era_tags: ["millennial", "genz", "alpha", "classic"],
    demo: {
      notes: ["C4", "E4"],
      rhythm: "quarter-quarter",
      tempo: 112,
      loop: false
    },
    preference_tags: ["disney", "pixar", "kids", "friendship", "warm", "classic"]
  },
  {
    id: "under_the_sea_calypso",
    concept_ids: ["rhythm", "major_scale"],
    concept_specifics: ["syncopation", "calypso", "major_key"],
    game_ids: ["rhythm_tapper"],
    song: "Under the Sea (The Little Mermaid)",
    artist: "Samuel E. Wright (Alan Menken & Howard Ashman)",
    year: 1989,
    genre_tags: ["disney", "musical", "calypso", "film"],
    insight: {
      playful: "Under the Sea makes you want to dance because it's got a calypso beat — a Caribbean rhythm where the accents bounce around in unexpected places. It's music that swings and sways like ocean waves!",
      musician: "Under the Sea uses a calypso/soca rhythm in Bb major — offbeat accents, syncopated bass, and a lilting feel. The rhythmic interest is what makes this song so energetic despite being harmonically simple (mostly I, IV, and V). It's a great example of how rhythm can do more heavy lifting than harmony.",
      theorist: "The calypso rhythmic profile features consistent offbeat displacement of melodic accents against a steady duple pulse, creating a metric dissonance (2+3+3/8 grouping against 4/4) that gives the music its characteristic lilt. The harmonic simplicity (I–IV–V) allows the rhythmic complexity to remain perceptually foregrounded."
    },
    min_age: 3,
    era_tags: ["millennial", "genz", "alpha", "classic"],
    demo: null,
    preference_tags: ["disney", "kids", "fun", "dance", "caribbean"]
  },
  {
    id: "we_dont_talk_about_bruno",
    concept_ids: ["minor_scale", "rhythm", "diatonic_chords"],
    concept_specifics: ["minor_key_groove", "polyrhythm_lite"],
    game_ids: ["rhythm_tapper", "relative_key_trainer"],
    song: "We Don't Talk About Bruno (Encanto)",
    artist: "Carolina Gaitán et al. (Lin-Manuel Miranda)",
    year: 2021,
    genre_tags: ["disney", "musical", "latin", "pop", "film"],
    insight: {
      playful: "We Don't Talk About Bruno layers a bunch of different rhythms and melodies on top of each other — and they all fit! It's like a musical puzzle where every piece clicks into place. The minor key gives it that mysterious, spooky Bruno vibe.",
      musician: "Bruno is in Bm and builds by stacking different vocal parts and rhythmic patterns (cumbia-influenced percussion, the 'rat-a-tat' triplets, the sustained 'It was a wedding day' countermelody). Miranda uses the minor key for Bruno's ominous theme, then the layered finale shows how different melodies in the same key can coexist — a practical lesson in counterpoint.",
      theorist: "The finale section demonstrates invertible counterpoint at the octave — multiple independent melodic lines designed to function simultaneously within a shared harmonic framework (i–VII–VI–VII in B minor). Each voice maintains its own rhythmic identity while the aggregate creates a rich polyrhythmic texture."
    },
    min_age: 4,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["disney", "encanto", "kids", "latin", "fun", "viral"]
  },
  {
    id: "a_whole_new_world_octave",
    concept_ids: ["intervals"],
    concept_specifics: ["octave", "major_key"],
    game_ids: ["interval_spotter", "melody_match"],
    song: "A Whole New World (Aladdin)",
    artist: "Brad Kane & Lea Salonga (Alan Menken & Tim Rice)",
    year: 1992,
    genre_tags: ["disney", "musical", "ballad", "film"],
    insight: {
      playful: "When Aladdin and Jasmine sing 'A whole new WORLD,' the melody soars way up on 'world' — that big leap is close to an octave! It literally sounds like they're flying up into the sky on the magic carpet!",
      musician: "The wide melodic leap at 'world' mirrors the sense of vastness and wonder — Menken uses register as a storytelling device. The D major key and lush orchestration create the 'golden age Disney' sound that defines the Renaissance era.",
      theorist: "The large ascending leap at the melodic climax functions as a registral highpoint that coincides with the harmonic climax, creating a convergence of melodic, harmonic, and lyrical peak — a technique known as 'structural accent' in Schenkerian analysis."
    },
    min_age: 4,
    era_tags: ["millennial", "genz", "alpha", "classic"],
    demo: null,
    preference_tags: ["disney", "aladdin", "kids", "romantic", "beautiful", "classic"]
  },
  {
    id: "into_the_unknown_m2_tension",
    concept_ids: ["intervals", "minor_scale"],
    concept_specifics: ["minor_2nd", "tension"],
    game_ids: ["interval_spotter"],
    song: "Into the Unknown (Frozen II)",
    artist: "Idina Menzel (Robert Lopez & Kristen Anderson-Lopez)",
    year: 2019,
    genre_tags: ["disney", "musical", "pop", "film"],
    insight: {
      playful: "That mysterious voice calling Elsa with 'ah-ah, ah-ah' — those notes are just one tiny step apart, a minor 2nd! It sounds eerie and magical, like something pulling you into the mist.",
      musician: "The siren call motif in 'Into the Unknown' oscillates by semitone (minor 2nd) — the same interval as the Jaws theme, but here it sounds mystical rather than threatening. Same interval, totally different context: slower tempo, higher register, ethereal production. Proof that intervals don't have fixed emotions.",
      theorist: "The semitone oscillation functions as an upper neighbor-tone figure, recontextualized from its traditional role as dissonance-resolution into a static ostinato. The repetitive minor 2nd creates a trance-like quality through its resistance to harmonic resolution — the interval's instability becomes a feature rather than a problem to solve."
    },
    min_age: 4,
    era_tags: ["genz", "alpha"],
    demo: {
      notes: ["E5", "F5", "E5", "F5"],
      rhythm: "quarter-quarter-quarter-quarter",
      tempo: 80,
      loop: true
    },
    preference_tags: ["disney", "frozen", "kids", "magical", "mysterious"]
  },
  {
    id: "surface_pressure_mixed_meter",
    concept_ids: ["rhythm"],
    concept_specifics: ["mixed_meter_feel", "syncopation"],
    game_ids: ["rhythm_tapper"],
    song: "Surface Pressure (Encanto)",
    artist: "Jessica Darrow (Lin-Manuel Miranda)",
    year: 2021,
    genre_tags: ["disney", "musical", "pop", "hip_hop_influence", "film"],
    insight: {
      playful: "Surface Pressure has this intense, almost breathless rhythm — the words come tumbling out faster and faster like Luisa can't hold them in anymore. The rhythm IS the storytelling!",
      musician: "Surface Pressure mixes sung verses with rapid-fire patter sections (Miranda's Hamilton influence showing). The rhythmic density increases as Luisa's emotional pressure builds — the song literally speeds up in feel (not tempo) through subdivision. It's rhythm as character development.",
      theorist: "The progressive rhythmic densification (quarter notes → eighth notes → sixteenth-note patter) creates perceived acceleration at constant tempo, a technique that exploits the listener's metric entrainment. The speech-rhythm integration in the patter sections approaches Sprechstimme, blurring the boundary between sung melody and rhythmic speech."
    },
    min_age: 6,
    era_tags: ["genz", "alpha"],
    demo: null,
    preference_tags: ["disney", "encanto", "kids", "powerful", "hip_hop", "fun"]
  }
];

export default SONG_EXAMPLES;
