"""
Flask Web UI for the Relative Key Trainer.

All audio recording and processing happens server-side via sounddevice,
keeping the browser lightweight (no Web Audio API / getUserMedia needed).

Routes:
    GET  /       — Dashboard (single-page app)
    POST /play   — Record 3 s → detect chord + pitch → score → JSON
    GET  /status — Leaderboard + challenges dict
"""

from datetime import datetime

import numpy as np
import sounddevice as sd
from flask import Flask, jsonify, render_template, request

from chord_detector import ChordDetector
from game_engine import (
    CHALLENGES,
    RECORD_SECONDS,
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

detector = ChordDetector(sample_rate=SAMPLE_RATE)
matcher = PitchMatcher(sample_rate=SAMPLE_RATE)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/play", methods=["POST"])
def play():
    """
    Record audio from the host mic, run chord + pitch detection, score it.

    Expects JSON body:
        mode             — "identify" or "clarity"
        expected_root    — e.g. "E"
        expected_quality — "Major" or "Minor"
        player           — player name (optional, defaults to "Anonymous")
    """
    data = request.get_json(force=True)
    mode = data.get("mode", "identify")
    expected_root = data.get("expected_root")
    expected_quality = data.get("expected_quality")
    player = data.get("player", "Anonymous") or "Anonymous"

    # --- Record ---
    audio = sd.rec(
        frames=int(SAMPLE_RATE * RECORD_SECONDS),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
    )
    sd.wait()
    buf = audio.flatten()

    rms = float(np.sqrt(np.mean(buf ** 2)))
    if rms < SILENCE_RMS:
        return jsonify({"error": "no_sound",
                        "message": "No sound detected — check your mic."}), 200

    # --- Detect ---
    chord = detector.identify_triad(buf)
    pitch = matcher.detect_pitch(buf)
    ambiguity = chord.get("ambiguity", {})

    hit = (chord["root"] == expected_root and
           chord["quality"] == expected_quality)

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
if __name__ == "__main__":
    print("\n  Relative Key Trainer — http://localhost:5000\n")
    app.run(debug=True, port=5000)
