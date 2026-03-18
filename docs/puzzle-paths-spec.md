# Puzzle Paths — Concept Spec

## Overview

Puzzle Paths is a new standalone game in the Tonnetz suite. The player navigates the Tonnetz graph from a start chord to a target chord (or through a sequence of chords) using neo-Riemannian transformations (P, L, R). It reframes music theory knowledge as spatial problem-solving and connects abstract transformations to real musical progressions.

## Core Mechanic

The player sees a Tonnetz neighborhood with a highlighted start chord and one or more target chords. They select destination chords to build a path. Each step is heard as a chord transition. When the path is complete, the full progression plays back.

### Compound Moves

Many real musical progressions involve chord relationships that aren't single P/L/R transformations — they require 2+ moves on the Tonnetz (e.g., I→IV). This is handled as follows:

- **The player selects the destination chord** — they're thinking musically, choosing chords, not executing individual transformations
- **The Tonnetz animates the path** through each intermediate node, showing the individual P/L/R steps it took to get there in real time
- **Transformation labels appear along the trail** after the animation completes — ambient information, not a quiz

This means the interaction feels musical (pick the chord you want) while the visualization is educational (see the geometric decomposition). Over time, the player internalizes the shapes of common compound moves ("I→IV always traces that same path") without it feeling like a drill.

## Puzzle Types

### 1. Pathfinding Puzzles
- **Given:** Start chord, target chord, optional move constraint
- **Goal:** Find a valid path (or the shortest path, or a path in exactly N moves)
- **Example:** "Get from C major to E♭ major in 2 moves"
- **What it teaches:** Transformation chaining, Tonnetz topology, multiple solutions to the same problem

### 2. Progression Tracing Puzzles
- **Given:** A real musical progression (heard and/or named)
- **Goal:** Trace the chord-by-chord path on the Tonnetz
- **Example:** "Trace this blues turnaround: C–F–C–G–F–C (I–IV–I–V–IV–I)"
- **What it teaches:** How familiar progressions map to Tonnetz geometry, pattern recognition across keys
- **Compound moves in action:** The player selects F as the next chord from C. The Tonnetz animates through the intermediate transformations to show how I→IV is decomposed, then the player continues to the next chord in the sequence.

### 3. Ear-Based Puzzles
- **Given:** An audio playback of a progression (chords not labeled)
- **Goal:** Listen, identify the chords, and trace the path
- **Example:** Player hears a I–vi–IV–V and must find the path by ear
- **What it teaches:** Aural recognition combined with spatial reasoning

### 4. Constraint Puzzles
- **Given:** Start chord, target chord, and a rule
- **Goal:** Find a valid path that obeys the constraint
- **Examples:**
  - "Get from A minor to C major without using the P transformation"
  - "Build a path that only uses L and R"
  - "Find a 4-chord path where every chord is minor"
- **What it teaches:** Deeper understanding of what each transformation does and doesn't do

## Progression Library

A curated library of real-world progressions mapped to Tonnetz paths. These give Progression Tracing puzzles their musical grounding.

### Example Entries

| Name | Progression | Degrees | Notes |
|------|------------|---------|-------|
| Blues Turnaround | C–F–C–G–F–C | I–IV–I–V–IV–I | Foundation of 12-bar blues; each step involves compound moves |
| 50s Doo-Wop | C–Am–F–G | I–vi–IV–V | The "Heart and Soul" progression; I→vi is a single L transformation |
| Axis of Awesome | C–G–Am–F | I–V–vi–IV | Powers hundreds of pop songs; mix of compound and single moves |
| Andalusian Cadence | Am–G–F–Em | i–VII–VI–v | Flamenco/classical descending pattern |
| Creep Progression | G–B–C–Cm | I–III–IV–iv | The IV→iv step is a single P transformation — a great "aha" moment |
| Jazz ii-V-I | Dm–G–C | ii–V–I | The most common jazz cadence |
| Pachelbel's Canon | D–A–Bm–F♯m–G–D–G–A | I–V–vi–iii–IV–I–IV–V | Long progression that traces a rich path across the Tonnetz |

### Progression Library Design

- Progressions tagged by genre, difficulty, and which transformations they emphasize
- Each progression available in all 12 keys (transpose the Tonnetz view)
- "Real world" context blurbs: where this progression shows up in actual music, specific song examples
- Library stored as a JSON/JS data file, similar to `theory-content.js` pattern — extensible without code changes

## Difficulty & Competency Integration

