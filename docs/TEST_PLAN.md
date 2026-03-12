# Test Plan — Legacy Labs Migration

## Architecture Note

The legacy games (Melody, Rhythm, Strumming, Skratch Studio) use the browser's
Web Audio API / device sensors for input. They do **not** call the `/play` endpoint,
which is reserved for server-side sounddevice recording used by the core training
games (Relative Keys, Harmony, Chord ID). Score persistence for legacy games uses
`static/shared/progress.js` (localStorage).

---

## Routes

| Game | Route | Template |
|------|-------|----------|
| Melody Echo | `/melody` | `templates/melody.html` |
| Rhythm Training | `/rhythm` | `templates/rhythm.html` |
| Guitar Strumming | `/strumming` | `templates/strumming.html` |
| Skratch Studio | `/skratch` | `templates/skratch-studio.html` |

---

## Test Cases

### 1. Melody Echo — `/melody`

**Success:** The setup screen loads with mode/difficulty/key dropdowns. Clicking
"Start Playing" prompts for microphone permission. After granting, the game plays a
short melody and transitions to the singing phase with a live pitch indicator
displaying note names (e.g., `C4`, `G4`). Rounds advance and a score is shown at
the end.

**Check:**
- [ ] Page loads without console errors
- [ ] Microphone permission prompt appears on "Start Playing"
- [ ] Note names display in the live pitch indicator during singing phase
- [ ] Score screen shows points, accuracy, and best streak
- [ ] "Home" button navigates back to `/`

---

### 2. Rhythm Training — `/rhythm`

**Success:** The setup screen loads with a BPM tap-in button. Clicking "Start
Playing" starts the EKG-style metronome. The user can tap along; the game scores
timing accuracy. Results screen shows score and a "Home" button.

**Check:**
- [ ] Page loads without console errors
- [ ] `rhythm.js` loads (no 404 in Network tab)
- [ ] BPM tap-in sets tempo and updates the display
- [ ] Metronome visual runs during gameplay
- [ ] "Home" button navigates back to `/`

---

### 3. Guitar Strumming — `/strumming`

**Success:** The setup screen loads with a pattern selector and BPM controls.
Clicking "Start Playing" begins the scrolling strumming timeline. The game detects
device motion (or keyboard simulation) and scores up/down strokes against the
pattern. Results screen appears at end.

**Check:**
- [ ] Page loads without console errors
- [ ] Pattern selector populates with built-in patterns
- [ ] BPM slider and tap-in work correctly
- [ ] Scrolling timeline animates during play
- [ ] "Home" button navigates back to `/`

---

### 4. Skratch Studio — `/skratch`

**Success:** The full-screen block-based studio loads. The user can drag music
blocks into the workspace and click "Run" (or equivalent) to hear synthesized
audio output via the Web Audio API.

**Check:**
- [ ] Page loads without console errors
- [ ] `studio.js` and `studio.css` load (no 404s)
- [ ] Block palette renders in the sidebar
- [ ] Dragging blocks into the workspace works
- [ ] Playback produces audio
- [ ] "Home" button navigates back to `/`

---

## Sidebar (index.html)

**Success:** The home page at `/` shows a "Legacy Labs" section below the three
core games, with cards for Melody Echo, Rhythm Training, Guitar Strumming, and
Skratch Studio. Each card links to the correct route.

**Check:**
- [ ] All four legacy game cards visible on home page
- [ ] Each card href matches its route (`/melody`, `/rhythm`, `/strumming`, `/skratch`)
