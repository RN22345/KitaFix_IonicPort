import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { RepairOpsService } from '@kitafix/repair-ops';

/**
 * Shell for Team 3's shop screens at /ops (admins and technicians).
 * Moved here from Team 3's tabs.page.ts in the group merge, because /tabs is the
 * customer shell.
 *
 * NOTE: Ionic 9's IonTabs renders its own <ion-router-outlet>. Do NOT add another one.
 *
 * Roles: admins see Overview (Team 4), Portal, Queue and Services. A technician
 * sees only the Queue (their own jobs, notes, history, service log) and their account.
 */
@Component({
  selector: 'app-ops-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @if (!isTechnician()) {
          <ion-tab-button (click)="go('/admin')">
            <ion-icon name="home-outline"></ion-icon>
            <ion-label>Overview</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="admin-portal" href="/ops/admin-portal">
            <ion-icon name="speedometer-outline"></ion-icon>
            <ion-label>Portal</ion-label>
          </ion-tab-button>
        }
        <ion-tab-button tab="repair-queue" href="/ops/repair-queue">
          <ion-icon name="construct-outline"></ion-icon>
          <ion-label>Queue</ion-label>
        </ion-tab-button>
        @if (!isTechnician()) {
          <ion-tab-button tab="service-catalog" href="/ops/service-catalog">
            <ion-icon name="pricetag-outline"></ion-icon>
            <ion-label>Services</ion-label>
          </ion-tab-button>
        }
        <!-- No tab/href: leaves /ops through the router (a bare href ignores <base href>). -->
        <ion-tab-button (click)="go('/accounts-my-account')">
          <ion-icon name="person-circle-outline"></ion-icon>
          <ion-label>Me</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  // Team 3's look, kept as-is (see docs/UI_Unification_Plan.md). The header rules were
  // global in Team 3's repo; here they are scoped to /ops so other screens are not affected.
  styles: [
    `
      ion-tab-bar {
        --background: #ffffff;
        --border: 1px solid #d5e2f5;
      }
      ion-tab-button {
        --color: #64748b;
        --color-selected: #0b5ed7;
        --ripple-color: rgba(11, 94, 215, 0.18);
      }
      ion-tab-button.tab-selected {
        --color: #0b5ed7;
        --color-selected: #0b5ed7;
      }
      @media (hover: hover) {
        ion-tab-button:hover {
          --color: #0b5ed7;
        }
      }
      :host ::ng-deep ion-header ion-toolbar {
        --padding-start: 16px;
        --padding-end: 16px;
      }
      :host ::ng-deep ion-header ion-title {
        text-align: start;
        --color: #ffffff;
        padding-inline-start: 0;
        padding-inline-end: 0;
      }
    `,
  ],
})
export class OpsTabsPage implements OnInit {
  private readonly ops = inject(RepairOpsService);
  private readonly router = inject(Router);
  readonly isTechnician = this.ops.isTechnician;

  ngOnInit(): void {
    void this.ops.loadActor();
  }

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
