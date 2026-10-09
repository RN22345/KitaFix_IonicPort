import { Provider } from '@angular/core';
import { REPAIR_OPS_CONFIG, RepairOpsConfig } from './data-access/config';
import {
  MockRepairOpsRepository,
  RepairOpsRepository,
  SupabaseRepairOpsRepository,
} from './data-access/repair-ops.repository';
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
      ]
    : [
        { provide: RepairOpsRepository, useClass: SupabaseRepairOpsRepository },
        { provide: ServiceCatalogRepository, useClass: SupabaseServiceCatalogRepository },
      ];
  return [{ provide: REPAIR_OPS_CONFIG, useValue: config }, ...data];
}
