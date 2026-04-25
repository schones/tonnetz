"""
Harmonograph positive-control test track generator.

Generates a deterministic WAV file with known audio characteristics for
tuning Harmonograph's audio reactivity. Each section has predictable
amplitude, harmonic content, and timing — so any deviation from expected
visualizer behavior is a real bug, not a quirk of the music.

Sections:
  1. Silence baseline                  (15s)   — verify signal=0
  2. Loudness staircase (pink noise)   (45s)   — verify RMS dynamic range
  3. Note decay panel (C major chord)  (28s)   — verify node persistence
  4. Tempo cycle (I-IV-V-I, 3 BPMs)    (~30s)  — verify chord transitions
  5. Chord vocabulary (9 types on C)   (45s)   — verify chord detection
  6. Realistic progression (vi-IV-I-V) (~16s)  — visual aesthetic check

Total: ~3 minutes

Run:
    python generate_test_track.py
"""

import numpy as np
from scipy.io import wavfile

SAMPLE_RATE = 44100
OUTPUT_PATH = "/mnt/user-data/outputs/harmonograph-test-track.wav"

np.random.seed(42)  # determinism — same noise pattern every run


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

def silence(duration_s):
    return np.zeros(int(duration_s * SAMPLE_RATE))


def pink_noise(duration_s, target_dbfs):
    """Pink (1/f) noise scaled to a precise RMS dBFS level.

    Pink noise has a flatter perceptual spectrum than white — closer to
    real music — making it a more honest test of broadband RMS detection.
    """
    n = int(duration_s * SAMPLE_RATE)
    white = np.random.randn(n)
    spectrum = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1.0 / SAMPLE_RATE)
    freqs[0] = 1.0  # avoid div by zero at DC
    spectrum /= np.sqrt(freqs)
    pink = np.fft.irfft(spectrum, n=n)

    # Rescale to exact target RMS
    actual_rms = np.sqrt(np.mean(pink ** 2))
    target_rms = 10 ** (target_dbfs / 20.0)
    pink *= target_rms / actual_rms

    # Brief fade in/out to prevent click at section boundaries (50 ms)
    fade_n = int(0.05 * SAMPLE_RATE)
    pink[:fade_n] *= np.linspace(0, 1, fade_n)
    pink[-fade_n:] *= np.linspace(1, 0, fade_n)
    return pink


