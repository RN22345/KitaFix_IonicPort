# Versioning, CI, Releases (and why we skip Packages)

Practical guide for this repo. Short version:

- **CI:** every push/PR to `main` is built automatically (`.github/workflows/ci.yml`).
- **Releases:** push a version tag and a release with a downloadable build is created automatically (`.github/workflows/release.yml`).
- **Packages (npm/GitHub Packages):** **not used** - explained below.

## 1. Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main`:

1. checks out the repo,
2. installs with `npm ci` on Node 22,
3. runs `npm run build` (which type-checks every library and the app),
4. uploads the build output as a workflow artifact.

A red CI check means the PR should not be merged. This is the cheapest way to
stop a team's change from breaking the other three.

## 2. Versioning

This is a student project, so versions are **milestones**, not production
releases:

| Tag | Meaning |
| --- | --- |
| `v0.1.0` | Team 2 booking module + shared contract + hosted database |
| `v0.2.0` | + login end to end (Team 1) |
| `v0.3.0` | + staff queue / status workflow (Team 3) |
| `v0.4.0` | + reviews and reports (Team 4) |
| `v1.0.0` | full offline demo, all four modules integrated |

Add a `CHANGELOG.md` entry under **Unreleased** as you work, and move it under
the new version when you tag.

## 3. Cutting a release

```bash
git switch main
git pull
# update CHANGELOG.md (move Unreleased -> the new version)
git add CHANGELOG.md
git commit -m "chore(release): v0.2.0"
git push

git tag -a v0.2.0 -m "v0.2.0 - login works end to end"
git push origin v0.2.0
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the app,
zips `dist/customer`, and publishes a GitHub Release named after the tag with
auto-generated notes. The zip is attached as a release asset - handy for handing
in a runnable build without anyone installing Node.

Where to find it: repo -> **Releases** (right sidebar), or
https://github.com/RN22345/KitaFix_IonicPort/releases.

To delete a bad tag:

```bash
git push origin --delete v0.2.0
git tag -d v0.2.0
```

## 4. Why we do NOT publish npm packages

A "package" (GitHub Packages / npm registry) lets other projects install a
library by version, e.g. `npm install @kitafix/shared-types`. We deliberately do
not do that here:

| Reason | Detail |
| --- | --- |
| One repo, four teams | We integrate by importing `libs/*` through TS path aliases. There is no separate consumer to serve. |
| Version pinning would slow us down | Every cross-team change would need a republish + version bump + consumer update instead of one merged migration/type change. |
| Auth friction | Installing GitHub Packages needs a personal access token with `read:packages`; every teammate and every CI job would need it. |
| The real contract is the database | The shared contract is the generated Supabase types, versioned together with the migrations in this repo. |

### When it *would* make sense to revisit

- If a module is deployed as its **own app** and consumed by another app in a
  different repository, publish `@kitafix/shared-types` (and only that one - it
  is the truly shared piece).
- If external tooling needs to consume a library.

How you would do it then (for reference, not implemented):

1. Turn the library into an Angular library build with `ng-packagr`.
2. Add `publishConfig.registry = "https://npm.pkg.github.com"` and a scope that
   matches the owner, e.g. `@rn22345/shared-types`.
3. Add a `publish.yml` workflow triggered on `release: [published]` that runs
   `npm publish` with `secrets.GITHUB_TOKEN` (`packages: write`).
4. Teammates add to `.npmrc`:
   `@rn22345:registry=https://npm.pkg.github.com` and authenticate with a PAT.

Until a real consumer exists, the path-alias + monorepo approach is simpler,
faster to integrate, and easier to grade.

## 5. Optional next step: a live demo (GitHub Pages)

A static demo link is a nicer "developer-friendly" win than packages. It is not
set up yet because the Angular router needs an SPA fallback (`404.html`) and a
`--base-href` for the Pages subpath. If the group wants it, add a
`deploy-pages.yml` workflow that builds with
`ng build --base-href /KitaFix_IonicPort/` and copies `index.html` to `404.html`.
Ask the maintainer before enabling it, since it publishes the app publicly.
