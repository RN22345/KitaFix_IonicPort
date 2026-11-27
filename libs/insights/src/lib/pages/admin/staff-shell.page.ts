import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  chatbubblesOutline,
  constructOutline,
  homeOutline,
  peopleOutline,
  personCircleOutline,
  trashOutline,
} from 'ionicons/icons';

/**
 * Admin area of Team 4 at /admin. Its own small tab bar, so the customer's
 * tabs (/tabs) are never touched. Who may open /admin is Team 1's check
 * (accountsRoleGuard(['admin']) in app.routes.ts).
 * IonTabs renders its own router outlet: do not add another one here.
 *
 * Buttons that leave /admin have no `tab`/`href`: a bare href is a plain browser
 * link that ignores <base href> (404 on GitHub Pages). They navigate through the
 * Angular router instead.
 */
@Component({
  selector: 'app-insights-staff-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="overview" href="/admin/overview">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Overview</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="insights" href="/admin/insights">
          <ion-icon name="bar-chart-outline"></ion-icon>
          <ion-label>Insights</ion-label>
        </ion-tab-button>
        <ion-tab-button (click)="go('/ops')">
          <ion-icon name="construct-outline"></ion-icon>
          <ion-label>Repairs</ion-label>
        </ion-tab-button>
        <ion-tab-button (click)="go('/accounts-list')">
          <ion-icon name="people-outline"></ion-icon>
          <ion-label>Accounts</ion-label>
        </ion-tab-button>
        <ion-tab-button (click)="go('/accounts-my-account')">
          <ion-icon name="person-circle-outline"></ion-icon>
          <ion-label>Me</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class StaffShellPage {
  private readonly router = inject(Router);

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'bar-chart-outline': barChartOutline,
      'trash-outline': trashOutline,
      'people-outline': peopleOutline,
      'construct-outline': constructOutline,
      'person-circle-outline': personCircleOutline,
    });
  }

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
