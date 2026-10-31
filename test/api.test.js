'use strict';

/**
 * Automated tests for RMMS, using Node's built-in test runner (node:test).
 * Combines unit tests of the wear/auth helpers with integration tests that
 * exercise the real Express app over HTTP on an ephemeral port.
 *
 * Run with:  npm test
 */
const test = require('node:test');
const assert = require('node:assert');

const { computeWear, wearBand, validateRobotPayload } = require('../server/helpers');
const { hashPassword, verifyPassword, sign, verify } = require('../server/auth');
const app = require('../server/index');

// ---------- helper to boot the app on a random free port ----------
let server, base;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server && server.close());

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function loginAdmin() {
  const { data } = await call('POST', '/api/auth/login', { email: 'admin@rmms.io', password: 'admin123' });
  return data.token;
}

/* =================== UNIT TESTS =================== */

test('computeWear: midway through interval', () => {
  assert.strictEqual(computeWear(1000, 0, 2000), 50);
});

test('computeWear: caps at 100 and never negative', () => {
  assert.strictEqual(computeWear(9000, 0, 2000), 100);
  assert.strictEqual(computeWear(0, 0, 2000), 0);
});

test('wearBand: thresholds map to bands', () => {
  assert.strictEqual(wearBand(10), 'healthy');
  assert.strictEqual(wearBand(75), 'warning');
  assert.strictEqual(wearBand(95), 'critical');
});

test('validateRobotPayload: flags missing required fields', () => {
  const errors = validateRobotPayload({});
  assert.ok(errors.length >= 6);
});

test('password hashing round-trips and rejects wrong password', () => {
  const { salt, hash } = hashPassword('secret123');
  assert.ok(verifyPassword('secret123', salt, hash));
  assert.ok(!verifyPassword('wrong', salt, hash));
});

test('token sign/verify works and rejects tampering', () => {
  const token = sign({ sub: 1, role: 'admin' });
  assert.strictEqual(verify(token).role, 'admin');
  assert.strictEqual(verify(token + 'x'), null);
});

/* =================== INTEGRATION TESTS =================== */

test('login with valid admin credentials returns a token', async () => {
  const { status, data } = await call('POST', '/api/auth/login', { email: 'admin@rmms.io', password: 'admin123' });
  assert.strictEqual(status, 200);
  assert.ok(data.token);
  assert.strictEqual(data.user.role, 'admin');
});

test('login with wrong password is rejected (401)', async () => {
  const { status } = await call('POST', '/api/auth/login', { email: 'admin@rmms.io', password: 'nope' });
  assert.strictEqual(status, 401);
});

test('unauthenticated request to /api/robots is blocked (401)', async () => {
  const { status } = await call('GET', '/api/robots');
  assert.strictEqual(status, 401);
});

test('authenticated user can list robots', async () => {
  const token = await loginAdmin();
  const { status, data } = await call('GET', '/api/robots', null, token);
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data.robots) && data.robots.length > 0);
});

test('dashboard stats add up to the fleet size', async () => {
  const token = await loginAdmin();
  const { data } = await call('GET', '/api/stats', null, token);
  const sum = data.byStatus.free + data.byStatus.in_use + data.byStatus.maintenance + data.byStatus.offline;
  assert.strictEqual(sum, data.total);
});

test('reserve then release a free robot updates status and operating hours', async () => {
  const token = await loginAdmin();
  const { data } = await call('GET', '/api/robots?status=free', null, token);
  const robot = data.robots[0];
  const hoursBefore = robot.total_operating_hours;

  const reserve = await call('POST', `/api/robots/${robot.id}/reserve`, { purpose: 'Test', expected_hours: 2 }, token);
  assert.strictEqual(reserve.status, 201);
  assert.strictEqual(reserve.data.robot.status, 'in_use');

  const release = await call('POST', `/api/robots/${robot.id}/release`, { logged_hours: 2 }, token);
  assert.strictEqual(release.status, 200);
  assert.strictEqual(release.data.robot.status, 'free');
  assert.strictEqual(release.data.robot.total_operating_hours, hoursBefore + 2);
});

test('reserving a robot that is not free is rejected (409)', async () => {
  const token = await loginAdmin();
  const { data } = await call('GET', '/api/robots?status=maintenance', null, token);
  if (!data.robots.length) return; // nothing in maintenance to test against
  const res = await call('POST', `/api/robots/${data.robots[0].id}/reserve`, {}, token);
  assert.strictEqual(res.status, 409);
});

test('non-admin cannot create a robot (403)', async () => {
  const { data } = await call('POST', '/api/auth/login', { email: 'aaron@rmms.io', password: 'aaron123' });
  const res = await call('POST', '/api/robots', {
    name: 'X', model: 'Y', manufacturer: 'Z', serial_number: 'HACK-1',
    category: 'SCARA', location: 'Nowhere'
  }, data.token);
  assert.strictEqual(res.status, 403);
});
