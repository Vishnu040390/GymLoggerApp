/* GymLogger prototype — domain rules & calculations.
   Pure functions, no DOM, no storage. Loaded by the browser (window.GL.Domain)
   and by Node unit tests (module.exports). In the real system these rules live
   in GYM.Domain / GYM.Application; the prototype's mock API calls them so the
   UI can be reviewed against the same behaviour. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.GL = root.GL || {}; root.GL.Domain = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATUS = Object.freeze({ InProgress: 'InProgress', Completed: 'Completed', Cancelled: 'Cancelled' });
  const ROLE = Object.freeze({ Admin: 'Admin', User: 'User' });
  const COUNT_MIN = 1;
  const COUNT_MAX = 999;
  const NAME_MIN = 2;
  const NAME_MAX = 100;

  const MEDIA_RULES = Object.freeze({
    image: { extensions: ['jpg', 'jpeg', 'png', 'webp'], mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
    video: { extensions: ['mp4', 'webm'], mimeTypes: ['video/mp4', 'video/webm'], maxBytes: 100 * 1024 * 1024 },
  });

  /* ---- Session naming ----------------------------------------------------
     Label is derived from the local start hour so same-day sessions read as
     "18 Sep — Morning" / "18 Sep — Afternoon". Time is always shown too,
     because two sessions can share a label. */
  function sessionLabel(date) {
    const h = date.getHours();
    if (h >= 4 && h < 12) return 'Morning';
    if (h >= 12 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 21) return 'Evening';
    return 'Night';
  }

  /* ---- Set maths ---------------------------------------------------------- */
  const total = (sets) => (sets || []).reduce((a, s) => a + (Number(s.count) || 0), 0);
  const best = (sets) => (sets || []).reduce((a, s) => Math.max(a, Number(s.count) || 0), 0);

  /**
   * Compare two set lists by set number.
   *   previous 15/12/10, current 16/13/10 → deltas +1 / +1 / 0
   * Missing sets yield null deltas (never treated as zero).
   */
  function compareSets(previous, current) {
    const toMap = (arr) => new Map((arr || []).map((s) => [s.setNumber, s.count]));
    const p = toMap(previous);
    const c = toMap(current);
    const max = Math.max(0, ...p.keys(), ...c.keys());
    const rows = [];
    for (let n = 1; n <= max; n++) {
      const pv = p.has(n) ? p.get(n) : null;
      const cv = c.has(n) ? c.get(n) : null;
      rows.push({ setNumber: n, previous: pv, current: cv, delta: pv != null && cv != null ? cv - pv : null });
    }
    const pt = total(previous);
    const ct = total(current);
    return {
      rows,
      totals: {
        previous: pt,
        current: ct,
        delta: ct - pt,
        deltaPct: pt ? Math.round(((ct - pt) / pt) * 1000) / 10 : null,
      },
    };
  }

  /* ---- Ordering -------------------------------------------------------------
     Newest first: WorkoutDate desc, then StartTime desc. Same-day sessions keep
     their own identity and order by start time. */
  function bySessionDesc(a, b) {
    if (a.workoutDate !== b.workoutDate) return a.workoutDate < b.workoutDate ? 1 : -1;
    return String(b.startTime).localeCompare(String(a.startTime));
  }
  function bySessionAsc(a, b) { return -bySessionDesc(a, b); }

  /* ---- Calendar helpers (pure, ISO date strings) ------------------------------ */
  function isoToUTC(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function utcToIso(ms) { const d = new Date(ms); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function addDaysISO(iso, n) { return utcToIso(isoToUTC(iso) + n * 86400000); }
  /** Monday of the ISO week containing `iso`. */
  function weekStart(iso) {
    const dow = new Date(isoToUTC(iso)).getUTCDay(); // 0 = Sunday
    return addDaysISO(iso, -((dow + 6) % 7));
  }

  /**
   * Exercise analytics from Completed session entries.
   * entries: [{ workoutId, workoutDate, startTime, label, sets: [{setNumber, count}] }]
   * Each entry is one session — two sessions on one date stay two entries.
   */
  function exerciseAnalytics(entries, opts) {
    const o = opts || {};
    const today = o.today;
    const range = o.range || 'all';
    const sorted = (entries || []).slice().sort(bySessionAsc);
    const since = range === '4w' ? addDaysISO(weekStart(today), -21) : range === '12w' ? addDaysISO(weekStart(today), -77) : null;
    const inRange = since ? sorted.filter((e) => e.workoutDate >= since) : sorted;

    const series = inRange.map((e) => ({
      workoutId: e.workoutId, workoutDate: e.workoutDate, startTime: e.startTime, label: e.label,
      total: total(e.sets), best: best(e.sets), setCount: (e.sets || []).length, sets: e.sets,
    }));

    let bestSet = null;
    sorted.forEach((e) => (e.sets || []).forEach((s) => {
      if (!bestSet || s.count > bestSet.count) bestSet = { count: s.count, workoutId: e.workoutId, workoutDate: e.workoutDate, label: e.label, setNumber: s.setNumber };
    }));

    const last = sorted[sorted.length - 1] || null;
    const prev = sorted[sorted.length - 2] || null;

    // Frequency over the last 8 full-or-current weeks.
    const freqSince = addDaysISO(weekStart(today), -49);
    const recent = sorted.filter((e) => e.workoutDate >= freqSince);
    const frequencyPerWeek = Math.round((recent.length / 8) * 10) / 10;

    // Weekly session counts for the chart window.
    const weeksBack = range === '4w' ? 4 : range === '12w' ? 12 : Math.max(4, Math.min(26, sorted.length ? Math.ceil((isoToUTC(weekStart(today)) - isoToUTC(weekStart(sorted[0].workoutDate))) / (7 * 86400000)) + 1 : 4));
    const weekly = [];
    for (let i = weeksBack - 1; i >= 0; i--) {
      const ws = addDaysISO(weekStart(today), -7 * i);
      const we = addDaysISO(ws, 6);
      weekly.push({ weekStart: ws, sessions: sorted.filter((e) => e.workoutDate >= ws && e.workoutDate <= we).length });
    }

    return {
      sessionsCount: sorted.length,
      sessionsInRange: inRange.length,
      distinctDays: new Set(sorted.map((e) => e.workoutDate)).size,
      firstDate: sorted.length ? sorted[0].workoutDate : null,
      lastDate: last ? last.workoutDate : null,
      frequencyPerWeek,
      bestSet,
      last: last ? { workoutId: last.workoutId, workoutDate: last.workoutDate, label: last.label, sets: last.sets, total: total(last.sets) } : null,
      previous: prev ? { workoutId: prev.workoutId, workoutDate: prev.workoutDate, label: prev.label, sets: prev.sets, total: total(prev.sets) } : null,
      totalDelta: last && prev ? total(last.sets) - total(prev.sets) : null,
      series,
      weekly,
    };
  }

  /* ---- Validation ----------------------------------------------------------- */
  function validateCount(value) {
    if (value === '' || value == null) return 'Enter a count.';
    const n = Number(value);
    if (!Number.isInteger(n)) return 'Use a whole number.';
    if (n < COUNT_MIN) return 'Count must be at least ' + COUNT_MIN + '.';
    if (n > COUNT_MAX) return 'Count must be ' + COUNT_MAX + ' or less.';
    return null;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validateEmail(email) {
    const v = String(email || '').trim();
    if (!v) return 'Enter your email address.';
    if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address, like name@example.com.';
    return null;
  }

  function passwordRules(pw) {
    const v = String(pw || '');
    return [
      { id: 'length', label: 'At least 8 characters', ok: v.length >= 8 && v.length <= 128 },
      { id: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(v) },
      { id: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(v) },
      { id: 'digit', label: 'One number', ok: /\d/.test(v) },
    ];
  }
  function validatePassword(pw) {
    if (!pw) return 'Enter a password.';
    return passwordRules(pw).every((r) => r.ok) ? null : 'Password does not meet the requirements.';
  }

  function validateDisplayName(name) {
    const v = String(name || '').trim();
    if (!v) return 'Enter your name.';
    if (v.length < 2 || v.length > 50) return 'Name must be 2–50 characters.';
    return null;
  }

  function validateExerciseName(name) {
    const v = String(name || '').trim();
    if (!v) return 'Enter an exercise name.';
    if (v.length < NAME_MIN || v.length > NAME_MAX) return 'Name must be ' + NAME_MIN + '–' + NAME_MAX + ' characters.';
    return null;
  }

  /** Validates an upload by extension, MIME type and size. Returns null or an error message. */
  function validateMedia(file) {
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    const kind = MEDIA_RULES.image.extensions.includes(ext) ? 'image' : MEDIA_RULES.video.extensions.includes(ext) ? 'video' : null;
    if (!kind) return { error: file.name + ': unsupported file type. Use JPG, PNG, WebP, MP4 or WebM.' };
    const rule = MEDIA_RULES[kind];
    if (!rule.mimeTypes.includes(file.type)) return { error: file.name + ': the file contents do not match a supported ' + kind + ' format.' };
    if (file.size > rule.maxBytes) return { error: file.name + ': file is too large. ' + (kind === 'image' ? 'Images' : 'Videos') + ' can be up to ' + Math.round(rule.maxBytes / 1048576) + ' MB.' };
    return { kind };
  }

  return {
    STATUS, ROLE, COUNT_MIN, COUNT_MAX, MEDIA_RULES,
    sessionLabel, total, best, compareSets, bySessionDesc, bySessionAsc,
    weekStart, addDaysISO, exerciseAnalytics,
    validateCount, validateEmail, passwordRules, validatePassword, validateDisplayName, validateExerciseName, validateMedia,
  };
});
