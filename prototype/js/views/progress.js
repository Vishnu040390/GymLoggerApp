/* Screens: SCR-USR-04 Progress overview · SCR-USR-08 Profile */
(function (G) {
  'use strict';
  const { U, UI, Api, App, Charts } = G;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});

  /* ---- SCR-USR-04 Progress ------------------------------------------------------
     Answers "Am I progressing?" and points at "What should I change next?". */
  V.progress = ({ main }) => {
    App.title('Progress');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    let sort = U.store.get('gymlogger.progress.sort', 'recent');
    UI.load(page, () => Api.summary(), (s) => {
      page.innerHTML = UI.pageHead({ title: 'Progress', sub: 'Trends from your completed sessions. Pick an exercise for its full history and charts.' }) +
        '<div class="stack-lg"><div class="stats stats--4">' +
        UI.stat({ label: 'Sessions', value: s.last30.sessions, foot: 'Last 30 days' }) +
        UI.stat({ label: 'Per week', value: s.avgPerWeek, foot: 'Average, last 8 weeks' }) +
        UI.stat({ label: 'Exercises trained', value: s.last30.exercises, foot: 'Last 30 days' }) +
        UI.stat({ label: 'Sets', value: U.fmtNum(s.last30.sets), foot: 'Last 30 days' }) + '</div>' +
        '<section class="section" aria-labelledby="ex-h"><div class="row-between"><h2 class="section-title" id="ex-h">By exercise</h2>' +
        '<div class="row-tight"><label for="p-sort" class="small muted">Sort</label><select class="select" id="p-sort" style="width:auto"><option value="recent">Most recent</option><option value="sessions">Most sessions</option><option value="change">Biggest change</option><option value="name">Name</option></select></div></div>' +
        '<div data-list></div><p class="hint">Change compares total reps in your last session with the session before it. Trend shows up to your last 10 sessions.</p></section></div>';
      const sel = page.querySelector('#p-sort');
      sel.value = sort;
      const draw = () => {
        const list = s.exercises.slice();
        if (sort === 'sessions') list.sort((a, b) => b.sessionsCount - a.sessionsCount);
        if (sort === 'change') list.sort((a, b) => (b.delta || 0) - (a.delta || 0));
        if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        const host = page.querySelector('[data-list]');
        if (!list.length) { host.innerHTML = UI.empty({ icon: 'chart', title: 'No progress yet', text: 'Finish a workout to start tracking progress.', action: '<a class="btn btn-primary" href="#/">Go to Today</a>' }); return; }
        host.innerHTML =
          '<div class="table-wrap admin-table-view"><table class="table"><caption class="sr-only">Progress by exercise</caption><thead><tr><th scope="col">Exercise</th><th scope="col" class="num">Sessions</th><th scope="col">Last session</th><th scope="col">Sets</th><th scope="col">Trend</th><th scope="col">Change</th></tr></thead><tbody>' +
          list.map((e) => '<tr><td><a href="#/exercise/' + esc(e.exerciseId) + '?tab=progress"><b>' + esc(e.name) + '</b></a>' + (e.isActive ? '' : ' <span class="badge badge--inactive">Inactive</span>') + '<div class="xsmall muted">' + esc(e.categoryName) + '</div></td>' +
            '<td class="num">' + e.sessionsCount + '</td><td class="nowrap">' + esc(U.fmtShort(e.lastDate)) + ' — ' + esc(e.lastLabel) + '</td><td class="tnum nowrap">' + esc(U.setsText(e.lastSets)) + '</td>' +
            '<td>' + Charts.spark(e.spark, e.name + ' total reps: ' + e.spark.join(', ')) + '</td><td>' + UI.delta(e.delta) + '</td></tr>').join('') + '</tbody></table></div>' +
          '<div class="card admin-card-view"><ul class="list">' + list.map((e) =>
            '<li class="list-item"><a class="list-link" href="#/exercise/' + esc(e.exerciseId) + '?tab=progress"><span class="grow"><span class="list-title">' + esc(e.name) + '</span>' +
            '<span class="small muted" style="display:block">' + U.plural(e.sessionsCount, 'session') + ' · last ' + esc(U.fmtShort(e.lastDate)) + ' · <span class="tnum">' + esc(U.setsText(e.lastSets)) + '</span></span></span>' +
            Charts.spark(e.spark, e.name + ' total reps: ' + e.spark.join(', ')) + UI.delta(e.delta) + '</a></li>').join('') + '</ul></div>';
      };
      sel.addEventListener('change', () => { sort = sel.value; U.store.set('gymlogger.progress.sort', sort); draw(); });
      draw();
      App.focus();
    });
  };

  /* ---- SCR-USR-08 Profile ------------------------------------------------------------ */
  V.profile = ({ main }) => {
    App.title('Profile');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    UI.load(page, () => Api.me(), (u) => {
      const theme = U.store.get('gymlogger.theme', 'system');
      page.innerHTML = UI.pageHead({ title: 'Profile' }) +
        '<div class="stack-lg" style="max-width:640px">' +
        '<section class="card stack" aria-labelledby="acc-h"><div class="row"><span class="avatar" style="width:52px;height:52px;font-size:1.1rem">' + esc(U.initials(u.displayName)) + '</span>' +
        '<div class="grow"><h2 class="card-title" id="acc-h">' + esc(u.displayName) + '</h2><p class="small muted">' + esc(u.email) + '</p></div>' + (u.role === 'Admin' ? '<span class="badge badge--admin">' + icon('shield') + 'Admin</span>' : '') + '</div>' +
        '<form class="form" novalidate data-form><div class="field"><label for="pf-name">Display name<span class="req" aria-hidden="true">*</span></label><input class="input" id="pf-name" name="displayName" value="' + esc(u.displayName) + '" autocomplete="name" required aria-required="true" maxlength="50"></div>' +
        '<div class="field"><label for="pf-email">Email</label><input class="input" id="pf-email" value="' + esc(u.email) + '" readonly aria-describedby="pf-email-hint"><p class="hint" id="pf-email-hint">Email changes are not available in Phase 1.</p></div>' +
        '<div class="form-actions"><button type="submit" class="btn btn-primary">Save changes</button></div></form></section>' +
        '<section class="card stack" aria-labelledby="app-h"><h2 class="card-title" id="app-h">Appearance</h2><div class="seg" role="radiogroup" aria-label="Theme">' +
        [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, ic]) => '<label><input type="radio" name="theme" value="' + v + '"' + (v === theme ? ' checked' : '') + '><span>' + icon(ic) + l + '</span></label>').join('') + '</div></section>' +
        (u.role === 'Admin' ? '<section class="card stack" aria-labelledby="adm-h"><h2 class="card-title" id="adm-h">Administration</h2><p class="small muted">Manage the exercise library, media and reference data.</p><div><a class="btn" href="#/admin/exercises">' + icon('shield') + 'Open exercise admin</a></div></section>' : '') +
        '<section class="card stack" aria-labelledby="ses-h"><h2 class="card-title" id="ses-h">Session</h2><p class="small muted">Signed in until ' + esc(U.fmtTime(u.expiresAt)) + ' on ' + esc(U.fmtDay(U.toISODate(new Date(u.expiresAt)))) + '. Any workout in progress stays saved when you sign out.</p>' +
        '<div><button type="button" class="btn btn-danger-ghost" data-logout>' + icon('logout') + 'Sign out</button></div></section></div>';
      const form = page.querySelector('[data-form]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = G.Domain.validateDisplayName(form.displayName.value);
        if (err) { UI.showFieldErrors(form, { displayName: err }); return; }
        UI.clearFieldErrors(form);
        const b = form.querySelector('[type="submit"]');
        UI.busy(b, true, 'Saving…');
        try { await Api.updateProfile({ displayName: form.displayName.value }); UI.toast('Profile updated.'); App.rerender(); }
        catch (x) { UI.busy(b, false); UI.applyApiError(form, x); }
      });
      page.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', () => App.applyTheme(r.value)));
      const lo = page.querySelector('[data-logout]');
      lo.addEventListener('click', async () => {
        UI.busy(lo, true, 'Signing out…');
        await Api.logout().catch(() => {});
        U.go('/login?signedout=1');
      });
      App.focus();
    });
  };
})(window.GL);
