import { ServiceOption } from '../../models/catalog.model';

/**
 * .ts placeholder for Team 3's `services` table (read-only for Team 2).
 * In the real app the picker runs:
 *   select id, name, description, base_price from services where active is true;
 * See libs/booking/src/lib/data-access/gateways/services.gateway.ts.
 */
export const MOCK_SERVICES: ServiceOption[] = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    name: 'Screen Replacement',
    description: 'Full display and digitizer replacement.',
    base_price: 1499,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000002',
    name: 'Battery Replacement',
    description: 'Genuine capacity battery swap.',
    base_price: 899,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000003',
    name: 'Charging Port Repair',
    description: 'Port cleaning or replacement.',
    base_price: 650,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000004',
    name: 'Water Damage Check',
    description: 'Full board inspection and cleaning.',
    base_price: 1200,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000005',
    name: 'Software Reset',
    description: 'OS reinstall / factory reset with backup.',
    base_price: 500,
  },
];
