# SongLab — Claude Code Context

## Before every task
1. Read `docs/STATUS.md` — single source of truth for project state
2. Read the relevant spec doc for your task (see STATUS.md for links)

## Reference docs
- `docs/songlab-build-plan.md` — phased build plan (v4) with task prompts
- `docs/content-architecture.md` — content model and topic schema
- `docs/keyboard-component-spec.md` — shared keyboard component spec
- `docs/explorer-spec.md` — Explorer panel design and canonical orientation
- `docs/game-engine-spec.md` — game audit, adaptive engine, ResultDetail schemas
- `docs/design-system-reference.md` — CSS tokens, color palette, typography
- `docs/spectrum-panel-spec.md` — Harmonic Resonance FFT visualizer + MIDI input

## Rules
- Never run git add, commit, or push — Dustin manages git himself
- Shared JS modules: `static/shared/`
- SkratchLab code: `static/skratch-studio/`
- Games: `static/games/` + `templates/games/`
- Test locally: `python3 app.py` → http://127.0.0.1:5000
- Dev branch: `dev` · Production: `main` (Railway)
