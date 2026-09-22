# tools/supabase

Small Node scripts that talk to the Supabase **Management API**, so you can set
up the database without a database password. They need Node 22 and a Supabase
personal access token.

> The token (`sbp_...`) is a secret. Keep it in an environment variable, never in
> a file that gets committed. The `service_role` key is fetched in memory by the
> scripts and is never printed.

## 0. Which project?

| Field | Value |
| --- | --- |
| Project ref | `pkfataaehrjdipdbrthz` |
| Dashboard | https://supabase.com/dashboard/project/pkfataaehrjdipdbrthz |

```powershell
$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
```

## 1. Apply migrations (and seed) without the DB password

```powershell
node tools/supabase/apply-sql.mjs pkfataaehrjdipdbrthz `
  supabase/migrations/0010_team1_identity.sql `
  supabase/migrations/0020_team2_booking.sql `
  supabase/migrations/0030_team3_repair_ops.sql `
  supabase/migrations/0040_team4_insights.sql `
  supabase/seed_demo_data.sql
```

Each file runs in a transaction and is recorded in `supabase_migrations`. If one
fails, nothing from that file is applied and the error is printed.

## 2. Regenerate the shared contract types

```powershell
node tools/supabase/gen-types.mjs pkfataaehrjdipdbrthz libs/shared-types/src/lib/database.generated.ts
```

Then commit the regenerated file (rule R4: the generated types are the contract).

## 3. Create the demo accounts

```powershell
$env:DEMO_PASSWORD = 'choose-a-password'   # not stored in the repo
node tools/supabase/create-demo-users.mjs pkfataaehrjdipdbrthz
```

Accounts: `customer@kitafix.test`, `marcos.tech@kitafix.test`,
`dina.tech@kitafix.test`, `staff@kitafix.test`. Set their roles with the SQL the
script prints (or run it through `apply-sql.mjs`).

## 4. Smoke test the database (no browser)

```powershell
$env:DEMO_PASSWORD = 'the same password'
node tools/supabase/verify.mjs https://pkfataaehrjdipdbrthz.supabase.co <anon-key>
```

Checks: login, RLS read of your own repairs, create a booking, a second booking
on the same slot is rejected with `23P01`, and cancel works.

## Alternative: the official CLI

If you have the database password and Docker, the CLI does the same and keeps
migration versions aligned with the filenames:

```powershell
npx supabase link --project-ref pkfataaehrjdipdbrthz
npx supabase db push
npx supabase gen types typescript --linked > libs/shared-types/src/lib/database.generated.ts
```
