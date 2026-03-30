# Auth & Persistence Architecture

**Version:** 0.1
**Date:** 2026-03-18
**Phase:** 3 (Build Plan)
**Status:** DRAFT — review before implementation

---

## 1. Goals

1. **Supabase Auth** with magic links + Google OAuth (low friction, no passwords)
2. **Migrate `user-profile.js`** from localStorage-only to Supabase Postgres — same public API, different backend
3. **localStorage as offline cache/fallback** — write-through pattern (save locally first, sync to backend)
4. **Backend proxy** for API keys (Flask route, no client-side secrets)
5. **Security review pass** before opening to testers

### Non-goals (for now)
- Role-based access / admin dashboard
- Classroom or organization models
- Email verification flows
- Real-time sync between devices (eventual consistency is fine)
- Supabase Realtime, Edge Functions, Row Level Security

---

## 2. Auth Flow

### Provider setup
- **Magic link** (email-based, passwordless) — primary
- **Google OAuth** — secondary, for users who prefer it
- Both handled by Supabase Auth JS client (`@supabase/supabase-js`)

### Login flow
```
User lands on Tonnetz
  → App works immediately (localStorage profile, no auth required)
  → "Sign in" link in nav (not a gate — the app is fully usable without it)
  → Click → modal with two options:
      [Continue with Google]
      [Send magic link] (email input)
  → Supabase handles OAuth redirect or magic link email
  → On success: Supabase session established
  → First login: migrate localStorage profile to Supabase (see §5)
  → Subsequent logins: pull server profile, merge with any offline changes
```

### Session management
- Supabase JS client handles token refresh automatically
- Session persisted in localStorage by Supabase (`sb-<ref>-auth-token`)
- On page load: check for existing session → if valid, sync profile from server
- On logout: app continues working with localStorage profile (no data loss)

### Flask integration
- Supabase auth tokens are JWTs — Flask validates them on API routes
- Add `supabase_auth` decorator for protected Flask routes
- The Supabase JS client talks directly to Supabase for auth — Flask doesn't mediate login

---

## 3. Database Schema

### Design principles
- One row per user in `profiles` table — the `topics`, `games`, `paths`, `skratch` objects stay as JSONB columns (not normalized into separate tables)
- Why JSONB: matches the current localStorage shape exactly, avoids premature normalization, and Postgres JSONB is queryable if we need analytics later
- Separate `competency_snapshots` table for the competency graph (this is the new data that motivated auth)

### `profiles` table

```sql
CREATE TABLE profiles (
  -- Supabase auth.users.id (UUID, set on first login)
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Mirrors user-profile.js fields
  preset          TEXT NOT NULL DEFAULT 'beginner',
  active_lens     TEXT NOT NULL DEFAULT 'playful',
  additional_lenses TEXT[] DEFAULT '{}',

  -- JSONB blobs matching current localStorage shape
  topics          JSONB DEFAULT '{}',
  games           JSONB DEFAULT '{}',
  paths           JSONB DEFAULT '{}',
  skratch         JSONB DEFAULT '{}',
  preferences     JSONB DEFAULT '{
    "show_tooltips": true,
    "tooltip_frequency": "sometimes",
    "session_length_preference": "medium"
  }',

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- The localStorage user_id (preserved for migration traceability)
  local_user_id   UUID
);
```

### `competency_snapshots` table

```sql
CREATE TABLE competency_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id         TEXT NOT NULL,
  
  -- Competency data (shape TBD by Phase 9 spec, kept flexible)
  snapshot        JSONB NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competency_user_game ON competency_snapshots(user_id, game_id, created_at DESC);
```

### Why not normalize `topics`, `games`, `paths`?

Each of those objects has 5-30 keys with small value objects. Normalizing them into `user_topics`, `user_games`, `user_paths` tables would mean:
- 3 extra tables, 3 extra joins or queries per profile load
- Migration code that reshapes data on every read/write
- No real benefit until we need cross-user analytics ("how many users completed topic X")

When that need arises, we can query JSONB directly (`profiles.topics ? 'intervals'`) or migrate to normalized tables. For now, JSONB matches the localStorage shape 1:1 and keeps the API layer trivial.

---

