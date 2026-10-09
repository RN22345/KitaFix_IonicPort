import { PostgrestError } from '@supabase/supabase-js';
import { RepairOpsError } from '../models/repair-ops-error';

/**
 * Codes we expect:
 *   P0001  raise exception from our status trigger -> show its message as is
 *   42501  RLS blocked the change (not a staff user)
 *   23505  unique_violation (service name already exists)
 *   23514  check_violation (price below 0, blank name)
 *   PGRST116 no rows
 */
export function mapPostgrestError(error: PostgrestError): RepairOpsError {
  switch (error.code) {
    case 'P0001':
      return new RepairOpsError('INVALID_STATUS', error.message, { cause: error });
    case '42501':
      return new RepairOpsError('NOT_ALLOWED', 'Only shop staff can do this.', { cause: error });
    case '23505':
      return new RepairOpsError('INVALID_INPUT', 'A service with that name already exists.', {
        cause: error,
      });
    case '23514':
      return new RepairOpsError('INVALID_INPUT', 'Check the service name and price.', {
        cause: error,
      });
    case 'PGRST116':
      return new RepairOpsError('NOT_FOUND', 'That record was not found.', { cause: error });
    default:
      return new RepairOpsError('UNKNOWN', error.message || 'Unexpected database error.', {
        cause: error,
      });
  }
}
