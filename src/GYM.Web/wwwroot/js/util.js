/* GymLogger prototype — shared utilities (no dependencies). */
(function (G) {
  'use strict';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const U = {};

  /* ---- HTML -------------------------------------------------------------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  /** Parse an HTML string into a DocumentFragment. Callers must escape data with U.esc. */
  U.frag = (html) => document.createRange().createContextualFragment(html);
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.on = (root, type, selector, handler) => {
    root.addEventListener(type, (e) => {
      const el = e.target.closest(selector);
      if (el && root.contains(el)) handler(e, el);
    });
  };

  /* ---- IDs ---------------------------------------------------------------- */
  U.uid = (prefix) => {
    let s = '';
    try { s = crypto.randomUUID().replace(/-/g, '').slice(0, 10); } catch (e) { /* insecure context */ }
    if (!s) s = (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-10);
    return (prefix ? prefix + '-' : '') + s;
  };

  /* ---- Storage (never throws; falls back to memory) ----------------------- */
  const memory = new Map();
  U.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        if (v != null) return JSON.parse(v);
      } catch (e) { /* blocked storage */ }
      return memory.has(key) ? memory.get(key) : fallback;
    },
    set(key, value) {
      memory.set(key, value);
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) {
      memory.delete(key);
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  /* ---- Dates --------------------------------------------------------------
     WorkoutDate is a calendar date (YYYY-MM-DD) in the user's local time.
     StartTime/EndTime/Created/Modified are UTC ISO strings, shown locally. */
  const pad = (n) => String(n).padStart(2, '0');
  U.pad = pad;
  U.toISODate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.todayISO = () => U.toISODate(new Date());
  U.parseISODate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  U.addDays = (iso, n) => { const d = U.parseISODate(iso); d.setDate(d.getDate() + n); return U.toISODate(d); };
  U.daysBetween = (a, b) => {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  };
  /** "Fri 18 Sep 2026" */
  U.fmtDate = (iso) => { const d = U.parseISODate(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  /** "Friday 18 September 2026" */
  U.fmtDateLong = (iso) => { const d = U.parseISODate(iso); return DAYS_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); };
  /** "18 Sep" (adds year when not the current year) */
  U.fmtShort = (iso) => {
    const d = U.parseISODate(iso);
    const s = d.getDate() + ' ' + MONTHS[d.getMonth()];
    return d.getFullYear() === new Date().getFullYear() ? s : s + ' ' + d.getFullYear();
  };
  /** "Fri 18 Sep" */
  U.fmtDay = (iso) => { const d = U.parseISODate(iso); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  /** 24-hour local time "07:12" from a UTC ISO timestamp */
  U.fmtTime = (ts) => { if (!ts) return ''; const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.relDay = (iso) => {
    const n = U.daysBetween(iso, U.todayISO());
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n > 1 && n < 7) return n + ' days ago';
    if (n >= 7 && n < 14) return 'Last week';
    if (n >= 14 && n < 60) return Math.floor(n / 7) + ' weeks ago';
    return U.fmtShort(iso);
  };
  /** "52 min" / "1 h 05 min" */
  U.fmtDuration = (ms) => {
    if (ms == null || ms < 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return mins + ' min';
    return Math.floor(mins / 60) + ' h ' + pad(mins % 60) + ' min';
  };
  /** Live timer "23:10" or "1:05:09" */
  U.fmtClock = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(sec);
  };
  U.greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

  /* ---- Numbers & text ------------------------------------------------------- */
  U.fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-GB'));
  U.plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  U.setsText = (sets) => (sets && sets.length ? sets.map((s) => s.count).join(' / ') : '—');
  U.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);

  /* ---- Timing ---------------------------------------------------------------- */
  U.debounce = (fn, ms) => {
    let t;
    const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  };
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---- Routing helpers ---------------------------------------------------------- */
  U.qs = (obj) => {
    const p = Object.entries(obj || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v));
    return p.length ? '?' + p.join('&') : '';
  };
  U.go = (path) => { if (location.hash !== '#' + path) location.hash = '#' + path; else window.dispatchEvent(new HashChangeEvent('hashchange')); };

  G.U = U;
})(window.GL = window.GL || {});
