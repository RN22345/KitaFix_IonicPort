# KitaFix_Booking

**Team 2 - Booking & Scheduling** module for the KitaFix system
(Ionic + Angular standalone + Supabase), based on *KitaFix Module Plan v4*.

This folder is a self-contained Ionic app so the module can be built, demoed and
tested alone with **no internet and no database**. The real Supabase queries,
SQL migration and setup instructions are included; flipping one flag in
`src/environments/environment.ts` switches from placeholders to the real
database.

## What is inside

```
KitaFix_Booking/
  src/                    Ionic customer app shell (stand-in for apps/customer)
    app/                  routes + tabs + placeholder session guard (Team 1 replaces)
    environments/         ONE place for the Supabase URL + key
    global.scss
  libs/
    booking/              OUR MODULE (maps to libs/booking in the group repo)
      src/lib/
        models/           Repair domain, status meta, error types
        validation/        brand/model required, >= 1 issue, no past date
        pricing/           price estimate from service + issue fees
        data-access/
          repositories/    RepairsRepository + Supabase + Mock implementations
          gateways/        technicians (Team 1) + services (Team 3) readers
          session/         current user (Team 1 auth, placeholder in mock mode)
          mock/            .ts placeholder DATABASE + DATA (our tables + theirs)
        services/          RepairsService facade + realtime
        ui/                status badge, repair card, reschedule modal
        pages/             Dashboard, New Booking, My Repairs
      src/index.ts         barrel file (other teams import only this - rule R6)
    shared-types/          placeholder for `supabase gen types` (the contract)
  supabase/
    migrations/            0020_team2_booking.sql (ours) + local stubs + seed
    queries.sql            every query as raw SQL
  docs/                    booking rule, test plan, DB setup, contracts, traceability
```

## Run it (offline demo, mock data)

```powershell
npm install
npm start          # http://localhost:4200
```

`useMockData: true` is the default. The screens use `.ts` placeholder data that
copies the database rules (double booking fails, completed repairs cannot be
cancelled, etc.). Refreshing the browser resets the data.

## Run it against the real Supabase database

Already configured: `src/environments/environment.ts` points at the shared hosted
project (`useMockData: false`, anon key filled in).

1. Demo accounts and project details: `docs/Hosted_Project.md`.
2. `npm start`, sign in (the temporary `/dev-login` screen) with them.
3. The app reads `repairs`, `technicians` (Team 1) and `services` (Team 3) from
   Postgres, and every booking rule is enforced by the database.

For the offline finals demo, set `useMockData: true` and reload - nothing else
changes: same screens, same repository interface.

## Module contract summary

- **Owns (database):** `repairs` booking columns + the availability rule
  (`repairs_no_double_booking` exclusion constraint) + customer RLS.
- **Reads:** technicians from Team 1, services from Team 3, profile names from
  Team 1, session from Supabase Auth.
- **Exposes:** `repairs` rows to Team 3 (queue) and Team 4 (reports); a booking
  is the "created event" (a row becomes visible to them).
- **Status values:** `repair_status` enum only (`pending`, `in_progress`,
  `testing`, `completed`, `cancelled`) - never new strings (rule R8).

## Documents

| File | What it is |
| --- | --- |
| `docs/Booking_Rule.md` | The availability / cancel / reschedule rule (required doc) |
| `docs/Availability_Test_Plan.md` | Manual tests, incl. the 5 from the module card (required doc) |
| `docs/Database_Setup.md` | Supabase local setup, migrations, types, seeding |
| `docs/Cross_Module_Contract.md` | Exactly what we read from Teams 1/3 and expose to 3/4 |
| `docs/Feature_Traceability.md` | Every required/recommended feature -> code -> test |
| `libs/booking/README.md` | Library README: screens, tables, exported functions |

## Merging into the group repo (week by week)

1. Copy `libs/booking` -> `libs/booking`, copy `supabase/migrations/0020_*`.
2. Delete the three `*_local_stub_*.sql` files (Teams 1 and 3 bring the real ones).
3. In `apps/customer` add the routes from `src/app/app.routes.ts` (the booking
   children entry) and `provideBooking(...)` to the app config.
4. Keep importing through `@kitafix/booking` only (rule R6).
