import { Routes } from '@angular/router';
import { authGuard } from './shared/session/auth.guard';

/**
 * The app shell only declares lazy routes that point into each team's library
 * (rule R7). Team 2's screens live behind '@kitafix/booking' -> BOOKING_ROUTES.
 *
 * In the merged group app the tabs list grows with the other teams' routes
 * (identity, repair-ops, insights); Team 2 only owns the booking entries.
 */
export const routes: Routes = [
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: '',
        loadChildren: () => import('@kitafix/booking').then((m) => m.BOOKING_ROUTES),
      },
    ],
  },
  {
    path: 'dev-login',
    loadComponent: () => import('./shared/session/dev-login.page').then((m) => m.DevLoginPage),
  },
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs' },
];
