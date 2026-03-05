"""
GameEngine — Relative-key chord training game.

Two modes:
  Identify  — "Play the Relative Minor of G Major" → expects E Minor.
  Clarity   — "Play G Major as clearly as you can" → scored on purity.

Scoring:
  Target hit          +100
  Precision bonus      +20  (root note cents_off < 5)
  Ambiguity penalty    ×0.5 (if ambiguity flagged)

High scores persisted to scores.json alongside the game_engine.py file.
"""

import json
import os
import random
from datetime import datetime

import numpy as np
import sounddevice as sd

from chord_detector import ChordDetector
from pitch_matcher import PitchMatcher

# ---------------------------------------------------------------------------
# Audio config
# ---------------------------------------------------------------------------
SAMPLE_RATE = 44100
RECORD_SECONDS = 3
SILENCE_RMS = 0.005

# ---------------------------------------------------------------------------
# Scoring constants
# ---------------------------------------------------------------------------
POINTS_HIT = 100
POINTS_PRECISION = 20
CENTS_PRECISION_THRESHOLD = 5.0
AMBIGUITY_MULTIPLIER = 0.5

# ---------------------------------------------------------------------------
# Challenges — every relative major / minor pair we train on.
# Each entry is keyed by an ID and contains the two chords plus
# human-readable prompt fragments for both directions.
# ---------------------------------------------------------------------------
CHALLENGES = {
    "G_Em": {
        "major": {"root": "G",  "quality": "Major"},
        "minor": {"root": "E",  "quality": "Minor"},
        "label": "G / Em",
    },
    "C_Am": {
        "major": {"root": "C",  "quality": "Major"},
        "minor": {"root": "A",  "quality": "Minor"},
        "label": "C / Am",
    },
    "D_Bm": {
        "major": {"root": "D",  "quality": "Major"},
        "minor": {"root": "B",  "quality": "Minor"},
        "label": "D / Bm",
    },
    "F_Dm": {
        "major": {"root": "F",  "quality": "Major"},
        "minor": {"root": "D",  "quality": "Minor"},
        "label": "F / Dm",
    },
    "A_F#m": {
        "major": {"root": "A",  "quality": "Major"},
        "minor": {"root": "F#", "quality": "Minor"},
        "label": "A / F#m",
    },
    "E_C#m": {
        "major": {"root": "E",  "quality": "Major"},
        "minor": {"root": "C#", "quality": "Minor"},
        "label": "E / C#m",
    },
    "Bb_Gm": {
        "major": {"root": "A#", "quality": "Major"},
        "minor": {"root": "G",  "quality": "Minor"},
        "label": "Bb / Gm",
    },
    "Eb_Cm": {
        "major": {"root": "D#", "quality": "Major"},
        "minor": {"root": "C",  "quality": "Minor"},
        "label": "Eb / Cm",
    },
}

# Friendly display names (sharp roots → common enharmonic labels for prompts)
_DISPLAY = {
    "A#": "Bb", "D#": "Eb", "G#": "Ab",
    "C#": "Db", "F#": "F#",
}

SCORES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scores.json")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _display_root(root):
    """Return a human-friendly enharmonic name when appropriate."""
    return _DISPLAY.get(root, root)


def _record_buffer():
    """Record RECORD_SECONDS of audio.  Returns 1-D float32 array or None."""
    print()
    print("  --- RECORDING NOW (Play!) ---")
    print()
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
        print("  !! No sound detected — check your mic.\n")
        return None
    return buf


def _bar(value, width=20):
    filled = int(round(value * width))
    return "[" + "#" * filled + "-" * (width - filled) + "]"


# ---------------------------------------------------------------------------
# Score persistence
# ---------------------------------------------------------------------------

def _load_scores():
    if os.path.exists(SCORES_PATH):
        try:
            with open(SCORES_PATH, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"identify": [], "clarity": []}


