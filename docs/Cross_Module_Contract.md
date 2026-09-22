# Cross-Module Contract - Team 2 (Booking & Scheduling)

What we read from others, what we expose, and how. Kept in sync with
Module Plan v4, sections 5, 6 and 12, and the frozen contract (rule R4).

## What Team 2 READS from other teams

| Need | From | Object | Exact query (see `libs/booking/src/lib/data-access/gateways/`) |
| --- | --- | --- | --- |
| Technician picker in the booking form | Team 1 | `technicians` + `profiles.full_name` | `select t.id, p.full_name, t.skills from technicians t join profiles p on p.id = t.profile_id where t.active is true` |
| Customer name for dashboard/profile | Team 1 | `profiles.full_name` | `select id, full_name, role from profiles where id = auth.uid()` |
| RLS helpers | Team 1 | `is_staff()`, `my_role()`, `current_user_no()` | called from our guard trigger + future policies (rule R5: call, never edit) |
| Auth session | Supabase Auth | `auth.uid()` | via `supabase.auth.getUser()` in `SupabaseCurrentUserService` |
| Service menu + prices | Team 3 | `services` | `select id, name, description, base_price from services where active is true` |
| Status values | Team 3 | `repair_status` enum | we only compare against the frozen values (rule R8) |

**What we promise to those readers:** we never write to `profiles`,
`technicians`, `services`, and never invent status strings.

## What Team 2 EXPOSES

| Consumer | Need | Object | How they use it |
| --- | --- | --- | --- |
| Team 3 (Repair Queue) | list of bookings to repair | `public.repairs` | `select` (their staff RLS policy in 0030), joins to `profiles` for the customer name |
| Team 3 (status workflow) | write workflow columns | `repairs.status`, `staff_notes`, `technician_id`, `confirmed_by`, `confirmed_at` | `update` under their staff policy; our guard trigger lets staff through untouched |
| Team 4 (reports, reviews) | completed repairs + statuses | `public.repairs` | read-only; their views aggregate our rows (`v_repair_status_summary`, `v_technician_performance`) |
| Team 4 (reviews) | "review only after completed" | `repairs.status` | their trigger/view checks `status = 'completed'`; a review references the repair id |
| Everyone | "a booking happened" event | the new `repairs` row | it becomes visible to Team 3/4 immediately (plus Supabase Realtime if they subscribe) |

## The shared table: who writes which columns

Frozen in `0020_team2_booking.sql` with `comment on column` markers:

| Columns | Owner | Notes |
| --- | --- | --- |
| `customer_id, service_id, device_brand, device_model, location, booking_date, booking_time, issue_* (6)` | Team 2 | customer may update only date/time after insert (guard trigger) |
| `status, staff_notes, technician_id, confirmed_by, confirmed_at` | Team 3 | customer may only cancel via `status='cancelled'`; `technician_id` may be requested at insert |
| `id, created_at, updated_at, booking_slot` | shared housekeeping | `booking_slot` is Team 2's generated column for the exclusion constraint |

## Interfaces other teams may import (rule R6)

Through the barrel `@kitafix/booking`:

| Export | Who wants it | Why |
| --- | --- | --- |
| `Repair`, `RepairStatus` helpers (`statusMeta`, `REPAIR_STATUS_LIST`, `shortRepairId`, `formatBookingTime`, `formatBookingDate`) | Team 3 (queue UI), Team 4 (reports) | display repairs with the same status wording/colors |
| `StatusBadgeComponent`, `RepairCardComponent` | Team 3, Team 4 | reuse the status badge presentation |
| `BOOKING_ROUTES`, `provideBooking` | app shell only | lazy routes + DI wiring |

Nobody imports our pages or internal files directly.

## Ownership / numbering

- Our migration: `0020_team2_booking.sql` (rule R2).
- Our local stubs (`*_local_stub_*`) are deleted at merge time.
- Contract changes (columns, enum values, types) need a group note + a version
  line in the module plan (rule R10). We did not invent any status string
  (rule R8).
