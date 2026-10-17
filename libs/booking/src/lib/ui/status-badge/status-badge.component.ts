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
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: var(--tone-soft);
        color: var(--tone);
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
      }
      /* In the shop right now: the icon breathes. */
      .live ion-icon {
        animation: breathe 1.8s ease-in-out infinite;
      }
      @keyframes breathe {
        50% {
          opacity: 0.45;
          transform: scale(0.88);
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
