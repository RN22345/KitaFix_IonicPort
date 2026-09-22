import { PostgrestError } from '@supabase/supabase-js';
import { BookingError } from '../models/booking-error';

const SLOT_TAKEN_MESSAGE =
  'That time is already booked at this location. Please pick another slot.';

/**
 * Postgres / PostgREST error codes we expect:
 *   23P01 exclusion_violation      -> the double-booking constraint fired
 *   23505 unique_violation         -> safety net, same idea
 *   23503 foreign_key_violation    -> service/technician/profile disappeared
 *   23514 check_violation          -> brand/model/issue/date rule failed server side
 *   42501 insufficient_privilege   -> RLS or our update guard blocked the change
 *   PGRST116 no rows (single())    -> row not found (or hidden by RLS)
 */
export function mapPostgrestError(error: PostgrestError): BookingError {
  switch (error.code) {
    case '23P01':
    case '23505':
      return new BookingError('SLOT_TAKEN', SLOT_TAKEN_MESSAGE, { cause: error });
    case '23503':
      return new BookingError(
        'INVALID_INPUT',
        'The selected service or technician is no longer available. Please select again.',
        { cause: error },
      );
    case '23514':
      return new BookingError(
        'INVALID_INPUT',
        'The booking did not pass the validation rules. Check the device, date, and at least one issue.',
        { cause: error },
      );
    case '42501':
      return new BookingError(
        'NOT_ALLOWED',
        'You are not allowed to change this booking anymore.',
        { cause: error },
      );
    case 'PGRST116':
      return new BookingError(
        'NOT_FOUND',
        'Booking not found. It may have been removed already.',
        { cause: error },
      );
    default:
      return new BookingError('UNKNOWN', `Database error: ${error.message}`, { cause: error });
  }
}
