# Supabase - Team 2 (Booking & Scheduling)

Everything the booking module needs from the database, plus the instructions to
run it. Full walkthrough with screenshots-level detail is in
`../docs/Database_Setup.md`.

## Files

| File | Purpose | Merge into group repo? |
| --- | --- | --- |
| `migrations/0020_team2_booking.sql` | **OURS.** repairs booking columns, availability exclusion constraint, customer RLS, guard trigger, `get_taken_slots`, realtime. | YES - keep the number |
| `migrations/0001_local_stub_team1_identity.sql` | Stand-in for Team 1 (profiles, technicians, role helpers) so we can run alone. | **NO - delete before merging** |
| `migrations/0002_local_stub_team3_services.sql` | Stand-in for Team 3 `services` table. | **NO - delete before merging** |
| `migrations/0090_local_stub_team3_repairs_staff.sql` | Stand-in for Team 3 staff RLS on repairs. | **NO - delete before merging** |
| `seed_demo_data.sql` | Small demo dataset (run by hand after signup). | NO - local demo only |
| `queries.sql` | Every query the module runs, as raw SQL, for testing by hand. | Handy reference |

## Hosted project (already provisioned)

The migrations in this folder are already applied to the shared hosted project
`pkfataaehrjdipdbrthz` and the demo data is loaded. Details, accounts and
security notes: `../docs/Hosted_Project.md`.

## Commands

Run everything from the `KitaFix_Booking` folder (the CLI needs Docker Desktop).

```powershell
# first time only
npx supabase init          # creates supabase/config.toml (keep our migrations folder)
npx supabase start         # downloads images, starts local Postgres + Studio + API

# after any migration change
npx supabase db reset      # re-runs ALL migrations from an empty database + seed

# after db reset: open Studio, sign up demo accounts, run seed_demo_data.sql
# Studio URL and keys are printed by:
npx supabase status
```

Copy the `API URL` and `anon key` from `supabase status` into
`src/environments/environment.ts`, set `useMockData: false`, then `npm start`.

## Regenerate the shared types (the contract)

```powershell
npx supabase gen types typescript --local > ..\libs\shared-types\src\lib\database.types.ts
```

The hand-written placeholder in that file mirrors the real output; replacing it
should not require any code changes in `libs/booking`.

## Prove the availability rule (the exam question)

1. Studio -> SQL editor, run an insert for location A, date D, 10:00. It works.
2. Run the exact same insert again -> it fails:

```
ERROR: conflicting key value violates exclusion constraint "repairs_no_double_booking"
SQLSTATE: 23P01
```

3. Change the location to B, keep the same hour -> it works.
4. Change the time to 11:00 at location A -> it works.
5. `update public.repairs set status='cancelled' where ...` -> the hour is free
   again (the constraint ignores cancelled bookings).

## RLS checklist (Definition of Done)

Run these as two different customers (JWT requests, not the SQL editor):

- [ ] Customer A `select * from repairs` returns only A's rows.
- [ ] Customer A cannot `update` customer B's row (`0 rows`).
- [ ] Customer A cannot set another `customer_id` on insert (`42501`).
- [ ] Customer A cannot change `status` to anything but `cancelled` (`42501`).
- [ ] Customer A cannot cancel a `completed` repair (`42501`).
- [ ] Staff (`is_staff()`) can read/update the queue (stub 0090 until Team 3 ships).
