import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  ActionSheetController, AlertController, IonButton, IonCard, IonCardContent, IonContent,
  IonHeader, IonNote, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton,
  IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import {
  StatusBadgeComponent, formatBookingDate, formatTime, issueLabels, shortRepairId, statusMeta,
} from '@kitafix/booking';
import { RepairStatus } from '@kitafix/shared-types';
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
  template: `
    <ion-header>
      <ion-toolbar color="primary"><ion-title>Repair Queue</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-segment [value]="filter()" (ionChange)="onFilter($event)">
        <ion-segment-button value="all">All</ion-segment-button>
        <ion-segment-button value="waiting">Waiting for repair</ion-segment-button>
        <ion-segment-button value="processed">Already processed</ion-segment-button>
      </ion-segment>

      @if (error(); as message) {
        <ion-note color="danger">{{ message }}</ion-note>
      }

      @if (loading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        @for (repair of visible(); track repair.id) {
          <ion-card>
            <ion-card-content>
              <div class="head">
                <strong>{{ id(repair.id) }}</strong>
                <app-status-badge [status]="repair.status"></app-status-badge>
              </div>
              <div class="customer">{{ repair.customer_name }}</div>
              <ion-note>
                {{ repair.device_brand }} {{ repair.device_model }} · {{ repair.service_name }}
              </ion-note>
              <p class="issues">Issues: {{ issues(repair) }}</p>
              <p class="meta">
                {{ date(repair.booking_date) }}, {{ time(repair.booking_time) }} ·
                Technician: {{ repair.technician_name ?? 'Unassigned' }}
              </p>
              <div class="actions">
                <ion-button size="small" color="success" [disabled]="!canConfirm(repair)" (click)="confirm(repair)">
                  {{ confirmed(repair) ? 'Confirmed' : 'Confirm' }}
                </ion-button>
                <ion-button size="small" fill="outline" [disabled]="finished(repair)" (click)="assign(repair)">
                  {{ repair.technician_id ? 'Change technician' : 'Assign technician' }}
                </ion-button>
                <ion-button size="small" fill="outline" [disabled]="finished(repair)" (click)="changeStatus(repair)">
                  Update status
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        } @empty {
          <p class="empty">No repairs match this filter.</p>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .head { display: flex; justify-content: space-between; align-items: center; }
      .customer { font-size: 1.05rem; font-weight: 600; margin-top: 4px; }
      .issues, .meta { margin: 6px 0 0; font-size: 0.85rem; }
      .actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
      .center { display: flex; justify-content: center; padding: 24px; }
      .empty { text-align: center; color: var(--ion-color-medium); padding: 24px; }
    `,
  ],
})
export class RepairQueuePage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly alerts = inject(AlertController);
  private readonly sheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);

  readonly visible = this.ops.visible;
  readonly filter = this.ops.filter;
  readonly loading = this.ops.loading;
  readonly error = this.ops.error;
  readonly id = shortRepairId;
  readonly date = formatBookingDate;
  readonly time = formatTime;

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
    const sheet = await this.sheets.create({
      header: `Update ${shortRepairId(repair.id)}`,
      subHeader: `Now: ${statusMeta(repair.status).label}`,
      buttons: [
        ...nextStatuses(repair.status).map((to: RepairStatus) => ({
          text: statusMeta(to).label,
          role: to === 'cancelled' ? 'destructive' : undefined,
          handler: () => {
            void this.run(
              () => this.ops.changeStatus(repair, to),
              `${shortRepairId(repair.id)} is now ${statusMeta(to).label}`,
            );
          },
        })),
        { text: 'Close', role: 'cancel' },
      ],
    });
    await sheet.present();
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
