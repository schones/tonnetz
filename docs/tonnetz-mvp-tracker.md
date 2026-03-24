# Tonnetz MVP — Ship by April 20, 2026

**Goal:** A shareable URL you can hand to friends, musicians, and colleagues.
**Branch:** `education-layer` → merge to `main` for Railway deploy
**Budget:** ~12-16 Claude Code sessions (3-4 per week)

---

## How This Works

No daily schedule. When you sit down to work:
1. Pick from **Next Up** (top item unless energy says otherwise)
2. When done, move it to **Done** and update STATUS.md
3. If you add scope, something else moves to **After MVP**

---

## Next Up (in priority order)

### 1. Validate visual layer (today)
Test the visual layer in Harmony Trainer. Verify: toggle works,
Tonnetz nodes color correctly, particles spawn at circle-of-fifths
positions, no regressions in HarmonyState or TonnetzNeighborhood.
Fix anything broken before moving on — this touches shared components.
**~30 min testing, 1 session if fixes needed**

### 2. Backend API proxy
One Flask route that proxies API calls so keys aren't in client JS.
Already specced in `docs/auth-architecture.md` (Task 3.8 scope).
Non-negotiable before sharing a public URL.
**1 session**

### 3. Intro module — Chapter 1: Sound & Notes
Phase 5 Task 5.1 (scaffolding + chapter nav) and Task 5.2 (Chapter 1).
Animated SVG + Tone.js: what is sound, frequency → pitch, play notes,
hear intervals. This is the "hook" — if Chapter 1 isn't delightful,
visitors bounce.
**2 sessions (scaffold + content)**

### 4. Intro module — Chapter 2: Chords
Interactive triad building. Major vs minor by ear and by structure.
Play a chord, see it on a keyboard, hear the quality difference.
Builds on Chapter 1's note concepts.
**1 session**

### 5. Intro module — Chapter 3: The Tonnetz
The big reveal. Notes → chords → spatial arrangement. Animate the
transition from "chords as isolated things" to "chords as neighbors
on a grid." This is where the platform's core concept clicks.
Reuses TonnetzNeighborhood component.
**1-2 sessions (animation complexity is the variable)**

### 6. Intro module — Chapter 4: Transforms
P/L/R as movements on the grid. Interactive: click a transform,
watch one note move, hear the new chord. "Now you know how to
navigate the Tonnetz — go play." Links to Chord Walks and Explore.
**1 session**

### 7. Scale Explorer
New tool/game: pick a root, see the scale laid out on the Tonnetz
and keyboard simultaneously. Toggle major/minor/modes. Hear each
scale degree. Show interval pattern (W-W-H-W-W-W-H). Leverages
TonnetzNeighborhood, KeyboardView, HarmonyState, Tone.js — all
built. Design session in claude.ai first, then 1-2 build sessions.
**1 design + 1-2 build sessions**

### 8. Visual layer — wire into remaining games
Add the visual toggle to Chord Walks and Scale Explorer (once built).
Verify it works in each context. Quick integration pass.
**1 session**

### 9. Polish pass — landing page & navigation
First-visit experience: does the landing page make sense? Is navigation
between games/tools/intro clear? Does onboarding flow into intro module
naturally? Fix any rough edges, broken links, confusing UI. This is the
"pretend you've never seen this before" session.
**1-2 sessions**

### 10. Pre-launch security & deploy
Security review: no exposed keys, proxy working, no debug endpoints.
Merge education-layer → main. Verify Railway deploy. Test the live URL.
**1 session**

---

## Done

- [x] Visual layer system (prompt running — 2026-03-23)
- [x] Voice instrument support (Harmony Trainer + Skratch Studio)
- [x] Chord Walks — all 4 tiers, Learn/Practice/Test, Explore mode
- [x] Harmony Trainer with tips pill, education wiring
- [x] Skratch Studio — Blockly + audio + music creation blocks
- [x] Onboarding & profile system (localStorage)
- [x] Theory Hub page
- [x] Shared components: transforms.js, harmony-state.js, tonnetz-neighborhood.js, keyboard-view.js
- [x] Backlog items B1-B3, B5-B7, B11
- [x] STATUS.md established as source of truth

---

## After MVP (good ideas, not now)

- Auth & Supabase (Phase 3) — no users yet, no need for persistence
- Playful lens refinement — content exists, polish later based on feedback
- Competency Graph (Phase 9) — adaptive system for repeat users
- Puzzle Paths (Phase 10) — great game, needs competency graph first
- Fog of War (Phase 8) — spatial progress map, needs game progression
- Game Progression & Assessment (Phase 7) — level systems, auto-assessment
- MIDI input via Launchkey 49
- Loop pedal for Skratch Studio
- Sustain pedal fix (Skratch Studio Organ/Synth)
- B8: Practice vs Test redesign
- B9: Major/minor chord colors
- B10: Playable input as assessment
- Learn → scaffold → quiz shared framework (extract after more games adopt the pattern)
- Mobile optimization
- AI tutor feedback — wire session analysis into Melody Match and Strumming via /api/chat proxy


---

## Scope Rules

**To add something, cut something.** The session budget is fixed.

**If behind:** Simplify Chapter 3 animation (crossfade instead of morph).
Scale Explorer can ship as view-only (no quiz/practice mode).
Polish pass can be minimal.


**If ahead:** Pull in B9 (chord colors on Tonnetz). Add a simple
"about this project" page. Wire visual layer into Skratch Studio too.
Add AI tutor feedback to Melody Match and/or Strumming — session
data summary → /api/chat → actionable musical advice. Proxy is
already built.

---

## When Sharing

Before sending the URL to anyone:
- [ ] Backend proxy is live (no exposed API keys)
- [ ] Intro module all 4 chapters working
- [ ] Landing page → onboarding → intro → games flow is smooth
- [ ] Test on someone else's browser/device at least once
- [ ] No console errors on any page
