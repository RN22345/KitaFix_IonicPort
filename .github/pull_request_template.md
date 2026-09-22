## What does this change?

<!-- One or two sentences. Link the requirement from the Module Plan if there is one. -->

## Team / module

- [ ] Team 1 - Identity & People (`libs/identity`)
- [ ] Team 2 - Booking & Scheduling (`libs/booking`)
- [ ] Team 3 - Shop & Repair Operations (`libs/repair-ops`)
- [ ] Team 4 - Feedback & Insights (`libs/insights`)
- [ ] Shared / app shell / docs / tooling

## Module rules checklist (Module Plan v4)

- [ ] R1: I only changed my team's library and my team's database objects.
- [ ] R2: Database changes are inside a new `NNNN_teamN_*.sql` migration.
- [ ] R3: I only wrote RLS policies for tables my team owns.
- [ ] R4: I did not rename/remove any frozen column, enum value, or type.
- [ ] R6: No deep imports into another team's library (barrel files only).
- [ ] R8: Status values use the `repair_status` enum only.
- [ ] `npm run build` passes locally.

## How to test

<!-- Steps a reviewer (or the TA) can follow. Screenshot/GIF for UI changes. -->

## Database

- Migration file(s): <!-- e.g. 0030_team3_repair_ops.sql -->
- Applied to the hosted project? <!-- yes / no -->

## Screenshots (UI only)
