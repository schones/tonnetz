/**
 * musical-event-stream.js
 * =======================
 * Input-agnostic pub/sub for musical events on the way to Cantor's
 * perceptual layer (see docs/cantor-design.md §7). Producers
 * (MIDIInput now, AudioInterpreter later) call publish(); consumers
 * (CantorView) call subscribe() and getRecentNotes().
 *
 * Events are plain JS objects, not class instances. Shapes:
 *
 *   { type: 'noteAttack',  pitch, velocity, source, timestamp, channel }
 *   { type: 'noteRelease', pitch, source, timestamp }
 *   { type: 'chordChange', root, quality, candidates, timestamp }
 *   { type: 'phraseEnd',   timestamp }                 // reserved for v3
 *
 * Internally tracks two pieces of state for the melody constellation:
 *   - _attacks: recent attack events (so released notes can still
 *     fade through the window)
 *   - _held:    set of currently-pressed pitches (so a long-held note
 *     remains visible even if its attack is older than the window)
 *
 * Exposes: window.MusicalEventStream  (also ES-module default + named export)
 */

const MAX_BUFFER = 256;

const MusicalEventStream = {
  _subscribers: new Set(),
  _attacks: [],          // attack events, oldest first
  _held: new Set(),      // currently-held MIDI pitches

  // ── Subscribe ───────────────────────────────────────────────────

  /**
   * Register a callback for every published event. Returns an
   * unsubscribe function. Callbacks fire synchronously inside publish().
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  },

  // ── Publish ─────────────────────────────────────────────────────

  /**
   * Publish a musical event. Updates internal bookkeeping
   * (held-pitch set, attack ring buffer) before notifying subscribers.
   */
  publish(event) {
    if (!event || !event.type) return;

    if (event.type === 'noteAttack') {
      this._held.add(event.pitch);
      this._attacks.push(event);
      if (this._attacks.length > MAX_BUFFER) {
        this._attacks.splice(0, this._attacks.length - MAX_BUFFER);
      }
    } else if (event.type === 'noteRelease') {
      this._held.delete(event.pitch);
    }

    for (const cb of this._subscribers) {
      try { cb(event); } catch (e) { console.error('[MusicalEventStream] subscriber error:', e); }
    }
  },

  // ── Query ───────────────────────────────────────────────────────

  /**
   * Return attack events that are still relevant for the melody
   * constellation: any attack within the last `windowMs`, plus any
   * currently-held pitch (even if its attack is older than the window).
   *
   * Timestamps on returned events are the original publish timestamps;
   * consumers compute age themselves.
   *
   * Side-effect: prunes stale attacks (older than windowMs and not
   * currently held) from the internal buffer.
   */
  getRecentNotes(windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;

    const kept = [];
    for (const ev of this._attacks) {
      if (ev.timestamp >= cutoff || this._held.has(ev.pitch)) {
        kept.push(ev);
      }
    }
    this._attacks = kept;
    return kept;
  },

  // ── Reset (for tests / page reload paths) ──────────────────────

  reset() {
    this._subscribers.clear();
    this._attacks = [];
    this._held.clear();
  },
};

if (typeof window !== 'undefined') {
  window.MusicalEventStream = MusicalEventStream;
}

export { MusicalEventStream };
export default MusicalEventStream;
