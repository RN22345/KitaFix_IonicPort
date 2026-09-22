# Hosted Supabase project (Team 2)

The booking module is provisioned on a real Supabase project. The app in this
repo points at it by default (`src/environments/environment.ts`,
`useMockData: false`).

## Project

| Field | Value |
| --- | --- |
| Project ref | `pkfataaehrjdipdbrthz` |
| API URL | `https://pkfataaehrjdipdbrthz.supabase.co` |
| Region | `ap-south-1` |
| Dashboard | https://supabase.com/dashboard/project/pkfataaehrjdipdbrthz |
| Anonymous key | in `src/environments/environment.ts` (public-safe, protected by RLS) |

## What was applied

Schema migrations were applied through the Supabase **Management API**
(`POST /v1/projects/{ref}/database/migrations`), in this order:

| Migration | Result |
| --- | --- |
| `0001_local_stub_team1_identity.sql` | profiles, technicians, `user_role`, `is_staff()` / `my_role()` / `current_user_no()`, signup trigger, RLS |
| `0002_local_stub_team3_services.sql` | `services` table + RLS |
| `0020_team2_booking.sql` | `repairs`, availability exclusion constraint, customer RLS, guard trigger, `get_taken_slots()`, realtime |
| `0090_local_stub_team3_repairs_staff.sql` | staff/technician RLS on `repairs` |
| `seed_demo_data.sql` | 5 services, 2 technicians, 2 sample bookings |

> The three `*_local_stub_*` files are Team 1 / Team 3 stand-ins. When those
> teams deliver their real migrations, delete the stubs here and in the repo and
> re-apply (or `supabase db push` after linking).

The generated contract was pulled from the live project into
`libs/shared-types/src/lib/database.generated.ts`.

## Demo accounts (created via the Auth admin API)

| Email | Role | Purpose |
| --- | --- | --- |
| `customer@kitafix.test` | customer | Dashboard / Booking / My repairs |
| `marcos.tech@kitafix.test` | technician | Staff-side assignment demos |
| `dina.tech@kitafix.test` | technician | Staff-side assignment demos |
| `staff@kitafix.test` | staff | Repair Queue / status changes |

**Password:** shared in the group chat, not committed to this public repo.
The temporary `/dev-login` screen in the app accepts these accounts.

To change a password or role, do it in the dashboard:
Authentication -> Users, and Table editor -> `profiles` -> `role`.

## Regenerate the contract after a migration merge

```powershell
# Option A - Supabase CLI (needs the DB password)
npx supabase link --project-ref pkfataaehrjdipdbrthz
npx supabase gen types typescript --linked > libs/shared-types/src/lib/database.generated.ts

# Option B - Management API (access token only)
$env:SUPABASE_ACCESS_TOKEN = '<your personal access token>'
node kf_gen_types.mjs pkfataaehrjdipdbrthz libs/shared-types/src/lib/database.generated.ts
```

## Security notes

- The `anon` key is meant to be public; Row Level Security is the protection.
- **Never** commit the `service_role` key or the personal access token
  (`sbp_...`). They bypass RLS. Keep them in environment variables only.
- The hosted project is free-tier and demo-only. Data can be reset at any time
  by re-running the migrations and `seed_demo_data.sql`.
- Offline finals demo: set `useMockData: true` in `environment.ts` and reload.
