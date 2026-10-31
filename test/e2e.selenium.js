'use strict';

/**
 * END-TO-END (E2E) UI TESTS — Selenium WebDriver
 * ---------------------------------------------------------------------------
 * These tests drive a REAL Chrome browser against the running RMMS web app,
 * exactly like a human user would: typing into the login form, clicking the
 * sidebar, registering a new account. This is black-box / system testing — we
 * only interact through the UI and check what the user sees.
 *
 * The script is self-contained:
 *   1. starts the RMMS server on a free local port,
 *   2. launches Chrome via Selenium,
 *   3. runs each test case, saving a screenshot of every step into
 *      docs/selenium-screenshots/,
 *   4. prints a PASS/FAIL summary and shuts everything down.
 *
 * Run with:   npm run e2e
 *       or:   node test/e2e.selenium.js
 * Add HEADLESS=0 to watch it happen in a visible browser window:
 *             $env:HEADLESS=0; npm run e2e
 * ---------------------------------------------------------------------------
 */
const fs = require('node:fs');
const path = require('node:path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const expressApp = require('../server');              // the RMMS Express app
const db = require('../server/db');                   // to verify persistence

const SHOT_DIR = path.join(__dirname, '..', 'docs', 'selenium-screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotCount = 0;
async function screenshot(driver, label) {
  const png = await driver.takeScreenshot();
  const file = path.join(SHOT_DIR, `${String(++shotCount).padStart(2, '0')}-${label}.png`);
  fs.writeFileSync(file, png, 'base64');
  console.log(`      📸 saved ${path.relative(path.join(__dirname, '..'), file)}`);
}

const results = [];
async function testCase(id, title, driver, fn) {
  process.stdout.write(`\n▶ ${id}  ${title}\n`);
  try {
    await fn();
    results.push({ id, title, status: 'PASS' });
    console.log(`   ✅ PASS`);
  } catch (err) {
    results.push({ id, title, status: 'FAIL', error: err.message });
    console.log(`   ❌ FAIL — ${err.message}`);
    try { await screenshot(driver, `${id}-FAILURE`); } catch { /* ignore */ }
  }
}

async function main() {
  // --- 1. start the server on a free port -------------------------------
  const server = await new Promise((resolve) => {
    const s = expressApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const BASE = `http://127.0.0.1:${server.address().port}`;
  console.log(`RMMS server started at ${BASE}`);

  // --- 2. launch Chrome --------------------------------------------------
  const options = new chrome.Options();
  if (process.env.HEADLESS !== '0') options.addArguments('--headless=new');
  options.addArguments('--window-size=1366,900', '--no-sandbox', '--disable-gpu');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  const wait = (locator, t = 10000) => driver.wait(until.elementLocated(locator), t);

  const newEmail = `selenium_${Date.now()}@rmms.io`;    // unique so the test can re-run

  try {
    // === TC-E2E-01: login page loads =====================================
    await testCase('TC-E2E-01', 'Login page loads with the RMMS sign-in form', driver, async () => {
      await driver.get(BASE);
      await driver.wait(until.elementIsVisible(await wait(By.id('loginView'))), 10000);
      const heading = await driver.findElement(By.css('.login-card h1')).getText();
      if (!heading.includes('RMMS')) throw new Error(`expected RMMS heading, got "${heading}"`);
      await screenshot(driver, 'login-page');
    });

    // === TC-E2E-02: show/hide password toggle ============================
    await testCase('TC-E2E-02', 'Show-password toggle reveals and hides the password', driver, async () => {
      const pwd = driver.findElement(By.id('password'));
      if ((await pwd.getAttribute('type')) !== 'password') throw new Error('password should start hidden');
      await driver.findElement(By.id('showPwd')).click();
      if ((await pwd.getAttribute('type')) !== 'text') throw new Error('password should be revealed after toggle');
      await screenshot(driver, 'password-revealed');
      await driver.findElement(By.id('showPwd')).click();             // toggle back off
      if ((await pwd.getAttribute('type')) !== 'password') throw new Error('password should hide again');
    });

    // === TC-E2E-03: admin can log in =====================================
    await testCase('TC-E2E-03', 'Administrator logs in and reaches the dashboard', driver, async () => {
      await driver.findElement(By.id('email')).clear();
      await driver.findElement(By.id('email')).sendKeys('admin@rmms.io');
      await driver.findElement(By.id('password')).clear();
      await driver.findElement(By.id('password')).sendKeys('admin123');
      await driver.findElement(By.id('authSubmit')).click();

      // logged-in state = #appView gains the "active" class
      await wait(By.css('#appView.active'));
      const name = await driver.findElement(By.id('userName')).getText();
      if (!name) throw new Error('user name not shown after login');
      // admin-only navigation must be visible for an admin
      const adminNavShown = await driver.findElement(By.id('adminNav')).isDisplayed();
      if (!adminNavShown) throw new Error('admin navigation not visible for admin user');
      await screenshot(driver, 'admin-dashboard');
    });

    // === TC-E2E-04: fleet list renders ===================================
    await testCase('TC-E2E-04', 'Robots view lists the robot fleet', driver, async () => {
      await driver.findElement(By.css('.nav-item[data-view="robots"]')).click();
      await wait(By.css('#view-robots.active'));
      // wait until the async-loaded content actually has robots in it
      await driver.wait(async () => {
        const txt = await driver.findElement(By.id('view-robots')).getText();
        return txt.trim().length > 20;
      }, 10000, 'robot list did not render');
      await screenshot(driver, 'robots-fleet');
    });

    // === TC-E2E-05: export fleet to CSV ==================================
    await testCase('TC-E2E-05', 'Export CSV button exports the fleet and confirms with a toast', driver, async () => {
      await driver.findElement(By.id('rExport')).click();
      // success toast should appear reading "Exported N robots to CSV."
      await driver.wait(async () => {
        const t = await driver.findElement(By.id('toast')).getText();
        return /Exported \d+ robots/.test(t);
      }, 5000, 'export confirmation toast did not appear');
      await screenshot(driver, 'csv-exported');
    });

    // === TC-E2E-06: register a new user (live credential creation) =======
    await testCase('TC-E2E-06', 'New user can self-register and is persisted to the database', driver, async () => {
      await driver.findElement(By.id('logoutBtn')).click();
      await driver.wait(until.elementIsVisible(await wait(By.id('loginView'))), 10000);

      await driver.findElement(By.id('tabRegister')).click();
      await driver.wait(until.elementIsVisible(await wait(By.id('name'))), 5000);

      await driver.findElement(By.id('name')).sendKeys('Selenium Test User');
      await driver.findElement(By.id('email')).clear();
      await driver.findElement(By.id('email')).sendKeys(newEmail);
      await driver.findElement(By.id('password')).clear();
      await driver.findElement(By.id('password')).sendKeys('selenium123');
      await driver.findElement(By.id('authSubmit')).click();

      // should land in the app as a standard user (no admin nav)
      await wait(By.css('#appView.active'));
      const adminNavShown = await driver.findElement(By.id('adminNav')).isDisplayed();
      if (adminNavShown) throw new Error('standard user should NOT see admin navigation');
      await screenshot(driver, 'new-user-registered');

      // cross-check: the account really exists in the SQLite database
      const row = db.prepare('SELECT email, role FROM users WHERE email = ?').get(newEmail);
      if (!row) throw new Error('registered user was not found in the database');
      if (row.role !== 'user') throw new Error(`expected role "user", got "${row.role}"`);
      console.log(`      🗄️  verified in database: ${row.email} (role=${row.role})`);
    });

  } finally {
    await driver.quit();
    server.close();
  }

  // --- summary -----------------------------------------------------------
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log('\n──────────────────────────────────────────────');
  console.log(' SELENIUM E2E RESULTS');
  console.log('──────────────────────────────────────────────');
  for (const r of results) console.log(` ${r.status === 'PASS' ? '✅' : '❌'} ${r.id}  ${r.title}`);
  console.log('──────────────────────────────────────────────');
  console.log(` ${passed}/${results.length} passed`);
  console.log(` Screenshots: docs/selenium-screenshots/`);
  console.log('──────────────────────────────────────────────\n');

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
