# Tonnetz — Claude Code Context

## Before every task
1. Read `docs/STATUS.md` — single source of truth for project state
2. Read the relevant spec doc for your task (see STATUS.md for links)

## Reference docs
- `docs/tonnetz-build-plan.md` — phased build plan with task prompts
- `docs/tonnetz-content-architecture.md` — content model and topic schema
- `docs/tonnetz-keyboard-component.md` — shared component spec (RKT tasks)
- `docs/puzzle-paths-spec.md` — Puzzle Paths game concept

## Rules
- Never run git add, commit, or push — Dustin manages git himself
- Shared JS modules: `static/shared/`
- Skratch Studio code: `static/skratch-studio/`
- Test locally: `python3 app.py` → http://127.0.0.1:5000
- Dev branch: `education-layer` · Production: `main` (Railway)
