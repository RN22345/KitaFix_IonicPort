import { Inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database, RepairInsert } from '@kitafix/shared-types';
import { BookingDraft } from '../../models/booking-draft.model';
import { Repair, normalizeTime } from '../../models/repair.model';
import { BOOKING_CONFIG, BookingConfig } from '../config';
import { mapPostgrestError } from '../postgrest-errors';
import { getSupabaseClient } from '../supabase-client';
import { RepairsRepository } from './repairs.repository';

/**
 * REAL database access (Supabase PostgREST). Every method here is one of the
 * queries documented in supabase/queries.sql.
 *
 * The database enforces the rules, not this class:
 *   - repairs_no_double_booking    -> throws SQLSTATE 23P01 -> SLOT_TAKEN
 *   - repairs_guard_customer_update -> throws SQLSTATE 42501 -> NOT_ALLOWED
 *   - repairs_*_check constraints   -> throws SQLSTATE 23514 -> INVALID_INPUT
 */
@Injectable()
export class SupabaseRepairsRepository extends RepairsRepository {
  private readonly db: SupabaseClient<Database>;

  constructor(@Inject(BOOKING_CONFIG) config: BookingConfig) {
    super();
    this.db = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async listByCustomer(customerId: string): Promise<Repair[]> {
    const { data, error } = await this.db
      .from('repairs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapPostgrestError(error);
    }
    return data ?? [];
  }

  async create(draft: BookingDraft, customerId: string): Promise<Repair> {
    const payload: RepairInsert = {
      customer_id: customerId,
      service_id: draft.service_id,
      technician_id: draft.technician_id,
      device_brand: draft.device_brand.trim(),
      device_model: draft.device_model.trim(),
      location: draft.location,
      booking_date: draft.booking_date,
      booking_time: normalizeTime(draft.booking_time),
      issue_screen: draft.issues.includes('issue_screen'),
      issue_battery: draft.issues.includes('issue_battery'),
      issue_charging: draft.issues.includes('issue_charging'),
      issue_camera: draft.issues.includes('issue_camera'),
      issue_audio: draft.issues.includes('issue_audio'),
      issue_software: draft.issues.includes('issue_software'),
    };

    const { data, error } = await this.db.from('repairs').insert(payload).select('*').single();
    if (error) {
      throw mapPostgrestError(error);
    }
    return data;
  }

  async cancel(repairId: string, customerId: string): Promise<Repair> {
    const { data, error } = await this.db
      .from('repairs')
      .update({ status: 'cancelled' })
      .eq('id', repairId)
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (error) {
      throw mapPostgrestError(error);
    }
    return data;
  }

  async reschedule(
    repairId: string,
    customerId: string,
    bookingDate: string,
    bookingTime: string,
  ): Promise<Repair> {
    const { data, error } = await this.db
      .from('repairs')
      .update({ booking_date: bookingDate, booking_time: normalizeTime(bookingTime) })
      .eq('id', repairId)
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (error) {
      throw mapPostgrestError(error);
    }
    return data;
  }

  async takenSlots(
    location: string,
    bookingDate: string,
    excludeRepairId?: string,
  ): Promise<string[]> {
    const { data, error } = await this.db.rpc('get_taken_slots', {
      p_location: location,
      p_date: bookingDate,
      p_exclude_repair: excludeRepairId ?? null,
    });

    if (error) {
      throw mapPostgrestError(error);
    }
    return (data ?? []).map((row) => normalizeTime(row.booking_time));
  }
}
