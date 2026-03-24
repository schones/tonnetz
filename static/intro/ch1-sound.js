/**
 * ch1-sound.js — Chapter 1: Sound & Notes
 * Placeholder section definitions.
 * Interactive components will be mounted in a later prompt.
 */

export const chapterMeta = {
  number: 1,
  title: 'Sound & Notes',
  tone: 'playful',
  description: 'What is sound? Meet the 12 notes and the spaces between them.',
};

export const sections = [
  {
    id: 'ch1-what-is-sound',
    title: 'What is Sound?',
    narration:
      'Sound starts with something vibrating — a string, a column of air, your vocal cords. ' +
      'Those vibrations ripple outward as waves of pressure, and when they reach your eardrum, ' +
      'your brain interprets the rate of vibration as pitch. Faster vibrations sound higher; slower ones sound lower.',
    interactive: 'oscillator',
    tryIt: 'Drag the slider to change the frequency and hear the pitch shift.',
    onActivate: null,
  },
  {
    id: 'ch1-meet-the-notes',
    title: 'Meet the Notes',
    narration:
      'Western music divides the octave — a doubling of frequency — into 12 equal steps called semitones. ' +
      'Each step has a name: C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B… then C again an octave higher. ' +
      'These 12 notes are the alphabet of everything you\'ll learn here.',
    interactive: 'keyboard-12',
    tryIt: 'Click any key to hear the note. Notice how the pitch rises as you move right.',
    onActivate: null,
  },
  {
    id: 'ch1-intervals',
    title: 'The Space Between',
    narration:
      'The distance between two notes is called an interval. ' +
      'One semitone apart is the smallest interval in Western music — it sounds tense, close. ' +
      'Seven semitones apart is a perfect fifth — open and stable. ' +
      'Learning to hear these distances by ear is one of the most powerful skills in music.',
    interactive: 'interval-player',
    tryIt: 'Click two notes to hear the interval between them.',
    gameLink: {
      game: 'harmony-trainer',
      label: 'Practice hearing intervals →',
      url: '/harmony',
    },
    onActivate: null,
  },
];
