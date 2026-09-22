# KitaFix — 4 Module Plan (Ionic + Angular + Supabase)

Version 4 — web stack. Replaces the C# desktop plan (v3).

Purpose: split the system into 4 equal modules for 4 student teams. Each team builds and tests its module alone. At the end, all 4 connect into one working system.

# 1. Fixed stack

| Layer | Choice | Why / note |
| --- | --- | --- |
| Customer app | Ionic + Angular (standalone) | Phone-first booking. One code base for web + mobile. |
| Staff app | Angular (standalone) + Angular Material | Admin portal. Material tables are good for long lists. |
| Backend | Supabase | No server to write and no server to host. |
| Database | Postgres (inside Supabase) | Real SQL. Needed for the report module. |
| Login / signup | Supabase Auth | Built in. No login code to write from zero. |
| Security | Row Level Security (RLS) | Each team writes policies for its own tables. |
| Business rules | Postgres function / trigger / constraint | Rules live in the database, so they are testable and safe. |
| Shared types | supabase gen types typescript | Auto-generated. This is the team contract. |
| Hosting | Supabase free + any static host | Static host = Netlify / Vercel / Cloudflare Pages. Cost = $0. |
| Offline demo | Supabase self-hosted (Docker) or local Postgres | Demo does not need internet. |

# 2. The 4 modules (re-checked)

What changed from the C# split, and why:

Supabase gives login, CRUD API and hosting for free. That made the old "Accounts" team too light.

Technicians moved to Team 1. A technician is a staff person with skills, so it belongs with people and accounts.

Services (the shop menu and prices) moved to Team 3. It is shop setup, and it takes load off Team 2.

Result: each team now has database work + screen work + logic work. No team is only screens or only SQL.

| Team | Module | Owns in the database | Angular library | Main screens |
| --- | --- | --- | --- | --- |
| 1 | Identity & People | profiles, technicians, audit_log | libs/identity | Login, Signup, Forgot Password, Profile, Staff Accounts, Technicians |
| 2 | Booking & Scheduling | repairs (customer part), availability rule | libs/booking | Dashboard, New Booking, My Repairs |
| 3 | Shop & Repair Operations | services, repairs (workflow part) | libs/repair-ops | Admin Portal, Repair Queue, Service Catalog |
| 4 | Feedback & Insights | reviews, 3 report views | libs/insights | Reviews, Reports |

# 3. Balance check

Each team gets one hard task. This is what keeps the loading fair.

| Team | Database work | Screen work | Logic work (the hard part) | Load |
| --- | --- | --- | --- | --- |
| 1 | 3 tables + RLS + role helpers | 6 small screens | Role model + RLS helper functions + audit trigger | Medium-High |
| 2 | 1 table + RLS + 1 exclusion constraint | 3 screens | Double-booking rule + input validation | High |
| 3 | 2 tables + 1 status trigger | 3 screens (biggest UI) | Status workflow state machine | High |
| 4 | 1 table + 3 SQL views | 2 screens | Aggregation (average, counts, performance) | Medium-High |

Note: Team 1 looks light, but it owns the role model and the RLS helper functions that everyone else uses. That is shared-contract work, so it is not small.

# 4. Module cards

## Team 1 — Identity & People

| Field | Detail |
| --- | --- |
| Owns (database) | profiles, technicians, audit_log |
| Owns (code) | libs/identity, and the shared RLS helper functions |
| Screens | Login, Signup, Forgot Password, Reset Password, Profile, Staff Accounts, Technicians |
| Required features | 1) Email + password login and signup (Supabase Auth). 2) Session handling + Angular route guards (block not-logged-in users). 3) Profile: view and edit own details. 4) Roles: customer / technician / staff / admin. Store role in the profiles table. 5) RLS helper functions: is_staff(), my_role(), current_user_no(). Other teams call these. 6) Staff account list: change role, deactivate account. |
| Recommended features | 1) Forgot password email flow. 2) Audit log: a trigger writes who changed what. 3) Force logout on deactivate. 4) Profile picture upload (Supabase Storage). |
| Manual tests | Login with good and bad password. Signup with duplicate email. Guard blocks /staff for a customer. Role change takes effect after re-login. Deactivated user cannot log in. |
| Exposes to others | Technician list (for Team 2 picker and Team 3 assign). Profile name for displays. RLS helper functions. |
| Reads from others | Nothing. Team 1 is the base layer. |
| Docs to write | Role table. RLS policy list. Login test plan. |

## Team 2 — Booking & Scheduling

