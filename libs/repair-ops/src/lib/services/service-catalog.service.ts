import { Injectable, inject, signal } from '@angular/core';
import { ServiceCatalogRepository } from '../data-access/service-catalog.repository';
import { RepairOpsError, repairOpsErrorMessage } from '../models/repair-ops-error';
import { ServiceInput, ServiceItem, serviceInputProblem } from '../models/repair-ops.model';

/** State for the Service Catalog screen (add, edit, turn on/off). */
@Injectable({ providedIn: 'root' })
export class ServiceCatalogService {
  private readonly repo = inject(ServiceCatalogRepository);

  readonly services = signal<ServiceItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.services.set(await this.repo.list());
    } catch (error) {
      this.error.set(repairOpsErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async add(input: ServiceInput): Promise<void> {
    this.assertValid(input);
    const created = await this.repo.add(input);
    this.services.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async edit(id: string, input: ServiceInput): Promise<void> {
    this.assertValid(input);
    this.replace(await this.repo.update(id, input));
  }

  async setActive(id: string, active: boolean): Promise<void> {
    this.replace(await this.repo.setActive(id, active));
  }

  private assertValid(input: ServiceInput): void {
    const problem = serviceInputProblem(input);
    if (problem) throw new RepairOpsError('INVALID_INPUT', problem);
  }

  private replace(updated: ServiceItem): void {
    this.services.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
  }
}
