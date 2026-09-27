/* Unit tests for the prototype's domain rules (the UI's expectations of the backend).
   Run: node --test prototype/tests/domain.test.cjs
   The C# unit tests in GYM.Tests should cover the same cases (spec §25, §30, §31). */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/domain.js');

const sets = (...counts) => counts.map((count, i) => ({ setNumber: i + 1, count }));

test('comparison: spec §25 worked example 15/12/10 → 16/13/10 = +1/+1/0', () => {
  const r = D.compareSets(sets(15, 12, 10), sets(16, 13, 10));
  assert.deepEqual(r.rows.map((x) => x.delta), [1, 1, 0]);
  assert.deepEqual(r.totals, { previous: 37, current: 39, delta: 2, deltaPct: 5.4 });
});

test('comparison: a missing set has no delta (never treated as zero)', () => {
  const r = D.compareSets(sets(15, 12, 10), sets(16, 13));
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.rows[2], { setNumber: 3, previous: 10, current: null, delta: null });
  const r2 = D.compareSets(sets(15), sets(15, 12));
  assert.equal(r2.rows[1].delta, null);
});

test('comparison: order of input sets does not matter', () => {
  const r = D.compareSets([{ setNumber: 2, count: 12 }, { setNumber: 1, count: 15 }], sets(15, 12));
  assert.deepEqual(r.rows.map((x) => x.delta), [0, 0]);
});

test('session label boundaries', () => {
  const at = (h, m) => new Date(2026, 8, 18, h, m || 0);
  assert.equal(D.sessionLabel(at(4)), 'Morning');
  assert.equal(D.sessionLabel(at(11, 59)), 'Morning');
  assert.equal(D.sessionLabel(at(12)), 'Afternoon');
  assert.equal(D.sessionLabel(at(17)), 'Evening');
  assert.equal(D.sessionLabel(at(21)), 'Night');
  assert.equal(D.sessionLabel(at(3, 59)), 'Night');
});

test('ordering: same-day sessions stay separate and sort by start time (newest first)', () => {
  const list = [
    { id: 'eve15', workoutDate: '2026-09-15', startTime: '2026-09-15T17:40:00Z' },
    { id: 'am18', workoutDate: '2026-09-18', startTime: '2026-09-18T06:10:00Z' },
    { id: 'pm18', workoutDate: '2026-09-18', startTime: '2026-09-18T12:30:00Z' },
  ].sort(D.bySessionDesc);
  assert.deepEqual(list.map((x) => x.id), ['pm18', 'am18', 'eve15']);
});

test('analytics: spec §30 same-day sessions are counted separately, never merged', () => {
  const entries = [
    { workoutId: 'eve15', workoutDate: '2026-09-15', startTime: '2026-09-15T17:40:00Z', label: 'Evening', sets: sets(14, 11, 9) },
    { workoutId: 'am18', workoutDate: '2026-09-18', startTime: '2026-09-18T06:10:00Z', label: 'Morning', sets: sets(15, 12, 10) },
    { workoutId: 'pm18', workoutDate: '2026-09-18', startTime: '2026-09-18T12:30:00Z', label: 'Afternoon', sets: sets(12, 10, 8) },
  ];
  const a = D.exerciseAnalytics(entries, { today: '2026-09-27', range: 'all' });
  assert.equal(a.sessionsCount, 3);
  assert.equal(a.distinctDays, 2);
  assert.deepEqual(a.series.map((p) => p.workoutId), ['eve15', 'am18', 'pm18']);
  assert.deepEqual(a.series.map((p) => p.total), [34, 37, 30]);
  assert.equal(a.last.workoutId, 'pm18');
  assert.equal(a.previous.workoutId, 'am18');
  assert.equal(a.totalDelta, -7);
  assert.equal(a.bestSet.count, 15);
  assert.equal(a.weekly.find((w) => w.weekStart === '2026-09-14').sessions, 3);
});

test('analytics: deterministic and empty-safe (§31)', () => {
  const e = [{ workoutId: 'x', workoutDate: '2026-09-01', startTime: '2026-09-01T08:00:00Z', label: 'Morning', sets: sets(10) }];
  assert.deepEqual(D.exerciseAnalytics(e, { today: '2026-09-27' }), D.exerciseAnalytics(e, { today: '2026-09-27' }));
  const empty = D.exerciseAnalytics([], { today: '2026-09-27' });
  assert.equal(empty.sessionsCount, 0);
  assert.equal(empty.last, null);
  assert.equal(empty.totalDelta, null);
});

test('weekStart: weeks start on Monday', () => {
  assert.equal(D.weekStart('2026-09-27'), '2026-09-21'); // Sunday → previous Monday
  assert.equal(D.weekStart('2026-09-21'), '2026-09-21'); // Monday
  assert.equal(D.weekStart('2026-01-01'), '2025-12-29'); // across a year boundary
});

test('validation: set count', () => {
  assert.equal(D.validateCount('12'), null);
  assert.match(D.validateCount(''), /Enter a count/);
  assert.match(D.validateCount('0'), /at least 1/);
  assert.match(D.validateCount('1000'), /999 or less/);
  assert.match(D.validateCount('7.5'), /whole number/);
});

test('validation: email and password policy', () => {
  assert.equal(D.validateEmail('alex@example.com'), null);
  assert.ok(D.validateEmail('alex@'));
  assert.ok(D.validatePassword('password'));
  assert.ok(D.validatePassword('Password'));
  assert.equal(D.validatePassword('Password1'), null);
});

test('validation: media by extension, MIME type and size (§23)', () => {
  assert.equal(D.validateMedia({ name: 'bench.jpg', type: 'image/jpeg', size: 1000 }).kind, 'image');
  assert.equal(D.validateMedia({ name: 'demo.mp4', type: 'video/mp4', size: 1000 }).kind, 'video');
  assert.match(D.validateMedia({ name: 'run.exe', type: 'application/octet-stream', size: 10 }).error, /unsupported/);
  assert.match(D.validateMedia({ name: 'fake.jpg', type: 'text/html', size: 10 }).error, /do not match/);
  assert.match(D.validateMedia({ name: 'big.png', type: 'image/png', size: 6 * 1048576 }).error, /too large/);
});
