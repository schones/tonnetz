# Cantor Test Track

A ~2:12 deterministic synthetic audio track for diagnosing Cantor's
chord identification and melody constellation behavior. Three
diagnostic lenses: chord-only, melody-only, and combined.

## Files

- `cantor-test-track.wav` — the audio file. Drop into Music.app and
  play through Loopback (same setup as the harmonograph test track).
- `generate_cantor_test_track.py` — the generator. Deterministic
  (seeded, no randomness in the output). Modify and re-run to tweak
  any section.

## Setup assumption

The track assumes Cantor's default melody/accompaniment split point:
**`_splitPoint = 72` (C5)**. Notes strictly above C5 enter the melody
constellation; notes at or below C5 feed chord detection only. The
track honors this strictly:

- Chord-bed voicings live in C3–C5 (top voice = C5 max).
- Melody lines live entirely above C5 (D5 minimum, D6 maximum).

If you've changed the split point via `cantorView.setSplitPoint(n)`,
some sections may behave differently than described below.

## How to use

1. Import the WAV into Music.app (File → Add to Library).
2. Make sure Music is routed through your Loopback "SongLab Input"
   virtual device.
3. Open `/cantor` with Loopback selected as Hardware.
4. Play the track from the start.
5. Watch the wash and constellation behavior at each timestamp below
   and compare against expected.

## Section guide

### 00:00 – 00:50 — Section 1: Chord identification probe (no melody)

**Purpose:** Test chord detection in isolation. No notes above C5,
so the melody constellation should remain entirely empty for the
duration of this section.

**1a. Diatonic in C major (00:00 – 00:12)**
`C – Am – F – G` (I-vi-IV-V), 80 BPM, 3s per chord.

**1b. Diatonic in A minor (00:12 – 00:24)**
`Am – Dm – E – Am` (i-iv-V-i, raised 3rd on the V), 80 BPM, 3s per chord.

**1c. Sevenths in F (00:24 – 00:36)**
`Fmaj7 – Dm7 – G7 – Cmaj7`, 80 BPM, 3s per chord.

**1d. Modal C minor (00:36 – 00:50)**
`Cm – Ab – Eb – Bb` (i-VI-III-VII, borrowed-chord feel), 70 BPM,
~3.4s per chord.

**Expected during Section 1:**
- Wash highlights move on each chord change, tracking the chord
  identity (correct triangle on the Tonnetz for major/minor, with the
  appropriate seventh extension for 1c).
- Melody constellation stays **completely empty** the whole time.
- No glyphs above C5 should appear.

**If chord wash is wrong here, it's a chord-detection problem** —
not a melody problem, not a constellation problem. Diagnose chord-ID
before moving on.

**Silence pad: 00:50 – 00:52**

---

### 00:52 – 01:20 — Section 2: Melody isolation probe (no chords)

**Purpose:** Test the melody constellation in isolation. No chord
content, so the wash should remain empty (or at the previous decayed
state) throughout this section.

**2a. Stepwise ascent (00:52 – 00:58)**
Six quarter notes at 60 BPM: `D5 – E5 – F5 – G5 – A5 – B5`, 1s each,
short attacks (~0.4s decay).

Diagnostic: do six melody nodes light up in sequence? Or only the
last? Or none? This is the "do melody events reach the constellation
at all" check.

**2b. Stepwise descent with held final note (00:58 – 01:04)**
Five short notes (`B5 – A5 – G5 – F5 – E5`, 0.7s each), then a held
`D5` with 2s decay.

Diagnostic: does the held note's constellation node persist longer
than the short notes' nodes? This tests whether note duration /
envelope is being passed through correctly.

**2c. Leaps with rests (01:04 – 01:14)**
Five notes with 0.5s rests between them: `G5 — C6 — E5 — A5 — D6`.

Diagnostic: are the rests actually visible as gaps in the
constellation, or do nodes blur together?

**2d. Sustained G5 (01:14 – 01:20)**
Single G5 held for 6s with very long decay (~5s).

Diagnostic: does a single melody node persist correctly through a
long sustain? Does it fade naturally as the audio decays?

**Expected during Section 2:**
- The wash should be empty (or finishing its decay from Section 1).
- Constellation nodes should appear and decay in sync with what
  you hear.

**If melody nodes don't light up here, the bug is in the melody
event path** — either `MusicalEventStream` not emitting events,
`_onMusicalEvent` not receiving them, or the constellation render
not honoring `_melodyNotes` entries. Section 2 isolates this from
chord detection so you can diagnose without confound.

**Silence pad: 01:20 – 01:22**

---

### 01:22 – 01:46 — Section 3.1: Combined, I-vi-IV-V in C

