/* Screens: SCR-AUTH-01 Sign in · SCR-AUTH-02 Create account */
(function (G) {
  'use strict';
  const { U, UI, Api, Domain: D, App } = G;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});

  function passwordField(id, name, label, autocomplete, describedBy) {
    return '<div class="field"><label for="' + id + '">' + label + '<span class="req" aria-hidden="true">*</span></label>' +
      '<div class="input-wrap input-wrap--action">' + icon('lock') +
      '<input class="input" id="' + id + '" name="' + name + '" type="password" autocomplete="' + autocomplete + '" required aria-required="true"' + (describedBy ? ' aria-describedby="' + describedBy + '"' : '') + '>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm input-action" data-reveal="' + id + '" aria-label="Show password" aria-pressed="false">' + icon('eye') + '</button></div></div>';
  }
  function bindReveal(root) {
    U.$$('[data-reveal]', root).forEach((b) => b.addEventListener('click', () => {
      const input = document.getElementById(b.dataset.reveal);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      b.innerHTML = icon(show ? 'eye-off' : 'eye');
    }));
  }

  /* ---- SCR-AUTH-01 Sign in ------------------------------------------------ */
  V.login = ({ main, query }) => {
    App.title('Sign in');
    const notices = [];
    if (query.expired) notices.push('<div class="banner banner--warn" role="status">' + icon('lock') + '<div class="grow"><b>Your session has expired.</b><span>Sign in again to continue. Anything you logged during a workout is saved.</span></div></div>');
    if (query.registered) notices.push('<div class="banner banner--success" role="status">' + icon('check') + '<div class="grow"><b>Account created.</b><span>Sign in with your new email and password.</span></div></div>');
    if (query.signedout) notices.push('<div class="banner banner--info" role="status">' + icon('logout') + '<div class="grow"><span>You have signed out.</span></div></div>');
    main.innerHTML =
      '<div class="stack-lg">' +
      '<div class="stack-sm"><p class="eyebrow">Welcome back</p><h1>Sign in</h1><p class="muted">Log today\'s workout and see how it compares with last time.</p></div>' +
      notices.join('') +
      '<form class="form" novalidate>' +
      '<div class="field"><label for="login-email">Email<span class="req" aria-hidden="true">*</span></label>' +
      '<div class="input-wrap">' + icon('mail') + '<input class="input" id="login-email" name="email" type="email" inputmode="email" autocomplete="email" required aria-required="true" value="' + esc(query.email || '') + '"></div></div>' +
      passwordField('login-password', 'password', 'Password', 'current-password') +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>' +
      '</form>' +
      '<p class="muted">New to GymLogger? <a href="#/register">Create an account</a></p>' +
      (G.ACCOUNTS ? '<section class="card demo-accounts" aria-labelledby="demo-h"><div class="card-head"><h2 class="card-title" id="demo-h">Demo accounts</h2><span class="badge badge--warn">Prototype only</span></div>' +
      '<ul class="list">' + G.ACCOUNTS.map((a, i) => '<li class="list-item"><div class="grow"><b>' + esc(a.label) + '</b><div class="small muted">' + esc(a.email) + ' · ' + esc(a.password) + '</div></div><button type="button" class="btn btn-sm" data-fill="' + i + '">Use</button></li>').join('') +
      '<li class="list-item"><div class="grow"><b>Inactive account</b><div class="small muted">inactive@gymlogger.test · Inactive@1234</div></div><button type="button" class="btn btn-sm" data-fill-inactive>Use</button></li></ul></section>' : '') +
      '</div>';
    const form = main.querySelector('form');
    bindReveal(main);
    const fill = (email, pw) => { form.email.value = email; form.password.value = pw; form.querySelector('[type="submit"]').focus(); };
    U.$$('[data-fill]', main).forEach((b) => b.addEventListener('click', () => { const a = G.ACCOUNTS[Number(b.dataset.fill)]; fill(a.email, a.password); }));
    const inactive = main.querySelector('[data-fill-inactive]');
    if (inactive) inactive.addEventListener('click', () => fill('inactive@gymlogger.test', 'Inactive@1234'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = {};
      const emailErr = D.validateEmail(form.email.value);
      if (emailErr) errors.email = emailErr;
      if (!form.password.value) errors.password = 'Enter your password.';
      if (Object.keys(errors).length) { UI.showFieldErrors(form, errors); return; }
      UI.clearFieldErrors(form);
      const btn = form.querySelector('[type="submit"]');
      UI.busy(btn, true, 'Signing in…');
      try {
        await Api.login(form.email.value, form.password.value);
        G.Sync.kick();
        const next = query.next && !/^\/(login|register)/.test(query.next) ? query.next : (Api.isAdmin ? '/admin/exercises' : '/');
        U.go(next);
      } catch (err) {
        UI.busy(btn, false);
        UI.formError(form, err.message);
        if (err.status === 401) { form.password.value = ''; form.password.focus(); } else form.email.focus();
      }
    });
  };

  /* ---- SCR-AUTH-02 Create account --------------------------------------------- */
  V.register = ({ main }) => {
    App.title('Create account');
    main.innerHTML =
      '<div class="stack-lg">' +
      '<div class="stack-sm"><p class="eyebrow">Get started</p><h1>Create account</h1><p class="muted">Sign up with your email. Google and Apple sign-in are planned for a later release.</p></div>' +
      '<form class="form" novalidate>' +
      '<div class="field"><label for="reg-name">Your name<span class="req" aria-hidden="true">*</span></label><input class="input" id="reg-name" name="displayName" autocomplete="name" required aria-required="true" maxlength="50"><p class="hint" id="reg-name-hint">Shown on your profile. You can change it later.</p></div>' +
      '<div class="field"><label for="reg-email">Email<span class="req" aria-hidden="true">*</span></label><div class="input-wrap">' + icon('mail') + '<input class="input" id="reg-email" name="email" type="email" inputmode="email" autocomplete="email" required aria-required="true"></div></div>' +
      passwordField('reg-password', 'password', 'Password', 'new-password', 'reg-rules') +
      '<ul class="rules" id="reg-rules" aria-label="Password requirements">' + D.passwordRules('').map((r) => '<li data-rule="' + r.id + '">' + icon('x') + '<span>' + esc(r.label) + '</span></li>').join('') + '</ul>' +
      passwordField('reg-confirm', 'confirm', 'Confirm password', 'new-password') +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>' +
      '</form><p class="muted">Already have an account? <a href="#/login">Sign in</a></p></div>';
    const form = main.querySelector('form');
    form.displayName.setAttribute('aria-describedby', 'reg-name-hint');
    bindReveal(main);
    const rules = main.querySelector('#reg-rules');
    form.password.addEventListener('input', () => {
      D.passwordRules(form.password.value).forEach((r) => {
        const li = rules.querySelector('[data-rule="' + r.id + '"]');
        li.classList.toggle('ok', r.ok);
        li.innerHTML = icon(r.ok ? 'check' : 'x') + '<span>' + esc(r.label) + '<span class="sr-only">' + (r.ok ? ' — met' : ' — not met') + '</span></span>';
      });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = {};
      const n = D.validateDisplayName(form.displayName.value); if (n) errors.displayName = n;
      const m = D.validateEmail(form.email.value); if (m) errors.email = m;
      const p = D.validatePassword(form.password.value); if (p) errors.password = p;
      if (!form.confirm.value) errors.confirm = 'Enter your password again.';
      else if (form.confirm.value !== form.password.value) errors.confirm = 'Passwords do not match.';
      if (Object.keys(errors).length) { UI.showFieldErrors(form, errors); return; }
      UI.clearFieldErrors(form);
      const btn = form.querySelector('[type="submit"]');
      UI.busy(btn, true, 'Creating account…');
      try {
        await Api.register({ displayName: form.displayName.value, email: form.email.value, password: form.password.value });
        U.go('/login' + U.qs({ registered: 1, email: form.email.value.trim() }));
      } catch (err) {
        UI.busy(btn, false);
        UI.applyApiError(form, err);
      }
    });
  };
})(window.GL);
