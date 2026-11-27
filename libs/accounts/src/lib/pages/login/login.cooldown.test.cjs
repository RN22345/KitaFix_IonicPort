// Run with: node --test libs/accounts/src/lib/pages/login/login.cooldown.test.cjs
// Execute the saved page class with browser, Angular DI, auth, and time mocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(`${__dirname}/login.ts`, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    experimentalDecorators: true },
}).outputText;

function harness() {
  let now = 1000000;
  let sequence = 0;
  let calls = 0;
  let failure = { code: 'invalid_credentials' };
  let navigationFailure;
  let pending;
  let marks = 0;
  let zoneRuns = 0;
  const storage = new Map();
  const timers = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const document = { visibilityState: "visible",
    addEventListener: (type, fn) => documentListeners.set(type, fn),
    removeEventListener: type => documentListeners.delete(type) };
  const navigations = [];
  class FormBuilder {
    nonNullable = { group: () => ({
      invalid: false,
      touched: false,
      markAllAsTouched() { this.touched = true; },
      getRawValue: () => ({ email: 'test@example.com', password: 'password' }),
      controls: { password: { reset() {} } },
    }) };
  }
  class Router {}
  class NgZone {}
  class ChangeDetectorRef {}
  class AccountsAuthService {}
  const auth = { login: async () => { calls++; if (pending) await pending; if (failure) throw failure; return "customer"; } };
  const router = { url: "/accounts-login", parseUrl: () => ({ queryParams: {} }), navigate: async (...args) => {
    navigations.push(args);
    if (navigationFailure) throw navigationFailure;
    return true;
  } };
  const modules = {
    '@angular/core': { NgZone, ChangeDetectorRef, Component: () => value => value,
      inject: token => token === FormBuilder ? new FormBuilder()
        : token === Router ? router
        : token === NgZone ? { run: fn => { zoneRuns++; return fn(); } }
        : token === ChangeDetectorRef ? { markForCheck: () => marks++ } : auth },
    '@angular/forms': { FormBuilder, Validators: { required() {}, email() {} } },
    '@angular/router': { Router },
    '@ionic/angular': {},
    '../../services/login-timing': { timeLoginStage: async (_, fn) => await fn() },
    '../../services/accounts-auth': { AccountsAuthService,
      accountLoginDestination: () => "/accounts-my-account",
      authMessage: error => error?.message || 'Authentication failed' },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      assert.ok(modules[name], `Unexpected module: ${name}`);
      return modules[name];
    },
    Date: { now: () => now },
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value) },
    setInterval: callback => { timers.set(++sequence, callback); return sequence; },
    clearInterval: id => timers.delete(id),
    document,
    window: { addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: type => listeners.delete(type) },
    history: { state: {} },
  });
  return {
    create() { const page = new exports.LoginPage(); page.ionViewWillEnter(); return page; },
    advance(ms) { now += ms; for (const callback of [...timers.values()]) callback(); },
    fail(error) { failure = error; },
    failNavigation(error) { navigationFailure = error; },
    get calls() { return calls; },
    timers, listeners, documentListeners, navigations,
    elapse(ms) { now += ms; },
    resume() { documentListeners.get("visibilitychange")?.(); },
    defer() { pending = new Promise(resolve => { this.resolve = resolve; }); },
    get marks() { return marks; },
    get zoneRuns() { return zoneRuns; },
    saved: () => JSON.parse(storage.get('kitafix.login.cooldown')),
  };
}

test('third invalid_credentials response locks for ten minutes and blocks requests', async () => {
  const h = harness(); const page = h.create();
  await page.submit(); await page.submit();
  assert.equal(page.locked, false);
  await page.submit();
  assert.equal(page.locked, true);
  assert.equal(page.countdown, '10:00');
  await page.submit(); assert.equal(h.calls, 3);
  h.advance(1000); assert.equal(page.countdown, '09:59');
  assert.equal(h.saved().failedAttempts, 3);
});

test('refresh preserves partial attempts and remaining cooldown', async () => {
  const h = harness(); let page = h.create();
  await page.submit(); page.ngOnDestroy();
  page = h.create(); await page.submit(); await page.submit();
  page.ngOnDestroy(); h.advance(61000);
  page = h.create();
  assert.equal(page.countdown, '08:59');
  assert.equal(page.locked, true);
});

