# Edit profile returning to blank My Account

## Persistence follow-up (2026-10-23)

The user subsequently confirmed a live PATCH 200 with the saved row and matching Table Editor values. This confirms profile persistence for that live save; earlier live-save uncertainty below is historical. Auth metadata is a separate store and was never updated by the profile PATCH.

After confirmed profile reload, the client now calls `auth.updateUser({ data: names })` with saved first_name/last_name/full_name, plus the legacy name alias. If display_name already exists in current user metadata, it is synchronized too. Only name keys are submitted; no role/active/email/password/app_metadata fields are copied. Identity is revalidated immediately before the Auth call, and the returned user UUID and metadata values must match. Profiles remain the application source of truth.

Metadata failure or a bounded timeout returns a partial result without rolling back or hiding the confirmed profile save. Edit Profile shows an explicit partial-save message and a Retry name sync button. Retry reloads the saved active own profile and only resends name metadata, never the profile PATCH. Pending metadata requests prevent duplicate sync calls. Local tests cover name alias replacement, names-only payloads, partial failure, metadata-only retry, no sync after failed profile save, and editor retry behavior. Auth dashboard metadata sync has not been verified live. No new migration or screen was added.

Latest live evidence supplied by the user supersedes the deployment uncertainty below: `Supabase Snippet Untitled query (5).csv` confirms UPDATE on all seven personal fields, denied UPDATE on id/role/active/created_at, and the permissive active-own-profile policy together with restrictive active checks and own SELECT. Do not propose another permission migration from the earlier findings. The CSV contains configuration, not an authenticated failing request, response, or saved profile values.

Subsequent request tracing added `profileSaveDiagnostics()` on AccountsAuthService for debugger inspection: stage, identity-match/active booleans, outgoing field names, HTTP status/error code, returned identity match and persisted-value match. No UUIDs, field values, credentials or session objects are included or logged. Mapped save exceptions retain the original Supabase response as `cause` for local debugger inspection; the UI still displays only the safe mapped message. Inspect `error.cause` at the editor's catch breakpoint rather than sharing tokens, full session objects or a full HAR. Identity-version changes are now checked before the UPDATE as well as after it. This closes a stale-request window; it is not established as the cause of the reported live failure.

All 79 Accounts tests and Angular compilation/template checks pass. A new installed-Supabase-SDK transport test confirms GET identity/profile checks, a personal-only PATCH to `/rest/v1/profiles?id=eq.<authenticated UUID>` requesting the returned row, and an independent GET before confirmation. Its fetch responses are simulated: no live authenticated write has been performed, and the remaining live failure cause is still unknown. Capture the failing PATCH HTTP status and response code/message/details (redacting personal values) to continue diagnosis.

The user reports that the inspected database previously lacked both personal-column UPDATE grants and a permissive own-profile UPDATE policy. Either missing prerequisite blocks direct profile saves. The supplied fix granting personal-field UPDATE and adding `accounts_update_own_profile` is not present in the saved migrations inspected here; its deployment remains unverified. Migration 0096 adds restrictive policies only, which cannot grant UPDATE access alone. No duplicate or replacement SQL migration was created.

The configured Accounts client targets project `tiqgxpnnzpxpibwwzjzb` through the shared real Supabase client in app.config.ts. Angular has no environment file replacement configured. The user confirmed this is the intended test project; the configured URL exactly matches `https://tiqgxpnnzpxpibwwzjzb.supabase.co` (case-sensitive comparison). Older Hosted_Project/Database_Setup docs reference `pkfataaehrjdipdbrthz`; that reference is outdated for this task. No credentials were printed. No authenticated live database connection or management credential was available for this follow-up. Current grants and policy deployment remain unverified; no new migration should be inferred as necessary without inspecting them.

The actual save path uses `from('profiles').update(payload).eq('id', userId).select('*').single()` with the current Auth-validated profile UUID. The client defaults to the public schema. Only first_name, last_name, full_name, contact_no, address, birthday and gender are in the UPDATE payload. There is no table-wide UPDATE permission pre-check; column-level grants suffice.

