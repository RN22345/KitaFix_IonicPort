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

/** Who is using the module (FSD roles: SA = staff/admin, TECH = technician). */
export type RepairOpsRole = 'staff' | 'technician';

export interface RepairOpsActor {
  id: string;
  full_name: string;
  role: RepairOpsRole;
  /** technicians.id of the signed-in technician (null for staff). */
  technician_id: string | null;
}

export interface RepairOpsHistory {
  id: string;
  repair_id: string;
  event_type: RepairOpsHistoryType;
  previous_status: RepairStatus | null;
  new_status: RepairStatus | null;
  previous_technician_id: string | null;
  new_technician_id: string | null;
  previous_technician_name: string | null;
  new_technician_name: string | null;
  previous_booking_date: string | null;
  previous_booking_time: string | null;
  new_booking_date: string | null;
  new_booking_time: string | null;
  note: string | null;
  /** Optional remark typed with a status change (status timeline "Remarks"). */
  remarks: string | null;
  changed_by: string | null;
  changed_at: string;
  actor_name: string | null;
}

export const REMARKS_MAX_LENGTH = 1000;
export const NOTE_MAX_LENGTH = 5000;

/* ------------------------------ SERVICE HISTORY ----------------------------- */

export type ServiceLogAction = 'inspection' | 'diagnosis' | 'repair' | 'testing' | 'other';

export const SERVICE_LOG_ACTIONS: readonly { value: ServiceLogAction; label: string }[] = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'repair', label: 'Repair work' },
  { value: 'testing', label: 'Testing' },
  { value: 'other', label: 'Other' },
];

export function serviceLogActionLabel(action: ServiceLogAction): string {
  return SERVICE_LOG_ACTIONS.find((item) => item.value === action)?.label ?? action;
}

/** One row of the service history: WHAT was done, WHERE, WHEN, by WHICH technician. */
export interface ServiceLog {
  id: string;
  repair_id: string;
  technician_id: string;
  technician_name: string | null;
  action_type: ServiceLogAction;
  /** Where the action was performed (branch / bench). */
  location: string;
  /** When the action was performed (ISO timestamp). */
  performed_at: string;
  details: string;
  logged_by: string | null;
  logged_by_name: string | null;
  created_at: string;
}

export interface ServiceLogInput {
  repair_id: string;
  technician_id: string;
  action_type: ServiceLogAction;
  location: string;
  performed_at: string;
  details: string;
}

/** Same rule as the database (t3_can_log_service): only while work is under way. */
export const SERVICE_LOG_STATUSES: readonly RepairStatus[] = ['in_progress', 'testing'];

/** Friendly message when a service log cannot be added to this repair, else null. */
export function serviceLogBlockedReason(repair: RepairRow): string | null {
  if (!SERVICE_LOG_STATUSES.includes(repair.status)) {
    return 'Service actions can only be logged while the repair is In Progress or Testing.';
  }
  if (!repair.technician_id) return 'Assign a technician before logging service actions.';
  return null;
}

export function canLogService(repair: RepairRow): boolean {
  return serviceLogBlockedReason(repair) === null;
}

/** Form checks for a service log (required: action, where, when, details). */
export function serviceLogInputProblem(input: ServiceLogInput, now: Date = new Date()): string | null {
  if (!SERVICE_LOG_ACTIONS.some((item) => item.value === input.action_type)) {
    return 'Choose the type of action performed.';
  }
  if (!input.location.trim()) return 'Enter where the action was performed.';
  if (input.location.trim().length > 200) return 'Location must be 200 characters or fewer.';
  const performed = new Date(input.performed_at);
  if (!input.performed_at || Number.isNaN(performed.getTime())) {
    return 'Enter when the action was performed.';
  }
  if (performed.getTime() > now.getTime() + 5 * 60_000) {
    return 'The date and time of the action cannot be in the future.';
  }
  if (!input.details.trim()) return 'Enter the details of the action performed.';
  if (input.details.trim().length > NOTE_MAX_LENGTH) {
    return 'Details must be 5,000 characters or fewer.';
  }
  return null;
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
