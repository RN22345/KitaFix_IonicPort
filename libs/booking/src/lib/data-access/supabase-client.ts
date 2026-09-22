import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@kitafix/shared-types';
import { BookingError } from '../models/booking-error';

let cachedClient: SupabaseClient<Database> | null = null;
let cachedUrl = '';

/**
 * One client for the whole app (Module Plan v4, trap #4: the connection string
 * lived in 7 files in the old build). Team 1 replaces this with the real
 * session-aware client later if needed - the interface stays the same.
 */
export function getSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new BookingError(
      'CONFIG',
      'Supabase is not configured. Set supabaseUrl and supabaseAnonKey in src/environments/environment.ts and set useMockData to false.',
    );
  }
  if (!cachedClient || cachedUrl !== url) {
    cachedClient = createClient<Database>(url, anonKey);
    cachedUrl = url;
  }
  return cachedClient;
}

export function resetSupabaseClient(): void {
  cachedClient = null;
  cachedUrl = '';
}
