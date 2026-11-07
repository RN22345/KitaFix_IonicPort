import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { TopNavComponent } from '@kitafix/booking';

/**
 * Shell for the booking screens: a floating top nav above the tabs.
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
          <ion-tab-button tab="new-booking" href="/tabs/new-booking">
            <ion-icon name="add-circle-outline"></ion-icon>
            <ion-label>Book</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="my-repairs" href="/tabs/my-repairs">
            <ion-icon name="list-outline"></ion-icon>
            <ion-label>Repairs</ion-label>
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
      }
      .shell {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
      }
      ion-tab-bar {
        --background: transparent;
        --border: none;
        position: relative;
        width: calc(100% - 1.6rem);
        max-width: 440px;
        height: auto;
        margin: 0 auto calc(env(safe-area-inset-bottom, 0px) + 0.6rem);
        padding: 0.35rem;
        gap: 0.25rem;
        border: 1px solid var(--kf-line);
        border-radius: 28px;
        background: color-mix(in srgb, var(--kf-surface) 86%, transparent);
        backdrop-filter: blur(18px) saturate(1.6);
        -webkit-backdrop-filter: blur(18px) saturate(1.6);
        box-shadow: var(--kf-shadow-lift);
      }
      ion-tab-bar::before {
        content: '';
        position: absolute;
        inset: 0 22% auto;
        height: 2px;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent, var(--kf-accent), transparent);
        opacity: 0.6;
      }
      ion-tab-button {
        --color: var(--kf-muted);
        --color-selected: var(--kf-on-hero);
        --background: transparent;
        --background-focused: transparent;
        --ripple-color: var(--kf-accent-soft);
        --padding-top: 0.55rem;
        --padding-bottom: 0.5rem;
        border-radius: 22px;
        font-size: 0.7rem;
        font-weight: 600;
        transition:
          background var(--kf-slow) var(--kf-ease),
          box-shadow var(--kf-slow) var(--kf-ease),
          transform var(--kf-fast) var(--kf-ease);
      }
      ion-tab-button:active {
        transform: scale(0.94);
      }
      ion-tab-button ion-icon {
        font-size: 1.4rem;
        transition: transform var(--kf-slow) var(--kf-ease);
      }
      ion-tab-button.tab-selected {
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        box-shadow: 0 10px 20px -10px var(--kf-accent);
      }
      ion-tab-button.tab-selected ion-icon {
        transform: translateY(-2px) scale(1.12);
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      ion-tab-button.tab-selected ion-label {
        font-weight: 700;
      }
    `,
  ],
})
export class TabsPage {}