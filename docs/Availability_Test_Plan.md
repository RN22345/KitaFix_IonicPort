# Availability Test Plan - Team 2

Required document from the Module Plan v4, Team 2 card.
Run these by hand before every demo. **Write down failed cases too**
(Definition of Done: "Failed cases are written down").

Two ways to run the tests:

- **Mock mode** (fastest): `npm start` with `useMockData: true`. The mock
  database mirrors the real rules.
- **Real mode** (final): local Supabase per `docs/Database_Setup.md`, then
  `useMockData: false`.

Record results in the table at the bottom (date, mode, result, notes).

**Database shortcut:** `supabase/tests/team2_rules_check.sql` runs A1-A5, B1-B9
and B11 directly against the database (paste it into the Supabase SQL editor).
It rolls everything back and prints PASS/FAIL lines you can copy into section D.

## A. Required tests (from the module card)

| # | Test | Steps | Expected result |
| --- | --- | --- | --- |
| A1 | **Book with empty fields must block** | New booking -> on the Device step leave brand, model empty and pick no issue -> Next | Step does not advance; red notes on brand, model and "Please pick at least one problem."; nothing is saved (real mode: no row in `repairs`) |
| A2 | **Book a past date must block** | Open the date picker | Yesterday and earlier are not selectable (`min` = today); even if forced with devtools, `notPastDate` rejects and the DB trigger `repairs_booking_date_rule` rejects the insert (23514; it was a CHECK until 0023) |
| A3 | **Book the same slot twice must fail** | Book `Main Branch - Downtown`, tomorrow 10:00. Then book the same branch/date/time again | Second attempt fails with "That time is already booked at this location." In the SQL editor the second insert gives `23P01 repairs_no_double_booking` |
| A4 | **Same time, different location must pass** | Book `Main Branch - Downtown`, tomorrow 10:00. Then `North Mall Branch`, tomorrow 10:00 | Both bookings are created; the list shows two rows at 10:00 with different branches |
| A5 | **Cancel a completed repair must block** | Find a completed repair in My repairs | Cancel button is disabled; via SQL/API an update `status='cancelled'` fails with `42501` "This repair can no longer be changed by the customer." |

## B. Rule tests (booking rule document)

| # | Test | Steps | Expected result |
| --- | --- | --- | --- |
| B1 | Cancel a pending booking | Book a future repair -> Cancel -> confirm | Status becomes `cancelled`, badge grey; the cancelled hour appears again in the free slot list |
| B2 | Cancel an in-progress booking | Staff sets status to `in_progress` (stub SQL: `update repairs set status='in_progress'`) -> customer taps Cancel | Allowed (rule: pending or in_progress) |
| B3 | Cancel a testing booking | Status `testing` -> Cancel | Button disabled; API update fails `42501` |
| B4 | Reschedule a pending booking | Pending repair -> Reschedule -> pick another free hour | Saved, list shows the new date/time; old slot becomes free |
| B5 | Reschedule to a taken hour | Two bookings exist; reschedule one onto the other's hour | Fails with the friendly slot-taken message; slot list refreshes; row unchanged |
| B6 | Customer cannot change workflow columns | With a customer JWT call `PATCH /rest/v1/repairs? id=eq...` with `{"status":"completed"}` or `{"technician_id":"..."}` | `42501`; nothing changes |
| B7 | Customer cannot edit the device after booking | PATCH `{"device_brand":"Other"}` | `42501`; nothing changes |
| B8 | Cancelled slot becomes bookable again | Cancel a booking, then book its old slot | New booking succeeds |
| B9 | Only free slots are offered | Book tomorrow 10:00, open New booking with the same branch/date | 10:00 is not in the Time list; the other configured hours are |
| B10 | Race: two inserts at the same moment | Two SQL sessions (or two browsers) insert the same branch/date/time; commit both | Exactly one succeeds; the other gets `23P01`. The DB constraint, not the UI, decided |
| B11 | RLS: only my rows | Sign in as customer B; run `select * from repairs` | Only B's rows are returned |
| B12 | At most 3 active repairs | Have 3 pending / in-progress / testing repairs, open Book | Book tab shows "You have 3 active repairs" with the list; Home says "You're all booked". A 4th insert via API fails with `KF001`. Cancel one -> booking works again |
| B13 | Old bookings can still change | A repair whose date has passed: staff moves it to `testing`, or the customer cancels it while pending | Allowed (before 0023 this failed with 23514). Moving a booking to a past date still fails |

