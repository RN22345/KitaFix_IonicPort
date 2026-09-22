import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { bookingErrorMessage } from '../../models/booking-error';
import { Repair, formatBookingDate } from '../../models/repair.model';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';
import { RescheduleModalComponent } from '../../ui/reschedule-modal/reschedule-modal.component';

type RepairFilter = 'all' | 'active' | 'history';

@Component({
  selector: 'app-my-repairs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent,
    IonHeader,
    IonIcon,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RepairCardComponent,
    RescheduleModalComponent,
  ],
  templateUrl: './my-repairs.page.html',
  styleUrl: './my-repairs.page.scss',
})
export class MyRepairsPage implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly repairs = this.booking.myRepairs;
  readonly loading = this.booking.loading;
  readonly error = this.booking.error;
  readonly filter = signal<RepairFilter>('all');
  readonly rescheduleOpen = signal(false);
  readonly selectedRepair = signal<Repair | null>(null);

  readonly visibleRepairs = computed(() => {
    const filter = this.filter();
    return this.repairs().filter((repair) => {
      if (filter === 'active') {
        return (
          repair.status === 'pending' ||
          repair.status === 'in_progress' ||
          repair.status === 'testing'
        );
      }
      if (filter === 'history') {
        return repair.status === 'completed' || repair.status === 'cancelled';
      }
      return true;
    });
  });

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  onFilterChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: RepairFilter }>).detail?.value;
    if (value) {
      this.filter.set(value);
    }
  }

  async refresh(event: Event): Promise<void> {
    await this.booking.refreshMyRepairs();
    const refresher = event.target as { complete?: () => Promise<void> } | null;
    await refresher?.complete?.();
  }

  async confirmCancel(repair: Repair): Promise<void> {
    const alert = await this.alert.create({
      header: 'Cancel booking',
      message: `Cancel ${repair.device_brand} ${repair.device_model} on ${formatBookingDate(
        repair.booking_date,
      )}? This cannot be undone.`,
      buttons: [
        { text: 'Keep booking', role: 'cancel' },
        {
          text: 'Yes, cancel',
          role: 'destructive',
          handler: () => {
            void this.doCancel(repair);
          },
        },
      ],
    });
    await alert.present();
  }

  openReschedule(repair: Repair): void {
    this.selectedRepair.set(repair);
    this.rescheduleOpen.set(true);
  }

  onRescheduled(): void {
    this.rescheduleOpen.set(false);
  }

  private async doCancel(repair: Repair): Promise<void> {
    try {
      await this.booking.cancelRepair(repair.id);
      await this.showToast('Booking cancelled.', 'success');
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2500,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
