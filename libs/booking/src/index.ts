/**
 * =============================================================================
 * libs/booking - PUBLIC API (Team 2 - Booking & Scheduling)
 * =============================================================================
 * Rule R6: other teams import this library only through this barrel file.
 * Never deep-import like 'libs/booking/src/lib/internal/x'.
 *
 * Host app usage:
 *
 *   import { BOOKING_ROUTES, provideBooking } from '@kitafix/booking';
 *
 *   providers: [provideBooking({ useMockData: true, ... })]
 *   routes:    { path: 'tabs', children: BOOKING_ROUTES }
 */

/* Domain models */
export * from './lib/models/repair.model';
export * from './lib/models/catalog.model';
export * from './lib/models/booking-draft.model';
export * from './lib/models/booking-error';
export * from './lib/models/current-user.model';

/* Validation + pricing (pure functions) */
export * from './lib/validation/booking.validators';
export * from './lib/pricing/price-estimate';

/* Data access */
export * from './lib/data-access/config';
export * from './lib/data-access/supabase-client';
export * from './lib/data-access/postgrest-errors';
export * from './lib/data-access/repositories/repairs.repository';
export * from './lib/data-access/repositories/supabase-repairs.repository';
export * from './lib/data-access/repositories/mock-repairs.repository';
export * from './lib/data-access/gateways/technicians.gateway';
export * from './lib/data-access/gateways/services.gateway';
export * from './lib/data-access/session/current-user.service';

/* .ts placeholder data (dev only, see docs/Database_Setup.md) */
export * from './lib/data-access/mock/mock-data';

/* Services + screens wiring */
export * from './lib/services/repairs.service';
export * from './lib/services/repairs-realtime.service';

/* UI pieces that the staff app may reuse for status display */
export * from './lib/ui/status-badge/status-badge.component';
export * from './lib/ui/repair-card/repair-card.component';
export * from './lib/ui/reschedule-modal/reschedule-modal.component';

/* Routes + providers (host app wiring) */
export * from './lib/booking.routes';
export * from './lib/booking.providers';
