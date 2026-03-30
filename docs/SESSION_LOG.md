# Session Log

Reverse chronological. Quick capture after each session: what happened, what was decided, what's next.

---

## 2026-03-30 afternoon (in progress)

- Full docs update: applied 15-issue cross-reference audit from Friday to all md files
- Created voicing-explorer-spec.md v0.3 (was missing from repo)
- Archived old doc versions in docs/archive/
- Removed stale AGENT_GUIDE.md
- Fixed glow worm blur bleeding over Tonnetz node labels (SVG render order + blur reduction)
- Started A4 Session 1: multi-path glow worm progression engine (running in Claude Code)
- Decided: A4 lives at /theory/chord-progressions as lesson page embedding Explorer panels
- Decided: animated playthrough with fading trails (not all-at-once)
- Decided: Song Examples DB integration with dual tabs — "By Pattern" + "By Song"
- Decided: common-tone flash during chord transitions (white/gold pulse, ~500ms)
- Workflow: Sonnet as default Claude Code model, Opus for multi-file architectural prompts
- Next: test progression engine, Session 2 (page UI), A3 modes, fretboard panel

## 2026-03-29 (Saturday)

- Voicing Explorer MVP build session — shipped Note Mode, glow worm path, ChordResolver, 3-panel sync
- 474 insertions across 5 modified files + 2 new modules (chord-bubble-renderer.js, chord-resolver.js)
- Decided: glow worm over convex hull (encodes voicing order)
- Decided: chord wheel arc re-centers on assembled chord's key as tonic
- Decided: ChordResolver enhanced HarmonyState rather than separate detection
- Ideas captured: multiple simultaneous glow worm paths, chord shapes as Skratch Studio blocks

## 2026-03-27 (Friday evening)

- Full spec cross-reference audit: 15 issues identified across all docs
- Created voicing-explorer-spec.md v0.3 (MVP scope, composable panels, resolved open questions)
- Updated all docs with fixes (orientation, 4→3 panels, phase numbering, Song DB status)
- Decided: "tools teachers find useful" positioning (not teacher dashboard)
- Decided: alternative voicings = killer use case for working musicians
- Decided: fretboard panel as pre-MVP composable panel
- Decided: game-flow.js extraction at Phase B start
- Note: doc updates weren't committed until 2026-03-30 — need to close this loop faster

## 2026-03-27 (Thursday)

- Phase A1 complete: Circle of Fifths page at /theory/circle-of-fifths
- Phase A2 complete: Tonal Centers lesson at /theory/tonal-centers (4-step walkthrough + ear training)
- Debugged: playBtn.disabled state not resetting, audioReady toggle issue
- Backend API proxy confirmed complete and secure
- Decided: defer auth/persistence to Phase B.5 as planned

## 2026-03-23

- Visual layer system built (visual-config.js, visual-layer.js, visual-toggle.js)
- Replaced sprint tracker with MVP tracker
- Updated STATUS.md as source of truth
