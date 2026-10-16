import { IssueFlagKey } from './repair.model';

/**
 * Everything the New Booking form sends to the database.
 * The repository turns this into a `repairs` INSERT.
 */
export interface BookingDraft {
  service_id: string;
  technician_id: string | null;
  device_brand: string;
  device_model: string;
  location: string;
  /** ISO date, e.g. "2026-09-22". */
  booking_date: string;
  /** "HH:MM" (24 hour). Normalized to "HH:MM:SS" before insert. */
  booking_time: string;
  /** Optional free-text detail from the customer (max 500 characters; empty is sent as null). */
  issue_description: string;
  /**
   * The six issue flags picked on the Details step (at least one; frozen names, rule R4).
   * They also drive the issue fees in the price estimate.
   */
  issues: IssueFlagKey[];
}