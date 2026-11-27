# Admin Accounts read path and loading fix

Subsequent change: the existing Assign role sheet is now connected to a new backend RPC, pending separate migration 0094 deployment. See `docs/Admin_Role_Assignment.md` for current role-write behavior and validation. References below to disabled role controls describe the earlier read-only implementation; status updates remain unavailable.

## Cause and evidence

The existing trace is `AccountsListPage.ionViewWillEnter()` -> `AccountsService.loadAccounts()` -> session-aware Supabase `rpc('admin_read_accounts', { account_id })` -> paginated results. The template reads the service's loading/error/records through page getters.

Two frontend defects were found:

- The service's unconditional auth callback called `clear()` for INITIAL_SESSION, TOKEN_REFRESHED and repeated same-user SIGNED_IN events. `clear()` incremented the request generation. A valid response arriving afterward was silently discarded. This race is locally reproduced and covered by regression tests. These events are not logout or account switching.
- Loading, errors, records and detail were ordinary fields. There was no reactive notification of those template dependencies when SDK work completed. A completion outside Angular change detection could leave the last rendered loading/count state visible. They now live in an Angular signal, with reactive getters preserving the existing template API. Tests use real Angular signals/computed consumers and confirm pending -> success/error updates, including counts. A rendered browser reproduction was not available; this is not proof that the user's live RPC succeeded.

The previous code also had no deadline: any SDK session/lock wait or HTTP request that never settled could leave loading true indefinitely. The fixed operation has a 20-second deadline, including initialization before HTTP dispatch. Timeout aborts the RPC and prevents late responses from replacing its error state.

Both Accounts auth callbacks were inspected. Neither awaits Supabase or calls it recursively. The installed SDK waits for session access before invoking fetch and awaits auth subscribers. No circular wait was found in the Accounts callbacks; the fix keeps them synchronous and does not start queries from them.

The exact branch taken in the user's browser (no HTTP dispatch, pending HTTP, rejection, or completion without rendering) cannot be established without that browser's request trace or an authenticated Admin session. No such session is accessible here. The frontend races and missing notifications above are independently addressed rather than attributing the symptom to undeployed SQL.

## Fixed flow

1. Entry clears old state, cancels a superseded request and sets loading.
2. Wait for `auth.getSession()` outside auth callbacks. Missing/failed sessions show a sign-in error without sending a list RPC. This is initialization only; the SQL RPC remains the authority on active Admin access.
3. Issue the existing UUID-scoped/list RPC with ranges and an AbortSignal. Preserve real-data mapping and pagination.
4. Publish success or a safe error through Angular signals. `finally` clears loading on both paths; stale requests cannot clear newer state.
5. Clear and abort on logout or identity change. Preserve valid in-flight/completed reads on initial-session/same-user refresh events.

`AccountsService.loadPhase` exposes only `idle`, `session`, `rpc`, `ready`, or `error` for inspection. `rpc` means the SDK request has been invoked; the SDK can still be resolving its access token before HTTP dispatch. This is not a network packet trace. No logging of credentials, sessions, identities, request headers or RPC payloads was added.

Layout, filtering, counts, real UUID detail reads, existing routes, and active-Admin SQL authorization are preserved. The existing loading text encoding was corrected. Role/status buttons remain disabled because their writes are not implemented. No SQL or other authentication/signup/recovery/login/cooldown files were changed.

## Verification for the loading fix

- **Local:** all 39 Accounts read/auth/signup/cooldown tests pass. Coverage includes session initialization, page -> service -> RPC dispatch, real Angular reactive consumers, INITIAL_SESSION and same-user auth races, identity switches, logout, overlapping loads, RPC denial/network/malformed-response failures, pending session/RPC timeouts, late results, pagination, filters and counts.
- **Offline SDK integration:** the installed Supabase client, a synthetic in-memory session and a fake fetch exercise actual SDK initialization and RPC dispatch with no callback deadlock. This sends no live network request and is not a production Admin integration test.
- **Local:** `npx.cmd tsc --noEmit -p tsconfig.app.json` passed. No ng serve or production build was started or stopped during this fix.
- **Live configured Supabase:** one anonymous request through the installed SDK to `admin_read_accounts` returned HTTP 401 / SQLSTATE 42501. This confirms a responding, access-denied backend path; it does not prove an active Admin can read, nor verify Customer/Technician/inactive Admin rejection.
- **Still unverified:** a signed-in active Admin's live rows, the live browser's original pending request/render state, and rendered visual checks. No private account credentials were accessed. No database change was justified or made.

## Changed files for the loading fix

- `libs/accounts/src/lib/services/accounts.ts`: reactive state, selective auth invalidation, explicit bounded session initialization, abort/deadline handling and safe error states.
- `libs/accounts/src/lib/services/accounts.read.test.cjs`: regression coverage and offline SDK integration.
- `libs/accounts/src/lib/pages/accounts-list/accounts-list.html`: loading ellipsis encoding only; layout unchanged.
- `docs/Admin_Accounts_Read.md`: this report.

## Existing SQL and remaining read-path checks

Migration 0093 is reported deployed by the user; the live anonymous check above now returns denial rather than the earlier PGRST202 missing-function response. The migration was not edited or redeployed during this fix. It checks auth.uid() against protected profiles.role/active, left-joins Auth users to profiles by UUID and returns a small explicit field list. It does not expose Auth secrets or full Auth records.

After signing in as an active Admin, verify list records against Auth/profile UUIDs, newly registered accounts on reentry, detail navigation, filters and account switching. The separately supplied `supabase/tests/admin_accounts_read_check.sql` can test existing backend role fixtures without changing accounts. Missing fixtures report SKIP. Do not run the identity stub, reset the database, or delete accounts to test empty UI.
