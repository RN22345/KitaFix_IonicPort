import { Injectable, inject } from '@angular/core';
import { getSupabaseClient } from '@kitafix/booking';
import { RepairRow, RepairStatus } from '@kitafix/shared-types';
import { RepairOpsError } from '../models/repair-ops-error';
import {
  QueueRepair,
  REMARKS_MAX_LENGTH,
  RepairOpsHistory,
  ServiceLog,
  ServiceLogInput,
  isConfirmed,
  serviceLogBlockedReason,
  serviceLogInputProblem,
  statusChangeProblem,
} from '../models/repair-ops.model';
import { REPAIR_OPS_CONFIG } from './config';
import {
  MOCK_QUEUE,
  MOCK_SERVICE_LOGS,
  MOCK_TECHNICIAN_ID,
  MOCK_TECHNICIAN_NAMES,
} from './mock/mock-repair-ops.data';
import { mapPostgrestError } from './postgrest-errors';

/**
 * Everything the Repair Queue reads and writes on the `repairs` table
 * (workflow columns only: status, technician_id, confirmed_by, confirmed_at),
 * plus the operational history and the technician service history log.
 * Booking columns belong to Team 2 - we never change them.
 */
export abstract class RepairOpsRepository {
  abstract listQueue(): Promise<QueueRepair[]>;
  abstract confirm(repairId: string): Promise<QueueRepair>;
  abstract updateStatus(repairId: string, to: RepairStatus, remarks?: string | null): Promise<QueueRepair>;
  abstract assignTechnician(repairId: string, technicianId: string, technicianName: string): Promise<QueueRepair>;
  abstract addNote(repairId: string, note: string): Promise<RepairOpsHistory>;
  abstract listHistory(repairId: string): Promise<RepairOpsHistory[]>;
  abstract listServiceLogs(repairId: string): Promise<ServiceLog[]>;
  abstract addServiceLog(input: ServiceLogInput): Promise<ServiceLog>;
  abstract reschedule(repair: QueueRepair, bookingDate: string, bookingTime: string): Promise<QueueRepair>;
  abstract takenSlots(location: string, bookingDate: string, excludeRepairId: string): Promise<string[]>;
}

/* ------------------------------ MOCK (offline) ------------------------------ */

@Injectable()
export class MockRepairOpsRepository extends RepairOpsRepository {
  private readonly config = inject(REPAIR_OPS_CONFIG);
  private readonly isTechnician = this.config.mockRole === 'technician';
  private rows: QueueRepair[] = MOCK_QUEUE.map((row) => ({
    ...row,
    service_name_snapshot: row.service_name,
    service_price_snapshot: null,
    service_price: null,
  }));
  private history: RepairOpsHistory[] = [];
  private serviceLogs: ServiceLog[] = MOCK_SERVICE_LOGS.map((log) => ({ ...log }));

  private get actorName(): string {
    return this.isTechnician ? MOCK_TECHNICIAN_NAMES[MOCK_TECHNICIAN_ID] : 'Mock Admin';
  }

  private technicianName(id: string | null): string | null {
    if (!id) return null;
    return (
      this.rows.find((row) => row.technician_id === id)?.technician_name ??
      MOCK_TECHNICIAN_NAMES[id] ??
      null
    );
  }

  /** Offline stand-in for the database rules: admin only, except technician notes/logs. */
  private requireAdmin(): void {
    if (this.isTechnician) {
      throw new RepairOpsError('NOT_ALLOWED', 'Only an admin can do this.');
    }
  }

  private requireVisible(row: QueueRepair): void {
    if (this.isTechnician && row.technician_id !== MOCK_TECHNICIAN_ID) {
      throw new RepairOpsError('NOT_ALLOWED', 'You can only work on repairs assigned to you.');
    }
  }

  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  private find(id: string): QueueRepair {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new RepairOpsError('NOT_FOUND', 'That repair was not found.');
    return row;
  }

  private save(updated: QueueRepair): QueueRepair {
    updated.updated_at = new Date().toISOString();
    this.rows = this.rows.map((r) => (r.id === updated.id ? updated : r));
    return { ...updated };
  }

