import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonNote, IonRefresher,
  IonRefresherContent, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import {
  StatusBadgeComponent, formatBookingDate, formatTime, issueLabels, shortRepairId,
} from '@kitafix/booking';
import { QueueFilter, QueueRepair } from '../../models/repair-ops.model';
import { RepairOpsService } from '../../services/repair-ops.service';

/** Screen 1 - Admin Portal: summary cards + the latest repairs. */
@Component({
  selector: 'app-admin-portal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonNote, IonRefresher,
    IonRefresherContent, IonSpinner, IonTitle, IonToolbar, StatusBadgeComponent,
  ],
  templateUrl: './admin-portal.page.html',
  styleUrl: './admin-portal.page.scss',
})
export class AdminPortalPage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly router = inject(Router);

  readonly counts = this.ops.counts;
  readonly loading = this.ops.loading;
  readonly error = this.ops.error;
  readonly expandedRepairIds = signal<Set<string>>(new Set());
  readonly id = shortRepairId;
  readonly date = formatBookingDate;
  readonly time = formatTime;

  issues(repair: QueueRepair): string {
    return issueLabels(repair).join(', ') || '-';
  }

  dateTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  toggleDetails(repairId: string): void {
    this.expandedRepairIds.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(repairId)) next.delete(repairId);
      else next.add(repairId);
      return next;
    });
  }

  latest() {
    return this.ops.repairs().slice(0, 5);
  }

  ngOnInit(): void {
    void this.ops.ensureLoaded();
  }

  open(filter: QueueFilter): void {
    this.ops.filter.set(filter);
    void this.router.navigate(['/tabs/repair-queue']);
  }

  async refresh(event: Event): Promise<void> {
    await this.ops.load();
    (event as CustomEvent).detail.complete();
  }
}
