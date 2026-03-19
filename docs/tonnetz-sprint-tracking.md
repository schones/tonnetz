# Tonnetz Build Sprint — Tracking Sheet (Revised 2026-03-18)

**Start date:** 2026-03-18
**Target completion:** ~22 working days (3-4 weeks)

**Daily pace:** 3 Claude Code sessions/day (sustainable push)
**Workflow:** Plan in claude.ai → Build with Claude Code (Antigravity) → Gemini review → Dustin manages git

**After every session:** Update `docs/STATUS.md` and commit it with your work

---

## Day 1 (2026-03-18) — DONE ✅

### Completed
- RKT-7 — Tier 2 "Find the Relative" (Learn/Practice/Test)
- RKT-8 — Explore mode (P/R/L buttons, breadcrumb trail, depth control)
- RKT-9 — Tiers 3-4 (PLR identification + chained transforms)
- RKT-10 — Education layer wiring (tips pill, tooltips, intro screen)
- Phase 3 Task 3.1 — Auth architecture doc (`docs/auth-architecture.md`)
- Bugfixes: dismissIntro async race condition, intro screen fallback, piano dynamics (gain-based volume variation)

### Relative Key Trainer Checkpoint: ✅
All 4 tiers playable, Learn/Practice/Test flow works, audio solid, explore mode functional.

### Notes
- Intro screen HTML element may be missing/misnamed — fallback in place (see B11)
- Salamander sampler only loads one velocity layer — dynamics via `sampler.volume.setValueAtTime()`
- Identified improvement items during testing → see Backlog

---

## Day 2 (2026-03-19, Thursday) — Quick Fixes + Phase 4

**Goal:** High-impact fixes to the game you just built. Phase 4 review in chat.

| Session | Task | Details |
|---------|------|---------|
| 1 | **B1** | Audio bleed fix — see Backlog |
| 2 | **B2** | Keyboard highlights in Learn mode — see Backlog |
| 3 | **B3** | Common tone colors (blue/orange) — see Backlog |

### In chat (between sessions):
- Phase 4 playful lens review — upload `theory-content.js`, review 12 topics
- **B7** — Game title brainstorm (decide in chat, implement in 10 min)

---

## Day 3 (2026-03-20, Friday) — Medium Fixes + Phase 4 Wrap

**Goal:** Finish the polish items that make the game feel complete.

| Session | Task | Details |
|---------|------|---------|
| 1 | **B6** | Teaching bubbles in Practice — see Backlog |
| 2 | **B5** | Tonnetz recenter animation — see Backlog |
| 3 | **B11** | Intro screen fix — see Backlog |

### In chat:
- Finish Phase 4 review if not done Thursday
- **B8** — Practice vs. Test differentiation brainstorm (feeds into Phase 7 design)

---

## Day 4 (2026-03-21, Saturday) — Phase 5 Start

**Goal:** Begin the intro module. Morning coffee session to get scaffolding up.

| Session | Task | Details |
|---------|------|---------|
| 1 | Phase 5 Task 5.1 | Intro module scaffolding and chapter navigation |
| 2 | Phase 5 Task 5.2 | Chapter 1: Sound & Notes (animated SVG + Tone.js) |
| 3 (if energy) | Phase 5 Task 5.3 | Chapter 2: Chords (interactive triad building) |

---

## Days 5-8 — Phase 5 Complete + Phase 3 Implementation

### Phase 5 (continued)
- Task 5.4 — Chapter 3: Tonnetz grid reveal
  - ⚠️ Timebox: If morph isn't smooth after 2 sessions, ship crossfade
- Task 5.5 — Chapter 4: P/R/L transforms playground

### Phase 3 Implementation (after B8 Practice/Test design settles)
- 3.2 — Supabase project setup, auth providers, SQL tables
- 3.3 — `supabase-client.js` + Flask env var injection
- 3.4 — `auth-ui.js` (login modal, session management)
- 3.5 — `user-profile.js` refactor (write-through + merge)
- 3.6 — First-login migration flow
- 3.7 — Flask `auth.py` + JWT decorator
- 3.8 — Flask `/api/proxy` route
- 3.9 — `competency_snapshots` table + write path
- 3.10 — Security review pass

**Decision:** Phase 3 implementation depends on the B8 brainstorm outcome. Assessment model affects what data gets persisted. Don't build persistence until the thing being persisted is stable.

---

## Weeks 2-4 — Unchanged from original plan

Days 9-22: Harmony Trainer enhancements, Starters, Paths, Hub, Game Progression, Competency Graph, Puzzle Paths, Fog of War.

---

## Backlog

All improvement items live here with full descriptions. Daily plans reference by number.

### Quick fixes (< 1 session each)

**B1 — Audio bleed between phase transitions** `→ Day 2`
Add cancellation token pattern to `playProgression` (like `learnPlaybackId` but global). Stops audio bleeding when user jumps between Learn → Practice → Test. Increment a playback generation ID on phase switch; check it before each chord fires.

**B2 — Keyboard highlights during Learn playback** `→ Day 2`
Update Learn scripts to populate `HarmonyState.activeNotes` with actual voicing notes (with octaves) during playback. Player sees which keys are being played in real time. Also benefits Practice mode.

