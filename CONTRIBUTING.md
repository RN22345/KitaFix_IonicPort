# Contributing to the KitaFix Ionic port

This is the shared repository for all four teams. The golden rule:

> **One team = one library + its tables + its RLS policies.
> Never edit another team's library or table.**
> (Module Plan v4, rule R1 - full rules in
> [`docs/KitaFix_Module_Plan_v4.md`](docs/KitaFix_Module_Plan_v4.md).)

If you only want to get running and push your first change, read
[`docs/Getting_Started.md`](docs/Getting_Started.md) first.

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 (see `.nvmrc`) | `nvm use` if you use nvm |
| npm | 10+ | ships with Node 22 |
| Git | any recent | Windows: Git for Windows |
| Docker Desktop | optional | only for running Supabase locally |
| Supabase CLI | optional | `npx supabase ...` (no global install needed) |

## 2. Get the code and run it

```bash
git clone https://github.com/RN22345/KitaFix_IonicPort.git
cd KitaFix_IonicPort
npm ci
npm start            # http://localhost:4200  (mock data by default)
```

Full walkthrough, including the hosted database: [`docs/Getting_Started.md`](docs/Getting_Started.md).

## 3. Branching model

- `main` is the integration branch. Keep it buildable at all times.
- Never commit directly to `main`. Work on a branch and open a pull request.
- Branch names: `teamN/<short-topic>`.

```bash
git switch -c team2/booking-reschedule-tests
```

Examples: `team1/rls-helpers`, `team3/status-trigger`, `team4/reviews-view`,
`team2/availability-constraint`.

## 4. Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/); keep them
scoped to your module.

```
feat(booking): block same-slot bookings with exclusion constraint
fix(repair-ops): illegal status transition from completed
docs(identity): add login test plan
chore: bump angular to 20.3.5
```

Scope equals your module (`booking`, `identity`, `repair-ops`, `insights`) or
`shared`/`chore`/`docs` for cross-cutting work.

## 5. Pull requests

1. Rebase on the latest `main`: `git pull --rebase origin main`.
2. Make sure the build passes: `npm run build`.
3. Push and open a PR using the template.
4. CI must be green; the CODEOWNER of your module (and the maintainer while the
   other teams are not set up) reviews.
5. Squash-merge unless the history is meaningful.

The reviewer's checklist lives in
[`.github/REVIEW_GUIDE.md`](.github/REVIEW_GUIDE.md).

## 6. Database changes (the part that breaks teams)

- Every schema change goes in a **new** file: `supabase/migrations/NNNN_teamN_description.sql`.
  Never edit a migration that has already been merged.
- Reserve your number and stay in your column:

  | Range | Owner |
  | --- | --- |
  | `0001-0009` | local dev stubs (delete before final merge) |
  | `0010-0019` | Team 1 - Identity |
  | `0020-0029` | Team 2 - Booking |
  | `0030-0039` | Team 3 - Repair Ops |
  | `0040-0049` | Team 4 - Insights |
  | `00xx` / `0090+` | shared / local-only stubs |

- **No table without RLS.** Add policies in the same migration (rule R3).
- Use `if not exists` / guarded `DO` blocks so migrations can be re-applied.
- After merging a migration, one person regenerates the shared types:

  ```bash
  npx supabase gen types typescript --project-id <ref> > libs/shared-types/src/lib/database.generated.ts
  ```

  (or the passwordless helper in `tools/supabase/`).

## 7. Cross-module rules in one screen

- Read another team's data through the database (or their barrel export), never
  by importing their components (rules R6, R9).
- Call shared helpers (`is_staff()`, `my_role()`, `current_user_no()`) - never
  redefine or edit them (rule R5).
- Status strings come from the `repair_status` enum only (rule R8 - this was the
  #1 bug in the old build).
- Any contract change (column, enum value, type) needs a short group note and a
  version line in the module plan (rule R10) before it is merged.

## 8. Definition of done

From the Module Plan, section 10. A module is done when all required features
work in the real app, the manual test plan passes (including written-down
failures), the migration runs from an empty database, RLS exists for every owned
table, the library README is written, there are no deep imports into another
library, and empty/error states are friendly.

## 9. Getting help

- Open an issue with the **Bug report** or **Feature / task** template.
- Check the module plan and the docs folder before asking.
- Stuck on Supabase? See `docs/Database_Setup.md` and `docs/Hosted_Project.md`.
