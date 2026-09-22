# Adding your module to the port (Teams 1, 3, 4)

This repo is the shared Ionic + Angular application. Team 2's booking module is
the reference implementation - copy its shape. Everything here follows the
Module Plan v4 rules (`docs/KitaFix_Module_Plan_v4.md`).

Target result per team:

```
libs/<module>/                 <- your code, nothing else imports it except via index.ts
supabase/migrations/NNNN_teamN_<name>.sql
docs/<your doc>.md
```

| Team | Module | Library | Migration |
| --- | --- | --- | --- |
| 1 | Identity & People | `libs/identity` | `0010_team1_identity.sql` |
| 3 | Shop & Repair Operations | `libs/repair-ops` | `0030_team3_repair_ops.sql` |
| 4 | Feedback & Insights | `libs/insights` | `0040_team4_insights.sql` |

## 1. Create the library

Copy the folder shape of `libs/booking`:

```
libs/identity/
  README.md                     screens / tables / exported functions
  src/
    index.ts                    the ONLY public entry (barrel file)
    lib/
      models/
      data-access/              repositories + gateways (real + mock)
      pages/
      services/
      <module>.routes.ts        export const IDENTITY_ROUTES: Routes
      <module>.providers.ts     export function provideIdentity(): Provider[]
```

Rules you must keep:

- Everything public is exported from `src/index.ts` (rule R6).
- Never import another team's internals; only `@kitafix/shared-types` and the
  other team's barrel are allowed.

## 2. Register the path alias

`tsconfig.json`:

```jsonc
"paths": {
  "@kitafix/shared-types": ["libs/shared-types/src/index.ts"],
  "@kitafix/booking":      ["libs/booking/src/index.ts"],
  "@kitafix/identity":     ["libs/identity/src/index.ts"]   // <- yours
}
```

## 3. Export routes and providers (your barrel)

```ts
// libs/identity/src/index.ts
export * from './lib/identity.routes';
export * from './lib/identity.providers';
export * from './lib/models/...';
```

```ts
// libs/identity/src/lib/identity.routes.ts
import { Routes } from '@angular/router';

export const IDENTITY_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
];
```

Use **unique top-level paths** for your tabs (e.g. `login`, `profile`,
`staff-accounts`). The booking module already uses `dashboard`, `new-booking`,
`my-repairs`.

## 4. Wire it into the app shell (two files)

`src/app/app.routes.ts` - add one pathless lazy route per module:

```ts
children: [
  { path: '', loadChildren: () => import('@kitafix/booking').then((m) => m.BOOKING_ROUTES) },
  { path: '', loadChildren: () => import('@kitafix/identity').then((m) => m.IDENTITY_ROUTES) }, // <- yours
],
```

`src/app/app.config.ts` - add your providers:

```ts
import { provideIdentity } from '@kitafix/identity';

providers: [
  // ...existing...
  provideBooking({ /* ... */ }),
  provideIdentity({
    useMockData: environment.useMockData,
    supabaseUrl: environment.supabaseUrl,
    supabaseAnonKey: environment.supabaseAnonKey,
  }),
],
```

`src/app/tabs/tabs.page.ts` - add your tab buttons (only for customer-facing
screens; the staff app will have its own shell later):

```html
<ion-tab-button tab="profile" href="/tabs/profile">
  <ion-icon name="person-outline"></ion-icon>
  <ion-label>Profile</ion-label>
</ion-tab-button>
```

Remember to register any new icon in `src/app/icons.ts` (offline requirement).

## 5. Database: one numbered migration

```
supabase/migrations/0010_team1_identity.sql
```

- `create table if not exists ...` then `alter table ... add column if not exists`.
- **RLS in the same file** for every table you create (rule R3).
- Add ownership notes with `comment on table/column`.
- Do not edit a merged migration. Add a new one.

Apply it to the hosted project (no DB password needed):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...        # PowerShell: $env:SUPABASE_ACCESS_TOKEN='sbp_...'
node tools/supabase/apply-sql.mjs <project-ref> supabase/migrations/0010_team1_identity.sql
```

Then regenerate the shared contract:

```bash
node tools/supabase/gen-types.mjs <project-ref> libs/shared-types/src/lib/database.generated.ts
```

`libs/shared-types/src/lib/database.types.ts` builds readable aliases on top and
does not need editing.

## 6. Reading other modules

| Need | How |
| --- | --- |
| Another team's data | Query the table (RLS must allow read) or call their function |
| Shared helpers | `is_staff()`, `my_role()`, `current_user_no()` (call only, rule R5) |
| Display-only components | Import from the other team's **barrel** (e.g. `RepairCardComponent`) |
| Status values | The `repair_status` enum only (rule R8) |

Never import another team's page or internal file (rules R6, R9).

## 7. Checklist before you open the PR

- [ ] `libs/<module>` created with `src/index.ts` barrel and README.
- [ ] `tsconfig.json` path alias added.
- [ ] Routes exported and registered in `app.routes.ts`; providers in `app.config.ts`.
- [ ] Tab buttons added if there are customer screens; new icons registered.
- [ ] Migration `NNNN_teamN_*.sql` with RLS + ownership comments, applied and types regenerated.
- [ ] Mock `.ts` data so the module runs offline.
- [ ] Manual test plan written (including failed cases).
- [ ] `npm run build` passes.
- [ ] PR opened with the template; CI green.

If your module needs a different app shell (like the staff Angular Material
app), don't duplicate everything - add a second project under `apps/` and open an
issue so the group can agree on the shared parts first.
