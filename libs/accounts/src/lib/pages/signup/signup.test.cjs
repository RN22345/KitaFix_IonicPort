const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ invalid = false, session = false, failure = false } = {}) {
  class FormBuilder {} class Router {} class AccountsAuthService {}
  const calls = []; let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const controls = { password: { reset() { calls.push('clear-password'); } }, confirmPassword: { reset() {} } };
  const form = { invalid, controls, markAllAsTouched() { calls.push('invalid'); },
    getRawValue: () => ({ email: 'test@example.com', password: 'synthetic-only' }) };
  const auth = { async register() { calls.push('register'); await waiting; if (failure) throw new Error('Unavailable'); return session; },
    async getAccountRole() { calls.push('role'); return 'customer'; } };
  const router = { async navigate(commands, options) { calls.push({ commands, options }); return true; } };
  const modules = {
    '@angular/core': { Component: () => x => x, inject: token => token === FormBuilder ? { nonNullable: { group: () => form } } : token === Router ? router : auth },
    '@angular/forms': { FormBuilder, Validators: { required() {}, email() {}, pattern: () => () => {} } },
    '@angular/router': { Router }, '@ionic/angular': {},
    '../../services/accounts-auth': { AccountsAuthService, accountLoginDestination: () => '/accounts-my-account', authMessage: e => e.message },
    '../../validators/password': { getPasswordRules: () => [], passwordPolicy() {}, passwordsMatch() {} },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname + '/signup.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText, { exports, require: name => modules[name] });
  return { page: new exports.SignupPage(), calls, release };
}
test('invalid registration sends nothing', async () => {
  const h = setup({ invalid: true }); await h.page.submit(); assert.deepEqual(h.calls, ['invalid']);
});
test('registration blocks concurrent and accepted duplicate submissions and passes no password in navigation', async () => {
  for (const session of [true, false]) {
    const h = setup({ session }); const first = h.page.submit();
    assert.equal(h.page.busy, true); await h.page.submit(); h.release(); await first; await h.page.submit();
    assert.equal(h.calls.filter(x => x === 'register').length, 1);
    assert.equal(h.page.busy, false);
    const navigation = h.calls.find(x => typeof x === 'object');
    assert.equal(navigation.commands[0], session ? '/accounts-my-account' : '/accounts-verify-email');
    assert.ok(!JSON.stringify(navigation).includes('synthetic-only'));
    if (!session) assert.equal(navigation.options.state.purpose, 'signup');
  }
});
test('registration error clears loading and permits retry', async () => {
  const h = setup({ failure: true }); h.release(); await h.page.submit();
  assert.equal(h.page.error, 'Unavailable'); assert.equal(h.page.busy, false);
  await h.page.submit(); assert.equal(h.calls.filter(x => x === 'register').length, 2);
});
