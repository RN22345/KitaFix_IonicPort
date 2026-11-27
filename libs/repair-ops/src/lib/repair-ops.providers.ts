import { Provider } from '@angular/core';
import { REPAIR_OPS_CONFIG, RepairOpsConfig } from './data-access/config';
import {
  MockRepairOpsRepository,
  RepairOpsRepository,
  SupabaseRepairOpsRepository,
} from './data-access/repair-ops.repository';
import {
  MockRepairOpsSession,
  RepairOpsSession,
  SupabaseRepairOpsSession,
} from './data-access/session/repair-ops-session';
import {
  MockServiceCatalogRepository,
  ServiceCatalogRepository,
  SupabaseServiceCatalogRepository,
} from './data-access/service-catalog.repository';

/**
 * Registers the repair-ops module with the host app.
 * NOTE: the technician picker reuses TechniciansGateway from provideBooking(...),
 * so provideBooking must also be in app.config.ts.
 */
export function provideRepairOps(config: RepairOpsConfig): Provider[] {
  const data: Provider[] = config.useMockData
    ? [
        { provide: RepairOpsRepository, useClass: MockRepairOpsRepository },
        { provide: ServiceCatalogRepository, useClass: MockServiceCatalogRepository },
        { provide: RepairOpsSession, useClass: MockRepairOpsSession },
      ]
    : [
        { provide: RepairOpsRepository, useClass: SupabaseRepairOpsRepository },
        { provide: ServiceCatalogRepository, useClass: SupabaseServiceCatalogRepository },
        { provide: RepairOpsSession, useClass: SupabaseRepairOpsSession },
      ];
  return [{ provide: REPAIR_OPS_CONFIG, useValue: config }, ...data];
}
