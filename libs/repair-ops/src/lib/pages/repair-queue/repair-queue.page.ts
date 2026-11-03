import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AlertController, IonButton, IonCard, IonCardContent, IonContent,
  IonHeader, IonNote, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton,
  IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import {
  StatusBadgeComponent, formatBookingDate, formatTime, issueLabels, shortRepairId, statusMeta,
} from '@kitafix/booking';
import { repairOpsErrorMessage } from '../../models/repair-ops-error';
import { QueueFilter, QueueRepair, isConfirmed, nextStatuses } from '../../models/repair-ops.model';
import { RepairOpsService } from '../../services/repair-ops.service';

/** Screen 2 - Repair Queue: list + filters + confirm / status / technician. */
@Component({
  selector: 'app-repair-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonNote, IonRefresher,
    IonRefresherContent, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar,
    StatusBadgeComponent,
  ],
  templateUrl: './repair-queue.page.html',
  styleUrl: './repair-queue.page.scss',
})
export class RepairQueuePage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly visible = this.ops.visible;
  readonly filter = this.ops.filter;
  readonly loading = this.ops.loading;
  readonly error = this.ops.error;
  readonly expandedRepairIds = signal<Set<string>>(new Set());
  readonly id = shortRepairId;
  readonly date = formatBookingDate;
  readonly time = formatTime;

  toggleDetails(repairId: string): void {
    this.expandedRepairIds.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(repairId)) next.delete(repairId);
      else next.add(repairId);
      return next;
    });
  }

  dateTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  ngOnInit(): void {
    void this.ops.ensureLoaded();
  }

  issues(repair: QueueRepair): string {
    return issueLabels(repair).join(', ') || '-';
  }

  confirmed = isConfirmed;
  finished(repair: QueueRepair): boolean {
    return nextStatuses(repair.status).length === 0;
  }
  canConfirm(repair: QueueRepair): boolean {
    return repair.status === 'pending' && !isConfirmed(repair);
  }

  onFilter(event: Event): void {
    this.ops.filter.set((event as CustomEvent).detail.value as QueueFilter);
  }

  async refresh(event: Event): Promise<void> {
    await this.ops.load();
    (event as CustomEvent).detail.complete();
  }

  async confirm(repair: QueueRepair): Promise<void> {
    await this.run(() => this.ops.confirm(repair), `${shortRepairId(repair.id)} confirmed`);
  }

  async changeStatus(repair: QueueRepair): Promise<void> {
    const statuses = nextStatuses(repair.status);
    if (statuses.length === 0) return;

    const alert = await this.alerts.create({
      header: `Update ${shortRepairId(repair.id)}`,
      message: `Current status: ${statusMeta(repair.status).label}`,
      inputs: statuses.map((to) => ({
        type: 'radio' as const,
        label: statusMeta(to).label,
        value: to,
      })),
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Update', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    const selected = statuses.find((status) => status === data?.values);
    if (role !== 'confirm' || !selected) return;

    await this.run(
      () => this.ops.changeStatus(repair, selected),
      `${shortRepairId(repair.id)} is now ${statusMeta(selected).label}`,
    );
  }

  async assign(repair: QueueRepair): Promise<void> {
    let technicians;
    try {
      technicians = await this.ops.listTechnicians();
    } catch (error) {
      return this.say(repairOpsErrorMessage(error), true);
    }
    if (technicians.length === 0) return this.say('No active technicians available.', true);

    const alert = await this.alerts.create({
      header: repair.technician_id ? 'Change technician' : 'Assign technician',
      inputs: technicians.map((t) => ({
        type: 'radio' as const,
        label: t.full_name,
        value: t.id,
        checked: t.id === repair.technician_id,
      })),
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    const chosen = technicians.find((t) => t.id === data?.values);
    if (role !== 'confirm' || !chosen) return;
    await this.run(
      () => this.ops.assignTechnician(repair, chosen),
      `${chosen.full_name} assigned to ${shortRepairId(repair.id)}`,
    );
  }

  private async run(action: () => Promise<void>, success: string): Promise<void> {
    try {
      await action();
      await this.say(success);
    } catch (error) {
      await this.say(repairOpsErrorMessage(error), true);
    }
  }

  private async say(message: string, isError = false): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: 2500,
      color: isError ? 'danger' : 'success',
      position: 'bottom',
    });
    await toast.present();
  }
}
