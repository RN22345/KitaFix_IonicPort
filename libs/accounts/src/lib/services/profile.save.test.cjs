const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { signal, computed } = require('@angular/core');
function compile(path) { return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText; }
const profileCode = compile(__dirname + '/profile.ts');
const authCode = compile(__dirname + '/accounts-auth.ts');
function setup({ updateError = null, fakeTimers = false, realFrom, metadataError = null } = {}) {
  let callback, timer;
  let user = { id: 'own', email: 'actual@example.com' };
  let row = { id: 'own', first_name: 'Before', last_name: 'Person', role: 'admin', active: true,
    contact_no: '09171234567', address: '', birthday: '2000-01-01', gender: 'other' };
  const writes = [], reads = [], metadataWrites = [];
  let readOverride, writeOverride;
  const core = { signal, Injectable: () => x => x, InjectionToken: class {} };
  const profileExports = {};
  vm.runInNewContext(profileCode, { exports: profileExports, require: () => core });
  const profile = new profileExports.ProfileService();
  const client = {
    auth: {
      onAuthStateChange(fn) { callback = fn; },
      async getUser() { return { data: { user }, error: null }; },
      async updateUser(input) {
        metadataWrites.push(input);
        if (metadataError) return { data: { user: null }, error: metadataError };
        user = { ...user, user_metadata: { ...user.user_metadata, ...input.data } };
        return { data: { user }, error: null };
      },
    },
    from(table) {
      if (realFrom) return realFrom(table);
      assert.equal(table, 'profiles'); let payload, id;
      return {
        update(value) { payload = value; return this; },
        select(value) { assert.equal(value, '*'); return this; },
        eq(key, value) { assert.equal(key, 'id'); id = value; return this; },
        abortSignal() { return this; },
        async single() {
          if (!payload) { reads.push(id); return readOverride ? readOverride() : { data: { ...row }, error: null }; }
          writes.push({ id, payload });
          if (writeOverride) return writeOverride();
          if (updateError) return { data: null, error: updateError };
          assert.equal(id, user.id);
          row = { ...row, ...payload };
          return { data: { ...row }, error: null };
        },
      };
    },
  };
  const exports = {};
  vm.runInNewContext(authCode, {
    exports, Error, AbortController,
    setTimeout: fakeTimers ? fn => { timer = fn; return 1; } : setTimeout,
    clearTimeout: fakeTimers ? () => { timer = undefined; } : clearTimeout,
    require: name => name === '@angular/core' ? { ...core, inject: token => token === profileExports.ProfileService ? profile : client }
      : name === './profile' ? profileExports
      : name === './login-timing' ? { timeLoginStage: (_, fn) => fn() } : {},
  });
  return { auth: new exports.AccountsAuthService(), profile, writes, reads, metadataWrites,
    setRow: value => { row = { ...row, ...value }; },
    setUser: value => { user = value; },
    onRead: fn => { readOverride = fn; }, onWrite: fn => { writeOverride = fn; },
    transition: (event = 'SIGNED_OUT', session = null) => callback(event, session),
    expire: () => { assert.ok(timer); timer(); },
  };
}
const changes = { firstName: ' After ', lastName: ' Person ', contactNo: '09179999999',
  address: ' Actual address ', birthday: '2000-02-02', gender: 'female' };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('confirmed profile synchronizes only name metadata, including legacy aliases', async () => {
  const h = setup(); h.setUser({ id: 'own', email: 'actual@example.com', user_metadata: { name: 'Old', full_name: 'Old', display_name: 'Old', role: 'customer' } });
  await h.auth.getAccountRole();
  assert.equal(await h.auth.saveOwnProfile('own', changes), true);
  assert.equal(h.metadataWrites.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.metadataWrites[0])), { data: {
    first_name: 'After', last_name: 'Person', full_name: 'After Person', name: 'After Person', display_name: 'After Person',
  } });
});

test('metadata failure reports partial success and retry never PATCHes profiles again', async () => {
  const h = setup({ metadataError: { message: 'network error' } }); await h.auth.getAccountRole();
  assert.equal(await h.auth.saveOwnProfile('own', changes), false);
  assert.equal(h.profile.profile.firstName, 'After'); assert.equal(h.writes.length, 1);
  assert.equal(await h.auth.retryProfileNameSync('own'), false);
  assert.equal(h.writes.length, 1); assert.equal(h.metadataWrites.length, 2);
});

test('failed profile save never attempts metadata sync', async () => {
  const h = setup({ updateError: { code: '42501' } }); await h.auth.getAccountRole();
  await assert.rejects(h.auth.saveOwnProfile('own', changes)); assert.equal(h.metadataWrites.length, 0);
});

