import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
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
    IonIcon,
    StatusBadgeComponent,
  ],
  host: { '[attr.data-status]': 'repair().status' },
  template: `
    <article class="card">
      <header class="card-top">
        <div class="title-wrap">
          <h3>{{ repair().device_brand }} {{ repair().device_model }}</h3>
          <span class="repair-id">{{ shortId() }}</span>
        </div>
        <app-status-badge [status]="repair().status"></app-status-badge>
      </header>

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
          @if (isFinished()) {
            <ion-button size="small" fill="outline" (click)="bookAgain.emit(repair())">
              <ion-icon slot="start" name="refresh-outline"></ion-icon>
              Book again
            </ion-button>
          } @else {
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
          }
        </div>
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        margin: 0 0 0.85rem;
        --stripe: var(--ion-color-medium, #92949c);
      }
      :host([data-status='pending']) {
        --stripe: #f5a524;
      }
      :host([data-status='in_progress']),
      :host([data-status='testing']) {
        --stripe: #2e7dff;
      }
      :host([data-status='completed']) {
        --stripe: #00c896;
      }
      :host([data-status='cancelled']) {
        --stripe: #b4bccb;
      }
      .card {
        position: relative;
        padding: 0.95rem 1rem 0.9rem 1.2rem;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 2px 12px rgba(15, 23, 42, 0.07);
        overflow: hidden;
      }
      .card::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 5px;
        background: var(--stripe);
      }
      .card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.4rem;
      }
      .title-wrap {
        min-width: 0;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: #0f172a;
        overflow-wrap: anywhere;
      }
      .repair-id {
        font-size: 0.78rem;
        color: #7b8aa3;
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.15rem 0;
        color: #334155;
        font-size: 0.9rem;
      }
      .detail ion-icon {
        color: #0b5ed7;
        flex: none;
      }
      /* The problem text can be several lines: keep the icon at the top and clamp to 3 lines. */
      .problem {
        align-items: flex-start;
      }
      .problem ion-icon {
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
        padding-top: 0.7rem;
      }
      .actions ion-button {
        --border-radius: 999px;
        margin: 0;
      }
    `,
  ],
})
export class RepairCardComponent {
  readonly repair = input.required<Repair>();
  readonly showActions = input(false);

  readonly reschedule = output<Repair>();
  readonly cancel = output<Repair>();
  readonly bookAgain = output<Repair>();

  readonly isFinished = computed(
    () => this.repair().status === 'completed' || this.repair().status === 'cancelled',
  );
  readonly canCancel = computed(() => canCustomerCancel(this.repair()));
  readonly canReschedule = computed(() => canCustomerReschedule(this.repair()));
  /** Customer's description, or the ticked issue labels for older bookings. */
  readonly problem = computed(() => problemSummary(this.repair()));
  readonly dateLabel = computed(() => formatBookingDate(this.repair().booking_date));
  readonly timeLabel = computed(() => formatTime(this.repair().booking_time));
  readonly shortId = computed(() => shortRepairId(this.repair().id));
}