# KitaFix - Ionic port

Shared **Ionic + Angular (standalone) + Supabase** application for the KitaFix
repair-shop system. One repository, four student teams, four modules that
integrate into one working app (see
[`docs/KitaFix_Module_Plan_v4.md`](docs/KitaFix_Module_Plan_v4.md)).

[![CI](https://github.com/RN22345/KitaFix_IonicPort/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RN22345/KitaFix_IonicPort/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/RN22345/KitaFix_IonicPort?sort=semver)](https://github.com/RN22345/KitaFix_IonicPort/releases)
[![Node](https://img.shields.io/badge/node-22.x-43853d)](https://nodejs.org)

## Start here

| I want to... | Go to |
| --- | --- |
| Set up the project and push my first change | [`docs/Getting_Started.md`](docs/Getting_Started.md) |
| Understand the workflow, rules and PR process | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Add my team's module to the port | [`docs/Adding_Your_Module.md`](docs/Adding_Your_Module.md) |
| Read the module spec and rules | [`docs/KitaFix_Module_Plan_v4.md`](docs/KitaFix_Module_Plan_v4.md) |
| Connect to the shared database | [`docs/Hosted_Project.md`](docs/Hosted_Project.md), [`docs/Database_Setup.md`](docs/Database_Setup.md) |
| Understand CI, tags and releases | [`docs/Versioning_and_Releases.md`](docs/Versioning_and_Releases.md) |
| See a downloadable build | [Releases](https://github.com/RN22345/KitaFix_IonicPort/releases) |

## Quick start

```bash
git clone https://github.com/RN22345/KitaFix_IonicPort.git
cd KitaFix_IonicPort
npm ci
npm start            # http://localhost:4200
```

Runs offline on `.ts` placeholder data by default. The repo also points at a
hosted Supabase project (`useMockData: false`); the demo accounts are listed in
[`docs/Hosted_Project.md`](docs/Hosted_Project.md). The full walkthrough is in
[`docs/Getting_Started.md`](docs/Getting_Started.md).

## Repository map

```
src/                      app shell: routes, tabs, providers, icons (shared - edit with care)
libs/
  shared-types/           generated database contract (regenerate, do not hand-edit)
  booking/                Team 2 module (reference implementation)
  <identity|repair-ops|insights>/   the other teams' modules go here
supabase/
  migrations/             one numbered file per team
  seed_demo_data.sql
  queries.sql             every booking query as raw SQL
tools/supabase/           passwordless database helpers (apply SQL, gen types, verify)
docs/                     plan, setup guides, per-module docs
.github/                  CI + release workflows, PR/issue templates, CODEOWNERS
```

## Teams and modules

| Team | Module | Library | Migration | Status |
| --- | --- | --- | --- | --- |
| 1 | Identity & People | `libs/identity` | `0010_team1_identity.sql` | not started |
| 2 | Booking & Scheduling | `libs/booking` | `0020_team2_booking.sql` | **done (reference)** |
| 3 | Shop & Repair Operations | `libs/repair-ops` | `0030_team3_repair_ops.sql` | not started |
| 4 | Feedback & Insights | `libs/insights` | `0040_team4_insights.sql` | not started |

Team 2's module is the template for everyone: library shape, repository
interface with mock and Supabase implementations, RLS + trigger migration,
owned docs, and a manual test plan. Details:
[`libs/booking/README.md`](libs/booking/README.md).

## The rules in one paragraph

One team owns one Angular library, its tables and its RLS policies - never edit
another team's (`R1`). Database changes go in `NNNN_teamN_*.sql` (`R2`) with RLS
for every table (`R3`). The generated types are the contract (`R4`); shared
helpers such as `is_staff()` are called, never redefined (`R5`). Import another
library only through its barrel file (`R6`), keep each team's routes inside its
own library (`R7`), and use the `repair_status` enum only - no invented status
strings (`R8`). Talk to other modules through the database, not their components
(`R9`). Any contract change needs a group note (`R10`). Full text:
[`docs/KitaFix_Module_Plan_v4.md`](docs/KitaFix_Module_Plan_v4.md).

## CI and releases

- Every push/PR to `main` builds the app (`.github/workflows/ci.yml`).
- Push a tag (`git tag -a v0.2.0 -m "..." && git push origin v0.2.0`) and a
  GitHub Release with a zipped build is created automatically
  (`.github/workflows/release.yml`).
- We do **not** publish npm packages - here is why and when to revisit:
  [`docs/Versioning_and_Releases.md`](docs/Versioning_and_Releases.md).

Changes are listed in [`CHANGELOG.md`](CHANGELOG.md).

## Notes

- The `*_local_stub_*.sql` migrations are Team 1/3 stand-ins so a module can run
  alone. Teams 1 and 3 delete them when their real migrations land.
- Offline finals demo: set `useMockData: true` in
  `src/environments/environment.ts` and reload.
- Never commit the `service_role` key, the database password, or a personal
  access token (`sbp_...`). The `anon` key is public by design - RLS protects
  the data.
