# Changelog

All notable changes to the KitaFix Ionic port are recorded here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/) loosely
(pre-1.0.0: milestones, not production).

## [Unreleased]

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
