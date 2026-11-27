// Run with node --test libs/accounts/src/lib/services/accounts.read.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
// Exercise real Angular reactive dependency tracking, not a fake signal.
const { signal, computed } = require('@angular/core');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true },
  }).outputText;
}
const serviceCode = compile(__dirname + '/accounts.ts');
const pageCode = compile(__dirname + '/../pages/accounts-list/accounts-list.ts');
const session = { user: { id: 'current-admin' } };

function setup({ sessionRead, fakeTimers = false, realClient } = {}) {
  let callback;
  let writeResponse = { data: 'technician', error: null };
  const writeCalls = [];
  let response = { data: [], error: null };
  let sessionResponse = { data: { session }, error: null };
  let timer;
  const calls = [];
  const signals = [];
  const client = realClient || {
    auth: {
      onAuthStateChange(fn) { callback = fn; },
      async getSession() { return sessionRead ? sessionRead() : sessionResponse; },
    },
    rpc(name, args) {
      if (name === 'admin_assign_account_role' || name === 'admin_set_account_active') return {
        async abortSignal(signal) {
          writeCalls.push({ name, args, signal });
          return typeof writeResponse === 'function' ? writeResponse() : writeResponse;
        },
      };
      return {
        range(from, to) {
          return {
            async abortSignal(abortSignal) {
              calls.push({ name, args, from, to });
              signals.push(abortSignal);
              return typeof response === 'function' ? response(from, to) : response;
            },
          };
        },
      };
    },
  };
  const exports = {};
  vm.runInNewContext(serviceCode, {
    exports, AbortController,
    setTimeout: fakeTimers ? fn => { timer = fn; return 1; } : setTimeout,
    clearTimeout: fakeTimers ? () => { timer = undefined; } : clearTimeout,
    require: name => name === '@angular/core'
      ? { Injectable: () => x => x, inject: () => client, signal } : {},
  });
  return {
    service: new exports.AccountsService(), map: exports.mapAdminAccount, calls, signals, writeCalls,
    writeRespond: value => { writeResponse = value; },
    respond: value => { response = value; },
    sessionRespond: value => { sessionResponse = value; },
    transition: (event = 'SIGNED_OUT', value = null) => callback(event, value),
    expire: () => { assert.ok(timer); timer(); },
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function pageFor(service) {
  const exports = {};
  class AccountsService {}
  vm.runInNewContext(pageCode, { exports, require: name => name === '@angular/core'
    ? { Component: () => x => x, inject: token => token === AccountsService ? service : {} }
    : name === '../../services/accounts' ? { AccountsService } : {} });
  return new exports.AccountsListPage();
}

test('maps UUID, Auth email and nullable profile values without invention', () => {
  const h = setup();
  const row = h.map({ id: 'a6d20570-54fe-4e1d-bd20-cb7b431c3a68', email: 'actual@example.com',
    first_name: 'Actual', last_name: 'User', role: 'technician', active: false, profile_exists: true });
  assert.equal(row.id, 'a6d20570-54fe-4e1d-bd20-cb7b431c3a68');
  assert.equal(row.email, 'actual@example.com');
  assert.equal(row.firstName, 'Actual');
  assert.equal(row.role, 'technician');
  assert.equal(row.isActive, false);
  const missing = h.map({ id: 'real-uuid', profile_exists: false });
  assert.equal(missing.firstName, '');
  assert.equal(missing.role, null);
  assert.equal(missing.isActive, null);
  assert.equal(missing.profileMissing, true);
});

test('page entry sends RPC; success, counts, loading and errors notify Angular consumers', async () => {
  const h = setup();
  const page = pageFor(h.service);
  const view = computed(() => ({ loading: h.service.loading, error: h.service.error,
    active: page.activeCount, inactive: page.inactiveCount, rows: page.accounts.length }));
  assert.equal(view().rows, 0);
  h.respond({ data: [{ id: 'uuid', first_name: 'Fresh', active: true }], error: null });
  page.ionViewWillEnter();
  assert.equal(view().loading, true);
  await new Promise(setImmediate);
  assert.equal(h.calls[0].name, 'admin_read_accounts');
  assert.equal(h.calls[0].args.account_id, null);
  assert.equal(view().loading, false);
  assert.equal(view().active, 1);
  assert.equal(view().rows, 1);
  assert.equal(h.service.loadPhase, 'ready');
  h.respond({ data: null, error: { code: '42501' } });
  await h.service.loadAccounts();
  assert.equal(view().loading, false);
  assert.equal(view().rows, 0);
  assert.match(view().error, /active Admin/);
  h.respond({ data: [], error: null });
  await h.service.loadAccounts();
  assert.equal(view().rows, 0);
  assert.equal(view().error, '');
  assert.equal(view().loading, false);
});

test('detail sends actual UUID and does not reuse cached list record', async () => {
  const h = setup();
  h.respond({ data: [{ id: 'actual-uuid', profile_exists: true }], error: null });
  await h.service.loadAccounts('actual-uuid');
  assert.equal(h.calls[0].args.account_id, 'actual-uuid');
  assert.equal(h.service.getAccountById('actual-uuid').id, 'actual-uuid');
  assert.equal(h.service.getAccountById('other'), undefined);
});

test('initial session and same-user auth events do not discard successful RPC responses', async () => {
  const h = setup();
  let resolve;
  h.respond(() => new Promise(r => { resolve = r; }));
  const pending = h.service.loadAccounts();
  await flush();
  assert.equal(h.service.loadPhase, 'rpc');
  for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
    assert.equal(h.transition(event, session), undefined, 'callback must stay synchronous');
    assert.equal(h.service.loading, true);
    assert.equal(h.signals[0].aborted, false);
  }
  resolve({ data: [{ id: 'kept' }], error: null });
  await pending;
  assert.equal(h.service.getAccounts()[0].id, 'kept');
  assert.equal(h.service.loading, false);
});

test('initial session can arrive while initialization is pending without invalidating the load', async () => {
  let resolve;
  const h = setup({ sessionRead: () => new Promise(r => { resolve = r; }) });
  const pending = h.service.loadAccounts();
  assert.equal(h.service.loadPhase, 'session');
  assert.equal(h.calls.length, 0);
  h.transition('INITIAL_SESSION', session);
  resolve({ data: { session }, error: null });
  await pending;
  assert.equal(h.calls.length, 1);
  assert.equal(h.service.loadPhase, 'ready');
});

test('logout and account switching abort and discard stale RPC responses', async () => {
  for (const event of ['SIGNED_OUT', 'SIGNED_IN']) {
    const h = setup();
    let resolve;
    h.respond(() => new Promise(r => { resolve = r; }));
    const pending = h.service.loadAccounts();
    await flush();
    h.transition(event, event === 'SIGNED_OUT' ? null : { user: { id: 'different-user' } });
    assert.equal(h.signals[0].aborted, true);
    assert.equal(h.service.loading, false);
    resolve({ data: [{ id: 'old-data' }], error: null });
    await pending;
    assert.equal(h.service.getAccounts().length, 0);
    assert.equal(h.service.loadPhase, 'idle');
  }
});

test('session missing, rejected, or throwing never sends an RPC and clears loading', async () => {
  for (const sessionRead of [
    async () => ({ data: { session: null }, error: null }),
    async () => ({ data: { session: null }, error: { code: 'bad_session' } }),
    async () => { throw new Error('session failure'); },
  ]) {
    const h = setup({ sessionRead });
    await h.service.loadAccounts();
    assert.equal(h.calls.length, 0);
    assert.equal(h.service.loading, false);
    assert.equal(h.service.loadPhase, 'error');
    assert.match(h.service.error, /sign-in session/);
  }
});

test('pending session and pending RPC time out; late success cannot replace the error', async () => {
  for (const phase of ['session', 'rpc']) {
    let resolve;
    const deferred = new Promise(r => { resolve = r; });
    const h = setup({ fakeTimers: true, sessionRead: phase === 'session' ? () => deferred : undefined });
    if (phase === 'rpc') h.respond(() => deferred);
    const pending = h.service.loadAccounts();
    await flush();
    assert.equal(h.service.loadPhase, phase);
    h.expire();
    await pending;
    assert.equal(h.service.loading, false);
    assert.equal(h.service.loadPhase, 'error');
    assert.match(h.service.error, /timed out/);
    resolve(phase === 'session' ? { data: { session }, error: null }
      : { data: [{ id: 'late' }], error: null });
    await flush();
    assert.equal(h.service.getAccounts().length, 0);
    assert.equal(h.service.loadPhase, 'error');
    if (phase === 'session') assert.equal(h.calls.length, 0);
  }
});

test('network rejection and invalid RPC data clear loading and expose a safe error', async () => {
  for (const response of [() => { throw new Error('network failure'); }, { data: {}, error: null }]) {
    const h = setup(); h.respond(response);
    await h.service.loadAccounts();
    assert.equal(h.service.loading, false);
    assert.equal(h.service.loadPhase, 'error');
    assert.ok(h.service.error);
  }
});

test('reads all result pages and applies real-data filters and counts', async () => {
  const h = setup();
  h.respond(from => ({ data: Array.from({ length: from === 0 ? 500 : 1 }, (_, i) => ({ id: String(from + i) })), error: null }));
  await h.service.loadAccounts();
  assert.equal(h.service.getAccounts().length, 501);
  assert.equal(h.calls[1].from, 500);
  h.respond({ data: [
    { id: 'a', first_name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
    { id: 'b', first_name: 'Bob', email: 'bob@example.com', role: 'technician', active: false },
    { id: 'c', email: 'missing@example.com', profile_exists: false },
  ], error: null });
  await h.service.loadAccounts();
  const page = pageFor(h.service);
  assert.equal(page.accounts.length, 3);
  assert.equal(page.activeCount, 1);
  assert.equal(page.inactiveCount, 1);
  page.search = 'BOB@'; assert.equal(page.filteredAccounts[0].id, 'b');
  page.search = ''; page.statusFilter = 'inactive'; assert.equal(page.filteredAccounts.length, 1);
  page.statusFilter = 'all'; page.roleFilter = 'admin'; assert.equal(page.filteredAccounts[0].id, 'a');
});

test('installed Supabase SDK initializes session and sends the actual RPC without callback deadlock', async () => {
  const { createClient } = require('@supabase/supabase-js');
  let rpcSent = 0;
  const client = createClient('https://accounts-test.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Offline SDK integration: never sends a network request or prints headers.
    global: { fetch: async url => {
      assert.equal(new URL(String(url)).pathname, '/rest/v1/rpc/admin_read_accounts');
      rpcSent++;
      return new Response(JSON.stringify([{ id: 'sdk-row', active: true }]), { status: 200 });
    } },
  });
  // Synthetic, local session fixture only. No real credentials are loaded/logged.
  const fixture = { access_token: 'test-only', refresh_token: 'test-only', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: session.user };
  await client.auth.initialize();
  await client.auth._saveSession(fixture);
  const h = setup({ realClient: client });
  await h.service.loadAccounts();
  assert.equal(h.service.error, '');
  assert.equal(rpcSent, 1);
  assert.equal(h.service.loadPhase, 'ready');
  assert.equal(h.service.getAccounts()[0].id, 'sdk-row');
  assert.equal(h.service.loading, false);
  await client.auth.stopAutoRefresh();
});

test('a new page load supersedes an older request without clearing the new result', async () => {
  const h = setup();
  let resolveOld;
  h.respond(() => new Promise(resolve => { resolveOld = resolve; }));
  const old = h.service.loadAccounts();
  await flush();
  h.respond({ data: [{ id: 'new' }], error: null });
  await h.service.loadAccounts();
  assert.equal(h.signals[0].aborted, true);
  resolveOld({ data: null, error: { code: '42501' } });
  await old;
  assert.equal(h.service.getAccounts()[0].id, 'new');
  assert.equal(h.service.error, '');
  assert.equal(h.service.loading, false);
});

test('auth changes clear already-loaded list and detail; same-user refresh preserves them', async () => {
  const h = setup();
  h.respond({ data: [{ id: 'uuid' }], error: null });
  await h.service.loadAccounts();
  h.transition('TOKEN_REFRESHED', session);
  assert.equal(h.service.getAccounts().length, 1);
  h.transition('SIGNED_IN', { user: { id: 'other' } });
  assert.equal(h.service.getAccounts().length, 0);
  await h.service.loadAccounts('uuid');
  assert.ok(h.service.getAccountById('uuid'));
  h.transition();
  assert.equal(h.service.getAccountById('uuid'), undefined);
});

async function editable(h, id = 'target') {
  h.respond({ data: [{ id, role: 'customer', active: true, profile_exists: true }], error: null });
  await h.service.loadAccounts(id);
}

test('role save sends UUID and selected application role, never simulates a local update', async () => {
  const h = setup(); await editable(h);
  await h.service.assignRole('target', 'technician');
  assert.equal(h.writeCalls.length, 1);
  assert.equal(h.writeCalls[0].args.account_id, 'target');
  assert.equal(h.writeCalls[0].args.new_role, 'technician');
  assert.equal(h.service.getAccountById('target').role, 'customer');
});

test('self, absent profile, unknown account and invalid role never send a role write', async () => {
  const h = setup(); await editable(h, 'current-admin');
  await assert.rejects(h.service.assignRole('current-admin', 'technician'), /own role/);
  await editable(h);
  await assert.rejects(h.service.assignRole('other', 'technician'), /existing profile/);
  await assert.rejects(h.service.assignRole('target', 'unknown'), /valid role/);
  h.respond({ data: [{ id: 'missing', profile_exists: false }], error: null });
  await h.service.loadAccounts('missing');
  await assert.rejects(h.service.assignRole('missing', 'admin'), /existing profile/);
  assert.equal(h.writeCalls.length, 0);
});

test('role write surfaces backend denial, missing migration/profile and uncertain results', async () => {
  for (const [response, message] of [
    [{ data: null, error: { code: '42501' } }, /denied/],
    [{ data: null, error: { code: 'PGRST202' } }, /deploy/],
    [{ data: null, error: { code: 'P0002' } }, /no longer exists/],
    [{ data: null, error: { code: 'unavailable' } }, /could not be confirmed/],
    [{ data: 'customer', error: null }, /could not be confirmed/],
    [() => { throw new Error('transport failure'); }, /result is unknown/],
  ]) {
    const h = setup(); await editable(h); h.writeRespond(response);
    await assert.rejects(h.service.assignRole('target', 'technician'), message);
    assert.equal(h.service.getAccountById('target').role, 'customer');
  }
});

test('role timeout is bounded, rejects duplicate saves and releases busy state', async () => {
  const h = setup({ fakeTimers: true }); await editable(h);
  let resolve;
  h.writeRespond(() => new Promise(r => { resolve = r; }));
  const pending = h.service.assignRole('target', 'technician');
  await assert.rejects(h.service.assignRole('target', 'admin'), /in progress/);
  h.expire();
  await assert.rejects(pending, /result is unknown/);
  assert.equal(h.writeCalls[0].signal.aborted, true);
  resolve({ data: 'technician', error: null });
  await flush();
  assert.equal(h.service.getAccountById('target').role, 'customer');
  h.writeRespond({ data: 'technician', error: null });
  await h.service.assignRole('target', 'technician');
});

test('auth switch aborts an in-flight role request and ignores its completion', async () => {
  const h = setup(); await editable(h);
  let resolve;
  h.writeRespond(() => new Promise(r => { resolve = r; }));
  const pending = h.service.assignRole('target', 'technician');
  await flush();
  h.transition();
  assert.equal(h.writeCalls[0].signal.aborted, true);
  resolve({ data: 'technician', error: null });
  await assert.rejects(pending, /context changed/);
  assert.equal(h.service.getAccountById('target'), undefined);
});

test('name mapping uses stored full name for blank split fields and preserves missing names', () => {
  const h = setup();
  const full = h.map({ first_name: '   ', last_name: ' ', full_name: ' Actual Person ' });
  assert.equal(full.firstName, 'Actual Person');
  assert.equal(full.lastName, '');
  const lastOnly = h.map({ first_name: ' ', last_name: ' Person ', full_name: 'Actual Person' });
  assert.equal(lastOnly.firstName, '');
  assert.equal(lastOnly.lastName, 'Person');
  const missing = h.map({ first_name: ' ', last_name: null, full_name: null, email: 'real@example.com' });
  assert.equal(missing.firstName, '');
  assert.equal(missing.lastName, '');
});

async function statusAccount(h, active = true, id = 'target') {
  h.respond({ data: [{ id, role: 'customer', active, profile_exists: true }], error: null });
  await h.service.loadAccounts(id);
}

test('activation writes exact UUID/boolean and reloads real detail, list and counts', async () => {
  const h = setup(); await statusAccount(h);
  h.writeRespond({ data: false, error: null });
  await h.service.setActive('target', false);
  assert.equal(h.writeCalls[0].name, 'admin_set_account_active');
  assert.equal(h.writeCalls[0].args.account_id, 'target');
  assert.equal(h.writeCalls[0].args.new_active, false);
  assert.equal(h.service.getAccountById('target').isActive, true, 'no local pretend save');
  h.respond({ data: [{ id: 'target', active: false, profile_exists: true }, { id: 'admin', active: true, profile_exists: true }], error: null });
  await h.service.reloadAccountViews('target');
  const page = pageFor(h.service);
  assert.equal(h.service.getAccountById('target').isActive, false);
  assert.equal(page.accounts.length, 2); assert.equal(page.activeCount, 1); assert.equal(page.inactiveCount, 1);
  h.writeRespond({ data: true, error: null }); await h.service.setActive('target', true);
  assert.equal(h.writeCalls[1].args.new_active, true);
});

test('status self, missing profile, unknown status and invalid input are blocked before RPC', async () => {
  const h = setup(); await statusAccount(h, true, 'current-admin');
  await assert.rejects(h.service.setActive('current-admin', false), /own active status/);
  await statusAccount(h, null);
  await assert.rejects(h.service.setActive('target', true), /known status/);
  await statusAccount(h);
  await assert.rejects(h.service.setActive('target', 'true'), /valid active status/);
  await assert.rejects(h.service.setActive('missing', true), /known status/);
  h.respond({ data: [{ id: 'missing', active: true, profile_exists: false }], error: null });
  await h.service.loadAccounts('missing');
  await assert.rejects(h.service.setActive('missing', false), /profile/);
  assert.equal(h.writeCalls.length, 0);
});

test('status denial/missing deployment/profile and uncertain response surface safe errors', async () => {
  for (const [result, pattern] of [
    [{ data: null, error: { code: '42501' } }, /denied/],
    [{ data: null, error: { code: 'PGRST202' } }, /not available/],
    [{ data: null, error: { code: 'P0002' } }, /no longer exists/],
    [{ data: true, error: null }, /could not be confirmed/],
    [() => { throw new Error('transport failure'); }, /result is unknown/],
  ]) {
    const h = setup(); await statusAccount(h); h.writeRespond(result);
    await assert.rejects(h.service.setActive('target', false), pattern);
    assert.equal(h.service.getAccountById('target').isActive, true);
  }
});

test('status deadline and identity switch abort writes; concurrent role/status saves are blocked', async () => {
  const h = setup({ fakeTimers: true }); await statusAccount(h);
  let resolve; h.writeRespond(() => new Promise(r => { resolve = r; }));
  const pending = h.service.setActive('target', false); await flush();
  await assert.rejects(h.service.setActive('target', true), /in progress/);
  await assert.rejects(h.service.assignRole('target', 'technician'), /in progress/);
  h.expire(); await assert.rejects(pending, /result is unknown/);
  assert.equal(h.writeCalls[0].signal.aborted, true);
  resolve({ data: false, error: null }); await flush();
  assert.equal(h.service.getAccountById('target').isActive, true);
  const switched = h.service.setActive('target', false); await flush();
  h.transition('SIGNED_IN', { user: { id: 'another-admin' } });
  resolve({ data: false, error: null });
  await assert.rejects(switched, /context changed/);
  assert.equal(h.service.getAccountById('target'), undefined);
});

test('failed reload after status save exposes read error rather than displaying invented success data', async () => {
  const h = setup(); await statusAccount(h);
  h.writeRespond({ data: false, error: null }); await h.service.setActive('target', false);
  h.respond({ data: null, error: { code: '42501' } });
  await h.service.reloadAccountViews('target');
  assert.equal(h.service.getAccountById('target'), undefined);
  assert.equal(h.service.getAccounts().length, 0);
  assert.ok(h.service.error); assert.equal(h.service.loading, false);
});
