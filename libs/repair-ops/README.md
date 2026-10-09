# libs/repair-ops (Team 3 - Shop & Repair Operations)

Staff screens for the repair shop. Built to the Module Plan v4 "Required features".

| Screen | Route | What it does |
| --- | --- | --- |
| Admin Portal | `/tabs/admin-portal` | Cards: All / Pending / Confirmed + latest repairs |
| Repair Queue | `/tabs/repair-queue` | List, 3 filters, Confirm, Update status, Assign/Change technician |
| Service Catalog | `/tabs/service-catalog` | Add, edit, turn a service on or off |

Database: `supabase/migrations/0030_team3_repair_ops.sql` (services table, staff RLS, status trigger).

Rules (same in `models/repair-ops.model.ts` and in the database trigger):
pending -> in_progress | cancelled, in_progress -> testing | cancelled,
testing -> completed | in_progress. Completed and cancelled are final.
Starting a repair needs a confirmed booking and a technician. A booking can be confirmed once.

Reads from others: technician list (`TechniciansGateway` from `@kitafix/booking`),
display helpers (`StatusBadgeComponent`, `shortRepairId`, ...), customer names (`profiles`).

Not built yet (Recommended features): search, sort, pagination, repair notes, reschedule,
status history timeline.
