/* GymLogger prototype — application shell, router and prototype controls. */
(function (G) {
  'use strict';
  const U = G.U;
  const esc = U.esc;
  const icon = G.icon;
  const Api = G.Api;
  const UI = G.UI;
  const V = (G.Views = G.Views || {});

  /* ---- Routes --------------------------------------------------------------
     layout: auth | user | admin | focus | plain
     nav:    which navigation item is current                                   */
  const ROUTES = [
    { path: '/login', view: 'login', layout: 'auth', public: true, guestOnly: true },
    { path: '/register', view: 'register', layout: 'auth', public: true, guestOnly: true },
    { path: '/', view: 'today', layout: 'user', nav: 'today' },
    { path: '/workout/:id', view: 'workout', layout: 'focus' },
    { path: '/workout/:id/summary', view: 'workoutSummary', layout: 'user', nav: 'today' },
    { path: '/history', view: 'history', layout: 'user', nav: 'history' },
    { path: '/history/:id', view: 'session', layout: 'user', nav: 'history' },
    { path: '/progress', view: 'progress', layout: 'user', nav: 'progress' },
    { path: '/library', view: 'library', layout: 'user', nav: 'library' },
    { path: '/exercise/:id', view: 'exercise', layout: 'user', nav: 'library' },
    { path: '/exercise/:id/compare', view: 'compare', layout: 'user', nav: 'library' },
    { path: '/profile', view: 'profile', layout: 'user', nav: 'profile' },
    { path: '/admin', redirect: '/admin/exercises' },
    { path: '/admin/exercises', view: 'adminExercises', layout: 'admin', nav: 'admin-exercises', role: 'Admin' },
    { path: '/admin/exercises/new', view: 'adminExerciseForm', layout: 'admin', nav: 'admin-exercises', role: 'Admin' },
    { path: '/admin/exercises/:id', view: 'adminExerciseForm', layout: 'admin', nav: 'admin-exercises', role: 'Admin' },
    { path: '/admin/reference', view: 'adminReference', layout: 'admin', nav: 'admin-reference', role: 'Admin' },
    { path: '/screens', view: 'screens', layout: 'plain', public: true, prototypeOnly: true },
    { path: '/ui-kit', view: 'uikit', layout: 'plain', public: true, prototypeOnly: true },
  ].map((r) => {
    const keys = [];
    const re = new RegExp('^' + r.path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    return { ...r, re, keys };
  });

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    for (const r of ROUTES) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params, query, path, raw };
      }
    }
    return { route: null, params: {}, query, path, raw };
  }

  /* ---- Theme -------------------------------------------------------------------- */
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    U.store.set('gymlogger.theme', t || 'system');
  }
  applyTheme(U.store.get('gymlogger.theme', 'system'));

  /* ---- Shells ------------------------------------------------------------------ */
  const app = document.getElementById('app');
  let layout = null;
  let cleanup = null;
  let firstRender = true;
  let wantFocus = false;

  const brand = (href) => '<a class="brand" href="' + (href || '#/') + '" aria-label="GymLogger home">' +
    '<span class="brand-mark">' + icon('dumbbell') + '</span><span class="brand-name">GymLogger</span></a>';
  // Review tooling exists only in the prototype build (mock API loaded).
  const protoBtn = (cls) => G.MockApi ? '<button type="button" class="btn btn-ghost btn-sm proto-btn ' + (cls || '') + '" data-proto aria-label="Prototype controls">' + icon('flask') + '<span>Prototype</span></button>' : '';

  const USER_NAV = [
    { key: 'today', href: '#/', label: 'Today', icon: 'home' },
    { key: 'history', href: '#/history', label: 'History', icon: 'history' },
    { key: 'progress', href: '#/progress', label: 'Progress', icon: 'chart' },
    { key: 'library', href: '#/library', label: 'Exercises', icon: 'grid' },
  ];
  const ADMIN_NAV = [
    { key: 'admin-exercises', href: '#/admin/exercises', label: 'Exercises', icon: 'dumbbell' },
    { key: 'admin-reference', href: '#/admin/reference', label: 'Reference data', icon: 'database' },
  ];
  const navLinks = (items) => items.map((n) => '<a href="' + n.href + '" data-nav="' + n.key + '">' + icon(n.icon) + '<span>' + esc(n.label) + '</span></a>').join('');

  function userChip() {
    const u = Api.user;
    if (!u) return '';
    return '<a class="user-chip" href="#/profile" data-nav="profile"><span class="avatar">' + esc(U.initials(u.displayName)) + '</span>' +
      '<span class="grow"><b class="small" style="display:block">' + esc(u.displayName) + '</b><span class="xsmall muted">' + esc(u.email) + '</span></span></a>';
  }

  function shellHtml(kind) {
    const skip = '<a class="skip-link" href="#main" data-skip>Skip to content</a>';
    if (kind === 'auth') {
      return skip + '<div class="shell shell--auth"><div class="auth-panel"><div class="row-between">' + brand('#/login') + protoBtn() + '</div>' +
        '<main id="main" class="auth-card" tabindex="-1"></main></div>' +
        '<aside class="auth-art" aria-hidden="true"><div class="grid-lines"></div>' +
        '<p class="eyebrow" style="color:#98A2B3">Your training log</p>' +
        '<p class="board">Know what you did. <em>Beat it today.</em></p>' +
        '<div class="log-lines"><div class="log-line"><span>18 Sep — Morning · Bench Press</span><b>15 / 12 / 10</b></div>' +
        '<div class="log-line"><span>18 Sep — Afternoon · Bench Press</span><b>12 / 10 / 8</b></div>' +
        '<div class="log-line"><span>Today · Bench Press</span><b>16 / 13 / 10</b></div></div></aside></div>';
    }
    if (kind === 'focus') return skip + '<div class="shell shell--focus"><main id="main" tabindex="-1"></main></div>';
    if (kind === 'plain') {
      return skip + '<div class="shell shell--plain"><header class="topbar">' + brand(Api.user ? '#/' : '#/login') +
        '<div class="topbar-actions"><a class="btn btn-ghost btn-sm" href="#/screens">Screens</a><a class="btn btn-ghost btn-sm" href="#/ui-kit">UI kit</a>' + protoBtn() + '</div></header>' +
        '<main id="main" tabindex="-1"></main></div>';
    }
    const admin = kind === 'admin';
    const isAdmin = Api.isAdmin;
    const sidebar = '<aside class="sidebar" aria-label="Main">' + brand(admin ? '#/admin/exercises' : '#/') +
      (admin
        ? '<nav class="side-nav" aria-label="Admin"><span class="nav-label eyebrow">Admin</span>' + navLinks(ADMIN_NAV) +
          '<span class="nav-label eyebrow">App</span><a href="#/">' + icon('chevron-left') + '<span>Back to training</span></a></nav>'
        : '<nav class="side-nav" aria-label="Main">' + navLinks(USER_NAV) +
          (isAdmin ? '<span class="nav-label eyebrow">Admin</span><a href="#/admin/exercises" data-nav="admin">' + icon('shield') + '<span>Exercise admin</span></a>' : '') + '</nav>') +
      '<div class="side-foot">' + userChip() + protoBtn() + '</div></aside>';
    const topbar = '<header class="topbar">' + brand(admin ? '#/admin/exercises' : '#/') + '<div class="topbar-actions">' +
      (admin ? '<span class="badge badge--admin">Admin</span>' : '') + protoBtn('proto-top') +
      (Api.user ? '<a class="btn btn-ghost btn-icon" href="#/profile" aria-label="Profile"><span class="avatar avatar--sm">' + esc(U.initials(Api.user.displayName)) + '</span></a>' : '') +
      '</div></header>';
    const tabbar = admin ? '' : '<nav class="tabbar" aria-label="Main" style="--tabs:5">' + navLinks(USER_NAV.concat([{ key: 'profile', href: '#/profile', label: 'Profile', icon: 'user' }])) + '</nav>';
    const subnav = admin ? '<nav class="admin-subnav" aria-label="Admin sections">' + ADMIN_NAV.map((n) => '<a href="' + n.href + '" data-nav="' + n.key + '">' + esc(n.label) + '</a>').join('') + '<a href="#/">Back to training</a></nav>' : '';
    return skip + '<div class="shell shell--' + kind + '">' + sidebar + '<div class="main-col">' + topbar + subnav + '<main id="main" class="main" tabindex="-1"></main></div>' + tabbar + '</div>';
  }

  function mountShell(kind, navKey) {
    const key = kind + '|' + (Api.user ? Api.user.id + Api.user.displayName : '');
    if (layout !== key || kind === 'focus') {
      app.innerHTML = shellHtml(kind);
      layout = key;
    }
    U.$$('[data-nav]', app).forEach((a) => {
      if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    return document.getElementById('main');
  }

  /* ---- Router ------------------------------------------------------------------------ */
  function render() {
    const { route, params, query, raw } = parseHash();
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    U.$$('dialog[open]').forEach((d) => d.close());

    if (route && route.redirect) { U.go(route.redirect); return; }
    if (route && route.prototypeOnly && !G.MockApi) { const main = mountShell(Api.user ? 'user' : 'plain', null); V.notFound({ main }); afterRender(); return; }
    if (route && !route.public && !Api.user) { U.go('/login' + U.qs({ next: raw })); return; }
    if (route && route.guestOnly && Api.user) { U.go(Api.isAdmin ? '/admin/exercises' : '/'); return; }

    if (!route) { const main = mountShell(Api.user ? 'user' : 'plain', null); V.notFound({ main }); afterRender(); return; }
    if (route.role && (!Api.user || Api.user.role !== route.role)) { const main = mountShell('user', null); V.forbidden({ main }); afterRender(); return; }

    const main = mountShell(route.layout, route.nav);
    main.innerHTML = '';
    const view = V[route.view];
    const ret = view ? view({ main, params, query, route }) : null;
    if (typeof ret === 'function') cleanup = ret;
    afterRender();
  }
  function afterRender() {
    if (!firstRender) { window.scrollTo(0, 0); wantFocus = true; }
    firstRender = false;
    App.focus();
  }

  const App = {
    title(t) { document.title = (t ? t + ' · ' : '') + 'GymLogger'; },
    /** Move focus to the new page heading after navigation (screen readers announce it). */
    focus() {
      if (!wantFocus) return;
      const h = document.querySelector('#main h1');
      if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); wantFocus = false; }
    },
    showNotFound(err) { const main = document.getElementById('main'); V.notFound({ main, err }); App.focus(); },
    rerender: render,
    applyTheme,
    openPrototypePanel,
  };
  G.App = App;

  /* ---- Global behaviour --------------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const skip = e.target.closest('[data-skip]');
    if (skip) { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); return; }
    if (e.target.closest('[data-proto]')) { e.preventDefault(); openPrototypePanel(); }
  });

  Api.onUnauthorized((message) => {
    const { raw, route } = parseHash();
    if (route && route.public) return;
    UI.toast(message || 'Your session has expired. Sign in again.', { type: 'error' });
    layout = null;
    U.go('/login' + U.qs({ next: raw, expired: 1 }));
  });

  // Offline banner (prototype network simulation + real browser events)
  const netBanner = document.createElement('div');
  netBanner.className = 'net-banner';
  netBanner.setAttribute('role', 'status');
  netBanner.hidden = true;
  netBanner.innerHTML = icon('wifi-off') + '<span>You\'re offline. Workout changes are kept on this device and sync when you reconnect.</span>';
  document.body.prepend(netBanner);
  const syncBanner = () => { netBanner.hidden = !((G.MockApi && G.MockApi.network.mode === 'offline') || navigator.onLine === false); };
  if (G.MockApi) G.MockApi.onChange(syncBanner);
  window.addEventListener('online', syncBanner);
  window.addEventListener('offline', syncBanner);

  /* ---- Prototype panel (review tooling, not product UI) --------------------------------- */
  function openPrototypePanel() {
    if (!G.MockApi) return;
    const ACCOUNTS = G.ACCOUNTS || [];
    const net = G.MockApi.network;
    const theme = U.store.get('gymlogger.theme', 'system');
    const seg = (name, options, value) => '<div class="seg" role="radiogroup" aria-label="' + esc(name) + '">' + options.map(([v, l, ic]) =>
      '<label><input type="radio" name="' + name + '" value="' + v + '"' + (v === value ? ' checked' : '') + '><span>' + (ic ? icon(ic) : '') + esc(l) + '</span></label>').join('') + '</div>';
    const logRows = () => G.MockApi.log.slice(0, 12).map((l) => '<tr><td>' + esc(l.method) + '</td><td style="word-break:break-all">' + esc(l.path) + '</td><td class="num">' + esc(l.status) + '</td><td class="num">' + esc(l.ms) + '</td></tr>').join('') ||
      '<tr><td colspan="4" class="muted">No requests yet.</td></tr>';
    const body =
      '<div class="banner banner--info">' + icon('flask') + '<div class="grow"><b>Review tools</b><span>Everything here simulates backend conditions for UX review and QA. It is not part of the product.</span></div></div>' +
      '<section class="stack-sm"><h3 class="field-label">Sign in as</h3><div class="kit-row">' + ACCOUNTS.map((a, i) => '<button type="button" class="btn btn-sm" data-login="' + i + '">' + icon('user') + esc(a.label) + '</button>').join('') + '</div>' +
      '<p class="proto-note">Signed in: ' + (Api.user ? esc(Api.user.email) + ' (' + esc(Api.user.role) + ')' : 'nobody') + '. Use "Other user" to check that one person can never see another person\'s workouts.</p></section>' +
      '<section class="stack-sm"><h3 class="field-label">Network</h3>' + seg('proto-net', [['normal', 'Normal', 'check'], ['slow', 'Slow', 'clock'], ['offline', 'Offline', 'wifi-off']], net.mode) +
      '<div class="kit-row"><button type="button" class="btn btn-sm" data-fail>' + icon('alert') + 'Fail next request</button><button type="button" class="btn btn-sm" data-expire' + (Api.user ? '' : ' disabled') + '>' + icon('lock') + 'Expire session</button></div>' +
      '<p class="proto-note">Slow shows loading states. Offline shows how workout changes queue and sync. A failed request shows error states.</p></section>' +
      '<section class="stack-sm"><h3 class="field-label">Appearance</h3>' + seg('proto-theme', [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']], theme) + '</section>' +
      '<section class="stack-sm"><h3 class="field-label">Jump to</h3><div class="kit-row"><a class="btn btn-sm" href="#/screens">' + icon('layers') + 'Screen index</a><a class="btn btn-sm" href="#/ui-kit">' + icon('grid') + 'UI kit</a>' +
      '<button type="button" class="btn btn-sm btn-danger-ghost" data-reset>' + icon('refresh') + 'Reset demo data</button></div></section>' +
      '<section class="stack-sm"><h3 class="field-label">Recent API calls</h3><div class="table-wrap"><table class="table"><thead><tr><th>Method</th><th>Endpoint</th><th class="num">Status</th><th class="num">ms</th></tr></thead><tbody data-log>' + logRows() + '</tbody></table></div></section>';
    const d = UI.dialog({ title: 'Prototype controls', description: 'GymLogger Phase 1 UX prototype', body, size: 'wide' });
    const b = d.body;
    const offLog = G.MockApi.onChange(() => { const t = b.querySelector('[data-log]'); if (t) t.innerHTML = logRows(); });
    d.el.addEventListener('close', offLog);
    b.querySelectorAll('input[name="proto-net"]').forEach((r) => r.addEventListener('change', () => {
      G.MockApi.setNetwork({ mode: r.value });
      UI.toast(r.value === 'offline' ? 'Network: offline' : r.value === 'slow' ? 'Network: slow (≈2 s per request)' : 'Network: normal', { icon: r.value === 'offline' ? 'wifi-off' : 'check' });
    }));
    b.querySelectorAll('input[name="proto-theme"]').forEach((r) => r.addEventListener('change', () => applyTheme(r.value)));
    b.querySelector('[data-fail]').addEventListener('click', () => { G.MockApi.setNetwork({ failNext: true }); UI.toast('The next request will fail with a server error.', { icon: 'alert' }); });
    b.querySelector('[data-expire]').addEventListener('click', () => { G.MockApi.expireSessions(); d.close(); UI.toast('Session expired. The next request will ask you to sign in.', { icon: 'lock' }); });
    b.querySelector('[data-reset]').addEventListener('click', async () => {
      d.close();
      if (await UI.confirm({ title: 'Reset demo data?', message: 'All workouts, exercises and accounts go back to the seeded sample data. You will be signed out.', confirmLabel: 'Reset data', danger: true })) {
        G.DB.reset(); Api.clearAuth(); U.store.remove('gymlogger.proto.outbox'); layout = null; U.go('/login'); UI.toast('Demo data reset.');
      }
    });
    b.querySelectorAll('[data-login]').forEach((btn) => btn.addEventListener('click', async () => {
      const acc = ACCOUNTS[Number(btn.dataset.login)];
      UI.busy(btn, true, 'Signing in…');
      try {
        if (Api.user) await Api.logout().catch(() => {});
        await Api.login(acc.email, acc.password);
        d.close(); layout = null;
        U.go(Api.isAdmin ? '/admin/exercises' : '/');
        UI.toast('Signed in as ' + acc.label + '.');
      } catch (e) { UI.busy(btn, false); d.error(e.message); }
    }));
    b.querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener('click', () => d.close()));
  }

  /* ---- Boot (called from main.js once every view is registered) ------------------------- */
  App.start = function () {
    window.addEventListener('hashchange', render);
    if (G.DB) G.DB.get();
    if (!location.hash) history.replaceState(null, '', '#' + (Api.user ? '/' : '/login'));
    syncBanner();
    render();
  };
})(window.GL = window.GL || {});
