/* GymLogger prototype — API client used by every screen.
   One place that knows about transport, auth token, envelope unwrapping,
   idempotency keys and error normalisation. To use the real ASP.NET Core API,
   replace `transport` with fetch(); screens do not change. */
(function (G) {
  'use strict';
  const U = G.U;
  const TOKEN_KEY = 'gymlogger.proto.auth';

  class ApiError extends Error {
    constructor(status, message, errors, data, network) {
      super(message);
      this.status = status; this.errors = errors || []; this.data = data; this.network = !!network;
    }
    fieldErrors() { const m = {}; this.errors.forEach((e) => { if (e.field && !m[e.field]) m[e.field] = e.message; }); return m; }
  }

  async function transport(method, url, body, headers) {
    // Real implementation:
    //   const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, credentials: 'include' });
    //   return { status: res.status, body: res.status === 204 ? { success: true, data: null, errors: [] } : await res.json() };
    return G.MockApi.request(method, url, { body, headers });
  }

  const listeners = { unauthorized: new Set() };
  let auth = U.store.get(TOKEN_KEY, null);

  async function call(method, path, body, opts) {
    const o = opts || {};
    const headers = {};
    if (auth && auth.token) headers.Authorization = 'Bearer ' + auth.token;
    if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey;
    let res;
    try {
      res = await transport(method, '/api/v1' + path, body, headers);
    } catch (e) {
      throw new ApiError(0, "You're offline. Check your connection and try again.", [], null, true);
    }
    const env = res.body || {};
    if (res.status === 401 && !o.allowUnauthorized) {
      Api.clearAuth();
      listeners.unauthorized.forEach((fn) => fn(env.message));
    }
    if (!env.success) throw new ApiError(res.status, env.message || 'Request failed.', env.errors, env.data);
    return env.data;
  }

  const q = U.qs;
  const Api = {
    ApiError,
    get user() { return auth && auth.user; },
    get isAdmin() { return !!(auth && auth.user && auth.user.role === 'Admin'); },
    get expiresAt() { return auth && auth.expiresAt; },
    setAuth(a) { auth = a; U.store.set(TOKEN_KEY, a); },
    clearAuth() { auth = null; U.store.remove(TOKEN_KEY); },
    onUnauthorized(fn) { listeners.unauthorized.add(fn); },
    newKey: () => U.uid('idem'),

    /* Auth */
    async login(email, password) { const d = await call('POST', '/auth/login', { email, password }, { allowUnauthorized: true }); Api.setAuth(d); return d; },
    register: (body) => call('POST', '/auth/register', body, { allowUnauthorized: true }),
    async logout() { try { await call('POST', '/auth/logout'); } finally { Api.clearAuth(); } },
    async me() { const u = await call('GET', '/auth/me'); if (auth) { auth.user = { ...auth.user, ...u }; Api.setAuth(auth); } return u; },
    async updateProfile(body) { const u = await call('PUT', '/users/me', body); if (auth) { auth.user = { ...auth.user, ...u }; Api.setAuth(auth); } return u; },

    /* Reference data */
    reference: () => call('GET', '/reference'),
    addReference: (type, name) => call('POST', '/reference/' + type, { name }),
    updateReference: (type, id, body) => call('PUT', '/reference/' + type + '/' + id, body),

    /* Exercises */
    exercises: (params) => call('GET', '/exercises' + q(params)),
    exercise: (id, params) => call('GET', '/exercises/' + id + q(params)),
    createExercise: (body) => call('POST', '/exercises', body),
    updateExercise: (id, body) => call('PUT', '/exercises/' + id, body),
    setExerciseStatus: (id, isActive) => call('PATCH', '/exercises/' + id + '/status', { isActive }),
    media: (id) => call('GET', '/exercises/' + id + '/media'),
    uploadMedia: (id, body) => call('POST', '/exercises/' + id + '/media', body, { idempotencyKey: body.idempotencyKey }),
    updateMedia: (id, mediaId, body) => call('PUT', '/exercises/' + id + '/media/' + mediaId, body),
    reorderMedia: (id, ids) => call('POST', '/exercises/' + id + '/media/reorder', { ids }),
    deleteMedia: (id, mediaId) => call('DELETE', '/exercises/' + id + '/media/' + mediaId),

    /* History & analytics */
    exerciseHistory: (id, params) => call('GET', '/exercises/' + id + '/history' + q(params)),
    comparison: (id, currentWorkoutId, previousWorkoutId) => call('GET', '/exercises/' + id + '/comparison' + q({ currentWorkoutId, previousWorkoutId })),
    analytics: (id, range) => call('GET', '/exercises/' + id + '/analytics' + q({ range })),
    summary: () => call('GET', '/analytics/summary'),

    /* Workouts */
    workouts: (params) => call('GET', '/workouts' + q(params)),
    activeWorkout: () => call('GET', '/workouts/active'),
    workout: (id) => call('GET', '/workouts/' + id),
    startWorkout: (key) => call('POST', '/workouts', { workoutDate: U.todayISO(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, { idempotencyKey: key }),
    completeWorkout: (id, key) => call('POST', '/workouts/' + id + '/complete', null, { idempotencyKey: key }),
    cancelWorkout: (id, key) => call('POST', '/workouts/' + id + '/cancel', null, { idempotencyKey: key }),
    addExercise: (workoutId, exerciseId, key) => call('POST', '/workouts/' + workoutId + '/exercises', { exerciseId }, { idempotencyKey: key }),
    removeExercise: (workoutExerciseId) => call('DELETE', '/workout-exercises/' + workoutExerciseId),
    addSet: (workoutExerciseId, count, key) => call('POST', '/workout-exercises/' + workoutExerciseId + '/sets', { count }, { idempotencyKey: key }),
    updateSet: (setId, count) => call('PUT', '/workout-sets/' + setId, { count }),
    deleteSet: (setId) => call('DELETE', '/workout-sets/' + setId),
  };

  G.Api = Api;
})(window.GL = window.GL || {});
