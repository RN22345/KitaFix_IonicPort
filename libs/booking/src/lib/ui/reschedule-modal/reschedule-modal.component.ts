import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { BOOKING_CONFIG } from '../../data-access/config';
import { BookingError, bookingErrorMessage } from '../../models/booking-error';
import { Repair, formatTime, normalizeTime } from '../../models/repair.model';
import { RepairsService } from '../../services/repairs.service';

/**
 * Recommended feature: reschedule a pending booking.
 * Only hours that are still free at that location are offered; the database
 * constraint is still the final check (SQLSTATE 23P01 -> friendly message).
 */
@Component({
  selector: 'app-reschedule-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonDatetime,
    IonHeader,
    IonIcon,
    IonModal,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-modal [isOpen]="isOpen()" (didDismiss)="isOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Reschedule booking</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="close()">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          @if (repair(); as current) {
            <p class="summary">
              {{ current.device_brand }} {{ current.device_model }} &middot; {{ current.location }}
            </p>
            <p class="current-slot">
              Current slot: {{ formatTime(current.booking_time) }} on {{ current.booking_date }}
            </p>
          }

          <ion-datetime
            presentation="date"
            [min]="minDate"
            [value]="bookingDate()"
            (ionChange)="onDateChange($event)"
          ></ion-datetime>

          <ion-select
            label="New time"
            labelPlacement="stacked"
            placeholder="Pick a free hour"
            interface="popover"
            [value]="bookingTime()"
            [disabled]="loadingSlots() || freeSlots().length === 0"
            (ionChange)="onTimeChange($event)"
          >
            @for (slot of freeSlots(); track slot) {
              <ion-select-option [value]="slot">{{ formatTime(slot) }}</ion-select-option>
            }
          </ion-select>

          @if (loadingSlots()) {
            <div class="inline-loading">
              <ion-spinner name="crescent"></ion-spinner>
              <span>Checking available hours...</span>
            </div>
          } @else if (freeSlots().length === 0) {
            <ion-note color="warning">No free hours left that day at this location.</ion-note>
          }

          @if (error(); as message) {
            <ion-note color="danger" class="error">{{ message }}</ion-note>
          }

          <div class="actions">
            <ion-button
              expand="block"
              [disabled]="saving() || loadingSlots() || !bookingTime()"
              (click)="confirm()"
            >
              @if (saving()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                <ion-icon slot="start" name="save-outline"></ion-icon>
                Save new schedule
              }
            </ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      .summary {
        margin: 0 0 0.25rem;
        font-weight: 600;
      }
      .current-slot {
        margin: 0 0 1rem;
        color: var(--ion-color-medium);
        font-size: 0.9rem;
      }
      ion-datetime {
        border-radius: 12px;
        margin-bottom: 1rem;
      }
      .inline-loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--ion-color-medium);
        font-size: 0.9rem;
        padding-top: 0.25rem;
      }
      .error {
        display: block;
        padding-top: 0.5rem;
      }
      .actions {
        padding-top: 1rem;
      }
    `,
  ],
})
export class RescheduleModalComponent {
  readonly isOpen = model(false);
  readonly repair = input<Repair | null>(null);
  readonly done = output<Repair>();

  private readonly bookingService = inject(RepairsService);
  private readonly config = inject(BOOKING_CONFIG);

  readonly minDate = new Date().toISOString();
  readonly bookingDate = signal('');
  readonly bookingTime = signal('');
  readonly takenSlots = signal<string[]>([]);
  readonly loadingSlots = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly freeSlots = computed(() => {
    const taken = this.takenSlots().map((slot) => normalizeTime(slot));
    return this.config.slotTimes.filter((slot) => !taken.includes(slot));
  });

  protected readonly formatTime = formatTime;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const current = this.repair();
      if (open && current) {
        this.bookingDate.set(current.booking_date);
        this.bookingTime.set(normalizeTime(current.booking_time));
        this.error.set(null);
        void this.loadSlots();
      }
    });
  }

  onDateChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail?.value;
    const date = Array.isArray(value) ? value[0] : value;
    if (!date) {
      return;
    }
    this.bookingDate.set(date.slice(0, 10));
    this.bookingTime.set('');
    void this.loadSlots();
  }

  onTimeChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail?.value;
    const time = Array.isArray(value) ? value[0] : value;
    this.bookingTime.set(time ? normalizeTime(time) : '');
  }

  async loadSlots(): Promise<void> {
    const current = this.repair();
    const date = this.bookingDate();
    if (!current || !date) {
      return;
    }
    this.loadingSlots.set(true);
    try {
      this.takenSlots.set(
        await this.bookingService.takenSlots(current.location, date, current.id),
      );
    } catch (error) {
      this.error.set(bookingErrorMessage(error));
    } finally {
      this.loadingSlots.set(false);
    }
  }

  async confirm(): Promise<void> {
    const current = this.repair();
    const date = this.bookingDate();
    const time = this.bookingTime();
    if (!current || !date || !time) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.bookingService.rescheduleRepair(current.id, date, time);
      this.done.emit(updated);
      this.isOpen.set(false);
    } catch (error) {
      this.error.set(bookingErrorMessage(error));
      if (error instanceof BookingError && error.code === 'SLOT_TAKEN') {
        await this.loadSlots();
      }
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.isOpen.set(false);
  }
}
