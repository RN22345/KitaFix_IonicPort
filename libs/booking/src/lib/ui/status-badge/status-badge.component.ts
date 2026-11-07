import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { RepairStatus } from '@kitafix/shared-types';
import { statusMeta } from '../../models/repair.model';

/** Status pill, tinted with the status tone (data-tone, see src/global.scss). */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  host: { '[attr.data-tone]': 'meta().tone' },
  template: `
    <span class="badge" [class.live]="live()">
      <span class="pulse" aria-hidden="true"></span>
      <ion-icon [name]="meta().icon"></ion-icon>
      {{ meta().label }}
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.35rem 0.75rem 0.35rem 0.6rem;
        border-radius: 999px;
        background: var(--tone-soft);
        box-shadow: inset 0 0 0 1px var(--tone-soft);
        color: var(--tone);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .badge ion-icon {
        font-size: 0.95rem;
      }
      .pulse {
        display: none;
      }
      /* In the shop right now: a live dot pulses next to the icon. */
      .live .pulse {
        display: block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--tone);
        animation: pulse 1.6s ease-out infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 var(--tone-soft);
        }
        100% {
          box-shadow: 0 0 0 8px transparent;
        }
      }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly status = input.required<RepairStatus>();
  readonly meta = computed(() => statusMeta(this.status()));
  readonly live = computed(() => this.status() === 'in_progress' || this.status() === 'testing');
}