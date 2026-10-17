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

/** Colour family of an icon tile; maps to the --kf-<tone> / --kf-<tone>-soft tokens. */
export type Tone = 'accent' | 'green' | 'orange' | 'pink' | 'violet' | 'teal' | 'warn' | 'muted';

export interface IssueDefinition {
  key: IssueFlagKey;
  label: string;
  hint: string;
  /** Extra bench fee used by the price estimate (recommended feature). */
  extraFee: number;
  /** Ionicon name (registered in src/app/icons.ts). */
  icon: string;
  tone: Tone;
}

export const ISSUE_DEFINITIONS: readonly IssueDefinition[] = [
  { key: 'issue_screen', label: 'Screen', hint: 'Cracks, lines, dead spots', extraFee: 0, icon: 'phone-portrait-outline', tone: 'accent' },
  { key: 'issue_battery', label: 'Battery', hint: 'Drains fast, shuts down', extraFee: 250, icon: 'battery-dead-outline', tone: 'green' },
  { key: 'issue_charging', label: 'Charging port', hint: 'Will not charge, loose cable', extraFee: 200, icon: 'flash-outline', tone: 'orange' },
  { key: 'issue_camera', label: 'Camera', hint: 'Blurry, black, or broken lens', extraFee: 300, icon: 'camera-outline', tone: 'pink' },
  { key: 'issue_audio', label: 'Speaker / mic', hint: 'No sound, muffled, mic issue', extraFee: 200, icon: 'volume-high-outline', tone: 'violet' },
  { key: 'issue_software', label: 'Software / OS', hint: 'Boot loop, slow, update problem', extraFee: 150, icon: 'cog-outline', tone: 'teal' },
];

export function isIssueKey(value: string): value is IssueFlagKey {
  return ISSUE_DEFINITIONS.some((issue) => issue.key === value);
}

/** The picked issue definitions of a repair, in the standard order. */
export function repairIssues(repair: Repair): IssueDefinition[] {
  return ISSUE_DEFINITIONS.filter((issue) => repair[issue.key]);
}

export interface RepairStatusMeta {
  value: RepairStatus;
  label: string;
  badgeColor: string;
  icon: string;
  step: number;
  tone: Tone;
}

export const REPAIR_STATUS_LIST: readonly RepairStatusMeta[] = [
  { value: 'pending', label: 'Pending', badgeColor: 'warning', icon: 'time-outline', step: 1, tone: 'warn' },
  { value: 'in_progress', label: 'In progress', badgeColor: 'primary', icon: 'construct-outline', step: 2, tone: 'accent' },
  { value: 'testing', label: 'Testing', badgeColor: 'tertiary', icon: 'build-outline', step: 3, tone: 'violet' },
  { value: 'completed', label: 'Completed', badgeColor: 'success', icon: 'checkmark-circle-outline', step: 4, tone: 'green' },
  { value: 'cancelled', label: 'Cancelled', badgeColor: 'medium', icon: 'close-circle-outline', step: 0, tone: 'muted' },
];

export function statusMeta(status: RepairStatus): RepairStatusMeta {
  return REPAIR_STATUS_LIST.find((meta) => meta.value === status) ?? REPAIR_STATUS_LIST[0];
}

export function issueLabels(repair: Repair): string[] {
  return repairIssues(repair).map((issue) => issue.label);
}

/**
 * What to show as "the problem" on a repair: the picked issue labels, then the
 * customer's optional note. Bookings made while the form was free-text only may
 * have just the note.
 */
export function problemSummary(repair: Repair): string {
  const labels = issueLabels(repair).join(', ');
  const description = repair.issue_description?.trim() ?? '';
  return [labels, description].filter((part) => part.length > 0).join(' · ');
}

/**
 * Customer cancel rule (see docs/Booking_Rule.md).
 * The same rule is enforced in the database by the update guard trigger, so the
 * app can only make the button nicer - the database is the source of truth.
 */
export function canCustomerCancel(repair: Repair): boolean {
  return repair.status === 'pending' || repair.status === 'in_progress';
}

/** Still in the shop: pending, in progress or testing. */
export function isActiveRepair(repair: Pick<Repair, 'status'>): boolean {
  return repair.status === 'pending' || repair.status === 'in_progress' || repair.status === 'testing';
}

/**
 * Anti-spam rule: a customer can have at most this many active repairs at a
 * time. The database enforces the same number (migration 0023, trigger
 * repairs_limit_active_bookings); keep the two in sync.
 */
export const MAX_ACTIVE_BOOKINGS = 3;

export function activeRepairCount(repairs: readonly Pick<Repair, 'status'>[]): number {
  return repairs.filter((repair) => isActiveRepair(repair)).length;
}

/** A device the customer has brought in before (for one-tap booking). */
export interface PastDevice {
  brand: string;
  model: string;
  visits: number;
  /** The most recent repair of this device (by created_at). */
  lastRepair: Repair;
}

/**
 * The customer's devices, newest first, one entry per brand + model
 * (case and spacing differences count as the same device).
 */
export function pastDevices(repairs: readonly Repair[]): PastDevice[] {
  const byKey = new Map<string, PastDevice>();
  for (const repair of repairs) {
    const key = `${repair.device_brand.trim()}|${repair.device_model.trim()}`.toLowerCase().replace(/\s+/g, ' ');
    const found = byKey.get(key);
    if (!found) {
      byKey.set(key, {
        brand: repair.device_brand.trim(),
        model: repair.device_model.trim(),
        visits: 1,
        lastRepair: repair,
      });
      continue;
    }
    found.visits += 1;
    if (repair.created_at.localeCompare(found.lastRepair.created_at) > 0) {
      found.lastRepair = repair;
    }
  }
  return [...byKey.values()].sort((a, b) =>
    b.lastRepair.created_at.localeCompare(a.lastRepair.created_at),
  );
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