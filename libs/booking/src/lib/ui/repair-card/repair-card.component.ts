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
  statusMeta,
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

      @if (progressStep() > 0) {
        <ol class="progress" [attr.aria-label]="'Progress: ' + statusLabel()">
          @for (label of progressLabels; track label; let i = $index) {
            <li [class.done]="i < progressStep()" [class.current]="i === progressStep() - 1">
              <span class="bar"></span>
              <span class="step-label">{{ label }}</span>
            </li>
          }
        </ol>
      }

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
        --stripe: var(--kf-muted);
      }
      :host([data-status='pending']) {
        --stripe: var(--kf-warn);
      }
      :host([data-status='in_progress']),
      :host([data-status='testing']) {
        --stripe: var(--kf-accent);
      }
      :host([data-status='completed']) {
        --stripe: var(--kf-green);
      }
      .card {
        position: relative;
        padding: 0.95rem 1rem 0.9rem 1.2rem;
        border-radius: 16px;
        background: var(--kf-surface);
        border: 1px solid var(--kf-line);
        box-shadow: var(--kf-shadow);
        overflow: hidden;
      }
      .card::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: var(--stripe);
      }
      .card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .title-wrap {
        min-width: 0;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--kf-text);
        overflow-wrap: anywhere;
      }
      .repair-id {
        font-size: 0.78rem;
        color: var(--kf-muted);
      }
      .progress {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        list-style: none;
        margin: 0.2rem 0 0.7rem;
        padding: 0;
      }
      .progress li {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .progress .bar {
        height: 4px;
        border-radius: 999px;
        background: var(--kf-surface-2);
      }
      .progress li.done .bar {
        background: var(--kf-accent);
      }
      .progress .step-label {
        font-size: 0.68rem;
        color: var(--kf-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .progress li.current .step-label {
        color: var(--kf-text);
        font-weight: 600;
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.15rem 0;
        color: var(--kf-text);
        opacity: 0.9;
        font-size: 0.9rem;
      }
      .detail ion-icon {
        color: var(--kf-accent);
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
        flex-wrap: wrap;
        gap: 0.5rem;
        padding-top: 0.7rem;
      }
      .actions ion-button {
        --border-radius: 999px;
        margin: 0;
        text-transform: none;
        letter-spacing: 0;
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
  /** Picked issue labels, then the customer's optional note. */
  readonly problem = computed(() => problemSummary(this.repair()));
  readonly dateLabel = computed(() => formatBookingDate(this.repair().booking_date));
  readonly timeLabel = computed(() => formatTime(this.repair().booking_time));
  readonly shortId = computed(() => shortRepairId(this.repair().id));

  /** Booked -> In repair -> Testing -> Ready; hidden for cancelled repairs. */
  readonly progressLabels = ['Booked', 'In repair', 'Testing', 'Ready'] as const;
  readonly progressStep = computed(() => statusMeta(this.repair().status).step);
  readonly statusLabel = computed(() => statusMeta(this.repair().status).label);
}