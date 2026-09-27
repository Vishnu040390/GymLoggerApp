/* Screens: SCR-WK-01 Active workout · SCR-WK-02 Workout complete
   Dialogs: DLG-02 Add exercise · DLG-03 Previous performance (compare)
            DLG-04 Finish workout · DLG-05 Cancel workout
   Priority screen of Phase 1: fast set entry, autosave, clear session state,
   no global navigation, historical values visibly different from today's. */
(function (G) {
  'use strict';
  const { U, UI, Api, App, Sync } = G;
  const D = G.Domain;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});
  const W = (G.Workout = G.Workout || {});

  const refKey = (id) => 'gymlogger.proto.ref.' + id;
  const cmpKey = (id) => 'gymlogger.proto.cmp.' + id;
  W.refKey = refKey;
  W.cmpKey = cmpKey;

  /* =======================================================================
     SCR-WK-01 Active workout
     ======================================================================= */
  V.workout = ({ main, params }) => {
    App.title('Workout');
    const id = params.id;
    const st = {
      ws: null,
      exercises: [],
      refId: U.store.get(refKey(id), null),
      ref: null,
      cmpChoice: U.store.get(cmpKey(id), {}),
      hist: {},
      removing: new Map(),
    };
    const saveTimers = new Map();
    let disposed = false;
    let tick = null;
    let lastAnnounced = '';

    /* ---- Model helpers ---------------------------------------------------- */
    const findEx = (k) => st.exercises.find((e) => Sync.same(e.key, k));
    const findSet = (ex, k) => ex && ex.sets.find((s) => Sync.same(s.key, k));
    const liveSets = (ex) => ex.sets.filter((s) => !st.removing.has(s.key));
    const histFor = (ex) => st.hist[ex.exerciseId] || [];
    function cmpFor(ex) {
      const choice = st.cmpChoice[ex.exerciseId];
      if (choice === 'none') return null;
      if (choice) return histFor(ex).find((i) => i.workoutId === choice) || null;
      if (st.ref) return histFor(ex).find((i) => i.workoutId === st.ref.id) || null;
      return null;
    }
    /** Running total vs the previous session over the same set numbers only (like for like). */
    function totalLine(ex, sets, c) {
      const logged = sets.filter((x) => x.count != null);
      const total = D.total(logged);
      let html = U.plural(sets.length, 'set') + ' · ' + total + ' reps';
      if (c) {
        const n = sets.length;
        const prevSame = D.total(c.sets.filter((p) => p.setNumber <= n));
        html += ' ' + UI.delta(total - prevSame) + '<span class="sr-only"> compared with the same sets last time</span>';
      }
      return html;
    }
    function suggest(ex, n) {
      const c = cmpFor(ex);
      const fromCmp = c && c.sets.find((s) => s.setNumber === n);
      if (fromCmp) return fromCmp.count;
      const logged = liveSets(ex).filter((s) => s.count != null);
      return logged.length ? logged[logged.length - 1].count : null;
    }
    /** Last time's count for set n: shown as a placeholder on draft rows only (never saved by itself). */
    function lastTime(ex, n) {
      const last = histFor(ex)[0];
      const set = last && last.sets.find((x) => x.setNumber === n);
      return set ? set.count : null;
    }
    function loadHist(exerciseId) {
      return Api.exerciseHistory(exerciseId, { excludeWorkoutId: id, limit: 12 })
        .then((d) => { st.hist[exerciseId] = d.items; })
        .catch(() => { if (!st.hist[exerciseId]) st.hist[exerciseId] = []; });
    }
    function applyPending() {
      Sync.pending(id).forEach((op) => {
        const ex = op.weKey ? findEx(op.weKey) : null;
        if (op.type === 'addExercise' && !findEx(op.tempWeId)) st.exercises.push({ key: op.tempWeId, ...op.info, sets: [] });
        if (op.type === 'removeExercise') st.exercises = st.exercises.filter((e) => !Sync.same(e.key, op.weKey));
        if (op.type === 'addSet' && ex && !findSet(ex, op.tempId)) ex.sets.push({ key: op.tempId, count: op.count });
        if (op.type === 'updateSet') { const s = findSet(ex, op.setKey); if (s) s.count = op.count; }
        if (op.type === 'deleteSet' && ex) ex.sets = ex.sets.filter((s) => !Sync.same(s.key, op.setKey));
      });
    }

    /* ---- Load -------------------------------------------------------------- */
    async function load() {
      main.innerHTML = '<div class="focus-page" style="padding-top:24px">' + UI.skeleton() + '</div>';
      try {
        const ws = await Api.workout(id);
        if (disposed) return;
        if (ws.status !== 'InProgress') {
          UI.toast(ws.status === 'Completed' ? 'This workout is finished and now read-only.' : 'This workout was cancelled.', { icon: 'info' });
          location.replace('#/history/' + id);
          return;
        }
        st.ws = ws;
        st.exercises = ws.exercises.map((e) => ({
          key: e.id, exerciseId: e.exerciseId, name: e.name, categoryName: e.categoryName, muscleGroupName: e.muscleGroupName,
          equipmentName: e.equipmentName, primaryImage: e.primaryImage, sets: e.sets.map((s) => ({ key: s.id, count: s.count })),
        }));
        applyPending();
        const jobs = st.exercises.map((e) => loadHist(e.exerciseId));
        if (st.refId) jobs.push(Api.workout(st.refId).then((r) => { st.ref = r; }).catch(() => { st.refId = null; U.store.remove(refKey(id)); }));
        await Promise.all(jobs);
        if (disposed) return;
        renderAll();
        App.focus();
      } catch (e) {
        if (disposed) return;
        if (e.status === 404) { App.showNotFound(e); return; }
        if (e.status === 401) return;
        main.innerHTML = '<div class="focus-page" style="padding-top:24px"><a class="back-link" href="#/">' + icon('chevron-left') + 'Today</a>' + UI.errorState(e) + '</div>';
        main.querySelector('[data-action="retry"]').addEventListener('click', load);
      }
    }

    /* ---- Render -------------------------------------------------------------- */
    function renderAll() {
      const ws = st.ws;
      main.innerHTML =
        '<header class="wk-header"><div class="wk-header-inner">' +
        '<a class="btn btn-ghost btn-icon" href="#/" aria-label="Back to Today (your workout stays in progress)">' + icon('chevron-left') + '</a>' +
        '<div class="wk-title"><h1 tabindex="-1">Workout</h1><p>' + esc(U.fmtDay(ws.workoutDate)) + ' · ' + esc(ws.label) + ' · ' + esc(U.fmtTime(ws.startTime)) + '</p></div>' +
        '<div><button type="button" class="btn btn-ghost btn-icon" data-menu aria-label="Workout options">' + icon('more') + '</button></div>' +
        '<div class="wk-status">' + UI.statusBadge('InProgress') + '<span class="timer" role="timer" aria-label="Elapsed time" data-timer></span>' +
        '<span class="save-state" data-save aria-hidden="true"></span><span class="sr-only" role="status" data-save-live></span></div>' +
        '</div></header>' +
        '<div class="focus-page"><div class="stack" data-body></div></div>' +
        '<div class="wk-actions"><div class="wk-actions-inner">' +
        '<button type="button" class="btn btn-lg" data-add-ex>' + icon('plus') + 'Add exercise</button>' +
        '<button type="button" class="btn btn-primary btn-lg" data-finish>' + icon('flag') + 'Finish</button>' +
        '</div></div>';
      const timerEl = main.querySelector('[data-timer]');
      const upd = () => { timerEl.textContent = U.fmtClock(Date.now() - new Date(ws.startTime)); };
      upd();
      clearInterval(tick);
      tick = setInterval(upd, 1000);
      UI.menu(main.querySelector('[data-menu]'), [
        { label: 'Add exercise', icon: 'plus', onClick: () => openPicker(main.querySelector('[data-add-ex]')) },
        ...(G.MockApi ? [{ label: 'Prototype controls', icon: 'flask', onClick: () => App.openPrototypePanel() }] : []),
        { divider: true },
        { label: 'Cancel workout', icon: 'ban', danger: true, onClick: () => cancelFlow() },
      ]);
      main.querySelector('[data-add-ex]').addEventListener('click', (e) => openPicker(e.currentTarget));
      main.querySelector('[data-finish]').addEventListener('click', (e) => finishFlow(e.currentTarget));
      bindBody(main.querySelector('[data-body]'));
      renderBody();
      updateSave();
    }

    function refBanner() {
      if (!st.ref) return '';
      const r = st.ref;
      const missing = r.exercises.filter((e) => !st.exercises.some((x) => x.exerciseId === e.exerciseId) && e.isExerciseActive);
      return '<section class="ref-banner hist" aria-label="Comparison session">' + icon('history') +
        '<div class="grow stack-sm" style="gap:6px"><span class="hist-label">Comparing with</span>' +
        '<span><b>' + esc(U.fmtDay(r.workoutDate)) + ' — ' + esc(r.label) + '</b> · ' + esc(UI.sessionTime(r)) + '</span>' +
        (missing.length ? '<div class="row-tight"><span class="small">Also in that session:</span>' + missing.map((e) => '<button type="button" class="chip" data-quick-add="' + esc(e.exerciseId) + '">' + icon('plus') + esc(e.name) + '</button>').join('') + '</div>' : '') +
        '</div><button type="button" class="btn btn-ghost btn-icon btn-sm" data-ref-clear aria-label="Stop comparing with this session">' + icon('x') + '</button></section>';
    }

    function renderBody() {
      const body = main.querySelector('[data-body]');
      if (!body) return;
      body.innerHTML = refBanner() + (st.exercises.length
        ? st.exercises.map(cardHtml).join('')
        : UI.empty({ icon: 'dumbbell', title: 'Add your first exercise', text: 'Search the exercise library, then log each set as you finish it. Everything saves automatically.', action: '<button type="button" class="btn btn-primary btn-lg" data-empty-add>' + icon('plus') + 'Add exercise</button>' }));
      st.exercises.forEach(bindCardMenu);
    }

    function cardHtml(ex) {
      const c = cmpFor(ex);
      const sets = liveSets(ex);
      const hasHist = histFor(ex).length > 0;
      const k = esc(ex.key);
      const pendingEx = Sync.pending(id).some((o) => o.type === 'addExercise' && o.tempWeId === ex.key);
      return '<section class="ex-card" data-ex="' + k + '" aria-labelledby="exh-' + k + '">' +
        '<div class="ex-card-head">' + UI.thumb(ex.primaryImage, { name: ex.name }) +
        '<div class="grow"><h2 id="exh-' + k + '"><button type="button" class="text-btn" data-info aria-label="' + esc(ex.name) + ', view instructions">' + esc(ex.name) + '</button></h2>' +
        '<p class="ex-meta">' + esc(ex.muscleGroupName) + ' · ' + esc(ex.equipmentName) + '<span data-ex-pending>' + (pendingEx ? ' · <span class="set-msg--pending">Not saved yet</span>' : '') + '</span></p></div>' +
        '<div><button type="button" class="btn btn-ghost btn-icon" data-ex-menu aria-label="Options for ' + esc(ex.name) + '">' + icon('more') + '</button></div></div>' +
        (c ? '<div class="ex-compare hist">' + icon('history') + '<span class="grow"><span class="hist-label">Previous</span> <b>' + esc(U.fmtShort(c.workoutDate)) + ' — ' + esc(c.label) + '</b> · <span class="tnum">' + esc(U.setsText(c.sets)) + '</span></span>' +
          '<button type="button" class="btn btn-sm btn-hist" data-compare>Change</button></div>' : '') +
        (sets.length
          ? '<table class="sets-table"><caption class="sr-only">' + esc(ex.name) + ' sets' + (c ? ', compared with ' + esc(UI.sessionName(c)) : '') + '</caption>' +
            '<thead><tr><th class="col-set" scope="col">Set</th><th class="col-count" scope="col">Count</th>' + (c ? '<th class="col-prev" scope="col">Previous</th>' : '') + '<th class="col-del" scope="col"><span class="sr-only">Remove</span></th></tr></thead>' +
            '<tbody>' + sets.map((s, i) => rowHtml(ex, s, i, c)).join('') + '</tbody></table>'
          : '<p class="set-empty">No sets yet. Add each set after you finish it.</p>') +
        '<div class="ex-card-foot"><button type="button" class="btn btn-soft" data-add-set>' + icon('plus') + 'Add set</button>' +
        (!c && hasHist ? '<button type="button" class="btn btn-ghost" data-compare>' + icon('compare') + 'Compare</button>' : '') +
        '<span class="grow"></span>' +
        (sets.length ? '<span class="small muted tnum row-tight" data-total>' + totalLine(ex, sets, c) + '</span>'
          : !hasHist ? '<span class="small muted">First time logging this exercise</span>' : '') +
        '</div></section>';
    }

    function rowState(s) {
      if (s.error) return 'error';
      if (s.draft) return 'draft';
      if (Sync.isPending(id, s.key)) return 'pending';
      return 'saved';
    }
    function cmpCell(s, n, c) {
      const prev = c ? c.sets.find((x) => x.setNumber === n) : null;
      if (!prev) return '<div class="cmp-cell"><span class="prev-val prev-val--none"><span aria-hidden="true">—</span><span class="sr-only">No set ' + n + ' last time</span></span></div>';
      return '<div class="cmp-cell"><span class="prev-val"><span class="sr-only">Previous </span>' + prev.count + '</span>' + UI.delta(s.count != null ? s.count - prev.count : null) + '</div>';
    }
    function rowMsg(s, inputId, ph) {
      if (s.error) return '<p class="set-msg set-msg--error" id="' + inputId + '-msg">' + esc(s.error) + '</p>';
      if (s.draft) return '<p class="set-msg" id="' + inputId + '-msg">Enter a count to save this set.' + (ph != null ? ' Last time: ' + ph + '.' : '') + '</p>';
      return '';
    }
    function rowHtml(ex, s, i, c) {
      const n = i + 1;
      const state = rowState(s);
      const inputId = 'cnt-' + s.key;
      const ph = s.draft ? lastTime(ex, n) : null;
      const msg = rowMsg(s, inputId, ph);
      return '<tr class="set-row set-row--' + state + '" data-set="' + esc(s.key) + '">' +
        '<td class="col-set"><span class="set-no">' + n + (state === 'pending' ? '<span class="sr-only"> (not saved yet)</span>' : '') + '</span></td>' +
        '<td><div class="stepper"><button type="button" data-step="-1" aria-label="Decrease set ' + n + ' count"' + (s.count != null && s.count <= D.COUNT_MIN ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
        '<input id="' + inputId + '" type="number" inputmode="numeric" pattern="[0-9]*" min="' + D.COUNT_MIN + '" max="' + D.COUNT_MAX + '" step="1" enterkeyhint="done" value="' + (s.count != null ? s.count : '') + '" placeholder="' + (s.draft ? (ph != null ? ph : 'Reps') : '') + '" aria-label="Set ' + n + ' count" data-count' +
        (msg ? ' aria-describedby="' + inputId + '-msg"' : '') + (s.error ? ' aria-invalid="true"' : '') + '>' +
        '<button type="button" data-step="1" aria-label="Increase set ' + n + ' count"' + (s.count != null && s.count >= D.COUNT_MAX ? ' disabled' : '') + '>' + icon('plus') + '</button></div>' + msg + '</td>' +
        (c ? '<td data-cmp>' + cmpCell(s, n, c) + '</td>' : '') +
        '<td class="col-del"><button type="button" class="btn btn-ghost btn-icon btn-sm" data-del aria-label="Remove set ' + n + '">' + icon('trash') + '</button></td></tr>';
    }

    function cardEl(ex) { return main.querySelector('[data-ex="' + CSS.escape(ex.key) + '"]'); }
    function rerenderCard(ex, focusSel) {
      const el = cardEl(ex);
      if (!el) { renderBody(); return; }
      const tmp = document.createElement('div');
      tmp.innerHTML = cardHtml(ex);
      const fresh = tmp.firstElementChild;
      el.replaceWith(fresh);
      bindCardMenu(ex);
      if (focusSel) { const f = fresh.querySelector(focusSel); if (f) f.focus(); }
    }
    /** Update one row in place — never re-render while the person is typing. */
    function updateRow(ex, s) {
      const card = cardEl(ex);
      const tr = card && card.querySelector('tr[data-set="' + CSS.escape(s.key) + '"]');
      if (!tr) return;
      const sets = liveSets(ex);
      const n = sets.indexOf(s) + 1;
      const c = cmpFor(ex);
      const state = rowState(s);
      tr.className = 'set-row set-row--' + state;
      tr.querySelector('.set-no').innerHTML = n + (state === 'pending' ? '<span class="sr-only"> (not saved yet)</span>' : '');
      const input = tr.querySelector('[data-count]');
      const old = tr.querySelector('.set-msg');
      if (old) old.remove();
      const msg = rowMsg(s, input.id, s.draft ? lastTime(ex, n) : null);
      if (msg) { input.closest('td').insertAdjacentHTML('beforeend', msg); input.setAttribute('aria-describedby', input.id + '-msg'); } else input.removeAttribute('aria-describedby');
      if (s.error) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      const [dec, inc] = tr.querySelectorAll('[data-step]');
      dec.disabled = s.count != null && s.count <= D.COUNT_MIN;
      inc.disabled = s.count != null && s.count >= D.COUNT_MAX;
      const cell = tr.querySelector('[data-cmp]');
      if (cell) cell.innerHTML = cmpCell(s, n, c);
      const tot = card.querySelector('[data-total]');
      if (tot) tot.innerHTML = totalLine(ex, sets, c);
    }
    function refreshStates() {
      st.exercises.forEach((ex) => liveSets(ex).forEach((s) => {
        const card = cardEl(ex);
        const tr = card && card.querySelector('tr[data-set="' + CSS.escape(s.key) + '"]');
        if (tr && !tr.contains(document.activeElement)) updateRow(ex, s);
        else if (tr) tr.className = 'set-row set-row--' + rowState(s);
      }));
      U.$$('[data-ex-pending]', main).forEach((el) => {
        const key = el.closest('[data-ex]').dataset.ex;
        const pending = Sync.pending(id).some((o) => o.type === 'addExercise' && o.tempWeId === key);
        el.innerHTML = pending ? ' · <span class="set-msg--pending">Not saved yet</span>' : '';
      });
    }

    function updateSave() {
      const el = main.querySelector('[data-save]');
      const live = main.querySelector('[data-save-live]');
      if (!el) return;
      const n = Sync.pending(id).length;
      const s = Sync.status;
      let cls = 'saved', html = icon('cloud') + 'All changes saved', say = 'All changes saved';
      if (n && s === 'offline') { cls = 'offline'; html = icon('wifi-off') + 'Offline · ' + U.plural(n, 'change') + ' waiting'; say = "You're offline. Changes are kept on this device."; }
      else if (n && s === 'error') { cls = 'error'; html = icon('alert-circle') + 'Not saved · <button type="button" class="link-btn" data-retry>Retry</button>'; say = "Some changes couldn't be saved."; }
      else if (n || s === 'saving') { cls = 'saving'; html = '<span class="spinner" aria-hidden="true"></span>Saving…'; say = lastAnnounced === 'All changes saved' ? lastAnnounced : say; }
      el.className = 'save-state save-state--' + cls;
      el.innerHTML = html;
      el.removeAttribute('aria-hidden');
      if (cls === 'saving' || cls === 'saved') el.setAttribute('aria-hidden', 'true');
      const r = el.querySelector('[data-retry]');
      if (r) r.addEventListener('click', () => Sync.kick());
      // Announce only meaningful transitions (offline, error, recovered) — not every save.
      if (live && say !== lastAnnounced && (cls === 'offline' || cls === 'error' || (cls === 'saved' && (lastAnnounced.startsWith('You') || lastAnnounced.startsWith('Some'))))) live.textContent = say;
      if (cls !== 'saving') lastAnnounced = say;
    }

    /* ---- Set editing -------------------------------------------------------------- */
    function persistSet(ex, s) {
      saveTimers.delete(s.key);
      if (s.count == null || s.error) return;
      if (s.draft) {
        s.draft = false;
        Sync.enqueue({ type: 'addSet', workoutId: id, weKey: ex.key, tempId: s.key, count: s.count, key: Api.newKey() });
      } else {
        Sync.enqueue({ type: 'updateSet', workoutId: id, weKey: ex.key, setKey: s.key, count: s.count });
      }
      updateRow(ex, s);
    }
    function scheduleSave(ex, s, ms) {
      clearTimeout(saveTimers.get(s.key));
      if (!ms) { persistSet(ex, s); return; }
      saveTimers.set(s.key, setTimeout(() => persistSet(ex, s), ms));
    }
    function flushSaves() {
      st.exercises.forEach((ex) => ex.sets.forEach((s) => { if (saveTimers.has(s.key)) { clearTimeout(saveTimers.get(s.key)); persistSet(ex, s); } }));
    }
    function onCount(ex, s, raw, ms) {
      const err = D.validateCount(raw);
      if (err) {
        clearTimeout(saveTimers.get(s.key)); saveTimers.delete(s.key);
        s.error = raw === '' && s.draft ? null : err + (s.draft || s.lastGood == null ? '' : ' Last saved: ' + s.lastGood + '.');
        updateRow(ex, s);
        return;
      }
      s.error = null;
      s.count = Number(raw);
      s.lastGood = s.count;
      updateRow(ex, s);
      scheduleSave(ex, s, ms);
    }

    function addSet(ex) {
      const n = liveSets(ex).length + 1;
      const value = suggest(ex, n);
      const s = { key: U.uid('tmp'), count: value, draft: value == null };
      ex.sets.push(s);
      if (value != null) { s.lastGood = value; Sync.enqueue({ type: 'addSet', workoutId: id, weKey: ex.key, tempId: s.key, count: value, key: Api.newKey() }); }
      rerenderCard(ex, 'tr[data-set="' + CSS.escape(s.key) + '"] [data-count]');
    }

    function removeSet(ex, s) {
      clearTimeout(saveTimers.get(s.key)); saveTimers.delete(s.key);
      if (s.draft) {
        ex.sets = ex.sets.filter((x) => x !== s);
        rerenderCard(ex, '[data-add-set]');
        return;
      }
      const n = liveSets(ex).indexOf(s) + 1;
      // Soft-remove: hidden now, sent after the undo window closes.
      const timer = setTimeout(() => commitRemoval(s.key), 6500);
      st.removing.set(s.key, { timer, ex, s });
      rerenderCard(ex, '[data-add-set]');
      UI.toast('Set ' + n + ' removed from ' + ex.name + '.', {
        icon: 'trash', duration: 6000,
        action: { label: 'Undo', onClick: () => { const r = st.removing.get(s.key); if (!r) return; clearTimeout(r.timer); st.removing.delete(s.key); rerenderCard(ex, 'tr[data-set="' + CSS.escape(s.key) + '"] [data-count]'); } },
      });
    }
    function commitRemoval(key) {
      const r = st.removing.get(key);
      if (!r) return;
      clearTimeout(r.timer);
      st.removing.delete(key);
      r.ex.sets = r.ex.sets.filter((x) => x.key !== key);
      Sync.enqueue({ type: 'deleteSet', workoutId: id, weKey: r.ex.key, setKey: key });
    }
    const commitAllRemovals = () => Array.from(st.removing.keys()).forEach(commitRemoval);

    /* ---- Exercises -------------------------------------------------------------------- */
    function addExercise(dto) {
      const existing = st.exercises.find((e) => e.exerciseId === dto.id);
      if (existing) { focusCard(existing); return; }
      const info = { exerciseId: dto.id, name: dto.name, categoryName: dto.categoryName, muscleGroupName: dto.muscleGroupName, equipmentName: dto.equipmentName, primaryImage: dto.primaryImage };
      const ex = { key: U.uid('tmp'), ...info, sets: [] };
      st.exercises.push(ex);
      Sync.enqueue({ type: 'addExercise', workoutId: id, tempWeId: ex.key, exerciseId: dto.id, key: Api.newKey(), info });
      renderBody();
      focusCard(ex);
      loadHist(dto.id).then(() => { if (!disposed && cardEl(ex) && !cardEl(ex).contains(document.activeElement)) rerenderCard(ex); else if (!disposed && cardEl(ex)) rerenderCard(ex, '[data-add-set]'); });
    }
    function focusCard(ex) {
      const el = cardEl(ex);
      if (!el) return;
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      const b = el.querySelector('[data-add-set]');
      if (b) b.focus({ preventScroll: true });
    }
    async function removeExercise(ex, returnFocus) {
      const sets = liveSets(ex).filter((s) => !s.draft);
      if (sets.length) {
        const ok = await UI.confirm({ title: 'Remove ' + ex.name + '?', message: 'Its ' + U.plural(sets.length, 'set') + ' will be removed from this workout. This can\'t be undone.', confirmLabel: 'Remove exercise', danger: true, returnFocus });
        if (!ok) return;
      }
      ex.sets.forEach((s) => { clearTimeout(saveTimers.get(s.key)); saveTimers.delete(s.key); const r = st.removing.get(s.key); if (r) { clearTimeout(r.timer); st.removing.delete(s.key); } });
      st.exercises = st.exercises.filter((e) => e !== ex);
      Sync.enqueue({ type: 'removeExercise', workoutId: id, weKey: ex.key });
      renderBody();
      main.querySelector('[data-add-ex]').focus();
      UI.toast(ex.name + ' removed.', { icon: 'trash' });
    }
    function bindCardMenu(ex) {
      const card = cardEl(ex);
      if (!card) return;
      const btn = card.querySelector('[data-ex-menu]');
      UI.menu(btn, () => {
        const items = [{ label: 'View instructions', icon: 'info', onClick: () => G.Shared.exerciseInfo(ex.exerciseId, btn) }];
        if (histFor(ex).length) items.push({ label: cmpFor(ex) ? 'Change comparison' : 'Compare with previous', icon: 'compare', onClick: () => openCompare(ex, btn) });
        if (cmpFor(ex)) items.push({ label: 'Stop comparing', icon: 'x', onClick: () => setChoice(ex, 'none') });
        items.push({ divider: true }, { label: 'Remove exercise', icon: 'trash', danger: true, onClick: () => removeExercise(ex, btn) });
        return items;
      });
    }
    function setChoice(ex, value) {
      st.cmpChoice[ex.exerciseId] = value;
      U.store.set(cmpKey(id), st.cmpChoice);
      rerenderCard(ex, '[data-add-set]');
    }

    /* ---- Events (delegated on the body) ------------------------------------------------- */
    function bindBody(body) {
      const ctx = (el) => {
        const card = el.closest('[data-ex]');
        const ex = card && findEx(card.dataset.ex);
        const tr = el.closest('tr[data-set]');
        const s = ex && tr ? ex.sets.find((x) => x.key === tr.dataset.set) : null;
        return { ex, s };
      };
      body.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        const { ex, s } = ctx(t);
        if (t.matches('[data-step]') && ex && s) {
          const input = t.closest('.stepper').querySelector('input');
          const n = liveSets(ex).indexOf(s) + 1;
          const hint = lastTime(ex, n);
          const base = input.value === '' ? (hint != null ? hint : suggest(ex, n) || 0) : Number(input.value) || 0;
          const next = Math.min(D.COUNT_MAX, Math.max(D.COUNT_MIN, base + Number(t.dataset.step)));
          input.value = next;
          onCount(ex, s, String(next), 600);
        } else if (t.matches('[data-del]') && ex && s) removeSet(ex, s);
        else if (t.matches('[data-add-set]') && ex) addSet(ex);
        else if (t.matches('[data-compare]') && ex) openCompare(ex, t);
        else if (t.matches('[data-info]') && ex) G.Shared.exerciseInfo(ex.exerciseId, t);
        else if (t.matches('[data-empty-add]')) openPicker(t);
        else if (t.matches('[data-ref-clear]')) {
          st.ref = null; st.refId = null; U.store.remove(refKey(id));
          renderBody(); main.querySelector('[data-add-ex]').focus();
          UI.toast('Comparison removed. Per-exercise comparisons you picked are kept.', { icon: 'info' });
        } else if (t.matches('[data-quick-add]')) {
          const e2 = st.ref.exercises.find((x) => x.exerciseId === t.dataset.quickAdd);
          if (e2) addExercise({ id: e2.exerciseId, name: e2.name, categoryName: e2.categoryName, muscleGroupName: e2.muscleGroupName, equipmentName: e2.equipmentName, primaryImage: e2.primaryImage });
        }
      });
      body.addEventListener('input', (e) => {
        if (!e.target.matches('[data-count]')) return;
        const { ex, s } = ctx(e.target);
        if (ex && s) onCount(ex, s, e.target.value, 700);
      });
      body.addEventListener('change', (e) => {
        if (!e.target.matches('[data-count]')) return;
        const { ex, s } = ctx(e.target);
        if (ex && s && saveTimers.has(s.key)) { clearTimeout(saveTimers.get(s.key)); persistSet(ex, s); }
      });
      body.addEventListener('focusin', (e) => { if (e.target.matches('[data-count]') && e.target.value) { try { e.target.select(); } catch (err) { /* unsupported */ } } });
      body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.matches('[data-count]')) return;
        e.preventDefault();
        const { ex, s } = ctx(e.target);
        if (!ex || !s) return;
        if (saveTimers.has(s.key)) { clearTimeout(saveTimers.get(s.key)); persistSet(ex, s); }
        const rows = U.$$('[data-count]', cardEl(ex));
        const i = rows.indexOf(e.target);
        if (rows[i + 1]) rows[i + 1].focus(); else cardEl(ex).querySelector('[data-add-set]').focus();
      });
    }

    /* ---- DLG-02 Add exercise ----------------------------------------------------------------- */
    async function openPicker(returnFocus) {
      const body = document.createElement('div');
      body.innerHTML = '<div class="picker-search"><div class="input-wrap">' + icon('search') +
        '<input class="input" type="search" id="picker-q" placeholder="Search by name, muscle or equipment" aria-label="Search exercises" autocomplete="off" autofocus data-q></div>' +
        '<div class="chip-row" role="group" aria-label="Filter by category" data-cats></div></div>' +
        '<div data-results><div class="loading-block"><span class="spinner"></span>Loading exercises…</div></div><p class="sr-only" role="status" data-count-live></p>';
      const d = UI.dialog({ title: 'Add exercise', body, full: true, returnFocus });
      const results = body.querySelector('[data-results]');
      const q = body.querySelector('[data-q]');
      let all = [], cats = [], cat = '';
      const load = async () => {
        try {
          const [ex, ref] = await Promise.all([Api.exercises({ include: 'last', excludeWorkoutId: id, sort: 'name' }), Api.reference()]);
          all = ex.items; cats = ref.categories;
          body.querySelector('[data-cats]').innerHTML = '<button type="button" class="chip" aria-pressed="true" data-cat="">All</button>' + cats.map((c) => '<button type="button" class="chip" aria-pressed="false" data-cat="' + esc(c.id) + '">' + esc(c.name) + '</button>').join('');
          draw();
        } catch (e) {
          results.innerHTML = UI.errorState(e);
          results.querySelector('[data-action="retry"]').addEventListener('click', load);
        }
      };
      const row = (x) => {
        const inWorkout = st.exercises.some((e) => e.exerciseId === x.id);
        return '<li class="picker-row"><button type="button" class="picker-main" data-pick="' + esc(x.id) + '">' + UI.thumb(x.primaryImage, x) +
          '<span class="grow"><span class="picker-name">' + esc(x.name) + '</span><span class="picker-meta">' + esc(x.muscleGroupName) + ' · ' + esc(x.equipmentName) + '</span>' +
          (x.last ? '<span class="picker-last">Last: ' + esc(U.setsText(x.last.sets)) + ' · ' + esc(U.fmtShort(x.last.workoutDate)) + '</span>' : '') + '</span></button>' +
          (inWorkout ? '<span class="badge badge--done">' + icon('check') + 'Added</span>' : '') +
          '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-pinfo="' + esc(x.id) + '" aria-label="About ' + esc(x.name) + '">' + icon('info') + '</button></li>';
      };
      const group = (title, items) => items.length ? '<h3 class="picker-group-title">' + esc(title) + '</h3><ul class="picker-list">' + items.map(row).join('') + '</ul>' : '';
      function draw() {
        const term = q.value.trim().toLowerCase();
        let list = all.filter((x) => (!cat || x.categoryId === cat) && (!term || [x.name, x.muscleGroupName, x.equipmentName, x.categoryName].some((v) => v.toLowerCase().includes(term))));
        let html;
        if (!term && !cat) {
          const fromRef = st.ref ? list.filter((x) => st.ref.exercises.some((r) => r.exerciseId === x.id)) : [];
          const recent = list.filter((x) => x.last && !fromRef.includes(x)).sort((a, b) => (a.last.workoutDate < b.last.workoutDate ? 1 : -1)).slice(0, 5);
          html = group('From your comparison session', fromRef) + group('Recently done', recent) + group('All exercises', list);
        } else {
          html = list.length ? group(U.plural(list.length, 'result'), list)
            : UI.empty({ icon: 'search', title: 'No matching exercises', text: 'Try another name or category. Exercises an admin has deactivated are not shown.', compact: true });
        }
        results.innerHTML = html;
        body.querySelector('[data-count-live]').textContent = (term || cat) ? U.plural(list.length, 'exercise') + ' found' : '';
      }
      q.addEventListener('input', U.debounce(draw, 120));
      body.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]');
        if (c) { cat = c.dataset.cat; U.$$('[data-cat]', body).forEach((b) => b.setAttribute('aria-pressed', String(b === c))); draw(); return; }
        const p = e.target.closest('[data-pick]');
        if (p) { const x = all.find((y) => y.id === p.dataset.pick); d.close(); addExercise(x); return; }
        const inf = e.target.closest('[data-pinfo]');
        if (inf) G.Shared.exerciseInfo(inf.dataset.pinfo, inf);
      });
      load();
    }

    /* ---- DLG-03 Previous performance ----------------------------------------------------------- */
    async function openCompare(ex, returnFocus) {
      if (!st.hist[ex.exerciseId]) await loadHist(ex.exerciseId);
      const items = histFor(ex);
      const current = cmpFor(ex);
      const byDate = [];
      items.forEach((i) => { const g = byDate.find((x) => x.date === i.workoutDate); if (g) g.items.push(i); else byDate.push({ date: i.workoutDate, items: [i] }); });
      const body = '<p class="muted">Pick any earlier session. Previous values are read-only and shown beside today\'s sets.</p>' +
        '<fieldset style="border:0;padding:0;margin:0" class="stack"><legend class="sr-only">Previous sessions with ' + esc(ex.name) + '</legend>' +
        '<label class="choice"><input type="radio" name="cmp-pick" value="none"' + (current ? '' : ' checked') + '><span class="stack-sm" style="gap:2px"><span class="choice-title">No comparison</span><span class="choice-desc">Log this exercise without previous values.</span></span></label>' +
        byDate.map((g) => '<div class="stack-sm"><div class="day-head"><h3 class="small" style="font-family:inherit;font-size:var(--fs-sm)">' + esc(U.fmtDate(g.date)) + '</h3>' + (g.items.length > 1 ? '<span class="same-day-note">' + g.items.length + ' separate sessions</span>' : '') + '</div>' +
          g.items.map((i) => '<label class="choice hist-choice"><input type="radio" name="cmp-pick" value="' + esc(i.workoutId) + '"' + (current && current.workoutId === i.workoutId ? ' checked' : '') + '>' +
            '<span class="grow stack-sm" style="gap:2px"><span class="choice-title">' + esc(i.label) + ' <span class="muted small">· ' + esc(UI.sessionTime(i)) + '</span></span>' +
            '<span class="choice-desc tnum">' + esc(U.setsText(i.sets)) + ' · ' + i.total + ' reps</span></span></label>').join('') + '</div>').join('') +
        '</fieldset>';
      const d = UI.dialog({
        title: 'Previous performance', description: ex.name, body, returnFocus,
        actions: [{ label: 'Cancel', value: 'cancel' }, {
          label: 'Apply', variant: 'primary', autofocus: false,
          onClick: (api) => { const v = api.body.querySelector('input[name="cmp-pick"]:checked').value; setChoice(ex, v); return true; },
        }],
      });
      const checked = d.body.querySelector('input:checked');
      if (checked) checked.focus();
    }

    /* ---- DLG-04 Finish ---------------------------------------------------------------------------- */
    function finishFlow(btn) {
      commitAllRemovals();
      flushSaves();
      const withSets = st.exercises.map((e) => ({ e, sets: liveSets(e).filter((s) => !s.draft && s.count != null) }));
      const totalSets = U.sum(withSets, (x) => x.sets.length);
      const drafts = U.sum(st.exercises, (e) => liveSets(e).filter((s) => s.draft).length);
      if (!totalSets) {
        UI.dialog({
          title: 'Nothing logged yet', returnFocus: btn,
          body: '<p>Log at least one set to finish this workout. If you are not training now, cancel the workout instead.</p>',
          actions: [{ label: 'Cancel workout', variant: 'ghost', onClick: () => { setTimeout(cancelFlow); return true; } }, { label: 'Keep logging', variant: 'primary', value: 'keep', autofocus: true }],
        });
        return;
      }
      const empties = withSets.filter((x) => !x.sets.length).map((x) => x.e.name);
      const reps = U.sum(withSets, (x) => D.total(x.sets));
      const offline = Sync.status === 'offline' && Sync.pending(id).length;
      const body = '<div class="stats stats--4">' +
        UI.stat({ label: 'Duration', value: esc(U.fmtDuration(Date.now() - new Date(st.ws.startTime))) }) +
        UI.stat({ label: 'Exercises', value: withSets.filter((x) => x.sets.length).length }) +
        UI.stat({ label: 'Sets', value: totalSets }) + UI.stat({ label: 'Reps', value: U.fmtNum(reps) }) + '</div>' +
        (empties.length ? '<div class="banner banner--warn">' + icon('alert') + '<div class="grow"><span><b>' + esc(empties.join(', ')) + '</b> ' + (empties.length === 1 ? 'has' : 'have') + ' no sets and will be removed from this workout.</span></div></div>' : '') +
        (drafts ? '<div class="banner banner--warn">' + icon('alert') + '<div class="grow"><span>' + U.plural(drafts, 'set') + ' without a count won\'t be saved.</span></div></div>' : '') +
        (offline ? '<div class="banner banner--warn">' + icon('wifi-off') + '<div class="grow"><span>You\'re offline. Your sets are safe on this device. You can finish once you\'re back online.</span></div></div>' : '') +
        '<p class="muted small">After you finish, this session becomes read-only in your history.</p>';
      const key = Api.newKey();
      UI.dialog({
        title: 'Finish workout?', body, returnFocus: btn,
        actions: [
          { label: 'Keep logging', value: 'keep' },
          {
            label: 'Finish workout', variant: 'primary', icon: 'flag', busyLabel: 'Finishing…', autofocus: true,
            onClick: async () => {
              await Sync.drain(id);
              await Api.completeWorkout(id, key);
              Sync.forget(id);
              U.go('/workout/' + id + '/summary');
              return true;
            },
          },
        ],
      });
    }

    /* ---- DLG-05 Cancel --------------------------------------------------------------------------- */
    function cancelFlow() {
      const key = Api.newKey();
      UI.dialog({
        title: 'Cancel this workout?',
        body: '<p>It will be marked as <b>Cancelled</b>. It stays in your history, but it won\'t count towards progress or appear as a comparison.</p>',
        actions: [
          { label: 'Keep workout', value: 'keep', autofocus: true },
          {
            label: 'Cancel workout', variant: 'danger', busyLabel: 'Cancelling…',
            onClick: async () => {
              commitAllRemovals();
              flushSaves();
              await Sync.drain(id).catch((e) => { if (e.network) throw e; });
              await Api.cancelWorkout(id, key);
              Sync.forget(id);
              U.store.remove(refKey(id)); U.store.remove(cmpKey(id));
              U.go('/');
              UI.toast('Workout cancelled. It\'s still listed in your history.', { icon: 'ban' });
              return true;
            },
          },
        ],
      });
    }

    /* ---- Sync events --------------------------------------------------------------------------- */
    const offSync = Sync.on((e) => {
      if (disposed || !st.ws) return;
      if (e.type === 'rejected' && e.op.workoutId === id) {
        const err = e.error;
        if (err.status === 409 || err.status === 404) {
          UI.toast(err.message + ' Reloading the latest version.', { type: 'error' });
          load();
          return;
        }
        const ex = e.op.weKey && findEx(e.op.weKey);
        const s = ex && findSet(ex, e.op.setKey || e.op.tempId);
        if (s) { s.error = err.message; updateRow(ex, s); } else UI.toast(err.message, { type: 'error' });
      }
      refreshStates();
      updateSave();
    });

    load();
    return () => {
      disposed = true;
      clearInterval(tick);
      commitAllRemovals();
      flushSaves();
      offSync();
    };
  };

  /* =======================================================================
     SCR-WK-02 Workout complete
     ======================================================================= */
  V.workoutSummary = ({ main, params }) => {
    App.title('Workout complete');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const before = (i, ws) => i.workoutDate < ws.workoutDate || (i.workoutDate === ws.workoutDate && i.startTime < ws.startTime);
    UI.load(page, async () => {
      const ws = await Api.workout(params.id);
      if (ws.status === 'InProgress') { location.replace('#/workout/' + ws.id); return null; }
      const refId = U.store.get(refKey(ws.id), null);
      const choice = U.store.get(cmpKey(ws.id), {});
      const comps = await Promise.all(ws.exercises.map(async (e) => {
        const h = await Api.exerciseHistory(e.exerciseId, { excludeWorkoutId: ws.id, limit: 30 });
        const wanted = choice[e.exerciseId] && choice[e.exerciseId] !== 'none' ? choice[e.exerciseId] : refId;
        const picked = wanted ? h.items.find((i) => i.workoutId === wanted) : null;
        return { e, prev: picked || h.items.find((i) => before(i, ws)) || null, picked: !!picked };
      }));
      return { ws, comps };
    }, (data) => {
      if (!data) return;
      const { ws, comps } = data;
      const first = (Api.user.displayName || '').split(' ')[0];
      page.innerHTML =
        '<div class="stack-lg" style="max-width:820px">' +
        '<header class="summary-hero"><span class="summary-check">' + icon('check') + '</span><p class="eyebrow">' + (ws.status === 'Completed' ? 'Workout complete' : 'Workout cancelled') + '</p>' +
        '<h1 tabindex="-1" class="display" style="font-size:var(--fs-3xl)">' + (ws.status === 'Completed' ? 'Nice work, ' + esc(first) : 'Workout cancelled') + '</h1>' +
        '<p class="muted">' + esc(U.fmtDate(ws.workoutDate)) + ' — ' + esc(ws.label) + ' · ' + esc(UI.sessionTime(ws)) + '</p></header>' +
        '<div class="stats stats--4">' + UI.stat({ label: 'Duration', value: esc(U.fmtDuration(ws.durationMs)) }) + UI.stat({ label: 'Exercises', value: ws.totals.exercises }) +
        UI.stat({ label: 'Sets', value: ws.totals.sets }) + UI.stat({ label: 'Reps', value: U.fmtNum(ws.totals.reps) }) + '</div>' +
        '<section class="section" aria-labelledby="cmp-h"><h2 class="section-title" id="cmp-h">How it compares</h2>' +
        comps.map(({ e, prev, picked }) => {
          const total = D.total(e.sets);
          return '<article class="card stack-sm"><div class="row-between"><h3 class="card-title">' + esc(e.name) + '</h3>' + (prev ? UI.delta(total - prev.total, { unit: 'reps' }) : '<span class="badge">First time</span>') + '</div>' +
            '<div class="session-line"><span><b>Today</b></span><span class="sets">' + esc(U.setsText(e.sets)) + ' · ' + total + ' reps</span></div>' +
            (prev ? '<div class="session-line hist" style="padding:6px 10px;border-radius:8px"><span>' + esc(UI.sessionName(prev)) + (picked ? ' <span class="xsmall">(your comparison)</span>' : ' <span class="xsmall">(previous)</span>') + '</span><span class="sets">' + esc(U.setsText(prev.sets)) + ' · ' + prev.total + ' reps</span></div>' +
              '<a class="small" href="#/exercise/' + esc(e.exerciseId) + '/compare' + U.qs({ a: ws.id, b: prev.workoutId }) + '">Compare set by set</a>'
              : '<p class="small muted">First time logging ' + esc(e.name) + '. Next time you\'ll see a comparison here.</p>') + '</article>';
        }).join('') + '</section>' +
        '<div class="row"><button type="button" class="btn btn-primary btn-lg" data-again>' + icon('play') + 'Start another session</button>' +
        '<a class="btn btn-lg" href="#/history/' + esc(ws.id) + '">View in history</a><a class="btn btn-lg btn-ghost" href="#/">Back to Today</a></div>' +
        '<p class="hint">You can log more than one session on the same day. Each one is kept separately.</p></div>';
      const again = page.querySelector('[data-again]');
      again.addEventListener('click', () => W.openStart({ returnFocus: again }));
      App.focus();
    });
  };
})(window.GL);
