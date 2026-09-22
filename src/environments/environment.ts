/**
 * ONE place for the Supabase URL and key (old build trap: the connection
 * string was copied into 7 files, 1 of them wrong).
 *
 * MODE 1 - offline demo (default):
 *   useMockData: true -> libs/booking uses the .ts placeholder data.
 *   npm start works with no internet and no Supabase.
 *
 * MODE 2 - real database:
 *   1. go through docs/Database_Setup.md once,
 *   2. put the local (or hosted) URL + anon key below,
 *   3. set useMockData to false and restart.
 */
export const environment = {
  production: false,
  useMockData: true,

  /** Example local Supabase: http://127.0.0.1:54321 */
  supabaseUrl: '',
  /** Local anon key comes from `npx supabase status`. Never put the service_role key here. */
  supabaseAnonKey: '',

  /** Branches shown in the booking form (availability is per location). */
  locations: ['Main Branch - Downtown', 'North Mall Branch'] as string[],

  /** The only hour slots the shop accepts. Keep in sync with docs/Booking_Rule.md. */
  slotTimes: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] as string[],

  currency: '\u20B1',
};
