import { InjectionToken } from '@angular/core';

/**
 * Everything the booking library needs from the host app.
 * The app passes the values from src/environments/environment.ts when it calls
 * provideBooking(...). This keeps the library free of app imports (rule R6).
 */
export interface BookingConfig {
  /** true  -> libs/booking uses the in-memory .ts placeholder data (no internet)
   *  false -> libs/booking talks to the real Supabase database            */
  useMockData: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Shop branches shown in the booking form (availability is per location). */
  locations: readonly string[];
  /** The only hour slots the shop accepts. Availability = these minus taken. */
  slotTimes: readonly string[];
  /** Currency symbol used by the price estimate. */
  currency: string;
}

export const BOOKING_CONFIG = new InjectionToken<BookingConfig>('BOOKING_CONFIG');
