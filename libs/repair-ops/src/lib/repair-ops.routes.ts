import { Routes } from '@angular/router';

/**
 * Team 3 owns these routes (rule R7). No empty-path redirect here: Team 2's
 * BOOKING_ROUTES already redirects '' to 'dashboard'.
 */
export const REPAIR_OPS_ROUTES: Routes = [
  {
    path: 'admin-portal',
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
    loadComponent: () =>
      import('./pages/service-catalog/service-catalog.page').then((m) => m.ServiceCatalogPage),
  },
];
