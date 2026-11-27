import { Routes } from '@angular/router';
import { staffOnlyGuard } from './guards/staff-only.guard';

/** Team 3-owned routes; open the Admin Portal when entering the module root. */
export const REPAIR_OPS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin-portal' },
  {
    path: 'admin-portal',
    canActivate: [staffOnlyGuard],
    loadComponent: () =>
      import('./pages/admin-portal/admin-portal.page').then((m) => m.AdminPortalPage),
  },
  {
    path: 'repair-queue',
    loadComponent: () =>
      import('./pages/repair-queue/repair-queue.page').then((m) => m.RepairQueuePage),
  },
  {
    path: 'service-catalog',
    canActivate: [staffOnlyGuard],
    loadComponent: () =>
      import('./pages/service-catalog/service-catalog.page').then((m) => m.ServiceCatalogPage),
  },
];
