import numpy as np
import librosa
from audio_processor import AudioProcessor


class PitchMatcher(AudioProcessor):
    """
    High-accuracy single-note pitch detector using librosa.pyin.
    Returns the detected note name, frequency, cents offset from the
    nearest equal-temperament pitch, and a confidence value derived
    from pyin's voicing probability.
    """

    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F',
                  'F#', 'G', 'G#', 'A', 'A#', 'B']

    def __init__(self, sample_rate=44100, buffer_size=2048,
                 fmin_hz=65.0, fmax_hz=1047.0):
        """
        Args:
            sample_rate: Audio sample rate in Hz.
            buffer_size: Default buffer size (inherited).
            fmin_hz: Lowest expected pitch — default C2 (65 Hz).
            fmax_hz: Highest expected pitch — default C6 (1047 Hz).
        """
        super().__init__(sample_rate, buffer_size)
        self.fmin = fmin_hz
        self.fmax = fmax_hz

    @staticmethod
    def _hz_to_midi(freq):
        """Convert frequency in Hz to a (fractional) MIDI note number."""
        return 12.0 * np.log2(freq / 440.0) + 69.0

    @staticmethod
    def _midi_to_hz(midi):
        """Convert MIDI note number to Hz."""
        return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))

    def _midi_to_note_name(self, midi):
        """Convert an integer MIDI number to scientific pitch notation (e.g. 'C4')."""
        note_idx = int(round(midi)) % 12
        octave = int(round(midi)) // 12 - 1
        return f"{self.NOTE_NAMES[note_idx]}{octave}"

    def detect_pitch(self, buffer):
        """
        Detect the dominant pitch in a mono audio buffer using librosa.pyin.

        pyin (probabilistic YIN) provides per-frame f0 estimates with voicing
        probabilities, giving sub-cent accuracy on sustained single notes.

        Args:
            buffer (np.ndarray): 1-D float audio samples.

        Returns:
            dict with keys:
                note       — Scientific pitch name (e.g. "G#4"), or None.
                frequency  — Detected frequency in Hz, or None.
                cents_off  — Deviation from nearest semitone (-50 to +50), or None.
                confidence — 0.0–1.0 derived from pyin voicing probability.
                midi       — Fractional MIDI note number, or None.
        """
        empty = {
            "note": None,
            "frequency": None,
            "cents_off": None,
            "confidence": 0.0,
            "midi": None,
        }

        if len(buffer) == 0:
            return empty

        buffer = np.asarray(buffer, dtype=np.float64)

        # pyin returns (f0_array, voiced_flags, voiced_probs) per frame
        f0, voiced_flag, voiced_prob = librosa.pyin(
            buffer,
            fmin=self.fmin,
            fmax=self.fmax,
            sr=self.sample_rate,
        )

        # Keep only voiced frames (where pyin is confident a pitch exists)
        voiced_mask = voiced_flag & np.isfinite(f0)
        if not np.any(voiced_mask):
            return empty

        voiced_f0 = f0[voiced_mask]
        voiced_probs = voiced_prob[voiced_mask]

        # Weight each frame's f0 by its voicing probability for a robust average
        weights = voiced_probs / voiced_probs.sum()
        avg_freq = float(np.sum(voiced_f0 * weights))
        avg_confidence = float(np.mean(voiced_probs))

        # Convert to MIDI for cent-accurate comparison
        midi_float = self._hz_to_midi(avg_freq)
        midi_round = round(midi_float)
        cents_off = round((midi_float - midi_round) * 100.0, 1)

        note_name = self._midi_to_note_name(midi_round)

        return {
            "note": note_name,
            "frequency": round(avg_freq, 2),
            "cents_off": cents_off,
            "confidence": round(avg_confidence, 3),
            "midi": round(midi_float, 2),
        }
