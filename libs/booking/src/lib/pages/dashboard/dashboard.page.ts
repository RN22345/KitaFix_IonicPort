import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { RepairsService } from '../../services/repairs.service';
import { RepairCardComponent } from '../../ui/repair-card/repair-card.component';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RepairCardComponent,
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
