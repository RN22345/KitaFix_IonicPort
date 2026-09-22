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

## A. Required tests (from the module card)

| # | Test | Steps | Expected result |
| --- | --- | --- | --- |
| A1 | **Book with empty fields must block** | New booking -> leave brand, model empty, no issues -> Book repair | Form shows red notes on brand/model/issues; nothing is saved; warning toast "Please complete the highlighted fields." (real mode: no row in `repairs`) |
| A2 | **Book a past date must block** | Open the date picker | Yesterday and earlier are not selectable (`min` = today); even if forced with devtools, `notPastDate` rejects and the DB `repairs_booking_date_not_past` rejects the insert |
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

## C. Screen and UX tests

| # | Test | Steps | Expected result |
| --- | --- | --- | --- |
| C1 | Dashboard welcome + list | Sign in / open the app | "Hello, <first name>!" and the 3 newest active repairs with status badges |
| C2 | My repairs content | Open My repairs | Each card has short ID, device, date, time, branch, issues, status |
| C3 | Empty states | Filter History with no finished repairs | Friendly message, no blank screen, no raw database text |
| C4 | Price estimate | Pick a service and tick issues | Estimated total = base price + issue fees (e.g. Screen Replacement 1499 + Battery 250 = 1749) |
| C5 | Live status update (recommended) | Real mode. Open My repairs. From Studio/staff app set the repair to `in_progress` | The badge updates on the customer screen without refresh (Realtime publication) |
| C6 | Refresh + error handling | Pull to refresh; then stop Supabase and try again | List refreshes; when Supabase is down a friendly error banner appears with Retry |

## D. Result sheet (fill during the demo run)

| Date | Mode (mock/real) | Test # | Result (pass/fail) | Notes / error text |
| --- | --- | --- | --- | --- |
| | | A1 | | |
| | | A2 | | |
| | | A3 | | |
| | | A4 | | |
| | | A5 | | |
| | | B1 | | |
| | | B2 | | |
| | | B3 | | |
| | | B4 | | |
| | | B5 | | |
| | | B6 | | |
| | | B7 | | |
| | | B8 | | |
| | | B9 | | |
| | | B10 | | |
| | | B11 | | |
| | | C1 | | |
| | | C2 | | |
| | | C3 | | |
| | | C4 | | |
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
