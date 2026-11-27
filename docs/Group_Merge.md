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
- **Team 3 role check:** their session code looked for a `'staff'` profile role, which no longer exists after 0024. It now checks `'admin'`. Inside the module, the actor is still called `'staff'`; renaming that is cosmetic.
- **Shared types:** Team 3's additions (the `repairs` snapshot columns, `repair_ops_history`, `repair_service_logs`, `repair_status_events`, `t3_*` functions) were patched onto main's newer generated file. The 3-role `user_role` enum was kept. Team 2's mock repairs got the 3 new columns.
- **tsconfig** gained `@kitafix/accounts`, `@kitafix/insights` and `@kitafix/repair-ops`.
- **Supabase key:** Team 1 had switched to an `sb_publishable_...` key. The merge keeps `main`'s anon key, which is known to work. Switch only once someone confirms the publishable key belongs to project `pkfataaehrjdipdbrthz`.

## Database

Run order on a fresh database: 0001, 0002 (stub, kept), 0020-0024, **0030-0032 (Team 3)**, **0040 (Team 4)**, **0091-0096 (Team 1)**, **0097 (merge fix)**. None of 0030-0032, 0040 or 0091-0097 has been applied to hosted.

- **0030-0032 (Team 3)** were written before 0024 and called `public.is_staff()` 10 times. That function is dropped by 0024, so they would fail. They were ported: `is_staff()` became `(select public.is_admin())`, and the `*_staff_*` policies became `*_admin_*`. The logic is unchanged, and each file has a merge note at the top.
  - Stub 0090 was deleted. Its policies are a subset of 0030.
  - Stub 0002 stays, because 0020's `repairs.service_id` foreign key needs `services` to exist first, and 0030 uses `create if not exists`.
- **0040 (Team 4)** already used the 0024 names. No conflicts.
- **0091-0096 (Team 1)** check `role = 'admin'` directly, so they work. Two cautions:
  - 0092 aborts on any unknown `auth.users` INSERT trigger and checks a hard-coded MD5. Do a rolled-back dry run on hosted first.
  - `admin_assign_account_role` / `admin_set_account_active` overlap 0024's `set_user_role` / `set_user_active`. The group should pick one set.
- **0097 (merge fix):**
  1. Grants UPDATE on Team 1's profile columns. 0024 allowed only `full_name, phone, avatar_url`, so Edit Profile would fail with 42501.
  2. A trigger on `profiles.role` keeps `technicians` in step whichever admin function changed the role. This matters for Team 3: an account promoted from Team 1's screen must exist in `technicians` before it can be assigned in the queue.
- **Triggers on `repairs` now stack up across teams:** Team 2's guard, date rule and active-limit; Team 3's status machine, snapshot, started-at, reschedule guard and history. I read through them and found no rule conflicts: only pending repairs can be rescheduled (same as Team 2's UI), the service never changes after booking (Team 2 never does that), and customers can cancel a pending repair. This should still be tested on a real database.
- `0025_team2_perf.sql` is on hosted but only on the local `chore/orchestra` branch, not on `main`. Bring it over separately.

## Overlaps for the group to decide

- **Team 3 Admin Portal vs Team 4 Overview.** Both show summary cards and the latest repairs. Plan v5 gave the summary cards to Team 4. Both are kept for now.
- **Team 3 `repair_status_events` vs Team 4 `v_repair_status_summary`.** Both feed reporting. They don't conflict, but Team 4 could read Team 3's feed for trends.
- **Two sets of admin role functions** (see Database above).
- **Three bottom bars:** customer, `/admin` and `/ops`, plus Team 1's own `.acc-tabbar`. See `docs/UI_Unification_Plan.md`.

## Questions for the teams

- **Team 1:** RPCs `record_terms_acceptance` and `deactivate_own_account` have no migration. The `avatars` Storage bucket has no setup notes. Pages are deep-imported; please export `ACCOUNTS_ROUTES`. 32 of 83 `node --test` cases already fail on `group-a` itself.
- **Team 3:** your `environment.ts` points at our hosted project. Did you apply 0030-0032 there? After 23 Oct they would have failed on `is_staff()`. If you applied them before that, 0024's drop of `is_staff()` would have failed instead, so they are most likely not on hosted. Please confirm. Also, no tests were included.
- **Team 4:** none.

## Checks run

- `ng build`: OK. The only warnings are budgets: initial bundle and per-file SCSS.
- `vitest run`: 49/49 pass.
- Team 1 `node --test`: 51 pass, 32 fail, the same as on `group-a` before the merge.
- Not run: migrations on a local stack or on hosted, and a click-through in the browser.
