/* GymLogger prototype — in-browser data store that mirrors the Phase 1 SQL
   Server schema (User, Exercise, ExerciseMedia, WorkoutSession,
   WorkoutExercise, WorkoutSet + reference tables). Seeded with realistic
   history relative to "today", including the spec's same-day example:
     18 Sep — Morning   Bench Press 15 / 12 / 10
     18 Sep — Afternoon Bench Press 12 / 10 / 8
     15 Sep — Evening   Bench Press 14 / 11 / 9
   (dates shift so the example always sits 9 and 12 days before today). */
(function (G) {
  'use strict';
  const U = G.U;
  const KEY = 'gymlogger.proto.db.v1';

  /* ---- Deterministic PRNG so every reviewer sees the same history -------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Prototype-only stand-in for a password hash. The real system uses ASP.NET
     Core Identity's PasswordHasher (PBKDF2) — never plain text. */
  function protoHash(pw) {
    let h = 0x811c9dc5;
    for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return 'proto-fnv1a$' + (h >>> 0).toString(16);
  }

  const REF = {
    categories: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'],
    muscleGroups: ['Chest', 'Lats', 'Upper back', 'Quads', 'Hamstrings', 'Glutes', 'Front delts', 'Side delts', 'Biceps', 'Triceps', 'Abs'],
    equipment: ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell'],
  };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const EXERCISES = [
    ['ex-bench', 'Bench Press', 'Chest', 'Chest', 'Barbell', [11, 9, 8], [15, 13, 11],
      'A horizontal barbell press and the main compound lift for chest strength. Also trains front delts and triceps.',
      'Lie on the bench with your eyes directly under the bar.\nGrip the bar slightly wider than shoulder width and set your shoulder blades back and down.\nUnrack and lower the bar with control to mid-chest.\nPress up until your arms are straight, keeping your feet planted and glutes on the bench.'],
    ['ex-incline-db', 'Incline Dumbbell Press', 'Chest', 'Chest', 'Dumbbell', [10, 9, 8], [12, 11, 10],
      'A pressing movement on a 30–45° bench that emphasises the upper chest.',
      'Set the bench to 30–45°.\nStart with the dumbbells at shoulder height, palms facing forward.\nPress up and slightly together until your arms are straight.\nLower slowly until you feel a stretch across the chest.'],
    ['ex-pushup', 'Push-Up', 'Chest', 'Chest', 'Bodyweight', [20, 16, 14], [28, 24, 20],
      'A bodyweight press that can be done anywhere. Keep a straight line from head to heels.',
      'Place your hands slightly wider than shoulder width.\nBrace your core so your body forms a straight line.\nLower until your chest is just above the floor.\nPush back up to full arm extension.'],
    ['ex-ohp', 'Overhead Press', 'Shoulders', 'Front delts', 'Barbell', [9, 8, 7], [11, 10, 9],
      'A standing barbell press overhead for shoulder strength and core stability.',
      'Hold the bar at collarbone height with a grip just outside the shoulders.\nBrace your core and squeeze your glutes.\nPress the bar straight up, moving your head back slightly to clear it.\nLock out overhead, then lower with control.'],
    ['ex-lateral', 'Lateral Raise', 'Shoulders', 'Side delts', 'Dumbbell', [12, 12, 10], [15, 14, 12],
      'An isolation movement for the side delts that builds shoulder width.',
      'Stand tall with a dumbbell in each hand at your sides.\nRaise the dumbbells out to the side with a slight bend in the elbows.\nStop at shoulder height.\nLower slowly over two to three seconds.'],
    ['ex-dip', 'Triceps Dip', 'Arms', 'Triceps', 'Bodyweight', [8, 7, 6], [12, 10, 9],
      'A bodyweight press on parallel bars that targets the triceps and lower chest.',
      'Support yourself on the bars with straight arms.\nKeep your torso upright to emphasise the triceps.\nLower until your elbows reach about 90°.\nPress back up to straight arms.'],
    ['ex-pullup', 'Pull-Up', 'Back', 'Lats', 'Bodyweight', [6, 5, 4], [9, 8, 7],
      'A vertical pull from a dead hang. The benchmark bodyweight back exercise.',
      'Hang from the bar with an overhand grip slightly wider than shoulder width.\nPull your shoulder blades down, then drive your elbows toward your ribs.\nPull until your chin clears the bar.\nLower to a full hang with control.'],
    ['ex-row', 'Barbell Row', 'Back', 'Upper back', 'Barbell', [10, 9, 8], [12, 11, 10],
      'A bent-over horizontal pull that builds the upper back and lats.',
      'Hinge at the hips until your torso is about 45° to the floor.\nHold the bar with straight arms below your shoulders.\nRow the bar to your lower ribs, squeezing your shoulder blades together.\nLower with control without rounding your back.'],
    ['ex-pulldown', 'Lat Pulldown', 'Back', 'Lats', 'Cable', [12, 10, 10], [14, 12, 12],
      'A cable vertical pull. Useful for building up to pull-ups.',
      'Sit with your thighs secured under the pads.\nGrip the bar wider than shoulder width.\nPull the bar to your upper chest, leading with the elbows.\nLet the bar rise slowly until your arms are straight.'],
    ['ex-curl', 'Barbell Curl', 'Arms', 'Biceps', 'Barbell', [10, 9, 8], [12, 11, 10],
      'A standing curl for the biceps.',
      'Stand tall holding the bar with an underhand, shoulder-width grip.\nKeep your elbows at your sides.\nCurl the bar up to shoulder height.\nLower slowly to straight arms.'],
    ['ex-squat', 'Back Squat', 'Legs', 'Quads', 'Barbell', [8, 8, 7], [10, 10, 9],
      'The main lower-body compound lift. Trains quads, glutes and core.',
      'Set the bar across your upper back and step out of the rack.\nStand with feet about shoulder width apart, toes slightly out.\nSit down and back until your hips are below your knees.\nDrive up through your whole foot to standing.'],
    ['ex-rdl', 'Romanian Deadlift', 'Legs', 'Hamstrings', 'Barbell', [10, 9, 8], [12, 11, 10],
      'A hip hinge that loads the hamstrings and glutes through a long range.',
      'Stand holding the bar at hip height.\nPush your hips back, keeping the bar close to your legs.\nLower until you feel a strong hamstring stretch, back flat.\nDrive your hips forward to stand tall.'],
    ['ex-lunge', 'Walking Lunge', 'Legs', 'Glutes', 'Dumbbell', [10, 10, 10], [12, 12, 12],
      'A single-leg movement for glutes, quads and balance. Count reps per leg.',
      'Hold a dumbbell in each hand.\nStep forward and lower until both knees are at about 90°.\nPush through the front heel and step into the next lunge.\nAlternate legs for the full set.'],
    ['ex-legpress', 'Leg Press', 'Legs', 'Quads', 'Machine', [12, 10, 10], [15, 14, 12],
      'A machine press for the quads with less load on the lower back.',
      'Sit with your back flat against the pad.\nPlace your feet shoulder width apart on the platform.\nLower the platform until your knees reach about 90°.\nPress back up without locking your knees.'],
    ['ex-hlr', 'Hanging Leg Raise', 'Core', 'Abs', 'Bodyweight', [10, 8, 8], [14, 12, 10],
      'A hanging core exercise for the lower abs and hip flexors.',
      'Hang from the bar with straight arms.\nBrace your core to stop swinging.\nRaise your legs until they are parallel to the floor or higher.\nLower slowly.'],
    ['ex-cablecrunch', 'Cable Crunch', 'Core', 'Abs', 'Cable', [15, 12, 12], [18, 16, 15],
      'A kneeling cable crunch for loaded ab training.',
      'Kneel facing the cable stack holding the rope beside your head.\nKeep your hips still.\nCrunch down by bringing your ribs toward your hips.\nReturn slowly to the start.'],
    ['ex-kbswing', 'Kettlebell Swing', 'Legs', 'Glutes', 'Kettlebell', [15, 15, 15], [20, 20, 18],
      'An explosive hip hinge for power and conditioning.',
      'Stand with feet wider than hip width and the kettlebell in front of you.\nHike the bell back between your legs.\nSnap your hips forward to swing it to chest height.\nLet it fall back and repeat.'],
    ['ex-smith', 'Smith Machine Squat', 'Legs', 'Quads', 'Machine', [10, 10, 10], [10, 10, 10],
      'A guided squat on the Smith machine. Deactivated: the gym removed this machine.',
      'Set the bar at shoulder height.\nStep under the bar with feet slightly in front of you.\nSquat to parallel.\nDrive up to standing.'],
  ];
  const INACTIVE = new Set(['ex-smith']);

  const ROTATION = {
    push: ['ex-bench', 'ex-incline-db', 'ex-ohp', 'ex-lateral', 'ex-dip'],
    pull: ['ex-pullup', 'ex-row', 'ex-pulldown', 'ex-curl', 'ex-cablecrunch'],
    legs: ['ex-squat', 'ex-rdl', 'ex-lunge', 'ex-legpress', 'ex-hlr'],
  };

  function refId(prefix, name) { return prefix + '-' + slug(name); }

  function localTs(iso, hhmm, plusMinutes) {
    const d = U.parseISODate(iso);
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m + (plusMinutes || 0), 0, 0);
    return d.toISOString();
  }

  function seed() {
    const rnd = mulberry32(20260927);
    const today = U.todayISO();
    const created = new Date(Date.now() - 90 * 86400000).toISOString();
    const db = {
      version: 1, seededOn: today,
      users: [], categories: [], muscleGroups: [], equipment: [], exercises: [], exerciseMedia: [],
      workoutSessions: [], workoutExercises: [], workoutSets: [],
      authTokens: [], loginAttempts: {}, idempotency: {}, auditLog: [],
    };

    const user = (id, email, pw, name, role, active) => db.users.push({ id, email, passwordHash: protoHash(pw), displayName: name, role, isActive: active, createdDate: created, modifiedDate: created });
    user('u-admin', 'admin@gymlogger.test', 'Admin@1234', 'Riya Admin', 'Admin', true);
    user('u-demo', 'demo@gymlogger.test', 'Demo@1234', 'Alex Morgan', 'User', true);
    user('u-other', 'other@gymlogger.test', 'Other@1234', 'Jordan Lee', 'User', true);
    user('u-inactive', 'inactive@gymlogger.test', 'Inactive@1234', 'Sam Inactive', 'User', false);

    REF.categories.forEach((n, i) => db.categories.push({ id: refId('cat', n), name: n, isActive: true, displayOrder: i + 1 }));
    REF.muscleGroups.forEach((n, i) => db.muscleGroups.push({ id: refId('mg', n), name: n, isActive: true, displayOrder: i + 1 }));
    REF.equipment.forEach((n, i) => db.equipment.push({ id: refId('eq', n), name: n, isActive: true, displayOrder: i + 1 }));

    const profile = {};
    EXERCISES.forEach((e, i) => {
      const [id, name, cat, mg, eq, from, to, description, instructions] = e;
      profile[id] = { from, to };
      db.exercises.push({
        id, name, categoryId: refId('cat', cat), muscleGroupId: refId('mg', mg), equipmentId: refId('eq', eq),
        description, instructions, isActive: !INACTIVE.has(id), displayOrder: (i + 1) * 10,
        createdDate: created, modifiedDate: created, createdBy: 'u-admin', modifiedBy: 'u-admin',
      });
      const photos = id === 'ex-bench' || id === 'ex-squat' || id === 'ex-pullup' ? 2 : 1;
      for (let p = 1; p <= photos; p++) {
        db.exerciseMedia.push({
          id: id.replace('ex-', 'm-') + '-img' + p, exerciseId: id, mediaType: 'Image',
          fileUrl: '/media/exercises/' + slug(name) + '-' + p + '.jpg', thumbnailUrl: '/media/exercises/thumbs/' + slug(name) + '-' + p + '.jpg',
          fileName: slug(name) + '-' + p + '.jpg', mimeType: 'image/jpeg', sizeBytes: 180000 + p * 23000,
          altText: p === 1 ? name + ': starting position' : name + ': end of the movement', title: null, durationSeconds: null,
          displayOrder: p, isActive: true, createdDate: created, modifiedDate: created,
        });
      }
      if (['ex-bench', 'ex-squat', 'ex-rdl', 'ex-pullup', 'ex-ohp', 'ex-kbswing'].includes(id)) {
        db.exerciseMedia.push({
          id: id.replace('ex-', 'm-') + '-vid1', exerciseId: id, mediaType: 'Video',
          fileUrl: '/media/exercises/' + slug(name) + '-tutorial.mp4', thumbnailUrl: '/media/exercises/thumbs/' + slug(name) + '-tutorial.jpg',
          fileName: slug(name) + '-tutorial.mp4', mimeType: 'video/mp4', sizeBytes: 14800000,
          altText: null, title: name + ' technique walkthrough', durationSeconds: 45 + Math.round(rnd() * 60),
          displayOrder: photos + 1, isActive: true, createdDate: created, modifiedDate: created,
        });
      }
    });

    /* ---- Workout history ------------------------------------------------ */
    const HORIZON = 56;
    const setsFor = (exId, dayOffset, override) => {
      if (override) return override.slice();
      const p = profile[exId];
      const f = Math.max(0, Math.min(1, (HORIZON - dayOffset) / HORIZON));
      return p.from.map((a, i) => {
        const v = a + (p.to[i] - a) * f + (rnd() - 0.5) * 1.6;
        return Math.max(1, Math.round(v));
      });
    };

    function addSession(userId, dayOffset, time, exIds, opts) {
      const o = opts || {};
      const date = U.addDays(today, -dayOffset);
      const id = o.id || U.uid('ws');
      const start = localTs(date, time);
      let minute = 4;
      exIds.forEach((exId, i) => {
        const weId = U.uid('we');
        const weTs = localTs(date, time, minute);
        db.workoutExercises.push({ id: weId, workoutSessionId: id, exerciseId: exId, displayOrder: i + 1, createdDate: weTs, modifiedDate: weTs });
        const counts = setsFor(exId, dayOffset, o.override && o.override[exId]);
        counts.forEach((c, n) => {
          minute += 3;
          const ts = localTs(date, time, minute);
          db.workoutSets.push({ id: U.uid('set'), workoutExerciseId: weId, setNumber: n + 1, count: c, createdDate: ts, modifiedDate: ts });
        });
        minute += 4;
      });
      const end = localTs(date, time, minute + 3);
      const status = o.status || 'Completed';
      db.workoutSessions.push({
        id, userId, workoutDate: date, startTime: start, endTime: status === 'Completed' ? end : status === 'Cancelled' ? end : null,
        status, createdDate: start, modifiedDate: end,
      });
      return id;
    }

    // Regular Push / Pull / Legs rotation for the demo user.
    const timeFor = { 1: '18:40', 3: '07:10', 5: '18:15', 6: '10:30' };
    const special = new Set([12, 9, 5]);
    const kinds = ['push', 'pull', 'legs'];
    let k = 0;
    for (let off = HORIZON; off >= 1; off--) {
      if (special.has(off)) continue;
      const dow = U.parseISODate(U.addDays(today, -off)).getDay();
      if (!timeFor[dow]) continue;
      const kind = kinds[k % 3]; k++;
      let list = ROTATION[kind].slice();
      if (kind === 'legs' && k % 2 === 0) list = list.filter((x) => x !== 'ex-legpress');
      if (kind === 'pull' && rnd() < 0.4) list = list.filter((x) => x !== 'ex-cablecrunch');
      addSession('u-demo', off, timeFor[dow], list);
    }
    // The spec's worked example (see file header).
    addSession('u-demo', 12, '18:40', ROTATION.push, { override: { 'ex-bench': [14, 11, 9] } });
    addSession('u-demo', 9, '07:10', ROTATION.push, { override: { 'ex-bench': [15, 12, 10] } });
    addSession('u-demo', 9, '13:30', ['ex-bench', 'ex-pushup'], { override: { 'ex-bench': [12, 10, 8], 'ex-pushup': [22, 18, 15] } });
    // A cancelled session: kept in history, excluded from progress and comparison.
    addSession('u-demo', 5, '07:30', ['ex-squat'], { status: 'Cancelled', override: { 'ex-squat': [9, 8] } });

    // Another user's data — must never be visible to the demo user.
    addSession('u-other', 9, '06:30', ['ex-bench', 'ex-row'], { id: 'ws-other-1', override: { 'ex-bench': [20, 18, 16], 'ex-row': [12, 12, 12] } });
    addSession('u-other', 4, '19:00', ['ex-squat', 'ex-rdl'], { id: 'ws-other-2' });

    // The admin also trains a little, so their Today screen is not empty.
    addSession('u-admin', 3, '12:15', ['ex-squat', 'ex-lunge']);

    return db;
  }

  let db = null;
  const DB = {
    get() {
      if (!db) {
        db = U.store.get(KEY, null);
        if (!db || db.version !== 1) { db = seed(); DB.save(); }
      }
      return db;
    },
    save() { U.store.set(KEY, db); },
    reset() { db = seed(); DB.save(); return db; },
    protoHash,
  };

  /* ---- Media placeholders ---------------------------------------------------
     Seeded media point at realistic /media/... paths. The prototype has no
     file server, so those paths render as generated artwork instead. */
  const HUES = { 'cat-chest': 215, 'cat-back': 190, 'cat-legs': 28, 'cat-shoulders': 262, 'cat-arms': 340, 'cat-core': 150 };
  function placeholder(media, exercise, thumb) {
    const hue = HUES[exercise && exercise.categoryId] || 215;
    const isVideo = media.mediaType === 'Video';
    if (thumb) {
      const t = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="hsl(' + hue + ',30%,22%)"/>' +
        '<g transform="translate(48 48) scale(.42)" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round">' +
        '<rect x="-62" y="-26" width="16" height="52" rx="4"/><rect x="46" y="-26" width="16" height="52" rx="4"/><path d="M-46 0H46M-78 -12V12M78 -12V12"/></g></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t);
    }
    const name = U.esc(exercise ? exercise.name : 'Exercise');
    const n = media.displayOrder || 1;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',32%,' + (isVideo ? 16 : 24) + '%)"/><stop offset="1" stop-color="hsl(' + ((hue + 30) % 360) + ',30%,' + (isVideo ? 9 : 14) + '%)"/></linearGradient>' +
      '<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.05)"/></pattern></defs>' +
      '<rect width="320" height="200" fill="url(#g)"/><rect width="320" height="200" fill="url(#p)"/>' +
      '<g transform="translate(' + (isVideo ? 160 : 230) + ' ' + (isVideo ? 88 : 96) + ')" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="7" stroke-linecap="round">' +
      '<rect x="-62" y="-26" width="16" height="52" rx="4"/><rect x="46" y="-26" width="16" height="52" rx="4"/><path d="M-46 0H46M-78 -12V12M78 -12V12"/></g>' +
      (isVideo ? '' : '<text x="20" y="160" fill="#fff" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="26">' + name + '</text>' +
        '<text x="20" y="182" fill="rgba(255,255,255,.65)" font-family="Barlow, Arial, sans-serif" font-size="12">Photo ' + n + '</text>') +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  G.media = {
    src(media, exercise, thumb) {
      if (!media) return placeholder({ mediaType: 'Image', displayOrder: 1 }, exercise, thumb);
      if (media.mediaType === 'Video') return media.posterUrl || placeholder(media, exercise, thumb);
      if (/^(data:|blob:)/.test(media.fileUrl)) return media.fileUrl;
      return placeholder(media, exercise, thumb);
    },
    videoSrc(media) { return media && /^(data:|blob:)/.test(media.fileUrl) ? media.fileUrl : null; },
    placeholder,
  };

  G.DB = DB;
})(window.GL = window.GL || {});
