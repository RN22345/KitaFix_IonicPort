import { Injectable, computed, inject, signal } from '@angular/core';
import { TechnicianOption, TechniciansGateway } from '@kitafix/booking';
import { RepairStatus } from '@kitafix/shared-types';
import { RepairOpsRepository } from '../data-access/repair-ops.repository';
import { repairOpsErrorMessage } from '../models/repair-ops-error';
import {
  QueueFilter,
  QueueRepair,
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

  readonly repairs = signal<QueueRepair[]>([]);
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

  private replace(updated: QueueRepair): void {
    this.repairs.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }
}
