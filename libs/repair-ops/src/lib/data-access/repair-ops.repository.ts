import { Injectable, inject } from '@angular/core';
import { getSupabaseClient } from '@kitafix/booking';
import { RepairRow, RepairStatus } from '@kitafix/shared-types';
import { RepairOpsError } from '../models/repair-ops-error';
import {
  QueueRepair,
  isConfirmed,
  statusChangeProblem,
} from '../models/repair-ops.model';
import { REPAIR_OPS_CONFIG } from './config';
import { MOCK_QUEUE } from './mock/mock-repair-ops.data';
import { mapPostgrestError } from './postgrest-errors';

/**
 * Everything the Repair Queue reads and writes on the `repairs` table
 * (workflow columns only: status, technician_id, confirmed_by, confirmed_at).
 * Booking columns belong to Team 2 - we never change them.
 */
export abstract class RepairOpsRepository {
  abstract listQueue(): Promise<QueueRepair[]>;
  abstract confirm(repairId: string): Promise<QueueRepair>;
  abstract updateStatus(repairId: string, to: RepairStatus): Promise<QueueRepair>;
  abstract assignTechnician(repairId: string, technicianId: string, technicianName: string): Promise<QueueRepair>;
}

/* ------------------------------ MOCK (offline) ------------------------------ */

@Injectable()
export class MockRepairOpsRepository extends RepairOpsRepository {
  private rows: QueueRepair[] = MOCK_QUEUE.map((row) => ({ ...row }));

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

  async listQueue(): Promise<QueueRepair[]> {
    await this.delay();
    return this.rows.map((row) => ({ ...row }));
  }

  async confirm(repairId: string): Promise<QueueRepair> {
    await this.delay();
    const row = this.find(repairId);
    if (isConfirmed(row)) throw new RepairOpsError('INVALID_STATUS', 'This booking is already confirmed.');
    if (row.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending booking can be confirmed.');
    }
    return this.save({ ...row, confirmed_by: 'mock-staff', confirmed_at: new Date().toISOString() });
  }

  async updateStatus(repairId: string, to: RepairStatus): Promise<QueueRepair> {
    await this.delay();
    const row = this.find(repairId);
    const problem = statusChangeProblem(row, to);
    if (problem) throw new RepairOpsError('INVALID_STATUS', problem);
    return this.save({ ...row, status: to });
  }

  async assignTechnician(repairId: string, technicianId: string, technicianName: string): Promise<QueueRepair> {
    await this.delay();
    const row = this.find(repairId);
    if (row.status === 'completed' || row.status === 'cancelled') {
      throw new RepairOpsError('INVALID_STATUS', 'A finished repair cannot be reassigned.');
    }
    return this.save({ ...row, technician_id: technicianId, technician_name: technicianName });
  }
}

/* ------------------------------ SUPABASE (real) ----------------------------- */

/**
 * Joins: service name (services), customer name (profiles via customer_id) and
 * technician name (technicians -> profiles). repairs has TWO links to profiles
 * (customer_id and confirmed_by), so the customer join names its foreign key.
 */
const QUEUE_SELECT =
  '*, service:services(name), customer:profiles!repairs_customer_id_fkey(full_name), technician:technicians(profiles(full_name))';

type RawQueueRow = RepairRow & {
  service: { name: string } | null;
  customer: { full_name: string } | null;
  technician: { profiles: { full_name: string } | null } | null;
};

function toQueueRepair(raw: RawQueueRow): QueueRepair {
  const { service, customer, technician, ...repair } = raw;
  return {
    ...repair,
    service_name: service?.name ?? 'Unknown service',
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

  updateStatus(repairId: string, to: RepairStatus): Promise<QueueRepair> {
    return this.updateOne(repairId, { status: to });
  }

  assignTechnician(repairId: string, technicianId: string): Promise<QueueRepair> {
    return this.updateOne(repairId, { technician_id: technicianId });
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
