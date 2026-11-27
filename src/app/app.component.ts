import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { ThemeService } from '@kitafix/theme';
import { NetworkService } from '@kitafix/accounts';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {
  /** Applies the saved light/dark choice at startup (dark by default). */
  private readonly theme = inject(ThemeService);
  /** Team 1: offline / back-online toasts. */
  private readonly network = inject(NetworkService);

  constructor() {
    this.network.start();
  }
}
