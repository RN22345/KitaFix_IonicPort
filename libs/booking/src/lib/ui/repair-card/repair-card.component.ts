import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon } from '@ionic/angular';
import {
  Repair,
  canCustomerCancel,
  canCustomerReschedule,
  formatBookingDate,
  formatTime,
  problemSummary,
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
        <div class="detail problem">
          <ion-icon name="construct-outline"></ion-icon>
          <span>{{ problem() }}</span>
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
      :host {
        --blueDark: #0B5ED7;
        --blueLight: #2E7DFF;
        --greenDark: #00C896;
        --greenLight: #7EE787;
        --gray: #E6F1FF;
        --blackish: #0F172A;
      }
      .seeRepair-button {
        color: var(--blueDark);
        font-weight: bold;
      }
      ion-card {
        margin: 0 0 0.85rem;
        border-radius: 14px;
        background-color: var(--gray);
      }
      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      ion-card-title {
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--blueDark);
      }
      ion-card-subtitle {
        color: var(--blackish);
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.15rem 0;
        color: var(--blackish);
        font-size: 0.92rem;
      }
      /* The problem text can be several lines: keep the icon at the top and clamp to 3 lines. */
      .problem {
        align-items: flex-start;
      }
      .problem ion-icon {
        flex: none;
        margin-top: 0.15rem;
      }
      .problem span {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;
        overflow-wrap: anywhere;
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
  /** Customer's description, or the ticked issue labels for older bookings. */
  readonly problem = computed(() => problemSummary(this.repair()));
  readonly dateLabel = computed(() => formatBookingDate(this.repair().booking_date));
  readonly timeLabel = computed(() => formatTime(this.repair().booking_time));
  readonly shortId = computed(() => shortRepairId(this.repair().id));
}