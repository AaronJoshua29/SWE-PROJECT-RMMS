'use strict';

/**
 * UNIT TESTS — Wear Model module  (server/helpers.js)
 * ---------------------------------------------------------------------------
 * The wear model decides how "worn out" a robot is and what health band it
 * falls into. It is the core business rule of RMMS, so it is tested in
 * isolation with Node's built-in test runner (node:test) — no database and no
 * server are involved, which makes these fast, repeatable UNIT tests.
 *
 * Testing techniques demonstrated here:
 *   • Equivalence Partitioning — one representative test per class of input
 *     (e.g. "below warning", "in warning", "critical").
 *   • Boundary Value Analysis  — tests exactly on the thresholds (70, 90, 100)
 *     where off-by-one bugs usually hide.
 *   • Edge / defensive cases   — zero interval, negative wear, rounding.
 *
 * Run with:  node --no-warnings test/wear-model.test.js
 *        or:  npm test   (runs the whole suite)
 * ---------------------------------------------------------------------------
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computeWear, wearBand } = require('../server/helpers');

// =========================================================================
//  computeWear(totalHours, lastServiceHours, serviceIntervalHours)
//  Formula: clamp( (total - lastService) / interval * 100 , 0 , 100 )
// =========================================================================
describe('computeWear() — the wear percentage formula', () => {

  test('a brand-new / just-serviced robot has 0% wear', () => {
    // 0 hours used since service  ->  0%
    assert.equal(computeWear(500, 500, 2000), 0);
  });

  test('a robot halfway through its service interval is 50% worn', () => {
    // used = 1000, interval = 2000  ->  50%
    assert.equal(computeWear(1000, 0, 2000), 50);
  });

  test('a robot that has used its full interval is exactly 100%', () => {
    // BOUNDARY: used == interval  ->  100%
    assert.equal(computeWear(2000, 0, 2000), 100);
  });

  test('wear is CLAMPED at 100% even when the robot is massively overdue', () => {
    // used = 5000 of 2000  ->  would be 250%, must be capped at 100
    assert.equal(computeWear(5000, 0, 2000), 100);
  });

  test('wear can never go below 0% (defensive clamp)', () => {
    // lastService > total would give a negative %, must be floored at 0
    assert.equal(computeWear(100, 500, 2000), 0);
  });

  test('a zero or missing service interval safely returns 0 (no divide-by-zero)', () => {
    // EDGE CASE: guards against dividing by zero
    assert.equal(computeWear(1000, 0, 0), 0);
    assert.equal(computeWear(1000, 0, undefined), 0);
  });

  test('the result is rounded to one decimal place', () => {
    // used = 333 of 1000 -> 33.3% (not 33.300000001)
    assert.equal(computeWear(333, 0, 1000), 33.3);
  });
});

// =========================================================================
//  wearBand(wear)  ->  'healthy' | 'warning' | 'critical'
//  Thresholds:  WARNING = 70% , CRITICAL = 90%
// =========================================================================
describe('wearBand() — mapping a percentage to a health band', () => {

  test('wear below 70% is reported as "healthy"', () => {
    assert.equal(wearBand(0), 'healthy');
    assert.equal(wearBand(69.9), 'healthy');   // BOUNDARY: just below warning
  });

  test('wear from 70% up to (but not including) 90% is "warning"', () => {
    assert.equal(wearBand(70), 'warning');     // BOUNDARY: exactly at warning
    assert.equal(wearBand(89.9), 'warning');   // BOUNDARY: just below critical
  });

  test('wear of 90% or more is "critical"', () => {
    assert.equal(wearBand(90), 'critical');    // BOUNDARY: exactly at critical
    assert.equal(wearBand(100), 'critical');
  });
});
