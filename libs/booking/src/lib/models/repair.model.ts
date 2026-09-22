import { RepairRow, RepairStatus } from '@kitafix/shared-types';

/**
 * Team 2 domain model. We use the database row directly (the contract) and add
 * pure helpers on top of it. No UI code here.
 */
export type Repair = RepairRow;

/** The six issue flags from the Module Plan (frozen booking columns). */
export type IssueFlagKey =
  | 'issue_screen'
  | 'issue_battery'
  | 'issue_charging'
  | 'issue_camera'
  | 'issue_audio'
  | 'issue_software';

export interface IssueDefinition {
  key: IssueFlagKey;
  label: string;
  hint: string;
  /** Extra bench fee used by the price estimate (recommended feature). */
  extraFee: number;
}

export const ISSUE_DEFINITIONS: readonly IssueDefinition[] = [
  { key: 'issue_screen', label: 'Screen', hint: 'Cracks, lines, dead spots', extraFee: 0 },
  { key: 'issue_battery', label: 'Battery', hint: 'Drains fast, shuts down', extraFee: 250 },
  { key: 'issue_charging', label: 'Charging port', hint: 'Will not charge, loose cable', extraFee: 200 },
  { key: 'issue_camera', label: 'Camera', hint: 'Blurry, black, or broken lens', extraFee: 300 },
  { key: 'issue_audio', label: 'Speaker / mic', hint: 'No sound, muffled, mic issue', extraFee: 200 },
  { key: 'issue_software', label: 'Software / OS', hint: 'Boot loop, slow, update problem', extraFee: 150 },
];

export interface RepairStatusMeta {
  value: RepairStatus;
  label: string;
  badgeColor: string;
  icon: string;
  step: number;
}

export const REPAIR_STATUS_LIST: readonly RepairStatusMeta[] = [
  { value: 'pending', label: 'Pending', badgeColor: 'warning', icon: 'time-outline', step: 1 },
  { value: 'in_progress', label: 'In progress', badgeColor: 'primary', icon: 'construct-outline', step: 2 },
  { value: 'testing', label: 'Testing', badgeColor: 'tertiary', icon: 'build-outline', step: 3 },
  { value: 'completed', label: 'Completed', badgeColor: 'success', icon: 'checkmark-circle-outline', step: 4 },
  { value: 'cancelled', label: 'Cancelled', badgeColor: 'medium', icon: 'close-circle-outline', step: 0 },
];

export function statusMeta(status: RepairStatus): RepairStatusMeta {
  return REPAIR_STATUS_LIST.find((meta) => meta.value === status) ?? REPAIR_STATUS_LIST[0];
}

export function issueLabels(repair: Repair): string[] {
  return ISSUE_DEFINITIONS.filter((issue) => repair[issue.key]).map((issue) => issue.label);
}

/**
 * Customer cancel rule (see docs/Booking_Rule.md).
 * The same rule is enforced in the database by the update guard trigger, so the
 * app can only make the button nicer - the database is the source of truth.
 */
export function canCustomerCancel(repair: Repair): boolean {
  return repair.status === 'pending' || repair.status === 'in_progress';
}

/** Customer reschedule rule: only pending bookings. */
export function canCustomerReschedule(repair: Repair): boolean {
  return repair.status === 'pending';
}

export function shortRepairId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function formatBookingDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "14:00:00" -> "2:00 PM" */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours)) {
    return time;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${suffix}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Postgres returns "10:00:00", the UI uses "10:00". */
export function normalizeTime(time: string): string {
  return time.slice(0, 5);
}
