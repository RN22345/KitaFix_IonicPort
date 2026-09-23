import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

/**
 * Shell for the booking screens. In the merged app each team adds its tab
 * buttons here (Team 1: profile; Team 4: reviews) - but the lazy routes stay
 * inside each team's own library.
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
        <ion-tab-button tab="dashboard" href="/tabs/dashboard">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Dashboard</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="new-booking" href="/tabs/new-booking">
          <ion-icon name="add-circle-outline"></ion-icon>
          <ion-label>New booking</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="my-repairs" href="/tabs/my-repairs">
          <ion-icon name="list-outline"></ion-icon>
          <ion-label>My repairs</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {}
