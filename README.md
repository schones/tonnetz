# Tonnetz

**Real-time chord detection and relative-key ear training, powered by chroma-based audio analysis.**

Tonnetz is a music theory training tool that listens to your instrument through a microphone, identifies chords using CQT chromagram analysis, and challenges you to distinguish between relative major and minor keys — one of the hardest skills in practical ear training.

---

## Why Relative Keys Are Hard

G Major and E Minor share the same key signature (one sharp). Their triads overlap on two of three notes (G and B). When you strum an open G chord on guitar, overtones and sympathetic resonance produce energy at E and B — exactly the notes that define E Minor. Traditional chromagram-based detectors frequently confuse the two.

Tonnetz solves this with a three-layer detection pipeline:

1. **Bass-note weighting** — FFT-based detection of the lowest fundamental (60–270 Hz) boosts the root's chroma bin, anchoring open-position chords to their actual bass note.

2. **Relative-pair disambiguation** — After scoring all 24 possible triads (12 roots x Major/Minor), Tonnetz checks if the winner is a minor chord whose relative major has comparable chroma energy. The minor label is only kept if its root energy exceeds the major root by at least 20%.

3. **Ambiguity analysis** — `check_relative_ambiguity()` computes a distance metric (0.0 = identical scores, 1.0 = clearly one chord) for every relative pair present in the signal. This powers the Clarity game mode, where players are scored on how *purely* they voice a chord.

## Architecture

```
tonnetz/
├── app.py                 # Flask web server — /play and /status endpoints
├── audio_processor.py     # Base class — file loading, stream buffering
├── chord_detector.py      # CQT chromagram → triad identification + ambiguity
├── pitch_matcher.py       # librosa.pyin → sub-cent single-note detection
├── game_engine.py         # Scoring, challenges, leaderboard, terminal UI
├── requirements.txt       # Python dependencies
└── templates/
    └── index.html         # Single-page dashboard with pitch gauge
```

### Module Roles

| Module | Role | Key Method |
|--------|------|------------|
| `audio_processor.py` | Base class for all audio modules. Handles sample-rate config, file loading via librosa, and real-time stream buffering. | `load_audio_file()`, `ingest_stream_buffer()` |
| `chord_detector.py` | Extracts a 12-bin chroma vector via `chroma_cqt`, applies bass-emphasis weighting, scores all 24 triads, disambiguates relative pairs, and flags ambiguity. | `identify_triad(buffer)` → `{root, quality, confidence, candidates, ambiguity}` |
| `pitch_matcher.py` | Probabilistic YIN (pyin) pitch detector. Aggregates voiced frames weighted by voicing probability for a robust average. Returns note name, Hz, cents offset, and MIDI number. | `detect_pitch(buffer)` → `{note, frequency, cents_off, confidence, midi}` |
| `game_engine.py` | Defines 8 relative major/minor challenge pairs (G/Em through Eb/Cm). Two game modes, scoring engine, and high-score persistence to `scores.json`. Also runs standalone in the terminal. | `_compute_score(hit, pitch, ambiguity)` |
| `app.py` | Flask server. All audio recording and processing happens server-side via sounddevice — the browser never accesses the microphone. | `POST /play`, `GET /status` |

### Audio Pipeline

```
Microphone → sounddevice.rec() (3 s, 44.1 kHz, float32)
    │
    ├─→ ChordDetector.identify_triad()
    │       chroma_cqt → bass boost → score 24 triads
    │       → disambiguate relative pairs → ambiguity check
    │
    └─→ PitchMatcher.detect_pitch()
            pyin → voiced-frame filter → weighted average
            → MIDI → cents offset from nearest semitone
    │
    └─→ _compute_score(hit, pitch, ambiguity)
            +100 correct chord
             +20 precision bonus (< 5 cents)
            ×0.5 ambiguity penalty
```

## Game Modes

### Identify

The app picks a random relative pair and direction:

> *"Play the Relative Minor of G Major"*

You play E Minor. Tonnetz records 3 seconds, detects the chord, and scores whether you hit the right target.

### Clarity

The app names a specific chord:

> *"Play G Major as clearly as you can"*

Tonnetz checks whether your voicing produces ambiguity with the relative minor. A clean voicing (high distance score) earns full points. A muddy voicing that could be either G Major or E Minor gets halved.

### Scoring

| Component | Points |
|-----------|--------|
| Correct chord | +100 |
| Precision bonus (root pitch within 5 cents) | +20 |
| Ambiguity penalty (relative pair flagged) | x0.5 |
| **Maximum per round** | **120** |

## Quick Start

```bash
# Clone and install
cd tonnetz
pip install -r requirements.txt

# Web UI
python app.py
# Open http://localhost:5000

# Terminal mode (no browser needed)
python game_engine.py
```

### Requirements

- Python 3.9+
- A working microphone (internal, USB, or audio interface)
- macOS, Linux, or Windows (PortAudio required for sounddevice)

On macOS, PortAudio is typically bundled. On Linux:

```bash
sudo apt-get install portaudio19-dev
```

## API Endpoints

### `POST /play`

Record audio from the host microphone and return scored results.

**Request:**
```json
{
  "mode": "identify",
  "expected_root": "E",
  "expected_quality": "Minor",
  "player": "Dustin"
}
```

**Response:**
```json
{
  "hit": true,
  "score": 120,
  "breakdown": ["Correct chord +100", "Precision bonus (<5c) +20"],
  "chord": {
    "root": "E",
    "quality": "Minor",
    "confidence": 0.87,
    "candidates": [{"root": "E", "quality": "Minor", "confidence": 0.87}],
    "ambiguity": {"ambiguous": false, "pairs": []}
  },
  "pitch": {
    "note": "E4",
    "frequency": 329.41,
    "cents_off": -2.3,
    "confidence": 0.92,
    "midi": 64.02
  }
}
```

### `GET /status`

Returns the leaderboard (top 10 per mode) and the challenges dictionary.

## Technical Details

### Chroma Analysis

Tonnetz uses `librosa.feature.chroma_cqt` rather than `chroma_stft`. The Constant-Q Transform spaces frequency bins logarithmically (one bin per semitone), which maps directly to musical pitch and handles overtone interference better than linear FFT bins. This is especially important for guitar, where the 2nd and 3rd harmonics of low strings bleed into higher chroma bins.

### Pitch Detection

Single-note pitch uses `librosa.pyin` (probabilistic YIN), which models pitch as a hidden Markov model over candidate f0 values. Each frame produces a voicing probability (0–1). Tonnetz filters to voiced frames only, then computes a probability-weighted average frequency. The result is converted to a fractional MIDI number, and cents offset is the difference from the nearest integer MIDI note times 100.

### Relative-Pair Disambiguation

After scoring all 24 triads, Tonnetz checks the winner against the 12 known relative major/minor pairs. If the winner is a minor chord (e.g., E Minor) and its relative major (G Major) has comparable root energy, the 20% threshold rule applies: E Minor is only kept if `chroma[E] >= chroma[G] * 1.2`. Otherwise, it flips to G Major. This single heuristic eliminates the most common misidentification in guitar chord detection.

## License

MIT
