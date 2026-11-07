import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import {
  Repair,
  canCustomerCancel,
  canCustomerReschedule,
  formatBookingDate,
  formatTime,
  repairIssues,
  shortRepairId,
  statusMeta,
} from '../../models/repair.model';
import { RepairExtrasService } from '../../services/repair-extras.service';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-repair-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, StatusBadgeComponent],
  host: { '[attr.data-tone]': 'tone()' },
  template: `
    <article
      class="card"
      role="button"
      tabindex="0"
      [attr.aria-label]="'Open details for ' + repair().device_brand + ' ' + repair().device_model"
      (click)="open.emit(repair())"
      (keydown.enter)="open.emit(repair())"
    >
      <header class="card-top">
        <span class="device-tile"><ion-icon name="phone-portrait-outline"></ion-icon></span>
        <div class="title-wrap">
          <h3>{{ repair().device_brand }} {{ repair().device_model }}</h3>
          <span class="repair-id">{{ shortId() }}</span>
        </div>
        <button
          type="button"
          class="fav-btn"
          [class.on]="isFav()"
          [attr.aria-pressed]="isFav()"
          [attr.aria-label]="isFav() ? 'Remove from favourites' : 'Add to favourites'"
          (click)="$event.stopPropagation(); toggleFav()"
        >
          <ion-icon [name]="isFav() ? 'heart' : 'heart-outline'"></ion-icon>
        </button>
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

      <div class="meta">
        <span><ion-icon name="calendar-outline"></ion-icon>{{ dateLabel() }}, {{ timeLabel() }}</span>
        <span><ion-icon name="location-outline"></ion-icon>{{ repair().location }}</span>
      </div>

      @if (issues().length > 0) {
        <div class="issue-chips">
          @for (issue of issues(); track issue.key) {
            <span class="issue-chip" [attr.data-tone]="issue.tone">
              <ion-icon [name]="issue.icon"></ion-icon>
              {{ issue.label }}
            </span>
          }
        </div>
      }

      <footer class="foot">
        @if (rating() > 0) {
          <span class="stars" [attr.aria-label]="'Rated ' + rating() + ' out of 5'">
            @for (n of starList; track n) {
              <ion-icon [name]="n <= rating() ? 'star' : 'star-outline'"></ion-icon>
            }
          </span>
        } @else if (repair().status === 'completed') {
          <span class="view rate-me"><ion-icon name="star-outline"></ion-icon> Rate this repair</span>
        } @else {
          <span class="view">View details</span>
        }
        <span class="chev"><ion-icon name="chevron-forward-outline"></ion-icon></span>
      </footer>

      @if (showActions() && !isFinished()) {
        <div class="actions">
          <button
            type="button"
            class="act"
            [disabled]="!canReschedule()"
            [attr.title]="canReschedule() ? null : 'Only pending bookings can be rescheduled'"
            (click)="$event.stopPropagation(); reschedule.emit(repair())"
          >
            <ion-icon name="create-outline"></ion-icon> Reschedule
          </button>
          <button
            type="button"
            class="act danger"
            [disabled]="!canCancel()"
            [attr.title]="canCancel() ? null : 'Cancelling is closed once testing starts'"
            (click)="$event.stopPropagation(); cancel.emit(repair())"
          >
            <ion-icon name="close-circle-outline"></ion-icon> Cancel
          </button>
        </div>
      }
      @if (showActions() && isFinished()) {
        <div class="actions">
          <button
            type="button"
            class="act primary"
            [disabled]="!!bookAgainBlock()"
            (click)="$event.stopPropagation(); onBookAgain()"
          >
            <ion-icon name="refresh-outline"></ion-icon> Book again
          </button>
        </div>
        @if (bookAgainBlock()) {
          <p class="why"><ion-icon name="alert-circle-outline"></ion-icon>{{ bookAgainBlock() }}</p>
        }
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        margin: 0 0 0.9rem;
      }
      .card {
        position: relative;
        padding: 1rem 1rem 0.85rem 1.25rem;
        border-radius: 24px;
        background: var(--kf-surface);
        border: 1px solid var(--kf-line);
        box-shadow: var(--kf-shadow);
        overflow: hidden;
        cursor: pointer;
        outline: none;
        transition:
          transform var(--kf-fast) var(--kf-ease),
          box-shadow var(--kf-fast) var(--kf-ease),
          border-color var(--kf-fast);
      }
      .card:hover,
      .card:focus-visible {
        transform: translateY(-3px);
        box-shadow: var(--kf-shadow-lift);
        border-color: var(--tone);
      }
      .card:active {
        transform: scale(0.99);
      }
      .card::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 5px;
        background: var(--tone);
      }
      .card::after {
        content: '';
        position: absolute;
        top: -60px;
        right: -60px;
        width: 160px;
        height: 160px;
        border-radius: 50%;
        background: radial-gradient(circle, var(--tone-soft), transparent 70%);
        pointer-events: none;
      }
      .card-top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.7rem;
      }
      .device-tile {
        display: grid;
        place-items: center;
        flex: none;
        width: 46px;
        height: 46px;
        border-radius: 15px;
        background: var(--tone-soft);
        color: var(--tone);
        font-size: 1.4rem;
      }
      .title-wrap {
        flex: 1;
        min-width: 0;
      }
      h3 {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
        color: var(--kf-text);
        overflow-wrap: anywhere;
      }
      .repair-id {
        font-size: 0.76rem;
        color: var(--kf-muted);
      }
      .fav-btn {
        flex: none;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 1px solid var(--kf-line);
        border-radius: 50%;
        background: var(--kf-surface-2);
        color: var(--kf-muted);
        font-size: 1.05rem;
        cursor: pointer;
        transition:
          transform var(--kf-fast) var(--kf-ease),
          background var(--kf-fast),
          color var(--kf-fast);
      }
      .fav-btn:active {
        transform: scale(0.85);
      }
      .fav-btn.on {
        color: var(--kf-pink);
        border-color: var(--kf-pink);
        background: var(--kf-pink-soft);
      }
      .fav-btn.on ion-icon {
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      .progress {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 5px;
        list-style: none;
        margin: 0.1rem 0 0.75rem;
        padding: 0;
      }
      .progress li {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .progress .bar {
        position: relative;
        overflow: hidden;
        height: 6px;
        border-radius: 999px;
        background: var(--kf-surface-2);
      }
      .progress li.done .bar::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--tone);
        transform-origin: left;
        animation: fill 0.5s var(--kf-ease) backwards;
      }
      .progress li:nth-child(2) .bar::after { animation-delay: 0.12s; }
      .progress li:nth-child(3) .bar::after { animation-delay: 0.24s; }
      .progress li:nth-child(4) .bar::after { animation-delay: 0.36s; }
      @keyframes fill {
        from {
          transform: scaleX(0);
        }
      }
      .progress .step-label {
        font-size: 0.66rem;
        color: var(--kf-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .progress li.current .step-label {
        color: var(--kf-text);
        font-weight: 700;
      }
      .meta {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.84rem;
        color: var(--kf-text);
      }
      .meta span {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .meta ion-icon {
        color: var(--tone);
        flex: none;
      }
      .issue-chips {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.65rem;
      }
      .issue-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.22rem 0.6rem 0.22rem 0.45rem;
        border-radius: 999px;
        background: var(--tone-soft);
        color: var(--tone);
        font-size: 0.72rem;
        font-weight: 600;
      }
      .foot {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.75rem;
        padding-top: 0.65rem;
        border-top: 1px dashed var(--kf-line);
        font-size: 0.78rem;
      }
      .view {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: var(--kf-muted);
        font-weight: 500;
      }
      .rate-me {
        color: var(--kf-warn);
        font-weight: 700;
      }
      .stars {
        display: inline-flex;
        align-items: center;
        gap: 0.1rem;
        color: var(--kf-warn);
        font-size: 1rem;
      }
      .chev {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--tone-soft);
        color: var(--tone);
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .card:hover .chev {
        transform: translateX(3px);
      }
      .actions {
        position: relative;
        z-index: 1;
        display: flex;
        gap: 0.5rem;
        margin-top: 0.7rem;
      }
      .act {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--kf-line);
        border-radius: 14px;
        background: var(--kf-surface-2);
        color: var(--kf-text);
        font: 600 0.8rem var(--kf-font);
        cursor: pointer;
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .act:active {
        transform: scale(0.96);
      }
      .act.danger {
        color: var(--kf-danger);
      }
      .act.primary {
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        border-color: transparent;
        color: var(--kf-on-hero);
      }
      .act:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .why {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        gap: 0.4rem;
        margin: 0.55rem 0 0;
        font-size: 0.74rem;
        line-height: 1.35;
        color: var(--kf-muted);
      }
      .why ion-icon {
        flex: none;
        margin-top: 0.1rem;
        color: var(--kf-warn);
      }
    `,
  ],
})
export class RepairCardComponent {
  private readonly extras = inject(RepairExtrasService);

