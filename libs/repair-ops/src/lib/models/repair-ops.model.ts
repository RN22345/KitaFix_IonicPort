import { RepairRow, RepairStatus, ServiceRow } from '@kitafix/shared-types';

/** A repair row plus the names the queue table needs (joined from other teams). */
export type QueueRepair = RepairRow & {
  customer_name: string;
  service_name: string;
  service_price: number | null;
  technician_name: string | null;
  repair_started_at: string | null;
};

export type ServiceItem = ServiceRow;

export interface ServiceInput {
  name: string;
  description: string;
  base_price: number;
  active: boolean;
}

export type QueueFilter = 'all' | 'waiting' | 'processed';
export type QueueSortKey = 'id' | 'customer_name' | 'status' | 'booking_date' | 'technician_name';
export type RepairOpsHistoryType = 'status' | 'technician' | 'schedule' | 'note';

export interface RepairOpsHistory {
  id: string;
  repair_id: string;
  event_type: RepairOpsHistoryType;
  previous_status: RepairStatus | null;
  new_status: RepairStatus | null;
  previous_technician_id: string | null;
  new_technician_id: string | null;
  previous_booking_date: string | null;
  previous_booking_time: string | null;
  new_booking_date: string | null;
  new_booking_time: string | null;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
  actor_name: string | null;
}

/**
 * The status state machine (same rule as the database trigger
 * t3_repairs_status_guard in 0030_team3_repair_ops.sql).
 * The database is the source of truth; this only hides illegal buttons.
 */
export const STATUS_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['testing', 'cancelled'],
  testing: ['completed', 'in_progress'],
  completed: [],
  cancelled: [],
};

export function nextStatuses(status: RepairStatus): readonly RepairStatus[] {
  return STATUS_TRANSITIONS[status];
}

export function isConfirmed(repair: RepairRow): boolean {
  return repair.confirmed_at !== null;
}

/** "Waiting for repair" = the repair has the pending status. */
export function isWaiting(repair: RepairRow): boolean {
  return repair.status === 'pending';
}

/** "Already processed" = everything that is not pending. */
export function isProcessed(repair: RepairRow): boolean {
  return repair.status !== 'pending';
}

export function matchesFilter(repair: RepairRow, filter: QueueFilter): boolean {
  if (filter === 'waiting') return isWaiting(repair);
  if (filter === 'processed') return isProcessed(repair);
  return true;
}

/** Friendly message for a blocked change, or null when the change is allowed. */
export function statusChangeProblem(repair: RepairRow, to: RepairStatus): string | null {
  if (!STATUS_TRANSITIONS[repair.status].includes(to)) {
    return `Invalid status change: ${repair.status} -> ${to}.`;
  }
  if (repair.status === 'pending' && to === 'in_progress') {
    if (!isConfirmed(repair)) return 'Confirm the booking before starting the repair.';
    if (!repair.technician_id) return 'Assign a technician before starting the repair.';
  }
  return null;
}

/** Service form checks (required: name, description, price and status). */
export function serviceInputProblem(input: ServiceInput): string | null {
  if (!input.name.trim()) return 'Service name is required.';
  if (!input.description.trim()) return 'Service description is required.';
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    return 'Enter a valid price (0 or more).';
  }
  if (typeof input.active !== 'boolean') return 'Choose a service status.';
  return null;
}