def midi_to_freq(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def piano_note(freq, duration_s, decay_s=2.0, attack_ms=8):
    """Synthesize a piano-like note: harmonic series with ADSR envelope.

    Not meant to be realistic — meant to be rich enough that a broadband
    RMS detector and a chord/pitch detector both have something to grab.
    """
    n = int(duration_s * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE

    # Harmonic series with realistic-ish amplitude rolloff
    harmonics = [(1, 1.00), (2, 0.55), (3, 0.30), (4, 0.18),
                 (5, 0.10), (6, 0.06), (7, 0.03)]
    sig = np.zeros(n)
    for h, amp in harmonics:
        if freq * h < SAMPLE_RATE / 2:
            sig += amp * np.sin(2 * np.pi * freq * h * t)
    sig /= sum(a for _, a in harmonics)

    # Envelope: linear attack, exponential decay
    env = np.ones(n)
    a_n = min(int(attack_ms / 1000.0 * SAMPLE_RATE), n)
    env[:a_n] = np.linspace(0, 1, a_n)
    if decay_s > 0:
        decay_curve = np.exp(-np.arange(n - a_n) / (decay_s * SAMPLE_RATE))
        env[a_n:] = decay_curve
    return sig * env


def chord(midi_notes, duration_s, decay_s=2.0):
    """Sum a set of MIDI notes into a piano-voiced chord."""
    s = np.zeros(int(duration_s * SAMPLE_RATE))
    for m in midi_notes:
        s += piano_note(midi_to_freq(m), duration_s, decay_s)
    return s / max(len(midi_notes), 1)


# ---------------------------------------------------------------------------
# Chord shapes (intervals from root)
# ---------------------------------------------------------------------------

def major(r):    return [r, r + 4, r + 7]
def minor(r):    return [r, r + 3, r + 7]
def dim(r):      return [r, r + 3, r + 6]
def aug(r):      return [r, r + 4, r + 8]
def sus4(r):     return [r, r + 5, r + 7]
def maj7(r):     return [r, r + 4, r + 7, r + 11]
def dom7(r):     return [r, r + 4, r + 7, r + 10]
def min7(r):     return [r, r + 3, r + 7, r + 10]
def dim7(r):     return [r, r + 3, r + 6, r + 9]


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def progression(chords, bpm, beats_per_chord=4, decay_ratio=0.7):
    """Play a list of chords at a given tempo."""
    sec_per_beat = 60.0 / bpm
    chord_dur = beats_per_chord * sec_per_beat
    parts = [chord(c, chord_dur, decay_s=chord_dur * decay_ratio) for c in chords]
    return np.concatenate(parts)


# ---------------------------------------------------------------------------
# Build the track
# ---------------------------------------------------------------------------

C4 = 60   # middle C

sections = []

# 1. Silence baseline
sections.append(("01_silence_baseline", silence(15)))

# 2. Loudness staircase — quiet to loud in 3 steps
sections.append(("02a_pink_-50dBFS", pink_noise(15, -50)))
sections.append(("02b_pink_-30dBFS", pink_noise(15, -30)))
sections.append(("02c_pink_-15dBFS", pink_noise(15, -15)))
sections.append(("02d_silence_after", silence(3)))

# 3. Note decay panel — same C major chord, four envelopes
C_major_voicing = [60, 64, 67]  # C4 E4 G4
sections.append(("03a_C_staccato",      chord(C_major_voicing, 6, decay_s=0.25)))
sections.append(("03b_C_piano_normal",  chord(C_major_voicing, 6, decay_s=2.0)))
sections.append(("03c_C_organ_held",    chord(C_major_voicing, 6, decay_s=20.0)))
sections.append(("03d_silence_after",   silence(4)))

# 4. Tempo cycle — I-IV-V-I in C at 60 / 120 / 180 BPM
I_IV_V_I = [major(60), major(65), major(67), major(60)]
sections.append(("04a_prog_60bpm",  progression(I_IV_V_I, 60)))
sections.append(("04b_prog_120bpm", progression(I_IV_V_I, 120)))
sections.append(("04c_prog_180bpm", progression(I_IV_V_I, 180)))
sections.append(("04d_silence_after", silence(2)))

# 5. Chord vocabulary — 9 chord types on C, 5s each
chord_vocab = [
    ("Cmaj",   major(C4)),
    ("Cmin",   minor(C4)),
    ("Cdim",   dim(C4)),
    ("Caug",   aug(C4)),
    ("Csus4",  sus4(C4)),
    ("Cmaj7",  maj7(C4)),
    ("C7",     dom7(C4)),
    ("Cmin7",  min7(C4)),
    ("Cdim7",  dim7(C4)),
]
for name, c in chord_vocab:
    sections.append((f"05_{name}", chord(c, 5, decay_s=3.0)))

sections.append(("05_silence_after", silence(2)))

# 6. Realistic progression — vi-IV-I-V (Am-F-C-G) with proper voice leading
vi_IV_I_V = [
    [57, 60, 64],  # Am  (A3 C4 E4)
    [53, 57, 60],  # F   (F3 A3 C4)
    [60, 64, 67],  # C   (C4 E4 G4)
    [55, 59, 62],  # G   (G3 B3 D4)
]
sections.append(("06_realistic_progression", progression(vi_IV_I_V, 80)))

# ---------------------------------------------------------------------------
# Assemble + export
# ---------------------------------------------------------------------------

# Print timestamps as we concatenate, for the docs
cursor = 0.0
print("Timestamps:")
print("-" * 60)
for name, audio in sections:
    dur = len(audio) / SAMPLE_RATE
    mm, ss = divmod(cursor, 60)
    print(f"  {int(mm):02d}:{ss:05.2f}  +{dur:5.2f}s  {name}")
    cursor += dur
print("-" * 60)
print(f"Total duration: {cursor:.2f}s ({cursor/60:.2f} min)")

# Concatenate
audio = np.concatenate([s for _, s in sections])

# Peak-normalize to -1 dBFS (avoids clipping during conversion)
peak = np.max(np.abs(audio))
if peak > 0:
    audio *= (10 ** (-1 / 20.0)) / peak

# Stereo (duplicate to L/R) — Music app and Loopback expect stereo
stereo = np.stack([audio, audio], axis=1)

# Convert to int16 PCM
pcm = (stereo * 32767).astype(np.int16)
wavfile.write(OUTPUT_PATH, SAMPLE_RATE, pcm)
print(f"\nWrote {OUTPUT_PATH}")
print(f"Size: {pcm.nbytes / 1024 / 1024:.2f} MB")