## 4. `user-profile.js` Refactor

### Architecture: same API, swappable backend

```
┌─────────────────────────────────────────────────┐
│  Game code                                       │
│  import { getProfile, updateGameProgress } ...   │
│         ↓ (unchanged API)                        │
├─────────────────────────────────────────────────┤
│  user-profile.js  (public API — unchanged)       │
│         ↓                                        │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ _loadLocal()  │    │ _syncToSupabase()    │   │
│  │ _saveLocal()  │    │ _pullFromSupabase()  │   │
│  └──────────────┘    └──────────────────────┘   │
│    always used          used when authed         │
└─────────────────────────────────────────────────┘
```

### Write-through pattern

Every public API function follows this sequence:

```javascript
export function updateTopicStatus(topicId, status, seenVia) {
  // 1. Load from localStorage (fast, synchronous)
  const profile = _loadLocal();
  if (!profile) return null;

  // 2. Mutate (existing logic, unchanged)
  if (!profile.topics[topicId]) {
    profile.topics[topicId] = { status, seen_via: seenVia || null, ... };
  } else {
    profile.topics[topicId].status = status;
    ...
  }

  // 3. Save locally (immediate, synchronous)
  _saveLocal(profile);

  // 4. Sync to Supabase (async, fire-and-forget, non-blocking)
  _syncToSupabase(profile);

  return profile;
}
```

### Key implementation details

- **`_syncToSupabase(profile)`** — debounced (300ms), async, fire-and-forget. Uses `supabase.from('profiles').upsert(...)`. Failures are logged but don't break the app.
- **`_pullFromSupabase()`** — called on page load when a session exists. Fetches server profile, merges with localStorage using `updated_at` timestamps (server wins if newer, local wins if server is unreachable).
- **`isAuthenticated()`** — new public API function. Returns true if a Supabase session exists. Game code can use this to show "sign in to save progress" prompts but should never gate functionality on it.
- **`getSupabaseClient()`** — not exported from user-profile.js. The Supabase client instance lives in a new `supabase-client.js` module that user-profile.js imports internally.

### Merge strategy (on login / page load)

```javascript
async function _mergeOnLogin(serverProfile, localProfile) {
  // If no server profile exists (first login), upload local → server
  if (!serverProfile) {
    await _uploadLocalToSupabase(localProfile);
    return localProfile;
  }

  // If no local profile exists (new device), use server
  if (!localProfile) {
    _saveLocal(serverProfile);
    return serverProfile;
  }

  // Both exist: merge field by field, most-recent wins
  const merged = { ...serverProfile };

  // Topics: merge per-topic, keep most recent last_seen
  for (const [id, local] of Object.entries(localProfile.topics)) {
    if (!merged.topics[id] || local.last_seen > merged.topics[id].last_seen) {
      merged.topics[id] = local;
    }
  }

  // Games: merge per-game, keep highest high_score, most recent last_played
  for (const [id, local] of Object.entries(localProfile.games)) {
    if (!merged.games[id]) {
      merged.games[id] = local;
    } else {
      const server = merged.games[id];
      if (local.high_score > (server.high_score || 0)) {
        server.high_score = local.high_score;
      }
      if (local.current_level > (server.current_level || 0)) {
        server.current_level = local.current_level;
      }
      if (local.last_played > server.last_played) {
        server.last_played = local.last_played;
      }
    }
  }

  // Paths: merge per-path, union of completed_steps
  for (const [id, local] of Object.entries(localProfile.paths)) {
    if (!merged.paths[id]) {
      merged.paths[id] = local;
    } else {
      const steps = new Set([...merged.paths[id].completed_steps, ...local.completed_steps]);
      merged.paths[id].completed_steps = [...steps];
      // current_step: use whichever has more completed steps
      if (local.completed_steps.length > merged.paths[id].completed_steps.length) {
        merged.paths[id].current_step = local.current_step;
      }
    }
  }

  // Preferences: local wins (these are device-specific)
  merged.preferences = localProfile.preferences;

  // Save merged result to both
  _saveLocal(merged);
  await _syncToSupabase(merged);
  return merged;
}
```

---

## 5. First-Login Migration