**B3 — Common tone colors (blue/orange instead of green)** `→ Day 2`
Change `showCommonTones` and `showMovingTone` rendering in `tonnetz-neighborhood.js` and `keyboard-view.js`. Blue for held notes, orange for moving notes. Applies to Tiers 2-4 transforms.

**B4 — Skratch Studio sustain in loop playback** `Not scheduled`
Known bug: sustained piano notes lose sustain on loop playback. Root cause is conflict between `triggerAttackRelease` in `music-engine.js` and sustain state in `audio-bridge.js`. The "sit down with coffee" fix.

### Medium effort (1-2 sessions each)

**B5 — Tonnetz recenter animation** `→ Day 3`
Animate SVG viewBox or group transform over ~400ms instead of snapping. Need to check how `TonnetzNeighborhood.recenter()` works internally — if it redraws from scratch, requires refactoring to translate existing nodes. Spec before building.

**B6 — "Did you notice" teaching bubbles in Practice** `→ Day 3`
Trigger after round 3-4 of Tier 2 Practice. Show a dismissible tooltip/bubble with insight: upward triangle = major (warm color), downward triangle = minor (cool color). Small UI component positioned near the Tonnetz + trigger condition in practice loop.

**B7 — Game title rename** `→ Day 2 chat`
"Relative Major & Minor" doesn't cover Tiers 3-4. Options: "Tonnetz Trainer," "Transform Trainer," "Chord Connections," or keep "Relative Major & Minor" as Tier 1-2 subtitle with a broader game name. Relative key concept stays front-and-center as the entry point. Naming decision in chat, 10-minute code change.

**B11 — Intro screen fix** `→ Day 3`
The `intro-screen` HTML element from RKT-10 is missing or misnamed. Currently bypassed by fallback in start overlay handler. Fix the HTML, verify the intro screen shows on first visit, then remove the fallback workaround.

### Design conversations (brainstorm → spec → build)

**B8 — Practice vs. Test differentiation** `→ Day 3 chat`
Current Practice and Test modes feel too similar. Tonnetz hidden in Test removes the main learning tool. Directions to explore: Practice keeps full scaffolding, Test removes it progressively. Or: drop Test entirely and make Practice adaptive (harder as streak grows = the assessment). Connects to competency graph work. **Must resolve before Phase 3 implementation** — assessment model affects what data gets persisted.

**B9 — Major/minor chord colors on Tonnetz** `Not scheduled`
Subtle color differentiation: warm tint (amber/gold) for major triads, cool tint (blue/indigo) for minor on the Tonnetz. Precedent: Hooktheory uses warm/cool. Scales to diminished (gray?) and augmented (purple?) later. Prototype before committing. Avoid gimmicky.

**B10 — Playable input as assessment (MIDI/click/voice)** `Not scheduled`
Three input modes: MIDI keyboard (Web MIDI API), click-to-play on-screen keyboard (partially built in Explore mode's `keyboardMode: 'both'`), voice/singing (reuse Harmony Trainer pitch detection). Test becomes: "Play the relative minor of C major." Architecture already exists. Phase 7+ feature, needs dedicated brainstorm.

---

## Scope Management

### If ahead of schedule:
- Pull B4 (Skratch sustain fix) into current week
- Pull B9 (chord colors) into design conversation
- Start B10 (playable input) spec

### If behind schedule:
- **First to defer:** Phase 8 (Fog of War) — platform fully functional without it
- **Second to simplify:** Phase 5 Task 5.4 — crossfade instead of morph animation
- **Third to reduce:** Phase 10 Task 10.5 — ship with just pathfinding + progression tracing
- **Don't cut:** Phase 9 (Competency Graph) — makes existing games not boring
- **Backlog items B4-B11** can all slide without affecting core functionality

---

## Project Management Practices

### After Every Session
- Update `docs/STATUS.md` — move items, note what's in progress
- Commit STATUS.md with your work
- Takes 60 seconds, saves hours of reconstruction later

### Weekly (15 min)
- Compare `docs/STATUS.md` against `git log --oneline -20`
- Compare against `docs/tonnetz-build-plan.md`
- Fix any drift

### When Scope Changes
- Update `docs/tonnetz-build-plan.md` in the same session
- Update `docs/STATUS.md` to reflect new/changed phases
- If task numbering changes, update all references

### Starting a Claude.ai Session
- Upload `docs/STATUS.md` — gives Claude instant context
- Upload relevant spec docs for the topic at hand

### Starting a Claude Code Session
- `CLAUDE.md` already points to `docs/` — reads STATUS.md automatically
- One task per session
- End with "Do not commit — I will handle git myself"

---

## Daily Session Template

```
Date: ___________
Day #: ___

Session 1:
  Task: ___________
  Status: [ ] started  [ ] complete  [ ] needs follow-up
  Notes: ___________

Session 2:
  Task: ___________
  Status: [ ] started  [ ] complete  [ ] needs follow-up
  Notes: ___________

Session 3:
  Task: ___________
  Status: [ ] started  [ ] complete  [ ] needs follow-up
  Notes: ___________

Blockers: ___________
Tomorrow's priority: ___________
STATUS.md updated: [ ]
```
