/* Screens: SCR-USR-05 Exercise library · SCR-USR-06 Exercise detail (Overview / History / Progress)
            SCR-USR-07 Compare sessions · DLG-06 Exercise instructions (usable mid-workout) */
(function (G) {
  'use strict';
  const { U, UI, Api, App, Charts } = G;
  const D = G.Domain;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});
  const S = (G.Shared = G.Shared || {});

  /* ---- Media gallery ------------------------------------------------------------ */
  S.gallery = (ex) => {
    const media = (ex.media || []).filter((m) => m.isActive);
    if (!media.length) return '<div class="gallery-main" style="display:grid;place-items:center"><p class="muted small">No photos or videos yet.</p></div>';
    const main = media[0];
    return '<div class="gallery" data-gallery>' +
      '<div class="gallery-main" data-stage>' + stage(main, ex) + '</div>' +
      (media.length > 1 ? '<div class="gallery-thumbs" role="group" aria-label="Photos and videos">' + media.map((m, i) =>
        '<button type="button" class="gallery-thumb" data-media="' + esc(m.id) + '" aria-pressed="' + (i === 0) + '" aria-label="' + esc(m.mediaType === 'Video' ? 'Video: ' + (m.title || 'tutorial') : 'Photo: ' + (m.altText || ex.name)) + '">' +
        '<img src="' + esc(G.media.src(m, ex)) + '" alt="" loading="lazy" data-fallback>' + (m.mediaType === 'Video' ? '<span class="play-badge"><span>' + icon('play') + '</span></span>' : '') + '</button>').join('') + '</div>' : '') +
      '</div>';
  };
  function stage(m, ex) {
    if (m.mediaType === 'Video') {
      return '<img src="' + esc(G.media.src(m, ex)) + '" alt="" data-fallback><button type="button" class="play-badge" style="pointer-events:auto;border:0;background:none;cursor:pointer" data-play="' + esc(m.id) + '" aria-label="Play video: ' + esc(m.title || ex.name + ' tutorial') + '"><span>' + icon('play') + '</span></button>';
    }
    return '<img src="' + esc(G.media.src(m, ex)) + '" alt="' + esc(m.altText || ex.name) + '" data-fallback>';
  }
  S.bindGallery = (root, ex) => {
    const g = root.querySelector('[data-gallery]');
    if (!g) return;
    const media = (ex.media || []).filter((m) => m.isActive);
    const st = g.querySelector('[data-stage]');
    g.addEventListener('click', (e) => {
      const t = e.target.closest('[data-media]');
      if (t) {
        const m = media.find((x) => x.id === t.dataset.media);
        st.innerHTML = stage(m, ex);
        U.$$('[data-media]', g).forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
        return;
      }
      const p = e.target.closest('[data-play]');
      if (p) {
        const m = media.find((x) => x.id === p.dataset.play);
        const src = G.media.videoSrc(m);
        st.innerHTML = src
          ? '<video src="' + esc(src) + '" controls autoplay playsinline></video>'
          : '<div class="video-ph" role="status"><div><b>' + esc(m.title || 'Tutorial video') + '</b>' + (m.durationSeconds ? Math.floor(m.durationSeconds / 60) + ':' + U.pad(m.durationSeconds % 60) + ' · ' : '') +
            'In the full app this plays from media storage. Upload a video in the admin panel to try playback here.</div></div>';
      }
    });
  };
  const steps = (text) => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length ? '<ol class="steps">' + lines.map((l) => '<li><span>' + esc(l) + '</span></li>').join('') + '</ol>' : '<p class="muted">No instructions yet.</p>';
  };

  /* ---- DLG-06 Exercise instructions ----------------------------------------------- */
  S.exerciseInfo = (exerciseId, returnFocus) => {
    const body = document.createElement('div');
    body.className = 'stack';
    body.innerHTML = '<div class="loading-block"><span class="spinner"></span>Loading…</div>';
    const d = UI.dialog({ title: 'Exercise', body, size: 'wide', returnFocus });
    const load = async () => {
      try {
        const ex = await Api.exercise(exerciseId);
        d.el.querySelector('h2').textContent = ex.name;
        body.innerHTML = '<div class="row-tight"><span class="tag">' + esc(ex.categoryName) + '</span><span class="tag">' + esc(ex.muscleGroupName) + '</span><span class="tag">' + esc(ex.equipmentName) + '</span></div>' +
          S.gallery(ex) + '<p class="prose">' + esc(ex.description) + '</p><h3 class="card-title">How to do it</h3>' + steps(ex.instructions);
        S.bindGallery(body, ex);
      } catch (e) {
        body.innerHTML = UI.errorState(e);
        body.querySelector('[data-action="retry"]').addEventListener('click', load);
      }
    };
    load();
  };

  /* ---- SCR-USR-05 Exercise library -------------------------------------------------- */
  V.library = ({ main, query }) => {
    App.title('Exercises');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    let term = query.q || '';
    let cat = query.category || '';
    UI.load(page, () => Promise.all([Api.exercises({ include: 'last', sort: 'name' }), Api.reference()]), ([ex, ref]) => {
      page.innerHTML = UI.pageHead({ title: 'Exercises', sub: 'Instructions, photos and tutorial videos for every exercise you can log.' }) +
        '<div class="stack"><div class="input-wrap" role="search">' + icon('search') + '<input class="input" type="search" id="lib-q" aria-label="Search exercises" placeholder="Search by name, muscle or equipment" value="' + esc(term) + '"></div>' +
        '<div class="chip-row" role="group" aria-label="Filter by category"><button type="button" class="chip" data-cat="" aria-pressed="' + (!cat) + '">All</button>' +
        ref.categories.map((c) => '<button type="button" class="chip" data-cat="' + esc(c.id) + '" aria-pressed="' + (cat === c.id) + '">' + esc(c.name) + '</button>').join('') + '</div>' +
        '<p class="sr-only" role="status" data-live></p><div data-grid></div></div>';
      const grid = page.querySelector('[data-grid]');
      const draw = () => {
        const t = term.trim().toLowerCase();
        const list = ex.items.filter((x) => (!cat || x.categoryId === cat) && (!t || [x.name, x.muscleGroupName, x.equipmentName, x.categoryName].some((v) => v.toLowerCase().includes(t))));
        grid.innerHTML = list.length ? '<div class="grid-auto">' + list.map((x) =>
          '<a class="ex-tile" href="#/exercise/' + esc(x.id) + '"><span class="media">' + '<img src="' + esc(G.media.src(x.primaryImage, x)) + '" alt="" loading="lazy" data-fallback></span>' +
          '<span class="body"><span class="name">' + esc(x.name) + '</span><span class="small muted">' + esc(x.muscleGroupName) + ' · ' + esc(x.equipmentName) + '</span>' +
          '<span class="row-tight" style="margin-top:6px">' + (x.videoCount ? '<span class="badge">' + icon('video') + 'Tutorial</span>' : '') +
          (x.sessionsCount ? '<span class="badge badge--hist">' + icon('history') + 'Logged ' + x.sessionsCount + '×</span>' : '') + '</span></span></a>').join('') + '</div>'
          : UI.empty({ icon: 'search', title: 'No matching exercises', text: 'Try another name or category.', compact: true });
        page.querySelector('[data-live]').textContent = U.plural(list.length, 'exercise') + ' shown';
      };
      draw();
      page.querySelector('#lib-q').addEventListener('input', U.debounce((e) => { term = e.target.value; draw(); }, 120));
      page.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]');
        if (!c) return;
        cat = c.dataset.cat;
        U.$$('[data-cat]', page).forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
        draw();
      });
      App.focus();
    });
  };

  /* ---- SCR-USR-06 Exercise detail ---------------------------------------------------- */
  V.exercise = ({ main, params, query }) => {
    App.title('Exercise');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const id = params.id;
    let cleanupChart = [];
    UI.load(page, () => Api.exercise(id), (ex) => {
      App.title(ex.name);
      const tabs = [['overview', 'Overview'], ['history', 'History'], ['progress', 'Progress']];
      let tab = tabs.some((t) => t[0] === query.tab) ? query.tab : 'overview';
      page.innerHTML = UI.pageHead({
        back: { href: '#/library', label: 'Exercises' }, title: ex.name,
        sub: '<span class="row-tight" style="margin-top:6px"><span class="tag">' + esc(ex.categoryName) + '</span><span class="tag">' + esc(ex.muscleGroupName) + '</span><span class="tag">' + esc(ex.equipmentName) + '</span></span>',
        actions: '<a class="btn" href="#/exercise/' + esc(id) + '/compare">' + icon('compare') + 'Compare sessions</a>',
      }) +
        (ex.isActive ? '' : '<div class="banner banner--warn" style="margin-bottom:16px">' + icon('eye-off') + '<div class="grow"><b>No longer available for new workouts.</b><span>Your past sessions with this exercise are still shown.</span></div></div>') +
        '<div class="tabs" role="tablist" aria-label="' + esc(ex.name) + ' sections">' + tabs.map(([k, l]) =>
          '<button type="button" class="tab" role="tab" id="tab-' + k + '" aria-controls="panel" aria-selected="' + (k === tab) + '" tabindex="' + (k === tab ? 0 : -1) + '" data-tab="' + k + '">' + l + '</button>').join('') + '</div>' +
        '<div id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '" tabindex="0" data-panel></div>';
      const panel = page.querySelector('[data-panel]');
      const tablist = page.querySelector('[role="tablist"]');
      const select = (k, focus) => {
        tab = k;
        U.$$('[role="tab"]', tablist).forEach((b) => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
        panel.setAttribute('aria-labelledby', 'tab-' + k);
        history.replaceState(null, '', '#/exercise/' + id + (k === 'overview' ? '' : '?tab=' + k));
        cleanupChart.forEach((f) => f()); cleanupChart = [];
        if (k === 'overview') overview(panel, ex);
        if (k === 'history') historyTab(panel, ex);
        if (k === 'progress') progressTab(panel, ex, cleanupChart);
      };
      tablist.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) select(b.dataset.tab); });
      tablist.addEventListener('keydown', (e) => {
        const i = tabs.findIndex((t) => t[0] === tab);
        if (e.key === 'ArrowRight') { e.preventDefault(); select(tabs[(i + 1) % tabs.length][0], true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length][0], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0][0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1][0], true); }
      });
      select(tab);
      App.focus();
    });
    return () => cleanupChart.forEach((f) => f());
  };

  function overview(panel, ex) {
    panel.innerHTML = '<div class="split"><div class="stack">' + S.gallery(ex) + '</div>' +
      '<div class="stack-lg"><section class="section"><h2 class="section-title">About</h2><p class="prose">' + esc(ex.description || 'No description yet.') + '</p></section>' +
      '<section class="section"><h2 class="section-title">How to do it</h2>' + steps(ex.instructions) + '</section></div></div>';
    S.bindGallery(panel, ex);
  }

  function historyTab(panel, ex) {
    UI.load(panel, () => Api.exerciseHistory(ex.id), (res) => {
      const items = res.items;
      if (!items.length) {
        panel.innerHTML = UI.empty({ icon: 'history', title: 'No sessions with ' + esc(ex.name) + ' yet', text: 'Add it to a workout and your sets will be listed here, newest first.' });
        return;
      }
      const groups = [];
      items.forEach((i) => { const g = groups.find((x) => x.date === i.workoutDate); if (g) g.items.push(i); else groups.push({ date: i.workoutDate, items: [i] }); });
      panel.innerHTML = '<p class="small muted" style="margin-bottom:12px">' + U.plural(items.length, 'completed session') + '. Change compares total reps with the session before it.</p><div class="stack-lg">' +
        groups.map((g) => '<section class="day-group"><div class="day-head"><h3>' + esc(U.fmtDate(g.date)) + '</h3>' + (g.items.length > 1 ? '<span class="same-day-note">' + g.items.length + ' separate sessions</span>' : '') + '</div>' +
          g.items.map((i) => '<article class="card"><div class="row-between"><div><b>' + esc(i.label) + '</b> <span class="small muted">· ' + esc(UI.sessionTime(i)) + '</span></div>' + UI.delta(i.deltaVsPrevious, { unit: 'reps' }) + '</div>' +
            '<div class="row-between" style="margin-top:8px"><div>' + G.Shared.setStrip(i.sets) + '</div><div class="stack-sm" style="align-items:flex-end;gap:4px"><span class="small muted tnum">' + i.total + ' reps · best ' + i.best + '</span>' +
            '<span class="row-tight"><a class="btn btn-sm btn-ghost" href="#/history/' + esc(i.workoutId) + '">View session</a><a class="btn btn-sm btn-ghost" href="#/exercise/' + esc(ex.id) + '/compare' + U.qs({ a: i.workoutId }) + '">' + icon('compare') + 'Compare</a></span></div></div></article>').join('') +
          '</section>').join('') + '</div>';
    }, 'list');
  }

  function progressTab(panel, ex, cleanups) {
    let range = '12w';
    const draw = () => UI.load(panel, () => Api.analytics(ex.id, range), (a) => {
      const rangeSeg = '<div class="seg" role="radiogroup" aria-label="Time range">' + [['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']].map(([v, l]) =>
        '<label><input type="radio" name="range" value="' + v + '"' + (v === range ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>';
      if (!a.sessionsCount) {
        panel.innerHTML = UI.empty({ icon: 'chart', title: 'No progress to show yet', text: 'Complete a workout with ' + esc(ex.name) + ' and your trend appears here.' });
        return;
      }
      const best = a.bestSet;
      panel.innerHTML = '<div class="stack-lg"><div class="row-between">' + rangeSeg + '<span class="small muted">Charts use completed sessions only.</span></div>' +
        '<div class="stats stats--4">' +
        UI.stat({ label: 'Sessions', value: U.fmtNum(a.sessionsInRange), foot: esc(U.fmtNum(a.sessionsCount) + ' all time') }) +
        UI.stat({ label: 'Frequency', value: a.frequencyPerWeek, unit: '/ week', foot: 'Average, last 8 weeks' }) +
        UI.stat({ label: 'Best set', value: best ? best.count : '—', unit: 'reps', foot: best ? esc(U.fmtShort(best.workoutDate) + ' — ' + best.label) : '' }) +
        UI.stat({ label: 'Last session', value: a.last ? a.last.total : '—', unit: 'reps', foot: (a.totalDelta != null ? UI.delta(a.totalDelta) + ' vs previous' : 'No earlier session') }) +
        '</div>' +
        (a.series.length ? '<section class="card chart-card" aria-labelledby="c1"><div><h2 class="card-title" id="c1">Total reps per session</h2><p class="small muted">Each point is one session. Same-day sessions are separate points.</p></div><div data-line></div></section>'
          : '<div class="banner">' + icon('info') + '<div class="grow">No sessions in this range. Try a longer range.</div></div>') +
        '<section class="card chart-card" aria-labelledby="c2"><div><h2 class="card-title" id="c2">Sessions per week</h2><p class="small muted">How often you trained ' + esc(ex.name) + '. Weeks start on Monday.</p></div><div data-cols></div></section>' +
        (a.series.length ? '<details class="card"><summary style="cursor:pointer;font-weight:700">Show the data as a table</summary><div class="table-wrap" style="margin-top:12px"><table class="table"><caption class="sr-only">' + esc(ex.name) + ' sessions</caption><thead><tr><th scope="col">Date</th><th scope="col">Session</th><th scope="col">Sets</th><th class="num" scope="col">Total</th><th class="num" scope="col">Best</th></tr></thead><tbody>' +
          a.series.slice().reverse().map((p) => '<tr><td>' + esc(U.fmtDate(p.workoutDate)) + '</td><td>' + esc(p.label) + ' · ' + esc(U.fmtTime(p.startTime)) + '</td><td class="tnum">' + esc(U.setsText(p.sets)) + '</td><td class="num">' + p.total + '</td><td class="num">' + p.best + '</td></tr>').join('') +
          '</tbody></table></div></details>' : '') + '</div>';
      const line = panel.querySelector('[data-line]');
      if (line) cleanups.push(Charts.line(line, a.series.map((p) => ({ value: p.total, short: U.fmtShort(p.workoutDate), label: U.fmtDay(p.workoutDate) + ' — ' + p.label, sub: U.setsText(p.sets) })), { name: 'Total reps', unit: 'reps' }));
      cleanups.push(Charts.columns(panel.querySelector('[data-cols]'), a.weekly.map((w) => ({ value: w.sessions, short: U.fmtShort(w.weekStart), label: 'Week of ' + U.fmtShort(w.weekStart) })), { name: 'Sessions per week', unit: 'sessions' }));
      panel.querySelectorAll('input[name="range"]').forEach((r) => r.addEventListener('change', () => { range = r.value; cleanups.forEach((f) => f()); cleanups.length = 0; draw(); }));
    });
    draw();
  }

  /* ---- SCR-USR-07 Compare sessions ------------------------------------------------------ */
  V.compare = ({ main, params, query }) => {
    App.title('Compare');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const id = params.id;
    UI.load(page, () => Api.exerciseHistory(id), (res) => {
      const ex = res.exercise;
      const items = res.items;
      App.title('Compare ' + ex.name);
      const head = UI.pageHead({ back: { href: '#/exercise/' + id + '?tab=history', label: ex.name }, eyebrow: ex.name, title: 'Compare sessions', sub: 'Set-by-set comparison of any two completed sessions. Historical values are read-only.' });
      if (items.length < 2) {
        page.innerHTML = head + UI.empty({ icon: 'compare', title: 'Not enough sessions yet', text: 'You need at least two completed sessions with ' + esc(ex.name) + ' to compare them.' });
        App.focus();
        return;
      }
      let a = items.some((i) => i.workoutId === query.a) ? query.a : items[0].workoutId;
      const idxA = items.findIndex((i) => i.workoutId === a);
      let b = items.some((i) => i.workoutId === query.b) && query.b !== a ? query.b : (items[idxA + 1] || items[idxA - 1]).workoutId;
      const opt = (sel) => items.map((i) => '<option value="' + esc(i.workoutId) + '"' + (i.workoutId === sel ? ' selected' : '') + '>' + esc(U.fmtDay(i.workoutDate) + ' — ' + i.label + ' · ' + U.fmtTime(i.startTime) + '  (' + U.setsText(i.sets) + ')') + '</option>').join('');
      page.innerHTML = head + '<div class="stack-lg" style="max-width:860px">' +
        '<form class="card form-grid" data-pick><div class="field"><label for="cmp-a">Session</label><select class="select" id="cmp-a" name="a">' + opt(a) + '</select></div>' +
        '<div class="field"><label for="cmp-b">Compared with <span class="badge badge--hist" style="margin-left:6px">' + icon('history') + 'Reference</span></label><select class="select" id="cmp-b" name="b">' + opt(b) + '</select></div>' +
        '<div class="span-2 row"><button type="button" class="btn btn-sm" data-swap>' + icon('compare') + 'Swap</button></div></form>' +
        '<div data-result aria-live="polite"></div></div>';
      const form = page.querySelector('[data-pick]');
      const result = page.querySelector('[data-result]');
      const run = () => {
        history.replaceState(null, '', '#/exercise/' + id + '/compare' + U.qs({ a, b }));
        if (a === b) { result.innerHTML = '<div class="banner banner--warn">' + icon('alert') + '<div class="grow">Choose two different sessions.</div></div>'; return; }
        UI.load(result, () => Api.comparison(id, a, b), (c) => {
          const pct = c.totals.deltaPct != null ? ' (' + (c.totals.deltaPct > 0 ? '+' : '') + c.totals.deltaPct + '%)' : '';
          result.innerHTML = '<section class="card card-flush"><div style="padding:16px 16px 8px" class="row-between"><div><h2 class="card-title">' + esc(ex.name) + '</h2><p class="small muted">Total reps ' + c.totals.current + ' vs ' + c.totals.previous + esc(pct) + '</p></div>' + UI.delta(c.totals.delta, { unit: 'reps' }) + '</div>' +
            '<div style="overflow-x:auto"><table class="cmp-table"><caption class="sr-only">' + esc(UI.sessionName(c.current)) + ' compared with ' + esc(UI.sessionName(c.previous)) + '</caption><thead><tr><th scope="col">Set</th>' +
            '<th scope="col" class="col-cur">' + esc(UI.sessionName(c.current)) + '</th><th scope="col" class="col-prev">' + icon('history', { size: 14 }) + ' ' + esc(UI.sessionName(c.previous)) + '</th><th scope="col">Change</th></tr></thead><tbody>' +
            c.rows.map((r) => '<tr><th scope="row">Set ' + r.setNumber + '</th><td class="col-cur big">' + (r.current != null ? r.current : '<span class="muted small">—</span>') + '</td><td class="col-prev big">' + (r.previous != null ? r.previous : '<span class="small">—</span>') + '</td><td>' + UI.delta(r.delta) + '</td></tr>').join('') +
            '</tbody><tfoot><tr><th scope="row">Total</th><td class="col-cur">' + c.totals.current + '</td><td class="col-prev">' + c.totals.previous + '</td><td>' + UI.delta(c.totals.delta) + '</td></tr></tfoot></table></div></section>' +
            '<p class="hint" style="margin-top:8px">A dash means that set was not done in that session, so no change is calculated.</p>';
        });
      };
      form.addEventListener('change', (e) => { if (e.target.name === 'a') a = e.target.value; if (e.target.name === 'b') b = e.target.value; run(); });
      page.querySelector('[data-swap]').addEventListener('click', () => { [a, b] = [b, a]; form.a.value = a; form.b.value = b; run(); });
      run();
      App.focus();
    });
  };
})(window.GL);
