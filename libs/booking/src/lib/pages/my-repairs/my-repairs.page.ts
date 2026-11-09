import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  ToastController,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { bookingErrorMessage } from '../../models/booking-error';
import {
  Repair,
  formatBookingDate,
  isActiveRepair,
  problemSummary,
  shortRepairId,
  statusMeta,
} from '../../models/repair.model';
import { RepairExtrasService } from '../../services/repair-extras.service';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';
import { RepairDetailComponent } from '../../ui/repair-detail/repair-detail.component';
import { RescheduleModalComponent } from '../../ui/reschedule-modal/reschedule-modal.component';

type RepairFilter = 'active' | 'favorites' | 'done' | 'cancelled' | 'all';

interface RepairTab {
  key: RepairFilter;
  label: string;
  icon: string;
}

/** Same device = same brand + model (case and spacing ignored). */
function deviceKey(repair: Repair): string {
  return `${repair.device_brand.trim()}|${repair.device_model.trim()}`.toLowerCase().replace(/\s+/g, ' ');
}

@Component({
  selector: 'app-my-repairs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent,
    IonIcon,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSkeletonText,
    RepairCardComponent,
    RepairDetailComponent,
    RescheduleModalComponent,
  ],
  templateUrl: './my-repairs.page.html',
  styleUrl: './my-repairs.page.scss',
})
export class MyRepairsPage implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly extras = inject(RepairExtrasService);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  readonly repairs = this.booking.myRepairs;
  readonly bookingsLeft = this.booking.bookingsLeft;
  readonly maxActive = this.booking.maxActiveBookings;
  readonly loading = this.booking.loading;
  readonly error = this.booking.error;
  readonly search = this.booking.searchTerm;

  readonly tabs: RepairTab[] = [
    { key: 'active', label: 'Active', icon: 'construct-outline' },
    { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
    { key: 'done', label: 'Done', icon: 'checkmark-circle-outline' },
    { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
    { key: 'all', label: 'All', icon: 'list-outline' },
  ];

  /** Picked by the customer; until then Active, or All when nothing is active. */
  private readonly pickedFilter = signal<RepairFilter | null>(null);
  readonly filter = computed<RepairFilter>(
    () => this.pickedFilter() ?? (this.counts().active > 0 || this.counts().all === 0 ? 'active' : 'all'),
  );

  readonly rescheduleOpen = signal(false);
  readonly selectedRepair = signal<Repair | null>(null);
  readonly detailOpen = signal(false);
  readonly detailRepair = signal<Repair | null>(null);

  readonly skeletons = [1, 2, 3];

  readonly counts = computed(() => {
    const all = this.repairs();
    return {
      all: all.length,
      active: all.filter((repair) => isActiveRepair(repair)).length,
      cancelled: all.filter((repair) => repair.status === 'cancelled').length,
      done: all.filter((repair) => repair.status === 'completed').length,
      favorites: all.filter((repair) => this.extras.isFavorite(repair.id)).length,
    };
  });

  readonly visibleRepairs = computed(() => {
    const filter = this.filter();
    const term = this.search().trim().toLowerCase();
    return this.repairs().filter((repair) => {
      if (filter === 'active' && !isActiveRepair(repair)) return false;
      if (filter === 'cancelled' && repair.status !== 'cancelled') return false;
      if (filter === 'done' && repair.status !== 'completed') return false;
      if (filter === 'favorites' && !this.extras.isFavorite(repair.id)) return false;
      if (!term) return true;
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

  /** The live copy of the repair shown in the details sheet (stays fresh after changes). */
  readonly liveDetail = computed(() => {
    const picked = this.detailRepair();
    return picked ? (this.repairs().find((repair) => repair.id === picked.id) ?? picked) : null;
  });
  readonly detailBlock = computed(() => {
    const repair = this.liveDetail();
    return repair ? this.blockReason(repair) : '';
  });

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  pick(filter: RepairFilter): void {
    this.pickedFilter.set(filter);
  }

  countOf(filter: RepairFilter): number {
    return this.counts()[filter];
  }

  onSearch(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value;
    this.search.set(value ?? '');
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  goToNewBooking(): void {
    if (this.bookingsLeft() === 0) {
      void this.showToast(`You already have ${this.maxActive} active repairs. Finish or cancel one first.`, 'warning');
      return;
    }
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  openDetail(repair: Repair): void {
    this.detailRepair.set(repair);
    this.detailOpen.set(true);
  }

  /**
   * Why a repair cannot be booked again (empty text = allowed):
   * still in the shop, same device already booked, or the active limit is reached.
   */
  blockReason(repair: Repair): string {
    if (isActiveRepair(repair)) {
      return 'This repair is still in progress. You can book again once it is finished.';
    }
    const key = deviceKey(repair);
    const sameDeviceActive = this.repairs().some(
      (other) => other.id !== repair.id && isActiveRepair(other) && deviceKey(other) === key,
    );
    if (sameDeviceActive) {
      return 'This device already has an active booking. Wait for it to finish or cancel it first.';
    }
    if (this.bookingsLeft() === 0) {
      return `You have ${this.maxActive} active repairs, the most at once. Finish or cancel one first.`;
    }
    return '';
  }

  /** Starts a new booking with the same device (and service/place) already filled in. */
  bookAgain(repair: Repair): void {
    const reason = this.blockReason(repair);
    if (reason) {
      void this.showToast(reason, 'warning');
      return;
    }
    this.detailOpen.set(false);
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

  /** Severe warning: the customer must tick the box before the cancel goes through. */
  async confirmCancel(repair: Repair): Promise<void> {
    const alert = await this.alert.create({
      cssClass: 'kf-danger-alert',
      header: 'Warning: cancel this repair?',
      subHeader: `${repair.device_brand} ${repair.device_model} - ${formatBookingDate(repair.booking_date)}`,
      message:
        'This action is <b>permanent and cannot be undone</b>.<br><br>' +
        '- Your booked slot is released right away and may be taken by someone else.<br>' +
        '- A repair that already started will be stopped.<br>' +
        '- You will have to book again from the start.',
      inputs: [
        {
          type: 'checkbox',
          label: 'I understand this cannot be undone',
          value: 'ack',
          checked: false,
        },
      ],
      buttons: [
        { text: 'Keep my booking', role: 'cancel', cssClass: 'kf-keep' },
        {
          text: 'Yes, cancel repair',
          role: 'destructive',
          cssClass: 'kf-destroy',
          handler: (value: unknown) => {
            const accepted = Array.isArray(value) ? value.includes('ack') : !!value;
            if (!accepted) {
              void this.showToast('Please tick the box to confirm.', 'warning');
              return false;
            }
            void this.doCancel(repair);
            return true;
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

  /** From the details sheet: close it first, then continue with the same flows. */
  cancelFromDetail(repair: Repair): void {
    this.detailOpen.set(false);
    void this.confirmCancel(repair);
  }

  rescheduleFromDetail(repair: Repair): void {
    this.detailOpen.set(false);
    this.openReschedule(repair);
  }

  private async doCancel(repair: Repair): Promise<void> {
    try {
      await this.booking.cancelRepair(repair.id);
      await this.showToast('Booking cancelled.', 'success');
    } catch (error) {
      await this.showToast(bookingErrorMessage(error), 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2800,
      color,
      position: 'top',
    });
    await toast.present();
  }
}