import { BookingError } from '../../models/booking-error';
import { BookingDraft } from '../../models/booking-draft.model';
import { Repair, normalizeTime, timeToMinutes } from '../../models/repair.model';
import { MOCK_REPAIRS } from './mock-repairs.data';

function cloneRepair(repair: Repair): Repair {
  return { ...repair };
}

/**
 * In-memory stand-in for the `repairs` table.
 *
 * It copies the important DATABASE rules so the module behaves the same with
 * and without Supabase:
 *   - two bookings at the same location within the same hour are rejected
 *     (mirrors the repairs_no_double_booking exclusion constraint),
 *   - a customer can only cancel when the status is pending / in_progress,
 *   - a customer can only reschedule a pending booking
 *     (mirrors repairs_guard_customer_update()).
 *
 * Data lives only in memory: refreshing the browser resets it. That is fine for
 * offline demos - the real database is the next step (see docs/Database_Setup.md).
 */
class MockRepairsDb {
  private readonly rows: Repair[] = MOCK_REPAIRS.map(cloneRepair);

  private now(): string {
    return new Date().toISOString();
  }

  private overlaps(a: string, b: string): boolean {
    return Math.abs(timeToMinutes(a) - timeToMinutes(b)) < 60;
  }

  private isTaken(location: string, date: string, time: string, excludeRepairId?: string): boolean {
    return this.rows.some(
      (row) =>
        row.location === location &&
        row.booking_date === date &&
        row.status !== 'cancelled' &&
        row.id !== excludeRepairId &&
        this.overlaps(normalizeTime(row.booking_time), normalizeTime(time)),
    );
  }

  private findOwned(repairId: string, customerId: string): Repair {
    const row = this.rows.find((item) => item.id === repairId && item.customer_id === customerId);
    if (!row) {
      throw new BookingError('NOT_FOUND', 'Booking not found. It may have been removed already.');
    }
    return row;
  }

  selectByCustomer(customerId: string): Repair[] {
    return this.rows
      .filter((row) => row.customer_id === customerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(cloneRepair);
  }

  insert(draft: BookingDraft, customerId: string): Repair {
    if (this.isTaken(draft.location, draft.booking_date, draft.booking_time)) {
      throw new BookingError(
        'SLOT_TAKEN',
        'That time is already booked at this location. Please pick another slot.',
      );
    }

    const timestamp = this.now();
    const row: Repair = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      service_id: draft.service_id,
      device_brand: draft.device_brand.trim(),
      device_model: draft.device_model.trim(),
      location: draft.location,
      booking_date: draft.booking_date,
      booking_time: `${normalizeTime(draft.booking_time)}:00`,
      issue_screen: draft.issues.includes('issue_screen'),
      issue_battery: draft.issues.includes('issue_battery'),
      issue_charging: draft.issues.includes('issue_charging'),
      issue_camera: draft.issues.includes('issue_camera'),
      issue_audio: draft.issues.includes('issue_audio'),
      issue_software: draft.issues.includes('issue_software'),
      technician_id: draft.technician_id,
      status: 'pending',
      staff_notes: null,
      confirmed_by: null,
      confirmed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.rows.push(row);
    return cloneRepair(row);
  }

  cancel(repairId: string, customerId: string): Repair {
    const row = this.findOwned(repairId, customerId);
    if (!(row.status === 'pending' || row.status === 'in_progress')) {
      throw new BookingError(
        'NOT_ALLOWED',
        'This repair can no longer be cancelled because the work is already finished.',
      );
    }
    row.status = 'cancelled';
    row.updated_at = this.now();
    return cloneRepair(row);
  }

  reschedule(repairId: string, customerId: string, bookingDate: string, bookingTime: string): Repair {
    const row = this.findOwned(repairId, customerId);
    if (row.status !== 'pending') {
      throw new BookingError('NOT_ALLOWED', 'Only a pending booking can be rescheduled.');
    }
    if (this.isTaken(row.location, bookingDate, bookingTime, row.id)) {
      throw new BookingError(
        'SLOT_TAKEN',
        'That time is already booked at this location. Please pick another slot.',
      );
    }
    row.booking_date = bookingDate;
    row.booking_time = `${normalizeTime(bookingTime)}:00`;
    row.updated_at = this.now();
    return cloneRepair(row);
  }

  takenSlots(location: string, bookingDate: string, excludeRepairId?: string): string[] {
    return this.rows
      .filter(
        (row) =>
          row.location === location &&
          row.booking_date === bookingDate &&
          row.status !== 'cancelled' &&
          row.id !== excludeRepairId,
      )
      .map((row) => normalizeTime(row.booking_time))
      .sort();
  }
}

export const mockRepairsDb = new MockRepairsDb();
