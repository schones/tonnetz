# SongLab

**Harmony has a shape. Explore it.**

SongLab is a music education platform that helps you understand harmony through interactive visualization and real songs. Pick a song you love, see how its chords move on the Tonnetz and Circle of Fifths, then create your own progressions in SkratchLab.

🎹 **Explorer** — Interactive Tonnetz, Chord Wheel, Fretboard, and Rhythm panels synchronized via a shared harmony engine. 14 guided walkthroughs using real songs (Beatles, Radiohead, Billy Joel, jazz standards, blues, and more).

🧱 **SkratchLab** — Block-based music creation environment with Blockly, Neo-Riemannian transform blocks (P/L/R), Rhythm Builder drum machine, and MIDI export.

🎮 **Games** — Harmony Trainer, Chord Spotter, Scale Builder, Swing Trainer, Melody Match, Rhythm Lab, Strum Patterns, Relative Key Trainer. All games accept deep-link params from walkthroughs for contextual practice.

📚 **Fundamentals** — 5-chapter interactive introduction to intervals, scales, chords, the Tonnetz, and Neo-Riemannian transforms.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/schones/songlab.git
cd songlab
pip install -r requirements.txt

# Run locally
python3 app.py
# → http://127.0.0.1:5000
```

## Tech Stack

- **Backend:** Flask / Jinja2
- **Frontend:** Vanilla JS (ES modules), SVG visualizations
- **Audio:** Tone.js + Salamander piano sampler
- **State:** HarmonyState pub/sub model
- **Music theory:** Neo-Riemannian transforms (P/L/R), interval-content chord resolution
- **Block coding:** Blockly (SkratchLab)
- **Deploy:** Railway from `main`

## Project Structure

```
static/
  shared/          # Core modules (harmony-state, transforms, tonnetz-neighborhood, etc.)
  games/           # Game-specific JS
  skratch-studio/  # SkratchLab engine
  css/             # Design tokens + stylesheets
  intro/           # Fundamentals chapter JS
templates/         # Jinja2 templates (Explorer, games, theory, intro)
docs/              # Specs, build plan, session log, status
```

## Docs

See `docs/STATUS.md` for current project state and `docs/songlab-build-plan.md` for the full roadmap.

## License

All rights reserved. © 2025-2026