test('save persists allowlisted fields and reactive My Account stays populated after guard revalidation', async () => {
  const h = setup();
  const view = computed(() => ({ name: h.profile.profile.firstName, email: h.auth.account?.email,
    role: h.auth.account?.role, phone: h.profile.profile.contactNo }));
  assert.equal(view().name, '');
  await h.auth.getAccountRole(); assert.equal(view().name, 'Before');
  await h.auth.saveOwnProfile('own', { ...changes, role: 'customer', active: false, id: 'other', email: 'fake@example.com' });
  assert.equal(h.writes[0].id, 'own');
  assert.deepEqual(Object.keys(h.writes[0].payload).sort(), ['address', 'birthday', 'contact_no', 'first_name', 'full_name', 'gender', 'last_name']);
  assert.equal(h.writes[0].payload.first_name, 'After');
  assert.equal(h.writes[0].payload.full_name, 'After Person');
  assert.equal(view().name, 'After'); assert.equal(view().role, 'admin');
  await h.auth.getAccountRole();
  assert.equal(view().name, 'After'); assert.equal(view().email, 'actual@example.com');
  assert.equal(view().phone, '09179999999'); assert.equal(h.profile.profile.address, 'Actual address');
  assert.ok(h.reads.length >= 4, 'includes independent persisted-row reload');
  assert.equal(h.auth.profileSaveDiagnostics().stage, 'confirmed');
  assert.equal(h.auth.profileSaveDiagnostics().persistedValuesMatch, true);
});

test('zero rows, mismatched update identity and unconfirmed reload never publish edited data', async () => {
  for (const result of [
    { data: null, error: null },
    { data: null, error: { code: 'PGRST116' } },
    { data: { id: 'another-user' }, error: null },
  ]) {
    const h = setup(); await h.auth.getAccountRole(); h.onWrite(async () => result);
    await assert.rejects(h.auth.saveOwnProfile('own', changes));
    assert.equal(h.profile.profile.firstName, 'Before');
  }
  for (const mode of ['mismatch', 'denied', 'wrong-id']) {
    const h = setup(); await h.auth.getAccountRole();
    h.onWrite(async () => {
      h.onRead(async () => mode === 'denied' ? { data: null, error: { code: '42501' } }
        : { data: { id: mode === 'wrong-id' ? 'another-user' : 'own', first_name: 'Before', role: 'admin', active: true }, error: null });
      return { data: { id: 'own' }, error: null };
    });
    await assert.rejects(h.auth.saveOwnProfile('own', changes), /reloaded|does not match/);
    assert.equal(h.profile.profile.firstName, 'Before');
  }
});

test('signout while persistence reload is pending prevents cache publication', async () => {
  const h = setup(); await h.auth.getAccountRole(); let resolve, started;
  const reading = new Promise(r => { started = r; });
  h.onWrite(async () => {
    h.onRead(() => new Promise(r => { resolve = r; started(); }));
    return { data: { id: 'own' }, error: null };
  });
  const pending = h.auth.saveOwnProfile('own', changes); await reading; h.transition();
  resolve({ data: { id: 'own' }, error: null });
  await assert.rejects(pending, /could not be confirmed/);
  assert.equal(h.profile.profile.id, '');
});

test('same-account guard does not blank an existing profile while waiting', async () => {
  const h = setup(); await h.auth.getAccountRole();
  let resolve; h.onRead(() => new Promise(r => { resolve = r; }));
  const pending = h.auth.getAccountRole(); await flush();
  assert.equal(h.profile.profile.firstName, 'Before');
  assert.equal(h.auth.account.email, 'actual@example.com');
  resolve({ data: { id: 'own', active: true, role: 'admin', first_name: 'Fresh' }, error: null });
  await pending; assert.equal(h.profile.profile.firstName, 'Fresh');
});

test('RLS/schema failure preserves stored profile and reports failed save', async () => {
  for (const code of ['42501', 'PGRST204']) {
    const h = setup({ updateError: { code } }); await h.auth.getAccountRole();
    await assert.rejects(h.auth.saveOwnProfile('own', changes), /could not be saved/);
    assert.equal(h.profile.profile.firstName, 'Before');
  }
});

