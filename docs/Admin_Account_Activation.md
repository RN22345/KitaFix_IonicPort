# Account activation and deactivation

> **Note (27 Nov merge):** the migration files named below (0091-0096) were retired. What is live on hosted is now in `supabase/migrations/0091_accounts_live_export.sql`; see `docs/Group_Merge.md`.

Recovery review: 2026-10-23. The activation implementation and migration below were already saved when work resumed after the IDE crash. Existing unrelated changes were preserved; no duplicate migration was created.

The existing Account Profile confirmation calls `AccountsService.setActive` with the target UUID and a boolean. It blocks self changes, missing profiles, unknown status and concurrent role/status submissions. Errors remain visible in the confirmation. A confirmed backend result triggers a fresh account list/detail read, including counts; the UI does not simulate persistence. Timeouts and identity changes abort or discard stale results.

Login requires `profiles.active = true`. Protected route navigation rechecks Auth identity and the backend profile, and profile saves revalidate access. Already rendered pages do not receive an immediate deactivation notification.

## Saved backend migration

`supabase/migrations/0096_admin_account_activation.sql` is the single saved activation migration. Review and apply manually as postgres after the Accounts prerequisites 0092–0095. Local file presence does not establish deployment. No migration was applied and no live account status was changed during this recovery.

`admin_set_account_active(uuid, boolean)` checks the caller's active Admin profile, rejects self changes and null input, locks caller/target in UUID order, rechecks authorization, requires an existing Auth user/profile, and updates only `profiles.active`. Anonymous execution is revoked. Existing read and role assignment RPCs also require active Admin access.

Restrictive Profiles policies deny inactive authenticated callers profile writes and reads of other profiles. Own-profile SELECT remains available for the login/guard status check. The existing privileged-column trigger continues to protect direct role/status changes. Policies intersect existing permissions; they do not grant new access by themselves.

Enforcement is scoped to Accounts/Profiles. This migration does not add active checks to booking, repairs, storage, other module tables or unrelated privileged RPCs. It does not delete Auth users, revoke sessions, or prevent Supabase Auth from issuing a session. Broader application-wide API denial would require a separately scoped review of those resources.

## Validation and remaining verification

- All 68 saved Accounts Node tests pass, including activation/reactivation, exact RPC arguments, failures, self-change prevention, duplicates, timeout, identity changes and refreshed counts.
- Angular compilation and template checking passed with `ngc -p tsconfig.app.json --noEmit`.
- No production build or development server was started. Two existing Node processes were observed; command-line inspection was unavailable. No memory errors occurred in these checks.
- SQL was inspected locally but not executed: deployment, PostgreSQL behavior and live RLS enforcement remain unverified. A local `psql` executable was unavailable.
- Browser rendering and live authenticated end-to-end behavior remain unverified.

After deployment, use designated test accounts to verify active Admin deactivation/reactivation of another user; persisted status in detail/list/counts after reload; self-change rejection; Customer, Technician, inactive Admin and anonymous RPC denial; null/missing target rejection; direct role/status update rejection; inactive profile-write rejection; login and guarded navigation denial; and restored access after reactivation. Test an existing session as well as a new login. Confirm unrelated profile fields and roles remain unchanged. Do not interpret an existing Auth session as application access authorization.
