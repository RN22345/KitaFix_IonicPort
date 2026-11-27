# Registration implementation and manual setup

## Apply SQL separately

Run the exact SQL in `supabase/migrations/0092_accounts_registration.sql` as postgres in Supabase SQL Editor after reviewing it. It is NOT deployed by this change and does not require the fuller identity stub or 0091 to have been applied. It expects the actual existing profiles(id, active, role) table with a unique id.

It adds first_name, last_name, full_name, contact_no, birthday, gender and created_at when absent. New Auth users receive a Customer/active profile in the same transaction as account creation. Only explicit personal metadata fields are copied. Passwords and metadata role/active are never copied. Existing rows, roles and data are not backfilled or reset. Existing RLS policies remain; an own-profile SELECT policy is added if needed. Direct authenticated/anonymous changes to id, role or active are rejected, including where existing UPDATE policies are broad. Existing security-definer RPCs must still be audited independently for privilege bypasses.

The migration replaces only the known Auth INSERT triggers create_test_profile, t1_stub_on_auth_user_created and accounts_on_signup. Their old functions remain untouched. Before applying, inspect existing triggers with:

```sql
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Any other Auth INSERT trigger makes the migration abort before changes. Review/consolidate such triggers rather than deleting them blindly. Profile INSERT uses ON CONFLICT(id) DO NOTHING as an additional safeguard. Unknown schemas, constraints, policies and functions have not been tested against the live database. Do not run the older identity stub just to enable registration.

## Supabase dashboard setup

1. Enable Email/password signup and allow new user signups. Keep Confirm email enabled if required; the app does not change that setting. With confirmation enabled, a no-session response opens signup verification. With confirmation disabled, a returned session is validated against the backend profile and opens the existing role destination.
2. Configure custom SMTP with a verified sender/domain and permitted recipients. Check Auth email rate limits and delivery logs. No SMTP credentials belong in the frontend.
3. In Authentication email templates, edit **Confirm signup** to include the real OTP: `<p>Your confirmation code is {{ .Token }}</p>`. Configure a **6-digit** email OTP and **600-second** expiry to match the existing six-box verification screen/countdown. Keep Reset password as its separate recovery template; signup verification uses type signup, recovery uses type recovery. If your hosted dashboard does not expose OTP length, check the project's Auth configuration before using this six-box UI.
4. Configure Site URL and allowed redirect URLs for the actual application origin. The implemented flow uses typed OTP, so it does not require a new callback screen or an email confirmation-link redirect. If retaining a link in the email, a confirmation link may confirm outside this screen; return to Log in afterward.
5. Match server password settings to the existing form requirements where supported: minimum 8 characters, uppercase and special character. The form also checks matching passwords, PH mobile format, required names/email/gender and age 13+. No claim is made that client validation replaces server-side validation.

Reference: https://supabase.com/docs/reference/javascript/auth-signup and https://supabase.com/docs/guides/auth/auth-email-templates

## Verify a registration

Use a new test email that you control. In Authentication > Users find that email, record its UUID and confirmation status. In Table Editor > profiles find the same UUID. Check role=customer, active=true, first_name, last_name, full_name, contact_no, birthday and gender against the submitted form. With confirmation enabled the profile is created before confirmation; email confirmation status is held by Auth, not profiles.active. Enter the emailed signup code and confirm that My Account shows the actual user. Check the Auth user's confirmation timestamp afterward.

Try invalid/expired codes, resend after its wait, double-clicking Create account, and registering an existing email. Supabase may deliberately return an obfuscated no-session result for an existing account; the UI does not claim that a fresh account was created. Returned duplicate/rate-limit/database/network errors are displayed. If SMTP fails, inspect Authentication > Users before retrying: creation/delivery results can be uncertain after network failures.

Using an authenticated client, confirm own-profile reads work and attempts to UPDATE one's role/active fail. Confirm existing Admin/Technician assignments and inactive users are unchanged. Also test password recovery independently: a signup code must never open Reset password. Do not share passwords, tokens, API keys or Network request bodies while checking.

## Limitations and validation

Optional profile photo is explicitly preview-only and is not uploaded or saved. Storage bucket/policy integration remains incomplete. Admin Accounts List remains sample/local data by scope. Existing profile-edit/change-password persistence gaps remain outside this task.

Original ZIP, supplied screenshots and FSD V2.0 are not in the accessible workspace. Existing screens/styles and validation were reused; full FSD compliance is not claimed. No live Supabase configuration, SQL execution, SMTP delivery or browser confirmation was verified.

26 mocked Node tests passed for registration session/no-session branching, metadata allowlisting, error propagation, signup OTP/resend isolation, invalid forms, duplicate submissions, loading/retry handling, existing login/role/identity/logout/recovery guard and cooldown behavior. TypeScript checking passed. One production build passed with NG_BUILD_MAX_WORKERS=1 after stopping the project's ng serve; existing SCSS budget warnings remain.

Changed files: accounts-auth.ts, accounts-auth.login.test.cjs, signup.ts, signup.page.html, new signup.test.cjs, verify-email.ts, verify-email.html, new 0092_accounts_registration.sql, and this document. No Admin Accounts List integration or new screen was added.
