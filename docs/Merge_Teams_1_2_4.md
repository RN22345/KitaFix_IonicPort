# Group merge: Teams 1, 2 and 4 (Team 3 pending)

Branch `merge/teams-1-2-4`, from `main` (d062d7c).

| Team | Source | Base it started from | What came in |
|---|---|---|---|
| 1 (Group A) - Accounts | `origin/group-a` (e5d00c0) | 687cae2 (PR #14, before 0024) | `libs/accounts`, migrations 0091-0096, Capacitor deps, network toast |
| 2 - Booking (ours) | `main` | - | unchanged except the glue below |
| 4 - Insights | `KitaFix_Team4.zip` (no git history) | cf11d0a (PR #16) | `libs/insights`, migration 0040 |

Team 4's snapshot matched cf11d0a except `app.routes.ts` and `tsconfig.json`, so only its new files were copied; the two shell files were merged by hand.

## Glue changed during the merge

- **Routes** (`src/app/app.routes.ts`): Team 1's login is the entry point (`/` goes to `/accounts-login`). `/tabs` = customers (Team 2 booking + Team 4 `leave-review/:repairId`). `/admin` = Team 4's Overview/Insights shell, guarded by `accountsRoleGuard(['admin'])` (Team 4 had used the old session-only `authGuard`). The old `dev-login` page and `src/app/shared/session/` are removed; Team 1's guards replace them.
- **Landing after login** (`accountLoginDestination`): customer `/tabs`, admin `/admin`, technician `/accounts-my-account` (until Team 3's screens exist). The test that pinned the old routes was updated.
- **Navigation between teams**: Team 2's profile sheet has "My account" and signs out to `/accounts-login`. My Account has a back button to `/tabs` for customers and an "Overview" tab for admins. Team 4's admin tab bar has an "Accounts" tab.
- **Reviews**: Team 2's Repair Detail had its own star rating saved only in localStorage. It now shows "Leave a review", which opens Team 4's page (data in `public.reviews`). Follow-up: the small star shown on Team 2's repair card still reads the old local rating; switch it to Team 4's data or remove it.
- **tsconfig**: added `@kitafix/accounts` and `@kitafix/insights`.
- **Supabase key**: Team 1 had swapped `environment.ts` to an `sb_publishable_...` key. The merge keeps `main`'s anon key, which is known to work. Switch only after someone confirms the publishable key belongs to project `pkfataaehrjdipdbrthz`.

## Database

Order: 0040 -> 0091 ... 0096 -> 0097. Nothing here has been applied to the hosted project.

- **0040 (Team 4)** already uses the 0024 names (`is_admin()`, `my_role()`). No conflicts.
- **0091-0096 (Team 1)** were written before 0024 but check `role = 'admin'` directly, so they work. Watch out for two things:
  - 0092 aborts on any unknown `auth.users` INSERT trigger and checks a hard-coded MD5 of `create_test_profile()`. Do a rolled-back dry run on hosted first.
  - Team 1's `admin_assign_account_role` / `admin_set_account_active` overlap 0024's `set_user_role` / `set_user_active`. Both sets work. The group should pick one and drop the other.
- **0097 (merge fix)**:
  1. 0024 lets users update only `full_name, phone, avatar_url`, so Team 1's Edit Profile would fail with 42501. 0097 also grants `first_name, last_name, contact_no, address, birthday, gender`.
  2. A trigger on `profiles.role` keeps `technicians` in step, so promoting someone from Team 1's Accounts screen makes them a bookable technician.
- `0025_team2_perf.sql` is on hosted but only on the local `chore/orchestra` branch, not on `main`. Bring it over in a separate PR.

## For Team 1 (Group A)

- They call RPCs `record_terms_acceptance` and `deactivate_own_account`, but no migration defines them. The code handles them being missing (terms is not saved; deactivate shows "not available yet").
- They use a Storage bucket `avatars` with no migration or setup notes.
- Pages are lazy-loaded by deep import path. Please export an `ACCOUNTS_ROUTES` from `libs/accounts` (rule R6).
- `node --test libs/accounts/**/*.test.cjs`: 32 of 83 fail on `group-a` itself, before the merge (for example `navigator is not defined` and stale expectations). After the merge the count is the same.

## Checks run

- `ng build`: OK. The only warnings are budgets: the initial bundle is 1.66 MB against a 1.6 MB budget, and the per-file SCSS budgets are exceeded.
- `vitest run`: 49/49 pass.
- Team 1 node tests: 51 pass, 32 fail, the same as on `group-a` itself.
- Not run: migrations on a local stack or on hosted, and a click-through in the browser.

## When Team 3 arrives

Mount their technician routes (`accountsRoleGuard(['technician'])`). Change the technician landing in `accountLoginDestination`. Check their migrations against 0024, 0040 and 0097, and replace stubs 0002/0090 with their real ones.
