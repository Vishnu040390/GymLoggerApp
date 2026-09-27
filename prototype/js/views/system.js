/* Screens: SCR-SYS-01 Not found · SCR-SYS-02 Access denied · SCR-SYS-03 Screen index · SCR-SYS-04 UI kit */
(function (G) {
  'use strict';
  const { U, UI, Api, App, Charts } = G;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});

  /* ---- SCR-SYS-01 Not found -------------------------------------------------------
     Also used when a record belongs to someone else: the API answers 404 for both,
     so the UI never confirms that another person's workout exists. */
  V.notFound = ({ main }) => {
    App.title('Not found');
    main.innerHTML = '<div class="page"><div class="stack-lg" style="max-width:560px;margin-inline:auto;padding-top:40px">' +
      UI.empty({ icon: 'search', title: 'We can\'t find that page', text: 'It may have been removed, or the link may be wrong. If someone shared a workout with you, note that workouts are private to each person.', action: '<a class="btn btn-primary" href="#/">' + icon('home') + 'Go to Today</a>' }) +
      '</div></div>';
    const h = main.querySelector('h2');
    if (h) { h.outerHTML = '<h1 tabindex="-1" style="font-size:var(--fs-lg);font-weight:700">' + esc(h.textContent) + '</h1>'; }
  };

  /* ---- SCR-SYS-02 Access denied ------------------------------------------------------- */
  V.forbidden = ({ main }) => {
    App.title('No access');
    main.innerHTML = '<div class="page"><div style="max-width:560px;margin-inline:auto;padding-top:40px">' +
      UI.empty({ icon: 'lock', title: 'You don\'t have access to this page', text: 'Exercise management is available to administrators only. If you need access, ask your gym administrator.', action: '<a class="btn btn-primary" href="#/">' + icon('home') + 'Go to Today</a>' }) + '</div></div>';
    const h = main.querySelector('h2');
    if (h) h.outerHTML = '<h1 tabindex="-1" style="font-size:var(--fs-lg);font-weight:700">' + esc(h.textContent) + '</h1>';
  };

  /* ---- SCR-SYS-03 Screen index ---------------------------------------------------------- */
  const SCREENS = [
    ['Authentication', [
      ['SCR-AUTH-01', 'Sign in', '#/login', 'Email and password, errors, expired session'],
      ['SCR-AUTH-02', 'Create account', '#/register', 'Live password rules, duplicate email'],
    ]],
    ['Training (user)', [
      ['SCR-USR-01', 'Today', '#/', 'Start or resume, today\'s sessions, last workout, this week'],
      ['SCR-WK-01', 'Active workout', '#/', 'Start a workout from Today to open it'],
      ['SCR-WK-02', 'Workout complete', '#/history', 'Shown after finishing a workout'],
      ['SCR-USR-02', 'History', '#/history', 'Sessions grouped by date, filters'],
      ['SCR-USR-03', 'Session detail', '#/history', 'Read-only finished session'],
      ['SCR-USR-04', 'Progress', '#/progress', 'Trends by exercise'],
      ['SCR-USR-05', 'Exercise library', '#/library', 'Search, categories'],
      ['SCR-USR-06', 'Exercise detail', '#/exercise/ex-bench', 'Overview, history, progress charts'],
      ['SCR-USR-07', 'Compare sessions', '#/exercise/ex-bench/compare', 'Set-by-set comparison'],
      ['SCR-USR-08', 'Profile', '#/profile', 'Name, theme, sign out'],
    ]],
    ['Administration', [
      ['SCR-ADM-01', 'Exercise management', '#/admin/exercises', 'Table, filters, activate/deactivate'],
      ['SCR-ADM-02', 'Exercise editor', '#/admin/exercises/ex-bench', 'Details, instructions, photos and videos'],
      ['SCR-ADM-02', 'New exercise', '#/admin/exercises/new', 'Create flow'],
      ['SCR-ADM-03', 'Reference data', '#/admin/reference', 'Categories, muscle groups, equipment'],
    ]],
    ['System', [
      ['SCR-SYS-01', 'Not found / private record', '#/history/ws-other-1', 'Another user\'s workout returns "not found"'],
      ['SCR-SYS-02', 'Access denied', '#/admin/exercises', 'Sign in as the demo user first'],
      ['SCR-SYS-04', 'UI kit', '#/ui-kit', 'Tokens and components'],
    ]],
  ];
  V.screens = ({ main }) => {
    App.title('Screen index');
    main.innerHTML = '<div class="page">' + UI.pageHead({ eyebrow: 'Prototype', title: 'Screen index', sub: 'Every Phase 1 screen, with the IDs used in docs/ui-ux/03-screens.md. Most screens need you to be signed in.' }) +
      '<div class="stack-lg">' + SCREENS.map(([group, items]) => '<section class="section"><h2 class="section-title">' + esc(group) + '</h2><div class="screen-list">' +
        items.map(([idc, name, href, note]) => '<a class="screen-link" href="' + href + '"><code>' + idc + '</code><b>' + esc(name) + '</b><span>' + esc(note) + '</span></a>').join('') + '</div></section>').join('') +
      '<section class="section"><h2 class="section-title">Dialogs</h2><div class="card"><ul class="list">' +
      [['DLG-01', 'Start workout', 'Today → Start workout'], ['DLG-02', 'Add exercise', 'Active workout → Add exercise'], ['DLG-03', 'Previous performance', 'Active workout → Compare'],
        ['DLG-04', 'Finish workout', 'Active workout → Finish'], ['DLG-05', 'Cancel workout', 'Active workout → ⋮ → Cancel workout'], ['DLG-06', 'Exercise instructions', 'Tap an exercise name during a workout'],
        ['DLG-07', 'Confirm destructive action', 'Deactivate exercise, delete media, remove exercise'], ['DLG-08', 'Prototype controls', 'Prototype button (review tool only)']]
        .map(([idc, n, how]) => '<li class="list-item"><code class="tag">' + idc + '</code><div class="grow"><b>' + esc(n) + '</b><div class="small muted">' + esc(how) + '</div></div></li>').join('') + '</ul></div></section>' +
      '<section class="section"><h2 class="section-title">End-to-end acceptance walkthrough</h2><div class="card"><ol class="steps">' +
      ['Sign in as Admin. Open Exercise management, add an exercise, then add a photo and a tutorial video. Make sure it is Active.',
        'Open Prototype controls and sign in as the Demo user (or register a new account and sign in).',
        'On Today, start a workout without comparison. Add an exercise and log three sets. Add another exercise. Finish the workout.',
        'Start another session the same day. Add the same exercise and compare it with the earlier session.',
        'Open the exercise from the library. Check History lists both same-day sessions separately, then open Compare and Progress.',
        'Open Prototype controls, sign in as Other user and confirm none of the Demo user\'s workouts are visible.']
        .map((s) => '<li><span>' + esc(s) + '</span></li>').join('') + '</ol></div></section></div></div>';
  };

  /* ---- SCR-SYS-04 UI kit ------------------------------------------------------------------- */
  const TOKENS = [
    ['Surfaces', ['--bg', '--surface', '--surface-2', '--border', '--text', '--text-muted']],
    ['Action / current', ['--primary', '--primary-soft', '--on-primary', '--focus-ring']],
    ['Historical data', ['--hist-bg', '--hist-border', '--hist-text', '--hist-strong']],
    ['Change & status', ['--pos', '--pos-bg', '--neg', '--neg-bg', '--live', '--done', '--void', '--warn', '--danger']],
    ['Charts', ['--chart-series', '--chart-grid', '--chart-axis']],
  ];
  V.uikit = ({ main }) => {
    App.title('UI kit');
    const cs = getComputedStyle(document.documentElement);
    const sw = (t) => '<div class="swatch"><i style="background:var(' + t + ')"></i><div><b>' + t + '</b><code>' + esc(cs.getPropertyValue(t).trim()) + '</code></div></div>';
    const sample = [{ c: 16, p: 15 }, { c: 13, p: 12 }, { c: 10, p: 10 }, { c: 7, p: 9 }];
    main.innerHTML = '<div class="page">' + UI.pageHead({ eyebrow: 'Design system', title: 'UI kit', sub: 'Tokens and components used across the Phase 1 screens. Values below update with the current theme.' }) +
      '<div class="stack-lg">' +
      TOKENS.map(([g, list]) => '<section class="section"><h2 class="section-title">' + g + '</h2><div class="swatches">' + list.map(sw).join('') + '</div></section>').join('') +
      '<section class="section"><h2 class="section-title">Type</h2><div class="card stack-sm">' +
      '<p class="display" style="font-size:var(--fs-3xl);font-weight:700">Barlow Condensed 36 — page titles</p><p class="display" style="font-size:var(--fs-xl);font-weight:700">Barlow Condensed 22 — section titles</p>' +
      '<p style="font-size:var(--fs-lg);font-weight:700">Barlow 18 bold — card titles</p><p>Barlow 16 — body text and inputs (16px stops iOS zooming into fields)</p><p class="small muted">Barlow 14 — secondary text and metadata</p><p class="eyebrow">Eyebrow 12 — labels</p></div></section>' +
      '<section class="section"><h2 class="section-title">Buttons</h2><div class="card stack"><div class="kit-row"><button class="btn btn-primary">' + icon('play') + 'Primary</button><button class="btn">Secondary</button><button class="btn btn-soft">' + icon('plus') + 'Soft</button><button class="btn btn-ghost">Ghost</button><button class="btn btn-hist">' + icon('compare') + 'Historical</button><button class="btn btn-danger">Destructive</button><button class="btn btn-danger-ghost">Destructive quiet</button></div>' +
      '<div class="kit-row"><button class="btn btn-primary btn-lg">' + icon('flag') + 'Large (52px) — workout actions</button><button class="btn btn-sm">Small</button><button class="btn btn-icon" aria-label="Icon button">' + icon('more') + '</button><button class="btn" disabled>Disabled</button><button class="btn btn-primary" disabled aria-busy="true"><span class="spinner" aria-hidden="true"></span>Saving…</button></div></div></section>' +
      '<section class="section"><h2 class="section-title">Status and change</h2><div class="card stack"><div class="kit-row">' + UI.statusBadge('InProgress') + UI.statusBadge('Completed') + UI.statusBadge('Cancelled') + UI.activeBadge(true) + UI.activeBadge(false) + '<span class="badge badge--admin">' + icon('shield') + 'Admin</span></div>' +
      '<div class="kit-row">' + UI.delta(2) + UI.delta(-1) + UI.delta(0) + UI.delta(null) + UI.delta(5, { unit: 'reps' }) + '</div><p class="hint">Change always shows an arrow and a sign, so it never relies on colour alone.</p></div></section>' +
      '<section class="section"><h2 class="section-title">Current vs historical sets</h2><div class="ex-card"><div class="ex-card-head"><div class="grow"><h3 class="card-title">Bench Press</h3><p class="ex-meta">Chest · Barbell</p></div></div>' +
      '<div class="ex-compare hist">' + icon('history') + '<span class="grow"><span class="hist-label">Previous</span> <b>18 Sep — Morning</b> · 15 / 12 / 10 / 9</span></div>' +
      '<table class="sets-table"><thead><tr><th class="col-set">Set</th><th>Count</th><th class="col-prev">Previous</th><th class="col-del"></th></tr></thead><tbody>' +
      sample.map((r, i) => '<tr class="set-row set-row--' + (i === 3 ? 'pending' : 'saved') + '"><td class="col-set"><span class="set-no">' + (i + 1) + '</span></td><td><div class="stepper"><button type="button" aria-label="Decrease">' + icon('minus') + '</button><input type="number" value="' + r.c + '" aria-label="Set ' + (i + 1) + ' count"><button type="button" aria-label="Increase">' + icon('plus') + '</button></div></td>' +
        '<td><div class="cmp-cell"><span class="prev-val">' + r.p + '</span>' + UI.delta(r.c - r.p) + '</div></td><td class="col-del"><button class="btn btn-ghost btn-icon btn-sm" aria-label="Remove">' + icon('trash') + '</button></td></tr>').join('') +
      '</tbody></table><div class="ex-card-foot"><button class="btn btn-soft">' + icon('plus') + 'Add set</button></div></div>' +
      '<p class="hint">Historical values use the dashed "paper log" style and a clock icon. Today\'s values are solid and editable. Set 4 shows the "not saved yet" state.</p></section>' +
      '<section class="section"><h2 class="section-title">Form controls</h2><div class="card"><div class="form-grid">' +
      '<div class="field"><label for="k1">Text input<span class="req" aria-hidden="true">*</span></label><input class="input" id="k1" placeholder="Placeholder"></div>' +
      '<div class="field"><label for="k2">With error</label><input class="input" id="k2" value="bench@" aria-invalid="true" aria-describedby="k2e"><p class="field-error" id="k2e">' + icon('alert-circle') + '<span>Enter a valid email address, like name@example.com.</span></p></div>' +
      '<div class="field"><label for="k3">Select</label><select class="select" id="k3"><option>Chest</option><option>Back</option></select></div>' +
      '<div class="field"><span class="field-label">Switch</span><label class="switch"><input type="checkbox" checked><span class="track" aria-hidden="true"></span><span>Active</span></label></div>' +
      '<div class="field span-2"><span class="field-label">Segmented control</span><div class="seg" role="radiogroup" aria-label="Range"><label><input type="radio" name="kseg" checked><span>4 weeks</span></label><label><input type="radio" name="kseg"><span>12 weeks</span></label><label><input type="radio" name="kseg"><span>All time</span></label></div></div>' +
      '</div></div></section>' +
      '<section class="section"><h2 class="section-title">Feedback</h2><div class="stack">' +
      '<div class="banner banner--info">' + icon('info') + '<div class="grow">Information banner</div></div><div class="banner banner--success">' + icon('check') + '<div class="grow">Success banner</div></div>' +
      '<div class="banner banner--warn">' + icon('wifi-off') + '<div class="grow">Warning / offline banner</div></div><div class="banner banner--error">' + icon('alert-circle') + '<div class="grow">Error banner</div></div>' +
      '<div class="grid-2">' + UI.empty({ icon: 'history', title: 'Empty state', text: 'Explains why it is empty and what to do next.', compact: true }) +
      UI.errorState({ message: 'Something went wrong on our side. Try again.' }).replace('role="alert"', '') + '</div>' +
      '<div class="grid-2"><div class="card">' + UI.skeleton() + '</div><div class="card stack-sm"><p class="field-label">Save indicator states</p><span class="save-state save-state--saved">' + icon('cloud') + 'All changes saved</span><span class="save-state"><span class="spinner"></span>Saving…</span>' +
      '<span class="save-state save-state--offline">' + icon('wifi-off') + 'Offline · 2 changes waiting</span><span class="save-state save-state--error">' + icon('alert-circle') + 'Not saved · <span class="link-btn">Retry</span></span>' +
      '<button type="button" class="btn btn-sm" data-toast style="margin-top:8px">Show a toast</button></div></div></div></section>' +
      '<section class="section"><h2 class="section-title">Charts</h2><div class="grid-2"><div class="card chart-card"><h3 class="card-title">Total reps per session</h3><div data-kline></div></div><div class="card chart-card"><h3 class="card-title">Sessions per week</h3><div data-kcols></div></div></div>' +
      '<div class="row">' + Charts.spark([30, 32, 31, 35, 37, 36, 39], 'Sample trend') + '<span class="small muted">Sparkline for list rows</span></div></section>' +
      '<section class="section"><h2 class="section-title">Icons</h2><div class="card"><div class="kit-row">' + G.icon.names.map((n) => '<span class="tag" title="' + n + '">' + icon(n, { size: 20 }) + '<span class="xsmall" style="margin-left:6px">' + n + '</span></span>').join('') + '</div></div></section>' +
      '</div></div>';
    main.querySelector('[data-toast]').addEventListener('click', () => UI.toast('Set 2 removed from Bench Press.', { icon: 'trash', action: { label: 'Undo', onClick: () => UI.toast('Set restored.') } }));
    const pts = [33, 35, 34, 37, 36, 38, 37, 39].map((v, i) => ({ value: v, short: (10 + i * 3) + ' Aug', label: 'Session ' + (i + 1), sub: '' }));
    const cl = Charts.line(main.querySelector('[data-kline]'), pts, { name: 'Total reps', unit: 'reps' });
    const cc = Charts.columns(main.querySelector('[data-kcols]'), [1, 2, 2, 3, 1, 2, 3, 2].map((v, i) => ({ value: v, short: 'W' + (i + 1), label: 'Week ' + (i + 1) })), { name: 'Sessions per week', unit: 'sessions' });
    return () => { cl(); cc(); };
  };
})(window.GL);
