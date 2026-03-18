# Tonnetz Project Status

**Last updated:** 2026-03-18
**Branch:** `education-layer`
**Last commit:** b3a5b4d — RKT7


---

## Completed

### Build Plan Phases
- [x] **Phase 1: Schema Migration** — content_type, difficulty, related_games, visualizations, creative_prompts added to all 33 topics
- [x] **Phase 2: Profile & Onboarding** — localStorage profile manager, onboarding UI, tips pill wired to profile
- [x] **Phase 4: Playful Lens** — DRAFT COMPLETE, NEEDS REFINEMENT. 12 topics have playful lens content. Review and polish before considering done.

### Shared Components (from tonnetz-keyboard-component.md)
- [x] RKT-1: `transforms.js` — PLR math, pitch utilities, interval utilities
- [x] RKT-2: `harmony-state.js` — pub/sub state model
- [x] RKT-3: `tonnetz-neighborhood.js` — SVG renderer (triangle + edge mode) + bugfixes
- [x] RKT-4: `keyboard-view.js` — highlight layer + bugfixes
- [x] RKT-5: Integration test page (`/test/shared`) — working, cleaned up

### Relative Key Trainer
- [x] RKT-6: Levels 1-2 (listen mode) + answer visibility fix
- [x] RKT-REFACTOR: Learn/Practice/Test 3-phase tab structure, 5-step Learn tutorial, shared Salamander sampler
- [x] Salamander sample URL fix (v1 suffix)
[x] RKT-7: Tier 2 "Find the Relative" — Learn/Practice/Test phases, tier selector, distractor generation, R transform animations



### Other
- [x] Clear All canvas bugfix (Skratch Studio)
- [x] MAX_CONTENT_LENGTH added to Flask config
- [x] Debug console.log statements stripped
- [x] CLAUDE.md added for Claude Code context

---

## In Progress

### Phase 4: Playful Lens — Refinement
- Content exists for 12 topics but needs quality review and polish
- Status: needs a review pass, not new writing


### Relative Key Trainer — Tier 2+
- Tier 1 and Tier 2 both have Learn/Practice/Test built
- Known text fix applied: "moves up a whole step" (Step 2 narration)
- Next: RKT-8 (Explore mode), then RKT-9 (levels 4-5), RKT-10 (education wiring)


---

## Not Started

### Build Plan Phases
- [ ] Phase 3: Auth & Persistence (Supabase, hybrid storage, API proxy)
- [ ] Phase 5: Intro Module ("Meet the Tonnetz" — 4 chapters, animated walkthrough)
- [ ] Phase 6: Starters, Paths, Hub (Skratch Studio starters, learning paths, Theory Hub page)
- [ ] Phase 7: Game Progression & Assessment (intro screens, level system, auto-assessment)
- [ ] Phase 8: Fog of War (Tonnetz grid as spatial progress map)
- [ ] Phase 9: Competency Graph (adaptive branching, skill-map.js, mode transitions)
- [ ] Phase 10: Puzzle Paths (new game — pathfinding, progression tracing, ear puzzles)

### Harmony Trainer Enhancements
- [ ] RKT-11: Add keyboard highlight layer
- [ ] RKT-12: Add collapsible Tonnetz panel
- [ ] RKT-13: Wire difficulty-dependent visual behavior

---

## Known Issues
- Sustain pedal bug: Organ/Synth in Skratch Studio (conflict between triggerAttackRelease and sustain state)
- "Clear All" clears blocks but does not reset canvas visuals
- `TonnetzNeighborhood.recenter()` doesn't internally call `HarmonyState.setTriad()` — callers must invoke both
- Full known issues list: `docs/KNOWN-ISSUES.md`

---

## Key Docs
- `docs/tonnetz-build-plan.md` — phased roadmap (10 phases)
- `docs/tonnetz-content-architecture.md` — content model and topic schema
- `docs/tonnetz-keyboard-component.md` — shared component spec (tasks RKT-1 through RKT-13)
- `docs/game-flow-pattern.md` — Learn → Practice → Test pattern
- `docs/puzzle-paths-spec.md` — Puzzle Paths game concept (NEW — add to repo)
- `docs/KNOWN-ISSUES.md` — tracked bugs and fixes
- `docs/AGENT_GUIDE.md` — Claude Code workflow conventions

---

## Update Checklist
After every work session:
1. Update "Last updated" date and "Last commit" hash
2. Move completed items from "In Progress" to "Completed"
3. Update "In Progress" with current state
4. `git add docs/STATUS.md && git commit -m "Update project status"`
