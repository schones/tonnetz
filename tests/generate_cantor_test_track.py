"""
Cantor positive-control test track generator.

Generates a deterministic WAV file for diagnosing Cantor's chord
identification and melody constellation behavior. Three diagnostic
lenses:

  Section 1 — Chord identification (no melody).
              Pure accompaniment in C3–C5, four progressions covering
              major / minor / sevenths / modal vocabulary.

  Section 2 — Melody isolation (no chords).
              Pure melody, all notes strictly above C5 (the default
              _splitPoint = MIDI 72). Stepwise + leaps + sustains.

  Section 3 — Combined.
              Two passes per bed (chord tones only, then mixed with
              non-chord tones) over two different chord beds:
              I-vi-IV-V in C major and ii-V-I-style sevenths in F.

Total: ~3 minutes.

Run:
    python generate_cantor_test_track.py

Output:
    cantor-test-track.wav
"""

import os
import numpy as np
from scipy.io import wavfile

SAMPLE_RATE = 44100
OUTPUT_PATH = os.environ.get(
    "CANTOR_TEST_TRACK_OUT",
    "/home/claude/cantor-test-track.wav",
)

np.random.seed(42)  # determinism (no noise in this track, but keep parity)

# Default Cantor melody/accompaniment split point (MIDI). Anything strictly
# above this enters the constellation; at-or-below feeds chord detection.
SPLIT_POINT = 72  # C5


# ---------------------------------------------------------------------------
# Primitives (adapted from the harmonograph generator)
# ---------------------------------------------------------------------------

def silence(duration_s):
    return np.zeros(int(duration_s * SAMPLE_RATE))