The save now verifies the returned UUID (single() already rejects zero/multiple rows), separately reloads the same UUID from Supabase, compares all submitted personal values with the reloaded row, and only then hydrates the shared cache. Aborted requests, identity changes, wrong UUIDs, reload failure and differing persisted values reject the save. The editor continues to retain form values and navigate only after successful confirmation. Existing activation/role checks and SQL protections remain unchanged.

Local validation: all 77 Accounts tests pass, including zero-row rejection, returned UUID mismatch, persistence reload failure/mismatch, and signout during reload. Tests simulate Supabase responses; they do not prove live grants, RLS deployment or a live write. Use `supabase/tests/profile_save_diagnostics.sql` in the same project to inspect column grants and policies without exposing profile data. Live authenticated save/reload verification remains outstanding.

## Cause

Edit Profile previously merged values into an in-memory ProfileService object and navigated immediately. The My Account route guard then cleared the account/profile and reread Supabase, overwriting those unsaved edits. These were plain fields with no reactive notification, so the screen could remain rendered with the cleared values. Ionic also reuses Edit Profile, whose form had only captured the original profile at construction.

## Changes

- ProfileService and AccountsAuthService account state now use Angular signals behind the existing getters/setters. Same-account guard revalidation no longer blanks the current profile while waiting. Failed validation, logout and identity changes still clear state. Responses from older identity checks cannot restore signed-out data.
- `saveOwnProfile(expectedUserId, changes)` validates the current authenticated identity and active application role, sends an explicit allowlist of personal fields to the existing `profiles` table with an own-UUID filter, and publishes the returned database record. It never sends role, active status, id, email, passwords or photo previews in the update payload. Existing RLS and the privileged-column trigger remain intact.
- The existing form awaits the confirmed save before returning to `/accounts-my-account`. Errors remain on the editor, duplicate saves are blocked, and the operation has a 20-second deadline. Uncertain timeout outcomes ask the user to reopen the profile before retrying. The cached form resets from the current profile on Ionic entry.
- My Account renders explicit missing-value text rather than blank details. Photo selection remains preview-only and is labeled as such; no upload/storage feature was added.

## Database prerequisites

The saved registration migration 0092 supplies first_name, last_name, full_name, contact_no, birthday and gender, but not address. If the live table does not already have `public.profiles.address`, review/run the separately supplied `supabase/migrations/0095_accounts_profile_address.sql` as postgres. It only adds a nullable text column when absent; it does not change policies, triggers, grants or existing profile values. It has NOT been deployed here. No SQL is needed for the reactive display fix itself.

Saving relies on the existing own-profile UPDATE/SELECT RLS policies and grants. If the deployed database rejects the update or lacks a required field, the screen reports failure and stays on Edit Profile. No RLS was weakened or replaced. No live schema was available through an authenticated database connection, and no live account/profile update was executed.

## Validation

All 59 Accounts Node tests pass. New regression coverage uses real Angular signals with simulated Supabase storage to verify: save -> persisted row -> guard revalidation retains edited details; same-account pending checks preserve visible data; update field allowlisting; UUID ownership; RLS/schema failure; inactive/missing accounts; signout during reads; timeout/duplicate-save handling; navigation only after success; failure staying on Edit Profile; and refreshing cached form values. These are local checks, not evidence of deployed RLS or a live profile write.

`node --max-old-space-size=512 node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` passed. Angular template parsing passed for Edit Profile and My Account. No production build or ng serve was started or stopped during this task. Rendered browser and live saved-profile verification remain outstanding.

Changed files: `services/profile.ts`, `services/accounts-auth.ts`, `services/accounts-auth.login.test.cjs`, new `services/profile.save.test.cjs`, `pages/edit-profile/edit-profile.ts`, `pages/edit-profile/edit-profile.html`, new `pages/edit-profile/edit-profile.test.cjs`, `pages/my-account/my-account.ts`, `pages/my-account/my-account.html` (all under `libs/accounts/src/lib`), new `supabase/migrations/0095_accounts_profile_address.sql`, and this report.
