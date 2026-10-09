import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, phonePortraitOutline, refreshOutline } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, IonSkeletonText } from '@ionic/angular';
import { Repair, formatBookingDate, statusMeta } from '../../models/repair.model';
import { RepairsService } from '../../services/repairs.service';

interface DeviceSummary {
  key: string;
  brand: string;
  model: string;
  visits: number;
  lastRepair: Repair;
}

/**
 * "My Devices": every phone/tablet the customer has brought in, built from their
 * own repair history (no extra table - the booking rows already hold brand + model).
 */
@Component({
  selector: 'app-my-devices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonContent, IonIcon, IonSkeletonText],
  templateUrl: './my-devices.page.html',
  styleUrl: './my-devices.page.scss',
})
export class MyDevicesPage implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly router = inject(Router);

  readonly loading = this.booking.loading;
  readonly error = this.booking.error;

  readonly devices = computed<DeviceSummary[]>(() => {
    const byKey = new Map<string, DeviceSummary>();
    for (const repair of this.booking.myRepairs()) {
      const key = `${repair.device_brand}|${repair.device_model}`.trim().toLowerCase();
      const found = byKey.get(key);
      if (!found) {
        byKey.set(key, {
          key,
          brand: repair.device_brand,
          model: repair.device_model,
          visits: 1,
          lastRepair: repair,
        });
        continue;
      }
      found.visits += 1;
      if (this.isNewer(repair, found.lastRepair)) {
        found.lastRepair = repair;
      }
    }
    return [...byKey.values()].sort((a, b) => b.lastRepair.created_at.localeCompare(a.lastRepair.created_at));
  });

  constructor() {
    addIcons({ arrowBackOutline, phonePortraitOutline, refreshOutline });
  }

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  lastVisit(device: DeviceSummary): string {
    return `${formatBookingDate(device.lastRepair.booking_date)} - ${statusMeta(device.lastRepair.status).label}`;
  }

  bookAgain(device: DeviceSummary): void {
    void this.router.navigate(['/tabs/new-booking'], {
      queryParams: {
        brand: device.brand,
        model: device.model,
        service: device.lastRepair.service_id,
        location: device.lastRepair.location,
      },
    });
  }

  newBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  back(): void {
    void this.router.navigateByUrl('/tabs/dashboard');
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  private isNewer(a: Repair, b: Repair): boolean {
    return a.created_at.localeCompare(b.created_at) > 0;
  }
}
