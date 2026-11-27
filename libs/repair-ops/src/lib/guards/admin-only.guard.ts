import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RepairOpsService } from '../services/repair-ops.service';

/**
 * Admin Portal and Service Catalog are for admins (FSD role SA).
 * A technician (TECH) is sent to the Repair Queue, where they see their own
 * jobs, notes, history and service log. The database enforces the same rules.
 */
export const adminOnlyGuard: CanActivateFn = async () => {
  // inject() must run before the first await (Angular injection context).
  const ops = inject(RepairOpsService);
  const router = inject(Router);

  const actor = await ops.loadActor();
  if (actor?.role === 'technician') {
    return router.createUrlTree(['/ops/repair-queue']);
  }
  return true;
};
