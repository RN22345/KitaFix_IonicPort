// Run with node --test libs/accounts/src/lib/services/accounts-auth.login.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(`${__dirname}/accounts-auth.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    experimentalDecorators: true },
}).outputText;

function setup({ invalid = false, active = true, missing = false, role = "customer", unreadable = false, signedOut = false, confirmation = true, signupError = null, otpType = null } = {}) {
  const calls = []; const stages = [];
  const profile = { profile: {}, clear() { this.cleared = true; }, cleared: false };
  class ProfileService {}
  const client = {
    auth: {
      onAuthStateChange() {},
      async signUp(input) {
        assert.deepEqual(Object.keys(input.options.data).sort(), ['birthday', 'contact_no', 'first_name', 'full_name', 'gender', 'last_name']);
        assert.equal(input.email, 'test@example.com');
        assert.equal(input.options.data.first_name, 'Actual');
        calls.push('signup');
        return { data: { user: { id: 'test' }, session: confirmation ? null : { user: { id: 'test' } } }, error: signupError };
      },
      async verifyOtp(input) { assert.equal(input.type, otpType); calls.push('otp:' + input.type); return { data: { user: { id: 'test' }, session: {} }, error: signupError }; },
      async resend(input) { assert.equal(input.type, 'signup'); calls.push('resend:signup'); return { error: signupError }; },
      async getUser() { calls.push('getUser'); return { data: { user: signedOut ? null : { id: 'test', email: 'test@example.com' } }, error: null }; },
      async signInWithPassword() { calls.push('signin'); return {
        data: { user: { id: 'test', email: 'test@example.com' } }, error: invalid ? { code: 'invalid_credentials' } : null }; },
      async signOut(options) { calls.push(`signout:${options.scope}`); return { error: null }; },
    },
    from(table) { assert.equal(table, 'my_profile'); calls.push('profile'); return {
      select(column) { assert.equal(column, '*'); return this; },
      eq(column, value) { assert.equal(column, 'id'); assert.equal(value, 'test'); return this; },
      async single() { return { data: missing ? null : { active, role, full_name: 'Actual User', phone: '123' }, error: unreadable ? new Error("denied") : null }; },
    }; },
  };
  class Router {}
  let authForGuard;
  const router = { createUrlTree: (commands, options) => ({ commands, ...options }) };
  const modules = {
    '@angular/core': { signal: require('@angular/core').signal, Injectable: () => value => value, InjectionToken: class {}, inject: token => token === exports.AccountsAuthService ? authForGuard : token === Router ? router : token === ProfileService ? profile : client },
    './profile': { ProfileService },
    '@angular/router': { Router }, '@supabase/supabase-js': {},
    './login-timing': { async timeLoginStage(stage, operation) { stages.push(stage); return await operation(); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => modules[name] });
  authForGuard = new exports.AccountsAuthService();
  return { auth: authForGuard, calls, stages, exports, profile };
}

test('login performs exactly one signin and profile check in order', async () => {
  const h = setup(); await h.auth.login('test@example.com', 'mock');
  assert.deepEqual(h.calls, ['signin', 'profile']);
  assert.deepEqual(h.stages, ['signInWithPassword', 'profile active/role check']);
});
test('invalid credentials skip profile lookup', async () => {
  const h = setup({ invalid: true });
  await assert.rejects(h.auth.login('test@example.com', 'mock'), { code: 'invalid_credentials' });
  assert.deepEqual(h.calls, ['signin']);
});
test('missing and inactive profiles still sign out and reject', async () => {
  for (const options of [{ missing: true }, { active: false }]) {
    const h = setup(options);
    await assert.rejects(h.auth.login('test@example.com', 'mock'));
    assert.deepEqual(h.calls, ['signin', 'profile', 'signout:local']);
  }
});

test('the three backend roles resolve to their landing routes', async () => {
  for (const role of ['customer', 'technician', 'admin']) {
    const h = setup({ role });
    assert.equal(await h.auth.login('test@example.com', 'mock'), role);
    const landing = { customer: '/tabs', technician: '/ops/repair-queue', admin: '/admin' };
    assert.equal(h.exports.accountLoginDestination(role), landing[role]);
  }
  for (const role of [null, undefined, 'staff', 'AD', 'owner']) {
    const h = setup({ role: role === undefined ? '' : role });
    await assert.rejects(h.auth.login('test@example.com', 'mock'), /role is missing or invalid/);
    assert.equal(h.calls.at(-1), 'signout:local');
  }
});

test('logout signs out of Supabase and clears account, role, profile and recovery state', async () => {
  const h = setup({ role: 'admin' });
  await h.auth.login('test@example.com', 'mock');
  assert.equal(h.auth.account.email, 'test@example.com');
  assert.equal(h.auth.account.role, 'admin');
  h.profile.cleared = false;
  h.auth.recoveryUserId = 'test';
  await h.auth.logout();
  assert.equal(h.calls.at(-1), 'signout:local');
  assert.equal(h.auth.account, null);
  assert.equal(h.profile.cleared, true);
  assert.equal(await h.auth.canResetPassword(), false);
});

test('guards validate Auth and backend role, deny wrong roles and fail closed', async () => {
  for (const allowedRole of ['customer', 'technician', 'admin']) {
  for (const role of ['customer', 'technician', 'admin']) {
    const h = setup({ role });
    const result = await h.exports.accountsRoleGuard([allowedRole])();
    if (role === allowedRole) {
      assert.equal(result, true);
      assert.equal(h.auth.account.email, 'test@example.com');
      assert.equal(h.auth.account.role, role);
    }
    else assert.equal(result.queryParams.accessError, 'forbidden');
    assert.deepEqual(h.calls, ['getUser', 'profile']);
  }
  }
  for (const options of [{ signedOut: true }, { missing: true }, { unreadable: true },
    { active: false }, { role: 'staff' }, { role: null }]) {
    const h = setup(options);
    const result = await h.exports.accountsRoleGuard(['customer', 'technician', 'admin'])();
    assert.equal(result.commands[0], '/accounts-login');
    assert.equal(result.queryParams.accessError, 'unavailable');
  }
});

test('saved destinations enforce one role and preserve the password recovery guard', () => {
  const routeSource = fs.readFileSync(`${__dirname}/../../../../../src/app/app.routes.ts`, 'utf8');
  const routeExports = {};
  const recoveryGuard = () => {};
  vm.runInNewContext(ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: routeExports,
    require: name => {
      assert.equal(name, '@kitafix/accounts');
      return { accountsRecoveryGuard: recoveryGuard, accountsRoleGuard: allowed => [...allowed] };
    },
  });
  for (const [path, role] of [
    ['accounts-list', 'admin'], ['accounts-profile/:id', 'admin'],
    ['accounts-roles', 'admin'],
  ]) {
    const route = routeExports.routes.find(route => route.path === path);
    assert.ok(route?.loadComponent, `Missing destination: ${path}`);
    assert.deepEqual(route.canActivate[0], [role]);
  }
  for (const path of ['accounts-my-account', 'accounts-edit-profile', 'accounts-change-password']) {
    const route = routeExports.routes.find(route => route.path === path);
    assert.deepEqual(route.canActivate[0], ['customer', 'technician', 'admin']);
  }
  assert.equal(routeExports.routes.some(route => /dashboard|accounts-technician/.test(route.path)), false);
  assert.equal(routeExports.routes.find(route => route.path === 'accounts-reset-password').canActivate[0], recoveryGuard);
});

 test('all roles hydrate their own backend profile without sample identity', async () => {
  for (const role of ['customer', 'technician', 'admin']) {
    const h = setup({ role });
    await h.auth.getAccountRole();
    assert.equal(h.profile.profile.id, 'test');
    assert.equal(h.profile.profile.firstName, 'Actual User');
    assert.equal(h.profile.profile.email, 'test@example.com');
    assert.equal(h.profile.profile.role, role);
    assert.equal(h.profile.profile.contactNo, '123');
  }
 });
 test('own profile guard permits every valid role after session restoration', async () => {
  for (const role of ['customer', 'technician', 'admin']) {
    const h = setup({ role });
    assert.equal(await h.exports.accountsRoleGuard(['customer', 'technician', 'admin'])(), true);
  }
 });

