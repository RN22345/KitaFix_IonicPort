# Database Setup (Supabase) - Team 2

How to go from the `.ts` placeholders to the real Postgres database.
You need **Docker Desktop** running for local Supabase.

## 0. Hosted project (already set up - use this by default)

A shared hosted project already exists and the app in this repo points at it
(see `docs/Hosted_Project.md` for refs, demo accounts and security notes).

| Item | Value |
| --- | --- |
| Project ref | `pkfataaehrjdipdbrthz` |
| API URL | `https://pkfataaehrjdipdbrthz.supabase.co` |
| Migration status | 0001, 0002, 0020, 0090 applied + `seed_demo_data.sql` |
| App config | `src/environments/environment.ts`, `useMockData: false` |

Migrations were applied with the **Management API** (access token only, no DB
password). To regenerate the contract from the live database:

```powershell
# Option A - Supabase CLI (needs the DB password)
npx supabase link --project-ref pkfataaehrjdipdbrthz
npx supabase gen types typescript --linked > libs/shared-types/src/lib/database.generated.ts

# Option B - Management API (personal access token only)
$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
node kf_gen_types.mjs pkfataaehrjdipdbrthz libs/shared-types/src/lib/database.generated.ts
```

The rest of this document is the local/Docker path (useful for an offline
demo or a clean reset).

## 1. Start a local Supabase

From `KitaFix_Booking/`:

```powershell
npx supabase init      # first time only; creates supabase/config.toml
npx supabase start     # first run downloads images (a few minutes)
npx supabase status    # prints API URL, anon key, Studio URL
```

If `npx` asks, accept `supabase@latest`.

## 2. Apply the migrations

```powershell
npx supabase db reset
```

This deletes the local database and re-runs **everything** in
`supabase/migrations/` in filename order:

| Order | File | What it does |
| --- | --- | --- |
| 0001 | `*_local_stub_team1_identity.sql` | profiles, technicians, role helpers (Team 1 stand-in) |
| 0002 | `*_local_stub_team3_services.sql` | services table (Team 3 stand-in) |
| 0020 | `0020_team2_booking.sql` | **OURS**: repairs, availability constraint, RLS, guard trigger, `get_taken_slots` |
| 0090 | `*_local_stub_team3_repairs_staff.sql` | staff RLS policies (Team 3 stand-in) |

The stub files say right at the top: **delete before merging** - in the group
repo the real files from Teams 1 and 3 replace them.

Quick check after reset (Studio -> SQL editor):

```sql
select conname from pg_constraint where conname = 'repairs_no_double_booking';
select * from pg_policies where tablename = 'repairs';
```

## 3. Create the demo accounts

Studio -> Authentication -> Add user (or use the app's signup once Team 1 ships):

| Email | Full name | Role after step 4 |
| --- | --- | --- |
| customer@kitafix.test | Alex Santos | customer |
| marcos.tech@kitafix.test | Marco Reyes | technician |
| dina.tech@kitafix.test | Dina Villanueva | technician |
| staff@kitafix.test | Sam Cruz | staff |

## 4. Load demo data

1. Promote the sample roles (SQL editor):

```sql
update public.profiles set role = 'technician'
where full_name in ('Marco Reyes', 'Dina Villanueva');

update public.profiles set role = 'staff'
where full_name = 'Sam Cruz';
```

2. Paste **all of** `supabase/seed_demo_data.sql` into the SQL editor and run.
   It adds the 5 services, turns the technicians into `technicians` rows and
   creates 2 sample bookings for the demo customer.

## 5. Point the app at the database

`src/environments/environment.ts`:

```ts
useMockData: false,
supabaseUrl: 'http://127.0.0.1:54321',   // from `supabase status`
supabaseAnonKey: '<anon key>',           // from `supabase status` (never service_role)
```

```powershell
npm start
```

Sign in on the `/dev-login` page (temporary; Team 1's real login replaces it) or
let the guard redirect you there.

## 6. Regenerate the shared types (the contract)

After any migration change:

```powershell
npx supabase gen types typescript --local > libs/shared-types/src/lib/database.types.ts
```

Then `npm run build`. The booking code should compile unchanged because it only
uses the exported names from the placeholder file.

## 7. Test without the app (optional, for the report)

`supabase/queries.sql` contains every query of the repository, including the
"same insert twice -> 23P01" proof of the availability constraint.

## 8. Hosted Supabase (finals / online demo)

1. Create a free project on supabase.com.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Repeat steps 3-6 with the hosted URL + anon key.
4. RLS and the exclusion constraint travel with the migrations.

## How the swap works in code (for the report)

```
provideBooking({ useMockData: true })          -> MockRepairsRepository      -> .ts data
provideBooking({ useMockData: false })         -> SupabaseRepairsRepository  -> PostgREST
```

The pages inject `RepairsService` only, so **no screen file changes** when the
data source changes. That is the point of the repository interface.
