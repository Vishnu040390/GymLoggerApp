/* GymLogger prototype — mock REST API.
   Implements the Phase 1 /api/v1 contract in the browser so every screen can
   be exercised end-to-end without the ASP.NET Core backend:
     • response envelope { success, message, data, errors[] } + HTTP status
     • bearer-token auth, Admin/User roles, per-user data isolation (404)
     • session lifecycle InProgress → Completed | Cancelled
     • Idempotency-Key support for retried POSTs
     • simulated latency, offline mode and server errors (Prototype panel)
   Swap GL.MockApi.request for fetch() to point the UI at the real API. */
(function (G) {
  'use strict';
  const U = G.U;
  const D = G.Domain;
  const DB = G.DB;
  const S = D.STATUS;

  class HttpError extends Error {
    constructor(status, message, errors, data) { super(message); this.status = status; this.errors = errors || []; this.data = data; }
  }
  const fail = (status, message, errors, data) => { throw new HttpError(status, message, errors, data); };
  const ok = (data, message, status) => ({ status: status || 200, body: { success: true, message: message || '', data: data === undefined ? null : data, errors: [] } });
  const noContent = () => ({ status: 204, body: { success: true, message: '', data: null, errors: [] } });
  const fieldErr = (field, message) => ({ field, message });

  /* ---- Network simulation --------------------------------------------------- */
  const net = { mode: 'normal', failNext: false };
  const listeners = new Set();
  const log = [];
  function setNetwork(patch) {
    Object.assign(net, patch);
    U.store.set('gymlogger.proto.net', { mode: net.mode });
    listeners.forEach((fn) => fn({ ...net }));
  }
  Object.assign(net, U.store.get('gymlogger.proto.net', {}));
  if (net.mode === 'offline') net.mode = 'normal'; // never boot offline

  /* ---- Routing -------------------------------------------------------------- */
  const routes = [];
  function def(method, pattern, handler, opts) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, auth: !(opts && opts.auth === false), role: opts && opts.role });
  }

  const db = () => DB.get();
  const now = () => new Date().toISOString();
  const byId = (list, id) => list.find((x) => x.id === id);
  const refName = (list, id) => { const r = byId(list, id); return r ? r.name : '—'; };
  function audit(user, action, entityName, entityId) {
    db().auditLog.push({ id: U.uid('audit'), userId: user ? user.id : null, action, entityName, entityId, createdDate: now() });
    if (db().auditLog.length > 300) db().auditLog.shift();
  }

  /* ---- DTO builders ---------------------------------------------------------- */
  function exerciseDto(ex, opts) {
    const d = db();
    const all = (opts && opts.allMedia);
    const media = d.exerciseMedia.filter((m) => m.exerciseId === ex.id && (all || m.isActive)).sort((a, b) => a.displayOrder - b.displayOrder);
    const firstImage = media.find((m) => m.mediaType === 'Image' && m.isActive) || null;
    return {
      id: ex.id, name: ex.name,
      categoryId: ex.categoryId, categoryName: refName(d.categories, ex.categoryId),
      muscleGroupId: ex.muscleGroupId, muscleGroupName: refName(d.muscleGroups, ex.muscleGroupId),
      equipmentId: ex.equipmentId, equipmentName: refName(d.equipment, ex.equipmentId),
      description: ex.description, instructions: ex.instructions, isActive: ex.isActive, displayOrder: ex.displayOrder,
      createdDate: ex.createdDate, modifiedDate: ex.modifiedDate,
      imageCount: media.filter((m) => m.mediaType === 'Image').length,
      videoCount: media.filter((m) => m.mediaType === 'Video').length,
      primaryImage: firstImage,
      media: opts && opts.withMedia ? media : undefined,
    };
  }

  function setsOf(weId) {
    return db().workoutSets.filter((s) => s.workoutExerciseId === weId).sort((a, b) => a.setNumber - b.setNumber)
      .map((s) => ({ id: s.id, setNumber: s.setNumber, count: s.count, modifiedDate: s.modifiedDate }));
  }

  function sessionDetail(ws) {
    const d = db();
    const exercises = d.workoutExercises.filter((we) => we.workoutSessionId === ws.id).sort((a, b) => a.displayOrder - b.displayOrder).map((we) => {
      const ex = byId(d.exercises, we.exerciseId);
      const dto = exerciseDto(ex);
      return {
        id: we.id, exerciseId: ex.id, name: ex.name, displayOrder: we.displayOrder,
        categoryName: dto.categoryName, muscleGroupName: dto.muscleGroupName, equipmentName: dto.equipmentName,
        isExerciseActive: ex.isActive, primaryImage: dto.primaryImage, sets: setsOf(we.id),
      };
    });
    const allSets = exercises.flatMap((e) => e.sets);
    return {
      id: ws.id, workoutDate: ws.workoutDate, startTime: ws.startTime, endTime: ws.endTime, status: ws.status,
      label: D.sessionLabel(new Date(ws.startTime)),
      durationMs: ws.endTime ? new Date(ws.endTime) - new Date(ws.startTime) : null,
      exercises,
      totals: { exercises: exercises.length, sets: allSets.length, reps: D.total(allSets) },
      createdDate: ws.createdDate, modifiedDate: ws.modifiedDate,
    };
  }

  function ownedSession(ctx, id) {
    const ws = byId(db().workoutSessions, id);
    // Same response whether the record is missing or owned by someone else:
    // never reveal that another user's workout exists.
    if (!ws || ws.userId !== ctx.user.id) fail(404, 'Workout not found.');
    return ws;
  }
  function requireInProgress(ws) {
    if (ws.status !== S.InProgress) fail(409, 'This workout is ' + ws.status.toLowerCase() + ' and can no longer be changed.');
  }
  function ownedWorkoutExercise(ctx, id) {
    const we = byId(db().workoutExercises, id);
    if (!we) fail(404, 'Exercise entry not found.');
    const ws = ownedSession(ctx, we.workoutSessionId);
    return { we, ws };
  }
  function ownedSet(ctx, id) {
    const set = byId(db().workoutSets, id);
    if (!set) fail(404, 'Set not found.');
    const { we, ws } = ownedWorkoutExercise(ctx, set.workoutExerciseId);
    return { set, we, ws };
  }
  function touch(ws) { ws.modifiedDate = now(); }

  /** Completed-session entries for one exercise for the current user. */
  function exerciseEntries(userId, exerciseId, excludeWorkoutId) {
    const d = db();
    const sessions = d.workoutSessions.filter((ws) => ws.userId === userId && ws.status === S.Completed && ws.id !== excludeWorkoutId);
    const entries = [];
    sessions.forEach((ws) => {
      d.workoutExercises.filter((we) => we.workoutSessionId === ws.id && we.exerciseId === exerciseId).forEach((we) => {
        const sets = setsOf(we.id);
        if (!sets.length) return;
        entries.push({
          workoutId: ws.id, workoutExerciseId: we.id, workoutDate: ws.workoutDate, startTime: ws.startTime, endTime: ws.endTime,
          label: D.sessionLabel(new Date(ws.startTime)), sets, total: D.total(sets), best: D.best(sets),
        });
      });
    });
    return entries.sort(D.bySessionDesc);
  }

  function validateCountBody(body) {
    const err = D.validateCount(body && body.count);
    if (err) fail(422, 'Check the set count.', [fieldErr('count', err)]);
    return Number(body.count);
  }

  /* ======================================================================
     AUTH  /api/v1/auth/*
     ====================================================================== */
  def('POST', '/auth/register', (ctx) => {
    const b = ctx.body || {};
    const errors = [];
    const e1 = D.validateDisplayName(b.displayName); if (e1) errors.push(fieldErr('displayName', e1));
    const e2 = D.validateEmail(b.email); if (e2) errors.push(fieldErr('email', e2));
    const e3 = D.validatePassword(b.password); if (e3) errors.push(fieldErr('password', e3));
    if (errors.length) fail(422, 'Check the highlighted fields.', errors);
    const email = b.email.trim().toLowerCase();
    if (db().users.some((u) => u.email === email)) fail(409, 'An account with this email already exists.', [fieldErr('email', 'An account with this email already exists. Sign in instead.')]);
    const ts = now();
    const user = { id: U.uid('u'), email, passwordHash: DB.protoHash(b.password), displayName: b.displayName.trim(), role: 'User', isActive: true, createdDate: ts, modifiedDate: ts };
    db().users.push(user);
    audit(user, 'Register', 'User', user.id);
    return ok({ id: user.id, email: user.email, displayName: user.displayName }, 'Account created.', 201);
  }, { auth: false });

  def('POST', '/auth/login', (ctx) => {
    const b = ctx.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    if (!email || !b.password) fail(422, 'Enter your email and password.', [!email && fieldErr('email', 'Enter your email address.'), !b.password && fieldErr('password', 'Enter your password.')].filter(Boolean));
    const d = db();
    const t = Date.now();
    const attempts = (d.loginAttempts[email] || []).filter((x) => t - x < 5 * 60000);
    if (attempts.length >= 5) {
      const retry = Math.ceil((5 * 60000 - (t - attempts[0])) / 1000);
      fail(429, 'Too many sign-in attempts. Try again in ' + Math.max(1, Math.ceil(retry / 60)) + ' min.', [], { retryAfterSeconds: retry });
    }
    const user = d.users.find((u) => u.email === email);
    if (!user || user.passwordHash !== DB.protoHash(b.password)) {
      d.loginAttempts[email] = attempts.concat(t);
      audit(null, 'LoginFailed', 'User', email);
      fail(401, 'Email or password is incorrect.');
    }
    if (!user.isActive) { audit(user, 'LoginInactive', 'User', user.id); fail(403, 'This account is inactive. Contact the gym administrator.'); }
    d.loginAttempts[email] = [];
    const token = U.uid('tok') + U.uid('');
    const expiresAt = new Date(t + 8 * 3600000).toISOString();
    d.authTokens.push({ token, userId: user.id, expiresAt });
    audit(user, 'Login', 'User', user.id);
    return ok({ token, expiresAt, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } }, 'Signed in.');
  }, { auth: false });

  def('POST', '/auth/logout', (ctx) => {
    db().authTokens = db().authTokens.filter((x) => x.token !== ctx.token);
    audit(ctx.user, 'Logout', 'User', ctx.user.id);
    return noContent();
  });

  def('GET', '/auth/me', (ctx) => ok({ id: ctx.user.id, email: ctx.user.email, displayName: ctx.user.displayName, role: ctx.user.role, expiresAt: ctx.tokenRow.expiresAt }));

  def('PUT', '/users/me', (ctx) => {
    const err = D.validateDisplayName(ctx.body && ctx.body.displayName);
    if (err) fail(422, 'Check the highlighted fields.', [fieldErr('displayName', err)]);
    ctx.user.displayName = ctx.body.displayName.trim();
    ctx.user.modifiedDate = now();
    return ok({ id: ctx.user.id, email: ctx.user.email, displayName: ctx.user.displayName, role: ctx.user.role }, 'Profile updated.');
  });

  /* ======================================================================
     REFERENCE DATA  /api/v1/reference
     ====================================================================== */
  const REF_TYPES = { categories: 'categories', 'muscle-groups': 'muscleGroups', equipment: 'equipment' };
  def('GET', '/reference', (ctx) => {
    const admin = ctx.user.role === 'Admin';
    const pick = (list) => list.filter((r) => admin || r.isActive).slice().sort((a, b) => a.displayOrder - b.displayOrder).map((r) => ({
      ...r, usage: db().exercises.filter((e) => e.categoryId === r.id || e.muscleGroupId === r.id || e.equipmentId === r.id).length,
    }));
    return ok({ categories: pick(db().categories), muscleGroups: pick(db().muscleGroups), equipment: pick(db().equipment) });
  });
  def('POST', '/reference/:type', (ctx) => {
    const key = REF_TYPES[ctx.params.type]; if (!key) fail(404, 'Unknown reference type.');
    const name = String((ctx.body && ctx.body.name) || '').trim();
    if (name.length < 2 || name.length > 50) fail(422, 'Check the name.', [fieldErr('name', 'Name must be 2–50 characters.')]);
    const list = db()[key];
    if (list.some((r) => r.name.toLowerCase() === name.toLowerCase())) fail(409, '"' + name + '" already exists.', [fieldErr('name', '"' + name + '" already exists.')]);
    const row = { id: U.uid(key.slice(0, 3)), name, isActive: true, displayOrder: list.length + 1 };
    list.push(row);
    audit(ctx.user, 'Create', key, row.id);
    return ok(row, '"' + name + '" added.', 201);
  }, { role: 'Admin' });
  def('PUT', '/reference/:type/:id', (ctx) => {
    const key = REF_TYPES[ctx.params.type]; if (!key) fail(404, 'Unknown reference type.');
    const row = byId(db()[key], ctx.params.id); if (!row) fail(404, 'Item not found.');
    const b = ctx.body || {};
    if (b.name != null) {
      const name = String(b.name).trim();
      if (name.length < 2 || name.length > 50) fail(422, 'Check the name.', [fieldErr('name', 'Name must be 2–50 characters.')]);
      if (db()[key].some((r) => r.id !== row.id && r.name.toLowerCase() === name.toLowerCase())) fail(409, '"' + name + '" already exists.', [fieldErr('name', '"' + name + '" already exists.')]);
      row.name = name;
    }
    if (b.isActive != null) row.isActive = !!b.isActive;
    audit(ctx.user, 'Update', key, row.id);
    return ok(row, 'Saved.');
  }, { role: 'Admin' });

  /* ======================================================================
     EXERCISES  /api/v1/exercises
     ====================================================================== */
  def('GET', '/exercises', (ctx) => {
    const q = ctx.query;
    const admin = ctx.user.role === 'Admin' && q.scope === 'admin';
    const status = admin ? (q.status || 'all') : 'active';
    const term = String(q.search || '').trim().toLowerCase();
    let list = db().exercises.slice();
    if (status === 'active') list = list.filter((e) => e.isActive);
    if (status === 'inactive') list = list.filter((e) => !e.isActive);
    if (q.categoryId) list = list.filter((e) => e.categoryId === q.categoryId);
    let items = list.map((e) => exerciseDto(e));
    if (term) items = items.filter((e) => [e.name, e.categoryName, e.muscleGroupName, e.equipmentName].some((v) => v.toLowerCase().includes(term)));
    if (q.include === 'last') {
      items.forEach((e) => {
        const entries = exerciseEntries(ctx.user.id, e.id, q.excludeWorkoutId);
        e.last = entries[0] ? { workoutId: entries[0].workoutId, workoutDate: entries[0].workoutDate, label: entries[0].label, sets: entries[0].sets } : null;
        e.sessionsCount = entries.length;
      });
    }
    items.sort(q.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    return ok({ items, total: items.length });
  });

  def('GET', '/exercises/:id', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id);
    if (!ex) fail(404, 'Exercise not found.');
    return ok(exerciseDto(ex, { withMedia: true, allMedia: ctx.user.role === 'Admin' && ctx.query.scope === 'admin' }));
  });

  function validateExerciseBody(body, existingId) {
    const b = body || {};
    const errors = [];
    const d = db();
    const nameErr = D.validateExerciseName(b.name);
    if (nameErr) errors.push(fieldErr('name', nameErr));
    if (!byId(d.categories, b.categoryId)) errors.push(fieldErr('categoryId', 'Choose a category.'));
    if (!byId(d.muscleGroups, b.muscleGroupId)) errors.push(fieldErr('muscleGroupId', 'Choose a muscle group.'));
    if (!byId(d.equipment, b.equipmentId)) errors.push(fieldErr('equipmentId', 'Choose the equipment.'));
    if (b.description && b.description.length > 2000) errors.push(fieldErr('description', 'Description must be 2,000 characters or less.'));
    if (b.instructions && b.instructions.length > 4000) errors.push(fieldErr('instructions', 'Instructions must be 4,000 characters or less.'));
    const order = Number(b.displayOrder);
    if (b.displayOrder !== '' && b.displayOrder != null && (!Number.isInteger(order) || order < 0 || order > 9999)) errors.push(fieldErr('displayOrder', 'Use a whole number from 0 to 9999.'));
    if (errors.length) fail(422, 'Check the highlighted fields.', errors);
    const name = b.name.trim();
    if (d.exercises.some((e) => e.id !== existingId && e.name.toLowerCase() === name.toLowerCase())) {
      fail(409, 'An exercise named "' + name + '" already exists.', [fieldErr('name', 'An exercise named "' + name + '" already exists.')]);
    }
  }

  def('POST', '/exercises', (ctx) => {
    validateExerciseBody(ctx.body);
    const b = ctx.body;
    const ts = now();
    const maxOrder = Math.max(0, ...db().exercises.map((e) => e.displayOrder));
    const ex = {
      id: U.uid('ex'), name: b.name.trim(), categoryId: b.categoryId, muscleGroupId: b.muscleGroupId, equipmentId: b.equipmentId,
      description: (b.description || '').trim(), instructions: (b.instructions || '').trim(), isActive: b.isActive !== false,
      displayOrder: b.displayOrder === '' || b.displayOrder == null ? maxOrder + 10 : Number(b.displayOrder),
      createdDate: ts, modifiedDate: ts, createdBy: ctx.user.id, modifiedBy: ctx.user.id,
    };
    db().exercises.push(ex);
    audit(ctx.user, 'Create', 'Exercise', ex.id);
    return ok(exerciseDto(ex, { withMedia: true, allMedia: true }), '"' + ex.name + '" created.', 201);
  }, { role: 'Admin' });

  def('PUT', '/exercises/:id', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    validateExerciseBody(ctx.body, ex.id);
    const b = ctx.body;
    Object.assign(ex, {
      name: b.name.trim(), categoryId: b.categoryId, muscleGroupId: b.muscleGroupId, equipmentId: b.equipmentId,
      description: (b.description || '').trim(), instructions: (b.instructions || '').trim(),
      isActive: b.isActive !== false, displayOrder: b.displayOrder === '' || b.displayOrder == null ? ex.displayOrder : Number(b.displayOrder),
      modifiedDate: now(), modifiedBy: ctx.user.id,
    });
    audit(ctx.user, 'Update', 'Exercise', ex.id);
    return ok(exerciseDto(ex, { withMedia: true, allMedia: true }), 'Changes saved.');
  }, { role: 'Admin' });

  def('PATCH', '/exercises/:id/status', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    ex.isActive = !!(ctx.body && ctx.body.isActive);
    ex.modifiedDate = now(); ex.modifiedBy = ctx.user.id;
    audit(ctx.user, ex.isActive ? 'Activate' : 'Deactivate', 'Exercise', ex.id);
    return ok(exerciseDto(ex), ex.name + (ex.isActive ? ' is active.' : ' is inactive.'));
  }, { role: 'Admin' });

  /* ---- Exercise media --------------------------------------------------------- */
  def('GET', '/exercises/:id/media', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    const all = ctx.user.role === 'Admin';
    return ok(db().exerciseMedia.filter((m) => m.exerciseId === ex.id && (all || m.isActive)).sort((a, b) => a.displayOrder - b.displayOrder));
  });
  def('POST', '/exercises/:id/media', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    const b = ctx.body || {};
    const v = D.validateMedia({ name: b.fileName, type: b.mimeType, size: b.sizeBytes });
    if (v.error) fail(v.error.includes('too large') ? 413 : 415, v.error, [fieldErr('file', v.error)]);
    const list = db().exerciseMedia.filter((m) => m.exerciseId === ex.id);
    const ts = now();
    const kind = v.kind === 'image' ? 'Image' : 'Video';
    const media = {
      id: U.uid('m'), exerciseId: ex.id, mediaType: kind,
      // Real system: generated storage name, never the uploaded file name.
      fileUrl: b.dataUrl || '/media/exercises/' + U.uid('upload') + '.' + String(b.fileName).split('.').pop().toLowerCase(),
      thumbnailUrl: null, fileName: b.fileName, mimeType: b.mimeType, sizeBytes: b.sizeBytes,
      altText: kind === 'Image' ? (b.altText || ex.name) : null, title: kind === 'Video' ? (b.title || ex.name + ' tutorial') : null,
      durationSeconds: b.durationSeconds || null, displayOrder: list.length + 1, isActive: true, createdDate: ts, modifiedDate: ts,
    };
    db().exerciseMedia.push(media);
    audit(ctx.user, 'UploadMedia', 'ExerciseMedia', media.id);
    return ok(media, b.fileName + ' uploaded.', 201);
  }, { role: 'Admin' });
  def('PUT', '/exercises/:id/media/:mediaId', (ctx) => {
    const m = db().exerciseMedia.find((x) => x.id === ctx.params.mediaId && x.exerciseId === ctx.params.id);
    if (!m) fail(404, 'Media not found.');
    const b = ctx.body || {};
    if (b.altText != null) {
      if (m.mediaType === 'Image' && !String(b.altText).trim()) fail(422, 'Describe the image.', [fieldErr('altText', 'Alt text is required for images.')]);
      m.altText = String(b.altText).trim();
    }
    if (b.title != null) m.title = String(b.title).trim();
    if (b.isActive != null) m.isActive = !!b.isActive;
    m.modifiedDate = now();
    audit(ctx.user, 'UpdateMedia', 'ExerciseMedia', m.id);
    return ok(m, 'Saved.');
  }, { role: 'Admin' });
  def('POST', '/exercises/:id/media/reorder', (ctx) => {
    const ids = (ctx.body && ctx.body.ids) || [];
    const list = db().exerciseMedia.filter((m) => m.exerciseId === ctx.params.id);
    if (ids.length !== list.length || !ids.every((id) => list.some((m) => m.id === id))) fail(422, 'The media list changed. Reload and try again.');
    ids.forEach((id, i) => { const m = list.find((x) => x.id === id); m.displayOrder = i + 1; m.modifiedDate = now(); });
    audit(ctx.user, 'ReorderMedia', 'Exercise', ctx.params.id);
    return ok(list.slice().sort((a, b) => a.displayOrder - b.displayOrder), 'Order saved.');
  }, { role: 'Admin' });
  def('DELETE', '/exercises/:id/media/:mediaId', (ctx) => {
    const d = db();
    const m = d.exerciseMedia.find((x) => x.id === ctx.params.mediaId && x.exerciseId === ctx.params.id);
    if (!m) fail(404, 'Media not found.');
    d.exerciseMedia = d.exerciseMedia.filter((x) => x.id !== m.id);
    d.exerciseMedia.filter((x) => x.exerciseId === ctx.params.id).sort((a, b) => a.displayOrder - b.displayOrder).forEach((x, i) => { x.displayOrder = i + 1; });
    audit(ctx.user, 'DeleteMedia', 'ExerciseMedia', m.id);
    return noContent();
  }, { role: 'Admin' });

  /* ---- History, comparison, analytics ---------------------------------------------- */
  def('GET', '/exercises/:id/history', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    let entries = exerciseEntries(ctx.user.id, ex.id, ctx.query.excludeWorkoutId);
    if (ctx.query.limit) entries = entries.slice(0, Number(ctx.query.limit));
    // Delta vs the previous session (next item in the desc list).
    entries.forEach((e, i) => { const prev = entries[i + 1]; e.deltaVsPrevious = prev ? e.total - prev.total : null; });
    return ok({ exercise: exerciseDto(ex), items: entries });
  });

  def('GET', '/exercises/:id/comparison', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    const pick = (wid) => {
      const ws = ownedSession(ctx, wid);
      const we = db().workoutExercises.find((x) => x.workoutSessionId === ws.id && x.exerciseId === ex.id);
      if (!we) fail(422, ex.name + ' is not part of that workout.');
      return { workoutId: ws.id, workoutDate: ws.workoutDate, startTime: ws.startTime, status: ws.status, label: D.sessionLabel(new Date(ws.startTime)), sets: setsOf(we.id) };
    };
    if (!ctx.query.currentWorkoutId || !ctx.query.previousWorkoutId) fail(422, 'Choose two sessions to compare.');
    const current = pick(ctx.query.currentWorkoutId);
    const previous = pick(ctx.query.previousWorkoutId);
    return ok({ exercise: exerciseDto(ex), current, previous, ...D.compareSets(previous.sets, current.sets) });
  });

  def('GET', '/exercises/:id/analytics', (ctx) => {
    const ex = byId(db().exercises, ctx.params.id); if (!ex) fail(404, 'Exercise not found.');
    const entries = exerciseEntries(ctx.user.id, ex.id);
    return ok({ exercise: exerciseDto(ex), range: ctx.query.range || 'all', ...D.exerciseAnalytics(entries, { today: U.todayISO(), range: ctx.query.range || 'all' }) });
  });

  def('GET', '/analytics/summary', (ctx) => {
    const d = db();
    const today = U.todayISO();
    const mine = d.workoutSessions.filter((ws) => ws.userId === ctx.user.id && ws.status === S.Completed);
    const wk = D.weekStart(today);
    const pwk = D.addDaysISO(wk, -7);
    const statsFor = (from, to) => {
      const list = mine.filter((ws) => ws.workoutDate >= from && ws.workoutDate <= to).map(sessionDetail);
      return { sessions: list.length, sets: U.sum(list, (s) => s.totals.sets), reps: U.sum(list, (s) => s.totals.reps) };
    };
    const thisWeek = statsFor(wk, today);
    const lastWeek = statsFor(pwk, D.addDaysISO(wk, -1));
    const since30 = D.addDaysISO(today, -29);
    const last30 = mine.filter((ws) => ws.workoutDate >= since30);
    const exIds = new Set();
    let sets30 = 0;
    last30.forEach((ws) => d.workoutExercises.filter((we) => we.workoutSessionId === ws.id).forEach((we) => { exIds.add(we.exerciseId); sets30 += setsOf(we.id).length; }));
    const since8w = D.addDaysISO(wk, -49);
    const exercises = d.exercises.map((ex) => {
      const entries = exerciseEntries(ctx.user.id, ex.id);
      if (!entries.length) return null;
      const [last, prev] = entries;
      return {
        exerciseId: ex.id, name: ex.name, categoryName: refName(d.categories, ex.categoryId), isActive: ex.isActive,
        sessionsCount: entries.length, lastDate: last.workoutDate, lastLabel: last.label, lastWorkoutId: last.workoutId,
        lastSets: last.sets, lastTotal: last.total, prevTotal: prev ? prev.total : null, delta: prev ? last.total - prev.total : null,
        spark: entries.slice(0, 10).reverse().map((e) => e.total),
      };
    }).filter(Boolean).sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : b.sessionsCount - a.sessionsCount));
    return ok({
      thisWeek, lastWeek,
      last30: { sessions: last30.length, exercises: exIds.size, sets: sets30 },
      avgPerWeek: Math.round((mine.filter((ws) => ws.workoutDate >= since8w).length / 8) * 10) / 10,
      exercises,
    });
  });

  /* ======================================================================
     WORKOUTS  /api/v1/workouts
     ====================================================================== */
  def('GET', '/workouts', (ctx) => {
    const q = ctx.query;
    let list = db().workoutSessions.filter((ws) => ws.userId === ctx.user.id);
    if (q.status) list = list.filter((ws) => ws.status === q.status);
    else list = list.filter((ws) => ws.status !== S.InProgress);
    if (q.date) list = list.filter((ws) => ws.workoutDate === q.date);
    if (q.from) list = list.filter((ws) => ws.workoutDate >= q.from);
    if (q.exerciseId) {
      const ids = new Set(db().workoutExercises.filter((we) => we.exerciseId === q.exerciseId).map((we) => we.workoutSessionId));
      list = list.filter((ws) => ids.has(ws.id));
    }
    list.sort(D.bySessionDesc);
    const pageSize = Math.min(50, Number(q.pageSize) || 20);
    const page = Math.max(1, Number(q.page) || 1);
    const items = list.slice((page - 1) * pageSize, page * pageSize).map(sessionDetail);
    return ok({ items, page, pageSize, total: list.length });
  });

  def('GET', '/workouts/active', (ctx) => {
    const ws = db().workoutSessions.find((x) => x.userId === ctx.user.id && x.status === S.InProgress);
    return ok(ws ? sessionDetail(ws) : null);
  });

  def('POST', '/workouts', (ctx) => {
    const b = ctx.body || {};
    const today = U.todayISO();
    if (!b.workoutDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.workoutDate)) fail(422, 'Workout date is required.', [fieldErr('workoutDate', 'Workout date is required.')]);
    if (Math.abs(U.daysBetween(b.workoutDate, today)) > 1) fail(422, 'Workout date must be today.', [fieldErr('workoutDate', 'Workout date must be today.')]);
    const active = db().workoutSessions.find((x) => x.userId === ctx.user.id && x.status === S.InProgress);
    if (active) fail(409, 'You already have a workout in progress.', [], { activeWorkoutId: active.id });
    const ts = now();
    const ws = { id: U.uid('ws'), userId: ctx.user.id, workoutDate: b.workoutDate, startTime: ts, endTime: null, status: S.InProgress, createdDate: ts, modifiedDate: ts };
    db().workoutSessions.push(ws);
    audit(ctx.user, 'StartWorkout', 'WorkoutSession', ws.id);
    return ok(sessionDetail(ws), 'Workout started.', 201);
  });

  def('GET', '/workouts/:id', (ctx) => ok(sessionDetail(ownedSession(ctx, ctx.params.id))));

  def('POST', '/workouts/:id/complete', (ctx) => {
    const ws = ownedSession(ctx, ctx.params.id);
    requireInProgress(ws);
    const d = db();
    const wes = d.workoutExercises.filter((we) => we.workoutSessionId === ws.id);
    const withSets = wes.filter((we) => d.workoutSets.some((s) => s.workoutExerciseId === we.id));
    if (!withSets.length) fail(422, 'Log at least one set before finishing, or cancel the workout.');
    // Exercises with no sets are removed on completion; order is re-sequenced.
    const emptyIds = new Set(wes.filter((we) => !withSets.includes(we)).map((we) => we.id));
    d.workoutExercises = d.workoutExercises.filter((we) => !emptyIds.has(we.id));
    withSets.sort((a, b) => a.displayOrder - b.displayOrder).forEach((we, i) => { we.displayOrder = i + 1; });
    ws.status = S.Completed; ws.endTime = now(); touch(ws);
    audit(ctx.user, 'CompleteWorkout', 'WorkoutSession', ws.id);
    return ok(sessionDetail(ws), 'Workout completed.');
  });

  def('POST', '/workouts/:id/cancel', (ctx) => {
    const ws = ownedSession(ctx, ctx.params.id);
    requireInProgress(ws);
    ws.status = S.Cancelled; ws.endTime = now(); touch(ws);
    audit(ctx.user, 'CancelWorkout', 'WorkoutSession', ws.id);
    return ok(sessionDetail(ws), 'Workout cancelled.');
  });

  def('POST', '/workouts/:id/exercises', (ctx) => {
    const ws = ownedSession(ctx, ctx.params.id);
    requireInProgress(ws);
    const d = db();
    const ex = byId(d.exercises, ctx.body && ctx.body.exerciseId);
    if (!ex) fail(404, 'Exercise not found.', [fieldErr('exerciseId', 'Exercise not found.')]);
    if (!ex.isActive) fail(422, ex.name + ' is no longer available for new workouts.', [fieldErr('exerciseId', 'Exercise is inactive.')]);
    const existing = d.workoutExercises.filter((we) => we.workoutSessionId === ws.id);
    if (existing.some((we) => we.exerciseId === ex.id)) fail(409, ex.name + ' is already in this workout.');
    const ts = now();
    const we = { id: U.uid('we'), workoutSessionId: ws.id, exerciseId: ex.id, displayOrder: Math.max(0, ...existing.map((x) => x.displayOrder)) + 1, createdDate: ts, modifiedDate: ts };
    d.workoutExercises.push(we);
    touch(ws);
    const dto = exerciseDto(ex);
    return ok({ id: we.id, exerciseId: ex.id, name: ex.name, displayOrder: we.displayOrder, categoryName: dto.categoryName, muscleGroupName: dto.muscleGroupName, equipmentName: dto.equipmentName, isExerciseActive: true, primaryImage: dto.primaryImage, sets: [] }, ex.name + ' added.', 201);
  });

  def('DELETE', '/workout-exercises/:id', (ctx) => {
    const { we, ws } = ownedWorkoutExercise(ctx, ctx.params.id);
    requireInProgress(ws);
    const d = db();
    d.workoutSets = d.workoutSets.filter((s) => s.workoutExerciseId !== we.id);
    d.workoutExercises = d.workoutExercises.filter((x) => x.id !== we.id);
    d.workoutExercises.filter((x) => x.workoutSessionId === ws.id).sort((a, b) => a.displayOrder - b.displayOrder).forEach((x, i) => { x.displayOrder = i + 1; });
    touch(ws);
    return noContent();
  });

  def('POST', '/workout-exercises/:id/sets', (ctx) => {
    const { we, ws } = ownedWorkoutExercise(ctx, ctx.params.id);
    requireInProgress(ws);
    const count = validateCountBody(ctx.body);
    const d = db();
    const setNumber = Math.max(0, ...d.workoutSets.filter((s) => s.workoutExerciseId === we.id).map((s) => s.setNumber)) + 1;
    const ts = now();
    const set = { id: U.uid('set'), workoutExerciseId: we.id, setNumber, count, createdDate: ts, modifiedDate: ts };
    d.workoutSets.push(set);
    touch(ws);
    return ok({ id: set.id, setNumber, count, modifiedDate: ts }, 'Set saved.', 201);
  });

  def('PUT', '/workout-sets/:id', (ctx) => {
    const { set, ws } = ownedSet(ctx, ctx.params.id);
    requireInProgress(ws);
    set.count = validateCountBody(ctx.body);
    set.modifiedDate = now();
    touch(ws);
    return ok({ id: set.id, setNumber: set.setNumber, count: set.count, modifiedDate: set.modifiedDate }, 'Set updated.');
  });

  def('DELETE', '/workout-sets/:id', (ctx) => {
    const { set, we, ws } = ownedSet(ctx, ctx.params.id);
    requireInProgress(ws);
    const d = db();
    d.workoutSets = d.workoutSets.filter((s) => s.id !== set.id);
    // Keep set numbers contiguous (1..n) inside one transaction.
    d.workoutSets.filter((s) => s.workoutExerciseId === we.id && s.setNumber > set.setNumber).forEach((s) => { s.setNumber -= 1; s.modifiedDate = now(); });
    touch(ws);
    return noContent();
  });

  /* ======================================================================
     Request pipeline (the "middleware")
     ====================================================================== */
  async function request(method, url, opts) {
    const o = opts || {};
    const started = performance.now();
    const base = net.mode === 'slow' ? 1500 + Math.random() * 800 : 140 + Math.random() * 260;
    await U.sleep(base);
    const [rawPath, rawQuery] = url.replace(/^\/api\/v1/, '').split('?');
    const entry = { at: new Date().toISOString(), method, path: '/api/v1' + rawPath + (rawQuery ? '?' + rawQuery : ''), status: 0, ms: 0 };
    const finish = (res) => { entry.status = res.status; entry.ms = Math.round(performance.now() - started); log.unshift(entry); if (log.length > 40) log.pop(); listeners.forEach((fn) => fn({ ...net })); return res; };

    if (net.mode === 'offline') { entry.status = 'offline'; log.unshift(entry); if (log.length > 40) log.pop(); throw new TypeError('Failed to fetch'); }
    if (net.failNext) { net.failNext = false; return finish({ status: 500, body: { success: false, message: 'Something went wrong on our side. Try again.', data: null, errors: [] } }); }

    const query = {};
    new URLSearchParams(rawQuery || '').forEach((v, k) => { query[k] = v; });
    const route = routes.find((r) => r.method === method && r.re.test(rawPath));
    if (!route) return finish({ status: 404, body: { success: false, message: 'Endpoint not found.', data: null, errors: [] } });
    const m = rawPath.match(route.re);
    const params = {};
    route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

    const ctx = { params, query, body: o.body ? JSON.parse(JSON.stringify(o.body)) : null, headers: o.headers || {} };
    try {
      const d = db();
      if (route.auth) {
        const auth = ctx.headers.Authorization || '';
        const token = auth.replace(/^Bearer\s+/, '');
        const row = d.authTokens.find((t) => t.token === token);
        if (!row || new Date(row.expiresAt) < new Date()) fail(401, 'Your session has expired. Sign in again.');
        const user = byId(d.users, row.userId);
        if (!user || !user.isActive) fail(401, 'Your session has expired. Sign in again.');
        ctx.user = user; ctx.token = token; ctx.tokenRow = row;
        if (route.role && user.role !== route.role) { audit(user, 'Forbidden', 'Endpoint', method + ' ' + rawPath); fail(403, "You don't have permission to do that."); }
      }
      const idemKey = ctx.headers['Idempotency-Key'];
      const cacheKey = idemKey && ctx.user ? ctx.user.id + '|' + method + '|' + rawPath + '|' + idemKey : null;
      if (cacheKey && d.idempotency[cacheKey]) return finish(JSON.parse(JSON.stringify(d.idempotency[cacheKey])));
      const res = route.handler(ctx);
      if (cacheKey) d.idempotency[cacheKey] = res;
      DB.save();
      return finish(JSON.parse(JSON.stringify(res)));
    } catch (e) {
      if (e instanceof HttpError) {
        DB.save();
        return finish({ status: e.status, body: { success: false, message: e.message, data: e.data || null, errors: e.errors } });
      }
      console.error('[mock api] unhandled', e);
      return finish({ status: 500, body: { success: false, message: 'Something went wrong on our side. Try again.', data: null, errors: [] } });
    }
  }

  G.MockApi = {
    request,
    network: net,
    setNetwork,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    log,
    expireSessions() { db().authTokens.forEach((t) => { t.expiresAt = new Date(Date.now() - 1000).toISOString(); }); DB.save(); },
  };
})(window.GL = window.GL || {});