  private record(
    repairId: string,
    event: Partial<RepairOpsHistory> & Pick<RepairOpsHistory, 'event_type'>,
  ): RepairOpsHistory {
    const row: RepairOpsHistory = {
      id: crypto.randomUUID(),
      repair_id: repairId,
      event_type: event.event_type,
      previous_status: event.previous_status ?? null,
      new_status: event.new_status ?? null,
      previous_technician_id: event.previous_technician_id ?? null,
      new_technician_id: event.new_technician_id ?? null,
      previous_technician_name: this.technicianName(event.previous_technician_id ?? null),
      new_technician_name: event.new_technician_name ?? this.technicianName(event.new_technician_id ?? null),
      previous_booking_date: event.previous_booking_date ?? null,
      previous_booking_time: event.previous_booking_time ?? null,
      new_booking_date: event.new_booking_date ?? null,
      new_booking_time: event.new_booking_time ?? null,
      note: event.note ?? null,
      remarks: event.remarks ?? null,
      changed_by: this.isTechnician ? 'mock-tech' : 'mock-admin',
      changed_at: new Date().toISOString(),
      actor_name: this.actorName,
    };
    this.history.unshift(row);
    return row;
  }

  async listQueue(): Promise<QueueRepair[]> {
    await this.delay();
    return this.rows
      .filter((row) => !this.isTechnician || row.technician_id === MOCK_TECHNICIAN_ID)
      .map((row) => ({ ...row }));
  }

  async confirm(repairId: string): Promise<QueueRepair> {
    await this.delay();
    this.requireAdmin();
    const row = this.find(repairId);
    if (isConfirmed(row)) throw new RepairOpsError('INVALID_STATUS', 'This booking is already confirmed.');
    if (row.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending booking can be confirmed.');
    }
    return this.save({ ...row, confirmed_by: 'mock-admin', confirmed_at: new Date().toISOString() });
  }

  async updateStatus(repairId: string, to: RepairStatus, remarks?: string | null): Promise<QueueRepair> {
    await this.delay();
    this.requireAdmin();
    const row = this.find(repairId);
    const problem = statusChangeProblem(row, to);
    if (problem) throw new RepairOpsError('INVALID_STATUS', problem);
    const cleanRemarks = remarks?.trim() || null;
    if (cleanRemarks && cleanRemarks.length > REMARKS_MAX_LENGTH) {
      throw new RepairOpsError('INVALID_INPUT', 'Remarks must be 1,000 characters or fewer.');
    }
    const updated = this.save({
      ...row,
      status: to,
      repair_started_at: to === 'in_progress' ? row.repair_started_at ?? new Date().toISOString() : row.repair_started_at,
    });
    this.record(repairId, {
      event_type: 'status',
      previous_status: row.status,
      new_status: to,
      remarks: cleanRemarks,
    });
    return updated;
  }

  async assignTechnician(repairId: string, technicianId: string, technicianName: string): Promise<QueueRepair> {
    await this.delay();
    this.requireAdmin();
    const row = this.find(repairId);
    if (row.status === 'completed' || row.status === 'cancelled') {
      throw new RepairOpsError('INVALID_STATUS', 'A finished repair cannot be reassigned.');
    }
    if (row.technician_id !== technicianId) {
      this.record(repairId, {
        event_type: 'technician',
        previous_technician_id: row.technician_id,
        new_technician_id: technicianId,
        new_technician_name: technicianName,
      });
    }
    return this.save({ ...row, technician_id: technicianId, technician_name: technicianName });
  }

  async addNote(repairId: string, note: string): Promise<RepairOpsHistory> {
    await this.delay();
    const row = this.find(repairId);
    this.requireVisible(row);
    this.save({
      ...row,
      staff_notes: [row.staff_notes?.trim(), note].filter((value) => Boolean(value)).join('\n\n'),
    });
    return this.record(repairId, { event_type: 'note', note });
  }

  async listHistory(repairId: string): Promise<RepairOpsHistory[]> {
    await this.delay();
    this.requireVisible(this.find(repairId));
    return this.history.filter((item) => item.repair_id === repairId).map((item) => ({ ...item }));
  }

