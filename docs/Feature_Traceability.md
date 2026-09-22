# Feature Traceability - Team 2

Every item from the Module Plan v4 Team 2 card, where it lives, and how it is
tested. Use this as the checklist during the finals walkthrough.

## Required features

| # | Feature (plan) | Code | Database | Test |
| --- | --- | --- | --- | --- |
| 1 | Dashboard: welcome + list of my repairs | `pages/dashboard/*`, `RepairsService.statusCounts` | `listByCustomer` (`select ... where customer_id = auth.uid()`) | C1 |
| 2 | Booking form: brand, model, location, date, time, service, technician, 6 issue checkboxes | `pages/new-booking/*`, `BookingDraft` | `repairs` insert | A1, C2 |
| 3 | Validation: brand/model required, >= 1 issue, date not in the past | `validation/booking.validators.ts` | `repairs_*_check` constraints | A1, A2 |
| 4 | Availability: two bookings same location + same hour must fail, via DB constraint | form hides taken slots (`get_taken_slots`), errors mapped in `postgrest-errors.ts` | `repairs_no_double_booking` EXCLUDE (gist) | A3, A4, B10 |
| 5 | My Repairs: ID, item, date, status | `pages/my-repairs/*`, `ui/repair-card` | `listByCustomer` | C2 |
| 6 | Cancel my own booking | `RepairsService.cancelRepair`, card button + confirm alert | `repairs_update_own` + `repairs_guard_customer_update` | A5, B1, B2, B3 |

## Recommended features

| # | Feature | Code | Test |
| --- | --- | --- | --- |
| 1 | Reschedule own booking | `ui/reschedule-modal` | B4, B5 |
| 2 | Show free slots only | `NewBookingPage.freeSlots` computed | B9 |
| 3 | Price estimate from service + issues | `pricing/price-estimate.ts` + estimate card | C4 |
| 4 | Live status update (Supabase Realtime) | `services/repairs-realtime.service.ts` + publication in 0020 | C5 |

## Module card extras

| Item | Where |
| --- | --- |
| Exposes repairs data to Team 3 / Team 4 | documented in `docs/Cross_Module_Contract.md`, enforced by RLS |
| Booking created event | the `repairs` row + realtime publication |
| Reads technicians from Team 1 | `data-access/gateways/technicians.gateway.ts` |
| Reads services from Team 3 | `data-access/gateways/services.gateway.ts` |
| Docs: booking rule + availability test plan | `docs/Booking_Rule.md`, `docs/Availability_Test_Plan.md` |

## Definition of Done (Module Plan v4, section 10)

| Item | Status in this folder |
| --- | --- |
| All required features work in the real app | Mock mode now; real mode after `docs/Database_Setup.md` |
| Manual test plan written and run | `docs/Availability_Test_Plan.md` (result sheet section D) |
| Migration exists and runs from an empty database | `supabase/migrations/0020_team2_booking.sql` (`supabase db reset`) |
| RLS for every owned table; customer cannot read another customer's row | policies in 0020; checklist in `supabase/README.md` |
| Library README: screens, tables, exported functions | `libs/booking/README.md` |
| No deep import into another team's library | we only import `@kitafix/shared-types`; our own internals are behind `@kitafix/booking` |
| Friendly empty + error states, no raw DB error on screen | empty states in all 3 pages; `bookingErrorMessage` mapping |

## The 6 issue flags (frozen names)

`issue_screen`, `issue_battery`, `issue_charging`, `issue_camera`,
`issue_audio`, `issue_software` - in `libs/shared-types`, `ISSUE_DEFINITIONS`
and as columns in `0020_team2_booking.sql`. Renaming any of them is a contract
change (rule R10).
