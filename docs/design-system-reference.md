# SongLab Redesign — Implementation Plan

## Design System Summary

### Two Modes
- **Light/warm**: Landing page, games, song browser, onboarding
- **Dark/DAW**: Explorer, Skratch Studio

Both share the same accent colors, typography, and component patterns. Controlled via `data-theme="light"` or `data-theme="dark"` on `<body>`.

### Color Tokens

```css
/* === SHARED ACCENTS === */
--accent-gold: #D4A03C;
--accent-gold-dim: rgba(212, 160, 60, 0.1);
--accent-blue: #2D5F8A;
--accent-blue-bright: #3A8BC9;
--accent-blue-text: #7BBDE8;
--accent-blue-dim: rgba(45, 95, 138, 0.2);
--accent-coral: #E87461;
--accent-coral-text: #F0A899;
--accent-coral-dim: rgba(232, 116, 97, 0.2);
--accent-green: #4CAF50;
--accent-green-text: #7BC67E;
--accent-green-dim: rgba(76, 175, 80, 0.1);
--accent-red: #C62828;
--transport-green: #2E7D32;

/* === DARK THEME (Explorer, Skratch Studio) === */
--dark-bg-deep: #141310;
--dark-bg-base: #1B1A17;
--dark-bg-surface: #181714;
--dark-bg-raised: #222120;
--dark-bg-input: #242220;
--dark-border: rgba(255, 255, 255, 0.05);
--dark-border-hover: rgba(255, 255, 255, 0.1);
--dark-text-primary: #E8E6DF;
--dark-text-secondary: #8A8880;
--dark-text-tertiary: #6B6860;
--dark-text-muted: #4A4840;
--dark-text-ghost: #3A3830;
--dark-dot-grid: rgba(255, 255, 255, 0.02);

/* === LIGHT THEME (Landing, Games) === */
--light-bg-page: #FAF9F6;
--light-bg-surface: #FFFFFF;
--light-bg-raised: #F5F4F0;
--light-bg-input: #F0EFE9;
--light-border: rgba(0, 0, 0, 0.06);
--light-border-hover: rgba(0, 0, 0, 0.12);
--light-text-primary: #2C2C2C;
--light-text-secondary: #6B6B68;
--light-text-tertiary: #9B9B96;
--light-text-muted: #B0AEA6;

/* === CHORD QUALITY COLORS === */
/* Used on Tonnetz nodes, keyboard highlights, walkthrough badges */
/* Current chord gets the full treatment (fill + stroke + glow) */
/* Previous chord gets ghost treatment (dashed stroke, low opacity) */
--chord-major-fill: var(--accent-blue-dim);
--chord-major-stroke: var(--accent-blue-bright);
--chord-major-text: var(--accent-blue-text);
--chord-minor-fill: var(--accent-green-dim);
--chord-minor-stroke: var(--accent-green);
--chord-minor-text: var(--accent-green-text);
--chord-borrowed-fill: var(--accent-coral-dim);
--chord-borrowed-stroke: var(--accent-coral);
--chord-borrowed-text: var(--accent-coral-text);
```

### Typography
```css
/* Primary: system sans-serif stack, no custom font load needed initially */
/* Heading font: Nunito or Poppins (load via Google Fonts for landing page) */
--font-heading: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Fluid sizing */
--text-xs: clamp(10px, 0.9vw, 11px);
--text-sm: clamp(11px, 1vw, 13px);
--text-base: clamp(13px, 1.1vw, 15px);
--text-lg: clamp(15px, 1.3vw, 18px);
--text-xl: clamp(18px, 1.5vw, 22px);
--text-2xl: clamp(22px, 2vw, 28px);

/* Weights: 400 regular, 500 medium only */
```

### Spacing & Radius
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-pad: 10px;  /* MIDI pad corners */

