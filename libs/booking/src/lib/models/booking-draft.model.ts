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
  /** Free-text "what is wrong?" from the customer (required in the form, max 500 characters). */
  issue_description: string;
  /**
   * Legacy issue flags. The redesigned form sends [] (a text description replaced the
   * checkboxes); kept because the repairs table still has the six flag columns.
   */
  issues: IssueFlagKey[];
}