  readonly repair = input.required<Repair>();
  readonly showActions = input(false);
  /** Empty = "Book again" is allowed; otherwise the reason it is not. */
  readonly bookAgainBlock = input('');

  readonly open = output<Repair>();
  readonly reschedule = output<Repair>();
  readonly cancel = output<Repair>();
  readonly bookAgain = output<Repair>();

  readonly starList = [1, 2, 3, 4, 5];
  readonly isFinished = computed(
    () => this.repair().status === 'completed' || this.repair().status === 'cancelled',
  );
  readonly canCancel = computed(() => canCustomerCancel(this.repair()));
  readonly canReschedule = computed(() => canCustomerReschedule(this.repair()));
  readonly tone = computed(() => statusMeta(this.repair().status).tone);
  readonly issues = computed(() => repairIssues(this.repair()));
  readonly dateLabel = computed(() => formatBookingDate(this.repair().booking_date));
  readonly timeLabel = computed(() => formatTime(this.repair().booking_time));
  readonly shortId = computed(() => shortRepairId(this.repair().id));
  readonly isFav = computed(() => this.extras.isFavorite(this.repair().id));
  readonly rating = computed(() => this.extras.ratingOf(this.repair().id));

  /** Booked -> In repair -> Testing -> Ready; hidden for cancelled repairs. */
  readonly progressLabels = ['Booked', 'In repair', 'Testing', 'Ready'] as const;
  readonly progressStep = computed(() => statusMeta(this.repair().status).step);
  readonly statusLabel = computed(() => statusMeta(this.repair().status).label);

  toggleFav(): void {
    this.extras.toggleFavorite(this.repair().id);
  }

  onBookAgain(): void {
    if (!this.bookAgainBlock()) this.bookAgain.emit(this.repair());
  }
}