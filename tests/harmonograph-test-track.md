# Harmonograph Test Track

A 2:55 deterministic synthetic audio track for tuning Harmonograph's
audio reactivity. Every section has known content — so any behavior
you don't expect is a real bug, not the music being weird.

## Files

- `harmonograph-test-track.wav` — the audio file. Drop it into
  Music.app, play it through Loopback, watch the visualizer.
- `generate_test_track.py` — the generator. Tweak section durations,
  add chords, change the loudness staircase, etc., and re-run.

## How to use

1. Import the WAV into Music.app (File → Add to Library)
2. Make sure Music is routed through your Loopback "SongLab Input"
   virtual device
3. Open Harmonograph with Loopback selected as Hardware
4. Play the track from the start
5. Watch the `signal`, `spin`, `morph` readouts at each timestamp
   below and compare against expected behavior

Section names are also visible in Music.app's track listing if you
import the per-section files separately, but the single concatenated
track is easier for one-shot testing.

## Section guide

### 00:00 — 00:15  Silence baseline (15s)

**What's playing:** absolute silence (all zeros).

**Expected:**
- `signal` = 0.00 (must be exactly zero — the new top-16 RMS should
  not produce any "noise floor" reading from a silent input)
- `spin` = 5.0 (`spinMin`)
- `morph` = 0.00
- Torus is geometrically static

**If this fails:** there's a baseline noise problem in the analyser
chain (DC offset, uninitialized buffer, etc.).

---

### 00:15 — 01:00  Loudness staircase (45s)

**What's playing:** pink noise at three RMS levels, 15 seconds each:
- 00:15 → -50 dBFS (very quiet)
- 00:30 → -30 dBFS (medium)
- 00:45 → -15 dBFS (loud)

**Expected:**
- `signal` should land at three clearly distinct **flat plateaus**
- With current defaults (`rmsDbFloor=-70`, `rmsDbCeiling=-35`):
  - -50 dBFS → signal ≈ 0.57   ((-50 - -70) / (-35 - -70) = 20/35)
  - -30 dBFS → signal ≈ 1.00   (clipped at ceiling)
  - -15 dBFS → signal ≈ 1.00   (also clipped — too loud for ceiling)
- `spin` rises with each step, then stabilizes per plateau

**Key calibration insight:** if the -30 and -15 plateaus look
identical, your ceiling is too low (most of the dynamic range is
above the ceiling). Drop `rmsDbCeiling` toward -20 or -15 and the two
will separate. Conversely if -50 reads near zero, raise `rmsDbFloor`.

**This is the section to tune the floor/ceiling against.**

---

### 01:00 — 01:03  Silence pad (3s)

Brief silence before the chord work starts.

---

### 01:03 — 01:21  Note decay panel (18s)

**What's playing:** the same C major chord (C4 E4 G4) three times,
with three different envelopes:
- 01:03 → staccato (250ms decay)
- 01:09 → piano-realistic (2s decay)
- 01:15 → organ-style sustained (20s decay)

**Expected:**
- The Tonnetz nodes for C, E, G should light up and **fade in lockstep
  with the audio**. If you can hear the chord, the nodes should be lit.
  If you can't hear it, they should be dark.
- The staccato chord should produce a brief flash on the nodes.
- The piano-normal chord should produce a graceful fade matching what
  you hear.
- The held organ chord should keep the nodes lit the entire 6 seconds.

**This is the section that diagnoses your "nodes stay lit too long"
problem.** If the staccato chord makes nodes that linger for 2+
seconds, the visual decay is hardcoded too long. If the piano-normal
chord's nodes fade faster than the audio, decay is too short.

The fix lives in HarmonyState (or wherever node opacity is managed),
not the audio path.

---

### 01:21 — 01:25  Silence pad (4s)

---

### 01:25 — 01:54  Tempo cycle (29s)

**What's playing:** the progression I-IV-V-I (C-F-G-C) at three
tempos:
- 01:25 → 60 BPM (4 sec per chord, very slow)
- 01:41 → 120 BPM (2 sec per chord, medium)
- 01:49 → 180 BPM (1.33 sec per chord, fast)

**Expected:**
- Tonnetz highlights should follow the chord changes crisply at all
  three tempos
- C major triangle highlighted on beat 1 of measures 1/4
- F major on measure 2, G major on measure 3
- At 180 BPM, transitions should still be readable — not muddy

**This diagnoses chord-detection latency.** If the 180 BPM section
looks like one continuous blur, your chord decay is longer than the
chord duration.

---

### 01:54 — 01:56  Silence pad (2s)

---

### 01:56 — 02:41  Chord vocabulary (45s)

**What's playing:** 9 chord types built on C, 5 seconds each:

| Time   | Chord  | Notes                |
|--------|--------|----------------------|
| 01:56  | Cmaj   | C E G                |
| 02:01  | Cmin   | C Eb G               |
| 02:06  | Cdim   | C Eb Gb              |
| 02:11  | Caug   | C E G#               |
| 02:16  | Csus4  | C F G                |
| 02:21  | Cmaj7  | C E G B              |
| 02:26  | C7     | C E G Bb             |
| 02:31  | Cmin7  | C Eb G Bb            |
| 02:36  | Cdim7  | C Eb Gb A            |

**Expected:**
- Each chord type should produce a recognizably different visual
  signature on the Tonnetz
- For your new extended chord type system: the seventh-chord types
  (Cmaj7, C7, Cmin7, Cdim7) should show the additive seventh node
  with dashed connector to the triad
- Aug and Dim should render as line shapes per your design notes
- Sus4 should render as line shape

**This exercises the April chord-system extensions specifically.**

---

### 02:41 — 02:43  Silence pad (2s)

---

### 02:43 — 02:55  Realistic progression (12s)

**What's playing:** vi-IV-I-V (Am-F-C-G) with proper voice leading,
80 BPM. The "axis of awesome" 4-chord progression. 3 second per chord.

Voicings:
- Am: A3 C4 E4
- F:  F3 A3 C4
- C:  C4 E4 G4
- G:  G3 B3 D4

**Expected:**
- Smooth visual transitions following voice leading (each chord shares
  notes with the next)
- Tonnetz highlights move along the canonical orientation in
  predictable directions
- This is the **aesthetic check** — "does it look beautiful when
  music does what music normally does?"

If the previous sections all passed but this one looks chaotic, the
problem is in transition smoothing or visual chord-change handling.

---

## Calibration workflow

A suggested order to walk through during a tuning session:

1. **Section 1 (silence):** confirm baseline = 0
2. **Section 2 (staircase):** adjust `rmsDbFloor` and `rmsDbCeiling`
   in the panel until the three plateaus are visually distinct and
   span a useful range of `signal`. Save preset.
3. **Section 3 (decay panel):** adjust HarmonyState node decay until
   visual fade matches audio fade. (May require code change, not just
   panel tuning.)
4. **Section 4 (tempo cycle):** confirm chord transitions are crisp
   at all three tempos.
5. **Sections 5–6:** aesthetic / vocabulary checks. If the first
   four passed, these should look right by default.

After all five steps pass on the test track, run a real song
(Montreal, Welcome to the Jungle, etc.) as a final sanity check.

## Regenerating

The track is reproducible — `np.random.seed(42)` is fixed in the
generator, so the pink noise sections come out byte-identical every
run. Modify `generate_test_track.py` and re-run to add/remove
sections, change durations, etc.
