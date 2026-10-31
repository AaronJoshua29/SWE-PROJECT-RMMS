# RMMS — Test Case Document

**Module under test:** Wear Model (`server/helpers.js` — `computeWear()`, `wearBand()`)
**Test type:** Unit testing
**Techniques used:** Equivalence Partitioning, Boundary Value Analysis, Edge-case testing
**Tested by:** Aaron Joshua (24BRS1393), VIT Chennai
**Date executed:** 2026-10-29
**Overall result:** 10 / 10 passed

> These test cases correspond one-to-one with the automated tests in
> `test/wear-model.test.js`. Each case can be entered into Jira (or Jira + Xray/Zephyr)
> as a **Test** issue; the "Expected Result" and "Status" map to the Xray test steps and
> execution status.

---

## Summary

| Test ID | Title | Technique | Status |
|---------|-------|-----------|--------|
| TC-WEAR-01 | Just-serviced robot shows 0% wear | Equivalence partitioning | ✅ Pass |
| TC-WEAR-02 | Robot halfway through interval shows 50% wear | Equivalence partitioning | ✅ Pass |
| TC-WEAR-03 | Robot at full interval shows exactly 100% | Boundary value | ✅ Pass |
| TC-WEAR-04 | Overdue robot is clamped to 100% | Boundary value | ✅ Pass |
| TC-WEAR-05 | Wear can never fall below 0% | Edge case (defensive) | ✅ Pass |
| TC-WEAR-06 | Zero / missing interval returns 0 (no divide-by-zero) | Edge case (robustness) | ✅ Pass |
| TC-WEAR-07 | Result is rounded to one decimal place | Equivalence partitioning | ✅ Pass |
| TC-WEAR-08 | Wear below 70% is classified "healthy" | Boundary value | ✅ Pass |
| TC-WEAR-09 | Wear 70%–89.9% is classified "warning" | Boundary value | ✅ Pass |
| TC-WEAR-10 | Wear 90% and above is classified "critical" | Boundary value | ✅ Pass |

---

## Detailed test cases

### TC-WEAR-01 — Just-serviced robot shows 0% wear
- **Precondition:** `computeWear()` is available from `server/helpers.js`.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=500, lastService=500, interval=2000 | Returns `0` |

- **Actual result:** `0`
- **Status:** ✅ Pass

### TC-WEAR-02 — Robot halfway through interval shows 50% wear
- **Precondition:** `computeWear()` is available.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=1000, lastService=0, interval=2000 | Returns `50` |

- **Actual result:** `50`
- **Status:** ✅ Pass

### TC-WEAR-03 — Robot at full interval shows exactly 100%
- **Precondition:** `computeWear()` is available.
- **Note:** Boundary value — hours used equals the service interval.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=2000, lastService=0, interval=2000 | Returns `100` |

- **Actual result:** `100`
- **Status:** ✅ Pass

### TC-WEAR-04 — Overdue robot is clamped to 100%
- **Precondition:** `computeWear()` is available.
- **Note:** Hours used far exceed the interval; raw formula would give 250%.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=5000, lastService=0, interval=2000 | Returns `100` (capped) |

- **Actual result:** `100`
- **Status:** ✅ Pass

### TC-WEAR-05 — Wear can never fall below 0%
- **Precondition:** `computeWear()` is available.
- **Note:** `lastService` greater than `total` would give a negative percentage.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=100, lastService=500, interval=2000 | Returns `0` (floored) |

- **Actual result:** `0`
- **Status:** ✅ Pass

### TC-WEAR-06 — Zero / missing interval returns 0 (no divide-by-zero)
- **Precondition:** `computeWear()` is available.
- **Note:** Robustness / defensive test — the function must not crash or return `NaN`.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call with a zero interval | total=1000, lastService=0, interval=0 | Returns `0` |
  | 2 | Call with a missing interval | total=1000, lastService=0, interval=undefined | Returns `0` |

- **Actual result:** `0` for both
- **Status:** ✅ Pass

### TC-WEAR-07 — Result is rounded to one decimal place
- **Precondition:** `computeWear()` is available.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `computeWear(total, lastService, interval)` | total=333, lastService=0, interval=1000 | Returns `33.3` |

- **Actual result:** `33.3`
- **Status:** ✅ Pass

### TC-WEAR-08 — Wear below 70% is classified "healthy"
- **Precondition:** `wearBand()` is available; WARNING threshold = 70.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `wearBand(wear)` | wear=0 | Returns `'healthy'` |
  | 2 | Call `wearBand(wear)` (just below warning) | wear=69.9 | Returns `'healthy'` |

- **Actual result:** `'healthy'` for both
- **Status:** ✅ Pass

### TC-WEAR-09 — Wear 70%–89.9% is classified "warning"
- **Precondition:** `wearBand()` is available; WARNING=70, CRITICAL=90.
- **Note:** Boundary values at the lower edge (70) and just below the upper edge (89.9).
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `wearBand(wear)` (exactly at warning) | wear=70 | Returns `'warning'` |
  | 2 | Call `wearBand(wear)` (just below critical) | wear=89.9 | Returns `'warning'` |

- **Actual result:** `'warning'` for both
- **Status:** ✅ Pass

### TC-WEAR-10 — Wear 90% and above is classified "critical"
- **Precondition:** `wearBand()` is available; CRITICAL threshold = 90.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Call `wearBand(wear)` (exactly at critical) | wear=90 | Returns `'critical'` |
  | 2 | Call `wearBand(wear)` | wear=100 | Returns `'critical'` |

- **Actual result:** `'critical'` for both
- **Status:** ✅ Pass

---

## Bug report template (for Jira)

If a test case ever fails, log it as a **Bug** issue in Jira linked to the failing test:

| Field | Example value |
|-------|---------------|
| Summary | `computeWear() does not clamp overdue robots to 100%` |
| Issue type | Bug |
| Priority | High |
| Linked test | TC-WEAR-04 |
| Steps to reproduce | Call `computeWear(5000, 0, 2000)` |
| Expected result | `100` |
| Actual result | `250` |
| Environment | Node.js 22.5+, Windows 11 |
| Status | Open → In Progress → Resolved |

All 10 test cases passed on the recorded run, so no bugs were raised.