## C. Screen and UX tests

| # | Test | Steps | Expected result |
| --- | --- | --- | --- |
| C1 | Home greeting + active repairs | Sign in / open the app | "Good morning/afternoon/evening, <first name>", one Book a repair button, up to 3 active repairs with progress bars |
| C2 | My repairs content | Open My repairs | Each card has short ID, device, date, time, branch, issues, status |
| C3 | Empty states | Filter History with no finished repairs | Friendly message, no blank screen, no raw database text |
| C4 | Price estimate | Pick Screen + Battery, go to Review | Screen Replacement 1499 + Battery check 250 = 1749; no service picker on Review |
| C7 | Device from the list | Device step: tap Brand -> Samsung; Model list opens by itself; type `s24` -> Galaxy S24 | Green check and "Found in our list". Typing an unlisted model and pressing Next shows "That model isn't in our list..." until it is picked or "Not in the list" is ticked |
| C8 | Quick book + success | Home -> Quick book "Battery" -> finish the steps -> Book repair | Battery is already picked; a "You're booked!" screen shows the date, branch and reference |
| C5 | Live status update (recommended) | Real mode. Open My repairs. From Studio/staff app set the repair to `in_progress` | The badge updates on the customer screen without refresh (Realtime publication) |
| C6 | Refresh + error handling | Pull to refresh; then stop Supabase and try again | List refreshes; when Supabase is down a friendly error banner appears with Retry |

## D. Result sheet (fill during the demo run)

| Date | Mode (mock/real) | Test # | Result (pass/fail) | Notes / error text |
| --- | --- | --- | --- | --- |
| 2026-10-16 | mock UI + real (DB script) | A1 | pass | UI: Details step blocks, "Please pick at least one problem." DB: 23514 on blank brand and on no issue + no note |
| 2026-10-16 | real (DB script) | A2 | pass | 23514 repairs_booking_date_not_past |
| 2026-10-16 | real (DB script) | A3 | pass | second insert 23P01 repairs_no_double_booking |
| 2026-10-16 | real (DB script) | A4 | pass | same time at North Mall Branch accepted |
| 2026-10-16 | real (DB script) | A5 | pass | 42501 "This repair can no longer be changed by the customer." |
| 2026-10-16 | real (DB script) | B1 | pass | cancelled; taken hours went 10:00,11:00 -> 10:00 |
| 2026-10-16 | real (DB script) | B2 | pass | in_progress cancel allowed |
| 2026-10-16 | real (DB script) | B3 | pass | testing cancel 42501 |
| 2026-10-16 | real (DB script) | B4 | pass | moved 13:00 -> 17:00 |
| 2026-10-16 | real (DB script) | B5 | pass | 23P01 on reschedule onto taken 14:00 |
| 2026-10-16 | real (DB script) | B6 | pass | status and technician_id changes: 42501 |
| 2026-10-16 | real (DB script) | B7 | pass | device_brand and issue flag edits: 42501 |
| 2026-10-16 | real (DB script) | B8 | pass | cancelled 11:00 rebooked |
| 2026-10-16 | real (DB script) | B9 | pass | get_taken_slots returned exactly the booked hours |
|  |  | B10 | not run | needs two parallel sessions; A3 exercises the same constraint |
| 2026-10-16 | real (DB script) | B11 | pass | another customer sees 0 rows; anon sees 0; technician sees only assigned jobs (Team 3 stub policy) |
| | | C1 | | |
| | | C2 | | |
| | | C3 | | |
| 2026-10-16 | mock UI | C4 | pass | Screen Replacement 1499 + Battery 250 + Camera 300 = 2049 |
| | | C5 | | |
| | | C6 | | |

## E. Ready-made SQL for the staff-side steps (local stubs only)

```sql
-- make a repair in progress (run as postgres in Studio; guard trigger allows it)
update public.repairs
set status = 'in_progress',
    technician_id = (select id from public.technicians limit 1)
where id = '<repair uuid>';

-- make it completed, then try to cancel it as the customer
update public.repairs set status = 'completed' where id = '<repair uuid>';
```