When a user signs in for the first time and has an existing localStorage profile:

1. Supabase Auth callback fires with the new `auth.users.id`
2. Check `profiles` table for this user → none exists
3. Read localStorage profile
4. Create `profiles` row with Supabase user ID as `id`, copy all fields, store original `user_id` as `local_user_id`
5. Update localStorage profile to use the Supabase user ID
6. Done — all subsequent writes go through the write-through pattern

If the user has no localStorage profile (brand new user signing in on first visit), create a default profile in both localStorage and Supabase using the `beginner` preset. The onboarding flow then runs as normal.

---

## 6. Flask Backend Changes

### New files

| File | Purpose |
|------|---------|
| `supabase_config.py` | Supabase URL + service role key from env vars |
| `auth.py` | JWT validation decorator, session helpers |
| `api/profile.py` | Profile CRUD routes (REST) |
| `api/proxy.py` | Generic API key proxy route |

### Environment variables

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...        # public, used by JS client
SUPABASE_SERVICE_KEY=eyJ...     # private, used by Flask only
```

Both keys go in Railway environment variables. `SUPABASE_ANON_KEY` is safe to expose to the client (it's designed for this). `SUPABASE_SERVICE_KEY` never leaves the server.

### API routes

```
POST   /api/auth/callback     — handle OAuth redirect (if needed by flow)
GET    /api/profile            — fetch current user's profile (JWT required)
PUT    /api/profile            — upsert profile (JWT required)
POST   /api/proxy              — generic API proxy (JWT required, route + key in env)
```

**Important:** The JS client talks to Supabase directly for reads/writes (using the anon key + JWT). The Flask API routes are a fallback path and are required for the API proxy. We do NOT route all Supabase traffic through Flask — that would add latency for no benefit.

### JWT validation

```python
# auth.py
import jwt
from functools import wraps
from flask import request, jsonify
from supabase_config import SUPABASE_JWT_SECRET

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=['HS256'],
                                 audience='authenticated')
            request.user_id = payload['sub']
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated
```

### API proxy

```python
# api/proxy.py
@app.route('/api/proxy', methods=['POST'])
@require_auth
def api_proxy():
    """Forward requests to external APIs with server-side keys."""
    data = request.json
    target = data.get('target')  # e.g., 'openai', 'musicbrainz'
    
    ALLOWED_TARGETS = {
        # 'openai': { 'base_url': '...', 'key_env': 'OPENAI_API_KEY' },
    }
    
    if target not in ALLOWED_TARGETS:
        return jsonify({'error': 'Unknown target'}), 400
    
    # Forward request with server-side API key
    # Implementation details depend on target
