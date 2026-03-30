#!/bin/bash
# Run from the tonnetz repo root
# Requires: gh auth login (if not already authenticated)

gh issue create --title "A3: Modes overview page" \
  --body "Interactive lesson at /theory/modes. Pick a mode, hear it, see it on keyboard, brightness ordering (Lydian → Locrian). Can be standalone Theory Hub entry or tab within Scale Explorer. Follow A1/A2 pattern."

gh issue create --title "A4 Session 2: Chord progressions page UI" \
  --body "Build /theory/chord-progressions page. Progression picker (tabs: By Pattern + By Song), transport controls (play/pause/step/reset), educational content panels, Song Examples DB wiring. Depends on: multi-path progression engine (Session 1)."

gh issue create --title "Fretboard panel (fretboard-view.js)" \
  --body "Composable Explorer panel mirroring keyboard features on a guitar fretboard. Subscribes to HarmonyState. Multiple positions per note needs design (highlight all vs practical voicings). Standard tuning default. Pre-MVP priority — large guitarist audience."

gh issue create --title "Intro module: rebuild chapter 4 on Explorer components" \
  --body "Chapters 1-3 complete. Chapter 4+ paused — needs rebuild using Explorer panels (Tonnetz, keyboard, chord wheel) instead of standalone implementations."

gh issue create --title "Extract game-flow.js shared module" \
  --body "Chord Walks and Harmony Trainer both implement Learn/Practice/Test + Explore. Extract shared game-flow.js before building any Phase B games. Scheduled for Phase B start."

gh issue create --title "Skratch Studio: Clear All doesn't reset canvas" \
  --body "Clear All button clears blocks but not the canvas. Needs to also reset/clear the canvas."

gh issue create --title "Multiple glow worm paths: color palette design" \
  --body "Need to finalize color palette for multi-chord progression visualization. Colors must be distinct, accessible, and work against Tonnetz grid background. Connected to A4 chord progressions feature."

gh issue create --title "Polish pass: landing page, navigation, first-visit experience" \
  --body "Pre-share polish. Landing page, nav structure, what a first-time visitor sees. Target: shareable URL within 1-2 weeks."