--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
--space-2xl: 32px;
```

### Key Interaction Patterns
- **Tonnetz nodes**: Pulse animation on active chord tones (2s ease-in-out infinite)
- **Glow worm path**: Opacity pulse (0.4 → 0.7, 2s ease-in-out infinite)
- **Ghost trail**: Previous chord's triangle + path at ~20% opacity, dashed stroke
- **MIDI pads**: scale(1.02) on hover, scale(0.98) on active
- **Walkthrough steps**: slideIn animation (translateY 6px → 0, 0.3s ease-out)
- **Progress bar**: width transition 0.6s ease
- **Buttons**: transition all 0.12s

---

## Implementation Order

### Phase 1: Design System Foundation (1 session)
Create the CSS custom properties file and apply to base.html:
1. Create `static/css/design-tokens.css` with all variables above
2. Add `data-theme` attribute logic to base.html
3. Dark theme for: explorer.html, skratch-studio.html
4. Light theme for: index.html, all game pages, theory pages

### Phase 2: Landing Page Redesign (1 session)
Apply the warm light theme + MIDI pad layout:
1. Restyle index.html with warm background, rounded cards
2. Song pads grid (colored, 4-column) pulling from song-examples.js
3. Tool pads (white cards) and game pads
4. SongLab branding in nav (logo + name)
5. "Browse all songs" pad linking to a future song browser

### Phase 3: Explorer Redesign (2-3 sessions)
The big one — apply the DAW-style dark theme:
1. Nav bar with transport controls (play/stop), song info bar
2. Walkthrough sidebar replacing overlay bubble
3. Tonnetz panel with glow/pulse animations, ghost trails
4. Keyboard panel restyled
5. Panel switcher (Tonnetz / Chord wheel / Fretboard tabs)
6. Status bar with panel toggles, record button
7. Responsive: stack sidebar below Tonnetz on mobile

### Phase 4: Skratch Studio Redesign (1-2 sessions)
DAW-style dark theme matching Explorer:
1. Transport bar (play/stop/BPM/key/bar)
2. Sidebar block categories
3. Right channel strip (instrument/keyboard/volume/sustain/loop)
4. Status bar with import info
5. Blockly theme customization (tighter blocks, matching colors)

### Phase 5: Games & Remaining Pages (1 session)
Light theme application:
1. Scale Builder, Chord Walks, Swing Trainer, Chord ID
2. Theory pages (circle of fifths, modes, etc.)
3. Consistent card/button styling

### Phase 6: Branding & Polish
1. SongLab logo refinement
2. Rename "Music Theory Games" → "SongLab" across all pages
3. Favicon update
4. Meta tags / Open Graph for sharing
5. Domain setup (songlab.app or similar)

---

## Claude Code Prompts

### Phase 1 Starter Prompt
```
Create a new file static/css/design-tokens.css with CSS custom properties
for the SongLab redesign. Two themes: light and dark.

Use data-theme="light" and data-theme="dark" on the html element.
Dark is the default for Explorer and Skratch Studio pages.
Light is the default for the landing page and game pages.

Include tokens for:
- Background colors (deep, base, surface, raised, input) for both themes
- Text colors (primary, secondary, tertiary, muted, ghost) for both themes
- Border colors for both themes
- Accent colors shared across themes: gold (#D4A03C), blue (#2D5F8A/#3A8BC9),
  coral (#E87461), green (#4CAF50), red (#C62828), transport green (#2E7D32)
- Chord quality colors: major (blue family), minor (green family),
  borrowed/augmented (coral family)
- Typography: fluid font sizes using clamp(), two weight scale (400, 500)
- Spacing scale: xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32)
- Border radius scale: sm(4) md(6) lg(8) xl(12) pad(10)
- Transition defaults

Then update templates/base.html to:
1. Link the new design-tokens.css
2. Add a data-theme attribute (default "light")

Then update templates/explorer.html and templates/skratch-studio.html
to set data-theme="dark" on their html element.

Don't change any other styling yet — just establish the foundation.
```
