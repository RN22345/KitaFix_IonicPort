const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { signal } = require('@angular/core');
const code = ts.transpileModule(fs.readFileSync(__dirname + '/account-profile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
function setup({ denied = false, fail = false } = {}) {
  class Router {} class ActivatedRoute {} class AccountsService {}
  const calls = []; let response = async () => { if (fail) throw new Error('Save denied'); };
  const account = { id: 'target', role: 'technician', profileMissing: false, isActive: true };
  const service = {
    getRoles: () => [{ key: 'admin' }, { key: 'technician' }, { key: 'customer' }],
    getAccountById: () => account,
    getRole: key => ({ name: key, permissions: [] }),
    canAssignRole: value => !denied && !value.profileMissing,
    canChangeStatus: value => !denied && !value.profileMissing && typeof value.isActive === 'boolean',
    async setActive(id, active) { calls.push(['status', id, active]); await response(); },
    async reloadAccountViews(id) { calls.push(['reload-all', id]); },
    async assignRole(id, role) { calls.push(['save', id, role]); await response(); },
    async loadAccounts(id) { calls.push(['reload', id]); },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, Error, require: name => {
    if (name === '@angular/core') return { signal, Component: () => x => x,
      inject: token => token === AccountsService ? service : token === ActivatedRoute
        ? { snapshot: { paramMap: { get: () => 'target' } } } : {} };
    if (name === '@angular/router') return { Router, ActivatedRoute };
    if (name === '../../services/accounts') return { AccountsService };
    return {};
  } });
  return { page: new exports.AccountProfilePage(), account, calls, respond: fn => { response = fn; } };
}

test('existing sheet selects actual role, saves UUID, and reloads after confirmed success', async () => {
  const h = setup(); h.page.openRoleSheet(h.account);
  assert.equal(h.page.selectedRole, 'technician');
  assert.equal(h.page.showRoleSheet, true);
  h.page.selectedRole = 'admin'; await h.page.saveRole();
  assert.deepEqual(h.calls, [['save', 'target', 'admin'], ['reload', 'target']]);
  assert.equal(h.page.showRoleSheet, false);
  assert.equal(h.page.savingRole(), false);
});

test('failed save keeps the sheet open, displays error and does not reload', async () => {
  const h = setup({ fail: true }); h.page.openRoleSheet(h.account);
  await h.page.saveRole();
  assert.equal(h.page.showRoleSheet, true);
  assert.equal(h.page.roleError(), 'Save denied');
  assert.equal(h.page.savingRole(), false);
  assert.equal(h.calls.length, 1);
});

test('duplicate submission is blocked while save is pending', async () => {
  const h = setup(); let resolve;
  h.respond(() => new Promise(r => { resolve = r; }));
  h.page.openRoleSheet(h.account);
  const pending = h.page.saveRole(); await h.page.saveRole();
  assert.equal(h.page.savingRole(), true);
  assert.equal(h.calls.length, 1);
  resolve(); await pending;
  assert.equal(h.page.savingRole(), false);
});

test('self/missing profiles cannot open assignment; unknown roles require an explicit choice', async () => {
  const self = setup({ denied: true }); self.page.openRoleSheet(self.account);
  assert.equal(self.page.showRoleSheet, false);
  const h = setup(); h.account.profileMissing = true; h.page.openRoleSheet(h.account);
  assert.equal(h.page.showRoleSheet, false);
  h.account.profileMissing = false; h.account.role = null; h.page.openRoleSheet(h.account);
  assert.equal(h.page.selectedRole, null);
  await h.page.saveRole(); assert.equal(h.calls.length, 0);
});

test('existing status confirmation saves correct boolean and reloads both views after success', async () => {
  for (const active of [true, false]) {
    const h = setup(); h.account.isActive = active;
    h.page.openStatusDialog(h.account); assert.equal(h.page.showStatusDialog, true);
    await h.page.confirmStatusChange(h.account);
    assert.deepEqual(h.calls, [['status', 'target', !active], ['reload-all', 'target']]);
    assert.equal(h.page.showStatusDialog, false); assert.equal(h.page.savingStatus(), false);
  }
});

test('status failure keeps confirmation open with an error and permits retry', async () => {
  const h = setup({ fail: true }); h.page.openStatusDialog(h.account);
  await h.page.confirmStatusChange(h.account);
  assert.equal(h.page.showStatusDialog, true); assert.equal(h.page.statusError(), 'Save denied');
  assert.equal(h.page.savingStatus(), false); assert.equal(h.calls.length, 1);
});

test('status confirmation blocks duplicates and role changes during save', async () => {
  const h = setup(); let resolve; h.respond(() => new Promise(r => { resolve = r; }));
  h.page.openStatusDialog(h.account); const pending = h.page.confirmStatusChange(h.account);
  await h.page.confirmStatusChange(h.account); h.page.openRoleSheet(h.account);
  assert.equal(h.calls.length, 1); assert.equal(h.page.savingStatus(), true);
  assert.equal(h.page.showRoleSheet, false);
  resolve(); await pending; assert.equal(h.page.savingStatus(), false);
});

test('status self, unknown status, missing profiles and unconfirmed calls send no write', async () => {
  const denied = setup({ denied: true }); denied.page.openStatusDialog(denied.account);
  assert.equal(denied.page.showStatusDialog, false);
  const h = setup(); await h.page.confirmStatusChange(h.account);
  h.account.isActive = null; h.page.openStatusDialog(h.account);
  assert.equal(h.page.showStatusDialog, false);
  h.account.isActive = true; h.account.profileMissing = true; h.page.openStatusDialog(h.account);
  assert.equal(h.page.showStatusDialog, false); assert.equal(h.calls.length, 0);
});
