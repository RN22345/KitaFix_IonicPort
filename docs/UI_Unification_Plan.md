# UI unification plan (deferred: waiting on the artists)

The artists are consolidating one UI. Nothing here changes visuals yet. It records where each team's styling lives, so that when the unified design arrives the change is mostly "edit tokens in one file" rather than "rewrite every page".

## Where the styling is today

| Team | Styling approach | Theme-aware (dark/light) | Hard-coded colours |
|---|---|---|---|
| 2 Booking | `--kf-*` CSS custom properties in `src/global.scss`, `ThemeService` in `libs/theme` | yes (dark default) | few |
| 1 Accounts | SCSS variables (`$blue`, `$green`, `$ink`...) at the top of `libs/accounts/src/lib/styles/accounts.scss` (1.4k lines). Every page `@use`s the whole file. | no (light only) | ~67 hex values, 0 `--kf-*` |
| 3 Repair Ops | Mostly hard-coded hex in page scss and the `/ops` tab bar (white bar, `#0b5ed7` accent), a few `--kf-*` | no (light only) | ~37 hex values, 7 `--kf-*` |
| 4 Insights | Ionic variables (`--ion-color-primary`, `--ion-card-background`...) in `admin.shared.scss` / `leave-review.page.scss` | mostly | ~7 hex values |

Visible results today:
- A customer moves from dark booking screens to light-only account screens.
- Admins see three different bottom bars:
  - Team 4's `/admin` bar: Overview / Insights / Repairs / Accounts
  - Team 3's `/ops` bar: Overview / Portal / Queue / Services
  - Team 1's custom `.acc-tabbar`: Overview / Accounts / Roles / My Account
- The 19.7 kB `accounts.scss` is compiled into each of 7 page bundles, which is why the SCSS budget warnings appear.

## One source of truth: `--kf-*` tokens

Team 2's tokens are already the shared contract (`libs/theme/README.md`). When the artists deliver, put their palette, type and radius into the `:root` / dark blocks of `src/global.scss`, and make every team read only from those.

Steps, in order. Each step is small and can be its own PR.

1. **Bridge Team 1's SCSS vars to tokens.** At the top of `accounts.scss`, change for example `$blue: #0B5ED7` to `$blue: var(--kf-accent)`, and the same for green, ink, muted, border, danger and the role colours. Wherever the file uses `rgba($x, a)` or `color-mix`, switch to `color-mix(in srgb, $x a%, transparent)` or the `-soft` tokens, because Sass cannot do rgba() on a CSS var. After this, Team 1 pages follow dark/light automatically. Review this with Team 1, because their screens will change colour.
2. **Map Ionic vars once.** `src/global.scss` already sets `--ion-color-primary` from the brand blue. Also set `--ion-background-color`, `--ion-text-color`, `--ion-card-background` and `--ion-border-color` from `--kf-*` in both themes. Then Team 4 (and any Ionic component) follows without code changes. Replace Team 4's leftover hex values (`#f5a623` star, `#fff` banner text) with `--kf-warn` and `--kf-on-hero`. Do the same swap for Team 3's ~37 hex values and the `/ops` tab-bar colours in `src/app/ops/ops-tabs.page.ts`. Most of them are the same brand blue and slate greys that already exist as tokens.
3. **One admin shell.** Make a single `/admin` shell, owned by Team 1 per the plan, with one tab bar: Overview, Repairs, Services, Insights, Accounts. Roles and Me move under Accounts. Team 3's, Team 4's and Team 1's admin pages become children of it, and `/ops` stays only as the technician shell (Queue, Account). `.acc-tabbar` goes away. Decide Team 3's Admin Portal vs Team 4's Overview first, since they overlap. Do this after the artists draw the admin navigation.
4. **Shared primitives in `libs/theme`.** Move components that more than one team draws into `libs/theme`: card, primary/ghost button, status/role chip, star rating and page header. Each team swaps its local copy when it next touches that screen. Do not do a big-bang rewrite.
5. **Split `accounts.scss`.** Keep tokens and mixins in `_accounts-base.scss` and move page-only rules into each page's scss. This fixes the budget warnings.

## Rules for new work until the design lands

- Use `var(--kf-*)` for colours, shadows, radii and fonts. Do not add new hex values in team code.
- Use the shared names `kf-*` keyframes / `data-tone` (see `libs/theme/README.md`) for status tints.
- Keep layout and structure separate from colour, so a re-skin touches only tokens.
- The Figma draft is guidance, not spec (see CLAUDE.md). The artists' consolidated file will replace it.

## What to ask the artists for

The fastest hand-off is a token table, not screens:
- light and dark values for each of the `--kf-*` names above
- font, sizes and radius
- one admin navigation layout

Screens can follow afterwards.
