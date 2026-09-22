import { BookingDraft } from '../../models/booking-draft.model';
import { Repair } from '../../models/repair.model';

/**
 * The only way the booking module reaches its database.
 *
 * Two implementations:
 *   MockRepairsRepository      - .ts placeholder data (default, offline)
 *   SupabaseRepairsRepository  - real Supabase queries (see the file)
 *
 * provideBooking() picks one based on config.useMockData.
 * See supabase/queries.sql for the equivalent raw SQL of every method.
 */
export abstract class RepairsRepository {
  /** select * from repairs where customer_id = :id order by created_at desc */
  abstract listByCustomer(customerId: string): Promise<Repair[]>;

  /** insert into repairs (...) values (...) returning * */
  abstract create(draft: BookingDraft, customerId: string): Promise<Repair>;

  /** update repairs set status = 'cancelled' where id = :id and customer_id = :id */
  abstract cancel(repairId: string, customerId: string): Promise<Repair>;

  /** update repairs set booking_date, booking_time where id = :id */
  abstract reschedule(
    repairId: string,
    customerId: string,
    bookingDate: string,
    bookingTime: string,
  ): Promise<Repair>;

  /** free slots = configured slots - select get_taken_slots(location, date) */
  abstract takenSlots(
    location: string,
    bookingDate: string,
    excludeRepairId?: string,
  ): Promise<string[]>;
}
