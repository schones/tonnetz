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
from audio_processor import AudioProcessor
import threading
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
audio_proc = AudioProcessor(sample_rate=SAMPLE_RATE)

listen_stream = None
latest_audio_state = {"pitch": None, "volume": 0, "active": False}

def audio_callback(indata, frames, time, status):
    buf = indata.flatten()
    audio_proc.ingest_stream_buffer(buf)
    
    rms = float(np.sqrt(np.mean(buf ** 2)))
    latest_audio_state["volume"] = rms
    if rms > SILENCE_RMS:
        pitch = matcher.detect_pitch(buf)
        latest_audio_state["pitch"] = pitch
    else:
        latest_audio_state["pitch"] = None

@app.route("/start_listen", methods=["POST"])
def start_listen():
    global listen_stream
    if listen_stream is None:
        listen_stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=audio_callback, blocksize=2048)
        listen_stream.start()
        latest_audio_state["active"] = True
    return jsonify({"status": "started"})

@app.route("/stop_listen", methods=["POST"])
def stop_listen():
    global listen_stream
    if listen_stream is not None:
        listen_stream.stop()
        listen_stream.close()
        listen_stream = None
        latest_audio_state["active"] = False
    return jsonify({"status": "stopped"})

@app.route("/poll_audio", methods=["GET"])
def poll_audio():
    return jsonify(latest_audio_state)

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
    chord = detector.identify_chord(buf)
    pitch = matcher.detect_pitch(buf)
    ambiguity = chord.get("ambiguity", {})
    
    # --- Mode Support ---
    hit = False
    
    if mode in ("chords", "tone-check"):
        hit = bool(chord["quality"].lower() == expected_quality.lower())
    elif mode == "harmony":
        # Check if the detected pitch is close to the expected harmony note
        expected_pitch_freq = data.get("expected_pitch_freq")
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
if __name__ == "__main__":
    print("\n  Relative Key Trainer — http://localhost:5000\n")
    app.run(debug=True, port=5000)