### Entry Level
- 2-chord pathfinding with single P/L/R moves
- "Which transformation turns C major into C minor?" (essentially a tutorial)
- Compound move animations are slow and clearly labeled

### Developing
- 3–4 chord pathfinding puzzles
- Simple progression tracing (doo-wop, axis)
- Introduction of compound moves as musical steps
- Compound move animations at moderate speed

### Intermediate
- Ear-based puzzles with common progressions
- Constraint puzzles with simple rules
- Blues turnarounds and jazz cadences
- Puzzles in less familiar keys

### Advanced
- Longer progressions with compound moves (Pachelbel, extended jazz)
- Constraint puzzles with multiple rules
- Ear-based puzzles with less common progressions
- "Scenic route" challenges: find the longest interesting-sounding path
- Compound move animations fast or optional (player has internalized the paths)

### Competency Graph Hooks
- Puzzle Paths queries the competency graph for demonstrated skills (triad identification, transformation recognition, relative/parallel key awareness)
- Prerequisite skills gate puzzle types: ear-based puzzles require demonstrated aural identification from Harmony Trainer
- Completed puzzles feed back into the competency graph: "user can chain L+R transformations," "user recognizes blues turnaround by ear"
- Animation speed of compound moves could be competency-gated: slow when learning, fast once internalized

## UI/UX Concept

### Core View
- Tonnetz neighborhood (reuse `TonnetzNeighborhood` SVG renderer from Relative Key Trainer)
- Start chord highlighted in one color, target chord(s) in another
- Player clicks/taps destination chords on the Tonnetz (not transformation buttons)
- Compound moves animate through intermediate nodes with transformation labels appearing along the trail
- Each step plays chord audio during animation
- Path traces visually as a persistent line/trail connecting all visited chords
- "Play full path" button to hear the complete progression

### Puzzle Presentation
- Each puzzle has a brief setup: name, type, and any constraints
- For Progression Tracing: genre tag, real-world context blurb, optional audio preview of the target progression
- For Ear-Based: audio playback controls, no chord labels until solved
- For Constraint: constraint displayed prominently, invalid moves grayed out or gently blocked

### Feedback
- On completion: full progression playback with path visualization, transformation summary, and "real world" context note
- Multiple valid solutions acknowledged: "You found a 3-move path. There's also a 2-move path — want to try?"
- For progression tracing: comparison between player's path and the "standard" path if they differ

### Skratch Studio Bridge
- After completing a puzzle, offer: "Explore this progression in Skratch Studio"
- Pre-loaded Skratch canvas with the progression as blocks, ready to modify/extend
- This is the learn → create loop

## Relationship to Other Games

| Game | What it teaches | How Puzzle Paths extends it |
|------|----------------|---------------------------|
| Harmony Trainer | Chord identification | Puzzle Paths uses identification as a building block for navigation |
| Relative Key Trainer | Relative major/minor | L transformation is one move type in Puzzle Paths |
| Chord Spotter | Chords in context | Progression tracing shows how chords connect in real music |
| Skratch Studio | Free creation | Puzzle Paths provides structured starting points for exploration |

## Technical Notes

- Tonnetz graph traversal logic lives in shared `transforms.js` (from task 10.1)
- Progression library as a JSON/JS data file, following `theory-content.js` pattern
- Pathfinding: need a shortest-path (BFS) function over the Tonnetz graph for validation and for computing compound move intermediate steps
- Compound move decomposition: given two chords, compute the optimal P/L/R sequence connecting them — this is the core algorithm that powers the animated path tracing
- Audio: reuse existing chord playback infrastructure from Harmony Trainer
- Animation: stepped animation system that walks through intermediate nodes with configurable speed
- State: puzzle progress (current position, path history, moves remaining) managed in game state, competency updates sent to skill-map system

## Open Questions

1. **Multiplayer/social potential:** Could puzzle paths have a leaderboard (fewest moves, fastest time)? Worth considering but not for v1
2. **Procedural generation:** Can puzzles be generated algorithmically, or should they all be hand-curated? Pathfinding and constraint puzzles lend themselves to generation; progression tracing puzzles need curation
3. **Key selection:** Always start in C, or randomize? Randomizing keys is musically better but adds cognitive load. Could be competency-gated (start in C/G/F, expand as skills develop)
4. **Optimal decomposition:** For compound moves, there may be multiple P/L/R paths between two chords. Which path does the animation show? Shortest? Most musically intuitive? This needs exploration once the graph traversal code is in place.
