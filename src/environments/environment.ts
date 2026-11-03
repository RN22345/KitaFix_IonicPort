/**
 * ONE place for the Supabase URL and key (old build trap: the connection
 * string was copied into 7 files, 1 of them wrong).
 *
 * MODE 1 - offline demo (no internet):
 *   useMockData: true -> libs/booking uses the .ts placeholder data.
 *   npm start works anywhere, no Supabase needed.
 *
 * MODE 2 - real database (default, points at the shared hosted project):
 *   useMockData: false -> Supabase Auth + Postgres.
 *   Offline demo tip: flip it back to true (and reload) for the no-internet run.
 */
export const environment = {
  production: false,

  useMockData: false,

  /** Shared hosted project (ap-south-1). */
  supabaseUrl: 'https://pkfataaehrjdipdbrthz.supabase.co',
  /** anon key: safe to ship in a client app, protected by RLS. Never the service_role key. */
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZmF0YWFlaHJqZGlwZGJydGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzcyMTUsImV4cCI6MjEwNTYxMzIxNX0.dY9AOv1ZA3TQz-MY_M_Wj1COEQ7aDkjLWTWAdznOAKY',

  /** Branches shown in the booking form (availability is per location). */
  locations: ['Main Branch - Downtown', 'North Mall Branch'] as string[],

  /** The only hour slots the shop accepts. Keep in sync with docs/Booking_Rule.md. */
  slotTimes: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] as string[],

  currency: '\u20B1',
};
