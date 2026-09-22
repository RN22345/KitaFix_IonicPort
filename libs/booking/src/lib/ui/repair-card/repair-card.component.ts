import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon } from '@ionic/angular';
import {
  Repair,
  canCustomerCancel,
  canCustomerReschedule,
  formatBookingDate,
  formatTime,
  issueLabels,
  shortRepairId,
} from '../../models/repair.model';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-repair-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
    StatusBadgeComponent,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <div class="card-top">
          <ion-card-title>{{ repair().device_brand }} {{ repair().device_model }}</ion-card-title>
          <app-status-badge [status]="repair().status"></app-status-badge>
        </div>
        <ion-card-subtitle>{{ shortId() }}</ion-card-subtitle>
      </ion-card-header>

      <ion-card-content>
        <div class="detail">
          <ion-icon name="calendar-outline"></ion-icon>
          <span>{{ dateLabel() }} at {{ timeLabel() }}</span>
        </div>
        <div class="detail">
          <ion-icon name="location-outline"></ion-icon>
          <span>{{ repair().location }}</span>
        </div>
        <div class="detail">
          <ion-icon name="construct-outline"></ion-icon>
          <span>{{ issues().join(', ') }}</span>
        </div>

        @if (showActions()) {
          <div class="actions">
            <ion-button
              size="small"
              fill="outline"
              [disabled]="!canReschedule()"
              (click)="reschedule.emit(repair())"
            >
              <ion-icon slot="start" name="create-outline"></ion-icon>
              Reschedule
            </ion-button>
            <ion-button
              size="small"
              fill="outline"
              color="danger"
              [disabled]="!canCancel()"
              (click)="cancel.emit(repair())"
            >
              <ion-icon slot="start" name="close-circle-outline"></ion-icon>
              Cancel
            </ion-button>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      ion-card {
        margin: 0 0 0.85rem;
        border-radius: 14px;
      }
      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      ion-card-title {
        font-size: 1.05rem;
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.15rem 0;
        color: var(--ion-color-step-600, #666);
        font-size: 0.92rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.75rem;
      }
    `,
  ],
})
export class RepairCardComponent {
  readonly repair = input.required<Repair>();
  readonly showActions = input(false);

  readonly reschedule = output<Repair>();
  readonly cancel = output<Repair>();

  readonly canCancel = computed(() => canCustomerCancel(this.repair()));
  readonly canReschedule = computed(() => canCustomerReschedule(this.repair()));
  readonly issues = computed(() => issueLabels(this.repair()));
  readonly dateLabel = computed(() => formatBookingDate(this.repair().booking_date));
  readonly timeLabel = computed(() => formatTime(this.repair().booking_time));
  readonly shortId = computed(() => shortRepairId(this.repair().id));
}
