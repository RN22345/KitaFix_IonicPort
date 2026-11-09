import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { IonContent, IonFooter, IonHeader, IonIcon, IonModal } from '@ionic/angular';
import { BOOKING_CONFIG } from '../../data-access/config';
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
import { estimatePriceForRepair, formatCurrency } from '../../pricing/price-estimate';
import { RepairExtrasService } from '../../services/repair-extras.service';
import { RepairsService } from '../../services/repairs.service';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

@Component({
  selector: 'app-repair-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonFooter, IonHeader, IonIcon, IonModal, StatusBadgeComponent],
  template: `
    <ion-modal [isOpen]="isOpen()" (didDismiss)="onDismiss()" class="kf-detail">
      <ng-template>
        @if (repair(); as r) {
          <!-- Sticky: back button + favourite stay put while the sheet scrolls -->
          <ion-header class="ion-no-border">
            <div class="top">
              <div class="top-inner">
                <button type="button" class="round" (click)="onDismiss()" aria-label="Close details">
                  <ion-icon name="chevron-back-outline"></ion-icon>
                </button>
                <span class="top-title">Repair details</span>
                <button
                  type="button"
                  class="round heart"
                  [class.on]="fav()"
                  (click)="toggleFav()"
                  [attr.aria-pressed]="fav()"
                  [attr.aria-label]="fav() ? 'Remove from favourites' : 'Add to favourites'"
                >
                  <ion-icon [name]="fav() ? 'heart' : 'heart-outline'"></ion-icon>
                </button>
              </div>
            </div>
          </ion-header>

          <ion-content>
            <div class="sheet" [attr.data-tone]="tone()">
              <section class="hero">
                <div class="hero-row">
                  <span class="device"><ion-icon name="phone-portrait-outline"></ion-icon></span>
                  <div class="hero-title">
                    <h2>{{ r.device_brand }} {{ r.device_model }}</h2>
                    <span class="rid">{{ shortId() }}</span>
                  </div>
                  <app-status-badge [status]="r.status"></app-status-badge>
                </div>
                <div class="facts">
                  <div><ion-icon name="calendar-outline"></ion-icon><span>{{ dateLabel() }}</span></div>
                  <div><ion-icon name="time-outline"></ion-icon><span>{{ timeLabel() }}</span></div>
                  <div class="wide"><ion-icon name="storefront-outline"></ion-icon><span>{{ r.location }}</span></div>
                </div>

                @if (r.status === 'cancelled') {
                  <p class="banner"><ion-icon name="close-circle-outline"></ion-icon> This booking was cancelled.</p>
                } @else {
                  <ol class="track">
                    @for (label of steps; track label; let i = $index) {
                      <li [class.done]="i < step()" [class.current]="i === step() - 1">
                        <span class="dot">
                          @if (i < step()) {
                            <ion-icon name="checkmark-outline"></ion-icon>
                          }
                        </span>
                        <span class="lbl">{{ label }}</span>
                      </li>
                    }
                  </ol>
                }
              </section>

              <!-- Rating: only for completed repairs. Pick stars, then submit. -->
              @if (r.status === 'completed') {
                <section class="card rate">
                  <h3>Your rating</h3>
                  @if (editing()) {
                    <div class="stars" role="radiogroup" aria-label="Rate this repair from 1 to 5">
                      @for (n of starList; track n) {
                        <button
                          type="button"
                          class="star"
                          [class.on]="n <= draft()"
                          (click)="pick(n)"
                          role="radio"
                          [attr.aria-checked]="n === draft()"
                          [attr.aria-label]="n + ' star' + (n === 1 ? '' : 's')"
                        >
                          <ion-icon [name]="n <= draft() ? 'star' : 'star-outline'"></ion-icon>
                        </button>
                      }
                    </div>
                    <p class="hint">{{ draft() ? draftWord() : 'How was this repair? Tap a star, then submit.' }}</p>
                    <div class="rate-actions">
                      @if (saved() > 0) {
                        <button type="button" class="ghost" (click)="cancelEdit()">Cancel</button>
                      }
                      <button type="button" class="submit" [disabled]="draft() === 0" (click)="submitRating()">
                        <ion-icon name="checkmark-outline"></ion-icon> Submit rating
                      </button>
                    </div>
                  } @else {
                    <div class="stars done" [attr.aria-label]="'You rated ' + saved() + ' out of 5'">
                      @for (n of starList; track n) {
                        <span class="star static" [class.on]="n <= saved()">
                          <ion-icon [name]="n <= saved() ? 'star' : 'star-outline'"></ion-icon>
                        </span>
                      }
                    </div>
                    <p class="hint ok">
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                      {{ thanks() ? 'Thanks! ' : '' }}You rated this repair {{ savedWord() }} ({{ saved() }}/5).
                    </p>
                    <button type="button" class="link" (click)="editRating()">Edit rating</button>
                  }
                </section>
              } @else if (r.status !== 'cancelled') {
                <section class="card">
                  <h3>Your rating</h3>
                  <p class="hint"><ion-icon name="lock-closed-outline"></ion-icon> You can rate this repair once it is completed.</p>
                </section>
              }

              <!-- Repairman: the technician booked for this repair -->
              <section class="card">
                <h3>Repairman</h3>
                @if (technician(); as t) {
                  <div class="tech">
                    <span class="tech-avatar">{{ t.full_name.charAt(0) }}</span>
                    <div class="tech-main">
                      <strong>{{ t.full_name }}</strong>
                      <span class="tech-role">KitaFix Technician</span>
                    </div>
                    <span class="pill ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Assigned</span>
                  </div>
                  <dl class="info">
                    <div><dt>Handling</dt><dd>{{ r.device_brand }} {{ r.device_model }}</dd></div>
                    <div><dt>Branch</dt><dd>{{ r.location }}</dd></div>
                    <div><dt>Visit</dt><dd>{{ dateLabel() }}, {{ timeLabel() }}</dd></div>
                  </dl>
                  @if (t.skills.length > 0) {
                    <div class="chips">
                      @for (skill of t.skills; track skill) {
                        <span class="chip">{{ skill }}</span>
                      }
                    </div>
                  }
                } @else if (r.technician_id) {
                  <div class="tech">
                    <span class="tech-avatar"><ion-icon name="person-outline"></ion-icon></span>
                    <div class="tech-main">
                      <strong>Technician assigned</strong>
                      <span class="tech-role">KitaFix Technician</span>
                    </div>
                    <span class="pill ok"><ion-icon name="checkmark-circle-outline"></ion-icon> Assigned</span>
                  </div>
                } @else {
                  <div class="tech">
                    <span class="tech-avatar wait"><ion-icon name="hourglass-outline"></ion-icon></span>
                    <div class="tech-main">
                      <strong>Not assigned yet</strong>
                      <span class="tech-role">The shop will assign a technician</span>
                    </div>
                    <span class="pill"><ion-icon name="time-outline"></ion-icon> Waiting</span>
                  </div>
                }
              </section>

              <section class="card">
                <h3>Services availed</h3>
                @if (service(); as s) {
                  <div class="svc">
                    <span class="svc-ico"><ion-icon name="construct-outline"></ion-icon></span>
                    <div>
                      <strong>{{ s.name }}</strong>
                      @if (s.description) {
                        <span class="svc-desc">{{ s.description }}</span>
                      }
                    </div>
                  </div>
                }
                @if (issues().length > 0) {
                  <div class="chips">
                    @for (issue of issues(); track issue.key) {
                      <span class="chip tone" [attr.data-tone]="issue.tone">
                        <ion-icon [name]="issue.icon"></ion-icon> {{ issue.label }}
                      </span>
                    }
                  </div>
                }
                @if (note()) {
                  <p class="note">"{{ note() }}"</p>
                }
                @if (service(); as s) {
                  <dl class="price">
                    <div><dt>{{ s.name }}</dt><dd>{{ money(estimate().base) }}</dd></div>
                    @if (estimate().issueFees > 0) {
                      <div><dt>Extra bench fees</dt><dd>{{ money(estimate().issueFees) }}</dd></div>
                    }
                    <div class="total"><dt>Estimated total</dt><dd>{{ money(estimate().total) }}</dd></div>
                  </dl>
                } @else {
                  <p class="hint">The shop will confirm the final price after checking your device.</p>
                }
              </section>

              @if (canManage()) {
                <section class="manage">
                  <button type="button" class="ghost" [disabled]="!canReschedule()" (click)="reschedule.emit(r)">
                    <ion-icon name="create-outline"></ion-icon> Reschedule
                  </button>
                  <button type="button" class="ghost danger" [disabled]="!canCancel()" (click)="cancel.emit(r)">
                    <ion-icon name="close-circle-outline"></ion-icon> Cancel repair
                  </button>
                  @if (!canReschedule() || !canCancel()) {
                    <p class="hint wide-hint">
                      @if (!canReschedule()) {
                        Rescheduling is only for pending bookings.
                      }
                      @if (!canCancel()) {
                        Cancelling closes once testing starts.
                      }
                    </p>
                  }
                </section>
              }
            </div>
          </ion-content>

          <ion-footer class="ion-no-border">
            <div class="foot">
              <button type="button" class="again" [disabled]="!!blocked()" (click)="onBookAgain()">
                <ion-icon name="refresh-outline"></ion-icon> Book again
              </button>
              @if (blocked()) {
                <p class="why"><ion-icon name="alert-circle-outline"></ion-icon>{{ blocked() }}</p>
              }
            </div>
          </ion-footer>
        }
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      ion-header {
        position: relative;
        z-index: 10;
      }
      .top {
        padding: calc(env(safe-area-inset-top, 0px) + 0.6rem) 1rem 0.6rem;
        background: color-mix(in srgb, var(--kf-surface) 90%, transparent);
        backdrop-filter: blur(18px) saturate(1.5);
        -webkit-backdrop-filter: blur(18px) saturate(1.5);
        border-bottom: 1px solid var(--kf-line);
        font-family: var(--kf-font);
      }
      .top-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 640px;
        margin: 0 auto;
      }
      .top-title {
        font-weight: 700;
        font-size: 1rem;
        color: var(--kf-text);
      }
      .round {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 1px solid var(--kf-line);
        border-radius: 50%;
        background: var(--kf-surface-2);
        color: var(--kf-text);
        font-size: 1.3rem;
        cursor: pointer;
        box-shadow: var(--kf-shadow);
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .round:active {
        transform: scale(0.88);
      }
      .heart.on {
        color: var(--kf-pink);
        border-color: var(--kf-pink);
        background: var(--kf-pink-soft);
      }
      .heart.on ion-icon {
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      .sheet {
        padding: 0.9rem 1rem 1.5rem;
        font-family: var(--kf-font);
        color: var(--kf-text);
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        max-width: 640px;
        margin: 0 auto;
      }
      .hero,
      .card {
        padding: 1rem;
        border: 1px solid var(--kf-line);
        border-radius: 24px;
        background: var(--kf-surface);
        box-shadow: var(--kf-shadow);
        animation: kf-rise var(--kf-slow) var(--kf-ease) both;
      }
      .card:nth-of-type(2) { animation-delay: 60ms; }
      .card:nth-of-type(3) { animation-delay: 120ms; }
      .card:nth-of-type(4) { animation-delay: 180ms; }
      .hero {
        position: relative;
        overflow: hidden;
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 5px;
        background: var(--tone);
      }
      .hero::after {
        content: '';
        position: absolute;
        top: -70px;
        right: -60px;
        width: 190px;
        height: 190px;
        border-radius: 50%;
        background: radial-gradient(circle, var(--tone-soft), transparent 70%);
        pointer-events: none;
      }
      .hero-row {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .device {
        flex: none;
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: var(--tone-soft);
        color: var(--tone);
        font-size: 1.6rem;
      }
      .hero-title {
        flex: 1;
        min-width: 0;
      }
      h2 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .rid {
        font-size: 0.78rem;
        color: var(--kf-muted);
      }
      .facts {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        margin: 0.9rem 0 0.2rem;
      }
      .facts div {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.7rem;
        border-radius: 14px;
        background: var(--kf-surface-2);
        font-size: 0.82rem;
        font-weight: 500;
      }
      .facts .wide {
        grid-column: 1 / -1;
      }
      .facts ion-icon {
        color: var(--tone);
        font-size: 1.1rem;
        flex: none;
      }
      .banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0.8rem 0 0;
        padding: 0.65rem 0.8rem;
        border-radius: 14px;
        background: var(--kf-surface-2);
        color: var(--kf-muted);
        font-size: 0.82rem;
        font-weight: 600;
      }
      .track {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        list-style: none;
        margin: 1rem 0 0.1rem;
        padding: 0;
      }
      .track li {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.68rem;
        color: var(--kf-muted);
      }
      .track li::before {
        content: '';
        position: absolute;
        top: 11px;
        left: -50%;
        width: 100%;
        height: 3px;
        background: var(--kf-surface-2);
      }
      .track li:first-child::before {
        display: none;
      }
      .track li.done::before {
        background: var(--tone);
      }
      .dot {
        position: relative;
        z-index: 1;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--kf-surface-2);
        border: 2px solid var(--kf-surface);
        color: var(--kf-on-accent);
        font-size: 0.85rem;
      }
      .track li.done .dot {
        background: var(--tone);
      }
      .track li.current .lbl {
        color: var(--kf-text);
        font-weight: 700;
      }
      h3 {
        margin: 0 0 0.65rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--kf-muted);
      }
      .stars {
        display: flex;
        gap: 0.3rem;
      }
      .star {
        padding: 0.1rem;
        border: 0;
        background: transparent;
        color: var(--kf-line);
        font-size: 2.2rem;
        line-height: 1;
        cursor: pointer;
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .star.static {
        cursor: default;
        font-size: 1.9rem;
      }
      .star.on {
        color: var(--kf-warn);
      }
      .star.on ion-icon {
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      button.star:active {
        transform: scale(1.25);
      }
      .hint {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0.4rem 0 0;
        font-size: 0.8rem;
        color: var(--kf-muted);
      }
      .hint.ok {
        color: var(--kf-green);
        font-weight: 600;
      }
      .wide-hint {
        grid-column: 1 / -1;
        margin: 0;
      }
      .rate-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.8rem;
      }
      .submit {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.8rem;
        border: 0;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        color: var(--kf-on-hero);
        font: 700 0.9rem var(--kf-font);
        cursor: pointer;
        box-shadow: var(--kf-shadow);
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .submit:active {
        transform: scale(0.97);
      }
      .submit:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
      }
      .link {
        margin-top: 0.5rem;
        padding: 0.2rem 0;
        border: 0;
        background: transparent;
        color: var(--kf-accent);
        font: 600 0.82rem var(--kf-font);
        cursor: pointer;
      }
      .tech,
      .svc {
        display: flex;
        gap: 0.8rem;
        align-items: center;
      }
      .svc {
        align-items: flex-start;
      }
      .tech-main {
        flex: 1;
        min-width: 0;
      }
      .tech-avatar,
      .svc-ico {
        flex: none;
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        color: var(--kf-on-hero);
        font-size: 1.2rem;
        font-weight: 700;
      }
      .svc-ico {
        background: var(--kf-accent-soft);
        color: var(--kf-accent);
      }
      .tech-avatar.wait {
        background: var(--kf-surface-2);
        color: var(--kf-muted);
      }
      .tech strong,
      .svc strong {
        display: block;
        font-size: 0.95rem;
      }
      .tech-role,
      .svc-desc {
        display: block;
        font-size: 0.78rem;
        color: var(--kf-muted);
      }
      .pill {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: var(--kf-surface-2);
        color: var(--kf-muted);
        font-size: 0.7rem;
        font-weight: 700;
      }
      .pill.ok {
        background: var(--kf-green-soft);
        color: var(--kf-green);
      }
      .info {
        margin: 0.8rem 0 0;
        padding: 0.3rem 0.8rem;
        border-radius: 16px;
        background: var(--kf-surface-2);
      }
      .info div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.4rem 0;
        font-size: 0.82rem;
      }
      .info div + div {
        border-top: 1px dashed var(--kf-line);
      }
      .info dt {
        color: var(--kf-muted);
      }
      .info dd {
        margin: 0;
        font-weight: 600;
        text-align: right;
        overflow-wrap: anywhere;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.7rem;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        background: var(--kf-surface-2);
        color: var(--kf-text);
        font-size: 0.74rem;
        font-weight: 600;
        text-transform: capitalize;
      }
      .chip.tone {
        background: var(--tone-soft);
        color: var(--tone);
        text-transform: none;
      }
      .note {
        margin: 0.7rem 0 0;
        font-size: 0.82rem;
        font-style: italic;
        color: var(--kf-muted);
        overflow-wrap: anywhere;
      }
      .price {
        margin: 0.9rem 0 0;
        padding-top: 0.7rem;
        border-top: 1px dashed var(--kf-line);
      }
      .price div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.2rem 0;
        font-size: 0.84rem;
      }
      .price dt {
        color: var(--kf-muted);
      }
      .price dd {
        margin: 0;
        font-weight: 600;
      }
      .price .total {
        margin-top: 0.3rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--kf-line);
      }
      .price .total dt,
      .price .total dd {
        color: var(--kf-text);
        font-weight: 700;
        font-size: 0.95rem;
      }
      .manage {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem;
      }
      .ghost {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.8rem;
        border: 1px solid var(--kf-line);
        border-radius: 16px;
        background: var(--kf-surface);
        color: var(--kf-text);
        font: 600 0.85rem var(--kf-font);
        cursor: pointer;
      }
      .rate-actions .ghost {
        flex: 0 0 32%;
      }
      .ghost.danger {
        color: var(--kf-danger);
        border-color: color-mix(in srgb, var(--kf-danger) 45%, var(--kf-line));
      }
      .ghost:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .foot {
        padding: 0.7rem 1rem calc(env(safe-area-inset-bottom, 0px) + 0.8rem);
        background: color-mix(in srgb, var(--kf-surface) 92%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-top: 1px solid var(--kf-line);
        font-family: var(--kf-font);
      }
      .again {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        max-width: 640px;
        margin: 0 auto;
        padding: 0.95rem;
        border: 0;
        border-radius: 18px;
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        color: var(--kf-on-hero);
        font: 700 1rem var(--kf-font);
        cursor: pointer;
        box-shadow: var(--kf-shadow-lift);
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .again:active {
        transform: scale(0.98);
      }
      .again:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
      }
      .why {
        display: flex;
        align-items: flex-start;
        gap: 0.4rem;
        max-width: 640px;
        margin: 0.55rem auto 0;
        font-size: 0.76rem;
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
export class RepairDetailComponent {
  private readonly booking = inject(RepairsService);
  private readonly extras = inject(RepairExtrasService);
  private readonly config = inject(BOOKING_CONFIG);

  readonly repair = input<Repair | null>(null);
  /** Empty = "Book again" is allowed; otherwise the reason it is not. */
  readonly bookAgainBlock = input('');
  readonly isOpen = model(false);

  readonly bookAgain = output<Repair>();
  readonly cancel = output<Repair>();
  readonly reschedule = output<Repair>();

  readonly steps = ['Booked', 'In repair', 'Testing', 'Ready'] as const;
  readonly starList = [1, 2, 3, 4, 5];

  // Rating UI state (the saved rating itself lives in RepairExtrasService).
  readonly draft = signal(0);
  readonly editingId = signal<string | null>(null);
  readonly thanks = signal(false);

  readonly tone = computed(() => {
    const r = this.repair();
    return r ? statusMeta(r.status).tone : 'accent';
  });
  readonly step = computed(() => {
    const r = this.repair();
    return r ? statusMeta(r.status).step : 0;
  });
  readonly shortId = computed(() => (this.repair() ? shortRepairId(this.repair()!.id) : ''));
  readonly dateLabel = computed(() => (this.repair() ? formatBookingDate(this.repair()!.booking_date) : ''));
  readonly timeLabel = computed(() => (this.repair() ? formatTime(this.repair()!.booking_time) : ''));
  readonly issues = computed(() => (this.repair() ? repairIssues(this.repair()!) : []));
  readonly note = computed(() => this.repair()?.issue_description?.trim() ?? '');

  readonly service = computed(() => {
    const r = this.repair();
    return r ? (this.booking.serviceOptions().find((item) => item.id === r.service_id) ?? null) : null;
  });
  readonly technician = computed(() => {
    const r = this.repair();
    return r?.technician_id
      ? (this.booking.technicianOptions().find((item) => item.id === r.technician_id) ?? null)
      : null;
  });
  readonly estimate = computed(() => {
    const r = this.repair();
    return r ? estimatePriceForRepair(r, this.service()) : { base: 0, issueFees: 0, total: 0 };
  });

  readonly fav = computed(() => {
    const r = this.repair();
    return r ? this.extras.isFavorite(r.id) : false;
  });
  readonly saved = computed(() => {
    const r = this.repair();
    return r ? this.extras.ratingOf(r.id) : 0;
  });
  readonly savedWord = computed(() => (RATING_WORDS[this.saved()] ?? '').toLowerCase());
  readonly draftWord = computed(() => RATING_WORDS[this.draft()] ?? '');
  /** Show the star picker: no rating yet, or the customer pressed "Edit rating". */
  readonly editing = computed(() => {
    const r = this.repair();
    return !!r && (this.saved() === 0 || this.editingId() === r.id);
  });

  readonly isFinished = computed(() => {
    const r = this.repair();
    return !!r && (r.status === 'completed' || r.status === 'cancelled');
  });
  /** Why "Book again" is off (empty = allowed). A repair still in the shop can never be booked again. */
  readonly blocked = computed(() => {
    if (!this.isFinished()) return 'This repair is still in progress. You can book again once it is finished.';
    return this.bookAgainBlock();
  });
  readonly canManage = computed(() => {
    const r = this.repair();
    return !!r && (r.status === 'pending' || r.status === 'in_progress' || r.status === 'testing');
  });
  readonly canCancel = computed(() => (this.repair() ? canCustomerCancel(this.repair()!) : false));
  readonly canReschedule = computed(() => (this.repair() ? canCustomerReschedule(this.repair()!) : false));

  money(amount: number): string {
    return formatCurrency(amount, this.config.currency);
  }

  toggleFav(): void {
    const r = this.repair();
    if (r) this.extras.toggleFavorite(r.id);
  }

  pick(stars: number): void {
    if (this.repair()?.status === 'completed') this.draft.set(stars);
  }

  submitRating(): void {
    const r = this.repair();
    if (!r || r.status !== 'completed' || this.draft() < 1) return;
    this.extras.submitRating(r.id, this.draft());
    this.draft.set(0);
    this.editingId.set(null);
    this.thanks.set(true);
  }

  editRating(): void {
    const r = this.repair();
    if (!r) return;
    this.draft.set(this.saved());
    this.thanks.set(false);
    this.editingId.set(r.id);
  }

  cancelEdit(): void {
    this.draft.set(0);
    this.editingId.set(null);
  }

  onBookAgain(): void {
    const r = this.repair();
    if (r && !this.blocked()) this.bookAgain.emit(r);
  }

  onDismiss(): void {
    this.isOpen.set(false);
    this.draft.set(0);
    this.editingId.set(null);
    this.thanks.set(false);
  }
}