/**
 * visual-config.js
 * ================
 * Color tables, presets, and VisualConfig state object for the
 * Tonnetz Visual Layer system.
 *
 * Pure data/state — zero DOM dependencies. Safe to import in any context.
 *
 * Exports: PITCH_COLORS, QUALITY_MODIFIERS, VISUAL_PRESETS, VisualConfig
 */

// ════════════════════════════════════════════════════════════════════
// PITCH → HUE (circle of fifths as hue wheel)
// ════════════════════════════════════════════════════════════════════

/**
 * Maps pitch class (0–11) to hue in degrees.
 * Adjacent entries on the circle of fifths share adjacent hues (30° apart).
 * P5-related notes cluster visually; major-third pairs differ by 120°.
 *
 * Ordering:  C  G  D  A  E  B  F#  C#  Ab  Eb  Bb  F
 * Hue (°):   0  30 60 90 120 150 180 210 240 270 300 330
 */
const PITCH_COLORS = {
  0:  0,    // C
  7:  30,   // G
  2:  60,   // D
  9:  90,   // A
  4:  120,  // E
  11: 150,  // B
  6:  180,  // F# / Gb
  1:  210,  // C# / Db
  8:  240,  // Ab / G#
  3:  270,  // Eb / D#
  10: 300,  // Bb / A#
  5:  330,  // F
};

// ════════════════════════════════════════════════════════════════════
// QUALITY → SATURATION + LIGHTNESS MODIFIERS
// ════════════════════════════════════════════════════════════════════

const QUALITY_MODIFIERS = {
  major:    { saturation: 65, lightness: 60 },  // warm, bright
  minor:    { saturation: 45, lightness: 45 },  // cool, muted
  interval: { saturation: 55, lightness: 55 },  // neutral
  default:  { saturation: 50, lightness: 50 },
};

// ════════════════════════════════════════════════════════════════════
// getColor(pc, quality) → HSL string
// ════════════════════════════════════════════════════════════════════

/**
 * Returns an HSL color string for the given pitch class and quality.
 * @param {number} pc      Pitch class 0–11
 * @param {string} quality 'major' | 'minor' | 'interval' | anything else
 * @returns {string}       e.g. "hsl(120, 65%, 60%)"
 */
function getColor(pc, quality) {
  const hue = PITCH_COLORS[((pc % 12) + 12) % 12] ?? 0;
  const mod = QUALITY_MODIFIERS[quality] ?? QUALITY_MODIFIERS.default;
  return `hsl(${hue}, ${mod.saturation}%, ${mod.lightness}%)`;
}

// ════════════════════════════════════════════════════════════════════
// VISUAL PRESETS
// ════════════════════════════════════════════════════════════════════

const VISUAL_PRESETS = {
  harmony: { colorScheme: 'tonnetz', canvasEffect: 'particle', enabled: true  },
  minimal: { colorScheme: 'tonnetz', canvasEffect: 'none',     enabled: true  },
  classic: { colorScheme: 'quality', canvasEffect: 'particle', enabled: true  },
  off:     { colorScheme: 'none',    canvasEffect: 'none',     enabled: false },
};

// ════════════════════════════════════════════════════════════════════
// VISUAL CONFIG STATE
// ════════════════════════════════════════════════════════════════════

/**
 * Simple mutable config object. No pub/sub — VisualLayer polls it
 * on each HarmonyState event.
 */
const VisualConfig = {
  preset:       'off',
  colorScheme:  'none',   // 'tonnetz' | 'quality' | 'none'
  canvasEffect: 'none',   // 'particle' | 'glow' | 'none'
  enabled:      false,

  /** Load a named preset by name, merging all its fields. */
  applyPreset(name) {
    const preset = VISUAL_PRESETS[name];
    if (!preset) return;
    this.preset = name;
    Object.assign(this, preset);
  },

  /** Merge a partial config object into current state. */
  set(partial) {
    Object.assign(this, partial);
  },
};

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export { PITCH_COLORS, QUALITY_MODIFIERS, VISUAL_PRESETS, VisualConfig, getColor };

if (typeof window !== 'undefined') {
  window.VisualConfig = VisualConfig;
}