const registration = { email: ' test@example.com ', password: 'synthetic-test-only', firstName: ' Actual ', lastName: 'User', contactNo: '09171234567', birthday: '2000-01-01', gender: 'male', role: 'admin', active: false };
test('registration allowlists personal metadata and branches on actual session', async () => {
  for (const confirmation of [true, false]) {
    const h = setup({ confirmation });
    h.auth.recoveryUserId = 'test';
    assert.equal(await h.auth.register(registration), !confirmation);
    assert.deepEqual(h.calls, ['signup']);
    assert.equal(await h.auth.canResetPassword(), false);
  }
});
test('registration propagates duplicate, network, rate-limit and database failures', async () => {
  for (const code of ['user_already_exists', 'over_email_send_rate_limit', 'unexpected_failure', 'network_error']) {
    const h = setup({ signupError: { code } });
    await assert.rejects(h.auth.register(registration), { code });
  }
});
test('signup verification and resend never enable recovery', async () => {
  const h = setup({ otpType: 'signup' }); h.auth.recoveryUserId = 'test';
  await h.auth.verifySignupCode('test@example.com', '000000');
  assert.equal(await h.auth.canResetPassword(), false);
  await h.auth.resendSignupCode('test@example.com');
  assert.deepEqual(h.calls, ['otp:signup', 'resend:signup']);
});
test('invalid signup confirmation does not enable recovery', async () => {
  const h = setup({ otpType: 'signup', signupError: { code: 'otp_expired' } });
  await assert.rejects(h.auth.verifySignupCode('test@example.com', '000000'));
  assert.equal(await h.auth.canResetPassword(), false);
});
