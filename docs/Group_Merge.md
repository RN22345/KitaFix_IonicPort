# Group merge: Teams 1, 2, 3 and 4

Branch `merge/all-teams`, from `main` (d062d7c).

| Team | Source | Base it started from | What came in |
|---|---|---|---|
| 1 (Group A) - Accounts | `origin/group-a` (e5d00c0) | 687cae2 (PR #14, before 0024) | `libs/accounts`, migrations 0091-0096, Capacitor/Android, network toast |
| 2 - Booking (ours) | `main` | - | unchanged except the glue below |
| 3 - Repair Ops | `github.com/Dominic-one/Software-Dev` main (aa392e4), no shared history | deae951 (9 Oct, before the booking redesign and 0022-0024) | `libs/repair-ops`, migrations 0030-0032, shared-types additions |
| 4 - Insights | `KitaFix_Team4.zip` (no git history) | cf11d0a (PR #16) | `libs/insights`, migration 0040 |

Teams 3 and 4 had no shared git history. For each, the snapshot was compared with every `main` commit to find its starting point. Only the files they added or changed were brought in, and the shared shell files were merged by hand.

## App map

| Path | Who | Guard | Shell |
|---|---|---|---|
| `/accounts-*` | Team 1 | Team 1 guards | none (own pages) |
| `/tabs/...` | Team 2 booking + Team 4 `leave-review/:repairId` | customer | `src/app/tabs` |
| `/admin` | Team 4 Overview / Insights | admin | Team 4 `staff-shell` (tabs: Overview, Insights, Repairs, Accounts) |
| `/ops/...` | Team 3 Portal / Queue / Services | admin or technician | `src/app/ops` (Team 3's tab bar, moved off `/tabs`) |

Landing after login (`accountLoginDestination`): customer `/tabs`, admin `/admin`, technician `/ops/repair-queue`.

## Glue changed during the merge

- **Routes and shells:** Team 1's login is the entry point and `dev-login` / `src/app/shared/session/` are gone. Team 4's `/admin` now checks the admin role; it used to check only that someone was signed in. Team 3 had taken over `/tabs` for its own tab bar, so that bar moved to `src/app/ops/ops-tabs.page.ts` at `/ops`. Team 3's header-title CSS was global in their repo and is now scoped to `/ops`. Their two hard-coded `/tabs/repair-queue` links now point to `/ops/repair-queue`.
- **Navigation between teams:**
  - Team 2's profile sheet has "My account" and signs out to `/accounts-login`.
  - My Account has a back button: customers go to `/tabs`, technicians to `/ops/repair-queue`. Admins also get an "Overview" tab there.
  - Team 4's admin bar has "Repairs" (`/ops`) and "Accounts".
  - Team 3's bar has "Overview" for admins and "Account" for technicians.
- **Reviews:** Team 2's Repair Detail had a star rating saved only in localStorage. It now shows "Leave a review", which opens Team 4's page (`public.reviews`). Follow-up: the star on Team 2's repair card still reads the old local rating.
- **Team 3 role check:** their session code looked for a `'staff'` profile role, which no longer exists after 0024. It now checks `'admin'`. The module's own names were renamed to match (`adminOnlyGuard`, `INSIGHTS_ADMIN_ROUTES`, actor role `'admin'`).
- **Shared types:** Team 3's additions (the `repairs` snapshot columns, `repair_ops_history`, `repair_service_logs`, `repair_status_events`, `t3_*` functions) were patched onto main's newer generated file. The 3-role `user_role` enum was kept. Team 2's mock repairs got the 3 new columns.
- **tsconfig** gained `@kitafix/accounts`, `@kitafix/insights` and `@kitafix/repair-ops`.
- **Supabase key:** Team 1 had switched to an `sb_publishable_...` key. The merge keeps `main`'s anon key, which is known to work. Switch only once someone confirms the publishable key belongs to project `pkfataaehrjdipdbrthz`.

## Database

Run order on a fresh database: 0001, 0002 (stub, kept), 0020-0025, **0030-0032 (Team 3)**, **0040 (Team 4)**, **0091 (Team 1, exported from hosted)**, **0092 (profile privacy)**, **0093 (one set of admin functions)**, **0097 (merge fix)**.

- **0030-0032 (Team 3)** were written before 0024 and called `public.is_staff()` 10 times. That function is dropped by 0024, so they would fail. They were ported: `is_staff()` became `(select public.is_admin())`, and the `*_staff_*` policies became `*_admin_*`. The logic is unchanged, and each file has a merge note at the top.
  - Stub 0090 was deleted. Its policies are a subset of 0030.
  - Stub 0002 stays, because 0020's `repairs.service_id` foreign key needs `services` to exist first, and 0030 uses `create if not exists`.
- **0040 (Team 4)** already used the 0024 names. No conflicts.
- **0091 (Team 1)** replaces Team 1's old 0091-0096 and the stopgap 0098. Team 1 built their part by hand on hosted, so the repo files no longer matched; 0091 is the live definitions copied from hosted (see "Database audit" below).
  - `admin_assign_account_role` / `admin_set_account_active` overlapped 0024's `set_user_role` / `set_user_active`. Decision (27 Nov): keep Team 1's, which the app uses. 0093 drops the 0024 pair.
- **0097 (merge fix):**
  1. Grants UPDATE on Team 1's profile columns. 0024 allowed only `full_name, phone, avatar_url`, so Edit Profile would fail with 42501.
  2. A trigger on `profiles.role` keeps `technicians` in step whichever admin function changed the role. This matters for Team 3: an account promoted from Team 1's screen must exist in `technicians` before it can be assigned in the queue.
- **Triggers on `repairs` now stack up across teams:** Team 2's guard, date rule and active-limit; Team 3's status machine, snapshot, started-at, reschedule guard and history. I read through them and found no rule conflicts: only pending repairs can be rescheduled (same as Team 2's UI), the service never changes after booking (Team 2 never does that), and customers can cancel a pending repair. This should still be tested on a real database.
- `0025_team2_perf.sql` was on hosted but only on the local `chore/orchestra` branch. It is now in the repo too.

## Overlaps for the group to decide

- **Team 3 Admin Portal vs Team 4 Overview.** Both show summary cards and the latest repairs. Plan v5 gave the summary cards to Team 4. Both are kept for now.
- **Team 3 `repair_status_events` vs Team 4 `v_repair_status_summary`.** Both feed reporting. They don't conflict, but Team 4 could read Team 3's feed for trends.
- **Two sets of admin role functions** (see Database above).
- **Three bottom bars:** customer, `/admin` and `/ops`, plus Team 1's own `.acc-tabbar`. See `docs/UI_Unification_Plan.md`.

## Questions for the teams

- **Team 1:** please make database changes through migration files, not by hand on hosted (rule R2); 0091 is now your file to own. Pages are deep-imported; please export `ACCOUNTS_ROUTES`. 32 of 83 `node --test` cases already fail on `group-a` itself.
- **Team 3:** your `environment.ts` points at our hosted project. Did you apply 0030-0032 there? After 23 Oct they would have failed on `is_staff()`. If you applied them before that, 0024's drop of `is_staff()` would have failed instead, so they are most likely not on hosted. Please confirm. Also, no tests were included.
- **Team 4:** none.

## Fixes after the merge (branch `fix/integration-audit`)

Reported on the live demo after #26:

| Symptom | Cause | Fix |
|---|---|---|
| Repairs / Accounts tabs open a GitHub 404 | The merge's cross-area tab buttons used a bare `href="/ops"`. A tab button without `tab` is a plain link, so it ignores `<base href="/KitaFix_IonicPort/">`. | No `href`; `(click)` goes through the Angular router (Team 4 `staff-shell`, `src/app/ops`) |
| Opened straight into the admin area, no logout | The browser still had a saved session from an earlier admin login. The login page sends a signed-in user to their home on purpose. The admin/ops bars had no account or logout entry. | "Me" tab in both bars opens My Account (shows the account, has Log out) |
| Previous user's data or role after switching accounts | Team 2 repairs, Team 3's actor (cached forever) and Team 4's admin data live in app-wide services. Team 1's logout did not reload. | My Account logout reloads, and `AppComponent` reloads if a different user signs in |
| `Could not find the table 'public.reviews'` | Migrations 0030-0032 and 0040 were never applied to hosted. The same goes for Team 3's queue tables and Team 1's admin RPCs. | Apply them (steps below) |
| (found in audit) Picture upload, deactivate, terms | `avatars` bucket, `deactivate_own_account`, `record_terms_acceptance` were created by no migration | now part of `0091_accounts_live_export.sql` |

Audit checks that found nothing else:
- every `href`, `location` and `reload` in `src/` and `libs/`
- every table, view and RPC the code calls, against the migrations
- every explicit column list
- the route guards
- logout reachable from every area
- auth redirect URLs (Team 1 uses OTP codes, so there are none)

### Applying the database changes to hosted

**What hosted already has (read-only inspection, 27 Nov).** Migrations 0001-0025 and 0090 are recorded. Team 1 had also applied their own, newer version of their Accounts work by hand, so none of it is recorded as a migration:
- profile columns, including `account_no`, `terms_*`, `address` and `birthday`
- `admin_read_accounts` (which returns `account_no`, matching the app code), `admin_assign_account_role(uuid, user_role)`, `admin_set_account_active`, `deactivate_own_account`, `record_terms_acceptance`, `generate_account_no` and the `profiles_account_no` trigger
- the `avatars` bucket and its policies

**Not on hosted:** Team 3 (0030-0032), Team 4 (0040), 0097. Team 1's old repo files (sign-up trigger `accounts_on_signup`, `protect_profile_account_access`, restrictive "active" policies) were never on hosted and are retired; Team 1 instead rewrote the body of the stub sign-up function `t1_stub_handle_new_user`, which 0091 keeps.

**0091 on hosted** re-creates the same objects with the same bodies, so it changes nothing except: `admin_read_accounts` now also requires the calling admin to be active, and the two overlapping avatar policy sets become one set with the same rules.

Needs a Supabase personal access token with Database and Migrations set to read-write. Project ref `pkfataaehrjdipdbrthz`. Run from the repo root in PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN='sbp_...'
$m = 'supabase/migrations'
$files = "$m/0030_team3_repair_ops.sql","$m/0031_team3_repair_ops_features.sql","$m/0032_team3_service_history.sql","$m/0040_team4_insights.sql","$m/0091_accounts_live_export.sql","$m/0097_merge_accounts_reconcile.sql"
node tools/supabase/dry-run-sql.mjs pkfataaehrjdipdbrthz @files   # 1. nothing is kept
node tools/supabase/apply-sql.mjs  pkfataaehrjdipdbrthz @files   # 2. only if step 1 says OK
node tools/supabase/gen-types.mjs  pkfataaehrjdipdbrthz          # 3. refresh libs/shared-types
```

These six were applied on 27 Nov. **0092 (privacy)** was applied after them, also on 27 Nov, once the app code that reads `my_profile` was deployed (33a7eb2). For a future one-off file:

```powershell
$f = 'supabase/migrations/0092_profiles_privacy.sql'
node tools/supabase/dry-run-sql.mjs pkfataaehrjdipdbrthz $f
node tools/supabase/apply-sql.mjs  pkfataaehrjdipdbrthz $f
node tools/supabase/gen-types.mjs  pkfataaehrjdipdbrthz
```

`node tools/supabase/inspect-hosted.mjs pkfataaehrjdipdbrthz [--full --out hosted-full.json]` prints the read-only report again (structure only, no data; the JSON is gitignored).

### Database audit (27 Nov, repo vs hosted vs code vs types)

Matches:
- every table, view and RPC the code calls exists in the migrations; every RPC parameter name matches hosted
- every repair status in code is one of the 5 `repair_status` values
- profile column grants: users can edit their own name, contact, address, birthday, gender and picture, never `role` or `active`

Fixed:
- leftover `staff` naming in Team 3/4 code (`staffOnlyGuard`, `INSIGHTS_STAFF_ROUTES`, actor role `'staff'`) renamed to `admin`; Module Plan v4 R5 said `is_staff()`
- Team 1's live objects (9 profile columns incl. `account_no`, 7 functions, the account-number trigger, `avatars` bucket) existed on hosted only; now in 0091
- 0025 existed on hosted only; now in the repo
- `admin_read_accounts` let a switched-off admin list all accounts
- `libs/shared-types` lacked Team 1's columns/RPCs and Team 4's `reviews` + views: regenerate with step 3 after applying

- **Privacy (0092):** policy `profiles_read_authenticated` (0024) let every signed-in user read every profile row, and after Team 1 that included `address`, `birthday`, `gender`, `contact_no` and `account_no`. Fixed; see "What changed for each group" below.

- **One set of admin functions (0093):** 0024's unused `set_user_role` / `set_user_active` are dropped; Team 1's `admin_assign_account_role` / `admin_set_account_active` are the only way to change a role or switch an account on/off. `admin_set_account_active` now also sets `updated_at`; error messages are plainer, error codes unchanged.

## What changed for each group (27 Nov, after the merge)

**Everyone**
- Personal data is private now (migration 0092). Through the `profiles` table, a signed-in user can read only `id, full_name, avatar_url, role, active, created_at, updated_at`, and only for: their own row, shop staff (technicians and admins), and, for a technician, the customers on repairs assigned to them. Admins see all rows. Phone, contact number, address, birthday, gender, account number and terms fields are never readable through the table.
  - Your own full row: `from('my_profile').select('*')` (a view that returns only the caller's row).
  - Someone else's details (admin only): `rpc('admin_read_accounts')`.
  - If your screen needs another personal field of someone else, ask for an RPC that checks who is asking. Do not widen the grant.
- `libs/shared-types` is now generated from hosted. After every migration: `node tools/supabase/gen-types.mjs <ref>` (see `tools/supabase/`). Do not edit `database.generated.ts` by hand.
- The role is `admin` everywhere (0024 merged staff into admin). The database helper is `is_admin()`; `is_staff()` no longer exists.

**Team 1 - Accounts**
- Your database work existed only on hosted (made by hand), and the repo's 0091-0096 no longer matched it. It is now exported into `0091_accounts_live_export.sql`, and the old files are removed. Please make future changes as new migration files (rule R2).
- `admin_read_accounts` now also requires the calling admin to be active, like your other admin functions.
- Your admin functions are now the only ones (0093 drops 0024's `set_user_role` / `set_user_active`). `admin_set_account_active` also sets `updated_at`. The messages are plainer, but the codes your screens check (42501, P0002) are unchanged.
- The two overlapping avatar policy sets are merged into one set (`avatars_*_own`) with the same rules, plus delete.
- `accounts-auth.ts`: the three own-profile reads go through `readOwnProfile()`, which reads `my_profile`. The Edit Profile save asks back only `id` (`.select('id')`).
- Tests: the fakes in `profile.save.test.cjs` and `accounts-auth.login.test.cjs` now expect `my_profile` for reads. Still 51 of 83 pass; the same 32 failed before the merge on `group-a`.
- If you add a column to `profiles`: decide if it is personal. If others may read it, add it to the grant in a new migration. Either way, re-create `my_profile` so it includes the column.

**Team 2 - Booking (us)**
- `0025_team2_perf.sql` (on hosted since 18 Nov) is now in the repo.
- No code change. The technician picker and current-user read only use name and role.

**Team 3 - Repair Ops**
- Renamed to match the single admin role: `staffOnlyGuard` -> `adminOnlyGuard` (`guards/admin-only.guard.ts`), `requireStaff` -> `requireAdmin`, `isStaff` -> `isAdmin`, `RepairOpsRole` `'staff'` -> `'admin'`, `mockRole` `'admin'`, mock ids `mock-admin`. The messages now say "admin".
- `repair-ops.repository.ts`: the history rows are cast to `RawHistoryRow`, the same way queue rows already are. The generated type has `event_type: string`, and the table's check constraint still limits it to your values.
- Technicians now see customer names only on repairs assigned to them, and never a customer's phone or address.

**Team 4 - Insights**
- Renamed: `INSIGHTS_STAFF_ROUTES` -> `INSIGHTS_ADMIN_ROUTES` (`admin.routes.ts`), `StaffShellPage` -> `AdminShellPage` (`pages/admin/admin-shell.page.ts`, selector `app-insights-admin-shell`).
- The report views and admin screens are unaffected: admins can still read every name.

## Second pass (27 Nov): one customer view, anonymous reviews, calmer tab bar

**Everyone**
- Reviews are now shown to all signed-in users, anonymously (migration 0094). The `reviews` table rules from Team 4 are unchanged (own row and admins only). Two new functions return safe copies: `get_public_reviews(p_limit)` gives rating, comment, reply, date, service and technician name, with nothing about the customer (max 20 rows), and `get_technician_ratings()` gives the average and count per technician. Signed-out users get nothing.
- Note: reviews were never the cause of the profile leak. That was 0024's open `profiles` read rule together with Team 1's personal columns (fixed in 0092).
- Technicians made before 0097 had no row in `technicians`, so nobody could be picked on the Book page. `0099_technicians_backfill.sql` adds those rows. It also makes the 0097 trigger react to switching an account on or off: a switched-off technician is no longer bookable, and switching them back on restores it.

**Team 1 - Accounts**
- For customers, My Account, Edit Profile and Change Password now open inside the customer tabs at `/tabs/account`, `/tabs/account/edit` and `/tabs/account/password`, so the tab bar stays visible. The old paths (`/accounts/my-account` and so on) still work: customers are sent to the tab version (`src/app/customer-account.guard.ts`); technicians and admins keep the old pages.
- The customer back button on My Account is removed (the Account tab replaces it). The technician one stays.
- `accounts.scss` colours are now CSS variables with your old colours as fallbacks (`--acc-bg`, `--acc-surface`, `--acc-surface-2`, `--acc-ink`, `--acc-muted`, `--acc-border`, `--acc-tint`). Outside the tabs nothing changes; inside the tabs they follow the app's dark theme. The duplicate `.acc-content--soft` block is removed.
- Because every page includes the whole shared sheet, the per-file style budget limit is raised from 20 kB to 24 kB (`angular.json`).
- `accounts-auth.login.test.cjs`: the route test's `require` fake also accepts `./customer-account.guard` and checks the redirect targets. Still 51 pass / 32 fail, the same set as before.

**Team 2 - Booking (us)**
- Tab bar: four equal tabs (Home, Book, Repairs, Account). The large raised Book button is gone; Book keeps its green icon.
- Home has a "What customers say" section with the newest anonymous reviews and their average. The technician picker shows each technician's rating and review count. Both quietly hide if the functions are missing or fail.
- "My account" in the top menu goes to the Account tab.

**Team 4 - Insights**
- Your table and admin screens are unchanged. Customers now also see reviews (anonymous) through 0094; if you add review fields, decide whether they are safe to show and add them to `get_public_reviews` in a new migration.

## Checks run

- `ng build`: OK. The only warnings are budgets: initial bundle and per-file SCSS.
- `vitest run`: 49/49 pass.
- Team 1 `node --test`: 51 pass, 32 fail, the same as on `group-a` before the merge.
- Not run: migrations on a local stack or on hosted, and a click-through in the browser.
