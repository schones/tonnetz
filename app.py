"""
Flask Web UI for the Relative Key Trainer.

Audio recording happens in the browser via Web Audio API / MediaRecorder.
The browser uploads audio files to the backend for DSP processing.

Routes:
    GET  /                  — Dashboard (single-page app)
    POST /play              — Receive uploaded audio → detect chord + pitch → score → JSON
    POST /process_audio_chunk — Receive raw Float32 audio chunk → detect pitch → JSON
    GET  /status            — Leaderboard + challenges dict
"""

from datetime import datetime
import io
import struct

import numpy as np
import librosa
from flask import Flask, jsonify, render_template, request

from chord_detector import ChordDetector
from game_engine import (
    CHALLENGES,
    SAMPLE_RATE,
    SILENCE_RMS,
    _compute_score,
    _display_root,
    _load_scores,
    _save_score,
)
from pitch_matcher import PitchMatcher

# ---------------------------------------------------------------------------
# App + singletons
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB upload limit

detector = ChordDetector(sample_rate=SAMPLE_RATE)
matcher = PitchMatcher(sample_rate=SAMPLE_RATE)


# ---------------------------------------------------------------------------
# Audio chunk processing (replaces sounddevice background thread)
# ---------------------------------------------------------------------------
@app.route("/process_audio_chunk", methods=["POST"])
def process_audio_chunk():
    """
    Receive a raw Float32 audio chunk from the browser and return pitch info.

    Expects multipart/form-data with a 'chunk' file containing raw
    little-endian Float32 PCM samples, or a JSON body with a 'samples' array.
    """
    buf = None

    if "chunk" in request.files:
        raw = request.files["chunk"].read()
        n_samples = len(raw) // 4  # 4 bytes per float32
        buf = np.array(struct.unpack(f"<{n_samples}f", raw), dtype=np.float32)
    elif request.is_json:
        data = request.get_json(force=True)
        samples = data.get("samples", [])
        buf = np.array(samples, dtype=np.float32)

    if buf is None or len(buf) == 0:
        return jsonify({"pitch": None, "volume": 0})

    rms = float(np.sqrt(np.mean(buf ** 2)))
    if rms < SILENCE_RMS:
        return jsonify({"pitch": None, "volume": rms})

    pitch = matcher.detect_pitch(buf)
    return jsonify({"pitch": pitch, "volume": rms})

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/relative")
def relative():
    return render_template("relative.html")

@app.route("/tone-check")
def tone_check():
    return render_template("tone-check.html")

@app.route("/chord-identification")
def chord_identification():
    return render_template("chord-identification.html")

@app.route("/harmony")
def harmony():
    return render_template("harmony.html")

@app.route("/melody")
def melody():
    return render_template("melody.html")

@app.route("/rhythm")
def rhythm():
    return render_template("rhythm.html")

@app.route("/strumming")
def strumming():
    return render_template("strumming.html")

@app.route("/skratch")
def skratch():
    return render_template("skratch-studio.html")

@app.route("/skratch/help")
def skratch_help():
    return render_template("skratch-studio-help.html")

@app.route("/skratch/piano-popout")
def skratch_piano_popout():
    return render_template("piano-popout.html")

@app.route("/test_sustain")
def test_sustain():
    return app.send_static_file("skratch-studio/test-sustain.html")

@app.route("/test-tooltips")
def test_tooltips():
    return render_template("test-tooltips.html")


@app.route("/play", methods=["POST"])
def play():
    """
    Receive an uploaded audio recording from the browser, run chord + pitch
    detection, and score it.

    Expects multipart/form-data:
        audio            — The audio file (WAV/WebM/OGG blob from MediaRecorder)
        mode             — "identify", "clarity", "tone-check", etc.
        expected_root    — e.g. "E"
        expected_quality — "Major" or "Minor"
        player           — player name (optional, defaults to "Anonymous")
    """
    mode = request.form.get("mode", "identify")
    expected_root = request.form.get("expected_root")
    expected_quality = request.form.get("expected_quality")
    player = request.form.get("player", "Anonymous") or "Anonymous"

    # --- Load uploaded audio ---
    audio_file = request.files.get("audio")
    if audio_file is None:
        return jsonify({"error": "no_audio",
                        "message": "No audio file uploaded."}), 400

    try:
        buf, _ = librosa.load(io.BytesIO(audio_file.read()),
                              sr=SAMPLE_RATE, mono=True)
    except Exception as e:
        return jsonify({"error": "bad_audio",
                        "message": f"Could not decode audio: {e}"}), 400

    rms = float(np.sqrt(np.mean(buf ** 2)))
    if rms < SILENCE_RMS:
        return jsonify({"error": "no_sound",
                        "message": "No sound detected — check your mic."}), 200

    # --- Detect ---
    chord = detector.identify_chord(buf)
    pitch = matcher.detect_pitch(buf)
    ambiguity = chord.get("ambiguity", {})
    
    # --- Mode Support ---
    hit = False
    
    if mode in ("chords", "tone-check"):
        hit = bool(chord["quality"].lower() == expected_quality.lower())
    elif mode == "harmony":
        # Check if the detected pitch is close to the expected harmony note
        raw_freq = request.form.get("expected_pitch_freq")
        expected_pitch_freq = float(raw_freq) if raw_freq else None
        if pitch and pitch.get("note") and expected_pitch_freq:
            cents_from_expected = 1200 * np.log2(pitch["frequency"] / expected_pitch_freq)
            # Within 50 cents (half a semitone) is considered a hit
            hit = bool(abs(cents_from_expected) < 50)
            # override cents_off to be relative to the EXPECTED pitch for scoring UI
            pitch["cents_off"] = float(cents_from_expected)
            pitch["expected_freq"] = float(expected_pitch_freq)
    else:
        # relative identify/clarity modes
        hit = bool((chord["root"] == expected_root and
               chord["quality"] == expected_quality))

    # --- Score ---
    points, breakdown = _compute_score(hit, pitch, ambiguity)

    # --- Persist ---
    _save_score(mode, {
        "player": player,
        "score": points,
        "rounds": 1,
        "mode": mode,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })

    return jsonify({
        "hit": hit,
        "score": points,
        "breakdown": [ln.strip() for ln in breakdown],
        "chord": chord,
        "pitch": pitch,
        "ambiguity": ambiguity,
    })


@app.route("/status")
def status():
    """Return the leaderboard (top 10 per mode) and the challenges dict."""
    scores = _load_scores()

    # Build a serialisable challenges list with display-friendly names
    challenges = {}
    for key, ch in CHALLENGES.items():
        challenges[key] = {
            "major": {
                "root": ch["major"]["root"],
                "display": _display_root(ch["major"]["root"]),
                "quality": ch["major"]["quality"],
            },
            "minor": {
                "root": ch["minor"]["root"],
                "display": _display_root(ch["minor"]["root"]),
                "quality": ch["minor"]["quality"],
            },
            "label": ch["label"],
        }

    return jsonify({"scores": scores, "challenges": challenges})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import os
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host=host, port=port, debug=debug)