| Field | Detail |
| --- | --- |
| Owns (database) | repairs (booking columns: user, service, device, location, date, time, 6 issue flags). Availability rule. |
| Owns (code) | libs/booking |
| Screens | Customer Dashboard, New Booking form, My Repairs list |
| Required features | 1) Dashboard: welcome + list of my repairs. 2) Booking form: device brand, device model, location, date, time, service, technician, 6 issue checkboxes. 3) Validation: brand and model required, at least 1 issue, date not in the past. 4) Availability: do not allow 2 bookings for the same location and the same hour. Use a database constraint. 5) My Repairs: list with ID, item, date, status. 6) Cancel my own booking. |
| Recommended features | 1) Reschedule own booking. 2) Show free time slots only (hide taken hours). 3) Price estimate from the chosen service + issues. 4) Live status update on screen (Supabase Realtime). |
| Manual tests | Book with empty fields (must block). Book a past date (must block). Book the same slot twice (second must fail). Book same time at a different location (must pass). Cancel a completed repair (must block). |
| Exposes to others | Repairs data for Team 3 (queue) and Team 4 (reports). Booking created event. |
| Reads from others | Technician list from Team 1. Service list from Team 3. |
| Docs to write | Booking rule document. Availability test plan. |

## Team 3 — Shop & Repair Operations

| Field | Detail |
| --- | --- |
| Owns (database) | services (menu + prices). repairs (workflow columns: status, notes, technician, confirmed_by, confirmed_at). Status trigger. |
| Owns (code) | libs/repair-ops |
| Screens | Admin Portal (summary cards), Repair Queue (list + filters), Service Catalog |
| Required features | 1) Admin Portal: summary cards (all, pending, confirmed) + queue list. 2) Queue table: ID, customer name, status, item, issue details. 3) Filters: All / Waiting for repair / Already processed. 4) Status change: pending -> in progress -> testing -> completed -> cancelled. 5) Confirm a booking (writes confirmed_by and confirmed_at). 6) Assign or change technician. 7) Service Catalog: add, edit, turn off a service. |
| Recommended features | 1) Search + sort + pagination on the queue. 2) Repair notes per job. 3) Reschedule from the staff side. 4) Delete or deactivate a user (calls Team 1). 5) Status history timeline. |
| Manual tests | Every allowed status change works. Illegal change (completed -> pending) is blocked. Confirm twice is blocked. Assign technician saves. Filters show the right rows. Counts match the list. |
| Exposes to others | Service list for Team 2. Status changes for Team 4 reporting. |
| Reads from others | Customer names from Team 1. Repairs from Team 2. |
| Docs to write | Status workflow diagram. Admin portal test plan. |

## Team 4 — Feedback & Insights

| Field | Detail |
| --- | --- |
| Owns (database) | reviews table. 3 SQL views: status summary, technician performance, review summary. |
| Owns (code) | libs/insights |
| Screens | Reviews (list + reply), Reports (dashboard + charts) |
| Required features | 1) Customer can review a repair only after it is completed. 2) One review per repair. Rating 1 to 5. Comment text. 3) Reviews list for staff: comment, rating, date, location, customer name. 4) Staff reply to a review. 5) Summary: total reviews + average rating + star display. 6) Report: repairs per status. 7) Report: technician performance (total and completed per technician). |
| Recommended features | 1) Rating distribution bar chart. 2) Filter reviews and reports by date range. 3) CSV export of reports. 4) Monthly trend chart. 5) Average response time. |
| Manual tests | Review a not-completed repair (must block). Review twice (must block). Rating 0 or 6 (must block). Average rating is correct. Empty report shows a friendly message. |
| Exposes to others | Rating summary for the staff dashboard. |
| Reads from others | Repairs and status from Team 2 and Team 3. Customer names from Team 1. |
| Docs to write | View definitions. Report field list. Test plan. |

# 5. Database ownership map

Rule: one owner per object. Other teams may read, but may not change it.

| Object | Type | Owner | Who reads it |
| --- | --- | --- | --- |
| profiles | table | Team 1 | All (name display) |
| technicians | table | Team 1 | Team 2 (picker), Team 3 (assign) |
| audit_log | table | Team 1 | Team 1 only |
| services | table | Team 3 | Team 2 (booking picker) |
| repairs | table | Team 2 (booking columns) + Team 3 (workflow columns) | Team 4 (reports) |
| reviews | table | Team 4 | Team 4, customer sees own |
| v_repair_status_summary | view | Team 4 | Team 4 |
| v_technician_performance | view | Team 4 | Team 4 |
| v_review_summary | view | Team 4 | Team 4 |

How one table can have two owners (repairs):

Team 2 writes the booking columns. Team 3 writes the workflow columns. No team touches the other team's columns.

RLS allows many policy sets on one table. Team 2 writes customer policies, Team 3 writes staff policies. Postgres joins them with OR.

# 6. Rules that keep the work modular

