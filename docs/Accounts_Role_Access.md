# Account Module scope correction

> **Note (27 Nov merge):** the migration files named below (0091-0096) were retired. What is live on hosted is now in `supabase/migrations/0091_accounts_live_export.sql`; see `docs/Group_Merge.md`.

## Final routing

- Admin: /accounts-list. Existing Roles and account-management routes remain Admin-only. My Account is linked from Accounts List.
- Customer and Technician: /accounts-my-account.
- Every valid active role may access own profile, edit profile, change password, and logout.
- Removed accounts-role-dashboard, accounts-customer-dashboard, accounts-technician routes and the newly added role-landing component. Its only dependencies were the removed routes and dashboard-specific tests.
- Preserved tracked Booking dashboard files and Booking routes, all existing Account screen styles, authentication, backend active/role checks, role guards and recovery protection.
- Corrected profile edit and change-password completion navigation to /accounts-my-account.

## Known gaps

The original ZIP, supplied screenshots and FSD V2.0 are not present in the accessible workspace. This correction follows the user's explicit scope; visual fidelity and full FSD compliance cannot be verified.

My Account displays the current Supabase user's profile and authenticated email/role. Assigned permissions have no backend schema/connection in the saved Account Module. The existing permissions section reports that gap; sample role permissions are not presented as actual assignments.

Existing Accounts List, role assignment, activation/deactivation and Roles screens use sample/local data. Profile editing is local only, and change-password submission still has a Supabase TODO. These existing behaviors need backend integration; screen access does not establish working persistence. No new screens or operational features were introduced.

Existing migration supabase/migrations/0091_accounts_role_access.sql was preserved, not applied. Repository backend protections are not evidence of deployed RLS. Live Supabase authorization and recovery configuration remain unverified.

## Validation

19/19 existing Node authentication/cooldown tests pass after updating destinations and removing the dashboard-only test. Coverage includes active/backend roles, restored sessions, own identity, logout, recovery route guard, remaining attempts, ten-minute cooldown, persistence, expiry and live countdown bindings. These are mocked tests, not live browser or Supabase tests.

The cooldown remains browser-local: only invalid_credentials count; failures show 2 then 1 remaining attempts and the third starts a live ten-minute countdown. Storage clearing or another browser bypasses this local protection.

Production build passed with NG_BUILD_MAX_WORKERS=1 and no Node/ng serve processes running beforehand. Existing SCSS budget warnings remain. PowerShell blocked npm.ps1 before Angular started; npm.cmd ran the single actual build successfully.

## Files changed in this correction

- src/app/app.routes.ts
- libs/accounts/src/lib/services/accounts-auth.ts
- libs/accounts/src/lib/services/accounts-auth.login.test.cjs
- libs/accounts/src/lib/pages/login/login.cooldown.test.cjs
- libs/accounts/src/lib/pages/my-account/my-account.ts
- libs/accounts/src/lib/pages/my-account/my-account.html
- libs/accounts/src/lib/pages/accounts-list/accounts-list.html
- libs/accounts/src/lib/pages/edit-profile/edit-profile.ts
- libs/accounts/src/lib/pages/change-password/change-password.ts
- docs/Accounts_Role_Access.md
- Deleted: libs/accounts/src/lib/pages/role-landing/role-landing.ts

Unrelated existing workspace changes were preserved.
