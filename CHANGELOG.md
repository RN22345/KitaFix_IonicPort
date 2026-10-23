# Changelog

All notable changes to the KitaFix Ionic port are recorded here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/) loosely
(pre-1.0.0: milestones, not production).

## [Unreleased]

### Changed (group decision - one admin role)
- `staff` and `admin` are now one role, `admin`. `user_role` is `customer | technician | admin`; every staff profile became admin. Migration `0024_merge_staff_into_admin.sql`.
- `is_staff()` is replaced by `is_admin()` (true only for an active admin). Policies are renamed `*_admin_*` and call `(select public.is_admin())`. The local stubs 0001, 0002 and 0090 match. Teams 1, 3 and 4 use the new names in their real migrations.
- Demo account `staff@kitafix.test` is now `admin@kitafix.test`.
- 0024 applied to the hosted project 2026-10-23 after a rolled-back dry run. Result: roles admin 3, technician 5, customer 11; `is_staff()` is gone. Checked over the REST API: a customer setting their own `role` gets 403 (42501), editing their own name gets 204, calling `set_user_role` gets 403; an admin sees all 25 repairs and cannot change their own role. Security advisors: no new problems (the new admin functions are callable by signed-in users on purpose and check `is_admin()` inside; `is_admin()` and `my_role()` are no longer callable by `anon`). `libs/shared-types` regenerated from the hosted project (no change from the hand edit).

### Security
- A signed-in user could change their own `role` (and make themselves admin) through `profiles_update_own`. Users may now update only `full_name`, `phone` and `avatar_url`. Admins change roles and turn accounts on or off with `set_user_role(target, new_role)` and `set_user_active(target, is_active)`; neither works on the admin's own account. `set_user_role` also keeps `technicians` in step.

