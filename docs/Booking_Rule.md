# Booking Rule - Team 2

Required document from the Module Plan v4, Team 2 card:
*"Docs to write: Booking rule document, availability test plan."*

This rule is **enforced in the database first** and only reflected in the UI.

## 1. The slot

- A booking is one **1 hour slot**: `[booking_date + booking_time, +1 hour)`.
- The shop only offers fixed hours: **09:00, 10:00, 11:00, 13:00, 14:00, 15:00,
  16:00, 17:00** (configured once in `src/environments/environment.ts`).
- The slot belongs to a **location** (shop branch). Two branches have separate
  calendars.

## 2. The availability rule (the hard requirement)

> **One location cannot have two active bookings in the same hour.**

Enforced by the database, not by the app:

```sql
alter table public.repairs
  add constraint repairs_no_double_booking
  exclude using gist (location with =, booking_slot with &&)
  where (status <> 'cancelled');
```

- `booking_slot` is a generated `tsrange` column; `&&` checks overlap.
- `status <> 'cancelled'` means a cancelled booking frees its hour again.
- Two people clicking *Book* at the same second: one insert wins, the other gets
  SQLSTATE `23P01`. No app-level race window exists.

The booking form additionally hides taken hours (recommended feature) using
`public.get_taken_slots(location, date)`, which returns **only times**, never
other customers' data (it is `security definer` for that reason).

## 3. Input rules (app + database)

| Rule | App (`booking.validators.ts`) | Database |
| --- | --- | --- |
| Brand required, not blank | `trimmedRequired` | `repairs_device_brand_not_blank` |
| Model required, not blank | `trimmedRequired` | `repairs_device_model_not_blank` |
| Location required | select with default | `repairs_location_not_blank` |
| Service required | `Validators.required` | FK `service_id` |
| At least **1** of the 6 issues | `atLeastOneIssue` group validator | `repairs_at_least_one_issue` |
| Date not in the past | `notPastDate` + picker `min` | `repairs_booking_date_not_past` |
| Time required, from the slot list | select over free slots | slot overlap constraint |

## 4. Who may change what

`repairs` has two owners (Module Plan v4, section 5). The guard trigger
`repairs_guard_customer_update()` splits the columns:

| Column group | Customer | Staff (Team 3) |
| --- | --- | --- |
| booking columns (device, location, date, time, service, issues) | can set them only at **insert**; later only **date + time** (reschedule) | full control (staff-side reschedule is recommended for Team 3) |
| `status` | may only set `cancelled` | full workflow (`pending -> in_progress -> testing -> completed`, or `cancelled`) |
| `technician_id` | may **request** one at insert; cannot change later | assign / change freely |
| `staff_notes`, `confirmed_by`, `confirmed_at` | never | full control |

The app hides buttons that the database would reject anyway. The database is the
last word.

## 5. Cancel rule

A customer may cancel while the repair is **pending** or **in progress**.

- Cannot cancel once the status is `testing`, `completed`, or already `cancelled`
  (`42501`).
- Manual test "Cancel a completed repair (must block)" therefore passes at two
  levels: button disabled + database error if attempted directly.

## 6. Reschedule rule

A customer may reschedule **only a pending** booking (cancel + rebook is the
workaround once work started). The new slot must be free, so:

- the modal reloads free slots for the chosen date,
- the database re-checks on update, and a clash returns `23P01` -> friendly
  message + slot list refresh.

## 7. Error vocabulary shown to the user

Raw Postgres errors never reach the screen (`postgrest-errors.ts`):

| SQLSTATE | Meaning | Message on screen |
| --- | --- | --- |
| `23P01` / `23505` | slot taken | "That time is already booked at this location. Please pick another slot." |
| `42501` | guard/RLS blocked it | "You are not allowed to change this booking anymore." |
| `23503` | service/technician gone | "The selected service or technician is no longer available..." |
| `23514` | check failed | "The booking did not pass the validation rules..." |
| `PGRST116` | row not found | "Booking not found. It may have been removed already." |

## 8. Status values

Only the `repair_status` enum: `pending`, `in_progress`, `testing`, `completed`,
`cancelled` (rule R8 - the old C# build broke because one status had three
spellings). Team 2 never invents status strings; Team 3 owns the transitions.
