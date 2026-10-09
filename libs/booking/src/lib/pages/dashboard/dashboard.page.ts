import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
   IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';

import { addIcons } from 'ionicons';
import {
  calendar,
  time,
  phonePortrait,
  person,
  notificationsOutline,
  construct,
  constructOutline,
  refreshOutline,
  personCircleOutline,
  settingsOutline,
  logOutOutline,
  calendarOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';

interface QuickAction {
  icon: string;
  title: string;
  subtitle: string;
  /** null = page does not exist yet */
  route: string | null;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonSearchbar,
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

  readonly currentUser = this.booking.currentUser;
  readonly loading = this.booking.loading;
  readonly error = this.booking.error;
  readonly counts = this.booking.statusCounts;

  readonly name = computed(() => this.currentUser()?.full_name.split(' ')[0] ?? 'there');
  readonly initial = computed(() => this.name().charAt(0).toUpperCase());

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  constructor() {
    addIcons({
      calendar,
      time,
      phonePortrait,
      person,
      notificationsOutline,
      construct,
      constructOutline,
      refreshOutline,
      personCircleOutline,
      settingsOutline,
      logOutOutline,
      calendarOutline,
      checkmarkDoneOutline,
    });
  }

  readonly actions: readonly QuickAction[] = [
    {
      icon: 'calendar',
      title: 'My Appointments',
      subtitle: 'View & manage bookings',
      route: '/tabs/my-repairs',
    },
    {
      icon: 'time',
      title: 'Track Repair',
      subtitle: 'Check your device status',
      route: '/tabs/my-repairs',
    },
    {
      icon: 'phone-portrait',
      title: 'My Devices',
      subtitle: 'Manage your registered devices',
      route: null, // TODO: add route when the page exists
    },
    {
      icon: 'person',
      title: 'Technicians',
      subtitle: 'View available technicians',
      route: null, // TODO: add route when the page exists
    },
  ];

  /** Repairs that are not finished yet (dashboard preview, max 3). */
  readonly upcoming = computed(() =>
    this.booking
      .myRepairs()
      .filter(
        (repair) =>
          repair.status === 'pending' ||
          repair.status === 'in_progress' ||
          repair.status === 'testing',
      )
      .slice(0, 3),
  );

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  openAction(action: QuickAction): void {
    if (action.route) {
      void this.router.navigateByUrl(action.route);
    }
  }

  goToNewBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  goToMyRepairs(): void {
    void this.router.navigateByUrl('/tabs/my-repairs');
  }

  logout(): void {
    // TODO: call your auth service here, then navigate to login
  }

  markAllRead(): void {
    // TODO: clear unread state once notifications are real
  }
}
