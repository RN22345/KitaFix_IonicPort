# libs/repair-ops (Team 3 - Shop & Repair Operations)

Staff screens for the repair shop, including queue management, repair history,
notes, scheduling, and service catalog maintenance.

| Screen | Route | What it does |
| --- | --- | --- |
| Admin Portal | `/tabs/admin-portal` | All / Pending / Confirmed summary cards and latest repairs |
| Repair Queue | `/tabs/repair-queue` | Search, status/technician/service/date filters, sorting, pagination, confirmation, status changes, technician assignment, notes, history, and rescheduling |
| Service Catalog | `/tabs/service-catalog` | List, add, edit, activate, and deactivate services |

Database migrations:

- `0030_team3_repair_ops.sql`: services table, staff RLS, booking confirmation, and status workflow.
- `0031_team3_repair_ops_features.sql`: service snapshots, actual repair start date, reschedule guard, and append-only operational history.

Allowed status changes (enforced by the database and mirrored in
`models/repair-ops.model.ts`):

- `pending` -> `in_progress` or `cancelled`
- `in_progress` -> `testing` or `cancelled`
- `testing` -> `completed` or `in_progress`
- `completed` and `cancelled` are final

Starting work requires a confirmed booking and an assigned technician. A
booking can be confirmed once. Staff rescheduling is limited to pending repairs
and uses the shared availability constraint; previous schedules are kept in the
operational history.

Operational history records status changes, technician assignments, schedule
changes, and staff notes with actor and timestamp. Service name and price are
snapshotted at booking time so catalog edits do not rewrite historical repairs.

Reads from other modules: active technicians through `TechniciansGateway` from
`@kitafix/booking`, customer profiles, and booking display helpers.
