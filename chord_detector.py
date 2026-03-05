import numpy as np
import librosa
from audio_processor import AudioProcessor

class ChordDetector(AudioProcessor):
    """
    ChordDetector module that inherits from AudioProcessor to identify triads
    from an audio buffer using chroma features.
    """
    
    def __init__(self, sample_rate=44100, buffer_size=2048):
        super().__init__(sample_rate, buffer_size)
        self.note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Relative major/minor pairs: (major_root_idx, minor_root_idx)
    # Each major key's relative minor is 9 semitones up (or 3 down).
    RELATIVE_PAIRS = [
        (7, 4),   # G Major / E Minor
        (0, 9),   # C Major / A Minor
        (2, 11),  # D Major / B Minor
        (5, 2),   # F Major / D Minor
        (9, 6),   # A Major / F# Minor
        (4, 1),   # E Major / C# Minor
        (11, 8),  # B Major / G# Minor
        (1, 10),  # Db Major / Bb Minor
        (3, 0),   # Eb Major / C Minor
        (6, 3),   # F# Major / D# Minor
        (8, 5),   # Ab Major / F Minor
        (10, 7),  # Bb Major / G Minor
    ]

    def _detect_bass_note(self, buffer):
        """
        Detect the lowest fundamental frequency in the buffer and return
        its chroma index (0–11) and strength. Uses a band-limited FFT
        focused on the bass register (C2–C4, ~65–262 Hz).

        Returns:
            tuple: (chroma_index, strength) or (None, 0.0) if nothing found.
        """
        n = len(buffer)
        fft = np.abs(np.fft.rfft(buffer))
        freqs = np.fft.rfftfreq(n, d=1.0 / self.sample_rate)

        # Focus on the bass register: 60 Hz (B1) to 270 Hz (C4)
        bass_mask = (freqs >= 60) & (freqs <= 270)
        if not np.any(bass_mask):
            return None, 0.0

        bass_fft = fft.copy()
        bass_fft[~bass_mask] = 0.0

        peak_idx = np.argmax(bass_fft)
        peak_freq = freqs[peak_idx]
        peak_mag = bass_fft[peak_idx]

        if peak_mag < np.max(fft) * 0.05:
            return None, 0.0

        # Convert frequency to the nearest chroma index
        midi = 12 * np.log2(peak_freq / 440.0) + 69
        chroma_idx = int(round(midi)) % 12
        strength = float(peak_mag / np.max(fft))

        return chroma_idx, strength

    def _score_triad(self, chroma, root_idx, quality):
        """Score a single triad against a chroma vector.

        Args:
            chroma: Normalized 12-bin chroma vector.
            root_idx: Chroma index of the root (0 = C).
            quality: "Major" or "Minor".

        Returns:
            float: Heuristic score (higher = better fit).
        """
        third_offset = 4 if quality == "Major" else 3
        competing_offset = 3 if quality == "Major" else 4
        fifth_idx = (root_idx + 7) % 12
        third_idx = (root_idx + third_offset) % 12
        competing_idx = (root_idx + competing_offset) % 12

        score = chroma[root_idx] + chroma[third_idx] + chroma[fifth_idx]
        score -= chroma[competing_idx] * 0.5
        return float(score)

    def check_relative_ambiguity(self, chroma):
        """
        Analyze a chroma vector for ambiguity between relative major/minor pairs.

        Relative keys share the same pitches (e.g. G Major and E Minor both use
        G, B, D/E).  When a player's voicing doesn't clearly emphasize one root
        over the other, both chords are plausible.  This method quantifies that
        ambiguity so downstream game logic can score how *clearly* the intended
        chord was played.

        Args:
            chroma (np.ndarray): Normalized 12-bin chroma vector (max = 1.0).

        Returns:
            dict with keys:
                ambiguous  — True if a relative pair is close enough to flag.
                pairs      — List of flagged pairs, each a dict:
                    major  — {"root": str, "score": float}
                    minor  — {"root": str, "score": float}
                    distance — 0.0 (identical scores) to 1.0 (clearly one chord).
                              Computed as |major_score - minor_score| / max(scores).
        """
        result = {"ambiguous": False, "pairs": []}

        # Minimum score for a triad to be considered "present" in the signal.
        presence_threshold = 0.6

        for maj_root, min_root in self.RELATIVE_PAIRS:
            maj_score = self._score_triad(chroma, maj_root, "Major")
            min_score = self._score_triad(chroma, min_root, "Minor")

            # Both triads must have meaningful energy to be ambiguous
            if maj_score < presence_threshold and min_score < presence_threshold:
                continue

            # At least one must be present; compute separation
            peak = max(maj_score, min_score)
            if peak <= 0:
                continue

            distance = abs(maj_score - min_score) / peak

            # Flag as ambiguous when the two triads are within 30% of each other
            if distance < 0.30:
                result["ambiguous"] = True
                result["pairs"].append({
                    "major": {
                        "root": self.note_names[maj_root],
                        "score": round(maj_score, 3),
                    },
                    "minor": {
                        "root": self.note_names[min_root],
                        "score": round(min_score, 3),
                    },
                    "distance": round(distance, 3),
                })

        return result

    def identify_triad(self, buffer):
        """
        Maps chroma peaks to note names, detects the root note, and determines Major vs. Minor qualities.
        Uses chroma_cqt to handle overtone interference common in guitar recordings.
        Applies bass-note weighting and relative-pair disambiguation to reduce
        misidentification of relative major/minor chords (e.g. G Major vs E Minor).

        Args:
            buffer (np.ndarray): The audio data buffer.

        Returns:
            dict: Containing 'root', 'quality', 'confidence', 'candidates' (top 2),
                  and 'ambiguity' (from check_relative_ambiguity).
        """
        empty = {
            "root": None, "quality": None, "confidence": 0.0,
            "candidates": [], "ambiguity": {"ambiguous": False, "pairs": []},
        }
        if len(buffer) == 0:
            return empty

        # Use chroma_cqt which resolves overtones better due to log-frequency spaced bins
        # fmin=librosa.note_to_hz('C2') provides a good baseline for guitars
        fmin = librosa.note_to_hz('C2')
        hop_length = 512
        if len(buffer) < hop_length:
            return empty

        try:
            # chroma_cqt is robust to overtones
            chromagram = librosa.feature.chroma_cqt(y=buffer, sr=self.sample_rate, fmin=fmin, hop_length=hop_length)
        except Exception:
            # Fallback to chroma_stft if buffer is too small for CQT
            chromagram = librosa.feature.chroma_stft(y=buffer, sr=self.sample_rate, hop_length=hop_length)

        # Average chroma across time frames
        chroma_vector = np.mean(chromagram, axis=1)

        # Normalize the chroma vector
        if np.max(chroma_vector) > 0:
            chroma_vector = chroma_vector / np.max(chroma_vector)

        # --- Bass emphasis weighting ---
        # Boost the chroma bin of the lowest detected pitch so the root of
        # open-position chords (which have a bass note) gets extra weight.
        bass_idx, bass_strength = self._detect_bass_note(buffer)
        bass_boost = 0.3  # max additional weight for the bass note
        if bass_idx is not None:
            chroma_vector[bass_idx] += bass_boost * bass_strength

        # Re-normalize after bass boost
        if np.max(chroma_vector) > 0:
            chroma_vector = chroma_vector / np.max(chroma_vector)

        # --- Relative-key ambiguity analysis ---
        ambiguity = self.check_relative_ambiguity(chroma_vector)

        # --- Score every possible root × quality combination ---
        scored = []  # list of (score, root_idx, quality)

        for root_idx in range(12):
            root_chroma = chroma_vector[root_idx]

            # Major triad: Root, Major 3rd (+4 semitones), Perfect 5th (+7 semitones)
            maj3_idx = (root_idx + 4) % 12
            perf5_idx = (root_idx + 7) % 12

            # Minor triad: Root, Minor 3rd (+3 semitones), Perfect 5th (+7 semitones)
            min3_idx = (root_idx + 3) % 12

            # Heuristic score for Major
            maj_score = root_chroma + chroma_vector[maj3_idx] + chroma_vector[perf5_idx]
            # Heuristic score for Minor
            min_score = root_chroma + chroma_vector[min3_idx] + chroma_vector[perf5_idx]

            # Subtract evidence of the competing third to increase confidence
            maj_score -= (chroma_vector[min3_idx] * 0.5)
            min_score -= (chroma_vector[maj3_idx] * 0.5)

            scored.append((maj_score, root_idx, "Major"))
            scored.append((min_score, root_idx, "Minor"))

        # Sort descending by score
        scored.sort(key=lambda x: x[0], reverse=True)

        best_score, best_root_idx, best_quality = scored[0]

        # --- Relative major/minor disambiguation ---
        # For every known relative pair, if the winner is the minor chord,
        # check whether the minor root's chroma energy is truly dominant.
        for maj_root, min_root in self.RELATIVE_PAIRS:
            if best_root_idx == min_root and best_quality == "Minor":
                energy_minor_root = chroma_vector[min_root]
                energy_major_root = chroma_vector[maj_root]
                # Only keep the Minor label if its root energy is ≥20% stronger
                if energy_minor_root < energy_major_root * 1.2:
                    # Find the corresponding Major chord in scored list and swap
                    for i, (sc, ri, qu) in enumerate(scored):
                        if ri == maj_root and qu == "Major":
                            best_score, best_root_idx, best_quality = sc, ri, qu
                            # Move this entry to the front for candidate list
                            scored.insert(0, scored.pop(i))
                            break
                break  # only one pair can match

        # Build top-2 candidates (deduplicated)
        candidates = []
        seen = set()
        for sc, ri, qu in scored:
            key = (ri, qu)
            if key not in seen:
                conf = float(np.clip(sc / 3.0, 0.0, 1.0))
                candidates.append({
                    "root": self.note_names[ri],
                    "quality": qu,
                    "confidence": round(conf, 2),
                })
                seen.add(key)
            if len(candidates) == 2:
                break

        confidence = float(np.clip(best_score / 3.0, 0.0, 1.0))
        root_name = self.note_names[best_root_idx]

        return {
            "root": root_name,
            "quality": best_quality,
            "confidence": round(confidence, 2),
            "candidates": candidates,
            "ambiguity": ambiguity,
        }
