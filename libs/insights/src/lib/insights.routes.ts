import { Routes } from '@angular/router';

/** Team 4 routes. The app shell mounts them under /tabs (one line in app.routes.ts). */
export const INSIGHTS_ROUTES: Routes = [
  {
    path: 'leave-review/:repairId',
    loadComponent: () =>
      import('./pages/leave-review/leave-review.page').then((m) => m.LeaveReviewPage),
  },
];
