# Getting Started (new team member)

Everything you need to clone the project, run it, and push your first change.
No prior Angular or Supabase experience assumed.

## 1. Install the tools

| Tool | Where |
| --- | --- |
| Node.js 22 LTS | https://nodejs.org (or use `nvm`) |
| Git | https://git-scm.com |
| VS Code (recommended) | https://code.visualstudio.com |
| Docker Desktop (only for local Supabase) | https://www.docker.com/products/docker-desktop |
| Supabase CLI | not installed globally; use `npx supabase ...` |

Check versions:

```bash
node --version     # should print v22.x
git --version
```

## 2. Clone and install

```bash
git clone https://github.com/RN22345/KitaFix_IonicPort.git
cd KitaFix_IonicPort
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`. Use it instead of
`npm install` so everyone gets the same build.

## 3. Run the app (no database, no internet)

The default mode uses `.ts` placeholder data:

```bash
npm start
```

Open http://localhost:4200. You should see the customer tabs (Dashboard, New
Booking, My repairs) with sample data. Book twice in the same slot and the
second one is rejected - that rule is mirrored from the real database.

To switch back to offline mode later, set `useMockData: true` in
`src/environments/environment.ts`.

## 4. Run against the shared hosted database

The repo already points at a hosted Supabase project
(`useMockData: false`, key filled in). You need an account:

- Emails/roles: [`Hosted_Project.md`](Hosted_Project.md)
- Password: ask in the group chat (not stored in the repo - it is public).
- Sign in through the temporary **`/dev-login`** screen. (Team 1's real login
  screen replaces it when ready.)

If you are Team 1/3/4, do not change `environment.ts` unless you agreed with the
group - it is the one shared connection.

## 5. Your first change (branch -> commit -> push -> PR)

```bash
# 0. start from the latest main
git switch main
git pull

# 1. create your branch
git switch -c team2/short-topic

# 2. make changes, then check the build
npm run build

# 3. commit (Conventional Commits, scoped to your module)
git add -A
git commit -m "feat(booking): show price estimate on the booking form"

# 4. push
git push -u origin team2/short-topic
```

Then open a pull request on GitHub (the button appears after pushing). Fill in
the template, wait for the green CI check, and ask the module owner to review.
Never push straight to `main`.

## 6. Project layout (where do I put my code?)

```
src/                     app shell (routes, tabs, providers) - shared, edit with care
libs/shared-types/       generated database contract - regenerate, do not hand-edit
libs/booking/            Team 2 module (reference implementation)
libs/<your-module>/      your module goes here (identity, repair-ops, insights)
supabase/migrations/     one file per team, numbered (see CONTRIBUTING.md)
supabase/seed_demo_data.sql
tools/supabase/          passwordless database helpers
docs/                    specs, plans, guides
```

Adding your own module: follow [`Adding_Your_Module.md`](Adding_Your_Module.md).

## 7. Troubleshooting

**`npm` will not run in PowerShell** (`npm.ps1 cannot be loaded because running
scripts is disabled`). Use `npm.cmd` instead of `npm`, or run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

**`npm ci` warns "install scripts blocked"** (npm 12 policy). The build still
works; if a tool complains, run `npm install-scripts approve esbuild` or run the
command in Git Bash / CI.

**Wrong Node version** - run `nvm use` (reads `.nvmrc`), then `npm ci` again.

**Line endings look changed on every file** - make sure `.gitattributes` is
present and run `git config core.autocrlf false` (the repo stores LF).

**Supabase sign in fails** - check `/dev-login` uses an account from
[`Hosted_Project.md`](Hosted_Project.md) and that
`src/environments/environment.ts` still has the shared URL/key.

**Build error after pulling someone's migration** - regenerate the contract:
see `tools/supabase/README.md` or `docs/Database_Setup.md`.

## 8. Golden rules (short version)

1. One team owns one library and its tables - do not edit another team's.
2. One migration file per change: `NNNN_teamN_*.sql`.
3. No table without RLS.
4. Never rename/remove a frozen column or an enum value - add a new one instead.
5. Import other teams only through their barrel file, never deep paths.
6. `npm run build` must pass before you open a PR.
