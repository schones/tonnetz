# Claude Code Preferences — Tonnetz Music Theory Games

## Git
- **I manage all git operations myself.** Never include `git add`, `git commit`, `git push`, or commit messages in prompts or scripts.

## Prompt Style
- Always start with "Read the following files before making any changes"
- Scope each prompt to one task
- Include explicit file paths relative to repo root

## Environment
- Local testing: `python3 -m http.server 8000`
- CLI setting: `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000`
- Stack: Flask/Jinja2, vanilla JS, Tone.js, no build step
- Hosting: Railway (auto-deploys on push to main)
- Branch workflow: feature branches, merge to main when ready
