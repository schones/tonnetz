# SongLab Redesign Spec — Landing Page & Information Architecture

**Date:** April 6, 2026
**Status:** Ready to build
**Branch:** dev

---

## North Star

**Help people become better musicians.** Tonnetz is not a theory textbook — it's a set of tools and games that happen to teach theory while being genuinely useful and fun. The word "theory" should never appear in user-facing UI.

## Target Audience

**Primary:** Musicians with some knowledge who find this a fun way to brush up — or who use the tools directly (e.g., Explorer for understanding voicings, ear training for sharpening perception).

**Secondary:** Music teachers who pull up tools during lessons. One teacher adopting = 20-30 students. The platform should be the kind of thing a teacher texts a link to.

---

## Landing Page Redesign

### Hero Section

**Tagline:** "Harmony has a shape. Explore it." (or similar — avoid the word "theory")

**Subtitle:** Something like: "Great musicians navigate harmony by instinct. The Tonnetz is the map of that territory — a spatial way to see how chords, keys, and scales connect. Build the intuition faster."

**Key principle:** Respect the musician. You already have instincts; this helps you understand and extend them.

### Rotating Song Example Prompts

Below the tagline, a rotating card (auto-advances every ~6 seconds, pausable, dot-navigable) that surfaces real questions grounded in the song-examples.js database. Each prompt has:

- A question a musician actually has
- A one-sentence answer referencing a real song
- A CTA to open the Explorer (or relevant tool)

**Curated prompts (8 to start, expandable):**

1. "Why does Am feel so close to C major?" → Eleanor Rigby, R transform
2. "What makes the Creep progression hit so hard?" → Radiohead, chromatic mediant / L transform
3. "How does a ii→V→I actually move?" → Autumn Leaves / Fly Me to the Moon
4. "Why does Mixolydian sound bluesy?" → Norwegian Wood / Get Lucky
5. "How does Stairway to Heaven shift mood?" → P transform, parallel major/minor
6. "What's a deceptive cadence, and why does it work?" → In My Life, V→vi
7. "Why do I→IV→V songs all feel related?" → Johnny B. Goode / twelve-bar blues
8. "How does Yesterday's bass line create emotion?" → chromatic voice leading

**Implementation note:** These are static/curated for now. Each should eventually deep-link to the Explorer pre-loaded with the relevant chord/progression so the user sees the answer immediately.

### Explorer Preview

Below the rotating prompts, a 3-panel visual preview (Tonnetz grid, chord wheel, keyboard) showing a C major chord highlighted across all three. Click anywhere → opens the real Explorer.

This is the centerpiece of the page. It should feel immediately interactive and visually striking.

### Category Grid (2×2)

Section header: **"Become a better musician"** / sub: "Sharpen your ear, deepen your understanding, build your rhythm — all in one place."

Four categories, each with a color accent, short description, and pill-links to tools within:

#### 1. Visualize (green accent)
"See how chords, keys, and scales relate in space. Compare voicings, trace progressions, build intuition."
- Tonnetz Explorer
- Voicing Explorer
- Fretboard (when ready)

#### 2. Ear Training (pink accent)
"Recognize intervals, identify chord qualities, match melodies, internalize swing feel."
- Harmony Trainer
- Chord Spotter
- Melody Match
- Swing Trainer

#### 3. Rhythm & Creation (gold accent)
"Lock in your groove, learn patterns, build something new from scratch."
- Rhythm Lab
- Strum Patterns
- Skratch Studio

#### 4. Patterns (blue accent)
"Understand what's underneath — scales, keys, modes, transforms, progressions."
- Scale Builder
- Chord Walks
- Circle of Fifths
- Modes
- Chord Progressions

### Fundamentals Link

Single line at bottom: "Brand new to this? Start from the beginning — five interactive chapters, no prior knowledge needed."

Links to /intro. Not prominent, not a gate. Just a gentle pointer.

---

## Navigation Restructure

Current nav: Theory ▾ | Explorer | Practice Games ▾ | Skratch Studio | Start Here | Tour

**New nav:**

```
Explorer | Ear Training | Rhythm & Play | Patterns | Fundamentals
```

- **Explorer** → /explorer (hero position, always visible)
- **Ear Training** → dropdown: Harmony Trainer, Chord Spotter, Melody Match, Swing Trainer
- **Rhythm & Play** → dropdown: Rhythm Lab, Strum Patterns, Skratch Studio
- **Patterns** → dropdown: Scale Builder, Chord Walks, Circle of Fifths, Modes, Chord Progressions
- **Fundamentals** → /intro

No "Tour" or "Start Here" in top nav. Fundamentals is the gentler version.

---

## Song Examples Integration

The song-examples.js database (73 entries) should be surfaced contextually throughout the platform, not just on the landing page:

### Where songs add value

- **Explorer:** When a chord or progression is selected, show a "Hear this in..." tag with relevant songs. Tap to hear the demo or read the insight.
- **Chord Spotter:** After identifying a chord quality, show "You hear this in [song]" with the musician-level insight.
- **Chord Walks:** After completing a PLR transform, show which real songs use that exact transform (P_transform → Stairway to Heaven, R_transform → My Funny Valentine, L_transform → Creep).
- **Scale Builder / Modes pages:** When a mode is introduced, surface the songs that use it (Mixolydian → Norwegian Wood, Get Lucky; Dorian → relevant entries; Phrygian → relevant entries).
- **Swing Trainer:** Tie swing ratios to specific songs from the database (already has swing_ratio field in demo data).
- **Chord Progressions page:** Already has By Pattern / By Song tabs — ensure song-examples.js is the data source.
- **Strum Patterns:** Could feature actual song patterns where available.

### How to surface them

- Small, non-intrusive: a 🎵 icon or "Heard in..." pill that expands on tap
- Use the `insight.musician` level text by default (not playful, not theorist)
- Include the Tone.js demo data for playback where available
- Respect `min_age` and `era_tags` if/when user preferences are implemented

---

## What's NOT changing (yet)

- No auth/accounts (still localStorage for MVP)
- No new tools being built in this pass (Voicing Explorer, fretboard are separate work items)
- Skratch Studio keeps its own nav/chrome (it's effectively a sub-app)
- Intro course content stays as-is, just repositioned as "Fundamentals"
- Song database stays static (no preference matching in this pass)

---

## Implementation Order

1. **Landing page** — new hero, rotating prompts, Explorer preview, category grid, fundamentals link
2. **Nav restructure** — new top nav with dropdowns matching the four categories
3. **Song example hooks** — start with Explorer and Chord Walks (highest-value placements), then expand to other games/pages

---

## Reference

- **Mockup:** tonnetz-landing-v2.html (attached)
- **Song database:** static/shared/song-examples.js (73 entries)
- **Current site:** https://tonnetz-production.up.railway.app/
