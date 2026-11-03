import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

/**
 * Local navigation shell for Team 3 repair-ops screens.
 *
 * NOTE: Ionic 9's IonTabs renders its own <ion-router-outlet> internally
 * (inside .tabs-inner). Do NOT add another one here - a nested outlet is
 * projected on top as a full-screen layer and blocks scrolling/clicking on
 * every tab.
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="admin-portal" href="/tabs/admin-portal">
          <ion-icon name="speedometer-outline"></ion-icon>
          <ion-label>Portal</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="repair-queue" href="/tabs/repair-queue">
          <ion-icon name="construct-outline"></ion-icon>
          <ion-label>Queue</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="service-catalog" href="/tabs/service-catalog">
          <ion-icon name="pricetag-outline"></ion-icon>
          <ion-label>Services</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {}