```

---

## 7. Client-Side Files

### New files

| File | Location | Purpose |
|------|----------|---------|
| `supabase-client.js` | `static/shared/` | Singleton Supabase JS client instance |
| `auth-ui.js` | `static/shared/` | Login modal, session state, sign-out |

### `supabase-client.js`

```javascript
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = '%%SUPABASE_URL%%';   // injected by Flask template
const SUPABASE_ANON_KEY = '%%SUPABASE_ANON_KEY%%';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Template injection:** Flask renders the base template with `SUPABASE_URL` and `SUPABASE_ANON_KEY` from environment variables. These are public values (the anon key is designed to be client-visible; RLS would restrict access, but we're not using RLS yet — access is gated by JWT presence).

### Auth UI

Simple modal, not a full page. Two buttons, one email input. No custom auth pages — Supabase handles the heavy lifting.

```
┌─────────────────────────────┐
│  Sign in to save progress   │
│                             │
│  [Continue with Google]     │
│                             │
│  ─── or ───                 │
│                             │
│  [your@email.com] [Send]    │
│  (We'll email you a link)   │
│                             │
│  [Skip for now]             │
└─────────────────────────────┘
```

---

## 8. Competency Graph Persistence

The competency graph (Phase 9) will generate structured snapshots of a user's skill state per game. These are write-heavy and append-only — a good fit for a separate table rather than cramming them into the profile JSONB.

### When snapshots are created
- End of a Test phase (any game)
- End of a Practice session (after N rounds, TBD)
- On tier unlock

### Snapshot shape (preliminary — Phase 9 will refine)

```json
{
  "game_id": "relative_key_trainer",
  "tier": 2,
  "phase": "test",
  "score": 8,
  "total": 10,
  "skills": {
    "major_minor_recognition": 0.85,
    "r_transform_identification": 0.72,
    "reverse_r_transform": 0.60
  },
  "weak_areas": ["minor_to_major"],
  "timestamp": "2026-03-18T22:30:00Z"
}
```

### Access pattern
- Write: append new snapshot after assessment
- Read: fetch latest N snapshots for a game (competency trend), or latest snapshot per game (dashboard)
- The index on `(user_id, game_id, created_at DESC)` supports both patterns

### localStorage behavior
Competency snapshots are NOT cached in localStorage. They're server-only data. If the user is not authenticated, snapshots are not generated — a "sign in to track your progress" prompt appears instead. This is the one feature that gates on auth.

---

## 9. Security Review Checklist

Before opening to testers:

- [ ] `SUPABASE_SERVICE_KEY` is in Railway env vars only, never in client code
- [ ] `SUPABASE_ANON_KEY` is the only key exposed to the browser
- [ ] Flask API proxy validates JWT on all protected routes
- [ ] No raw SQL in Flask routes (use Supabase client library or parameterized queries)
- [ ] CORS configured: allow only the Railway domain and localhost
- [ ] Rate limiting on `/api/proxy` (prevent abuse of proxied API keys)
- [ ] Content-Security-Policy header set (restrict script sources)
- [ ] No secrets in git (check `.gitignore` for `.env`, `supabase_config.py`)
- [ ] Magic link redirect URL restricted to production domain in Supabase dashboard
- [ ] Google OAuth redirect URI restricted to production domain in Google Cloud Console
- [ ] Enable RLS on `profiles` and `competency_snapshots` tables before public launch (not needed for invited testers, required before open access)

---

## 10. Implementation Sequence

| Task | Session(s) | Dependencies |
|------|-----------|--------------|
| 3.1 — This architecture doc | — | None (this document) |
| 3.2 — Supabase project setup | 1 | Create project, configure auth providers, run SQL for tables |
| 3.3 — `supabase-client.js` + Flask env var injection | 1 | 3.2 |
| 3.4 — `auth-ui.js` (login modal, session management) | 1 | 3.3 |
| 3.5 — `user-profile.js` refactor (write-through + merge) | 1-2 | 3.3 |
| 3.6 — First-login migration flow | 1 | 3.5 |
| 3.7 — Flask `auth.py` + JWT decorator | 1 | 3.2 |
| 3.8 — Flask `/api/proxy` route | 1 | 3.7 |
| 3.9 — `competency_snapshots` table + write path | 1 | 3.5, 3.7 |
| 3.10 — Security review pass | 1 | All above |

**Estimated total: 8-10 Claude Code sessions.**

Tasks 3.2-3.4 are sequential. Tasks 3.5-3.6 can parallel with 3.7-3.8. Task 3.9 can wait until Phase 9 is closer but the table should be created in 3.2.

---

## 11. Open Questions

1. **RLS or no RLS?** Supabase Row Level Security would let us skip Flask for profile reads/writes entirely (the JS client + JWT + RLS policies handle authorization). This is cleaner long-term but adds configuration complexity now. **Current decision: skip RLS, rely on JWT validation in Flask for protected routes. Revisit when user base grows.**

2. **Offline duration.** How long can a user work offline before sync becomes a problem? The current merge strategy handles "used on two devices with different progress" but not "used offline for a week and made conflicting lens changes." For a single-user-for-now scenario this is a non-issue. **Revisit if classroom use introduces shared devices.**

3. **Supabase JS bundle size.** The `@supabase/supabase-js` library is ~40KB gzipped via CDN. Acceptable for a web app, but worth noting since the rest of the stack is vanilla JS with no build step. **Decision: load from CDN via ES module import, no bundler needed.**

4. **Profile deletion / account deletion.** GDPR-adjacent concern. When a user deletes their account, `ON DELETE CASCADE` handles the database side. localStorage cleanup needs an explicit `resetProfile()` call in the sign-out flow. **Add to 3.4 implementation.**
