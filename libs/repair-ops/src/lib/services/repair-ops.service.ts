import { Injectable, computed, inject, signal } from '@angular/core';
import { BOOKING_CONFIG, TechnicianOption, TechniciansGateway } from '@kitafix/booking';
import { RepairStatus } from '@kitafix/shared-types';
import { RepairOpsRepository } from '../data-access/repair-ops.repository';
import { RepairOpsSession } from '../data-access/session/repair-ops-session';
import { RepairOpsError, repairOpsErrorMessage } from '../models/repair-ops-error';
import {
  NOTE_MAX_LENGTH,
  QueueFilter,
  QueueRepair,
  REMARKS_MAX_LENGTH,
  RepairOpsActor,
  RepairOpsHistory,
  ServiceLog,
  ServiceLogInput,
  isConfirmed,
  matchesFilter,
  serviceLogBlockedReason,
  serviceLogInputProblem,
  statusChangeProblem,
} from '../models/repair-ops.model';

/**
 * State for the Admin Portal + Repair Queue screens.
 * Screens read the signals and call the methods; they never talk to Supabase.
 * Methods throw RepairOpsError so the screen can show a toast.
 */
@Injectable({ providedIn: 'root' })
export class RepairOpsService {
  private readonly repo = inject(RepairOpsRepository);
  private readonly technicianGateway = inject(TechniciansGateway);
  private readonly bookingConfig = inject(BOOKING_CONFIG);
  private readonly session = inject(RepairOpsSession);

  /** Signed-in staff member or technician (null until loadActor() finishes). */
  readonly actor = this.session.actor;
  readonly isStaff = computed(() => this.actor()?.role === 'staff');
  readonly isTechnician = computed(() => this.actor()?.role === 'technician');

  readonly repairs = signal<QueueRepair[]>([]);
  readonly history = signal<Partial<Record<string, RepairOpsHistory[]>>>({});
  readonly historyLoading = signal<Set<string>>(new Set());
  readonly serviceLogs = signal<Partial<Record<string, ServiceLog[]>>>({});
  readonly serviceLogsLoading = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filter = signal<QueueFilter>('all');

  /** Summary cards on the Admin Portal. */
  readonly counts = computed(() => {
    const all = this.repairs();
    return {
      all: all.length,
      pending: all.filter((r) => matchesFilter(r, 'waiting')).length,
      confirmed: all.filter((r) => isConfirmed(r)).length,
    };
  });

