import { Routes } from '@angular/router';

/**
 * Team 2 owns these routes (rule R7). The app shell lazy-loads this file at
 * /tabs and never imports the pages directly.
 */
export const BOOKING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'new-booking',
    loadComponent: () =>
      import('./pages/new-booking/new-booking.page').then((m) => m.NewBookingPage),
  },
  {
    path: 'my-repairs',
    loadComponent: () => import('./pages/my-repairs/my-repairs.page').then((m) => m.MyRepairsPage),
  },
];
