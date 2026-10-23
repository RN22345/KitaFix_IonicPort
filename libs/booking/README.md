# libs/booking - Team 2 - Booking & Scheduling

Library README (Definition of Done: screens, tables, exported functions).
This folder is shaped exactly like the planned `libs/booking` in the group repo,
so it can be copied over as-is.

## Screens (lazy routes owned by Team 2)

| Route | Page | Purpose |
| --- | --- | --- |
| `/tabs/dashboard` (tab "Home") | `lib/pages/dashboard` | Greeting, Book a repair, Quick book issue tiles, active repairs with progress, light/dark switch |
| `/tabs/new-booking` (tab "Book") | `lib/pages/new-booking` | 3 steps: Device (past devices, brand/model from the list or typed, issues) -> Schedule (branch, date, free hours) -> Review (issues, technician, estimate) -> success screen. Locked at 3 active repairs |
| `/tabs/my-repairs` (tab "Repairs") | `lib/pages/my-repairs` | Active / History, search, cancel, reschedule (modal), book again |
| `/tabs/my-devices` | - | Redirects to New Booking (past devices are one-tap picks there) |

UI pieces: `lib/ui/status-badge`, `lib/ui/repair-card` (with progress bar), `lib/ui/reschedule-modal`.

Device suggestions: `lib/data-access/device-catalog` reads `src/assets/data/device-catalog.json`
(built by `tools/device-catalog/build-device-catalog.mjs` from Google Play's supported-devices list
plus `tools/device-catalog/extra-devices.json`, refreshed weekly by `.github/workflows/device-catalog.yml`).
The customer picks from the list, or ticks "Not in the list" to type any brand and model
(also used automatically when the list cannot load). Before typing, the model list shows the
top of the brand's catalog order, which the builder makes newest-looking first.

Service and pricing: the customer never picks a service. `lib/pricing/service-match.ts`
(`serviceForIssues`, `suggestService`, `issueCoveredBy`) derives it from the issues; with no
matching service it falls back to a "Diagnosis"/"General" service if Team 3 adds one, otherwise
the cheapest. `lib/pricing/price-estimate.ts` does not charge the fixed issue twice.

Anti-spam: at most `MAX_ACTIVE_BOOKINGS` (3) active repairs per customer
(`RepairsService.bookingsLeft`; database trigger `repairs_limit_active_bookings` in 0023).
Colours come from the shared `--kf-*` tokens (`src/global.scss`, `libs/theme`).

## Database objects

Owned by Team 2 (`supabase/migrations/0020_team2_booking.sql`):

| Object | Type | Notes |
| --- | --- | --- |
| `repairs` (booking columns) | table | device, location, date, time, service, 6 issue flags, optional `issue_description` |
| `repairs_no_double_booking` | exclusion constraint | same location + overlapping hour is rejected (23P01) |
| `repairs_select_own` / `insert_own` / `update_own` | RLS policies | customers only touch their own rows |
| `repairs_guard_customer_update()` | trigger function | customers may only cancel/reschedule |
| `get_taken_slots(location, date, exclude)` | function | taken hours for the form, no customer data leaked |

Read-only dependencies: `profiles`, `technicians` (Team 1), `services` (Team 3),
`repair_status` enum (Team 3), `is_admin()` (Team 1).

## Data access (`lib/data-access/`)

| Piece | Real | Placeholder |
| --- | --- | --- |
| `RepairsRepository` | `SupabaseRepairsRepository` (PostgREST) | `MockRepairsRepository` (in-memory) |
| `TechniciansGateway` | reads Team 1 `technicians` | `MOCK_TECHNICIANS` |
| `ServicesGateway` | reads Team 3 `services` | `MOCK_SERVICES` |
| `CurrentUserService` | Supabase Auth + `profiles` | `MOCK_CURRENT_USER` |

Switch with `provideBooking({ useMockData: true/false, ... })`.
Raw SQL for every method: `supabase/queries.sql`.

## Exported functions / types (barrel `src/index.ts`)

Domain and rules:

- `Repair`, `IssueFlagKey`, `ISSUE_DEFINITIONS`, `REPAIR_STATUS_LIST`
- `statusMeta(status)`, `issueLabels(repair)`, `problemSummary(repair)`
- `canCustomerCancel(repair)`, `canCustomerReschedule(repair)`
- `shortRepairId(id)`, `formatBookingDate(date)`, `formatTime(time)`, `normalizeTime(time)`
- `trimmedRequired`, `notPastDate`, `atLeastOneIssue` (Angular validators)
- `estimatePrice(service, issues)`, `estimatePriceForRepair`, `formatCurrency`
- `BookingError`, `bookingErrorMessage`
- `TechnicianOption`, `ServiceOption`, `CurrentUser`

Wiring and services:

- `provideBooking(config)`, `BOOKING_CONFIG`, `BookingConfig`
- `BOOKING_ROUTES`
- `RepairsService` (facade with signals), `RepairsRealtimeService`
- `RepairsRepository`, `SupabaseRepairsRepository`, `MockRepairsRepository`
- `TechniciansGateway` / `ServicesGateway` (+ real & mock classes)
- `CurrentUserService` (+ real & mock classes)
- `StatusBadgeComponent`, `RepairCardComponent`, `RescheduleModalComponent`

Dev-only placeholder data (also exported for demos/tests):
`MOCK_REPAIRS`, `MOCK_SERVICES`, `MOCK_TECHNICIANS`, `MOCK_CURRENT_USER`,
`mockRepairsDb`, `resetSupabaseClient`.

## Contract rules this library follows

- R1/R6: everything public goes through this README + `src/index.ts`; nobody
  deep-imports us, we deep-import nobody.
- R4/R8: status values and issue flag names come from the frozen enum/table.
- R5: `is_admin()` is called, never redefined (except the clearly marked local
  stub migration for standalone dev).
