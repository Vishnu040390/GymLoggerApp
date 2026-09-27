/* Screens: SCR-USR-01 Today · DLG-01 Start workout */
(function (G) {
  'use strict';
  const { U, UI, Api, App, Charts } = G;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});
  const W = (G.Workout = G.Workout || {});

  const refKey = (id) => 'gymlogger.proto.ref.' + id;

  /* ---- DLG-01 Start workout ---------------------------------------------------
     Date is captured automatically. The person chooses to start fresh or to
     compare against any previous session (same-day sessions listed separately). */
  W.openStart = function (opts) {
    const o = opts || {};
    const today = U.todayISO();
    const label = G.Domain.sessionLabel(new Date());
    const body = document.createElement('div');
    body.className = 'stack';
    body.innerHTML =
      '<div class="row-tight">' + icon('calendar') + '<span><b>' + esc(U.fmtDate(today)) + '</b> · ' + esc(label) + ' session</span></div>' +
      '<p class="hint" style="margin-top:-8px">The date and start time are recorded automatically.</p>' +
      '<fieldset class="stack-sm" style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:8px">Comparison</legend>' +
      '<label class="choice"><input type="radio" name="start-mode" value="fresh"' + (o.referenceId ? '' : ' checked') + '><span class="stack-sm" style="gap:2px"><span class="choice-title">Start without comparison</span><span class="choice-desc">Log freely. You can still compare any exercise during the workout.</span></span></label>' +
      '<label class="choice hist-choice"><input type="radio" name="start-mode" value="compare"' + (o.referenceId ? ' checked' : '') + '><span class="stack-sm" style="gap:2px"><span class="choice-title">Compare with a previous session</span><span class="choice-desc">Previous sets appear next to today\'s so you can try to beat them.</span></span></label>' +
      '</fieldset><div data-sessions hidden></div>';
    const list = body.querySelector('[data-sessions]');
    let sessions = null;
    let selected = o.referenceId || null;

    async function loadSessions() {
      list.hidden = false;
      if (sessions) return;
      list.innerHTML = '<div class="loading-block"><span class="spinner"></span>Loading previous sessions…</div>';
      try {
        const data = await Api.workouts({ status: 'Completed', pageSize: 12 });
        sessions = data.items;
        if (!sessions.length) { list.innerHTML = UI.empty({ icon: 'history', title: 'No previous sessions yet', text: 'Once you finish a workout you can compare against it.', compact: true }); return; }
        if (!selected) selected = sessions[0].id;
        list.innerHTML = '<fieldset style="border:0;padding:0;margin:0" class="stack-sm"><legend class="field-label" style="margin-bottom:8px">Choose a session</legend>' +
          sessions.map((s) => '<label class="choice hist-choice"><input type="radio" name="ref-session" value="' + esc(s.id) + '"' + (s.id === selected ? ' checked' : '') + '>' +
            '<span class="grow stack-sm" style="gap:2px"><span class="choice-title">' + esc(U.fmtDay(s.workoutDate)) + ' — ' + esc(s.label) + ' <span class="muted small">· ' + esc(UI.sessionTime(s)) + '</span></span>' +
            '<span class="choice-desc">' + esc(s.exercises.map((e) => e.name).slice(0, 4).join(', ')) + (s.exercises.length > 4 ? ' +' + (s.exercises.length - 4) : '') + '</span></span></label>').join('') + '</fieldset>';
        U.$$('input[name="ref-session"]', list).forEach((r) => r.addEventListener('change', () => { selected = r.value; }));
      } catch (e) {
        list.innerHTML = UI.errorState(e);
        list.querySelector('[data-action="retry"]').addEventListener('click', () => { sessions = null; loadSessions(); });
      }
    }
    U.$$('input[name="start-mode"]', body).forEach((r) => r.addEventListener('change', () => { if (r.value === 'compare') loadSessions(); else list.hidden = true; }));
    if (o.referenceId) loadSessions();

    const key = Api.newKey();
    UI.dialog({
      title: 'Start workout',
      body,
      returnFocus: o.returnFocus,
      actions: [
        { label: 'Not now', value: 'cancel' },
        {
          label: 'Start workout', variant: 'primary', icon: 'play', busyLabel: 'Starting…', autofocus: true,
          onClick: async () => {
            const mode = body.querySelector('input[name="start-mode"]:checked').value;
            let ws;
            try {
              ws = await Api.startWorkout(key);
            } catch (e) {
              if (e.status === 409 && e.data && e.data.activeWorkoutId) {
                UI.toast('You already have a workout in progress. Picking up where you left off.', { icon: 'info' });
                U.go('/workout/' + e.data.activeWorkoutId);
                return true;
              }
              throw e;
            }
            if (mode === 'compare' && selected) U.store.set(refKey(ws.id), selected);
            U.go('/workout/' + ws.id);
            return true;
          },
        },
      ],
    });
  };

  /* ---- SCR-USR-01 Today -------------------------------------------------------------
     Answers "What should I do today?" and "What did I do previously?". */
  V.today = ({ main }) => {
    App.title('Today');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const today = U.todayISO();
    let timer = null;

    UI.load(page, () => Promise.all([
      Api.activeWorkout(),
      Api.workouts({ date: today, pageSize: 10 }),
      Api.workouts({ status: 'Completed', pageSize: 1 }),
      Api.summary(),
    ]), ([active, todays, lastPage, summary]) => {
      const user = Api.user;
      const first = (user.displayName || '').split(' ')[0];
      const last = lastPage.items[0] || null;
      const wk = summary.thisWeek;
      const lw = summary.lastWeek;
      const vs = (a, b) => 'Last week: ' + U.fmtNum(b);

      const hero = active
        ? '<section class="hero-card hero-card--live" aria-labelledby="hero-h">' +
          '<div class="row-between"><p class="eyebrow">Workout in progress</p>' + UI.statusBadge('InProgress') + '</div>' +
          '<h2 id="hero-h">' + esc(active.label) + ' session</h2>' +
          '<div class="hero-meta"><div><b data-elapsed>' + U.fmtClock(Date.now() - new Date(active.startTime)) + '</b><span>Elapsed</span></div><div><b>' + active.totals.exercises + '</b><span>Exercises</span></div><div><b>' + active.totals.sets + '</b><span>Sets</span></div></div>' +
          '<div class="row"><a class="btn btn-primary btn-lg" href="#/workout/' + esc(active.id) + '">' + icon('play') + 'Resume workout</a></div></section>'
        : '<section class="hero-card" aria-labelledby="hero-h">' +
          '<svg class="hero-plates" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="10"/><circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" stroke-width="10"/><circle cx="100" cy="100" r="16" fill="currentColor"/></svg>' +
          '<p class="eyebrow">' + (todays.items.length ? 'Session ' + (todays.items.filter((s) => s.status === 'Completed').length + 1) + ' today' : 'Ready when you are') + '</p>' +
          '<h2 id="hero-h">' + (todays.items.length ? 'Start another session' : 'Start today\'s workout') + '</h2>' +
          '<p>' + (todays.items.length ? 'Each session is logged separately, even on the same day.' : 'Pick exercises as you go and log each set. Everything saves automatically.') + '</p>' +
          '<div class="row"><button type="button" class="btn btn-primary btn-lg" data-start>' + icon('play') + 'Start workout</button>' +
          (last ? '<button type="button" class="btn btn-ghost" data-start-compare>' + icon('compare') + 'Compare with previous</button>' : '') + '</div></section>';

      const todaysHtml = todays.items.length
        ? '<section class="section" aria-labelledby="today-h"><div class="row-between"><h2 class="section-title" id="today-h">Today\'s sessions</h2><span class="same-day-note">' + U.plural(todays.items.length, 'session') + '</span></div>' +
          todays.items.map((s) => UI.sessionCard(s, { href: '#/history/' + s.id })).join('') + '</section>'
        : '';

      const lastHtml = last
        ? '<section class="section" aria-labelledby="last-h"><div class="row-between"><h2 class="section-title" id="last-h">Last workout</h2><span class="muted small">' + esc(U.relDay(last.workoutDate)) + '</span></div>' +
          UI.sessionCard(last, { hist: true, title: U.fmtDay(last.workoutDate) + ' — ' + last.label, maxLines: 5 }) +
          '<div class="row"><a class="btn" href="#/history/' + esc(last.id) + '">View session</a>' +
          (active ? '' : '<button type="button" class="btn btn-hist" data-start-ref="' + esc(last.id) + '">' + icon('compare') + 'Start and compare with this</button>') + '</div></section>'
        : '<section class="section">' + UI.empty({ icon: 'dumbbell', title: 'No workouts yet', text: 'Your finished workouts appear here so you can see what you did last time.' }) + '</section>';

      const weekHtml = '<section class="section" aria-labelledby="week-h"><h2 class="section-title" id="week-h">This week</h2><div class="stats stats--3">' +
        UI.stat({ label: 'Sessions', value: U.fmtNum(wk.sessions), foot: esc(vs(wk.sessions, lw.sessions, 'sessions')) }) +
        UI.stat({ label: 'Sets', value: U.fmtNum(wk.sets), foot: esc(vs(wk.sets, lw.sets, 'sets')) }) +
        UI.stat({ label: 'Reps', value: U.fmtNum(wk.reps), foot: esc(vs(wk.reps, lw.reps, 'reps')) }) +
        '</div><p class="hint">Weeks start on Monday. Cancelled sessions are not counted.</p></section>';

      const recent = summary.exercises.slice(0, 5);
      const recentHtml = '<section class="section" aria-labelledby="recent-h"><div class="row-between"><h2 class="section-title" id="recent-h">Recent exercises</h2><a class="small" href="#/progress">All progress</a></div>' +
        (recent.length ? '<div class="card"><ul class="list">' + recent.map((e) =>
          '<li class="list-item"><a class="list-link" href="#/exercise/' + esc(e.exerciseId) + '?tab=progress"><span class="grow"><span class="list-title">' + esc(e.name) + '</span>' +
          '<span class="small tnum" style="display:block;font-weight:600">' + esc(U.setsText(e.lastSets)) + '</span>' +
          '<span class="xsmall muted" style="display:block">' + esc(U.fmtShort(e.lastDate)) + ' — ' + esc(e.lastLabel) + '</span></span>' +
          Charts.spark(e.spark, e.name + ' total reps, last ' + e.spark.length + ' sessions: ' + e.spark.join(', ')) + UI.delta(e.delta) + '</a></li>').join('') + '</ul></div>' +
          '<p class="hint">Change shows total reps versus the previous session.</p>'
          : UI.empty({ icon: 'chart', title: 'Nothing to compare yet', text: 'Log a few sessions to see how each exercise is trending.', compact: true })) + '</section>';

      page.innerHTML =
        UI.pageHead({ eyebrow: U.fmtDateLong(today), title: U.greeting() + ', ' + first }) +
        '<div class="split"><div class="stack-lg">' + hero + todaysHtml + lastHtml + '</div><div class="stack-lg">' + weekHtml + recentHtml + '</div></div>';

      const startBtn = page.querySelector('[data-start]');
      if (startBtn) startBtn.addEventListener('click', () => W.openStart({ returnFocus: startBtn }));
      const cmpBtn = page.querySelector('[data-start-compare]');
      if (cmpBtn) cmpBtn.addEventListener('click', () => W.openStart({ referenceId: last.id, returnFocus: cmpBtn }));
      const refBtn = page.querySelector('[data-start-ref]');
      if (refBtn) refBtn.addEventListener('click', () => W.openStart({ referenceId: refBtn.dataset.startRef, returnFocus: refBtn }));
      if (active) {
        const el = page.querySelector('[data-elapsed]');
        timer = setInterval(() => { el.textContent = U.fmtClock(Date.now() - new Date(active.startTime)); }, 1000);
      }
      App.focus();
    });
    return () => clearInterval(timer);
  };
})(window.GL);
