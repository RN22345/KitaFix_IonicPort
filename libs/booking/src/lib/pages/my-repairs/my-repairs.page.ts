import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  ToastController,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { bookingErrorMessage } from '../../models/booking-error';
import {
  Repair,
  formatBookingDate,
  problemSummary,
  shortRepairId,
  statusMeta,
} from '../../models/repair.model';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';
import { RescheduleModalComponent } from '../../ui/reschedule-modal/reschedule-modal.component';

type RepairFilter = 'all' | 'active' | 'history';

@Component({
  selector: 'app-my-repairs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
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
  private readonly router = inject(Router);

  readonly repairs = this.booking.myRepairs;
  readonly loading = this.booking.loading;
  readonly error = this.booking.error;
  readonly filter = signal<RepairFilter>('all');
  readonly rescheduleOpen = signal(false);
  readonly selectedRepair = signal<Repair | null>(null);

  readonly skeletons = [1, 2, 3];
  readonly search = this.booking.searchTerm;

  private static isActive(repair: Repair): boolean {
    return (
      repair.status === 'pending' || repair.status === 'in_progress' || repair.status === 'testing'
    );
  }

  readonly counts = computed(() => {
    const all = this.repairs();
    const active = all.filter((repair) => MyRepairsPage.isActive(repair)).length;
    return { all: all.length, active, history: all.length - active };
  });

  readonly visibleRepairs = computed(() => {
    const filter = this.filter();
    const term = this.search().trim().toLowerCase();
    return this.repairs().filter((repair) => {
      if (filter === 'active' && !MyRepairsPage.isActive(repair)) {
        return false;
      }
      if (filter === 'history' && MyRepairsPage.isActive(repair)) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        repair.device_brand,
        repair.device_model,
        repair.location,
        shortRepairId(repair.id),
        problemSummary(repair),
        statusMeta(repair.status).label,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  ionViewWillLeave(): void {
    // The dashboard search hands its text over once; clear it when leaving this tab.
    this.search.set('');
  }

  onFilterChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: RepairFilter }>).detail?.value;
    if (value) {
      this.filter.set(value);
    }
  }

  onSearch(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value;
    this.search.set(value ?? '');
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  goToNewBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  /** Starts a new booking with the same device (and service/place) already filled in. */
  bookAgain(repair: Repair): void {
    void this.router.navigate(['/tabs/new-booking'], {
      queryParams: {
        brand: repair.device_brand,
        model: repair.device_model,
        service: repair.service_id,
        location: repair.location,
      },
    });
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
