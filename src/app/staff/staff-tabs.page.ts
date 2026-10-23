import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

@Component({
  selector: 'app-staff-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="admin-portal" href="/staff/admin-portal">
          <ion-icon name="speedometer-outline"></ion-icon>
          <ion-label>Portal</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="repair-queue" href="/staff/repair-queue">
          <ion-icon name="construct-outline"></ion-icon>
          <ion-label>Queue</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="service-catalog" href="/staff/service-catalog">
          <ion-icon name="pricetag-outline"></ion-icon>
          <ion-label>Services</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class StaffTabsPage {}