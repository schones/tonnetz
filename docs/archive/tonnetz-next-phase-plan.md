# Tonnetz — Next Phase Plan

## 1. Walkthroughs + Skratch Exports for All Songs

### Current State
- 73 songs in `song-examples.js` across 7 categories
- Walkthrough system proven (overlay bubble, step-through, auto-record)
- Export to Skratch Studio working (sessionStorage → new tab → block chain)
- Walkthrough bubble is now draggable, persistent, has back button and export link

### What Each Song Needs
Every entry in `song-examples.js` must have:
- `chords`: array of `{root, quality}` — most already have this
- `key`: tonal center — most already have this
- `tempo`: BPM for playback timing — may be missing from some entries
- `walkthrough_text`: per-chord annotation (e.g., "Notice the minor → major shift here") — **this is the new work**

### Implementation Plan
1. **Audit song-examples.js** — which entries have enough data vs. which need enrichment
2. **Build a walkthrough generator** — given a song's chord array, auto-generate the walkthrough overlay steps. The annotations can start generic ("Step 2: C Major — the relative major") and be hand-tuned for featured songs
3. **Auto-generate Skratch export** — already works; every walkthrough implicitly has an exportable sequence
4. **Song detail page pattern** — each song gets a URL like `/songs/stairway-to-heaven` that loads Explorer with the walkthrough pre-configured. Can be auto-generated from the DB

### Scaling Strategy
- **Batch 1 (manual):** Hand-curate walkthroughs for 10-15 flagship songs with rich annotations
- **Batch 2 (semi-auto):** Use the generator for remaining 58+ songs with generic annotations
- **Ongoing:** New songs added to `song-examples.js` automatically get basic walkthroughs; rich annotations added over time

### Claude Code Prompt (when ready)
```
Audit song-examples.js: for each of the 73 entries, report which have
complete chord progressions (array of root+quality) vs. which are missing
data. Output a summary table: song title, category, has_chords (y/n),
has_key (y/n), has_tempo (y/n), number of chords.
```

---

## 2. Song Packs Architecture

### Concept
A **free core** of songs/games/tools available to everyone, plus **add-on packs** that unlock additional content. Packs are curated collections, not just more songs — they include pedagogical framing, difficulty progression, and genre-specific annotations.

### Pack Structure
```
/static/packs/
  core.json          ← free, ships with platform
  classic-rock.json
  jazz-standards.json
  americana.json
  kids-songs.json
  pop-hits.json
```

Each pack JSON:
```json
{
  "id": "classic-rock",
  "name": "Classic Rock Harmony",
  "description": "From power chords to prog — 25 songs that shaped rock harmony",
  "difficulty": "intermediate",
  "audience": ["curious_player", "deep_diver"],
  "songs": [
    {
      "title": "Stairway to Heaven",
      "artist": "Led Zeppelin",
      "key": "Am",
      "tempo": 72,
      "chords": [...],
      "walkthrough_annotations": [...],
      "concepts_introduced": ["minor_key_movement", "chromatic_ascent"],
      "related_songs": ["classic-rock/house-of-the-rising-sun"]
    }
  ],
  "learning_path": {
    "order": ["stairway-to-heaven", "house-of-the-rising-sun", ...],
    "milestones": [
      { "after": 5, "unlocks": "Minor key mastery badge" }
    ]
  }
}
```

### Core (Free) Pack
~12-15 songs covering:
- Simple major key progressions (I-IV-V-I)
- Simple minor key (i-iv-v)
- Common pop patterns (I-V-vi-IV)
- One or two "wow" songs that showcase the Tonnetz (Coltrane changes, Giant Steps)
- Kid-friendly songs with simple harmony

### Kids Pack Design
- Simpler visual language (larger blocks, fewer options)
- Songs kids know (nursery rhymes, movie themes — copyright check needed)
- Game-first entry (Scale Builder mascot as guide)
- Shorter walkthroughs (3-4 chords max)
- The eighth-note mascot from Scale Builder becomes the pack's character

### Monetization (Future)
- Free tier = core pack + all tools/Explorer/games
- Paid packs = $3-5 each or $15/year for all
- Teachers get bulk/classroom pricing
- Free tier is the distribution engine — never paywall the tools

### Technical Implementation
1. Pack loader in JS that merges pack songs into the existing `song-examples.js` registry
2. Pack selector UI (dropdown or settings page)
3. Songs reference their pack ID for filtering
4. Walkthroughs, Skratch export, landing page examples all pull from the merged registry
5. Supabase (Phase B.5) stores which packs a user has access to

---

## 3. Copyright Considerations

