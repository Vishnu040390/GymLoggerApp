/* GymLogger — end-to-end smoke test of the Phase 1 acceptance scenario (spec §58)
   plus same-day separation (§30), user isolation (§26), role protection (§28),
   offline autosave (§36) and responsive layout (§19).

   The same UI runs in two modes, and so does this test:
     node prototype/tests/e2e-smoke.cjs [screenshotDir]                  prototype (mock API, file://)
     BASE_URL=http://localhost:5039 node prototype/tests/e2e-smoke.cjs     real app (ASP.NET Core + database,
                                                                          started in Development with demo data)
   Needs Playwright with Chromium (npm i -D playwright, or a global install). */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const REAL = !!BASE_URL;
const ROOT = REAL ? BASE_URL + '/' : 'file://' + path.resolve(__dirname, '..', 'index.html');
const RUN = Date.now().toString(36); // unique names so the real database can be reused between runs
const SHOTS = process.argv[2] || null;
const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // offline-safe
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Network logs for expected 4xx responses (wrong password, 404 for another user's data) are not JavaScript errors.
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
  const setOffline = async (on) => {
    if (REAL) await ctx.setOffline(on);
    else await page.evaluate((m) => window.GL.MockApi.setNetwork({ mode: m }), on ? 'offline' : 'normal');
  };
  const login = async (email, pw) => {
    await page.evaluate(async () => {
      if (window.GL.Api.user) { try { await window.GL.Api.logout(); } catch (e) { /* already signed out */ } }
      window.GL.Api.clearAuth();
      location.hash = '#/login';
    });
    await page.waitForSelector('#login-email');
    await page.fill('#login-email', email);
    await page.fill('#login-password', pw);
    await page.click('form button[type="submit"]');
  };

  console.log('Mode: ' + (REAL ? 'real app at ' + BASE_URL : 'prototype (mock API)'));
  // Another user's workout id, for the isolation check.
  let otherWorkoutId = 'ws-other-1';
  if (REAL) {
    const { request } = require('playwright');
    const api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Requested-With': 'XMLHttpRequest' } });
    await api.post('/api/v1/auth/login', { data: { email: 'other@gymlogger.test', password: 'Other@1234' } });
    otherWorkoutId = (await (await api.get('/api/v1/workouts?pageSize=1')).json()).data.items[0].id;
    await api.dispose();
  }

  console.log('Authentication');
  await page.goto(ROOT);
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(ROOT + '#/login');
  await page.waitForSelector('#login-email');
  await shot('01-login');
  await page.click('form button[type="submit"]');
  ok(await page.locator('.field-error').count() >= 1, 'empty sign-in shows field errors');
  await login('demo@gymlogger.test', 'wrong');
  await page.waitForSelector('.form-error');
  ok((await page.textContent('.form-error')).includes('incorrect'), 'wrong password is rejected with a generic message');
  await login('inactive@gymlogger.test', 'Inactive@1234');
  await page.waitForSelector('.form-error');
  ok((await page.textContent('.form-error')).includes('inactive'), 'inactive account is rejected');

  await go('#/register');
  await page.fill('#reg-name', 'Test Lifter');
  await page.fill('#reg-email', 'demo@gymlogger.test');
  await page.fill('#reg-password', 'weak');
  ok(await page.locator('.rules li.ok').count() === 1, 'password rules update live');
  await page.fill('#reg-password', 'Strong@123');
  await page.fill('#reg-confirm', 'Strong@123');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('.field-error');
  ok((await page.textContent('.field-error')).includes('already exists'), 'duplicate email is rejected on the email field');
  await page.fill('#reg-email', 'new.lifter.' + RUN + '@example.com');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('.banner--success');
  ok(page.url().includes('registered=1'), 'registration redirects to sign in');
  await page.fill('#login-password', 'Strong@123');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('.hero-card');
  ok(true, 'new account signs in and lands on Today');

  console.log('Workout logging (as demo user)');
  await login('demo@gymlogger.test', 'Demo@1234');
  await page.waitForSelector('.hero-card');
  await shot('02-today');
  await page.click('[data-start]');
  await page.waitForSelector('dialog[open]');
  await page.click('dialog[open] .btn-primary');
  await page.waitForSelector('.wk-header');
  ok(page.url().includes('#/workout/'), 'workout starts and opens the focused workout screen');
  ok(await page.locator('.tabbar').count() === 0, 'no global navigation during an active workout');

  const addExercise = async (term, name) => {
    await page.click('[data-add-ex]');
    await page.waitForSelector('dialog[open] [data-q]');
    await page.fill('dialog[open] [data-q]', term);
    await page.waitForTimeout(200);
    await page.click('dialog[open] [data-pick] >> text=' + name);
    await page.waitForSelector('.ex-card h2 >> text=' + name);
  };
  const addSets = async (name, counts) => {
    const card = page.locator('.ex-card', { has: page.locator('h2', { hasText: name }) });
    for (const c of counts) {
      await card.locator('[data-add-set]').click();
      const input = card.locator('[data-count]').last();
      await input.fill(String(c));
      await input.press('Enter');
    }
  };
  await addExercise('bench', 'Bench Press');
  await addSets('Bench Press', [16, 13, 10]);
  await addExercise('squat', 'Back Squat');
  await addSets('Back Squat', [10, 9]);
  await page.waitForSelector('.save-state--saved', { timeout: 8000 });
  ok(true, 'sets autosave ("All changes saved")');
  await shot('03-workout');

  console.log('Offline autosave');
  const squatSets = () => page.locator('.ex-card', { has: page.locator('h2', { hasText: 'Back Squat' }) }).locator('[data-count]').count();
  await setOffline(true);
  await addSets('Back Squat', [8]);
  await page.waitForSelector('.save-state--offline', { timeout: 5000 });
  ok(true, 'offline change is queued and shown as waiting');
  ok(await page.locator('.net-banner:not([hidden])').count() === 1, 'offline banner is visible');
  if (!REAL) {
    // The prototype page can reload while "offline"; a real offline browser cannot fetch the page.
    await page.reload();
    await page.waitForSelector('.wk-header');
    ok(await squatSets() === 3, 'queued set survives a page refresh while offline');
  }
  await setOffline(false);
  await page.waitForSelector('.save-state--saved', { timeout: 10000 });
  ok(true, 'queue syncs after reconnecting');
  if (REAL) {
    await page.reload();
    await page.waitForSelector('.wk-header');
    ok(await squatSets() === 3, 'synced sets are stored on the server (3 after reload)');
  }

  console.log('Finish + second same-day session');
  await page.click('[data-finish]');
  await page.waitForSelector('dialog[open] >> text=Finish workout?');
  await page.click('dialog[open] .btn-primary');
  await page.waitForSelector('.summary-hero');
  ok(page.url().includes('/summary'), 'finishing shows the workout-complete summary');
  await shot('04-summary');
  const firstId = page.url().split('/workout/')[1].split('/')[0];

  await page.click('[data-again]');
  await page.waitForSelector('dialog[open]');
  await page.check('dialog[open] input[value="compare"]');
  await page.waitForSelector('dialog[open] input[name="ref-session"]');
  await page.check('dialog[open] input[name="ref-session"][value="' + firstId + '"]');
  await page.click('dialog[open] .btn-primary');
  await page.waitForSelector('.ref-banner');
  ok(true, 'second session starts with the first as its comparison');
  await page.click('[data-quick-add]:has-text("Bench Press")');
  await page.waitForSelector('.ex-card .ex-compare.hist');
  await addSets('Bench Press', [17]);
  const firstVal = await page.locator('.ex-card [data-count]').first().inputValue();
  ok(firstVal === '17', 'count entry works in the second session');
  ok(await page.locator('.prev-val').first().textContent() === 'Previous 16', 'previous value from the earlier same-day session is shown');
  ok((await page.locator('.delta--up').first().textContent()).includes('+1'), 'delta +1 shown with icon and sign');
  await shot('05-workout-compare');
  await page.waitForSelector('.save-state--saved', { timeout: 8000 });
  await page.click('[data-finish]');
  await page.waitForSelector('dialog[open] >> text=Finish workout?');
  await page.click('dialog[open] .btn-primary');
  await page.waitForSelector('.summary-hero');

  console.log('History, comparison and analytics');
  const benchId = await page.evaluate(async () => (await window.GL.Api.exercises({ search: 'Bench Press' })).items.find((x) => x.name === 'Bench Press').id);
  await go('#/exercise/' + benchId + '?tab=history');
  await page.waitForSelector('.day-group');
  const todayGroup = await page.locator('.day-group').first().textContent();
  ok(todayGroup.includes('2 separate sessions'), 'same-day sessions are listed separately in exercise history');
  await shot('06-exercise-history');
  await go('#/exercise/' + benchId + '/compare');
  await page.waitForSelector('.cmp-table');
  ok(await page.locator('.cmp-table tbody tr').count() >= 1, 'compare view renders set-by-set table');
  await go('#/exercise/' + benchId + '?tab=progress');
  await page.waitForSelector('[data-line] svg');
  ok(await page.locator('.series-line').count() === 1, 'progress chart renders');
  await shot('07-progress');
  await go('#/history');
  await page.waitForSelector('.session-card');
  await shot('08-history');

  console.log('Security & roles');
  await go('#/history/' + otherWorkoutId);
  await page.waitForSelector('h1');
  ok((await page.textContent('h1')).includes("can't find"), "another user's workout is not found");
  await go('#/admin/exercises');
  await page.waitForSelector('h1');
  ok((await page.textContent('h1')).includes("don't have access"), 'non-admin is blocked from admin pages');

  console.log('Admin');
  await login('admin@gymlogger.test', 'Admin@1234');
  await page.waitForSelector('#main h1 >> text=Exercise management');
  await shot('09-admin-list');
  await go('#/admin/exercises/new');
  await page.waitForSelector('#f-name');
  await page.click('.sticky-save button[type="submit"]');
  ok(await page.locator('.field-error').count() >= 4, 'required fields are validated');
  await page.fill('#f-name', 'Bench Press');
  await page.selectOption('#f-categoryId', { label: 'Chest' });
  await page.selectOption('#f-muscleGroupId', { label: 'Chest' });
  await page.selectOption('#f-equipmentId', { label: 'Barbell' });
  await page.click('.sticky-save button[type="submit"]');
  await page.waitForSelector('.field-error >> text=already exists');
  ok(true, 'duplicate exercise name is rejected');
  await page.fill('#f-name', 'Cable Fly ' + RUN);
  await page.fill('#f-inst', 'Set the pulleys high.\nBring the handles together.');
  await page.click('.sticky-save button[type="submit"]');
  await page.waitForSelector('[data-media-section] .dropzone');
  ok(page.url().includes('created=1'), 'exercise is created and media upload becomes available');
  await page.setInputFiles('[data-file]', [{ name: 'fly.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') }, { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') }]);
  await page.waitForSelector('.media-card[data-m]');
  ok(await page.locator('.upload-errors .banner--error').count() === 1, 'unsupported file is rejected, image is accepted');
  await shot('10-admin-editor');

  console.log('Responsive layout (no horizontal scroll)');
  await login('demo@gymlogger.test', 'Demo@1234');
  await page.waitForSelector('.hero-card');
  const routes = ['#/', '#/history', '#/progress', '#/library', '#/exercise/' + benchId + '?tab=progress', '#/exercise/' + benchId + '/compare', '#/profile'];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    const bad = [];
    for (const r of routes) {
      await go(r);
      await page.waitForSelector('#main h1', { timeout: 5000 });
      await page.waitForTimeout(450);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) bad.push(r + ' (+' + over + 'px)');
    }
    ok(!bad.length, w + 'px: ' + (bad.length ? 'overflow on ' + bad.join(', ') : 'all screens fit'));
  }
  // Active workout at the narrowest width
  await page.setViewportSize({ width: 320, height: 700 });
  await go('#/');
  await page.waitForSelector('[data-start]');
  await page.click('[data-start]');
  await page.click('dialog[open] input[value="compare"]');
  await page.waitForSelector('dialog[open] input[name="ref-session"]');
  await page.click('dialog[open] .btn-primary');
  await page.waitForSelector('.ref-banner');
  await page.click('[data-quick-add]:has-text("Bench Press")');
  await page.waitForSelector('.ex-card .ex-compare.hist');
  await addSets('Bench Press', [18, 14]);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 1, '320px: active workout with comparison fits (' + over + 'px overflow)');
  await shot('11-workout-320');

  ok(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
