const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { signal } = require('@angular/core');
const code = ts.transpileModule(fs.readFileSync(__dirname + '/edit-profile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
function setup() {
  class FormBuilder {} class Router {} class ProfileService {} class AccountsAuthService {}
  const profile = { profile: { id: 'own', firstName: 'Before', lastName: 'Person', email: 'actual@example.com',
    contactNo: '09171234567', address: '', birthday: '2000-01-01', gender: 'other' } };
  const calls = [];
  let save = async () => {};
  let navigate = async () => true;
  const fb = { nonNullable: { group(initial) {
    let values = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, value[0]]));
    return { invalid: false, getRawValue: () => values, reset(value) { values = value; }, markAllAsTouched() {} };
  } } };
  const auth = {
    async saveOwnProfile(id, changes) { calls.push({ type: 'save', id, changes }); return save(); },
    async retryProfileNameSync(id) { calls.push({ type: 'sync', id }); return save(); },
  };
  const router = { async navigate(path) { calls.push({ type: 'navigate', path }); return navigate(); } };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === '@angular/core') return { signal, Component: () => x => x,
      inject: token => token === FormBuilder ? fb : token === Router ? router : token === ProfileService ? profile : auth };
    if (name === '@angular/forms') return { FormBuilder, Validators: { required: () => {}, pattern: () => () => {} } };
    if (name === '@angular/router') return { Router };
    if (name === '../../services/profile') return { ProfileService };
    if (name === '../../services/accounts-auth') return { AccountsAuthService, authMessage: error => error.message };
    if (name === '../../validators/birthday') return { getMaxBirthday: () => '2010-01-01', MIN_AGE: 13 };
    return {};
  } });
  return { page: new exports.EditProfilePage(), profile, calls,
    respond: fn => { save = fn; }, navigation: fn => { navigate = fn; } };
}

test('edit waits for confirmed save before returning and prevents duplicate submissions', async () => {
  const h = setup(); let resolve;
  h.respond(() => new Promise(r => { resolve = r; }));
  h.page.submit(); const pending = h.page.confirmSave(); await h.page.confirmSave();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].id, 'own');
  assert.equal(h.page.saving(), true);
  resolve(); await pending;
  assert.equal(h.calls[1].type, 'navigate');
  assert.equal(h.calls[1].path[0], '/accounts-my-account');
  assert.equal(h.page.showConfirm, false); assert.equal(h.page.saving(), false);
});

test('failed save stays on Edit profile, keeps dialog and displays retryable error', async () => {
  const h = setup(); h.respond(async () => { throw new Error('Save failed'); });
  h.page.submit(); await h.page.confirmSave();
  assert.equal(h.calls.length, 1);
  assert.equal(h.page.showConfirm, true); assert.equal(h.page.saveError(), 'Save failed');
  assert.equal(h.page.saving(), false);
});

test('Ionic reentry resets cached form from current profile; invalid form sends no write', async () => {
  const h = setup();
  h.profile.profile = { ...h.profile.profile, firstName: 'Fresh', contactNo: '09179999999' };
  h.page.ionViewWillEnter();
  assert.equal(h.page.form.getRawValue().firstName, 'Fresh');
  assert.equal(h.page.form.getRawValue().contactNo, '09179999999');
  assert.equal(h.page.profile.email, 'actual@example.com');
  h.page.form.invalid = true; await h.page.confirmSave(); assert.equal(h.calls.length, 0);
});

test('navigation failure after a successful save reports that the profile was saved', async () => {
  const h = setup(); h.navigation(async () => false);
  h.page.submit(); await h.page.confirmSave();
  assert.match(h.page.saveError(), /Profile saved/);
  assert.equal(h.page.saving(), false);
});

test('partial save offers metadata-only retry and navigates only when sync is confirmed', async () => {
  const h = setup(); h.respond(async () => false);
  h.page.submit(); await h.page.confirmSave();
  assert.equal(h.page.nameSyncFailed(), true); assert.equal(h.page.showConfirm, false);
  assert.match(h.page.saveError(), /profile was saved, but the Auth display name/);
  assert.equal(h.calls.length, 1);
  await h.page.retryNameSync(); assert.equal(h.page.nameSyncFailed(), true);
  h.respond(async () => true); await h.page.retryNameSync();
  assert.equal(h.page.nameSyncFailed(), false); assert.equal(h.page.saveError(), '');
  assert.equal(h.calls.filter(c => c.type === 'save').length, 1);
  assert.equal(h.calls.at(-1).type, 'navigate');
});
