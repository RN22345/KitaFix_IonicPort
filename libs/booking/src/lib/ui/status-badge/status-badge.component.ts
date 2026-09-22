import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonBadge, IonIcon } from '@ionic/angular';
import { RepairStatus } from '@kitafix/shared-types';
import { statusMeta } from '../../models/repair.model';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonBadge, IonIcon],
  template: `
    <ion-badge [color]="meta().badgeColor">
      <ion-icon [name]="meta().icon"></ion-icon>
      {{ meta().label }}
    </ion-badge>
  `,
  styles: [
    `
      ion-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        font-weight: 500;
        white-space: nowrap;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly status = input.required<RepairStatus>();
  readonly meta = computed(() => statusMeta(this.status()));
}
