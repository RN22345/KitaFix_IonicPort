import { Routes } from '@angular/router';
import { authGuard } from './shared/session/auth.guard';

/**
 * This local shell loads repair-ops only. The booking library remains available
 * for shared data access and UI helpers used by Team 3.
 */
export const routes: Routes = [
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then((m) => m.TabsPage),
    children: [
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
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs' },
];