test('save distinguishes schema, permissions, invalid fields and network failures without exposing backend values', async () => {
  for (const [code, expected] of [
    ['PGRST204', /database needs an update.*0095/], ['42703', /database needs an update/],
    ['42501', /update access could not be confirmed/], ['PGRST116', /update access could not be confirmed/],
    ['23514', /database requirements/], ['22007', /database requirements/],
    ['', /connection problem/], ['PGRST000', /connection problem/],
  ]) {
    const h = setup({ updateError: { code, message: 'PRIVATE DATABASE VALUE' } });
    await h.auth.getAccountRole();
    await assert.rejects(h.auth.saveOwnProfile('own', changes), error => {
      assert.match(error.message, expected); assert.doesNotMatch(error.message, /PRIVATE DATABASE VALUE/); return true;
    });
    assert.equal(h.profile.profile.firstName, 'Before');
  }
});

test('original Supabase response remains available as error cause without publishing raw details', async () => {
  const raw = { code: '42501', message: 'backend detail', details: 'private value', hint: 'check policy' };
  const h = setup({ updateError: raw }); await h.auth.getAccountRole();
  await assert.rejects(h.auth.saveOwnProfile('own', changes), error => {
    assert.equal(error.cause, raw); assert.doesNotMatch(error.message, /private value|backend detail/); return true;
  });
  const diagnostic = h.auth.profileSaveDiagnostics();
  assert.equal(diagnostic.code, '42501'); assert.equal(diagnostic.identityMatches, true);
  assert.equal(diagnostic.active, true); assert.equal(diagnostic.returnedIdentityMatches, false);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private value|actual@example.com/);
});

test('real Supabase SDK sends personal-only PATCH for authenticated UUID and independently GETs persisted values', async () => {
  const { createClient } = require('@supabase/supabase-js');
  let row = { id: 'own', role: 'admin', active: true, first_name: 'Before', last_name: 'Person',
    contact_no: '09171234567', address: '', birthday: '2000-01-01', gender: 'other' };
  const requests = [];
  const client = createClient('https://tiqgxpnnzpxpibwwzjzb.supabase.co', 'synthetic-public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const parsed = new URL(url); const method = init.method;
      requests.push(method);
      assert.equal(parsed.origin, 'https://tiqgxpnnzpxpibwwzjzb.supabase.co');
      assert.equal(parsed.pathname, '/rest/v1/profiles');
      assert.equal(parsed.searchParams.get('id'), 'eq.own');
      if (method === 'PATCH') {
        const payload = JSON.parse(init.body);
        assert.deepEqual(Object.keys(payload).sort(), ['address', 'birthday', 'contact_no', 'first_name', 'full_name', 'gender', 'last_name']);
        row = { ...row, ...payload };
      }
      return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const h = setup({ realFrom: client.from.bind(client) });
  await h.auth.getAccountRole(); await h.auth.saveOwnProfile('own', changes);
  assert.deepEqual(requests, ['GET', 'GET', 'PATCH', 'GET']);
  assert.equal(h.profile.profile.firstName, 'After');
  assert.equal(h.auth.profileSaveDiagnostics().status, 200);
  assert.equal(h.auth.profileSaveDiagnostics().stage, 'confirmed');
});

test('wrong identity, inactive and missing profile cannot send profile updates', async () => {
  for (const state of ['wrong', 'inactive', 'missing']) {
    const h = setup(); await h.auth.getAccountRole();
    if (state === 'inactive') h.setRow({ active: false });
    if (state === 'missing') h.onRead(async () => ({ data: null, error: null }));
    await assert.rejects(h.auth.saveOwnProfile(state === 'wrong' ? 'other' : 'own', changes));
    assert.equal(h.writes.length, 0);
  }
});

test('logout during profile revalidation cannot restore old identity', async () => {
  const h = setup(); await h.auth.getAccountRole();
  let resolve; h.onRead(() => new Promise(r => { resolve = r; }));
  const pending = h.auth.getAccountRole(); await flush(); h.transition();
  resolve({ data: { active: true, role: 'admin', first_name: 'Old' }, error: null });
  await assert.rejects(pending, /session changed/);
  assert.equal(h.profile.profile.id, ''); assert.equal(h.auth.account, null);
});

test('pending save times out, blocks duplicate submissions and ignores late result', async () => {
  const h = setup({ fakeTimers: true }); await h.auth.getAccountRole();
  let resolve; h.onWrite(() => new Promise(r => { resolve = r; }));
  const pending = h.auth.saveOwnProfile('own', changes); await flush();
  await assert.rejects(h.auth.saveOwnProfile('own', changes), /in progress/);
  h.expire(); await assert.rejects(pending, /result is unknown/);
  resolve({ data: { active: true, role: 'admin', first_name: 'Too late' }, error: null });
  await flush(); assert.equal(h.profile.profile.firstName, 'Before');
});