### What's Generally Safe
- **Chord progressions**: Not copyrightable in the US. Melody + lyrics are protected; harmonic structure alone is not. (See: *Skidmore v. Led Zeppelin*, 2020 — confirmed chord progressions aren't protectable.)
- **Functional analysis**: Teaching "this song uses a I-V-vi-IV progression" is factual/educational.
- **Song titles**: Generally not copyrightable on their own, but trademark issues can arise with very distinctive titles.
- **Your annotations and walkthrough text**: 100% yours.

### What Needs Caution
- **Lyrics**: Never include lyrics. Not even one line.
- **Melody transcription**: Don't include melodic notation — stick to chords only.
- **Audio samples**: The Salamander piano playing chord progressions is fine (you're generating audio, not sampling recordings). Never use recorded audio from copyrighted songs.
- **Album art / artist photos**: Don't include.
- **Specific arrangements**: If you transcribe a specific guitar voicing from a recording, that gets closer to arrangement copyright. Stick to basic chord symbols.

### Safe Framing Pattern
For each song, use:
- Song title + artist name (factual reference)
- Key and tempo (factual)
- Chord progression in symbols (Am - C - G - D) — not copyrightable
- Your original walkthrough annotations and pedagogical text
- Link to listen on Spotify/Apple Music (drives traffic to rights holders)

### What to Avoid
- "Play along" features synced to recordings
- Tablature of specific solos or riffs (arrangement territory)
- Reproducing sheet music
- Any claim of affiliation with artists

### For Kids Pack Specifically
- Nursery rhymes / traditional songs (pre-copyright) = totally safe
- Disney / modern movie songs = avoid unless licensing
- Folk / public domain = goldmine (This Land Is Your Land post-2020, Happy Birthday, etc.)

### Recommended Action
- For MVP: proceed with chord progressions + educational framing. This is well within established practice (every guitar tab site, every music theory textbook does this).
- Before commercializing packs: 30-minute consult with an IP attorney to confirm the specific implementation is clean. Budget ~$300-500.
- Include a "Listen on Spotify" link for every song — positions you as complementary to the music industry, not competitive.

---

## 4. Aesthetics Rethink

### Current State
- Dark theme, developer-oriented aesthetic
- Functional but not "friendly"
- Eighth-note mascot exists (Scale Builder) but isn't platform-wide
- Color scheme is functional (chord quality colors on Tonnetz) but overall palette feels cold

### Design Principles for Rethink
1. **Friendly, not childish** — approachable for beginners and kids without alienating serious musicians
2. **The Tonnetz is the hero** — everything should frame and highlight the visualization, not compete with it
3. **Instrument-warm palette** — think wood tones, warm whites, subtle gradients. Piano keys, guitar necks, brass.
4. **Light theme as default** — with dark mode toggle for nighttime/stage use

### Specific Ideas

#### Color Palette
- Background: warm off-white (#FAFAF5 range) or very light warm gray
- Accents: deep warm blue (#2D5F8A), amber/gold (#D4A03C), soft coral (#E87461)
- Tonnetz chord colors: keep current system but bump saturation slightly on light background
- Text: warm dark (#2C2C2C), not pure black

#### Typography
- Rounded sans-serif for headings (e.g., Nunito, Quicksand, Poppins)
- Clean readable body font (Inter, Source Sans)
- Larger base font size for accessibility

#### Layout
- More whitespace and breathing room
- Rounded corners on cards and panels
- Subtle shadows instead of hard borders
- The Explorer panels could have a slight "paper on desk" aesthetic

#### Mascot / Brand
- Eighth-note mascot from Scale Builder as platform-wide companion
- Appears in onboarding, empty states, achievements, loading screens
- 8 expressions already built — expand to context-specific reactions
- Name the mascot? Makes it more memorable for kids

#### Light/Dark Toggle
- Light = default
- Dark = toggle in nav (icon)
- Both themes share the same accent colors, just swap background/text
- Tonnetz visualization may need per-theme tuning (glow effects look better on dark)

### Implementation Approach
1. **Design exploration first** — create 2-3 mockup screenshots (landing page, Explorer, Skratch Studio) before writing CSS
2. **CSS custom properties** — you're likely already using some; centralize into a theme file
3. **Theme toggle** — `data-theme="light|dark"` on `<body>`, CSS variables swap
4. **Incremental rollout** — start with landing page + Explorer, then propagate

### Quick Win
Before a full rethink, try just these three changes and see how it feels:
- Swap to a warm off-white background
- Switch heading font to Nunito or Poppins
- Add border-radius: 12px to all cards/panels

---

## Suggested Priority Order

1. **Audit song DB** — quick, informs everything else (30 min)
2. **Walkthrough generator** — automate basic walkthroughs for all 73 songs (half day)
3. **Aesthetics quick win** — try the three CSS changes, see if direction feels right (1 hour)
4. **Pack architecture** — design the JSON schema and loader (half day)
5. **Full aesthetics rethink** — mockups → implementation (multi-session)
6. **Kids pack content** — curate songs, write annotations (ongoing)
7. **Copyright consult** — before any paid packs launch
