# Shop & Repair Operations - FSD traceability and test plan (Team 3)

Source: `FSD Shop & Repair Operations Group3 v1.0` (13/09/26). SA = shop admin /
staff, TECH = technician. "DB" = enforced by the database (migrations 0030-0032),
"UI" = screen behaviour. Run with `useMockData: false` after applying 0032, or
offline with `useMockData: true` (add `mockRole: 'technician'` for the TECH runs).

## 1. FSD -> code

| FSD | Requirement | Where |
| --- | --- | --- |
| 3.1 | Admin portal: All / Pending / Confirmed cards | `pages/admin-portal` |
| 3.2 | Queue: ID, customer, status, item, issue, technician, scheduled date/time | `pages/repair-queue` |
| 3.3-3.6 | Search, filter (status, technician, service, scheduled date, repair date), sort, pagination | `pages/repair-queue` |
| 3.7 | Confirm booking (`confirmed_by`, `confirmed_at`, once only) | `RepairOpsService.confirm`, DB `t3_repairs_status_guard` |
| 3.8 | Status workflow, invalid transitions blocked, every change in history | `STATUS_TRANSITIONS`, DB guard + `t3_repairs_record_history` |
| 3.9 / 3.10 | Assign / change technician, change recorded | `assign()`, history entry `technician` (now shows names) |
| 3.11 | Notes (SA / TECH), linked to the repair | `addNote()`; TECH policy `repair_ops_history_technician_note` (0032) |
| 3.12 | Reschedule, previous schedule kept | `reschedule()`, history entry `schedule` |
| 3.13 | Status timeline: previous, new, changed by, date/time, **remarks**, SA / TECH | `repair_ops_history.remarks` (0032), `t3_update_repair_status()`; TECH policy `repair_ops_history_technician_read` |
| 3.14-3.18 | Service catalog: view, add, edit, deactivate, activate | `pages/service-catalog`, snapshots keep old repairs unchanged |
| Scope | Service history: where / when / details of technician actions | `repair_service_logs` (0032), `ui/service-log-modal`, queue "Service history" |
| Scope | Status changes sent to the reporting module | view `repair_status_events` (0032) |

## 2. Service history log - test cases

| # | Role | Steps | Expected |
| --- | --- | --- | --- |
| SH-1 | SA | Open an **In Progress** repair -> View details -> Log service action. Pick *Repair work*, keep the location, set When to now, enter details, Save. | Entry appears under "Service history" with action, Where, When, details, technician name. Toast "Service action recorded". |
| SH-2 | TECH | Same as SH-1 on a repair assigned to you. | Saved; "Logged by" is not repeated because the technician logged it. |
| SH-3 | SA | Log on behalf of the assigned technician. | Technician = the assigned technician; "Logged by <staff name>" shown. |
| SH-4 | SA/TECH | Try on a **Pending**, **Completed** or **Cancelled** repair. | Button disabled with the reason "only while In Progress or Testing"; DB rejects a direct insert. |
| SH-5 | SA | Try on an In Progress repair with no technician. | Not possible: the status guard already requires a technician to start work. |
| SH-6 | SA/TECH | Leave Where blank. | "Enter where the action was performed." (DB would default to the booking location). |
| SH-7 | SA/TECH | Leave Details blank / only spaces. | "Enter the details of the action performed." |
| SH-8 | SA/TECH | Set When to a future date/time. | "The date and time of the action cannot be in the future." (DB: P0001) |
| SH-9 | SA/TECH | Set When earlier than the booking was created. | Rejected: "cannot be dated before the repair was booked." |
| SH-10 | SA/TECH | Enter 5,001 characters of details. | Blocked (counter + validation, DB check). |
| SH-11 | SA | Reassign the technician, then log again. | New entry shows the new technician; older entries keep the old one. |
| SH-12 | TECH | Open the queue. | Only repairs assigned to you are listed; you cannot read or log on other technicians' repairs. |
| SH-13 | any | Attempt `update` / `delete` on `repair_service_logs` through the API. | Denied (no grant): the log is append-only. |
| SH-14 | SA | Back-date an action (e.g. 2 hours ago). | Allowed; list is ordered by **When**, newest first. |

## 3. Other gaps closed in this version

| # | Role | Steps | Expected |
| --- | --- | --- | --- |
| ST-1 | SA | Update status In Progress -> Testing, enter remarks "Screen fitted". | Timeline row: previous, new, changed by, date/time **and** "Remarks: Screen fitted". |
| ST-2 | SA | Update status and leave remarks empty. | Row has no remarks line. |
| ST-3 | SA | Remarks over 1,000 characters. | "Remarks must be 1,000 characters or fewer." |
| ST-4 | SA | Completed -> Pending (illegal). | Blocked; no history row. |
| TC-1 | SA | Change technician A -> B. | History: "Technician: A -> B" (names, not ids). |
| TE-1 | TECH | Open a repair assigned to you -> View details. | Operational history, notes and service history visible. |
| TE-2 | TECH | Add a note. | Saved with your name; shows in the timeline. |
| TE-3 | TECH | Look for Confirm / Assign / Update status / Reschedule. | Not shown; direct API calls are rejected by RLS. |
| TE-4 | TECH | Open `/ops/admin-portal` or `/ops/service-catalog`. | Redirected to the Repair Queue; tabs hidden. |
| RP-1 | Reporting | `select * from repair_status_events where repair_id = ...` | One row per status change with remarks. |

## 4. Automated check run during development

`MockRepairOpsRepository` + `RepairOpsService` + model rules were exercised with a
script (39 checks, all passing): validation of every service-log field, allowed
statuses, newest-first ordering, technician binding after reassignment, remarks
trimming/limits, technician isolation (own jobs only, staff-only actions blocked).
The SQL in 0032 and the Supabase repository could not be run in that environment
(no Postgres / Angular install), so SH-13, DB-side rejections and the live
queries must be confirmed on the hosted project.