  async listServiceLogs(repairId: string): Promise<ServiceLog[]> {
    await this.delay();
    this.requireVisible(this.find(repairId));
    return this.serviceLogs
      .filter((log) => log.repair_id === repairId)
      .sort((a, b) => b.performed_at.localeCompare(a.performed_at))
      .map((log) => ({ ...log }));
  }

  async addServiceLog(input: ServiceLogInput): Promise<ServiceLog> {
    await this.delay();
    const row = this.find(input.repair_id);
    this.requireVisible(row);
    const blocked = serviceLogBlockedReason(row);
    if (blocked) throw new RepairOpsError('INVALID_STATUS', blocked);
    if (row.technician_id !== input.technician_id) {
      throw new RepairOpsError('NOT_ALLOWED', 'Service actions are logged for the assigned technician.');
    }
    const problem = serviceLogInputProblem(input);
    if (problem) throw new RepairOpsError('INVALID_INPUT', problem);
    if (new Date(input.performed_at).getTime() < new Date(row.created_at).getTime()) {
      throw new RepairOpsError('INVALID_INPUT', 'The action cannot be dated before the repair was booked.');
    }
    const log: ServiceLog = {
      id: crypto.randomUUID(),
      repair_id: input.repair_id,
      technician_id: input.technician_id,
      technician_name: row.technician_name,
      action_type: input.action_type,
      location: input.location.trim(),
      performed_at: new Date(input.performed_at).toISOString(),
      details: input.details.trim(),
      logged_by: this.isTechnician ? 'mock-tech' : 'mock-admin',
      logged_by_name: this.actorName,
      created_at: new Date().toISOString(),
    };
    this.serviceLogs.unshift(log);
    return { ...log };
  }

  async takenSlots(location: string, bookingDate: string, excludeRepairId: string): Promise<string[]> {
    await this.delay();
    return this.rows
      .filter((row) => row.id !== excludeRepairId && row.location === location &&
        row.booking_date === bookingDate && row.status !== 'cancelled')
      .map((row) => row.booking_time.slice(0, 5));
  }

  async reschedule(repair: QueueRepair, bookingDate: string, bookingTime: string): Promise<QueueRepair> {
    await this.delay();
    this.requireAdmin();
    const row = this.find(repair.id);
    if (row.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending repair can be rescheduled.');
    }
    const normalizedTime = bookingTime.slice(0, 5);
    const conflict = this.rows.some((item) => item.id !== repair.id &&
      item.location === row.location && item.booking_date === bookingDate &&
      item.booking_time.slice(0, 5) === normalizedTime && item.status !== 'cancelled');
    if (conflict) throw new RepairOpsError('INVALID_INPUT', 'That time slot is no longer available.');
    const updated = this.save({ ...row, booking_date: bookingDate, booking_time: normalizedTime });
    this.record(repair.id, {
      event_type: 'schedule',
      previous_booking_date: row.booking_date,
      previous_booking_time: row.booking_time,
      new_booking_date: bookingDate,
      new_booking_time: normalizedTime,
    });
    return updated;
  }
}

/* ------------------------------ SUPABASE (real) ----------------------------- */

/**
 * Joins: service name (services), customer name (profiles via customer_id) and
 * technician name (technicians -> profiles). repairs has TWO links to profiles
 * (customer_id and confirmed_by), so the customer join names its foreign key.
 */
const QUEUE_SELECT =
  '*, service:services(name, base_price), customer:profiles!repairs_customer_id_fkey(full_name), technician:technicians(profiles(full_name))';

type RawQueueRow = RepairRow & {
  service: { name: string; base_price: number } | null;
  customer: { full_name: string } | null;
  technician: { profiles: { full_name: string } | null } | null;
};

function toQueueRepair(raw: RawQueueRow): QueueRepair {
  const { service, customer, technician, ...repair } = raw;
  return {
    ...repair,
    service_name: repair.service_name_snapshot ?? service?.name ?? 'Unknown service',
    service_price: repair.service_price_snapshot ?? service?.base_price ?? null,
    customer_name: customer?.full_name ?? 'Unknown customer',
    technician_name: technician?.profiles?.full_name ?? null,
  };
}

