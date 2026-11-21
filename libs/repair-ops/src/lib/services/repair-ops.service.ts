import { Injectable, computed, inject, signal } from '@angular/core';
import { BOOKING_CONFIG, TechnicianOption, TechniciansGateway } from '@kitafix/booking';
import { RepairStatus } from '@kitafix/shared-types';
import { RepairOpsRepository } from '../data-access/repair-ops.repository';
import { repairOpsErrorMessage } from '../models/repair-ops-error';
import {
  QueueFilter,
  QueueRepair,
  RepairOpsHistory,
  isConfirmed,
  matchesFilter,
  statusChangeProblem,
} from '../models/repair-ops.model';
import { RepairOpsError } from '../models/repair-ops-error';

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

  readonly repairs = signal<QueueRepair[]>([]);
  readonly history = signal<Partial<Record<string, RepairOpsHistory[]>>>({});
  readonly historyLoading = signal<Set<string>>(new Set());
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
    if (this.repairs().length === 0 && !this.loading()) {
      await this.load();
    }
  }

  listTechnicians(): Promise<TechnicianOption[]> {
    return this.technicianGateway.listActive();
  }

  async confirm(repair: QueueRepair): Promise<void> {
    if (isConfirmed(repair)) {
      throw new RepairOpsError('INVALID_STATUS', 'This booking is already confirmed.');
    }
    this.replace(await this.repo.confirm(repair.id));
  }

  async changeStatus(repair: QueueRepair, to: RepairStatus): Promise<void> {
    const problem = statusChangeProblem(repair, to);
    if (problem) throw new RepairOpsError('INVALID_STATUS', problem);
    this.replace(await this.repo.updateStatus(repair.id, to));
  }

  async assignTechnician(repair: QueueRepair, technician: TechnicianOption): Promise<void> {
    this.replace(await this.repo.assignTechnician(repair.id, technician.id, technician.full_name));
  }

  async addNote(repairId: string, value: string): Promise<void> {
    const note = value.trim();
    if (!note) throw new RepairOpsError('INVALID_INPUT', 'Enter a repair note.');
    if (note.length > 5000) throw new RepairOpsError('INVALID_INPUT', 'Repair notes must be 5,000 characters or fewer.');
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
    if (repair.status !== 'pending') {
      throw new RepairOpsError('INVALID_STATUS', 'Only a pending repair can be rescheduled.');
    }
    this.replace(await this.repo.reschedule(repair, bookingDate, bookingTime));
  }

  async availableSlots(repair: QueueRepair, bookingDate: string): Promise<string[]> {
    const taken = await this.repo.takenSlots(repair.location, bookingDate, repair.id);
    return this.bookingConfig.slotTimes.filter((slot) => !taken.includes(slot.slice(0, 5)));
  }

  private replace(updated: QueueRepair): void {
    this.repairs.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }
}
