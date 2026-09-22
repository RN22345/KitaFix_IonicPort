import { TechnicianOption } from '../../models/catalog.model';

/**
 * .ts placeholder for Team 1's `technicians` table (read-only for Team 2).
 * In the real app the picker runs:
 *   select t.id, p.full_name, t.skills
 *   from technicians t join profiles p on p.id = t.profile_id
 *   where t.active is true;
 * See libs/booking/src/lib/data-access/gateways/technicians.gateway.ts.
 */
export const MOCK_TECHNICIANS: TechnicianOption[] = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    full_name: 'Marco Reyes',
    skills: ['screen', 'battery', 'software'],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    full_name: 'Dina Villanueva',
    skills: ['charging', 'water damage'],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000003',
    full_name: 'Kevin Lim',
    skills: ['camera', 'audio'],
  },
];
