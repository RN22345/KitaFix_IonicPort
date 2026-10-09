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
  refreshOutline,
} from 'ionicons/icons';

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
          refreshOutline,
                        });
  }

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

  goToNewBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  goToMyRepairs(): void {
    void this.router.navigateByUrl('/tabs/my-repairs');
  }
}