def _save_score(mode, entry):
    """Append a score entry and keep the top 10 per mode."""
    data = _load_scores()
    if mode not in data:
        data[mode] = []
    data[mode].append(entry)
    data[mode].sort(key=lambda e: e["score"], reverse=True)
    data[mode] = data[mode][:10]
    with open(SCORES_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _print_high_scores(mode):
    data = _load_scores()
    entries = data.get(mode, [])
    if not entries:
        print("    No scores yet.\n")
        return
    for i, e in enumerate(entries, 1):
        dt = e.get("date", "")
        print(f"    {i:>2}. {e['score']:>6} pts   {e.get('player', '???'):<12}  {dt}")
    print()


# ---------------------------------------------------------------------------
# Scoring logic
# ---------------------------------------------------------------------------

def _compute_score(hit, pitch_result, ambiguity):
    """
    Compute points for a single round.

    Returns:
        (total_points, breakdown_lines)
    """
    lines = []
    points = 0

    # --- Target hit ---
    if hit:
        points += POINTS_HIT
        lines.append(f"    Correct chord         +{POINTS_HIT}")
    else:
        lines.append("    Wrong chord             +0")

    # --- Precision bonus (only when hit) ---
    if hit and pitch_result and pitch_result.get("cents_off") is not None:
        cents = abs(pitch_result["cents_off"])
        if cents < CENTS_PRECISION_THRESHOLD:
            points += POINTS_PRECISION
            lines.append(f"    Precision bonus (<5c)  +{POINTS_PRECISION}")
        else:
            lines.append(f"    Precision ({cents:+.1f}c)         +0")

    # --- Ambiguity penalty ---
    if ambiguity and ambiguity.get("ambiguous"):
        pre = points
        points = int(points * AMBIGUITY_MULTIPLIER)
        lost = pre - points
        lines.append(f"    Ambiguity penalty      -{lost}")

    lines.append(f"    {'─' * 30}")
    lines.append(f"    ROUND TOTAL            {points} pts")
    return points, lines


# ---------------------------------------------------------------------------
# Game modes
# ---------------------------------------------------------------------------

def _play_identify_round(detector, matcher):
    """
    Identify mode: pick a pair, ask for the relative major or minor,
    check if the player nailed it.
    """
    challenge = random.choice(list(CHALLENGES.values()))

    # Randomly ask for the major's relative minor or vice-versa
    if random.random() < 0.5:
        given = challenge["major"]
        expected = challenge["minor"]
        prompt_dir = "Relative Minor"
    else:
        given = challenge["minor"]
        expected = challenge["major"]
        prompt_dir = "Relative Major"

    given_label = f"{_display_root(given['root'])} {given['quality']}"
    expected_label = f"{_display_root(expected['root'])} {expected['quality']}"

    print(f"\n    Play the {prompt_dir} of {given_label}")
    print(f"    (expected: {expected_label})")

    input("\n  Press ENTER then play > ")
    buf = _record_buffer()
    if buf is None:
        return 0

    chord = detector.identify_triad(buf)
    pitch = matcher.detect_pitch(buf)

    detected_label = f"{chord['root']} {chord['quality']}"
    hit = (chord["root"] == expected["root"] and
           chord["quality"] == expected["quality"])

    print(f"    Detected: {detected_label}  (confidence {chord['confidence']:.0%})")
    if pitch["note"]:
        print(f"    Root pitch: {pitch['note']}  ({pitch['cents_off']:+.1f} cents)")

    points, lines = _compute_score(hit, pitch, chord.get("ambiguity", {}))
    print()
    for ln in lines:
        print(ln)
    return points


def _play_clarity_round(detector, matcher):
    """
    Clarity mode: ask for a specific chord, score how purely it was played
    using the ambiguity distance metric.
    """
    challenge = random.choice(list(CHALLENGES.values()))
    # Pick either the major or the minor at random
    target = random.choice([challenge["major"], challenge["minor"]])
    target_label = f"{_display_root(target['root'])} {target['quality']}"

    print(f"\n    Play {target_label} as clearly as you can!")

    input("\n  Press ENTER then play > ")
    buf = _record_buffer()
    if buf is None:
        return 0

    chord = detector.identify_triad(buf)
    pitch = matcher.detect_pitch(buf)
    ambiguity = chord.get("ambiguity", {})

    detected_label = f"{chord['root']} {chord['quality']}"
    hit = (chord["root"] == target["root"] and
           chord["quality"] == target["quality"])

    print(f"    Detected:   {detected_label}  (confidence {chord['confidence']:.0%})")
    if pitch["note"]:
        print(f"    Root pitch: {pitch['note']}  ({pitch['cents_off']:+.1f} cents)")

    # Show ambiguity detail
    if ambiguity.get("ambiguous"):
        print()
        print("    Ambiguity detected:")
        for pair in ambiguity["pairs"]:
            maj = pair["major"]
            mn = pair["minor"]
            d = pair["distance"]
            print(f"      {maj['root']} Maj ({maj['score']:.3f}) "
                  f"vs {mn['root']} Min ({mn['score']:.3f})  "
                  f"distance {d:.3f} {_bar(d)}")
    else:
        print("    No ambiguity — clean voicing!")

    points, lines = _compute_score(hit, pitch, ambiguity)
    print()
    for ln in lines:
        print(ln)
    return points


# ---------------------------------------------------------------------------
# Session (multi-round wrapper)
# ---------------------------------------------------------------------------

def _run_session(mode, rounds, detector, matcher):
    play_fn = _play_identify_round if mode == "identify" else _play_clarity_round
    total = 0

    for rnd in range(1, rounds + 1):
        print()
        print(f"  ╔{'═' * 44}╗")
        print(f"  ║  Round {rnd} / {rounds:<30}    ║")
        print(f"  ╚{'═' * 44}╝")
        pts = play_fn(detector, matcher)
        total += pts
        print(f"\n    Running total: {total} pts")

    print()
    print("=" * 50)
    print(f"  SESSION COMPLETE — {total} points in {rounds} rounds")
    print("=" * 50)

    name = input("\n  Enter your name for the leaderboard: ").strip() or "Anonymous"
    entry = {
        "player": name,
        "score": total,
        "rounds": rounds,
        "mode": mode,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    _save_score(mode, entry)
    print(f"\n  Score saved!  (stored in scores.json)")


# ---------------------------------------------------------------------------
# Main menu / game loop
# ---------------------------------------------------------------------------

def main():
    detector = ChordDetector(sample_rate=SAMPLE_RATE)
    matcher = PitchMatcher(sample_rate=SAMPLE_RATE)

    while True:
        print()
        print("=" * 50)
        print("   RELATIVE KEY TRAINER")
        print("=" * 50)
        print()
        print("   1) Identify  — name & play the relative chord")
        print("   2) Clarity   — play a chord as purely as possible")
        print("   3) High Scores")
        print("   q) Quit")
        print()

        choice = input("  Choose > ").strip().lower()

        if choice == "q":
            print("\n  See you next time!\n")
            break

        if choice == "3":
            print("\n  -- Identify High Scores --")
            _print_high_scores("identify")
            print("  -- Clarity High Scores --")
            _print_high_scores("clarity")
            continue

        if choice not in ("1", "2"):
            print("  Invalid choice.")
            continue

        mode = "identify" if choice == "1" else "clarity"

        rounds_input = input("  How many rounds? [5] ").strip()
        try:
            rounds = int(rounds_input) if rounds_input else 5
            rounds = max(1, min(rounds, 20))
        except ValueError:
            rounds = 5

        _run_session(mode, rounds, detector, matcher)


if __name__ == "__main__":
    main()