def midi_to_freq(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def piano_note(freq, duration_s, decay_s=2.0, attack_ms=8):
    """Synthesize a piano-like note: harmonic series with ADSR envelope."""
    n = int(duration_s * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    harmonics = [(1, 1.00), (2, 0.55), (3, 0.30), (4, 0.18),
                 (5, 0.10), (6, 0.06), (7, 0.03)]
    sig = np.zeros(n)
    for h, amp in harmonics:
        if freq * h < SAMPLE_RATE / 2:
            sig += amp * np.sin(2 * np.pi * freq * h * t)
    sig /= sum(a for _, a in harmonics)
    env = np.ones(n)
    a_n = min(int(attack_ms / 1000.0 * SAMPLE_RATE), n)
    env[:a_n] = np.linspace(0, 1, a_n)
    if decay_s > 0:
        decay_curve = np.exp(-np.arange(n - a_n) / (decay_s * SAMPLE_RATE))
        env[a_n:] = decay_curve
    return sig * env


def chord(midi_notes, duration_s, decay_s=2.5):
    """Sum a set of MIDI notes into a piano-voiced chord."""
    s = np.zeros(int(duration_s * SAMPLE_RATE))
    for m in midi_notes:
        s += piano_note(midi_to_freq(m), duration_s, decay_s)
    return s / max(len(midi_notes), 1)


def progression(chords, bpm, beats_per_chord=4, decay_ratio=0.8):
    """Play a list of chords at a given tempo, end-to-end."""
    sec_per_beat = 60.0 / bpm
    chord_dur = beats_per_chord * sec_per_beat
    parts = [chord(c, chord_dur, decay_s=chord_dur * decay_ratio)
             for c in chords]
    return np.concatenate(parts)


def melody_line(notes, total_duration_s, decay_s=0.4):
    """Render a melody as a sequence of (midi_or_None, duration_s) pairs.

    `notes` is a list of (midi, dur) tuples. `midi=None` means a rest.
    The total of all durs should equal total_duration_s; we don't enforce
    this strictly but warn if off by more than 50ms.
    """
    parts = []
    actual_total = 0.0
    for midi, dur in notes:
        if midi is None:
            parts.append(silence(dur))
        else:
            parts.append(piano_note(midi_to_freq(midi), dur, decay_s=decay_s))
        actual_total += dur
    if abs(actual_total - total_duration_s) > 0.05:
        print(f"  ! melody_line duration mismatch: "
              f"requested {total_duration_s:.2f}s, got {actual_total:.2f}s")
    return np.concatenate(parts)


def mix(*tracks):
    """Sum tracks of (possibly different) lengths, padding with silence."""
    n = max(len(t) for t in tracks)
    out = np.zeros(n)
    for t in tracks:
        out[:len(t)] += t
    # Average so combined doesn't clip relative to single tracks
    return out / len(tracks)


# ---------------------------------------------------------------------------
# Pitch helpers — short MIDI constants for readability
# ---------------------------------------------------------------------------

# Chord-bed register (C3–C5)
C3, D3, E3, F3, G3, A3, B3 = 48, 50, 52, 53, 55, 57, 59
Ab3, Bb3, Eb3 = 56, 58, 51
Gs3 = 56  # G#3 = Ab3
C4, D4, E4, F4, G4, A4, B4 = 60, 62, 64, 65, 67, 69, 71
Eb4, Ab4, Bb4 = 63, 68, 70
C5 = 72

# Melody register (above C5)
D5, E5, F5, G5, A5, B5 = 74, 76, 77, 79, 81, 83
Bb5, Ab5 = 82, 80
C6, D6, E6 = 84, 86, 88


# ---------------------------------------------------------------------------
# Build the track
# ---------------------------------------------------------------------------

sections = []

# ── SECTION 1: Chord identification probe (no melody) ─────────────────

# 1a. Diatonic in C major (I-vi-IV-V), 80 BPM, 3s per chord = 12s
sections.append(("01a_diatonic_C_major", progression(
    [
        [C4, E4, G4],     # C
        [A3, C4, E4],     # Am
        [F3, A3, C4],     # F
        [G3, B3, D4],     # G
    ], bpm=80
)))

# 1b. Diatonic in A minor (i-iv-V-i, harmonic minor), 80 BPM, 3s per chord = 12s
sections.append(("01b_diatonic_A_minor", progression(
    [
        [A3, C4, E4],     # Am
        [D4, F4, A4],     # Dm
        [E3, Gs3, B3],    # E (major V via raised 3rd)
        [A3, C4, E4],     # Am
    ], bpm=80
)))

# 1c. Sevenths in F (Imaj7-vi7-V7-Imaj7 home), 80 BPM, 3s per chord = 12s
sections.append(("01c_sevenths_F", progression(
    [
        [F3, A3, C4, E4],   # Fmaj7
        [D4, F4, A4, C5],   # Dm7
        [G3, B3, D4, F4],   # G7
        [C4, E4, G4, B4],   # Cmaj7
    ], bpm=80
)))

# 1d. Modal C minor (i-VI-III-VII), 70 BPM, ~3.43s per chord = ~13.7s
sections.append(("01d_modal_C_minor", progression(
    [
        [C4, Eb4, G4],     # Cm
        [Ab3, C4, Eb4],    # Ab
        [Eb4, G4, Bb4],    # Eb
        [Bb3, D4, F4],     # Bb
    ], bpm=70
)))

# Silence pad
sections.append(("01_silence_pad", silence(2)))

# ── SECTION 2: Melody isolation probe (no chords) ─────────────────────

# 2a. Stepwise ascent — six quarter notes at 60 BPM (1s each) = 6s
sections.append(("02a_stepwise_ascent", melody_line(
    [(D5, 1.0), (E5, 1.0), (F5, 1.0), (G5, 1.0), (A5, 1.0), (B5, 1.0)],
    total_duration_s=6.0,
    decay_s=0.4,
)))

# 2b. Stepwise descent with held final note (~6s)
# Five short notes (0.7s each = 3.5s) + one held (2s with long decay) + tail (0.5s)
# Total = 3.5 + 2.5 = 6s
sections.append(("02b_stepwise_descent_held", np.concatenate([
    melody_line(
        [(B5, 0.7), (A5, 0.7), (G5, 0.7), (F5, 0.7), (E5, 0.7)],
        total_duration_s=3.5,
        decay_s=0.4,
    ),
    piano_note(midi_to_freq(D5), 2.5, decay_s=2.0),
])))

# 2c. Leaps with rests — five notes with 0.5s rests between, ~10s
# Each note 1.5s, four rests of 0.5s = 5*1.5 + 4*0.5 = 7.5 + 2.0 = 9.5s
# Pad slight bit: stretch last note to 2.0s → total 10s
sections.append(("02c_leaps_with_rests", melody_line(
    [
        (G5, 1.5), (None, 0.5),
        (C6, 1.5), (None, 0.5),
        (E5, 1.5), (None, 0.5),
        (A5, 1.5), (None, 0.5),
        (D6, 2.0),
    ],
    total_duration_s=10.0,
    decay_s=0.6,
)))

# 2d. Sustained single G5 with long decay — 6s
sections.append(("02d_sustained_G5", piano_note(
    midi_to_freq(G5), 6.0, decay_s=5.0
)))

# Silence pad
sections.append(("02_silence_pad", silence(2)))

# ── SECTION 3.1: Combined — I-vi-IV-V in C ─────────────────────────────
# Two passes, each ~24s (4 bars × 3s/bar at 80 BPM)
# Each bar's melody: half-note + quarter + quarter = 1.5s + 0.75s + 0.75s = 3s

C_bed = [
    [C4, E4, G4],     # C
    [A3, C4, E4],     # Am
    [F3, A3, C4],     # F
    [G3, B3, D4],     # G
]

# Pass 1: chord tones only
melody_C_pass1 = [
    # Bar 1 (C): E5 - G5 - C6
    (E5, 1.5), (G5, 0.75), (C6, 0.75),
    # Bar 2 (Am): E5 - A5 - C6
    (E5, 1.5), (A5, 0.75), (C6, 0.75),
    # Bar 3 (F): F5 - A5 - C6
    (F5, 1.5), (A5, 0.75), (C6, 0.75),
    # Bar 4 (G): D5 - G5 - B5
    (D5, 1.5), (G5, 0.75), (B5, 0.75),
]
sections.append(("03_1_combined_C_pass1_chordtones", mix(
    progression(C_bed, bpm=80),
    melody_line(melody_C_pass1, total_duration_s=12.0, decay_s=0.5),
)))

# Pass 2: chord tones + non-chord tones (passing, neighbor, suspension)
melody_C_pass2 = [
    # Bar 1 (C): E5 - F5(pass) - G5
    (E5, 1.5), (F5, 0.75), (G5, 0.75),
    # Bar 2 (Am): A5 - B5(upper neighbor) - A5
    (A5, 1.5), (B5, 0.75), (A5, 0.75),
    # Bar 3 (F): C6 - D6(upper neighbor) - C6
    (C6, 1.5), (D6, 0.75), (C6, 0.75),
    # Bar 4 (G): F5(sus/7th) - E5(pass) - D5
    (F5, 1.5), (E5, 0.75), (D5, 0.75),
]
sections.append(("03_1_combined_C_pass2_mixed", mix(
    progression(C_bed, bpm=80),
    melody_line(melody_C_pass2, total_duration_s=12.0, decay_s=0.5),
)))

# Silence pad
sections.append(("03_1_silence_pad", silence(2)))

# ── SECTION 3.2: Combined — Sevenths in F ──────────────────────────────

F7_bed = [
    [F3, A3, C4, E4],   # Fmaj7
    [D4, F4, A4, C5],   # Dm7
    [G3, B3, D4, F4],   # G7
    [C4, E4, G4, B4],   # Cmaj7
]

# Pass 1: chord tones only
melody_F_pass1 = [
    # Bar 1 (Fmaj7): A5 - C6 - E6
    (A5, 1.5), (C6, 0.75), (E6, 0.75),
    # Bar 2 (Dm7): D5 - F5 - A5
    (D5, 1.5), (F5, 0.75), (A5, 0.75),
    # Bar 3 (G7): D5 - F5 - B5
    (D5, 1.5), (F5, 0.75), (B5, 0.75),
    # Bar 4 (Cmaj7): E5 - G5 - B5
    (E5, 1.5), (G5, 0.75), (B5, 0.75),
]
sections.append(("03_2_combined_F7_pass1_chordtones", mix(
    progression(F7_bed, bpm=80),
    melody_line(melody_F_pass1, total_duration_s=12.0, decay_s=0.5),
)))

# Pass 2: chord tones + non-chord tones
melody_F_pass2 = [
    # Bar 1 (Fmaj7): A5 - Bb5(passing) - C6
    (A5, 1.5), (Bb5, 0.75), (C6, 0.75),
    # Bar 2 (Dm7): F5 - E5(passing) - D5
    (F5, 1.5), (E5, 0.75), (D5, 0.75),
    # Bar 3 (G7): F5(b7) - A5(9th, soft outside) - G5
    (F5, 1.5), (A5, 0.75), (G5, 0.75),
    # Bar 4 (Cmaj7): B5(maj7) - C6(4th/avoid) - B5
    (B5, 1.5), (C6, 0.75), (B5, 0.75),
]
sections.append(("03_2_combined_F7_pass2_mixed", mix(
    progression(F7_bed, bpm=80),
    melody_line(melody_F_pass2, total_duration_s=12.0, decay_s=0.5),
)))

# ---------------------------------------------------------------------------
# Assemble + export
# ---------------------------------------------------------------------------

cursor = 0.0
print("Section timestamps:")
print("-" * 70)
for name, audio in sections:
    dur = len(audio) / SAMPLE_RATE
    mm, ss = divmod(cursor, 60)
    print(f"  {int(mm):02d}:{ss:05.2f}  +{dur:5.2f}s  {name}")
    cursor += dur
print("-" * 70)
print(f"Total duration: {cursor:.2f}s ({cursor/60:.2f} min)")

audio = np.concatenate([s for _, s in sections])

# Peak-normalize to -1 dBFS
peak = np.max(np.abs(audio))
if peak > 0:
    audio *= (10 ** (-1 / 20.0)) / peak

stereo = np.stack([audio, audio], axis=1)
pcm = (stereo * 32767).astype(np.int16)
wavfile.write(OUTPUT_PATH, SAMPLE_RATE, pcm)
print(f"\nWrote {OUTPUT_PATH}")
print(f"Size: {pcm.nbytes / 1024 / 1024:.2f} MB")
