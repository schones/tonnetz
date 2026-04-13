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
    category: "Voice Leading",
    audience: "musician",
    seeAlso: { label: "Harmony Trainer", href: "/games/chord-walks" },
    rhythm: {
      time_sig: "4/4",
      bpm: 96,
      feel: "Gentle fingerpick",
      description: "A soft, steady fingerpicking pattern. The bass walks the descending chromatic line while the upper strings keep a gentle pulse.",
      pattern: [
        { beat: "1", label: "bass", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "2", label: "brush",type: "snare" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "3", label: "bass", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "4", label: "brush",type: "snare" },
        { beat: "&", label: "·",    type: "strum" }
      ]
    },
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
    category: "Transforms",
    audience: "musician",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    rhythm: {
      time_sig: "4/4",
      bpm: 134,
      feel: "Driving strings",
      description: "Urgent staccato strings drive Eleanor Rigby forward. No drums — the rhythm comes entirely from the bowing pattern.",
      pattern: [
        { beat: "1", label: "BOW",  type: "bass" },
        { beat: "&", label: "bow",  type: "strum" },
        { beat: "2", label: "BOW",  type: "bass" },
        { beat: "&", label: "bow",  type: "strum" },
        { beat: "3", label: "BOW",  type: "bass" },
        { beat: "&", label: "bow",  type: "strum" },
        { beat: "4", label: "BOW",  type: "bass" },
        { beat: "&", label: "bow",  type: "strum" }
      ]
    },
    steps: [
      { chord: "Am", function: "tonic (i)",       title: "A minor", body: "Three notes: A, C, E. Watch where they sit on the Tonnetz.", autoPlay: true, focus: "tonnetz" },
      { chord: "C",  function: "relative major",  title: "Now C major", body: "C, E, G. See it? Two of the three notes — C and E — didn't move at all. Only A moved to G.", autoPlay: true, highlightTransform: "R", focus: "tonnetz" },
      { chord: "Am", function: "back to i",       title: "That's the R transform", body: "One note changes, two stay put. That's why Am and C feel like family — Eleanor Rigby floats between them like they're the same key. Because in a way, they are.", autoPlay: true, focus: "tonnetz", concept_specifics: ["R_transform", "relative_major_minor"] },
    ]
  },

  creep_progression: {
    title: "The Shock of the Chromatic Mediant",
    song: "Creep — Radiohead",
    category: "Transforms",
    audience: "musician",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    rhythm: {
      time_sig: "4/4",
      bpm: 92,
      feel: "Clean arpeggiation to crunch",
      description: "Quiet clean guitar arpeggiation in the verse, explosive distorted strums in the chorus. The dynamic contrast IS the song.",
      pattern: [
        { beat: "1", label: "bass", type: "bass" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "2", label: "pick", type: "strum" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "3", label: "bass", type: "bass" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "4", label: "SNAP", type: "snare" },
        { beat: "&", label: "pick", type: "strum" }
      ]
    },
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
    category: "Jazz Harmony",
    audience: "musician",
    rhythm: {
      time_sig: "4/4",
      bpm: 120,
      feel: "Medium swing",
      description: "Classic jazz swing — the ride cymbal keeps time with a long-short triplet feel while the bass walks quarter notes.",
      pattern: [
        { beat: "1", label: "WALK", type: "bass" },
        { beat: "a", label: "ting", type: "strum" },
        { beat: "2", label: "RIDE", type: "snare" },
        { beat: "a", label: "ting", type: "strum" },
        { beat: "3", label: "WALK", type: "bass" },
        { beat: "a", label: "ting", type: "strum" },
        { beat: "4", label: "RIDE", type: "snare" },
        { beat: "a", label: "ting", type: "strum" }
      ]
    },
    steps: [
      { chord: "Dm", function: "predominant (ii)", title: "The ii chord", body: "D minor in the key of C. It creates gentle tension — a sense of leaning forward.", autoPlay: true },
      { chord: "G",  function: "dominant (V)",     title: "The V chord", body: "G major. The tension builds. Your ear is now really wanting to resolve somewhere. Watch the path on the Tonnetz from Dm to G — it's a clean, short move.", autoPlay: true, focus: "tonnetz" },
      { chord: "C",  function: "tonic (I)",        title: "Home", body: "C major. That's the resolution — the I chord. The most satisfying arrival in all of harmony. ii→V→I is everywhere in jazz because this path just feels inevitable.", autoPlay: true, concept_specifics: ["ii_V_I", "jazz_harmony"] },
    ]
  },

  mixolydian: {
    title: "One Note Changes Everything",
    song: "Norwegian Wood — The Beatles",
    category: "Modes & Scales",
    audience: "musician",
    rhythm: {
      time_sig: "6/8",
      bpm: 72,
      feel: "Waltz feel",
      description: "Norwegian Wood is in 6/8 — six eighth notes grouped in two sets of three. It gives the song its gentle rocking quality, like a lullaby.",
      pattern: [
        { beat: "1", label: "BASS", type: "bass" },
        { beat: "2", label: "·",    type: "strum" },
        { beat: "3", label: "·",    type: "strum" },
        { beat: "4", label: "tap",  type: "snare" },
        { beat: "5", label: "·",    type: "strum" },
        { beat: "6", label: "·",    type: "strum" }
      ]
    },
    steps: [
      { chord: "G", function: "tonic",          title: "G major", body: "A normal G major chord. The key of G major has an F♯ in it.", autoPlay: true },
      { chord: "F", function: "♭VII (borrowed)",title: "Now add an F natural chord", body: "F major instead of F♯ diminished. That one note — F natural instead of F♯ — is what makes Mixolydian sound different from regular major. Bluesier, earthier.", autoPlay: true },
      { chord: "G", function: "back to tonic",  title: "Back to G", body: "That G→F→G movement IS Norwegian Wood. The ♭7 gives Mixolydian its character — major but with a laid-back, slightly bluesy edge. Get Lucky by Daft Punk lives here too.", autoPlay: true, concept_specifics: ["mixolydian"] },
    ]
  },

  stairway_P_transform: {
    title: "Light and Shadow",
    song: "Stairway to Heaven — Led Zeppelin",
    category: "Transforms",
    audience: "musician",
    rhythm: {
      time_sig: "4/4",
      bpm: 82,
      feel: "Arpeggiated ballad",
      description: "The intro is pure fingerpicked arpeggiation — each chord is spelled out note by note. No drums until much later. The guitar IS the rhythm section.",
      pattern: [
        { beat: "1", label: "bass", type: "bass" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "2", label: "pick", type: "strum" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "3", label: "bass", type: "bass" },
        { beat: "&", label: "pick", type: "strum" },
        { beat: "4", label: "pick", type: "strum" },
        { beat: "&", label: "pick", type: "strum" }
      ]
    },
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
    category: "Progressions",
    audience: "musician",
    rhythm: {
      time_sig: "4/4",
      bpm: 103,
      feel: "Steady pop rock",
      description: "Clean, steady Beatles pop — drums keep a simple backbeat while the rhythm guitar strums eighth notes. Nothing flashy, everything in service of the melody.",
      pattern: [
        { beat: "1", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "2", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "3", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "4", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" }
      ]
    },
    steps: [
      { chord: "C",  function: "tonic (I)",    title: "Start in C", body: "We're home in C major.", autoPlay: true },
      { chord: "G",  function: "dominant (V)", title: "The V chord", body: "G major — the dominant. Your ear has heard this a million times and it KNOWS what comes next. It expects to resolve back to C.", autoPlay: true },
      { chord: "Am", function: "deceptive vi", title: "Surprise — vi instead of I", body: "A minor instead of C major. That's a deceptive cadence — V→vi instead of V→I. It works because Am shares two notes with C (they're R-transform neighbors), so it feels almost right but emotionally different. Bittersweet instead of resolved.", autoPlay: true, focus: "tonnetz", concept_specifics: ["deceptive_cadence", "V_vi"] },
    ]
  },

  why_does_my_heart_moby: {
    title: "Six Chords That Ache",
    song: "Why Does My Heart Feel So Bad? — Moby",
    category: "Modes & Scales",
    audience: "musician",
    seeAlso: { label: "Chord Walks", href: "/games/chord-walks" },
    rhythm: {
      time_sig: "4/4",
      bpm: 98,
      feel: "Four on the floor",
      description: "A steady electronic kick on every beat — the pulse that keeps a dance floor breathing. Moby built the whole song over this unwavering heartbeat.",
      pattern: [
        { beat: "1", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "2", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "3", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "4", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" }
      ]
    },
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
    category: "Progressions",
    audience: "musician",
    seeAlso: { label: "Strum Patterns", href: "/games/strum-patterns" },
    rhythm: {
      time_sig: "4/4",
      bpm: 168,
      feel: "Shuffle",
      description: "A fast shuffle — long-short, long-short — that drives Chuck Berry's rock and roll forward. Same triplet feel as a slow blues, just cranked up.",
      pattern: [
        { beat: "1", label: "LONG", type: "bass" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "2", label: "LONG", type: "snare" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "3", label: "LONG", type: "bass" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "4", label: "LONG", type: "snare" },
        { beat: "a", label: "short",type: "strum" }
      ]
    },
    steps: [
      { chord: "C", function: "tonic (I)",       title: "The I chord", body: "C major. Home base for the blues.", autoPlay: true },
      { chord: "F", function: "subdominant (IV)",title: "The IV chord", body: "F major. Look at the Tonnetz — F is right next to C. One step away.", autoPlay: true, focus: "tonnetz" },
      { chord: "G", function: "dominant (V)",    title: "The V chord", body: "G major. Also right next to C, on the other side. I, IV, and V form a tight triangle on the grid — the three closest major chords to each other.", autoPlay: true, focus: "tonnetz" },
      { chord: "C", function: "back to tonic",   title: "That's the whole blues", body: "From Johnny B. Goode to Hound Dog to a thousand songs you know — it's these three neighbors taking turns. The simplest path through harmonic space, and it never gets old.", autoPlay: true, concept_specifics: ["twelve_bar_blues", "I_IV_V"] },
    ]
  },

  folsom_train_beat: {
    title: "The Train Beat",
    song: "Folsom Prison Blues — Johnny Cash",
    category: "Rhythm & Feel",
    audience: "musician",
    seeAlso: { label: "Swing Trainer", href: "/games/swing-trainer" },
    rhythm: {
      time_sig: "4/4",
      bpm: 160,
      feel: "Train beat",
      description: "The train beat alternates bass on downbeats with muted strums on every upbeat. No drums needed — the guitar IS the rhythm section.",
      pattern: [
        { beat: "1", label: "BOOM", type: "bass" },
        { beat: "&", label: "chk",  type: "strum" },
        { beat: "2", label: "SNAP", type: "snare" },
        { beat: "&", label: "chk",  type: "strum" },
        { beat: "3", label: "BOOM", type: "bass" },
        { beat: "&", label: "chk",  type: "strum" },
        { beat: "4", label: "SNAP", type: "snare" },
        { beat: "&", label: "chk",  type: "strum" }
      ]
    },
    steps: [
      {
        chord: "E",
        function: "tonic (I)",
        title: "The one chord",
        body: "E major. Home base. But before you focus on the chord — listen to the rhythm. BOOM-chk-SNAP-chk, BOOM-chk-SNAP-chk. That's the train beat. The bass hits on 1 and 3, a snare or brush on 2 and 4, and muted guitar strums fill every upbeat.",
        autoPlay: true,
        concept_specifics: ["train_beat", "I_IV_V"]
      },
      {
        chord: "A",
        function: "subdominant (IV)",
        title: "The IV chord arrives",
        body: "A major — the IV chord. The chord changes but the rhythm never breaks. BOOM-chk-SNAP-chk keeps rolling. That's what makes the train beat feel like a train — the groove is a constant engine underneath the harmony.",
        autoPlay: true,
        concept_specifics: ["I_IV_V"]
      },
      {
        chord: "E",
        function: "back to I",
        title: "Back home",
        body: "E major again. In a 12-bar blues, you spend most of your time on the I chord. The train beat makes even this static harmony feel like it's moving forward.",
        autoPlay: true,
        concept_specifics: ["twelve_bar_blues"]
      },
      {
        chord: "B",
        function: "dominant (V)",
        title: "The turnaround",
        body: "B major — the V chord. This is the tension point that pulls you back to E. In Folsom Prison Blues, this is where the verse peaks before resolving. Three chords, one relentless rhythm — that's all you need.",
        autoPlay: true,
        concept_specifics: ["I_IV_V", "twelve_bar_blues"]
      },
      {
        chord: "E",
        function: "resolution (I)",
        title: "I-IV-V and the train beat",
        body: "The whole song is three chords — E, A, B — over a train beat that never stops. Johnny Cash didn't need complexity. The BOOM-chk-SNAP-chk pattern IS the song. You'll hear the same engine driving Ring of Fire, Mama Tried, Cry Cry Cry, and hundreds of country songs.",
        autoPlay: true,
        concept_specifics: ["train_beat", "I_IV_V", "twelve_bar_blues"]
      }
    ]
  },

  let_it_go_pop_formula: {
    title: "The Pop Formula",
    song: "Let It Go — Frozen",
    category: "Progressions",
    audience: "kids",
    rhythm: {
      time_sig: "4/4",
      bpm: 120,
      feel: "Power ballad",
      description: "Straight four-on-the-floor feel that builds from gentle verse to huge chorus. The steady beat lets Elsa's melody soar.",
      pattern: [
        { beat: "1", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "2", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "3", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "4", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" }
      ]
    },
    steps: [
      { chord: "Ab", function: "tonic (I)", title: "Home", body: "A♭ major. This is home base — where the chorus starts. Strong, bright, confident. This is where 'Let it go!' lands.", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "Eb", function: "dominant (V)", title: "The lift", body: "E♭ major — the V chord. It lifts the energy up, like taking a deep breath before the next line.", autoPlay: true },
      { chord: "Fm", function: "relative minor (vi)", title: "The emotion", body: "F minor — the vi chord. This is where the feeling deepens. Major chords sound happy, minor chords sound thoughtful or sad. The song keeps moving between these feelings.", autoPlay: true, concept_specifics: ["vi_chord"] },
      { chord: "Db", function: "subdominant (IV)", title: "The push", body: "D♭ major — the IV chord. It pushes you forward, wanting to go back to the start. I→V→vi→IV. This exact pattern is in hundreds of pop songs — Adele, Ed Sheeran, Taylor Swift. It works every time.", autoPlay: true, concept_specifics: ["I_IV_V"] }
    ]
  },

  friend_in_me_shuffle: {
    title: "The Shuffle Feel",
    song: "You've Got a Friend in Me — Toy Story",
    category: "Rhythm & Feel",
    audience: "kids",
    rhythm: {
      time_sig: "4/4",
      bpm: 108,
      feel: "Shuffle",
      description: "A shuffle splits each beat into three instead of two — long-short, long-short. It's what makes this song bounce and swing instead of marching straight.",
      pattern: [
        { beat: "1", label: "LONG", type: "bass" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "2", label: "LONG", type: "snare" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "3", label: "LONG", type: "bass" },
        { beat: "a", label: "short",type: "strum" },
        { beat: "4", label: "LONG", type: "snare" },
        { beat: "a", label: "short",type: "strum" }
      ]
    },
    steps: [
      { chord: "C", function: "tonic (I)", title: "That bouncy start", body: "C major with a shuffle feel. Listen to how the rhythm bounces — LONG-short, LONG-short. That's a shuffle. It's what makes this song feel like a lazy afternoon with your best friend.", autoPlay: true, focus: "rhythm", concept_specifics: ["shuffle"] },
      { chord: "F", function: "subdominant (IV)", title: "The warm move", body: "F major — the IV chord. In jazz and blues, I→IV is the most natural first move. The shuffle keeps bouncing, the chord gets warmer.", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "C", function: "back to I", title: "Back home", body: "C major again. Notice how the shuffle feel stays constant even when the chords change. The rhythm is the glue.", autoPlay: true },
      { chord: "G", function: "dominant (V)", title: "The turnaround", body: "G major — the V chord. This pulls you back to C. Randy Newman uses jazzy chords throughout, but the backbone is still I-IV-V with a shuffle. Simple ingredients, warm result.", autoPlay: true, concept_specifics: ["ii_V_I", "shuffle"] }
    ]
  },

  stand_by_me_doo_wop: {
    title: "The Doo-Wop Loop",
    song: "Stand By Me — Ben E. King",
    category: "Progressions",
    audience: "student",
    rhythm: {
      time_sig: "4/4",
      bpm: 115,
      feel: "Straight eighth",
      description: "Steady eighth notes on the bass line walking root to fifth. The kick and snare alternate on 1-2-3-4 with the backbeat on 2 and 4.",
      pattern: [
        { beat: "1", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "2", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "3", label: "KICK", type: "bass" },
        { beat: "&", label: "·",    type: "strum" },
        { beat: "4", label: "SNARE",type: "snare" },
        { beat: "&", label: "·",    type: "strum" }
      ]
    },
    steps: [
      { chord: "A", function: "tonic (I)", title: "The anchor", body: "A major. The bass line starts here and barely leaves — that walking bass IS the song. Ben E. King built one of the most famous songs ever on four chords that loop forever.", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "F#m", function: "submediant (vi)", title: "The lean", body: "F♯ minor — the vi chord. This is A major's relative minor. They share two notes, so the move feels natural, just a little more emotional. Every doo-wop group in the 50s knew this trick.", autoPlay: true, concept_specifics: ["vi_chord", "relative_major_minor"] },
      { chord: "D", function: "subdominant (IV)", title: "The lift", body: "D major — the IV chord. The progression opens up here. I→vi→IV→V is called the doo-wop progression because it's in thousands of songs from that era. And it never stopped — you'll hear it in everything from 'No Woman No Cry' to 'Someone Like You.'", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "E", function: "dominant (V)", title: "The pull back", body: "E major — the V chord. It creates tension that wants to resolve back to A. And it does, and then the whole thing loops again. Four chords. One of the greatest songs ever written.", autoPlay: true, concept_specifics: ["I_IV_V", "backbeat"] }
    ]
  },

  lean_on_me_gospel: {
    title: "The Gospel Piano",
    song: "Lean on Me — Bill Withers",
    category: "Progressions",
    audience: "student",
    rhythm: {
      time_sig: "4/4",
      bpm: 76,
      feel: "Gospel ballad",
      description: "Slow, steady, piano-driven. The left hand walks a bass line while the right hand plays chords on the offbeats. Every note breathes.",
      pattern: [
        { beat: "1", label: "BASS", type: "bass" },
        { beat: "&", label: "chord",type: "strum" },
        { beat: "2", label: "BASS", type: "bass" },
        { beat: "&", label: "chord",type: "strum" },
        { beat: "3", label: "BASS", type: "bass" },
        { beat: "&", label: "chord",type: "strum" },
        { beat: "4", label: "BASS", type: "bass" },
        { beat: "&", label: "chord",type: "strum" }
      ]
    },
    steps: [
      { chord: "C", function: "tonic (I)", title: "Simple and strong", body: "C major. The piano walks up the scale — C, D, E, F — while the right hand lays down chords. Bill Withers was a factory worker who wrote one of the most-covered songs in history. No fancy theory, just truth.", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "F", function: "subdominant (IV)", title: "The IV chord", body: "F major. I→IV is the most common chord move in all of music. In gospel, the IV chord is where the choir lifts. It feels like the room gets bigger.", autoPlay: true, concept_specifics: ["I_IV_V"] },
      { chord: "C", function: "back to I", title: "Back to earth", body: "C major again. The whole song barely leaves home. That's the power of simplicity — three chords and a walking bass line, and everyone in the room is singing along.", autoPlay: true },
      { chord: "G", function: "dominant (V)", title: "The resolve", body: "G major — the V. It pulls back to C. Lean on Me uses almost the same three chords as Folsom Prison Blues (I-IV-V), but the slow gospel piano makes it feel completely different. Same skeleton, different soul.", autoPlay: true, concept_specifics: ["I_IV_V"] }
    ]
  },

  vienna_chromatic_mediant: {
    title: "Vienna's Chromatic Heartache",
    song: "Vienna — Billy Joel",
    category: "Voice Leading",
    audience: "musician",
    seeAlso: { label: "Voice Leading", href: "/games/chord-walks" },
    rhythm: {
      time_sig: "3/4",
      bpm: 96,
      feel: "Gentle piano waltz",
      description: "A gentle piano waltz. The left hand drops a bass note on beat 1, the right hand answers with chords on beats 2 and 3. ONE-two-three, ONE-two-three — the sway that gives Vienna its aching forward motion.",
      pattern: [
        { beat: "1", label: "BASS",  type: "bass" },
        { beat: "2", label: "chord", type: "strum" },
        { beat: "3", label: "chord", type: "strum" }
      ],
      concept_specifics: ["waltz"]
    },
    steps: [
      { chord: "C",  function: "tonic (I)",              title: "Home base",                 body: "Bright C major in 3/4 time — a waltz. ONE-two-three, ONE-two-three. Let the lilt settle in before the harmony starts to move.", autoPlay: true },
      { chord: "E",  function: "chromatic mediant (III)",title: "The chromatic mediant",     body: "C major to E major — no shared notes in the triad, maximum color shift. Listen to the bass walk from C down to B to G♯. Watch how dramatic that jump is on the Tonnetz.", autoPlay: true, focus: "tonnetz", concept_specifics: ["chromatic_mediant"] },
      { chord: "Am", function: "relative minor (vi)",    title: "The resolution",            body: "E major pulls into A minor — the relative minor. Two notes change, one stays. It's an L then P chain — lean, then parallel — and it feels like the harmony finally exhales.", autoPlay: true, highlightTransform: "L", concept_specifics: ["LP_chain", "relative_major_minor"] },
      { chord: "F",  function: "subdominant (IV)",       title: "Familiar ground",           body: "F major. The IV chord softens the mood before the cycle repeats. After the drama of the chromatic mediant, this is the safest chord in the room.", autoPlay: true },
      { chord: "C",  function: "tonic, 1st inversion",   title: "Back to C — with G in the bass", body: "C/G. The bass has been walking down the whole time: C — B — A — G. That chromatic descent is what gives Vienna its aching quality. Watch the bass note on the keyboard.", autoPlay: true, focus: "keyboard", concept_specifics: ["chromatic_bass", "voice_leading"] },
      { chord: "G",  function: "dominant (V)",           title: "Tension before resolution", body: "The V chord. Tension before resolution. The whole progression is a lesson in how chromatic bass movement creates emotional pull — six chords, but your ear feels like it's been pulled through every one of them.", autoPlay: true }
    ]
  },
};

export { WALKTHROUGHS };
