# Existing Assign role sheet

> **Note (27 Nov merge):** the migration files named below (0091-0096) were retired. What is live on hosted is now in `supabase/migrations/0091_accounts_live_export.sql`; see `docs/Group_Merge.md`.

The existing account-profile sheet now saves Admin, Technician or Customer to the selected real profile UUID through `admin_assign_account_role(account_id, new_role)`. It reloads the actual detail after the RPC confirms the returned role. Returning to Accounts List reloads its real records as before. No local role mutation is presented as persistence.

The screen preserves the existing sheet, role descriptions, permissions preview and styling. It shows saving/errors, blocks duplicate submissions, and requires an explicit selection if the stored role is missing or unrecognized. Missing profiles and the signed-in user's own role cannot be edited. Activate/deactivate remains unavailable; this change only connects role assignment. Assigning Technician changes the application role; it does not provision records or scheduling assignments in the separate technicians module.

## Deployment still required

Review and run `supabase/migrations/0094_admin_assign_account_role.sql` as postgres after the deployed 0092/0093 schema. This migration has NOT been deployed or executed here. It was prepared against the saved registration/protection/read migrations. The live schema/function definitions were not available through a database management connection.

The new security-definer RPC checks protected `profiles.role` and `profiles.active` using `auth.uid()`. Only active Admins may use it. It rejects self-role changes and all input roles except admin/technician/customer. It locks caller and target profiles in UUID order and revalidates authorization after locking. It requires an existing Auth user/profile and updates only the role. The existing role column type is reused; no enum, RLS, direct-update protection, signup trigger, Auth user, active status or profile details are changed. EXECUTE is revoked from public/anon and granted to authenticated. The function returns only the saved role string. No secrets or full Auth records are exposed.

In SQL Editor or authenticated integration tests after deployment, verify: active Admin assigning another existing profile; self-role denial; Customer, Technician, inactive Admin and anonymous rejection; invalid role rejection; missing target/profile rejection; and a direct authenticated profile role UPDATE still rejected by the existing trigger. Confirm the saved role through `admin_read_accounts(target_uuid)` and after navigating back to the list. Use designated test accounts for successful writes; no real account roles were changed during this implementation.

## Validation

All 48 Accounts Node tests pass, including role UUID/role payloads, no optimistic mock mutation, backend-error handling, missing deployment, timeouts/uncertain writes, auth switching, duplicate-save blocking, sheet selection/error behavior and reloading after success. Backend results in these tests are simulated; no live role write or backend authorization matrix was executed because the new migration is not deployed and no Admin test session/database credentials are available.

The Angular compiler's template parser accepts the updated profile template. Full TypeScript checking was attempted but failed with system memory-allocation errors, including an elevated retry; no successful full typecheck or production build is claimed for this change. No ng serve or build was started or stopped. Existing login/signup/recovery/cooldown tests pass and their source files were not changed.

Changed files: `services/accounts.ts`, `services/accounts.read.test.cjs`, `pages/account-profile/account-profile.ts`, `pages/account-profile/account-profile.html`, new `pages/account-profile/account-profile.test.cjs` (all under `libs/accounts/src/lib`), new `supabase/migrations/0094_admin_assign_account_role.sql`, and this document.