@Injectable()
export class SupabaseRepairOpsRepository extends RepairOpsRepository {
  private readonly config = inject(REPAIR_OPS_CONFIG);

  private get db() {
    return getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
  }

  async listQueue(): Promise<QueueRepair[]> {
    const { data, error } = await this.db
      .from('repairs')
      .select(QUEUE_SELECT)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
    if (error) throw mapPostgrestError(error);
    return ((data ?? []) as unknown as RawQueueRow[]).map(toQueueRepair);
  }

  async confirm(repairId: string): Promise<QueueRepair> {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) throw new RepairOpsError('NOT_ALLOWED', 'You are not signed in.');
    return this.updateOne(repairId, {
      confirmed_by: auth.user.id,
      confirmed_at: new Date().toISOString(),
    });
  }

  /**
   * Status + optional remarks go through t3_update_repair_status() so both land
   * in ONE transaction (the history row then carries the remarks). The 0030
   * status guard and RLS still run - the function is SECURITY INVOKER.
   */
  async updateStatus(repairId: string, to: RepairStatus, remarks?: string | null): Promise<QueueRepair> {
    const cleanRemarks = remarks?.trim() || undefined;
    if (cleanRemarks && cleanRemarks.length > REMARKS_MAX_LENGTH) {
      throw new RepairOpsError('INVALID_INPUT', 'Remarks must be 1,000 characters or fewer.');
    }
    const { error } = await this.db.rpc('t3_update_repair_status', {
      p_repair_id: repairId,
      p_status: to,
      p_remarks: cleanRemarks,
    });
    if (error) throw mapPostgrestError(error);
    const { data, error: readError } = await this.db
      .from('repairs')
      .select(QUEUE_SELECT)
      .eq('id', repairId)
      .maybeSingle();
    if (readError) throw mapPostgrestError(readError);
    if (!data) throw new RepairOpsError('NOT_FOUND', 'That repair was not found, or you cannot change it.');
    return toQueueRepair(data as unknown as RawQueueRow);
  }

  assignTechnician(repairId: string, technicianId: string): Promise<QueueRepair> {
    return this.updateOne(repairId, { technician_id: technicianId });
  }

  async addNote(repairId: string, note: string): Promise<RepairOpsHistory> {
    const { data: auth, error: authError } = await this.db.auth.getUser();
    if (authError) throw new RepairOpsError('UNKNOWN', authError.message, { cause: authError });
    if (!auth.user) throw new RepairOpsError('NOT_ALLOWED', 'You are not signed in.');
    const { data, error } = await this.db
      .from('repair_ops_history')
      .insert({ repair_id: repairId, event_type: 'note', note, changed_by: auth.user.id })
      .select('*, actor:profiles!repair_ops_history_changed_by_fkey(full_name)')
      .single();
    if (error) throw mapPostgrestError(error);
    return toHistory(data as unknown as RawHistoryRow, new Map());
  }

  async listHistory(repairId: string): Promise<RepairOpsHistory[]> {
    const { data, error } = await this.db
      .from('repair_ops_history')
      .select('*, actor:profiles!repair_ops_history_changed_by_fkey(full_name)')
      .eq('repair_id', repairId)
      .order('changed_at', { ascending: false });
    if (error) throw mapPostgrestError(error);
    const rows = data ?? [];
    const names = await this.technicianNames(
      rows.flatMap((row) => [row.previous_technician_id, row.new_technician_id]),
    );
    return rows.map((row) => toHistory(row as unknown as RawHistoryRow, names));
  }

  async listServiceLogs(repairId: string): Promise<ServiceLog[]> {
    const { data, error } = await this.db
      .from('repair_service_logs')
      .select(SERVICE_LOG_SELECT)
      .eq('repair_id', repairId)
      .order('performed_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw mapPostgrestError(error);
    return ((data ?? []) as unknown as RawServiceLogRow[]).map(toServiceLog);
  }

  async addServiceLog(input: ServiceLogInput): Promise<ServiceLog> {
    const { data: auth, error: authError } = await this.db.auth.getUser();
    if (authError) throw new RepairOpsError('UNKNOWN', authError.message, { cause: authError });
    if (!auth.user) throw new RepairOpsError('NOT_ALLOWED', 'You are not signed in.');
    const { data, error } = await this.db
      .from('repair_service_logs')
      .insert({
        repair_id: input.repair_id,
        technician_id: input.technician_id,
        action_type: input.action_type,
        location: input.location.trim(),
        performed_at: new Date(input.performed_at).toISOString(),
        details: input.details.trim(),
        logged_by: auth.user.id,
      })
      .select(SERVICE_LOG_SELECT)
      .single();
    if (error) throw mapPostgrestError(error);
    return toServiceLog(data as unknown as RawServiceLogRow);
  }

  /** previous/new technician ids in the history are plain uuids, so resolve names here. */
  private async technicianNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const names = new Map<string, string>();
    if (unique.length === 0) return names;
    const { data, error } = await this.db
      .from('technicians')
      .select('id, profiles(full_name)')
      .in('id', unique);
    if (error) throw mapPostgrestError(error);
    for (const row of (data ?? []) as unknown as { id: string; profiles: { full_name: string } | null }[]) {
      if (row.profiles?.full_name) names.set(row.id, row.profiles.full_name);
    }
    return names;
  }

  async reschedule(repair: QueueRepair, bookingDate: string, bookingTime: string): Promise<QueueRepair> {
    if (repair.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending repair can be rescheduled.');
    }
    return this.updateOne(repair.id, {
      booking_date: bookingDate,
      booking_time: bookingTime,
    });
  }

  async takenSlots(location: string, bookingDate: string, excludeRepairId: string): Promise<string[]> {
    const { data, error } = await this.db.rpc('get_taken_slots', {
      p_location: location,
      p_date: bookingDate,
      p_exclude_repair: excludeRepairId,
    });
    if (error) throw mapPostgrestError(error);
    return (data ?? []).map((row) => row.booking_time.slice(0, 5));
  }

  private async updateOne(repairId: string, patch: Partial<RepairRow>): Promise<QueueRepair> {
    const { data, error } = await this.db
      .from('repairs')
      .update(patch)
      .eq('id', repairId)
      .select(QUEUE_SELECT)
      .maybeSingle();
    if (error) throw mapPostgrestError(error);
    if (!data) throw new RepairOpsError('NOT_FOUND', 'That repair was not found, or you cannot change it.');
    return toQueueRepair(data as unknown as RawQueueRow);
  }
}

