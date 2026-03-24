/**
 * ch2-scales.js — Chapter 2: Scales & Keys
 * Placeholder section definitions.
 */

export const chapterMeta = {
  number: 2,
  title: 'Scales & Keys',
  tone: 'playful',
  description: 'Build your first scale and discover how keys organize music.',
};

export const sections = [
  {
    id: 'ch2-major-scale',
    title: 'The Major Scale',
    narration:
      'A scale is a selected set of notes arranged in order. ' +
      'The major scale picks 7 of the 12 notes using a specific pattern of steps: ' +
      'whole, whole, half, whole, whole, whole, half. ' +
      'That gap pattern is what gives the major scale its bright, familiar sound — ' +
      'the one you learned as "Do Re Mi."',
    interactive: 'scale-builder',
    tryIt: 'Click a root note, then watch the scale pattern light up on the keyboard.',
    onActivate: null,
  },
  {
    id: 'ch2-minor-scale',
    title: 'The Minor Scale',
    narration:
      'Change the gap pattern — whole, half, whole, whole, half, whole, whole — ' +
      'and you get the natural minor scale. Same 7-note idea, different mood. ' +
      'Minor scales tend to sound darker or more melancholic, while major scales sound brighter. ' +
      'Both are just different ways of choosing 7 notes from the same 12.',
    interactive: 'scale-comparison',
    tryIt: 'Toggle between major and minor on the same root note and listen to the difference.',
    onActivate: null,
  },
  {
    id: 'ch2-keys',
    title: 'Keys & Key Signatures',
    narration:
      'When a piece of music is "in a key," it means the melody and chords are mostly drawn ' +
      'from one particular scale. The key of C major uses the white keys on the piano. ' +
      'The key of G major adds one sharp (F♯). ' +
      'Each key has its own personality, partly from pitch and partly from the patterns of tension and release within it.',
    interactive: 'key-explorer',
    tryIt: 'Select a key and see which notes belong to it highlighted on the keyboard.',
    gameLink: {
      game: 'relative-key-trainer',
      label: 'Explore relative keys →',
      url: '/games/relative-key-trainer',
    },
    onActivate: null,
  },
];