test('expiry resets attempts, clears timer, and permits a fresh attempt', async () => {
  const h = harness(); const page = h.create();
  for (let i = 0; i < 3; i++) await page.submit();
  h.advance(600000);
  assert.equal(page.locked, false);
  assert.equal(h.saved().failedAttempts, 0);
  assert.equal(h.saved().lockExpiresAt, 0);
  assert.equal(h.timers.size, 0);
  await page.submit(); assert.equal(h.saved().failedAttempts, 1);
});

test('successful authentication resets attempts and redirects', async () => {
  const h = harness(); const page = h.create(); await page.submit();
  h.fail(null); await page.submit();
  assert.equal(h.saved().failedAttempts, 0);
  assert.equal(h.navigations[0][0][0], '/accounts-my-account');
  assert.equal(h.navigations[0][1].replaceUrl, true);
});

test('invalid forms and non-credential errors never increment attempts', async () => {
  const h = harness(); const page = h.create();
  page.form.invalid = true; await page.submit();
  assert.equal(h.calls, 0); assert.equal(page.form.touched, true);
  page.form.invalid = false; await page.submit();
  for (const error of [new TypeError('Network failure'),
    new Error('Your account profile could not be loaded.'),
    { code: 'email_not_confirmed' }, { code: 'validation_failed' }]) {
    h.fail(error); await page.submit();
    assert.equal(h.saved().failedAttempts, 1);
  }
});

test('Ionic leave and destroy clean timers; re-entry observes elapsed time', async () => {
  const h = harness(); const page = h.create();
  for (let i = 0; i < 3; i++) await page.submit();
  assert.equal(h.timers.size, 1);
  page.ionViewWillLeave();
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
  h.advance(600000); page.ionViewWillEnter();
  assert.equal(page.locked, false); assert.equal(h.saved().failedAttempts, 0);
  page.ngOnDestroy(); assert.equal(h.listeners.size, 0);
});

test('navigation failures after auth success do not count as invalid credentials', async () => {
  const h = harness(); const page = h.create(); await page.submit();
  h.fail(null); h.failNavigation({ code: 'invalid_credentials' });
  await page.submit(); assert.equal(h.saved().failedAttempts, 0);
});

test('saved template binds the countdown and disables submit while locked', () => {
  const template = fs.readFileSync(`${__dirname}/login.html`, 'utf8');
  assert.match(template, /@if \(locked\)/);
  assert.match(template, /\{\{ countdown \}\}/);
  assert.match(template, /\[disabled\]="busy \|\| locked"/);

});

test('exact remaining messages and Angular timer notifications', async () => {
  const h = harness(); const page = h.create();
  const message = 'Unable to log in. Check your email and password. If you don’t have an account yet, sign up.';
  await page.submit(); assert.equal(page.error, message);
  assert.equal(page.invalidCredentials, true); assert.equal(page.remainingAttempts, 2);
  await page.submit(); assert.equal(page.error, message); assert.equal(page.remainingAttempts, 1);
  await page.submit(); assert.equal(page.error, message); assert.equal(page.remainingAttempts, 0);
  const template = fs.readFileSync(`${__dirname}/login.html`, 'utf8');
  assert.match(template, /remainingAttempts === 1 \? 'attempt' : 'attempts'/);
  assert.match(template, /routerLink="\/accounts-signup">Sign up<\/a>/);
  const marks = h.marks;
  h.advance(1000); assert.equal(page.countdown, '09:59');
  h.advance(1000); assert.equal(page.countdown, '09:58');
  assert.ok(h.marks > marks); assert.equal(h.zoneRuns, 2);
  h.elapse(9000); h.resume(); assert.equal(page.countdown, '09:49');
  h.resume(); assert.equal(h.timers.size, 1);
  h.elapse(600000); h.resume(); assert.equal(page.locked, false);
  page.ngOnDestroy(); assert.equal(h.documentListeners.size, 0);
});

test('busy prevents duplicates until auth settles and clears after failure or navigation', async () => {
  const h = harness(); const page = h.create(); h.defer();
  const request = page.submit(); assert.equal(page.busy, true);
  await page.submit(); assert.equal(h.calls, 1); assert.equal(page.busy, true);
  h.resolve(); await request; assert.equal(page.busy, false);
  h.fail(null); await page.submit(); assert.equal(page.busy, false);
  h.failNavigation(new Error('navigation failed')); await page.submit();
  assert.equal(page.busy, false);
});
