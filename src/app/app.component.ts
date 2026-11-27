import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { ThemeService } from '@kitafix/theme';
import { ACCOUNTS_AUTH_CLIENT, NetworkService } from '@kitafix/accounts';

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
    this.reloadWhenUserChanges();
  }

  /**
   * Each team keeps the signed-in user and their data in app-wide services
   * (booking repairs, repair-ops actor, admin insights). If a different user
   * signs in during the same page session, those would still show the previous
   * user's data and role, so start the app fresh instead.
   */
  private reloadWhenUserChanges(): void {
    let lastUserId: string | null = null;
    inject(ACCOUNTS_AUTH_CLIENT).auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id;
      if (!id) return;
      if (lastUserId && id !== lastUserId) {
        window.location.reload();
        return;
      }
      lastUserId = id;
    });
  }
}