  readonly visible = computed(() => this.repairs().filter((r) => matchesFilter(r, this.filter())));

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.repairs.set(await this.repo.listQueue());
    } catch (error) {
      this.error.set(repairOpsErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async ensureLoaded(): Promise<void> {
    await this.loadActor();
    if (this.repairs().length === 0 && !this.loading()) {
      await this.load();
    }
  }

  /** Who is signed in (staff or technician). Cached after the first successful call. */
  async loadActor(): Promise<RepairOpsActor | null> {
    const current = this.actor();
    if (current) return current;
    try {
      return await this.session.load();
    } catch (error) {
      this.error.set(repairOpsErrorMessage(error));
      return null;
    }
  }

  /** Staff-only actions (FSD 3.7-3.10, 3.12): technicians are blocked here and by the database. */
  private requireStaff(): void {
    if (!this.isStaff()) {
      throw new RepairOpsError('NOT_ALLOWED', 'Only shop staff can do this.');
    }
  }

  listTechnicians(): Promise<TechnicianOption[]> {
    return this.technicianGateway.listActive();
  }

  async confirm(repair: QueueRepair): Promise<void> {
    this.requireStaff();
    if (isConfirmed(repair)) {
      throw new RepairOpsError('INVALID_STATUS', 'This booking is already confirmed.');
    }
    this.replace(await this.repo.confirm(repair.id));
  }

  async changeStatus(repair: QueueRepair, to: RepairStatus, remarks?: string): Promise<void> {
    this.requireStaff();
    const problem = statusChangeProblem(repair, to);
    if (problem) throw new RepairOpsError('INVALID_STATUS', problem);
    const cleanRemarks = remarks?.trim() ?? '';
    if (cleanRemarks.length > REMARKS_MAX_LENGTH) {
      throw new RepairOpsError('INVALID_INPUT', 'Remarks must be 1,000 characters or fewer.');
    }
    this.replace(await this.repo.updateStatus(repair.id, to, cleanRemarks || null));
  }

  async assignTechnician(repair: QueueRepair, technician: TechnicianOption): Promise<void> {
    this.requireStaff();
    this.replace(await this.repo.assignTechnician(repair.id, technician.id, technician.full_name));
  }

  async addNote(repairId: string, value: string): Promise<void> {
    const note = value.trim();
    if (!note) throw new RepairOpsError('INVALID_INPUT', 'Enter a repair note.');
    if (note.length > NOTE_MAX_LENGTH) throw new RepairOpsError('INVALID_INPUT', 'Repair notes must be 5,000 characters or fewer.');
    const created = await this.repo.addNote(repairId, note);
    this.history.update((current) => ({
      ...current,
      [repairId]: [created, ...(current[repairId] ?? [])],
    }));
  }

  async loadHistory(repairId: string): Promise<void> {
    this.historyLoading.update((current) => new Set(current).add(repairId));
    try {
      const history = await this.repo.listHistory(repairId);
      this.history.update((current) => ({
        ...current,
        [repairId]: history,
      }));
    } finally {
      this.historyLoading.update((current) => {
        const next = new Set(current);
        next.delete(repairId);
        return next;
      });
    }
  }

  async reschedule(repair: QueueRepair, bookingDate: string, bookingTime: string): Promise<void> {
    this.requireStaff();
    if (repair.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending repair can be rescheduled.');
    }
    this.replace(await this.repo.reschedule(repair, bookingDate, bookingTime));
  }

  /* ------------------------- SERVICE HISTORY (technician log) ------------------------- */

  /** Why a service action cannot be logged on this repair right now (null = allowed). */
  serviceLogBlocked(repair: QueueRepair): string | null {
    const actor = this.actor();
    if (!actor) return 'Sign in to log service actions.';
    if (actor.role === 'technician' && repair.technician_id !== actor.technician_id) {
      return 'You can only log actions on repairs assigned to you.';
    }
    return serviceLogBlockedReason(repair);
  }

  async loadServiceLogs(repairId: string): Promise<void> {
    this.serviceLogsLoading.update((current) => new Set(current).add(repairId));
    try {
      const logs = await this.repo.listServiceLogs(repairId);
      this.serviceLogs.update((current) => ({ ...current, [repairId]: logs }));
    } finally {
      this.serviceLogsLoading.update((current) => {
        const next = new Set(current);
        next.delete(repairId);
        return next;
      });
    }
  }

  /**
   * Records what a technician did, where and when. The log is always written for
   * the technician assigned to the repair (staff may log on their behalf).
   */
  async addServiceLog(
    repair: QueueRepair,
    draft: Pick<ServiceLogInput, 'action_type' | 'location' | 'performed_at' | 'details'>,
  ): Promise<ServiceLog> {
    const blocked = this.serviceLogBlocked(repair);
    if (blocked) throw new RepairOpsError('INVALID_STATUS', blocked);
    const input: ServiceLogInput = {
      ...draft,
      repair_id: repair.id,
      technician_id: repair.technician_id as string,
    };
    const problem = serviceLogInputProblem(input);
    if (problem) throw new RepairOpsError('INVALID_INPUT', problem);
    const created = await this.repo.addServiceLog(input);
    this.serviceLogs.update((current) => ({
      ...current,
      [repair.id]: [created, ...(current[repair.id] ?? [])].sort((a, b) =>
        b.performed_at.localeCompare(a.performed_at),
      ),
    }));
    return created;
  }

  async availableSlots(repair: QueueRepair, bookingDate: string): Promise<string[]> {
    const taken = await this.repo.takenSlots(repair.location, bookingDate, repair.id);
    return this.bookingConfig.slotTimes.filter((slot) => !taken.includes(slot.slice(0, 5)));
  }

  private replace(updated: QueueRepair): void {
    this.repairs.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }
}
