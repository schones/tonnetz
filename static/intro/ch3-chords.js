/**
 * ch3-chords.js — Chapter 3: Chords & Harmony
 * Placeholder section definitions.
 */

export const chapterMeta = {
  number: 3,
  title: 'Chords & Harmony',
  tone: 'moderate',
  description: 'Stack notes into chords and learn how they move together.',
};

export const sections = [
  {
    id: 'ch3-triads',
    title: 'Building a Triad',
    narration:
      'A chord is three or more notes played simultaneously. ' +
      'The simplest chord is a triad — built by stacking two intervals called thirds. ' +
      'A major triad stacks a major third (4 semitones) and a minor third (3 semitones). ' +
      'A minor triad reverses those: minor third first, then major third. ' +
      'This single difference — 4+3 vs 3+4 — is what makes a chord sound major or minor.',
    interactive: 'triad-builder',
    tryIt: 'Click a root note and toggle between major and minor to hear the difference.',
    onActivate: null,
  },
  {
    id: 'ch3-progressions',
    title: 'Chord Progressions',
    narration:
      'Music rarely stays on one chord. It moves — from tension to resolution, ' +
      'from home to away and back. A chord progression is a sequence of chords, ' +
      'and the relationship between consecutive chords is what creates the emotional arc of a phrase. ' +
      'The famous I–V–vi–IV progression underlies hundreds of pop songs because ' +
      'its arc from stability to tension to longing to release feels deeply satisfying.',
    interactive: 'progression-player',
    tryIt: 'Play through a progression and listen to how each chord creates expectation for the next.',
    onActivate: null,
  },
  {
    id: 'ch3-circle-of-fifths',
    title: 'The Circle of Fifths',
    narration:
      'Arrange the 12 major keys in a circle where each step is a fifth apart — ' +
      'five semitones — and you get the circle of fifths. ' +
      'Keys close to each other on the circle share many notes and feel harmonically nearby. ' +
      'Moving around it is one of the most common paths in Western harmony. ' +
      'But there\'s an even deeper map — and that\'s where we\'re headed next.',
    interactive: 'circle-of-fifths',
    tryIt: 'Click any key on the circle to hear its tonic chord and see its related keys.',
    gameLink: {
      game: 'chord-walks',
      label: 'Walk through chord changes →',
      url: '/games/relative-key-trainer',
    },
    onActivate: null,
  },
];
