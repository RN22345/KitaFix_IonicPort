import { Routes } from '@angular/router';
import { authGuard, homeRouteGuard } from './shared/session/auth.guard';

/**
 * Customer booking and staff operations use separate navigation shells.
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
    path: 'staff',
    loadComponent: () => import('./staff/staff-tabs.page').then((m) => m.StaffTabsPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'admin-portal' },
      {
        path: '',
        loadChildren: () => import('@kitafix/repair-ops').then((m) => m.REPAIR_OPS_ROUTES),
      },
    ],
  },
  {
    path: 'dev-login',
    loadComponent: () => import('./shared/session/dev-login.page').then((m) => m.DevLoginPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [homeRouteGuard],
    loadComponent: () =>
      import('./shared/session/landing-redirect.page').then((m) => m.LandingRedirectPage),
  },
  {
    path: '**',
    canActivate: [homeRouteGuard],
    loadComponent: () =>
      import('./shared/session/landing-redirect.page').then((m) => m.LandingRedirectPage),
  },
];
