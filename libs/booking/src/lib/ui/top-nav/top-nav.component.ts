import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonPopover } from '@ionic/angular';
import { ThemeService } from '@kitafix/theme';
import { BOOKING_CONFIG } from '../../data-access/config';
import { getSupabaseClient } from '../../data-access/supabase-client';
import { customerRank } from '../../models/rank.model';
import { RepairExtrasService } from '../../services/repair-extras.service';
import { RepairsService } from '../../services/repairs.service';

const LOCATION_KEY = 'kf-customer-location';

function readLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Sticky top bar shown on every tab: brand, customer location, notifications,
 * ONE light/dark button and the clickable profile.
 */
@Component({
  selector: 'app-top-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, IonModal, IonPopover],
  template: `
    <header class="bar">
      <button type="button" class="brand" (click)="go('/tabs/dashboard')" aria-label="KitaFix home">
        <img src="assets/logo-light.png" alt="" />
      </button>

      <button type="button" id="nav-location" class="loc" aria-label="Change your location">
        <span class="loc-pin"><ion-icon name="location-outline"></ion-icon></span>
        <span class="loc-text">
          <small>Your location</small>
          <strong>{{ location() || 'Set your location' }}</strong>
        </span>
        <ion-icon name="chevron-down-outline" class="caret"></ion-icon>
      </button>

      <div class="tools">
        <button type="button" id="nav-bell" class="icon-btn" aria-label="Notifications">
          <ion-icon name="notifications-outline"></ion-icon>
          @if (unreadCount() > 0) {
            <span class="count">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
          }
        </button>

        <button
          type="button"
          class="icon-btn theme"
          (click)="toggleTheme()"
          [attr.aria-label]="mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <ion-icon [name]="mode() === 'dark' ? 'sunny-outline' : 'moon-outline'" class="theme-ico"></ion-icon>
        </button>

        <button
          type="button"
          class="avatar"
          [attr.data-tone]="rank().tier.tone"
          (click)="profileOpen.set(true)"
          aria-label="Open your profile"
        >
          {{ initial() }}
        </button>
      </div>
    </header>

    <!-- Notifications -->
    <ion-popover trigger="nav-bell" triggerAction="click" class="kf-popover" #bell (didDismiss)="markAllRead()">
      <ng-template>
        <div class="pop">
          <div class="pop-head">
            <h3>Notifications</h3>
            @if (unreadCount() > 0) {
              <span class="pill">{{ unreadCount() }} new</span>
            }
          </div>
          @for (item of notifications(); track item.id) {
            <button type="button" class="note" [class.unread]="!item.read" (click)="bell.dismiss(); go('/tabs/my-repairs')">
              <span class="note-ico"><ion-icon name="construct-outline"></ion-icon></span>
              <span class="note-body">
                <strong>Repair update</strong>
                <span>{{ item.message }}</span>
                <small>{{ timeAgo(item.at) }}</small>
              </span>
            </button>
          } @empty {
            <div class="pop-empty">
              <ion-icon name="notifications-outline"></ion-icon>
              <p>You're all caught up.<br />Repair updates will show up here.</p>
            </div>
          }
        </div>
      </ng-template>
    </ion-popover>

    <!-- Location -->
    <ion-popover trigger="nav-location" triggerAction="click" class="kf-popover" #locPop>
      <ng-template>
        <div class="pop">
          <div class="pop-head"><h3>Your location</h3></div>
          <label class="field">
            <ion-icon name="location-outline"></ion-icon>
            <input
              #locInput
              type="text"
              maxlength="60"
              placeholder="City or barangay"
              [value]="location()"
              (keydown.enter)="saveLocation(locInput.value); locPop.dismiss()"
            />
          </label>
          <button type="button" class="soft-btn" (click)="detectLocation()" [disabled]="locating()">
            <ion-icon name="locate-outline"></ion-icon>
            {{ locating() ? 'Finding you...' : 'Use my current location' }}
          </button>
          @if (locationError()) {
            <p class="err">{{ locationError() }}</p>
          }
          <button type="button" class="solid-btn" (click)="saveLocation(locInput.value); locPop.dismiss()">Save location</button>
        </div>
      </ng-template>
    </ion-popover>

    <!-- Profile -->
    <ion-modal
      [isOpen]="profileOpen()"
      (didDismiss)="profileOpen.set(false)"
      class="kf-sheet"
      [initialBreakpoint]="0.78"
      [breakpoints]="[0, 0.78, 1]"
    >
      <ng-template>
        <ion-content>
          <div class="profile">
            <div class="p-hero" [attr.data-tone]="rank().tier.tone">
              <div class="p-avatar">{{ initial() }}</div>
              <h2>{{ user()?.full_name ?? 'Customer' }}</h2>
              @if (user()?.email; as email) {
                <p class="p-mail">{{ email }}</p>
              }
              <span class="p-rank"><ion-icon [name]="rank().tier.icon"></ion-icon> {{ rank().tier.label }}</span>
            </div>

            <div class="p-stats">
              <div><strong>{{ repairs().length }}</strong><span>Repairs</span></div>
              <div><strong>{{ rank().completed }}</strong><span>Completed</span></div>
              <div><strong>{{ favoriteCount() }}</strong><span>Favourites</span></div>
            </div>

            @if (rank().next; as next) {
              <div class="p-next" [attr.data-tone]="next.tone">
                <div class="p-next-top">
                  <span>{{ rank().remaining }} more to <strong>{{ next.label }}</strong></span>
                  <span>{{ rank().progress }}%</span>
                </div>
                <div class="meter"><span [style.width.%]="rank().progress"></span></div>
              </div>
            }

            <div class="p-actions">
              <button type="button" (click)="go('/tabs/my-repairs')">
                <ion-icon name="construct-outline"></ion-icon> My repairs
                <ion-icon name="chevron-forward-outline" class="end"></ion-icon>
              </button>
              <button type="button" (click)="go('/tabs/new-booking')">
                <ion-icon name="add-circle-outline"></ion-icon> Book a repair
                <ion-icon name="chevron-forward-outline" class="end"></ion-icon>
              </button>
              <button type="button" class="danger" (click)="signOut()">
                <ion-icon name="log-out-outline"></ion-icon> Sign out
              </button>
            </div>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: none;
        position: relative;
        z-index: 30;
        font-family: var(--kf-font);
        padding: calc(env(safe-area-inset-top, 0px) + 0.5rem) 0.8rem 0;
      }
      .bar {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        max-width: 780px;
        margin: 0 auto;
        padding: 0.45rem 0.55rem;
        border: 1px solid var(--kf-line);
        border-radius: 28px;
        background: color-mix(in srgb, var(--kf-surface) 86%, transparent);
        backdrop-filter: blur(18px) saturate(1.6);
        -webkit-backdrop-filter: blur(18px) saturate(1.6);
        box-shadow: var(--kf-shadow-lift);
        animation: kf-drop var(--kf-slow) var(--kf-ease) both;
      }
      .bar::before {
        content: '';
        position: absolute;
        inset: 0 22% auto;
        height: 2px;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent, var(--kf-accent), transparent);
        opacity: 0.6;
      }
      button {
        font-family: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .brand {
        flex: none;
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        padding: 0;
        border: 0;
        border-radius: 14px;
        background: var(--kf-on-hero);
        box-shadow: var(--kf-shadow);
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .brand:active {
        transform: scale(0.92);
      }
      .brand img {
        width: 28px;
        height: 28px;
        object-fit: contain;
      }
      .loc {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.3rem 0.65rem 0.3rem 0.35rem;
        border: 1px solid var(--kf-line);
        border-radius: 999px;
        background: var(--kf-surface-2);
        color: var(--kf-text);
        text-align: left;
        transition:
          border-color var(--kf-fast),
          transform var(--kf-fast) var(--kf-ease);
      }
      .loc:hover {
        border-color: var(--kf-accent);
      }
      .loc:active {
        transform: scale(0.98);
      }
      .loc-pin {
        flex: none;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--kf-accent-soft);
        color: var(--kf-accent);
        font-size: 1.05rem;
      }
      .loc-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      .loc-text small {
        font-size: 0.64rem;
        color: var(--kf-muted);
        font-weight: 500;
      }
      .loc-text strong {
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .caret {
        flex: none;
        color: var(--kf-muted);
        font-size: 0.9rem;
      }
      .tools {
        flex: none;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .icon-btn {
        position: relative;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid var(--kf-line);
        border-radius: 50%;
        background: var(--kf-surface-2);
        color: var(--kf-text);
        font-size: 1.2rem;
        transition:
          transform var(--kf-fast) var(--kf-ease),
          border-color var(--kf-fast),
          background var(--kf-fast);
      }
      .icon-btn:hover {
        border-color: var(--kf-accent);
      }
      .icon-btn:active {
        transform: scale(0.9);
      }
      .theme-ico {
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      .count {
        position: absolute;
        top: -3px;
        right: -3px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--kf-danger);
        color: var(--kf-on-accent);
        font-size: 0.65rem;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
        border: 2px solid var(--kf-surface);
        animation: kf-pop var(--kf-slow) var(--kf-ease);
      }
      .avatar {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 2px solid var(--tone, var(--kf-accent));
        border-radius: 50%;
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        color: var(--kf-on-hero);
        font-size: 0.95rem;
        font-weight: 700;
        box-shadow: 0 0 0 3px var(--tone-soft, var(--kf-accent-soft));
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .avatar:active {
        transform: scale(0.9);
      }

      /* Popovers */
      .pop {
        padding: 0.4rem;
        color: var(--kf-text);
        font-family: var(--kf-font);
      }
      .pop-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 0.7rem 0.5rem;
      }
      .pop-head h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
      }
      .pill {
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        background: var(--kf-accent-soft);
        color: var(--kf-accent);
        font-size: 0.7rem;
        font-weight: 700;
      }
      .note {
        display: flex;
        gap: 0.7rem;
        width: 100%;
        padding: 0.6rem 0.7rem;
        border: 0;
        border-radius: 14px;
        background: transparent;
        color: inherit;
        text-align: left;
        transition: background var(--kf-fast);
      }
      .note:hover {
        background: var(--kf-surface-2);
      }
      .note.unread {
        background: var(--kf-accent-soft);
      }
      .note-ico {
        flex: none;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: var(--kf-surface-2);
        color: var(--kf-accent);
        font-size: 1.1rem;
      }
      .note-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        font-size: 0.8rem;
      }
      .note-body strong {
        font-size: 0.85rem;
      }
      .note-body small {
        color: var(--kf-muted);
      }
      .pop-empty {
        padding: 1.6rem 1rem 1.8rem;
        text-align: center;
        color: var(--kf-muted);
        font-size: 0.82rem;
      }
      .pop-empty ion-icon {
        font-size: 2rem;
        opacity: 0.6;
      }
      .field {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0.2rem 0.5rem 0.6rem;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--kf-line);
        border-radius: 14px;
        background: var(--kf-surface-2);
        color: var(--kf-muted);
      }
      .field:focus-within {
        border-color: var(--kf-accent);
      }
      .field input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--kf-text);
        font: inherit;
        font-size: 0.9rem;
      }
      .soft-btn,
      .solid-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        width: calc(100% - 1rem);
        margin: 0 0.5rem 0.5rem;
        padding: 0.7rem 1rem;
        border: 0;
        border-radius: 14px;
        font-size: 0.86rem;
        font-weight: 600;
      }
      .soft-btn {
        background: var(--kf-accent-soft);
        color: var(--kf-accent);
      }
      .solid-btn {
        background: var(--kf-accent);
        color: var(--kf-on-accent);
      }
      .soft-btn:disabled {
        opacity: 0.6;
      }
      .err {
        margin: 0 0.8rem 0.6rem;
        color: var(--kf-danger);
        font-size: 0.76rem;
      }

      /* Profile sheet */
      .profile {
        padding: 0.4rem 1rem 1.6rem;
        font-family: var(--kf-font);
        color: var(--kf-text);
      }
      .p-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 1.3rem 1rem 1.1rem;
        border-radius: 26px;
        background: linear-gradient(135deg, var(--kf-hero-from), var(--kf-hero-to));
        color: var(--kf-on-hero);
        text-align: center;
        animation: kf-rise var(--kf-slow) var(--kf-ease) both;
      }
      .p-avatar {
        display: grid;
        place-items: center;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        background: var(--kf-on-hero);
        color: var(--kf-hero-from);
        font-size: 2rem;
        font-weight: 700;
        box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.28);
      }
      .p-hero h2 {
        margin: 0.5rem 0 0;
        font-size: 1.2rem;
        font-weight: 700;
      }
      .p-mail {
        margin: 0;
        font-size: 0.8rem;
        opacity: 0.85;
      }
      .p-rank {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.5rem;
        padding: 0.3rem 0.8rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
        font-size: 0.76rem;
        font-weight: 600;
      }
      .p-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.6rem;
        margin: 0.9rem 0;
      }
      .p-stats div {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.8rem 0.4rem;
        border: 1px solid var(--kf-line);
        border-radius: 18px;
        background: var(--kf-surface);
      }
      .p-stats strong {
        font-size: 1.3rem;
        font-weight: 700;
      }
      .p-stats span {
        font-size: 0.7rem;
        color: var(--kf-muted);
      }
      .p-next {
        padding: 0.85rem 1rem;
        border: 1px solid var(--kf-line);
        border-radius: 18px;
        background: var(--kf-surface);
        margin-bottom: 0.9rem;
      }
      .p-next-top {
        display: flex;
        justify-content: space-between;
        font-size: 0.78rem;
        color: var(--kf-muted);
        margin-bottom: 0.5rem;
      }
      .p-next-top strong {
        color: var(--tone);
      }
      .meter {
        height: 8px;
        border-radius: 999px;
        background: var(--kf-surface-2);
        overflow: hidden;
      }
      .meter span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--tone, var(--kf-accent));
        transition: width 600ms var(--kf-ease);
      }
      .p-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .p-actions button {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--kf-line);
        border-radius: 16px;
        background: var(--kf-surface);
        color: var(--kf-text);
        font-size: 0.9rem;
        font-weight: 600;
        text-align: left;
        transition: transform var(--kf-fast) var(--kf-ease);
      }
      .p-actions button:active {
        transform: scale(0.98);
      }
      .p-actions ion-icon {
        font-size: 1.2rem;
        color: var(--kf-accent);
      }
      .p-actions .end {
        margin-left: auto;
        color: var(--kf-muted);
      }
      .p-actions .danger {
        color: var(--kf-danger);
      }
      .p-actions .danger ion-icon {
        color: var(--kf-danger);
      }
    `,
  ],
})
export class TopNavComponent implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly extras = inject(RepairExtrasService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly config = inject(BOOKING_CONFIG);

  readonly user = this.booking.currentUser;
  readonly repairs = this.booking.myRepairs;
  readonly notifications = this.booking.notifications;
  readonly unreadCount = this.booking.unreadCount;
  readonly mode = this.theme.mode;
  readonly favoriteCount = this.extras.favoriteCount;

  readonly profileOpen = signal(false);
  readonly location = signal(readLocation());
  readonly locating = signal(false);
  readonly locationError = signal('');

  readonly initial = computed(() => (this.user()?.full_name ?? 'K').trim().charAt(0).toUpperCase() || 'K');
  readonly rank = computed(() =>
    customerRank(this.repairs().filter((repair) => repair.status === 'completed').length),
  );

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }

  markAllRead(): void {
    this.booking.markAllNotificationsRead();
  }

  go(url: string): void {
    this.profileOpen.set(false);
    void this.router.navigateByUrl(url);
  }

  saveLocation(value: string): void {
    const clean = value.trim().slice(0, 60);
    this.location.set(clean);
    this.locationError.set('');
    try {
      localStorage.setItem(LOCATION_KEY, clean);
    } catch {
      // Not remembered on this device.
    }
  }

  detectLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationError.set('Location is not available on this device. Type it instead.');
      return;
    }
    this.locating.set(true);
    this.locationError.set('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(2);
        const lng = position.coords.longitude.toFixed(2);
        this.saveLocation(`Near ${lat}, ${lng}`);
        this.locating.set(false);
      },
      () => {
        this.locating.set(false);
        this.locationError.set('Could not get your location. Please type it instead.');
      },
      { timeout: 8000 },
    );
  }

  timeAgo(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  /** Sign out of Supabase, then reload on the login screen. */
  async signOut(): Promise<void> {
    this.profileOpen.set(false);
    try {
      if (!this.config.useMockData) {
        const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
        await db.auth.signOut();
      }
    } finally {
      await this.router.navigateByUrl('/dev-login', { replaceUrl: true });
      window.location.reload();
    }
  }
}