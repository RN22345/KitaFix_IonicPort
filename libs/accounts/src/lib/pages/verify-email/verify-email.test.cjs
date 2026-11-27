const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(__dirname + '/verify-email.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
function setup(purpose = 'signup') {
  let now = 1000000, marks = 0, calls = [], action = async () => {}, profile = async () => 'customer';
  const intervals = new Map(), deadlines = new Map(), listeners = new Map(); let next = 0;
  const history = { state: { email: 'test@example.com', purpose, sentAt: now }, replaceState(state) { this.state = state; } };
  const host = { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); }, visibilityState: 'visible' };
  class Router {} class Auth {} class Zone {} class Detector {}
  const auth = {
    async verifySignupCode() { calls.push('signup'); await action(); },
    async verifyResetCode() { calls.push('reset'); await action(); },
    async getAccountRole() { calls.push('profile'); return profile(); },
    async resendSignupCode() { calls.push('resend-signup'); await action(); },
    async sendResetCode() { calls.push('resend-reset'); await action(); },
  };
  const router = { async navigate(route) { calls.push(route[0]); return true; } };
  const exports = {};
  vm.runInNewContext(code, { exports, history, window: host, document: host, Error,
    Date: { now: () => now },
    setInterval(fn) { intervals.set(++next, fn); return next; }, clearInterval(id) { intervals.delete(id); },
    setTimeout(fn) { deadlines.set(++next, fn); return next; }, clearTimeout(id) { deadlines.delete(id); },
    require(name) {
      if (name === '@angular/core') return { Component: () => x => x, ViewChildren: () => () => {}, NgZone: Zone, ChangeDetectorRef: Detector,
        inject: token => token === Router ? router : token === Auth ? auth : token === Zone ? { run: fn => fn() } : { markForCheck() { marks++; } } };
      if (name === '@angular/router') return { Router };
      if (name.endsWith('accounts-auth')) return { AccountsAuthService: Auth, authMessage: e => e.message, accountLoginDestination: () => '/accounts-my-account' };
      return {};
    },
  });
  const create = () => { const p = new exports.VerifyEmailPage(); p.ionViewWillEnter(); return p; };
  return { create, history, calls, intervals, deadlines, listeners, get marks() { return marks; },
    action(fn) { action = fn; }, profile(fn) { profile = fn; },
    advance(ms) { now += ms; for (const fn of intervals.values()) fn(); },
    timeout() { for (const fn of [...deadlines.values()]) fn(); },
    resume() { listeners.get('visibilitychange')?.(); },
  };
}
test('pending verification retains digits, blocks edits/duplicates, and ticks both timers; failure retains code', async () => {
  const h = setup(); const p = h.create(); p.digits = [...'123456'];
  let reject; h.action(() => new Promise((_, r) => { reject = r; }));
  const pending = p.verify(); await p.verify();
  p.onDigitInput({ target: { value: '9' } }, 0);
  p.onPaste({ preventDefault() {}, clipboardData: { getData: () => '999999' } });
  assert.equal(p.digits.join(''), '123456'); assert.equal(p.busy, true); assert.deepEqual(h.calls, ['signup']);
  const marks = h.marks; h.advance(1000);
  assert.equal(p.remaining, 599); assert.equal(p.resendWait, 59); assert.ok(h.marks > marks);
  reject(new Error('Incorrect or expired code')); await pending;
  assert.equal(p.busy, false); assert.equal(p.error, 'Incorrect or expired code'); assert.equal(p.digits.join(''), '123456');
});
test('signup and recovery success follow separate flows and cannot be submitted twice', async () => {
  for (const purpose of ['signup', 'reset']) {
    const h = setup(purpose); const p = h.create(); p.digits = [...'123456'];
    await p.verify(); await p.verify();
    assert.deepEqual(h.calls, purpose === 'signup' ? ['signup', 'profile', '/accounts-my-account'] : ['reset', '/accounts-reset-password']);
    assert.equal(p.busy, false);
  }
});
test('refresh and tab return preserve absolute deadlines; leave/destroy remove listeners and timers', () => {
  const h = setup(); const p = h.create(); const expiry = h.history.state.expiresAt;
  h.advance(17000); const fresh = h.create();
  assert.equal(fresh.remaining, 583); assert.equal(fresh.resendWait, 43); assert.equal(h.history.state.expiresAt, expiry);
  h.advance(40000); h.resume(); assert.equal(fresh.remaining, 543); assert.equal(fresh.resendWait, 3);
  p.ngOnDestroy(); fresh.ngOnDestroy(); assert.equal(h.intervals.size, 0); assert.equal(h.listeners.size, 0);
});
test('resend failure preserves deadlines and digits; successful resend alone restarts both timers', async () => {
  const h = setup(); const p = h.create(); h.advance(61000); p.digits = [...'123456']; const expiry = h.history.state.expiresAt;
  h.action(async () => { throw new Error('Network unavailable'); }); await p.resend();
  assert.equal(p.error, 'Network unavailable'); assert.equal(p.busy, false); assert.equal(h.history.state.expiresAt, expiry); assert.equal(p.digits.join(''), '123456');
  h.action(async () => {}); await p.resend(); assert.equal(p.remaining, 600); assert.equal(p.resendWait, 60);
  assert.equal(p.digits.join(''), ''); assert.ok(h.history.state.expiresAt > expiry);
});
test('OTP and profile timeouts release busy and late responses cannot navigate or start another request', async () => {
  for (const stage of ['otp', 'profile']) {
    const h = setup(); const p = h.create(); p.digits = [...'123456']; let resolve;
    const delayed = () => new Promise(r => { resolve = r; });
    if (stage === 'otp') h.action(delayed); else h.profile(delayed);
    const pending = p.verify(); for (let i = 0; i < 8; i++) await Promise.resolve();
    h.timeout(); await pending; assert.equal(p.busy, false); assert.match(p.error, /timed out/);
    const count = h.calls.length; await p.verify(); assert.equal(h.calls.length, count);
    resolve('customer'); for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.ok(!h.calls.includes('/accounts-my-account')); assert.equal(p.digits.join(''), '123456');
  }
});
test('late resend does not extend deadlines; leaving pending verification suppresses navigation', async () => {
  const h = setup(); const p = h.create(); h.advance(61000); const expiry = h.history.state.expiresAt;
  let resolve; h.action(() => new Promise(r => { resolve = r; }));
  const pending = p.resend(); h.timeout(); await pending; resolve();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(h.history.state.expiresAt, expiry);
  p.digits = [...'123456']; const verify = p.verify(); p.ionViewWillLeave(); await verify; resolve();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.ok(!h.calls.includes('profile')); assert.equal(p.busy, false); assert.equal(h.deadlines.size, 0);
});
