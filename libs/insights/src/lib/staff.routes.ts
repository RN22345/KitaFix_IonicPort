import { Routes } from '@angular/router';

/** Admin pages of Team 4, mounted at /admin by one line in app.routes.ts. 2 tabs, 3 screens. */
export const INSIGHTS_STAFF_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/admin/staff-shell.page').then((m) => m.StaffShellPage),
    children: [
      { path: 'overview', loadComponent: () => import('./pages/admin/overview/overview.page').then((m) => m.OverviewPage) },
      { path: 'insights', loadComponent: () => import('./pages/admin/insights/insights.page').then((m) => m.InsightsPage) },
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
    ],
  },
];
