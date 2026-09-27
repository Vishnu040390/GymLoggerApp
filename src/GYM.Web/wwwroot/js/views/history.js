/* Screens: SCR-USR-02 Workout history · SCR-USR-03 Session detail (read-only) */
(function (G) {
  'use strict';
  const { U, UI, Api, App } = G;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});

  const setStrip = (sets) => '<ol class="set-strip" aria-label="Sets">' + sets.map((s) =>
    '<li class="set-box"><span class="set-box-label">Set ' + s.setNumber + '</span><span class="set-box-val">' + s.count + '</span></li>').join('') + '</ol>';
  G.Shared = G.Shared || {};
  G.Shared.setStrip = setStrip;

  /* ---- SCR-USR-02 History ---------------------------------------------------- */
  V.history = ({ main, query }) => {
    App.title('History');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const f = { exercise: query.exercise || '', status: query.status || '', range: query.range || '90' };
    const since = () => (f.range === 'all' ? '' : U.addDays(U.todayISO(), -Number(f.range) + 1));
    let items = [];
    let total = 0;
    let pageNo = 1;

    const fetchPage = (n) => Api.workouts({ status: f.status, exerciseId: f.exercise, from: since(), page: n, pageSize: 15 });

    UI.load(page, () => Promise.all([fetchPage(1), Api.summary()]), ([res, summary]) => {
      items = res.items; total = res.total; pageNo = 1;
      page.innerHTML = UI.pageHead({ title: 'History', sub: 'Every session is kept separately, including several on the same day.' }) +
        '<form class="toolbar" role="search" aria-label="Filter history" data-filters>' +
        '<label class="sr-only" for="h-ex">Exercise</label><select class="select" id="h-ex" name="exercise"><option value="">All exercises</option>' +
        summary.exercises.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => '<option value="' + esc(e.exerciseId) + '"' + (e.exerciseId === f.exercise ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</select>' +
        '<label class="sr-only" for="h-range">Date range</label><select class="select" id="h-range" name="range">' +
        [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']].map(([v, l]) => '<option value="' + v + '"' + (v === f.range ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
        '<div class="seg" role="radiogroup" aria-label="Status">' + [['', 'All'], ['Completed', 'Completed'], ['Cancelled', 'Cancelled']].map(([v, l]) =>
          '<label><input type="radio" name="status" value="' + v + '"' + (v === f.status ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>' +
        '</form><div class="stack-lg" data-list aria-live="polite"></div>';
      drawList();
      page.querySelector('[data-filters]').addEventListener('submit', (e) => e.preventDefault());
      page.querySelector('[data-filters]').addEventListener('change', (e) => {
        f[e.target.name] = e.target.value;
        history.replaceState(null, '', '#/history' + U.qs({ exercise: f.exercise, status: f.status, range: f.range === '90' ? '' : f.range }));
        reload();
      });
      App.focus();
    });

    async function reload() {
      const list = page.querySelector('[data-list]');
      list.style.opacity = '.55';
      try {
        const res = await fetchPage(1);
        items = res.items; total = res.total; pageNo = 1;
        drawList();
      } catch (e) {
        list.innerHTML = UI.errorState(e);
        list.querySelector('[data-action="retry"]').addEventListener('click', reload);
      } finally { list.style.opacity = ''; }
    }

    function drawList() {
      const list = page.querySelector('[data-list]');
      if (!items.length) {
        const filtered = f.exercise || f.status || f.range !== 'all';
        list.innerHTML = filtered
          ? UI.empty({ icon: 'search', title: 'No sessions match these filters', text: 'Try a longer date range or clear the filters.', action: '<button type="button" class="btn" data-clear>Clear filters</button>' })
          : UI.empty({ icon: 'history', title: 'No workouts yet', text: 'Finished and cancelled workouts appear here.', action: '<a class="btn btn-primary" href="#/">Start a workout</a>' });
        const c = list.querySelector('[data-clear]');
        if (c) c.addEventListener('click', () => { f.exercise = ''; f.status = ''; f.range = 'all'; U.go('/history?range=all'); });
        return;
      }
      const groups = [];
      items.forEach((s) => { const g = groups.find((x) => x.date === s.workoutDate); if (g) g.items.push(s); else groups.push({ date: s.workoutDate, items: [s] }); });
      list.innerHTML = '<p class="small muted" role="status">Showing ' + items.length + ' of ' + U.plural(total, 'session') + '</p>' +
        groups.map((g) => '<section class="day-group" aria-labelledby="d-' + g.date + '"><div class="day-head"><h2 id="d-' + g.date + '">' + esc(U.fmtDate(g.date)) + '</h2>' +
          '<span class="same-day-note">' + (g.items.length > 1 ? g.items.length + ' separate sessions' : esc(U.relDay(g.date))) + '</span></div>' +
          '<div class="grid-2">' + g.items.map((s) => UI.sessionCard(s, { href: '#/history/' + s.id })).join('') + '</div></section>').join('') +
        (items.length < total ? '<div class="row" style="justify-content:center"><button type="button" class="btn" data-more>Load more sessions</button></div>' : '');
      const more = list.querySelector('[data-more]');
      if (more) more.addEventListener('click', async () => {
        UI.busy(more, true, 'Loading…');
        try {
          const res = await fetchPage(pageNo + 1);
          pageNo += 1; items = items.concat(res.items); total = res.total;
          const firstNew = res.items[0] && res.items[0].id;
          drawList();
          const link = firstNew && list.querySelector('a[href="#/history/' + firstNew + '"]');
          if (link) link.focus();
        } catch (e) { UI.busy(more, false); UI.toast(e.message, { type: 'error' }); }
      });
    }
  };

  /* ---- SCR-USR-03 Session detail ---------------------------------------------------- */
  V.session = ({ main, params }) => {
    App.title('Session');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    UI.load(page, () => Api.workout(params.id), (ws) => {
      if (ws.status === 'InProgress') { location.replace('#/workout/' + ws.id); return; }
      App.title(U.fmtShort(ws.workoutDate) + ' ' + ws.label);
      const cancelled = ws.status === 'Cancelled';
      page.innerHTML = UI.pageHead({
        back: { href: '#/history', label: 'History' }, eyebrow: ws.label + ' session',
        title: U.fmtDate(ws.workoutDate),
        sub: esc(UI.sessionTime(ws)) + ' · ' + esc(U.fmtDuration(ws.durationMs)) + ' &nbsp; ' + UI.statusBadge(ws.status),
      }) +
        '<div class="stack-lg">' +
        (cancelled
          ? '<div class="banner">' + icon('ban') + '<div class="grow"><b>This session was cancelled.</b><span>It is kept for your records but not counted in progress or offered as a comparison.</span></div></div>'
          : '<div class="banner banner--hist">' + icon('lock') + '<div class="grow"><b>Read-only</b><span>Finished sessions can\'t be edited, so your history stays accurate.</span></div></div>') +
        '<div class="stats stats--4">' + UI.stat({ label: 'Exercises', value: ws.totals.exercises }) + UI.stat({ label: 'Sets', value: ws.totals.sets }) +
        UI.stat({ label: 'Reps', value: U.fmtNum(ws.totals.reps) }) + UI.stat({ label: 'Duration', value: esc(U.fmtDuration(ws.durationMs)) }) + '</div>' +
        '<section class="section" aria-labelledby="ex-h"><h2 class="section-title" id="ex-h">Exercises</h2>' +
        (ws.exercises.length ? ws.exercises.map((e) => '<article class="card stack-sm"><div class="row-between"><div class="row">' + UI.thumb(e.primaryImage, e) +
          '<div><h3 class="card-title">' + esc(e.name) + '</h3><p class="small muted">' + esc(e.muscleGroupName) + ' · ' + esc(e.equipmentName) + ' · ' + D_total(e.sets) + ' reps</p></div></div>' +
          '<div class="row-tight"><a class="btn btn-sm btn-ghost" href="#/exercise/' + esc(e.exerciseId) + '?tab=history">' + icon('history') + 'History</a>' +
          (cancelled ? '' : '<a class="btn btn-sm btn-ghost" href="#/exercise/' + esc(e.exerciseId) + '/compare' + U.qs({ a: ws.id }) + '">' + icon('compare') + 'Compare</a>') + '</div></div>' +
          setStrip(e.sets) + '</article>').join('') : UI.empty({ icon: 'dumbbell', title: 'No exercises logged', text: 'This session was cancelled before any sets were saved.', compact: true })) +
        '</section>' +
        (cancelled ? '' : '<div class="row"><button type="button" class="btn btn-hist btn-lg" data-start-ref>' + icon('compare') + 'Start a workout comparing with this session</button></div>') +
        '</div>';
      const b = page.querySelector('[data-start-ref]');
      if (b) b.addEventListener('click', () => G.Workout.openStart({ referenceId: ws.id, returnFocus: b }));
      App.focus();
    });
  };
  const D_total = (sets) => G.Domain.total(sets);
})(window.GL);
