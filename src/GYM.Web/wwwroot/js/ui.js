/* GymLogger prototype — reusable UI components.
   Every component returns an HTML string (data escaped with U.esc) or wires
   behaviour onto an element. The names map 1:1 to the component inventory in
   docs/ui-ux/04-design-system.md so they can be rebuilt as Razor partials /
   tag helpers (Phase 1) or React components (Phase 2). */
(function (G) {
  'use strict';
  const U = G.U;
  const esc = U.esc;
  const icon = G.icon;
  const UI = {};

  /* ---- Status & change ------------------------------------------------------ */
  const STATUS_TEXT = { InProgress: 'In progress', Completed: 'Completed', Cancelled: 'Cancelled' };
  UI.statusBadge = (status) => {
    if (status === 'InProgress') return '<span class="badge badge--live"><span class="dot" aria-hidden="true"></span>In progress</span>';
    if (status === 'Completed') return '<span class="badge badge--done">' + icon('check') + 'Completed</span>';
    if (status === 'Cancelled') return '<span class="badge badge--void">' + icon('ban') + 'Cancelled</span>';
    return '<span class="badge">' + esc(STATUS_TEXT[status] || status) + '</span>';
  };
  UI.activeBadge = (isActive) => isActive
    ? '<span class="badge badge--active">' + icon('check') + 'Active</span>'
    : '<span class="badge badge--inactive">' + icon('eye-off') + 'Inactive</span>';

  /** Change indicator. Direction is carried by icon + sign + text, not colour. */
  UI.delta = (n, opts) => {
    const o = opts || {};
    const unit = o.unit ? ' ' + o.unit : '';
    if (n == null) return '<span class="delta delta--none" title="No comparison">—<span class="sr-only"> no comparison</span></span>';
    if (n > 0) return '<span class="delta delta--up">' + icon('arrow-up') + '+' + n + unit + '<span class="sr-only"> more than previous</span></span>';
    if (n < 0) return '<span class="delta delta--down">' + icon('arrow-down') + '−' + Math.abs(n) + unit + '<span class="sr-only"> fewer than previous</span></span>';
    return '<span class="delta delta--same">' + icon('equal') + '0' + unit + '<span class="sr-only"> same as previous</span></span>';
  };

  /* ---- Session naming -------------------------------------------------------- */
  UI.sessionName = (s) => U.fmtShort(s.workoutDate) + ' — ' + s.label;
  UI.sessionTime = (s) => U.fmtTime(s.startTime) + (s.endTime ? '–' + U.fmtTime(s.endTime) : '');

  /* ---- Media ------------------------------------------------------------------ */
  UI.thumb = (media, exercise, cls) => {
    const src = G.media.src(media, exercise, true);
    const alt = ''; // decorative: the exercise name is always shown next to the thumbnail
    return '<span class="' + (cls || 'ex-thumb') + '"><img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" data-fallback></span>';
  };

  /* ---- Layout pieces ------------------------------------------------------------- */
  UI.pageHead = (o) => '<header class="page-head"><div class="grow">' +
    (o.back ? '<a class="back-link" href="' + esc(o.back.href) + '">' + icon('chevron-left') + esc(o.back.label) + '</a>' : '') +
    (o.eyebrow ? '<p class="eyebrow">' + esc(o.eyebrow) + '</p>' : '') +
    '<h1 tabindex="-1">' + esc(o.title) + '</h1>' +
    (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') +
    '</div>' + (o.actions ? '<div class="row">' + o.actions + '</div>' : '') + '</header>';

  UI.stat = (o) => '<div class="stat"><span class="stat-label">' + esc(o.label) + '</span>' +
    '<span class="stat-value">' + o.value + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</span>' +
    (o.foot ? '<span class="stat-foot">' + o.foot + '</span>' : '') + '</div>';

  /* ---- States ------------------------------------------------------------------- */
  UI.empty = (o) => '<div class="state' + (o.compact ? ' state--compact' : '') + '">' +
    '<span class="state-icon">' + icon(o.icon || 'info') + '</span>' +
    '<h2>' + esc(o.title) + '</h2>' + (o.text ? '<p>' + o.text + '</p>' : '') +
    (o.action || '') + '</div>';

  UI.errorState = (err, o) => {
    const opts = o || {};
    const offline = err && err.network;
    return '<div class="state state--error" role="alert">' +
      '<span class="state-icon">' + icon(offline ? 'wifi-off' : 'alert-circle') + '</span>' +
      '<h2>' + esc(opts.title || (offline ? "You're offline" : "We couldn't load this")) + '</h2>' +
      '<p>' + esc(err && err.message ? err.message : 'Something went wrong. Try again.') + '</p>' +
      '<button class="btn btn-primary" type="button" data-action="retry">' + icon('refresh') + 'Try again</button></div>';
  };

  UI.skeleton = (kind) => {
    if (kind === 'list') {
      return '<div class="stack" aria-busy="true" aria-label="Loading">' + [1, 2, 3].map(() => '<div class="skeleton sk-card"></div>').join('') + '</div>';
    }
    return '<div class="stack" aria-busy="true" aria-label="Loading">' +
      '<div class="skeleton sk-title"></div><div class="skeleton sk-line" style="width:60%"></div>' +
      '<div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>';
  };

  /** Render a loading skeleton, run loader, render result or an error with retry. */
  UI.load = async (el, loader, render, skeletonKind) => {
    el.innerHTML = UI.skeleton(skeletonKind);
    try {
      const data = await loader();
      await render(data);
    } catch (e) {
      if (e && e.status === 401) return; // app redirects to sign in
      if (e && (e.status === 404 || e.status === 403) && !e.network) { G.App.showNotFound(e); return; }
      el.innerHTML = UI.errorState(e);
      el.querySelector('[data-action="retry"]').addEventListener('click', () => UI.load(el, loader, render, skeletonKind));
      if (!(e instanceof G.Api.ApiError)) console.error(e);
    }
  };

  /* ---- Buttons ------------------------------------------------------------------ */
  UI.busy = (btn, on, label) => {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + esc(label || 'Saving…');
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };

  /* ---- Toasts ------------------------------------------------------------------- */
  let toastHost = null;
  UI.toast = (message, o) => {
    const opts = o || {};
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    toastHost.classList.toggle('toasts--raised', !!document.querySelector('.shell--focus'));
    const t = document.createElement('div');
    t.className = 'toast' + (opts.type === 'error' ? ' toast--error' : '');
    if (opts.type === 'error') t.setAttribute('role', 'alert');
    t.innerHTML = icon(opts.type === 'error' ? 'alert-circle' : opts.icon || 'check') + '<span class="grow"></span>';
    t.querySelector('.grow').textContent = message;
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { remove(); opts.action.onClick(); });
      t.appendChild(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = icon('x');
    x.addEventListener('click', () => remove());
    t.appendChild(x);
    toastHost.appendChild(t);
    const timer = setTimeout(() => remove(), opts.duration || (opts.action ? 7000 : 4000));
    function remove() { clearTimeout(timer); t.remove(); }
    return remove;
  };

  /* ---- Dialogs (native <dialog>: focus trap, Esc, inert background) ----------- */
  UI.dialog = (o) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg' + (o.size === 'wide' ? ' dlg--wide' : '') + (o.full ? ' dlg--full' : '');
    const tid = U.uid('dlg');
    dlg.setAttribute('aria-labelledby', tid);
    dlg.innerHTML = '<div class="dlg-head"><div><h2 id="' + tid + '"></h2>' + (o.description ? '<p></p>' : '') + '</div>' +
      '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-close aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="dlg-body"></div>' + (o.actions && o.actions.length ? '<div class="dlg-foot"></div>' : '');
    dlg.querySelector('h2').textContent = o.title;
    if (o.description) dlg.querySelector('.dlg-head p').textContent = o.description;
    const body = dlg.querySelector('.dlg-body');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);

    const api = {
      el: dlg, body,
      close(value) { if (dlg.open) dlg.close(value || ''); },
      error(msg) {
        let b = body.querySelector(':scope > .dlg-error');
        if (!msg) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.className = 'banner banner--error dlg-error'; b.setAttribute('role', 'alert'); body.prepend(b); }
        b.innerHTML = icon('alert-circle') + '<span class="grow"></span>';
        b.querySelector('.grow').textContent = msg;
      },
      buttons: [],
    };

    (o.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + ({ primary: 'btn-primary', danger: 'btn-danger', ghost: 'btn-ghost', hist: 'btn-hist' }[a.variant] || '');
      b.innerHTML = (a.icon ? icon(a.icon) : '') + esc(a.label);
      if (a.autofocus) b.autofocus = true;
      b.addEventListener('click', async () => {
        if (!a.onClick) { api.close(a.value || a.label); return; }
        api.error(null);
        UI.busy(b, true, a.busyLabel);
        api.buttons.forEach((x) => { if (x !== b) x.disabled = true; });
        try {
          const keepOpen = await a.onClick(api);
          if (keepOpen !== false) api.close(a.value || 'ok');
        } catch (e) {
          api.error(e && e.message ? e.message : 'Something went wrong. Try again.');
        } finally {
          if (dlg.open) { UI.busy(b, false); api.buttons.forEach((x) => { x.disabled = false; }); }
        }
      });
      api.buttons.push(b);
      dlg.querySelector('.dlg-foot').appendChild(b);
    });

    dlg.querySelector('[data-close]').addEventListener('click', () => api.close('dismiss'));
    dlg.addEventListener('click', (e) => { if (e.target === dlg && o.dismissible !== false) api.close('dismiss'); });
    dlg.addEventListener('cancel', (e) => { if (o.dismissible === false) e.preventDefault(); });
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue;
      dlg.remove();
      if (o.onClose) o.onClose(v);
      if (o.returnFocus && document.contains(o.returnFocus)) o.returnFocus.focus();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    const af = dlg.querySelector('[autofocus]');
    if (af) af.focus();
    return api;
  };

  UI.confirm = (o) => new Promise((resolve) => {
    UI.dialog({
      title: o.title,
      body: '<p>' + esc(o.message) + '</p>' + (o.extra || ''),
      actions: [
        { label: o.cancelLabel || 'Cancel', value: 'cancel' },
        { label: o.confirmLabel || 'Confirm', variant: o.danger ? 'danger' : 'primary', value: 'ok', autofocus: !o.danger },
      ],
      returnFocus: o.returnFocus,
      onClose: (v) => resolve(v === 'ok'),
    });
  });

  /* ---- Menu (popover with keyboard support) -------------------------------------- */
  UI.menu = (button, items) => {
    const wrap = button.parentElement;
    wrap.classList.add('menu-wrap');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    let menu = null;
    const close = (focusBack) => {
      if (!menu) return;
      menu.remove(); menu = null;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      if (focusBack) button.focus();
    };
    const outside = (e) => { if (menu && !menu.contains(e.target) && e.target !== button && !button.contains(e.target)) close(false); };
    button.addEventListener('click', () => {
      if (menu) { close(true); return; }
      menu = document.createElement('div');
      menu.className = 'menu';
      menu.setAttribute('role', 'menu');
      (typeof items === 'function' ? items() : items).forEach((it) => {
        if (it.divider) { menu.appendChild(document.createElement('hr')); return; }
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.tabIndex = -1;
        if (it.danger) b.className = 'danger';
        b.innerHTML = (it.icon ? icon(it.icon) : '') + '<span></span>';
        b.querySelector('span').textContent = it.label;
        b.addEventListener('click', () => { close(false); it.onClick(); });
        menu.appendChild(b);
      });
      const r = button.getBoundingClientRect();
      if (r.bottom + 260 > window.innerHeight && r.top > 260) { menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 6px)'; }
      wrap.appendChild(menu);
      button.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('[role="menuitem"]');
      if (first) first.focus();
      menu.addEventListener('keydown', (e) => {
        const list = U.$$('[role="menuitem"]', menu);
        const i = list.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
        if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
        if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
        if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true); }
      });
      setTimeout(() => document.addEventListener('pointerdown', outside, true));
    });
    return { close };
  };

  /* ---- Forms ---------------------------------------------------------------------- */
  UI.clearFieldErrors = (form) => {
    U.$$('.field-error', form).forEach((e) => e.remove());
    U.$$('[aria-invalid]', form).forEach((i) => {
      i.removeAttribute('aria-invalid');
      const orig = i.dataset.describedby;
      if (orig) i.setAttribute('aria-describedby', orig); else i.removeAttribute('aria-describedby');
    });
    const b = form.querySelector(':scope > .form-error');
    if (b) b.remove();
  };
  UI.showFieldErrors = (form, map, summary) => {
    UI.clearFieldErrors(form);
    let first = null;
    Object.keys(map || {}).forEach((field) => {
      const input = form.querySelector('[name="' + field + '"]');
      if (!input) return;
      const holder = input.closest('.field') || input.parentElement;
      const id = (input.id || U.uid('f')) + '-error';
      const p = document.createElement('p');
      p.className = 'field-error';
      p.id = id;
      p.innerHTML = icon('alert-circle') + '<span></span>';
      p.querySelector('span').textContent = map[field];
      holder.appendChild(p);
      if (input.dataset.describedby == null) input.dataset.describedby = input.getAttribute('aria-describedby') || '';
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [input.dataset.describedby, id].filter(Boolean).join(' '));
      if (!first) first = input;
    });
    if (summary) UI.formError(form, summary);
    if (first) first.focus();
  };
  UI.formError = (form, message) => {
    let b = form.querySelector(':scope > .form-error');
    if (!message) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'banner banner--error form-error'; b.setAttribute('role', 'alert'); form.prepend(b); }
    b.innerHTML = icon('alert-circle') + '<span class="grow"></span>';
    b.querySelector('.grow').textContent = message;
  };
  /** Map an ApiError onto a form: field errors inline, message in the banner. */
  UI.applyApiError = (form, err) => {
    const map = err.fieldErrors ? err.fieldErrors() : {};
    const hasFields = Object.keys(map).some((f) => form.querySelector('[name="' + f + '"]'));
    UI.showFieldErrors(form, map, hasFields && err.status === 422 ? null : err.message);
  };

  /* ---- Session card ----------------------------------------------------------------- */
  UI.sessionCard = (s, o) => {
    const opts = o || {};
    const max = opts.maxLines || 3;
    const lines = s.exercises.slice(0, max).map((e) => '<div class="session-line"><span>' + esc(e.name) + '</span><span class="sets">' + esc(U.setsText(e.sets)) + '</span></div>').join('');
    const more = s.exercises.length > max ? '<div class="session-line muted"><span>+' + (s.exercises.length - max) + ' more</span></div>' : '';
    const tag = opts.href ? 'a' : 'div';
    return '<' + tag + ' class="session-card' + (opts.hist ? ' hist' : '') + '"' + (opts.href ? ' href="' + esc(opts.href) + '"' : '') + '>' +
      '<div class="session-top"><div class="grow">' +
      (opts.hist ? '<span class="hist-label">' + icon('history') + 'Previous session</span>' : '') +
      '<div class="session-name">' + esc(opts.title || s.label) + ' <span class="session-meta">· ' + esc(UI.sessionTime(s)) + '</span></div>' +
      '<div class="session-meta">' + (s.durationMs != null ? esc(U.fmtDuration(s.durationMs)) + ' · ' : '') + esc(U.plural(s.totals.exercises, 'exercise')) + ' · ' + esc(U.plural(s.totals.sets, 'set')) + ' · ' + esc(U.fmtNum(s.totals.reps)) + ' reps</div>' +
      '</div>' + (opts.hist ? '' : UI.statusBadge(s.status)) + (opts.href ? icon('chevron-right', { cls: 'chev' }) : '') + '</div>' +
      (s.exercises.length ? '<div class="session-lines">' + lines + more + '</div>' : '<p class="session-meta">No exercises logged.</p>') +
      '</' + tag + '>';
  };

  /* ---- Image fallback for uploads that no longer exist (blob: after reload) ---------- */
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback') && !img.dataset.failed) {
      img.dataset.failed = '1';
      img.src = G.media.placeholder({ mediaType: 'Image', displayOrder: 1 }, null);
    }
  }, true);

  G.UI = UI;
})(window.GL = window.GL || {});
