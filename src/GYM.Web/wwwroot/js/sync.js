/* GymLogger prototype — workout autosave queue ("outbox").
   Every change made during an active workout (add/remove exercise, add/edit/
   remove set) is applied to the screen immediately and queued here. The queue:
     • is persisted, so a refresh or closed tab never loses logged sets
     • runs one request at a time, in order (set numbers stay correct)
     • pauses while offline and resumes automatically
     • carries an Idempotency-Key on creates, so a retried request can never
       create a duplicate set or exercise
     • coalesces rapid edits to the same set into one request
     • only runs operations that belong to the signed-in user
   Screens subscribe to events to show "Saving… / Saved / Offline / Retry". */
(function (G) {
  'use strict';
  const U = G.U;
  const Api = G.Api;
  const KEY = 'gymlogger.proto.outbox';

  let store = U.store.get(KEY, null) || { ops: [], idMap: {} };
  let inflight = null;
  let status = 'idle'; // idle | saving | offline | error
  let lastError = null;
  let retryTimer = null;
  const subs = new Set();

  const save = () => U.store.set(KEY, store);
  const emit = (e) => subs.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });
  const me = () => (Api.user ? Api.user.id : null);
  const mine = () => store.ops.filter((o) => o.userId === me());
  const resolve = (k) => store.idMap[k] || k;
  const same = (a, b) => a === b || resolve(a) === resolve(b);
  const offline = () => (G.MockApi && G.MockApi.network.mode === 'offline') || navigator.onLine === false;

  function setStatus(s, err) {
    status = s; lastError = err || null;
    emit({ type: 'status', status: s, error: lastError });
  }
  function scheduleRetry(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(kick, ms || 4000);
  }

  function enqueue(op) {
    op.opId = U.uid('op');
    op.userId = me();
    const queued = (o) => o !== inflight && o.userId === op.userId;

    if (op.type === 'updateSet') {
      const add = store.ops.find((o) => queued(o) && o.type === 'addSet' && o.tempId === op.setKey);
      if (add) { add.count = op.count; save(); emit({ type: 'queued', op: add }); kick(); return; }
      const upd = store.ops.find((o) => queued(o) && o.type === 'updateSet' && same(o.setKey, op.setKey));
      if (upd) { upd.count = op.count; save(); emit({ type: 'queued', op: upd }); kick(); return; }
    }
    if (op.type === 'deleteSet') {
      const add = store.ops.find((o) => queued(o) && o.type === 'addSet' && o.tempId === op.setKey);
      // Set never reached the server: drop its create and edits, nothing to send.
      store.ops = store.ops.filter((o) => !(queued(o) && ((o.type === 'addSet' && o.tempId === op.setKey) || (o.type === 'updateSet' && same(o.setKey, op.setKey)))));
      if (add) { save(); emit({ type: 'dropped', op }); kick(); return; }
    }
    if (op.type === 'removeExercise') {
      const add = store.ops.find((o) => queued(o) && o.type === 'addExercise' && o.tempWeId === op.weKey);
      store.ops = store.ops.filter((o) => !(queued(o) && ((o.type === 'addExercise' && o.tempWeId === op.weKey) || (o.weKey && same(o.weKey, op.weKey)))));
      if (add) { save(); emit({ type: 'dropped', op }); kick(); return; }
    }
    store.ops.push(op);
    save();
    emit({ type: 'queued', op });
    kick();
  }

  function exec(op) {
    switch (op.type) {
      case 'addExercise': return Api.addExercise(op.workoutId, op.exerciseId, op.key);
      case 'removeExercise': return Api.removeExercise(resolve(op.weKey));
      case 'addSet': return Api.addSet(resolve(op.weKey), op.count, op.key);
      case 'updateSet': return Api.updateSet(resolve(op.setKey), op.count);
      case 'deleteSet': return Api.deleteSet(resolve(op.setKey));
      default: return Promise.resolve(null);
    }
  }

  async function kick() {
    clearTimeout(retryTimer);
    if (inflight) return;
    const op = mine()[0];
    if (!op) { if (status !== 'idle') setStatus('idle'); return; }
    if (offline()) { setStatus('offline'); scheduleRetry(); return; }
    inflight = op;
    setStatus('saving');
    try {
      const res = await exec(op);
      if (op.type === 'addSet' && res) store.idMap[op.tempId] = res.id;
      if (op.type === 'addExercise' && res) store.idMap[op.tempWeId] = res.id;
      store.ops = store.ops.filter((o) => o !== op);
      inflight = null;
      save();
      emit({ type: 'done', op, res });
      kick();
    } catch (e) {
      inflight = null;
      if (e.network) { setStatus('offline', e); scheduleRetry(); return; }
      if (e.status === 401) { setStatus('error', e); return; } // resumes after sign-in
      if (!e.status || e.status >= 500 || e.status === 429) { setStatus('error', e); scheduleRetry(6000); return; }
      // 4xx: this change can never succeed as sent. Drop it and let the screen explain.
      store.ops = store.ops.filter((o) => o !== op);
      save();
      emit({ type: 'rejected', op, error: e });
      kick();
    }
  }

  const Sync = {
    enqueue,
    kick,
    resolve,
    same,
    get status() { return status; },
    get lastError() { return lastError; },
    pending: (workoutId) => mine().filter((o) => o.workoutId === workoutId),
    isPending: (workoutId, key) => mine().some((o) => o.workoutId === workoutId && ((o.setKey && same(o.setKey, key)) || (o.tempId && same(o.tempId, key)) || (o.type === 'addExercise' && same(o.tempWeId, key)))),
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** Resolves once every queued change for the workout is saved. Rejects if offline or failing. */
    drain(workoutId) {
      return new Promise((res, rej) => {
        const check = () => {
          if (!Sync.pending(workoutId).length) { off(); res(); return true; }
          if (status === 'offline') { off(); rej(Object.assign(new Error("You're offline. Your sets are safe on this device; finish the workout when you're back online."), { network: true })); return true; }
          if (status === 'error') { off(); rej(new Error((lastError && lastError.message) || "Some changes couldn't be saved. Try again.")); return true; }
          return false;
        };
        const off = Sync.on(check);
        kick(); // retry now rather than waiting for the back-off timer
        check();
      });
    },
    forget(workoutId) { store.ops = store.ops.filter((o) => o.workoutId !== workoutId); save(); },
  };

  if (G.MockApi) G.MockApi.onChange((n) => { if (n.mode !== 'offline' && status === 'offline') kick(); });
  window.addEventListener('online', kick);
  setTimeout(kick, 500); // resume anything left from a previous visit

  G.Sync = Sync;
})(window.GL = window.GL || {});
