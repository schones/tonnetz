/**
 * walkthroughs.js
 * ===============
 * Guided walkthrough sequences for the Tonnetz Explorer.
 *
 * Each walkthrough is a named entry with:
 *   title   — display name for the walkthrough
 *   song    — song/source attribution (shown small on the card)
 *   seeAlso — optional { label, href } shown on the final step as a nudge
 *             to a related game/tool, e.g. { label: "Chord Walks", href: "/games/chord-walks" }
 *   steps[] — ordered steps, each with:
 *     chord              — chord name string, e.g. "F", "Em", "A7", "Dm"
 *     title              — short bold heading for this step
 *     body               — 1-2 sentence explanation (conversational, no jargon)
 *     autoPlay           — if true, play the chord on entering this step (default false)
 *     highlightTransform — optional "P", "R", or "L" to show a PLR transform arrow
 *     focus              — optional panel(s) to emphasize: "tonnetz", "keyboard",
 *                          "wheel", "fretboard". String or array of strings.
 *                          Other panels are dimmed. Omit to show all panels normally.
 *
 * Chord names are parsed the same way the Explorer URL deep-links work:
 *   "F" → F major, "Em" → E minor, "A7" → A major (triad), "Dm" → D minor, etc.
 */

const WALKTHROUGHS = {
  yesterday_voice_leading: {
    title: "Yesterday's Aching Bass Line",
    song: "Yesterday — The Beatles",
    seeAlso: { label: "Harmony Trainer", href: "/games/chord-walks" },
    steps: [
      { chord: "F", function: "tonic",            title: "Start here", body: "F major. Bright, stable. Listen to where the bass note sits.", autoPlay: true },
      { chord: "Em", function: "chromatic bass",  title: "One note drops", body: "The bass slides down just a half step — F to E. The whole mood shifts from major to minor.", autoPlay: true, focus: "keyboard" },
      { chord: "A",  function: "secondary dominant", title: "And again", body: "Another half step down in an inner voice. The harmony is pulling you somewhere.", autoPlay: true, focus: "keyboard" },
      { chord: "Dm", function: "arrival (vi)",    title: "The arrival", body: "D minor. That descending chromatic line just carried you from bright to melancholy in four chords. That's voice leading.", autoPlay: true, focus: "keyboard", concept_specifics: ["voice_leading", "chromatic_bass"] },
    ]
  },

  am_c_relationship: {
    title: "Two Chords, Two Shared Notes",
    song: "Eleanor Rigby — The Beatles",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    steps: [
      { chord: "Am", function: "tonic (i)",       title: "A minor", body: "Three notes: A, C, E. Watch where they sit on the Tonnetz.", autoPlay: true, focus: "tonnetz" },
      { chord: "C",  function: "relative major",  title: "Now C major", body: "C, E, G. See it? Two of the three notes — C and E — didn't move at all. Only A moved to G.", autoPlay: true, highlightTransform: "R", focus: "tonnetz" },
      { chord: "Am", function: "back to i",       title: "That's the R transform", body: "One note changes, two stay put. That's why Am and C feel like family — Eleanor Rigby floats between them like they're the same key. Because in a way, they are.", autoPlay: true, focus: "tonnetz", concept_specifics: ["R_transform", "relative_major_minor"] },
    ]
  },

  creep_progression: {
    title: "The Shock of the Chromatic Mediant",
    song: "Creep — Radiohead",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    steps: [
      { chord: "G",  function: "tonic",             title: "Home base", body: "G major. Comfortable, stable. This is where the verse starts.", autoPlay: true },
      { chord: "B",  function: "chromatic mediant", title: "The surprise", body: "B major. This is NOT in the key of G — it's a chromatic mediant. Look how far it jumped on the Tonnetz, but it's actually just one flip away. That's why it sounds dramatic but not wrong.", autoPlay: true, highlightTransform: "L", focus: "tonnetz", concept_specifics: ["L_transform", "chromatic_mediant"] },
      { chord: "C",  function: "subdominant (IV)",  title: "Relief", body: "C major. Back to familiar territory — a simple move from B on the grid.", autoPlay: true },
      { chord: "Cm", function: "borrowed chord",    title: "The gut punch", body: "C minor. One note drops and everything darkens. That's the P transform — parallel minor. This is the moment in Creep where the lyrics hit hardest.", autoPlay: true, highlightTransform: "P", concept_specifics: ["P_transform", "parallel_major_minor"] },
    ]
  },

  ii_V_I: {
    title: "The Backbone of Jazz",
    song: "Autumn Leaves / Fly Me to the Moon",
    steps: [
      { chord: "Dm", function: "predominant (ii)", title: "The ii chord", body: "D minor in the key of C. It creates gentle tension — a sense of leaning forward.", autoPlay: true },
      { chord: "G",  function: "dominant (V)",     title: "The V chord", body: "G major. The tension builds. Your ear is now really wanting to resolve somewhere. Watch the path on the Tonnetz from Dm to G — it's a clean, short move.", autoPlay: true, focus: "tonnetz" },
      { chord: "C",  function: "tonic (I)",        title: "Home", body: "C major. That's the resolution — the I chord. The most satisfying arrival in all of harmony. ii→V→I is everywhere in jazz because this path just feels inevitable.", autoPlay: true, concept_specifics: ["ii_V_I", "jazz_harmony"] },
    ]
  },

  mixolydian: {
    title: "One Note Changes Everything",
    song: "Norwegian Wood — The Beatles",
    steps: [
      { chord: "G", function: "tonic",          title: "G major", body: "A normal G major chord. The key of G major has an F♯ in it.", autoPlay: true },
      { chord: "F", function: "♭VII (borrowed)",title: "Now add an F natural chord", body: "F major instead of F♯ diminished. That one note — F natural instead of F♯ — is what makes Mixolydian sound different from regular major. Bluesier, earthier.", autoPlay: true },
      { chord: "G", function: "back to tonic",  title: "Back to G", body: "That G→F→G movement IS Norwegian Wood. The ♭7 gives Mixolydian its character — major but with a laid-back, slightly bluesy edge. Get Lucky by Daft Punk lives here too.", autoPlay: true, concept_specifics: ["mixolydian"] },
    ]
  },

  stairway_P_transform: {
    title: "Light and Shadow",
    song: "Stairway to Heaven — Led Zeppelin",
    steps: [
      { chord: "Am", function: "tonic (i)",      title: "The opening", body: "A minor. Dark, contemplative. This is where Stairway begins.", autoPlay: true },
      { chord: "A",  function: "parallel major", title: "Flip to major", body: "A major. Same root, completely different feeling — like the sun coming through clouds. On the Tonnetz, this is the P transform: one note moves, the whole mood inverts.", autoPlay: true, highlightTransform: "P", focus: "tonnetz", concept_specifics: ["P_transform", "parallel_major_minor"] },
      { chord: "Am", function: "back to i",      title: "And back", body: "A minor again. Zeppelin rides this toggle between light and dark throughout the song. The P transform is the simplest move on the Tonnetz — and one of the most powerful.", autoPlay: true, highlightTransform: "P", focus: "tonnetz" },
      { chord: "C",  function: "relative major", title: "Opening up", body: "C major. A minor and C major share two notes — the R transform. This is where Stairway lifts, moving from shadow into a wider, brighter space. Watch how close they sit on the Tonnetz.", autoPlay: true, highlightTransform: "R", focus: "tonnetz", concept_specifics: ["R_transform", "relative_major_minor"] },
    ]
  },

  deceptive_cadence: {
    title: "The Chord Your Ear Didn't Expect",
    song: "In My Life — The Beatles",
    steps: [
      { chord: "C",  function: "tonic (I)",    title: "Start in C", body: "We're home in C major.", autoPlay: true },
      { chord: "G",  function: "dominant (V)", title: "The V chord", body: "G major — the dominant. Your ear has heard this a million times and it KNOWS what comes next. It expects to resolve back to C.", autoPlay: true },
      { chord: "Am", function: "deceptive vi", title: "Surprise — vi instead of I", body: "A minor instead of C major. That's a deceptive cadence — V→vi instead of V→I. It works because Am shares two notes with C (they're R-transform neighbors), so it feels almost right but emotionally different. Bittersweet instead of resolved.", autoPlay: true, focus: "tonnetz", concept_specifics: ["deceptive_cadence", "V_vi"] },
    ]
  },

  why_does_my_heart_moby: {
    title: "Six Chords That Ache",
    song: "Why Does My Heart Feel So Bad? — Moby",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    steps: [
      { chord: "Am", function: "tonic (i)",            title: "Start in the dark", body: "A minor. The whole song begins right here, on the most melancholy chord in the key. Hold this feeling.", autoPlay: true },
      { chord: "Em", function: "modal v",              title: "Minor v, not V", body: "E minor instead of E major. That's the trick — there's no leading tone, no dominant pull. The harmony stops trying to resolve and just floats. This is what makes Moby sound so… resigned.", autoPlay: true, focus: "tonnetz", concept_specifics: ["modal_v", "no_leading_tone"] },
      { chord: "G",  function: "♭VII (subtonic)",      title: "An R-transform glide", body: "G major. Watch the Tonnetz — Em and G share two notes (G and B). It's the R transform: one note moves, two stay put. That's why the slide from Em to G feels effortless, like the music is just leaning sideways.", autoPlay: true, highlightTransform: "R", focus: "tonnetz", concept_specifics: ["R_transform"] },
      { chord: "D",  function: "Dorian IV",            title: "The single bright note", body: "D major. In A minor we'd expect D minor — but Moby uses D major, borrowed from A Dorian. That one F♯ is the entire reason this song sounds wistful instead of just sad. Hope, rationed by a single semitone.", autoPlay: true, concept_specifics: ["dorian", "borrowed_chord", "modal_mixture"] },
      { chord: "F",  function: "VI / IV of relative major", title: "The chorus opens", body: "F major. Same notes as the verse — we haven't changed key — but the music suddenly feels like a window has opened. F is the IV chord of C major, the relative major. The center of gravity is shifting.", autoPlay: true, focus: "tonnetz" },
      { chord: "C",  function: "III / I of relative major", title: "Release", body: "C major. Now we hear it: the song has slid into the relative major without ever changing a key signature. F→C is just IV→I in C major — the simplest, most settled motion in all of Western music. After all that floating in A minor, the chorus lands like an exhale.", autoPlay: true, concept_specifics: ["relative_major_minor", "modal_pivot", "voice_leading"] },
    ]
  },

  twelve_bar_blues: {
    title: "Three Chords, One Triangle",
    song: "Johnny B. Goode — Chuck Berry",
    seeAlso: { label: "Strum Patterns", href: "/games/strum-patterns" },
    steps: [
      { chord: "C", function: "tonic (I)",       title: "The I chord", body: "C major. Home base for the blues.", autoPlay: true },
      { chord: "F", function: "subdominant (IV)",title: "The IV chord", body: "F major. Look at the Tonnetz — F is right next to C. One step away.", autoPlay: true, focus: "tonnetz" },
      { chord: "G", function: "dominant (V)",    title: "The V chord", body: "G major. Also right next to C, on the other side. I, IV, and V form a tight triangle on the grid — the three closest major chords to each other.", autoPlay: true, focus: "tonnetz" },
      { chord: "C", function: "back to tonic",   title: "That's the whole blues", body: "From Johnny B. Goode to Hound Dog to a thousand songs you know — it's these three neighbors taking turns. The simplest path through harmonic space, and it never gets old.", autoPlay: true, concept_specifics: ["twelve_bar_blues", "I_IV_V"] },
    ]
  },
};

export { WALKTHROUGHS };