### Changed (Team 2 - booking polish)
- More colour and motion: each issue has its own icon and colour, status badges and repair cards are tinted by status, Home and Repairs headers have a blue-to-violet gradient, and steps, cards and chips animate in. Everything respects the phone's reduced-motion setting. New shared tokens (`--kf-violet/orange/pink/teal`, `data-tone`, `kf-*` keyframes) are documented in `libs/theme/README.md`.
- Home: "Quick book" issue tiles open New Booking with that issue already picked.
- New Booking, Device step: brand and model are picked from a list (tap to open; the brand list starts with popular brands, the model list with the brand's newest-looking models). A green check confirms a listed device. Ticking "Not in the list" lets the customer type any brand and model. Past devices still work as one-tap picks.
- New Booking, Review: the service picker is gone. The service follows from the picked issues (`serviceForIssues`); Review shows the issues as coloured tiles and a price breakdown.
- After booking, a success screen with the reference number replaces the toast.
- The device catalog now lists each brand's models newest-looking first (`browseOrder` in the builder) and `extra-devices.json` is kept newest first.

### Added (Team 2 - anti-spam limit)
- A customer can have at most 3 active repairs (pending, in progress or testing). The Book tab shows how many are left, and locks with a list of the active repairs at 3; Home and Repairs say so too. Enforced in the database by migration `0023_team2_booking_limits.sql` (trigger `repairs_limit_active_bookings`, SQLSTATE `KF001`).
- 0023 also cancels old bookings made before the limit: pending bookings whose date has passed, and the oldest pending ones of customers still over 3. In-progress and testing repairs are never touched.
- 0023 applied to the hosted project 2026-10-17 after a rolled-back dry run. Clean-up result: the demo customer went from 12 active (all pending, 8 past their date) to 3; 13 repairs are now cancelled. Security advisors: no new warnings (both new trigger functions are not callable over the API).

### Fixed (Team 2)
- "No past dates" was a CHECK constraint, which Postgres re-checks on every update: once a booking's date had passed, nobody could cancel it or move its status (Team 3 included). 0023 replaces it with a trigger that only checks the date when a booking is made or moved.

### Changed (Team 2 - UX redesign)
- Dark mode by default, with a softer light mode (blue-grey background, off-white surfaces). Switch in the account menu; remembered per device. All colours are shared `--kf-*` tokens in `src/global.scss`; new shared library `libs/theme`.
- Tabs are now Home / Book / Repairs. Removed duplicate ways into My Repairs (two Home tiles and a "See all" button), the dead "Technicians - Coming soon" tile, the Home search and the status counts.
- My Devices page removed: past devices are one-tap picks on the first booking step (the old link redirects).
- New Booking is 3 steps: Device (brand/model with suggestions, what's wrong) -> Schedule -> Review. The service is suggested from the picked issues instead of asked first; the customer can change it.
- Brand/model suggestions from Google Play's supported-devices list plus a hand-kept Apple/Huawei list (`tools/device-catalog`), refreshed weekly by a GitHub Action that opens a PR. Typing a device that is not listed still works.
- Price estimate no longer charges the fee of the issue the chosen service already fixes (Battery Replacement + Battery issue = ₱899, not ₱1,149).
- Repair cards show a Booked / In repair / Testing / Ready progress bar.

### Fixed (Team 2 - audit against Module Plan v4)
- New Booking is back in line with required features 2 and 3: the Details step has the six issue chips again (at least one must be picked); the free-text box stays as an optional "Anything else?" note. Empty notes are saved as `null`.
- The price estimate counts issue fees again (they were always 0 after the free-text change).
- Repair cards and the Confirm step show the picked issues followed by the note.
- A database that is missing a newer column (`PGRST204`) now shows a friendly message instead of the raw error.
- `libs/shared-types` checked against the hosted project after 0021 (only the PostgREST version stamp changed).

### Added (Team 2)
- Artist assets in the app: favicon / home-screen icon from the KitaFix app icon, and the four service icons on New Booking (replacing generic icons).
- Migration `0022_team2_hardening.sql` (privileges only): fixed `search_path` on `t2_repairs_touch_updated_at`, `get_taken_slots()` no longer callable by `anon`, guard trigger function not callable over the API. Applied to the hosted project 2026-10-16; the Team 2 advisor warnings are gone except `get_taken_slots` for signed-in users, which the booking form needs.
- `supabase/tests/team2_rules_check.sql`: runs test plan A1-A5, B1-B9 and B11 against the database as the demo customer and rolls everything back.

### Changed (Team 2 - UI/UX makeover, moodboard palette)
- Global theme now uses the KitaFix palette (blue `#0B5ED7`, green `#00C896`, ice `#E6F1FF`, navy `#0F172A`) with Poppins; tab bar restyled.
- My Repairs redesigned: hero header, search, filter counts, loading skeletons, "Book again" on finished repairs.
- Repair cards redesigned with a status colour stripe.
- New My Devices page (`/tabs/my-devices`), built from the customer's own repair history.
- Dashboard search now filters My Repairs; the bell lists real status changes pushed by Realtime.
- Fixed: a Realtime delete re-added a broken row; a booking could appear twice if the Realtime insert arrived first; hours that already passed today could still be picked.

### Changed (Team 2 - contract change, rule R10)
- New Booking is now a 4-step flow with a free-text `issue_description` instead of the six issue checkboxes.
- Migration `0021_team2_issue_description.sql` adds `repairs.issue_description` (nullable, max 500) and relaxes `repairs_at_least_one_issue`. It must be applied to the hosted project before `useMockData: false` bookings work. `libs/shared-types` was updated by hand to match; regenerate it after applying 0021.
- Dashboard redesigned to the moodboard (Poppins font now in `src/assets/fonts/poppins`).

### Planned
- Team 1 - Identity module (`libs/identity`, migration `0010_team1_identity.sql`)
- Team 3 - Repair Ops module (`libs/repair-ops`, migration `0030_team3_repair_ops.sql`)
- Team 4 - Insights module (`libs/insights`, migration `0040_team4_insights.sql`)

## [0.1.0] - 2026-09-22

### Added
- Team 2 - Booking & Scheduling module (`libs/booking`): customer Dashboard,
  New Booking form, My Repairs list.
- `repairs` booking columns, availability exclusion constraint
  (`repairs_no_double_booking`), customer RLS and the update guard trigger
  (`0020_team2_booking.sql`).
- `get_taken_slots()` database function for the "free slots only" picker.
- Supabase Realtime hook for live status updates.
- `.ts` placeholder data + mock repository so the module runs offline.
- Shared contract types (`libs/shared-types`) generated from the hosted project.
- Hosted Supabase project provisioned with migrations, demo accounts and seed data.
- CI (build) and Release (tagged builds) GitHub Actions workflows.
- Contributor documentation (`CONTRIBUTING.md`, `docs/`).

[Unreleased]: https://github.com/RN22345/KitaFix_IonicPort/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RN22345/KitaFix_IonicPort/releases/tag/v0.1.0
