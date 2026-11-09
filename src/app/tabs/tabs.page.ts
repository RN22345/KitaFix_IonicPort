import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { TopNavComponent } from '@kitafix/booking';

/**
 * Shell for the booking screens: a floating top nav above the tabs, and a
 * floating bottom nav that sits over the page content.
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

            /* Pages scroll behind the floating bar: leave room at the end of the page. */
      .shell ::ng-deep ion-content::part(scroll) {
        padding-bottom: 130px;
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
        overflow: visible;
        width: calc(100% - 1.6rem);
        max-width: 420px;
        height: 66px;
        margin: 0;
        padding: 0.35rem;
        gap: 0.25rem;
        border: 1px solid var(--kf-line);
        border-radius: 30px;
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
        --padding-top: 0.5rem;
        --padding-bottom: 0.45rem;
        height: 100%;
        border-radius: 24px;
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

      /* ---------- Book button: compact, raised, green, glowing ---------- */
      ion-tab-button.book,
      ion-tab-button.book.tab-selected {
        --color: #ffffff;
        --color-selected: #ffffff;
        --padding-top: 0.35rem;
        --padding-bottom: 0.3rem;
        flex: 0 0 76px;
        max-width: 76px;
        align-self: flex-start;
        height: calc(100% + 10px);
        margin-top: -10px;
        border-radius: 22px;
        background: linear-gradient(145deg, #19e0a4, #00a67c 60%, #00876a);
        box-shadow:
          0 0 0 4px var(--kf-bg),
          0 10px 20px -8px rgba(0, 220, 150, 0.75);
        animation: book-glow 2.4s ease-in-out infinite;
      }
      ion-tab-button.book:active {
        transform: scale(0.94) translateY(-2px);
      }
      ion-tab-button.book ion-icon {
        font-size: 1.55rem;
        filter: drop-shadow(0 2px 4px rgba(0, 60, 40, 0.45));
      }
      ion-tab-button.book.tab-selected ion-icon {
        transform: translateY(-1px) scale(1.08) rotate(90deg);
      }
      ion-tab-button.book ion-label {
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-shadow: 0 1px 3px rgba(0, 60, 40, 0.4);
      }

      @keyframes book-glow {
        0%,
        100% {
          box-shadow:
            0 0 0 4px var(--kf-bg),
            0 10px 20px -8px rgba(0, 220, 150, 0.6);
        }
        50% {
          box-shadow:
            0 0 0 4px var(--kf-bg),
            0 12px 26px -6px rgba(0, 240, 165, 0.95),
            0 0 16px 4px rgba(0, 230, 160, 0.45);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        ion-tab-button.book,
        ion-tab-button.book.tab-selected {
          animation: none;
        }
      }
    `,
  ],
})
export class TabsPage {}