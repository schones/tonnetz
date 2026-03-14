/**
 * user-profile.js
 * ===============
 * Manages user profile state in localStorage.
 *
 * Usage:
 *   import { getProfile, initProfile, ... } from '/static/shared/user-profile.js';
 */

// ── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tonnetz_profile';

const PRESETS = {
  beginner:       { active_lens: 'playful', additional_lenses: [] },
  dabbler:        { active_lens: 'playful', additional_lenses: ['musician'] },
  curious_player: { active_lens: 'musician', additional_lenses: [] },
  producer:       { active_lens: 'musician', additional_lenses: [] },
  deep_diver:     { active_lens: 'theorist', additional_lenses: ['musician'] },
  math_explorer:  { active_lens: 'math', additional_lenses: ['theorist'] },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function generateUUID() {
  // crypto.randomUUID is available in all modern browsers
  if (crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[user-profile] corrupt profile data, returning null:', e.message);
    return null;
  }
}

function _save(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

// ── Public API ────────────────────────────────────────────────────────────

/** Returns the profile object, or null if none exists. */
export function getProfile() {
  return _load();
}

/**
 * Create a new profile with the given preset and save to localStorage.
 * @param {string} preset - One of: beginner, dabbler, curious_player, producer, deep_diver, math_explorer
 * @returns {object} The created profile
 */
export function initProfile(preset) {
  const config = PRESETS[preset];
  if (!config) {
    throw new Error(`[user-profile] unknown preset: "${preset}". Valid: ${Object.keys(PRESETS).join(', ')}`);
  }

  const profile = {
    user_id: generateUUID(),
    preset,
    active_lens: config.active_lens,
    additional_lenses: [...config.additional_lenses],
    topics: {},
    games: {},
    paths: {},
    skratch: {},
    preferences: {
      show_tooltips: true,
      tooltip_frequency: 'sometimes',
      session_length_preference: 'medium',
    },
    created_at: new Date().toISOString(),
  };

  _save(profile);
  return profile;
}

/**
 * Set topic status (unseen/visited/learning/learned).
 * Records seen_via and first_seen on first encounter; always updates last_seen.
 */
export function updateTopicStatus(topicId, status, seenVia) {
  const profile = _load();
  if (!profile) return null;

  if (!profile.topics[topicId]) {
    profile.topics[topicId] = {
      status,
      seen_via: seenVia || null,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
  } else {
    profile.topics[topicId].status = status;
    profile.topics[topicId].last_seen = new Date().toISOString();
  }

  _save(profile);
  return profile;
}

/**
 * Update game progress. Only updates high_score if new > existing.
 * Always updates last_played timestamp.
 */
export function updateGameProgress(gameId, { current_level, high_score } = {}) {
  const profile = _load();
  if (!profile) return null;

  if (!profile.games[gameId]) {
    profile.games[gameId] = {
      current_level: current_level ?? null,
      high_score: high_score ?? null,
      last_played: new Date().toISOString(),
    };
  } else {
    const game = profile.games[gameId];
    if (current_level !== undefined) game.current_level = current_level;
    if (high_score !== undefined && (game.high_score === null || high_score > game.high_score)) {
      game.high_score = high_score;
    }
    game.last_played = new Date().toISOString();
  }

  _save(profile);
  return profile;
}

/**
 * Add step to completed_steps array, update current_step.
 */
export function updatePathProgress(pathId, completedStep) {
  const profile = _load();
  if (!profile) return null;

  if (!profile.paths[pathId]) {
    profile.paths[pathId] = {
      completed_steps: [completedStep],
      current_step: completedStep,
    };
  } else {
    const path = profile.paths[pathId];
    if (!path.completed_steps.includes(completedStep)) {
      path.completed_steps.push(completedStep);
    }
    path.current_step = completedStep;
  }

  _save(profile);
  return profile;
}

/** Returns the user's active lens string, or null if no profile. */
export function getActiveLens() {
  const profile = _load();
  return profile ? profile.active_lens : null;
}

/** Updates active lens. */
export function setActiveLens(lens) {
  const profile = _load();
  if (!profile) return null;
  profile.active_lens = lens;
  _save(profile);
  return profile;
}

/** Clears localStorage profile entirely. */
export function resetProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Returns profile as JSON string (for future migration). */
export function exportProfile() {
  const profile = _load();
  return profile ? JSON.stringify(profile) : null;
}

/** Overwrites profile from JSON string. */
export function importProfile(jsonString) {
  try {
    const profile = JSON.parse(jsonString);
    _save(profile);
    return profile;
  } catch (e) {
    console.warn('[user-profile] import failed — invalid JSON:', e.message);
    return null;
  }
}

// ── Test harness ──────────────────────────────────────────────────────────

if (window.TONNETZ_TEST) {
  console.group('[user-profile] tests');

  // clean slate
  resetProfile();
  console.assert(getProfile() === null, 'getProfile returns null when empty');

  // initProfile
  const p = initProfile('dabbler');
  console.assert(p.active_lens === 'playful', 'dabbler → playful lens');
  console.assert(p.additional_lenses[0] === 'musician', 'dabbler → musician additional');
  console.assert(p.user_id.length === 36, 'UUID generated');
  console.assert(p.preferences.show_tooltips === true, 'default prefs');
  console.log('initProfile OK', p);

  // getProfile round-trip
  const p2 = getProfile();
  console.assert(p2.user_id === p.user_id, 'getProfile round-trip');

  // updateTopicStatus
  updateTopicStatus('intervals', 'visited', 'tooltip');
  const p3 = getProfile();
  console.assert(p3.topics.intervals.status === 'visited', 'topic status set');
  console.assert(p3.topics.intervals.seen_via === 'tooltip', 'seen_via recorded');
  console.assert(p3.topics.intervals.first_seen, 'first_seen set');

  // update same topic — should not overwrite first_seen
  const firstSeen = p3.topics.intervals.first_seen;
  updateTopicStatus('intervals', 'learning');
  const p4 = getProfile();
  console.assert(p4.topics.intervals.status === 'learning', 'topic status updated');
  console.assert(p4.topics.intervals.first_seen === firstSeen, 'first_seen preserved');

  // updateGameProgress
  updateGameProgress('interval_trainer', { current_level: 2, high_score: 100 });
  const p5 = getProfile();
  console.assert(p5.games.interval_trainer.high_score === 100, 'game high_score set');

  // high_score only updates if higher
  updateGameProgress('interval_trainer', { high_score: 50 });
  const p6 = getProfile();
  console.assert(p6.games.interval_trainer.high_score === 100, 'high_score not lowered');

  updateGameProgress('interval_trainer', { high_score: 200 });
  const p7 = getProfile();
  console.assert(p7.games.interval_trainer.high_score === 200, 'high_score raised');

  // updatePathProgress
  updatePathProgress('beginner_path', 'step_1');
  updatePathProgress('beginner_path', 'step_2');
  const p8 = getProfile();
  console.assert(p8.paths.beginner_path.completed_steps.length === 2, 'two steps completed');
  console.assert(p8.paths.beginner_path.current_step === 'step_2', 'current_step updated');

  // duplicate step should not add again
  updatePathProgress('beginner_path', 'step_1');
  const p9 = getProfile();
  console.assert(p9.paths.beginner_path.completed_steps.length === 2, 'no duplicate steps');

  // getActiveLens / setActiveLens
  console.assert(getActiveLens() === 'playful', 'getActiveLens returns playful');
  setActiveLens('theorist');
  console.assert(getActiveLens() === 'theorist', 'setActiveLens works');

  // export / import
  const exported = exportProfile();
  console.assert(typeof exported === 'string', 'export returns string');
  resetProfile();
  console.assert(getProfile() === null, 'reset clears profile');
  const imported = importProfile(exported);
  console.assert(imported.user_id === p.user_id, 'import restores profile');

  // bad import
  const bad = importProfile('{not valid json!!!');
  console.assert(bad === null, 'bad import returns null');

  // bad preset
  try {
    initProfile('nonexistent');
    console.assert(false, 'should have thrown');
  } catch (e) {
    console.assert(e.message.includes('nonexistent'), 'bad preset throws');
  }

  // cleanup
  resetProfile();
  console.log('All tests passed');
  console.groupEnd();
}
