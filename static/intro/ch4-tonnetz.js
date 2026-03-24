/**
 * ch4-tonnetz.js — Chapter 4: The Tonnetz
 * Placeholder section definitions.
 */

export const chapterMeta = {
  number: 4,
  title: 'The Tonnetz',
  tone: 'formal',
  description: 'A geometric map that reveals hidden patterns in harmony.',
};

export const sections = [
  {
    id: 'ch4-the-problem',
    title: 'The Problem with the Circle',
    narration:
      'The circle of fifths captures key relationships, but it flattens chord connections into one dimension. ' +
      'Two chords can be harmonically close in multiple ways simultaneously — ' +
      'sharing two notes, or one, or none — and the circle can\'t show all of that at once. ' +
      'Music theorists noticed this limitation in the 19th century and started looking for a better map.',
    interactive: 'chord-distance-demo',
    tryIt: 'Move between two chords and observe the shared notes highlighted between them.',
    onActivate: null,
  },
  {
    id: 'ch4-the-reveal',
    title: 'The Tonnetz Revealed',
    narration:
      'In 1866, Hugo Riemann described a two-dimensional lattice of notes where ' +
      'every adjacent pair shares a harmonic relationship. ' +
      'Moving horizontally steps by a fifth. Moving diagonally steps by a major or minor third. ' +
      'Every triangle in the grid is a triad — major triangles point up, minor triangles point down. ' +
      'Two triangles sharing an edge share two common tones. The geometry is the harmony.',
    interactive: 'tonnetz-intro',
    tryIt: 'Click any triangle to hear that chord. Click adjacent triangles and listen to how they connect.',
    onActivate: null,
  },
  {
    id: 'ch4-navigate',
    title: 'Navigating the Grid',
    narration:
      'On the Tonnetz, chord progressions become journeys across a map. ' +
      'Moving to an adjacent triangle — one edge away — keeps two notes the same and changes one. ' +
      'Moving two edges away keeps one note the same. Three edges away shares no common tones. ' +
      'This isn\'t just visual: our ears track common tones as anchor points. ' +
      'Smoother voice leading means a smoother journey on the Tonnetz.',
    interactive: 'tonnetz-navigation',
    tryIt: 'Start on C major and try to reach F minor by moving one triangle at a time.',
    gameLink: {
      game: 'chord-walks',
      label: 'Explore the Tonnetz →',
      url: '/games/relative-key-trainer',
    },
    onActivate: null,
  },
];
