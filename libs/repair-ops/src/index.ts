/**
 * libs/repair-ops - PUBLIC API (Team 3 - Shop & Repair Operations)
 * Rule R6: other teams import this library only through this barrel file.
 *
 *   import { REPAIR_OPS_ROUTES, provideRepairOps } from '@kitafix/repair-ops';
 */

/* Domain models + pure rules */
export * from './lib/models/repair-ops.model';
export * from './lib/models/repair-ops-error';

/* Data access */
export * from './lib/data-access/config';
export * from './lib/data-access/repair-ops.repository';
export * from './lib/data-access/service-catalog.repository';

/* Services */
export * from './lib/services/repair-ops.service';
export * from './lib/services/service-catalog.service';

/* Routes + providers (host app wiring) */
export * from './lib/repair-ops.routes';
export * from './lib/repair-ops.providers';
