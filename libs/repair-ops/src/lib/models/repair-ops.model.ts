import { RepairRow, RepairStatus, ServiceRow } from '@kitafix/shared-types';

/** A repair row plus the names the queue table needs (joined from other teams). */
export type QueueRepair = RepairRow & {
  customer_name: string;
  service_name: string;
  technician_name: string | null;
};

export type ServiceItem = ServiceRow;

export interface ServiceInput {
  name: string;
  description: string | null;
  base_price: number;
  active: boolean;
}

export type QueueFilter = 'all' | 'waiting' | 'processed';

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

/** "Waiting for repair" = pending and not confirmed yet. */
export function isWaiting(repair: RepairRow): boolean {
  return repair.status === 'pending' && !isConfirmed(repair);
}

/** "Already processed" = everything that is not waiting. */
export function isProcessed(repair: RepairRow): boolean {
  return !isWaiting(repair);
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

/** Service form checks (required: name and price). */
export function serviceInputProblem(input: ServiceInput): string | null {
  if (!input.name.trim()) return 'Service name is required.';
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    return 'Enter a valid price (0 or more).';
  }
  return null;
}