| # | Rule |
| --- | --- |
| R1 | One team = one Angular library + its tables + its RLS policies. Never edit another team's library or table. |
| R2 | Change the database only in your own migration file. Name it NNNN_teamN_description.sql, for example 0020_team2_booking.sql. |
| R3 | RLS: write policies only for your own tables. Never edit another team's policy. |
| R4 | The contract is frozen: table columns, enum values, and generated TypeScript types. Change them only with a group agreement. |
| R5 | Shared helper functions (Team 1 owns): is_staff(), my_role(), current_user_no(). Call them, do not edit them. |
| R6 | In Angular, import another library only through its index.ts barrel file. No deep imports like libs/booking/src/internal/x. |
| R7 | Each team owns its own routes. The app shell only declares lazy routes that point to each library. |
| R8 | Status values: use the repair_status type only. Never invent new strings. This was the number-one bug in the C# build. |
| R9 | Talk to another module through the database or the generated types. Never import another team's component. |
| R10 | Any contract change needs a short group note and a version line in this file. |

# 7. How to make a shared change

Add a column: write a migration, then report it in the group chat. Other teams pull and rebuild.

Add an enum value: ALTER TYPE ... ADD VALUE in one migration. Only the owner team does this.

Regenerate types: one person runs supabase gen types typescript after migrations merge. Commit the file.

Add a table: the owner team adds it with RLS policies in the same migration. No table is added without RLS.

Break a shared change: never rename or delete a column that another team reads. Add a new column and migrate instead.

# 8. Angular workspace layout

```
kitaFix/

  apps/

    customer/          Ionic + Angular  (customers)

    staff/             Angular Material (staff and admin)

  libs/

    shared-types/      generated from the database  (the contract)

    identity/          TEAM 1

    booking/           TEAM 2

    repair-ops/        TEAM 3

    insights/          TEAM 4

  supabase/

    migrations/        one file per team, numbered
```

Import direction (never break this):

apps -> libs. Allowed.

libs -> libs. Only through the barrel file, and only shared-types is common to all.

libs -> apps. Never.

# 9. Integration plan

| Week | Goal | Teams | How we know it works |
| --- | --- | --- | --- |
| 1 | Schema + RLS + generated types are frozen. Empty apps run. | All | Types file compiles. Both apps start. |
| 2 | Login works end to end. | 1 | Customer and staff reach different screens. |
| 3 | Customer can book. Double booking is rejected. | 2 | Second booking on the same slot fails. |
| 4 | Staff queue works and status changes. | 3 | Status change shows on the customer screen. |
| 5 | Reviews and reports work. | 4 | Average rating is correct. |
| 6 | Full system demo on one laptop, no internet. | All | Whole flow runs offline. |

Rule: integrate every week. Do not wait for the finals. A late team must not block the others, because each module can still run on sample data.

# 10. Definition of done (per module)

All required features work in the real app (not only in a test).

Manual test plan is written and all cases pass. Failed cases are written down too.

Database migration file exists and runs from an empty database.

RLS policies exist for every table the team owns. A customer cannot read another customer's row.

Own library README is written: screens, tables, exported functions.

No deep import into another team's library.

Screen shows a friendly message for empty data and for errors. No raw database error on screen.

# 11. Traps carried over from the C# build

| Trap from the old system | Rule for this build |
| --- | --- |
| One status field had 3 different spellings (Scheduled / Pending / Done). | Use one enum: repair_status. Convert old values on import. |
| The admin account was seeded with the role in the wrong column, so admin was really a normal user. | Store role explicitly in profiles. Write a test that logs in as admin and checks the role. |
| The profile screen opened without a user id, so saving always failed. | Always pass the session user. Never build a query without it. |
| The connection string was copied into 7 files, 1 of them wrong. | Supabase URL and key live in one environment file. |
| No availability check. Two bookings for the same slot both succeeded. | Enforce it in the database with an exclusion constraint, not only in the app. |
| Two screens were fully designed but had no logic. | Build the logic first. Style the screens last. |
| No tests, no way to run a screen without a database. | Write the test plan in week 1. Sample data in week 1. |

# 12. Cross-module calls (who needs what)

| Caller | Needs | From | How |
| --- | --- | --- | --- |
| Team 2 | Technician list for the picker | Team 1 | Read technicians table (RLS allows read). |
| Team 2 | Service list for the picker | Team 3 | Read services table (RLS allows read). |
| Team 3 | Customer name for the queue list | Team 1 | Join repairs to profiles. |
| Team 3 | Deactivate a user | Team 1 | Call a Team 1 database function. |
| Team 4 | Completed repairs and statuses | Teams 2 and 3 | Read repairs table, or use a view. |
| Team 1 | Who changed what | All teams | Triggers write into audit_log. |

# 13. Extra fields added to this plan

Because the plan is a Word file, these fields were added and can be filled per team in a live review:

| Field | Meaning | Filled by |
| --- | --- | --- |
| Load | Rough size of the module (Medium, High). | Team leaders, week 1 |
| Required features | Must ship or the module fails. | Team leaders |
| Recommended features | Stretch goals and feature expansion. | Team |
| Manual tests | Cases the team must run by hand. | Team |
| Exposes to others | What other teams may use. | Team leaders |
| Reads from others | Dependencies on other teams. | Team leaders |
| Docs to write | Required documents for the finals. | Team |
| Owner | Single team responsible for a database object. | Team leaders |

---

End of plan.
