/**
 * Dev-only entry point for all .ts placeholder data.
 * Exported from the barrel so demos and tests can import it in one line:
 *
 *   import { MOCK_REPAIRS, MOCK_SERVICES } from '@kitafix/booking';
 *
 * Replace these with the real database by setting useMockData = false in
 * src/environments/environment.ts. Nothing else changes.
 */
export * from './mock-profile.data';
export * from './mock-technicians.data';
export * from './mock-services.data';
export * from './mock-repairs.data';
export * from './mock-db';
