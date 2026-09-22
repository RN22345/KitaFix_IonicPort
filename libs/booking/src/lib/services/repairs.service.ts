import { Injectable, computed, inject, signal } from '@angular/core';
import { RepairStatus } from '@kitafix/shared-types';
import { BookingDraft } from '../models/booking-draft.model';
import { BookingError, bookingErrorMessage } from '../models/booking-error';
import { ServiceOption, TechnicianOption } from '../models/catalog.model';
import { Repair } from '../models/repair.model';
import { RepairsRepository } from '../data-access/repositories/repairs.repository';
import { ServicesGateway } from '../data-access/gateways/services.gateway';
import { TechniciansGateway } from '../data-access/gateways/technicians.gateway';
import { CurrentUserService } from '../data-access/session/current-user.service';
import { RepairsRealtimeService } from './repairs-realtime.service';

/**
 * Facade used by the three booking screens.
 * Screens never talk to the repository or the gateways directly
 * (except the reschedule modal, which reuses this facade too).
 */
@Injectable({ providedIn: 'root' })
export class RepairsService {
  private readonly repository = inject(RepairsRepository);
  private readonly techniciansGateway = inject(TechniciansGateway);
  private readonly servicesGateway = inject(ServicesGateway);
  private readonly currentUserService = inject(CurrentUserService);
  private readonly realtime = inject(RepairsRealtimeService);

  readonly currentUser = this.currentUserService.user;
  readonly myRepairs = signal<Repair[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly technicianOptions = signal<TechnicianOption[]>([]);
  readonly serviceOptions = signal<ServiceOption[]>([]);

  readonly statusCounts = computed<Record<RepairStatus, number>>(() => {
    const counts: Record<RepairStatus, number> = {
      pending: 0,
      in_progress: 0,
      testing: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const repair of this.myRepairs()) {
      counts[repair.status] += 1;
    }
    return counts;
  });

  private loadPromise: Promise<void> | null = null;

  /** Safe to call from every screen: only loads once. */
  ensureLoaded(): Promise<void> {
    this.loadPromise ??= this.loadEverything();
    return this.loadPromise;
  }

  /** Retry button on the error banner. */
  retryLoad(): Promise<void> {
    this.loadPromise = this.loadEverything();
    return this.loadPromise;
  }

  private async loadEverything(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const user = await this.currentUserService.load();
      await Promise.all([this.refreshMyRepairs(), this.loadPickers()]);
      this.realtime.watchCustomer(user.id, (repair) => this.applyRealtimeRepair(repair));
    } catch (error) {
      this.error.set(bookingErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async refreshMyRepairs(): Promise<void> {
    const user = this.currentUserService.user();
    if (!user) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      this.myRepairs.set(await this.repository.listByCustomer(user.id));
    } catch (error) {
      this.error.set(bookingErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPickers(): Promise<void> {
    const [services, technicians] = await Promise.all([
      this.servicesGateway.listActive(),
      this.techniciansGateway.listActive(),
    ]);
    this.serviceOptions.set(services);
    this.technicianOptions.set(technicians);
  }

  async createBooking(draft: BookingDraft): Promise<Repair> {
    const user = this.currentUserService.user();
    if (!user) {
      throw new BookingError('NOT_ALLOWED', 'You must be signed in before booking a repair.');
    }
    const created = await this.repository.create(draft, user.id);
    this.myRepairs.update((repairs) => [created, ...repairs]);
    return created;
  }

  async cancelRepair(repairId: string): Promise<Repair> {
    const user = this.currentUserService.user();
    if (!user) {
      throw new BookingError('NOT_ALLOWED', 'You must be signed in.');
    }
    const updated = await this.repository.cancel(repairId, user.id);
    this.replaceRepair(updated);
    return updated;
  }

  async rescheduleRepair(repairId: string, bookingDate: string, bookingTime: string): Promise<Repair> {
    const user = this.currentUserService.user();
    if (!user) {
      throw new BookingError('NOT_ALLOWED', 'You must be signed in.');
    }
    const updated = await this.repository.reschedule(repairId, user.id, bookingDate, bookingTime);
    this.replaceRepair(updated);
    return updated;
  }

  takenSlots(location: string, bookingDate: string, excludeRepairId?: string): Promise<string[]> {
    return this.repository.takenSlots(location, bookingDate, excludeRepairId);
  }

  private replaceRepair(repair: Repair): void {
    this.myRepairs.update((repairs) =>
      repairs.map((item) => (item.id === repair.id ? repair : item)),
    );
  }

  /** Realtime update from the database (or nothing in mock mode). */
  private applyRealtimeRepair(repair: Repair): void {
    this.myRepairs.update((repairs) => {
      const index = repairs.findIndex((item) => item.id === repair.id);
      if (index === -1) {
        return [repair, ...repairs];
      }
      const copy = [...repairs];
      copy[index] = repair;
      return copy;
    });
  }
}
