# libs/repair-ops (Team 3 - Shop & Repair Operations)

Staff and technician screens for the repair shop, including queue management,
repair history, notes, the technician service history log, scheduling, and
service catalog maintenance.

| Screen | Route | What it does |
| --- | --- | --- |
| Admin Portal | `/ops/admin-portal` | All / Pending / Confirmed summary cards and latest repairs |
| Repair Queue | `/ops/repair-queue` | Search, status/technician/service/date filters, sorting, pagination, confirmation, status changes (with optional remarks), technician assignment, notes, status history, service history log, and rescheduling |
| Service Catalog | `/ops/service-catalog` | List, add, edit, activate, and deactivate services |

Roles (FSD): **SA** (staff/admin) uses every screen. **TECH** (technician) sees
only the Repair Queue, only repairs assigned to them, and can add notes, view the
history and write service history entries. Everything else is staff-only, enforced
by RLS/triggers and mirrored in the UI (`RepairOpsSession`, `adminOnlyGuard`).

Service history log (`repair_service_logs`): what a technician did on a repair,
**where** (location/bench), **when** (`performed_at`) and the **details**. Entries
are append-only, can only be written while the repair is In Progress or Testing,
always belong to the technician assigned at that moment (staff may log on their
behalf), and cannot be dated in the future. Shown in the queue under
"View details" -> "Service history" (modal: `ui/service-log-modal`).

Database migrations:

- `0030_team3_repair_ops.sql`: services table, staff RLS, booking confirmation, and status workflow.
- `0031_team3_repair_ops_features.sql`: service snapshots, actual repair start date, reschedule guard, and append-only operational history.
- `0032_team3_service_history.sql`: `repair_service_logs` (service history), status-change remarks (`t3_update_repair_status`), technician access to notes/history, and the `repair_status_events` feed for the reporting module.

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

Offline demo as a technician: set `mockRole: 'technician'` in the
`provideRepairOps({...})` call (with `useMockData: true`). The placeholder session
is then Marco Reyes and only his repairs are listed.

After applying 0032 to a live project, regenerate the types
(`tools/supabase/gen-types.mjs`); `database.generated.ts` was extended by hand in
the same shape until then.
