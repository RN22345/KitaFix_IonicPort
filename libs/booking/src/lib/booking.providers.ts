import { Provider } from '@angular/core';
import { BOOKING_CONFIG, BookingConfig } from './data-access/config';
import { ServicesGateway, MockServicesGateway, SupabaseServicesGateway } from './data-access/gateways/services.gateway';
import {
  TechniciansGateway,
  MockTechniciansGateway,
  SupabaseTechniciansGateway,
} from './data-access/gateways/technicians.gateway';
import { MockRepairsRepository } from './data-access/repositories/mock-repairs.repository';
import { RepairsRepository } from './data-access/repositories/repairs.repository';
import { SupabaseRepairsRepository } from './data-access/repositories/supabase-repairs.repository';
import {
  CurrentUserService,
  MockCurrentUserService,
  SupabaseCurrentUserService,
} from './data-access/session/current-user.service';

/**
 * Registers the booking module with the host app.
 *
 * Mock mode (offline demo, week 1-3 of the plan):
 *   provideBooking({ useMockData: true, ... })
 *
 * Real database:
 *   provideBooking({ useMockData: false, supabaseUrl, supabaseAnonKey, ... })
 *
 * The screens are identical in both cases.
 */
export function provideBooking(config: BookingConfig): Provider[] {
  const dataAccess: Provider[] = config.useMockData
    ? [
        { provide: RepairsRepository, useClass: MockRepairsRepository },
        { provide: TechniciansGateway, useClass: MockTechniciansGateway },
        { provide: ServicesGateway, useClass: MockServicesGateway },
        { provide: CurrentUserService, useClass: MockCurrentUserService },
      ]
    : [
        { provide: RepairsRepository, useClass: SupabaseRepairsRepository },
        { provide: TechniciansGateway, useClass: SupabaseTechniciansGateway },
        { provide: ServicesGateway, useClass: SupabaseServicesGateway },
        { provide: CurrentUserService, useClass: SupabaseCurrentUserService },
      ];

  return [{ provide: BOOKING_CONFIG, useValue: config }, ...dataAccess];
}