**Purpose:** Test integrated wash + constellation behavior over a
familiar progression. Two passes show the difference between
"melody is only chord tones" and "melody includes non-chord tones."

**Chord bed:** `C – Am – F – G` (same voicings as 1a), 80 BPM,
3s per chord.

**Pass 1 (01:22 – 01:34): chord tones only**

| Bar | Chord | Melody              | Notes        |
|-----|-------|---------------------|--------------|
| 1   | C     | E5 – G5 – C6        | All ✓        |
| 2   | Am    | E5 – A5 – C6        | All ✓        |
| 3   | F     | F5 – A5 – C6        | All ✓        |
| 4   | G     | D5 – G5 – B5        | All ✓        |

Every melody note belongs to the underlying chord. If the constellation
filters by chord membership somewhere it shouldn't, this pass would
hide the bug.

**Pass 2 (01:34 – 01:46): chord tones + non-chord tones**

| Bar | Chord | Melody              | Non-chord-tone analysis        |
|-----|-------|---------------------|--------------------------------|
| 1   | C     | E5 – F5 – G5        | F5 = passing tone              |
| 2   | Am    | A5 – B5 – A5        | B5 = upper neighbor            |
| 3   | F     | C6 – D6 – C6        | D6 = upper neighbor            |
| 4   | G     | F5 – E5 – D5        | F5 = sus/7th, E5 = passing     |

The non-chord tones are landing on beats 2 and (in bar 4) beats 2+3.
If the constellation lights up on F5, B5, D6, F5+E5 — at non-wash
positions on the torus — that's correct behavior. If it only lights
up on the chord tones, or stays dark on the non-chord tones, that's
diagnostic.

**Expected during Section 3.1:**
- Wash follows chord changes (same as 1a).
- Constellation lights up on every melody note in pass 1 (chord
  tones) and **also** on the non-chord tones in pass 2.
- In pass 2, non-chord-tone glyphs should land on torus vertices
  that are NOT the current wash vertices.

**Silence pad: 01:46 – 01:48**

---

### 01:48 – 02:12 — Section 3.2: Combined, sevenths in F

**Purpose:** Same pattern as 3.1, but over a richer chord vocabulary
(sevenths instead of triads) to exercise the chord-identification
path more thoroughly under combined conditions.

**Chord bed:** `Fmaj7 – Dm7 – G7 – Cmaj7` (same voicings as 1c),
80 BPM, 3s per chord.

**Pass 1 (01:48 – 02:00): chord tones only**

| Bar | Chord  | Melody              |
|-----|--------|---------------------|
| 1   | Fmaj7  | A5 – C6 – E6        |
| 2   | Dm7    | D5 – F5 – A5        |
| 3   | G7     | D5 – F5 – B5        |
| 4   | Cmaj7  | E5 – G5 – B5        |

All chord-tone (B5 is the maj7 of Cmaj7, F5 is the b7 of G7, etc.).

**Pass 2 (02:00 – 02:12): chord tones + non-chord tones**

| Bar | Chord  | Melody              | Non-chord-tone analysis     |
|-----|--------|---------------------|-----------------------------|
| 1   | Fmaj7  | A5 – Bb5 – C6       | Bb5 = passing tone          |
| 2   | Dm7    | F5 – E5 – D5        | E5 = passing tone           |
| 3   | G7     | F5 – A5 – G5        | A5 = 9th (soft outside)     |
| 4   | Cmaj7  | B5 – C6 – B5        | C6 = 4th/avoid tone         |

**Expected during Section 3.2:**
- Same wash behavior as 1c (the chord-detection should pick up the
  full seventh chords if it can).
- Same constellation behavior as 3.1: lights up on every melody
  note, with non-chord tones landing on non-wash vertices.

---

## Diagnostic decision tree

If something looks wrong, walk through this:

| Symptom | Likely cause |
|---------|--------------|
| Section 1 wash is wrong | Chord detection bug; nothing to do with melody |
| Section 2 produces no constellation | Melody event path broken upstream of cantor-view (`MusicalEventStream`?) |
| Section 2 produces constellation but in wrong positions | Constellation rendering / vertex resolution |
| Section 2 nodes don't decay (or decay wrong) | Note envelope / `_melodyNotes` lifetime |
| Section 3.1 wash works, 3.2 wash doesn't | Chord ID can't handle sevenths under simultaneous melody |
| Section 3.1 pass 1 fine, pass 2 missing non-chord-tones | Chord-membership filter in melody path (a bug if so) |
| Section 3 wash is fine but constellation drops out | Melody path is being suppressed when chord wash is active |

## Regenerating

```
python generate_cantor_test_track.py
```

Output goes to `cantor-test-track.wav` in the cwd (or set
`CANTOR_TEST_TRACK_OUT=/path/to/output.wav` to override).
