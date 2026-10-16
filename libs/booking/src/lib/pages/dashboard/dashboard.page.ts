import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSpinner,
} from '@ionic/angular';
import { ThemeService } from '@kitafix/theme';
import { BOOKING_CONFIG } from '../../data-access/config';
import { getSupabaseClient } from '../../data-access/supabase-client';
import { isActiveRepair } from '../../models/repair.model';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';

/** How many active repairs Home shows before "See all". */
const HOME_ACTIVE_LIMIT = 3;

/**
 * Home: greeting, one way to book, and the repairs that are still in the shop.
 * Everything else (history, search, cancel, reschedule) lives on Repairs.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonSpinner,
    RepairCardComponent,
    RouterLink,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly router = inject(Router);
  private readonly config = inject(BOOKING_CONFIG);
  private readonly theme = inject(ThemeService);

  readonly currentUser = this.booking.currentUser;
  readonly loading = this.booking.loading;
  readonly error = this.booking.error;
  readonly repairs = this.booking.myRepairs;
  readonly notifications = this.booking.notifications;
  readonly unreadCount = this.booking.unreadCount;
  readonly themeMode = this.theme.mode;

  readonly name = computed(() => this.currentUser()?.full_name.split(' ')[0] ?? 'there');
  readonly initial = computed(() => this.name().charAt(0).toUpperCase());

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly active = computed(() => this.repairs().filter((repair) => isActiveRepair(repair)));
  readonly shownActive = computed(() => this.active().slice(0, HOME_ACTIVE_LIMIT));

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  markAllRead(): void {
    this.booking.markAllNotificationsRead();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }

  goToNewBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  goToMyRepairs(): void {
    void this.router.navigateByUrl('/tabs/my-repairs');
  }

  /**
   * Sign out of Supabase, then reload on the login screen so no repairs or
   * profile of the previous user stay in memory.
   */
  async signOut(): Promise<void> {
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
