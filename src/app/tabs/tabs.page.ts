import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { TopNavComponent } from '@kitafix/booking';

/**
 * Customer shell: a floating top nav above the tabs, and a floating bottom nav
 * that sits over the page content. Four equal tabs: Home, Book, Repairs, Account.
 * Account hosts Team 1's My Account / Edit profile / Change password pages
 * (routes in app.routes.ts); the --acc-* variables below give them this theme.
 * NOTE: Ionic's IonTabs renders its own <ion-router-outlet>. Do NOT add another one here.
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, TopNavComponent],
  template: `
    <app-top-nav></app-top-nav>
    <div class="shell">
      <ion-tabs>
        <ion-tab-bar slot="bottom">
          <ion-tab-button tab="dashboard" href="/tabs/dashboard">
            <ion-icon name="home-outline"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="new-booking" href="/tabs/new-booking" class="book">
            <ion-icon name="add-circle-outline"></ion-icon>
            <ion-label>Book</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="my-repairs" href="/tabs/my-repairs">
            <ion-icon name="list-outline"></ion-icon>
            <ion-label>Repairs</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="account" href="/tabs/account">
            <ion-icon name="person-circle-outline"></ion-icon>
            <ion-label>Account</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    </div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--kf-bg);

        /* Team 1's account pages (libs/accounts styles) read these. */
        --acc-bg: var(--kf-bg);
        --acc-surface: var(--kf-surface);
        --acc-surface-2: var(--kf-surface-2);
        --acc-ink: var(--kf-text);
        --acc-muted: var(--kf-muted);
        --acc-border: var(--kf-line);
        --acc-tint: var(--kf-accent-soft);
      }
      .shell {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
      }

      /* Pages scroll behind the floating bar: leave room at the end of the page. */
      .shell ::ng-deep ion-content::part(scroll) {
        padding-bottom: 130px;
      }

      /* Team 1's pages inside the tabs: the top nav already brands the screen,
         so drop their corner triangles and the extra top padding. */
      .shell ::ng-deep .acc-page {
        padding-top: 12px;
      }
      .shell ::ng-deep .acc-page::before,
      .shell ::ng-deep .acc-page::after {
        display: none;
      }

      /* ---------- Floating bar ---------- */
      ion-tab-bar {
        --background: transparent;
        --border: none;
        position: absolute;
        left: 50%;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 0.7rem);
        transform: translateX(-50%);
        z-index: 20;
        box-sizing: border-box;
        contain: none;
        width: calc(100% - 1.6rem);
        max-width: 420px;
        height: 64px;
        margin: 0;
        padding: 0.35rem;
        gap: 0.25rem;
        border: 1px solid var(--kf-line);
        border-radius: 26px;
        background: color-mix(in srgb, var(--kf-surface) 82%, transparent);
        backdrop-filter: blur(20px) saturate(1.7);
        -webkit-backdrop-filter: blur(20px) saturate(1.7);
        box-shadow:
          0 18px 40px -12px rgba(0, 0, 0, 0.45),
          var(--kf-shadow-lift);
      }

      ion-tab-button {
        --color: var(--kf-muted);
        --color-selected: var(--kf-on-hero);
        --background: transparent;
        --background-focused: transparent;
        --ripple-color: var(--kf-accent-soft);
        --padding-top: 0.45rem;
        --padding-bottom: 0.4rem;
        flex: 1 1 0;
        height: 100%;
        border-radius: 20px;
        font-size: 0.68rem;
        font-weight: 600;
        transition:
          background var(--kf-slow) var(--kf-ease),
          box-shadow var(--kf-slow) var(--kf-ease),
          transform var(--kf-fast) var(--kf-ease);
      }
      ion-tab-button:active {
        transform: scale(0.95);
      }
      ion-tab-button ion-icon {
        font-size: 1.35rem;
        transition: transform var(--kf-slow) var(--kf-ease);
      }
      ion-tab-button.tab-selected {
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        box-shadow: 0 10px 20px -10px var(--kf-accent);
      }
      ion-tab-button.tab-selected ion-icon {
        transform: translateY(-1px) scale(1.08);
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      ion-tab-button.tab-selected ion-label {
        font-weight: 700;
      }

      /* Book: same size and shape as the other tabs; only the icon is green
         so the main action is easy to find without shouting. */
      ion-tab-button.book:not(.tab-selected) ion-icon {
        color: var(--kf-green);
      }
      ion-tab-button.book.tab-selected {
        background: linear-gradient(135deg, var(--kf-green), color-mix(in srgb, var(--kf-green) 70%, var(--kf-hero-from)));
        box-shadow: 0 10px 20px -10px var(--kf-green);
      }
    `,
  ],
})
export class TabsPage {}