type RawHistoryRow = Omit<
  RepairOpsHistory,
  'actor_name' | 'previous_technician_name' | 'new_technician_name'
> & {
  actor: { full_name: string } | null;
};

function toHistory(raw: RawHistoryRow, technicianNames: Map<string, string>): RepairOpsHistory {
  const { actor, ...history } = raw;
  return {
    ...history,
    previous_technician_name: raw.previous_technician_id
      ? technicianNames.get(raw.previous_technician_id) ?? null
      : null,
    new_technician_name: raw.new_technician_id
      ? technicianNames.get(raw.new_technician_id) ?? null
      : null,
    actor_name: actor?.full_name ?? null,
  };
}

/** Service history: the technician's name and who logged it are joined from profiles. */
const SERVICE_LOG_SELECT =
  '*, technician:technicians(profiles(full_name)), actor:profiles!repair_service_logs_logged_by_fkey(full_name)';

type RawServiceLogRow = Omit<ServiceLog, 'technician_name' | 'logged_by_name'> & {
  technician: { profiles: { full_name: string } | null } | null;
  actor: { full_name: string } | null;
};

function toServiceLog(raw: RawServiceLogRow): ServiceLog {
  const { technician, actor, ...log } = raw;
  return {
    ...log,
    technician_name: technician?.profiles?.full_name ?? null,
    logged_by_name: actor?.full_name ?? null,
  };
}
