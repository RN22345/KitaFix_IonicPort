import { Injectable } from '@angular/core';
import { BookingDraft } from '../../models/booking-draft.model';
import { Repair } from '../../models/repair.model';
import { mockRepairsDb } from '../mock/mock-db';
import { RepairsRepository } from './repairs.repository';

const NETWORK_DELAY_MS = 250;

function delay(ms: number = NETWORK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Placeholder implementation: same methods, same errors, same rules as the
 * Supabase repository - but backed by the .ts data in ../mock/.
 * Screens and tests cannot tell the difference (except that data resets on
 * refresh and no network is needed).
 */
@Injectable()
export class MockRepairsRepository extends RepairsRepository {
  async listByCustomer(customerId: string): Promise<Repair[]> {
    await delay(200);
    return mockRepairsDb.selectByCustomer(customerId);
  }

  async create(draft: BookingDraft, customerId: string): Promise<Repair> {
    await delay(300);
    return mockRepairsDb.insert(draft, customerId);
  }

  async cancel(repairId: string, customerId: string): Promise<Repair> {
    await delay(200);
    return mockRepairsDb.cancel(repairId, customerId);
  }

  async reschedule(
    repairId: string,
    customerId: string,
    bookingDate: string,
    bookingTime: string,
  ): Promise<Repair> {
    await delay(200);
    return mockRepairsDb.reschedule(repairId, customerId, bookingDate, bookingTime);
  }

  async takenSlots(
    location: string,
    bookingDate: string,
    excludeRepairId?: string,
  ): Promise<string[]> {
    await delay(150);
    return mockRepairsDb.takenSlots(location, bookingDate, excludeRepairId);
  }
}
