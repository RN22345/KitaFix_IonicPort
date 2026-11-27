import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChartOutline, chatbubblesOutline, homeOutline, peopleOutline, trashOutline } from 'ionicons/icons';

/**
 * Admin area of Team 4 at /staff. Its own small tab bar, so the customer's
 * tabs (/tabs) are never touched. Who may open /admin is Team 1's check
 * (accountsRoleGuard(['admin']) in app.routes.ts).
 * IonTabs renders its own router outlet: do not add another one here.
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
        <ion-tab-button href="/accounts-list">
          <ion-icon name="people-outline"></ion-icon>
          <ion-label>Accounts</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class StaffShellPage {
  constructor() {
    addIcons({ 'home-outline': homeOutline, 'chatbubbles-outline': chatbubblesOutline, 'bar-chart-outline': barChartOutline, 'trash-outline': trashOutline, 'people-outline': peopleOutline });
  }
}
