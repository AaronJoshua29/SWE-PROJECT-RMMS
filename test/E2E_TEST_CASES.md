# RMMS — End-to-End (E2E) Test Case Document

**Module under test:** Web UI + authentication + fleet features (full stack, through the browser)
**Tool used:** Selenium WebDriver (Node.js client) driving Google Chrome
**Test type:** End-to-end / system testing (black-box — interaction only through the UI)
**Automated script:** `test/e2e.selenium.js`  ·  **Run with:** `npm run e2e`
**Tested by:** Aaron Joshua (24BRS1393), VIT Chennai
**Date executed:** 2026-10-29
**Environment:** Windows 11, Node.js 24, Chrome 156, Selenium WebDriver 4.51
**Overall result:** 6 / 6 passed

> These cases map one-to-one with the automated tests in `test/e2e.selenium.js`.
> Each test captures a screenshot in `docs/selenium-screenshots/` as evidence.
> To run with a visible browser window during a demo: `$env:HEADLESS=0; npm run e2e`

---

## Summary

| Test ID | Title | Feature covered | Status | Screenshot |
|---------|-------|-----------------|--------|------------|
| TC-E2E-01 | Login page loads with the sign-in form | Login UI | ✅ Pass | 01-login-page.png |
| TC-E2E-02 | Show-password toggle reveals and hides the password | Password toggle | ✅ Pass | 02-password-revealed.png |
| TC-E2E-03 | Administrator logs in and reaches the dashboard | Authentication (admin) | ✅ Pass | 03-admin-dashboard.png |
| TC-E2E-04 | Robots view lists the robot fleet | Fleet browsing | ✅ Pass | 04-robots-fleet.png |
| TC-E2E-05 | Export CSV button exports the fleet | CSV export | ✅ Pass | 05-csv-exported.png |
| TC-E2E-06 | New user self-registers and is saved to the database | Registration + persistence | ✅ Pass | 06-new-user-registered.png |

---

## Detailed test cases

### TC-E2E-01 — Login page loads with the sign-in form
- **Precondition:** RMMS server is running; browser is open at the app URL.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Navigate to the application home page | `http://127.0.0.1:<port>` | Login view is displayed |
  | 2 | Read the heading on the login card | — | Heading contains "RMMS" |

- **Actual result:** Login card displayed with the "RMMS" heading.
- **Status:** ✅ Pass

### TC-E2E-02 — Show-password toggle reveals and hides the password
- **Precondition:** The login page is displayed.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Inspect the password field's input type | — | Type is `password` (hidden) |
  | 2 | Click the "Show password" checkbox | — | Password field type changes to `text` (visible) |
  | 3 | Click the checkbox again | — | Password field type returns to `password` (hidden) |

- **Actual result:** Field toggled hidden → visible → hidden as expected.
- **Status:** ✅ Pass

### TC-E2E-03 — Administrator logs in and reaches the dashboard
- **Precondition:** The login page is displayed; a valid admin account exists.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Enter the admin email | `admin@rmms.io` | Value accepted |
  | 2 | Enter the admin password | `admin123` | Value accepted |
  | 3 | Click "Sign in" | — | App shell (dashboard) is displayed |
  | 4 | Check the signed-in user name is shown | — | A user name is displayed in the top bar |
  | 5 | Check the admin navigation section | — | "Administration" nav (Manage Fleet, Users) is visible |

- **Actual result:** Dashboard loaded; user shown; admin navigation visible.
- **Status:** ✅ Pass

### TC-E2E-04 — Robots view lists the robot fleet
- **Precondition:** User is logged in (admin).
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Click the "Robots" item in the sidebar | — | Robots view becomes active |
  | 2 | Wait for the fleet content to load | — | Robot cards are rendered (non-empty content) |

- **Actual result:** Robots view displayed the fleet of robot cards.
- **Status:** ✅ Pass

### TC-E2E-05 — Export CSV button exports the fleet
- **Precondition:** User is on the Robots view with the fleet loaded.
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Click the "Export CSV" button | — | A CSV download is triggered |
  | 2 | Observe the confirmation message | — | A toast reading "Exported N robots to CSV." appears |

- **Actual result:** Toast "Exported 12 robots to CSV." shown; file downloaded.
- **Status:** ✅ Pass

### TC-E2E-06 — New user self-registers and is saved to the database
- **Precondition:** The login page is displayed (user logged out).
- **Test steps:**

  | # | Action | Test data | Expected result |
  |---|--------|-----------|-----------------|
  | 1 | Log out, then click the "Register" tab | — | Registration form (with name field) is shown |
  | 2 | Enter full name | `Selenium Test User` | Value accepted |
  | 3 | Enter a unique email | `selenium_<timestamp>@rmms.io` | Value accepted |
  | 4 | Enter a password | `selenium123` | Value accepted |
  | 5 | Click "Create account" | — | App opens as a standard user |
  | 6 | Check the admin navigation is hidden | — | Standard user does NOT see admin nav |
  | 7 | Query the database for the new email | — | A user row exists with role = `user` |

- **Actual result:** Account created, logged in as standard user; row verified in SQLite with role `user`.
- **Status:** ✅ Pass

---

## Notes for the evaluator
- These E2E tests complement the **unit tests** of the Wear Model module (`test/TEST_CASES.md`),
  giving two levels of testing: unit (logic in isolation) and end-to-end (the whole app via the UI).
- Evidence screenshots are stored in `docs/selenium-screenshots/` and are regenerated on every run.
- All 6 test cases passed on the recorded run; no defects were raised.
